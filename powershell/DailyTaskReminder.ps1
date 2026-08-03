[CmdletBinding()]
param(
    [switch]$RunOnce
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

$AppName = 'DailyTaskReminder'
$AppDataDir = Join-Path $env:LOCALAPPDATA $AppName
$ConfigPath = Join-Path $AppDataDir 'config.json'
$StatePath = Join-Path $AppDataDir 'state.json'
$LogPath = Join-Path $AppDataDir 'reminder.log'
$PidPath = Join-Path $AppDataDir 'worker.pid'
$script:LastAdoSync = [datetime]::MinValue
$script:CurrentUser = $null

New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $line = '{0:u} [{1}] {2}' -f (Get-Date), $Level, $Message
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
}

function Show-ErrorMessage {
    param([string]$Message)
    Write-Log $Message 'ERROR'
    [System.Windows.Forms.MessageBox]::Show(
        $Message,
        'Daily Task Reminder',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Get-LocalDateKey {
    return (Get-Date).ToString('yyyy-MM-dd')
}

function Get-Config {
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        throw "Configuration not found. Run Configure.ps1 first."
    }
    return Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
}

function Get-PlainPat {
    param([string]$ProtectedPat)
    $secure = ConvertTo-SecureString $ProtectedPat
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try {
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
    }
    finally {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
}

function Invoke-AdoRequest {
    param(
        [Parameter(Mandatory)][string]$Path,
        [ValidateSet('GET', 'PATCH')][string]$Method = 'GET',
        [object]$Body
    )

    $config = Get-Config
    $pat = Get-PlainPat $config.ProtectedPat
    try {
        $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat"))
        $headers = @{ Authorization = "Basic $token" }
        $uri = "https://dev.azure.com/$Path"
        if ($uri -notmatch '\?') {
            $uri += "?api-version=$($config.ApiVersion)"
        }
        elseif ($uri -notmatch 'api-version=') {
            $uri += "&api-version=$($config.ApiVersion)"
        }

        $parameters = @{
            Uri = $uri
            Method = $Method
            Headers = $headers
            UseBasicParsing = $true
        }
        if ($Method -eq 'PATCH') {
            $parameters['ContentType'] = 'application/json-patch+json'
            $parameters['Body'] = ($Body | ConvertTo-Json -Depth 10)
        }
        return Invoke-RestMethod @parameters
    }
    finally {
        $pat = $null
    }
}

function Get-AdoCurrentUser {
    $config = Get-Config
    $data = Invoke-AdoRequest -Path "$($config.Organization)/_apis/connectionData?connectOptions=1&lastChangeId=-1&lastChangeId64=-1"
    if (-not $data.authenticatedUser.id) {
        throw 'Azure DevOps did not return an authenticated user for this PAT.'
    }
    $account = $data.authenticatedUser.properties.Account.'$value'
    $displayName = [string]$data.authenticatedUser.providerDisplayName
    if (-not $displayName) { $displayName = [string]$data.authenticatedUser.customDisplayName }
    if (-not $displayName) { $displayName = [string]$data.authenticatedUser.uniqueName }
    $uniqueName = [string]$account
    if (-not $uniqueName) { $uniqueName = [string]$data.authenticatedUser.uniqueName }
    return [pscustomobject]@{
        Id = [string]$data.authenticatedUser.id
        DisplayName = $displayName
        UniqueName = $uniqueName
    }
}

function Test-DoneState {
    param([string]$State)
    return @('done', 'closed', 'completed', 'removed') -contains $State.ToLowerInvariant()
}

function Convert-AdoPriority {
    param($Priority)
    if ([int]$Priority -eq 1) { return 'High' }
    if ([int]$Priority -eq 2) { return 'Medium' }
    return 'Low'
}

function Get-AdoAssignedTasks {
    param($User)
    $config = Get-Config
    $organization = $config.Organization
    $project = [uri]::EscapeDataString($config.Project)
    $team = [uri]::EscapeDataString($config.TeamName)

    $iterations = Invoke-AdoRequest -Path "$organization/$project/$team/_apis/work/teamsettings/iterations?`$timeframe=current"
    $iteration = @($iterations.value) | Select-Object -First 1
    if (-not $iteration.id) {
        throw 'No current Azure DevOps sprint was found for the configured team.'
    }

    $board = Invoke-AdoRequest -Path "$organization/$project/$team/_apis/work/teamsettings/iterations/$($iteration.id)/workitems"
    $ids = @($board.workItemRelations | ForEach-Object { $_.target.id } | Where-Object { $_ })
    if ($ids.Count -eq 0) { return @() }

    $fields = @(
        'System.Id', 'System.Title', 'System.State', 'System.WorkItemType',
        'System.AssignedTo', 'Microsoft.VSTS.Common.Priority',
        'System.CreatedDate', 'System.ChangedDate'
    ) -join ','
    $batch = Invoke-AdoRequest -Path "$organization/$project/_apis/wit/workitems?ids=$($ids -join ',')&fields=$([uri]::EscapeDataString($fields))"

    $identityValues = @($User.Id, $User.UniqueName, $User.DisplayName) |
        Where-Object { $_ } |
        ForEach-Object { $_.ToString().Trim().ToLowerInvariant() }

    $tasks = foreach ($item in @($batch.value)) {
        $assigned = $item.fields.'System.AssignedTo'
        $assignedValues = @($assigned.id, $assigned.uniqueName, $assigned.displayName) |
            Where-Object { $_ } |
            ForEach-Object { $_.ToString().Trim().ToLowerInvariant() }
        if (-not ($identityValues | Where-Object { $assignedValues -contains $_ })) { continue }
        if (Test-DoneState ([string]$item.fields.'System.State')) { continue }

        [pscustomobject]@{
            Id = "ado_$($item.id)"
            Title = [string]$item.fields.'System.Title'
            ScheduleTime = (Get-Date).ToString('HH:mm')
            Priority = Convert-AdoPriority $item.fields.'Microsoft.VSTS.Common.Priority'
            Status = 'Pending'
            Source = 'ADO'
            CreatedAt = [string]$item.fields.'System.CreatedDate'
            CompletedAt = $null
            LastRemindedAt = $null
            SnoozedUntil = $null
            AdoWorkItemId = [int]$item.id
            AdoState = [string]$item.fields.'System.State'
        }
    }
    return @($tasks)
}

function Get-State {
    if (-not (Test-Path -LiteralPath $StatePath)) {
        return [pscustomobject]@{ Days = [pscustomobject]@{} }
    }
    try {
        return Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    }
    catch {
        Write-Log "State file was invalid and will be recreated: $($_.Exception.Message)" 'WARN'
        return [pscustomobject]@{ Days = [pscustomobject]@{} }
    }
}

function Save-State {
    param($State)
    $State | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $StatePath -Encoding UTF8
}

function Get-TodayTasks {
    $state = Get-State
    $key = Get-LocalDateKey
    $day = $state.Days.PSObject.Properties[$key]
    if (-not $day) { return @() }
    return @($day.Value.Tasks)
}

function Set-TodayTasks {
    param([array]$Tasks, [bool]$Confirmed = $true)
    $state = Get-State
    $key = Get-LocalDateKey
    $day = [pscustomobject]@{
        Confirmed = $Confirmed
        UserId = if ($script:CurrentUser) { $script:CurrentUser.Id } else { $null }
        UserName = if ($script:CurrentUser) { $script:CurrentUser.DisplayName } else { $null }
        Tasks = @($Tasks)
    }
    if ($state.Days.PSObject.Properties[$key]) {
        $state.Days.$key = $day
    }
    else {
        $state.Days | Add-Member -NotePropertyName $key -NotePropertyValue $day
    }
    Save-State $state
}

function Test-TodayConfirmed {
    $state = Get-State
    $property = $state.Days.PSObject.Properties[(Get-LocalDateKey)]
    return [bool]($property -and $property.Value.Confirmed)
}

function Sync-AdoTasks {
    $adoTasks = @(Get-AdoAssignedTasks $script:CurrentUser)
    $current = @(Get-TodayTasks)
    $manual = @($current | Where-Object { $_.Source -eq 'Manual' })
    $existing = @{}
    foreach ($task in $current | Where-Object { $_.Source -eq 'ADO' }) {
        $existing[[string]$task.AdoWorkItemId] = $task
    }

    foreach ($task in $adoTasks) {
        $old = $existing[[string]$task.AdoWorkItemId]
        if ($old) {
            $task.ScheduleTime = $old.ScheduleTime
            $task.Status = $old.Status
            $task.LastRemindedAt = $old.LastRemindedAt
            $task.SnoozedUntil = $old.SnoozedUntil
        }
    }
    Set-TodayTasks -Tasks @($manual + $adoTasks) -Confirmed:(Test-TodayConfirmed)
    $script:LastAdoSync = Get-Date
    Write-Log "Synced $($adoTasks.Count) active ADO task(s) for $($script:CurrentUser.DisplayName)."
}

function Add-ManualTasksForToday {
    $tasks = @(Get-TodayTasks)
    while ($true) {
        $title = [Microsoft.VisualBasic.Interaction]::InputBox(
            "Active ADO tasks loaded: $(@($tasks | Where-Object Source -eq 'ADO').Count).`n`nEnter an additional TODO, or leave blank to finish.",
            'Daily Task Reminder - Today''s plan',
            ''
        ).Trim()
        if (-not $title) { break }

        $time = [Microsoft.VisualBasic.Interaction]::InputBox(
            'Reminder time (24-hour HH:mm):',
            "Schedule: $title",
            (Get-Date).ToString('HH:mm')
        ).Trim()
        if ($time -notmatch '^([01]\d|2[0-3]):[0-5]\d$') {
            $time = (Get-Date).ToString('HH:mm')
        }

        $priority = [Microsoft.VisualBasic.Interaction]::InputBox(
            'Priority: High, Medium, or Low',
            "Priority: $title",
            'Medium'
        ).Trim()
        if (@('High', 'Medium', 'Low') -notcontains $priority) { $priority = 'Medium' }

        $tasks += [pscustomobject]@{
            Id = "manual_$([guid]::NewGuid().ToString('N'))"
            Title = $title
            ScheduleTime = $time
            Priority = $priority
            Status = 'Pending'
            Source = 'Manual'
            CreatedAt = (Get-Date).ToString('o')
            CompletedAt = $null
            LastRemindedAt = $null
            SnoozedUntil = $null
            AdoWorkItemId = $null
            AdoState = $null
        }
    }

    if ($tasks.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show(
            'No tasks were found or entered. The reminder will check ADO again in 15 minutes.',
            'Daily Task Reminder',
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Information
        ) | Out-Null
    }
    Set-TodayTasks -Tasks $tasks -Confirmed $true
}

function Get-AdoCompletionState {
    param([string]$CurrentState)
    switch ($CurrentState.ToLowerInvariant()) {
        { $_ -in @('new', 'active', 'resolved') } { return 'Closed' }
        { $_ -in @('to do', 'committed', 'in progress') } { return 'Done' }
        default { return 'Completed' }
    }
}

function Complete-AdoTask {
    param($Task)
    $config = Get-Config
    $project = [uri]::EscapeDataString($config.Project)
    $target = Get-AdoCompletionState ([string]$Task.AdoState)
    $patch = @(@{ op = 'add'; path = '/fields/System.State'; value = $target })
    Invoke-AdoRequest -Path "$($config.Organization)/$project/_apis/wit/workitems/$($Task.AdoWorkItemId)" -Method PATCH -Body $patch | Out-Null
}

function Update-Task {
    param([string]$TaskId, [string]$Status, [int]$SnoozeMinutes = 0)
    $tasks = @(Get-TodayTasks)
    $task = $tasks | Where-Object Id -eq $TaskId | Select-Object -First 1
    if (-not $task) { return }

    if ($Status -eq 'Completed' -and $task.Source -eq 'ADO') {
        Complete-AdoTask $task
    }

    $task.Status = $Status
    if ($Status -eq 'Completed') {
        $task.CompletedAt = (Get-Date).ToString('o')
        $task.SnoozedUntil = $null
    }
    elseif ($SnoozeMinutes -gt 0) {
        $task.SnoozedUntil = (Get-Date).AddMinutes($SnoozeMinutes).ToString('o')
    }
    Set-TodayTasks $tasks
}

function Get-NextDueTask {
    $now = Get-Date
    $priorityRank = @{ High = 0; Medium = 1; Low = 2 }
    return Get-TodayTasks |
        Where-Object {
            if ($_.Status -eq 'Completed') { return $false }
            if ($_.SnoozedUntil -and ([datetime]$_.SnoozedUntil) -gt $now) { return $false }
            $scheduled = [datetime]::ParseExact($_.ScheduleTime, 'HH:mm', $null)
            $due = [datetime]::Today.AddHours($scheduled.Hour).AddMinutes($scheduled.Minute)
            if ($due -gt $now) { return $false }
            if ($_.LastRemindedAt) {
                $interval = [int](Get-Config).ReminderIntervalMinutes
                if (([datetime]$_.LastRemindedAt).AddMinutes($interval) -gt $now) { return $false }
            }
            return $true
        } |
        Sort-Object @{ Expression = 'ScheduleTime'; Ascending = $true },
                    @{ Expression = { $priorityRank[$_.Priority] }; Ascending = $true },
                    @{ Expression = 'CreatedAt'; Ascending = $true } |
        Select-Object -First 1
}

function Show-TaskReminder {
    param($Task)
    $tasks = @(Get-TodayTasks)
    $stored = $tasks | Where-Object Id -eq $Task.Id | Select-Object -First 1
    $stored.LastRemindedAt = (Get-Date).ToString('o')
    Set-TodayTasks $tasks

    $remaining = @($tasks | Where-Object Status -ne 'Completed').Count
    $result = [System.Windows.Forms.MessageBox]::Show(
        "$($Task.Title)`n`nTime: $($Task.ScheduleTime)   Priority: $($Task.Priority)`nSource: $($Task.Source)$(if ($Task.AdoWorkItemId) { " #$($Task.AdoWorkItemId)" })`n`n$remaining task(s) remain today.`n`nYes = Mark done`nNo = In progress`nCancel = Snooze 10 minutes",
        'Daily Task Reminder',
        [System.Windows.Forms.MessageBoxButtons]::YesNoCancel,
        [System.Windows.Forms.MessageBoxIcon]::Information,
        [System.Windows.Forms.MessageBoxDefaultButton]::Button1,
        [System.Windows.Forms.MessageBoxOptions]::ServiceNotification
    )

    try {
        switch ($result) {
            'Yes' { Update-Task $Task.Id 'Completed' }
            'No' { Update-Task $Task.Id 'InProgress' }
            default { Update-Task $Task.Id $Task.Status 10 }
        }
    }
    catch {
        Show-ErrorMessage "Could not update '$($Task.Title)': $($_.Exception.Message)"
    }
}

$createdNew = $false
$mutex = New-Object Threading.Mutex($true, "Local\$AppName", [ref]$createdNew)
if (-not $createdNew) {
    Write-Log 'A reminder worker is already running.' 'WARN'
    exit 0
}

try {
    Set-Content -LiteralPath $PidPath -Value $PID
    Write-Log "Worker started (PID $PID)."
    $script:CurrentUser = Get-AdoCurrentUser
    Sync-AdoTasks
    if (-not (Test-TodayConfirmed)) {
        Add-ManualTasksForToday
    }

    do {
        if ((Get-Date) - $script:LastAdoSync -ge [timespan]::FromMinutes(15)) {
            try { Sync-AdoTasks } catch { Write-Log "ADO refresh failed: $($_.Exception.Message)" 'WARN' }
        }
        $task = Get-NextDueTask
        if ($task) { Show-TaskReminder $task }
        if (-not $RunOnce) { Start-Sleep -Seconds 30 }
    } while (-not $RunOnce)
}
catch {
    Show-ErrorMessage $_.Exception.Message
    exit 1
}
finally {
    Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
    if ($mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
    Write-Log 'Worker stopped.'
}
