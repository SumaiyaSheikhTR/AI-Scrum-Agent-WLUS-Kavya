[CmdletBinding()]
param(
    [switch]$RunOnce,
    [switch]$TestConnection
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic

. (Join-Path $PSScriptRoot 'UI.ps1')

# Windows PowerShell 5.1 defaults to TLS 1.0/1.1, which dev.azure.com rejects.
try {
    [Net.ServicePointManager]::SecurityProtocol =
        [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
}
catch {
    # Ignore: newer hosts already negotiate TLS 1.2+.
}

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
        [object]$Body,
        [string]$ApiVersion,
        [switch]$NoApiVersion
    )

    $config = Get-Config
    if (-not $ApiVersion) { $ApiVersion = $config.ApiVersion }
    $pat = Get-PlainPat $config.ProtectedPat
    try {
        $token = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$pat"))
        $headers = @{ Authorization = "Basic $token" }
        $uri = "https://dev.azure.com/$Path"
        if (-not $NoApiVersion) {
            if ($uri -notmatch '\?') {
                $uri += "?api-version=$ApiVersion"
            }
            elseif ($uri -notmatch 'api-version=') {
                $uri += "&api-version=$ApiVersion"
            }
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

        try {
            return Invoke-RestMethod @parameters
        }
        catch {
            throw (Get-AdoRequestError -ErrorRecord $_ -Uri $uri)
        }
    }
    finally {
        $pat = $null
    }
}

function Get-AdoRequestError {
    param($ErrorRecord, [string]$Uri)

    $status = ''
    $detail = ''
    $response = $null
    if ($ErrorRecord.Exception.PSObject.Properties['Response']) {
        $response = $ErrorRecord.Exception.Response
    }

    if ($response) {
        try { $status = "HTTP $([int]$response.StatusCode) " } catch { }
        try {
            $stream = $response.GetResponseStream()
            $reader = New-Object IO.StreamReader($stream)
            $raw = $reader.ReadToEnd()
            $reader.Close()
            if ($raw) {
                try {
                    $parsed = $raw | ConvertFrom-Json
                    if ($parsed.PSObject.Properties['message']) { $detail = [string]$parsed.message }
                }
                catch { }
                if (-not $detail) { $detail = $raw.Trim() }
            }
        }
        catch { }
    }

    if (-not $detail) { $detail = $ErrorRecord.Exception.Message }
    if ($detail.Length -gt 500) { $detail = $detail.Substring(0, 500) + '...' }

    # The PAT travels in the Authorization header, so the URI is safe to surface.
    return "$status$detail`n  Request: $Uri"
}

function Get-AdoCurrentUser {
    $config = Get-Config
    # connectionData is a preview-only resource: a released api-version (e.g. 7.1)
    # is rejected with HTTP 400 VssInvalidPreviewVersionException.
    $previewVersion = $config.ApiVersion
    if ($previewVersion -notlike '*-preview*') { $previewVersion = "$previewVersion-preview" }

    $endpoint = "$($config.Organization)/_apis/connectionData?connectOptions=1&lastChangeId=-1&lastChangeId64=-1"
    try {
        $data = Invoke-AdoRequest -Path $endpoint -ApiVersion $previewVersion
    }
    catch {
        Write-Log "connectionData with api-version=$previewVersion failed: $($_.Exception.Message). Retrying without api-version." 'WARN'
        $data = Invoke-AdoRequest -Path $endpoint -NoApiVersion
    }
    $authenticatedUser = $data.PSObject.Properties['authenticatedUser'].Value
    if (-not $authenticatedUser -or -not $authenticatedUser.PSObject.Properties['id'] -or -not $authenticatedUser.id) {
        throw 'Azure DevOps did not return an authenticated user. Check the organization name and that the PAT is valid and not expired.'
    }
    $data = [pscustomobject]@{ authenticatedUser = $authenticatedUser }
    $account = $null
    $props = $authenticatedUser.PSObject.Properties['properties']
    if ($props -and $props.Value.PSObject.Properties['Account']) {
        $account = $props.Value.Account.'$value'
    }
    $getProp = {
        param($obj, $name)
        $p = $obj.PSObject.Properties[$name]
        if ($p) { return [string]$p.Value }
        return ''
    }
    $displayName = & $getProp $authenticatedUser 'providerDisplayName'
    if (-not $displayName) { $displayName = & $getProp $authenticatedUser 'customDisplayName' }
    if (-not $displayName) { $displayName = & $getProp $authenticatedUser 'uniqueName' }
    $uniqueName = [string]$account
    if (-not $uniqueName) { $uniqueName = & $getProp $authenticatedUser 'uniqueName' }
    return [pscustomobject]@{
        Id = [string]$authenticatedUser.id
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
    $iterationValues = @()
    if ($iterations.PSObject.Properties['value']) { $iterationValues = @($iterations.value) }
    $iteration = $iterationValues | Select-Object -First 1
    if (-not $iteration -or -not $iteration.PSObject.Properties['id'] -or -not $iteration.id) {
        throw "No current sprint found for team '$($config.TeamName)' in project '$($config.Project)'. Check the team name and that it has an active iteration."
    }

    $board = Invoke-AdoRequest -Path "$organization/$project/$team/_apis/work/teamsettings/iterations/$($iteration.id)/workitems"
    $relations = @()
    if ($board.PSObject.Properties['workItemRelations']) { $relations = @($board.workItemRelations) }
    $ids = @($relations | ForEach-Object { $_.target.id } | Where-Object { $_ })
    if ($ids.Count -eq 0) { return @() }

    $fields = @(
        'System.Id', 'System.Title', 'System.State', 'System.WorkItemType',
        'System.AssignedTo', 'Microsoft.VSTS.Common.Priority',
        'System.CreatedDate', 'System.ChangedDate'
    ) -join ','
    $batch = Invoke-AdoRequest -Path "$organization/$project/_apis/wit/workitems?ids=$($ids -join ',')&fields=$([uri]::EscapeDataString($fields))"
    $batchValues = @()
    if ($batch.PSObject.Properties['value']) { $batchValues = @($batch.value) }

    $identityValues = @($User.Id, $User.UniqueName, $User.DisplayName) |
        Where-Object { $_ } |
        ForEach-Object { $_.ToString().Trim().ToLowerInvariant() }

    $tasks = foreach ($item in $batchValues) {
        $assigned = $null
        if ($item.fields.PSObject.Properties['System.AssignedTo']) {
            $assigned = $item.fields.'System.AssignedTo'
        }
        $assignedValues = @()
        if ($assigned) {
            foreach ($prop in 'id', 'uniqueName', 'displayName') {
                $member = $assigned.PSObject.Properties[$prop]
                if ($member -and $member.Value) {
                    $assignedValues += $member.Value.ToString().Trim().ToLowerInvariant()
                }
            }
        }
        if (-not ($identityValues | Where-Object { $assignedValues -contains $_ })) { continue }

        $field = {
            param($name)
            $p = $item.fields.PSObject.Properties[$name]
            if ($p) { return $p.Value }
            return $null
        }
        $state = [string](& $field 'System.State')
        if (Test-DoneState $state) { continue }

        [pscustomobject]@{
            Id = "ado_$($item.id)"
            Title = [string](& $field 'System.Title')
            ScheduleTime = (Get-Date).ToString('HH:mm')
            Priority = Convert-AdoPriority (& $field 'Microsoft.VSTS.Common.Priority')
            Status = 'Pending'
            Source = 'ADO'
            CreatedAt = [string](& $field 'System.CreatedDate')
            CompletedAt = $null
            LastRemindedAt = $null
            SnoozedUntil = $null
            AdoWorkItemId = [int]$item.id
            AdoState = $state
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
    $adoTasks = @($tasks | Where-Object { $_.Source -eq 'ADO' })

    $plan = Show-PlannerWindow -UserName $script:CurrentUser.DisplayName -AdoTasks $adoTasks

    foreach ($entry in @($plan.ManualTasks)) {
        $tasks += [pscustomobject]@{
            Id = "manual_$([guid]::NewGuid().ToString('N'))"
            Title = $entry.Title
            ScheduleTime = $entry.ScheduleTime
            Priority = $entry.Priority
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

    Set-TodayTasks -Tasks $tasks -Confirmed $plan.Confirmed
    Write-Log "Daily plan confirmed=$($plan.Confirmed) with $(@($plan.ManualTasks).Count) manual task(s)."
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

    $completed = @($tasks | Where-Object { $_.Status -eq 'Completed' }).Count
    $remaining = $tasks.Count - $completed

    $result = Show-ReminderWindow -Task $Task -Remaining $remaining -Total $tasks.Count -Completed $completed

    try {
        switch ($result) {
            'Done' { Update-Task $Task.Id 'Completed' }
            'InProgress' { Update-Task $Task.Id 'InProgress' }
            'Snooze5' { Update-Task $Task.Id $Task.Status 5 }
            'Snooze15' { Update-Task $Task.Id $Task.Status 15 }
            'Snooze60' { Update-Task $Task.Id $Task.Status 60 }
            default { }
        }
        Write-Log "Reminder for '$($Task.Title)' resolved as $result."
    }
    catch {
        Show-ErrorMessage "Could not update '$($Task.Title)': $($_.Exception.Message)"
    }
}

if ($TestConnection) {
    try {
        $user = Get-AdoCurrentUser
        Write-Host "Connected to Azure DevOps as $($user.DisplayName) (id $($user.Id))." -ForegroundColor Green
        $tasks = @(Get-AdoAssignedTasks $user)
        Write-Host "Found $($tasks.Count) active task(s) assigned to you in the current sprint." -ForegroundColor Green
        Write-Log "Connection test succeeded for $($user.DisplayName): $($tasks.Count) active task(s)."
        exit 0
    }
    catch {
        $message = $_.Exception.Message
        Write-Host "Azure DevOps connection test failed: $message" -ForegroundColor Red
        Write-Log "Connection test failed: $message" 'ERROR'
        exit 1
    }
}

$createdNew = $false
$mutex = New-Object Threading.Mutex($true, "Local\$AppName", [ref]$createdNew)
if (-not $createdNew) {
    Write-Log 'A reminder worker is already running.' 'WARN'
    exit 0
}

function Invoke-ReminderCycle {
    if ($script:ReminderBusy) { return }
    if ($script:PausedUntil -and (Get-Date) -lt $script:PausedUntil) { return }

    $script:ReminderBusy = $true
    try {
        if ((Get-Date) - $script:LastAdoSync -ge [timespan]::FromMinutes(15)) {
            try { Sync-AdoTasks }
            catch { Write-Log "ADO refresh failed: $($_.Exception.Message)" 'WARN' }
        }

        if ((Get-LocalDateKey) -ne $script:ActiveDay) {
            $script:ActiveDay = Get-LocalDateKey
            if (-not (Test-TodayConfirmed)) { Add-ManualTasksForToday }
        }

        $task = Get-NextDueTask
        if ($task) { Show-TaskReminder $task }
    }
    finally {
        $script:ReminderBusy = $false
    }
}

function New-TrayIcon {
    $notify = New-Object System.Windows.Forms.NotifyIcon
    $notify.Icon = [System.Drawing.SystemIcons]::Information
    $notify.Text = 'Daily Task Reminder'
    $notify.Visible = $true

    $menu = New-Object System.Windows.Forms.ContextMenuStrip
    $itemQueue = $menu.Items.Add("Today's tasks")
    $itemSync = $menu.Items.Add('Sync Azure DevOps')
    $itemPause = $menu.Items.Add('Pause for 1 hour')
    [void]$menu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator))
    $itemExit = $menu.Items.Add('Exit')
    $notify.ContextMenuStrip = $menu

    $showQueue = {
        if ($script:ReminderBusy) { return }
        $script:ReminderBusy = $true
        try {
            $result = Show-QueueWindow -Tasks (Get-TodayTasks)
            foreach ($taskId in @($result.Completed)) {
                try { Update-Task $taskId 'Completed' }
                catch { Show-ErrorMessage "Could not complete task: $($_.Exception.Message)" }
            }
            if ($result.SyncRequested) {
                try { Sync-AdoTasks }
                catch { Show-ErrorMessage "Sync failed: $($_.Exception.Message)" }
            }
        }
        finally { $script:ReminderBusy = $false }
    }

    $itemQueue.Add_Click($showQueue)
    $notify.Add_DoubleClick($showQueue)

    $itemSync.Add_Click({
        try {
            Sync-AdoTasks
            Show-ToastMessage -NotifyIcon $notify -Message "Synced. $(@(Get-TodayTasks | Where-Object { $_.Status -ne 'Completed' }).Count) task(s) open."
        }
        catch { Show-ErrorMessage "Sync failed: $($_.Exception.Message)" }
    }.GetNewClosure())

    $itemPause.Add_Click({
        $script:PausedUntil = (Get-Date).AddHours(1)
        Show-ToastMessage -NotifyIcon $notify -Message 'Reminders paused for 1 hour.'
        Write-Log 'Reminders paused for 1 hour.'
    }.GetNewClosure())

    $itemExit.Add_Click({
        Write-Log 'Exit requested from tray menu.'
        $notify.Visible = $false
        [System.Windows.Threading.Dispatcher]::CurrentDispatcher.InvokeShutdown()
    }.GetNewClosure())

    return $notify
}

$script:ReminderBusy = $false
$script:PausedUntil = $null
$script:ActiveDay = Get-LocalDateKey
$notifyIcon = $null

try {
    Set-Content -LiteralPath $PidPath -Value $PID
    Write-Log "Worker started (PID $PID)."
    $script:CurrentUser = Get-AdoCurrentUser
    Sync-AdoTasks

    if ($RunOnce) {
        if (-not (Test-TodayConfirmed)) { Add-ManualTasksForToday }
        $task = Get-NextDueTask
        if ($task) { Show-TaskReminder $task }
        exit 0
    }

    if (-not (Test-TodayConfirmed)) { Add-ManualTasksForToday }

    $notifyIcon = New-TrayIcon
    Show-ToastMessage -NotifyIcon $notifyIcon -Message "Tracking $(@(Get-TodayTasks | Where-Object { $_.Status -ne 'Completed' }).Count) task(s) today."

    $timer = New-Object System.Windows.Threading.DispatcherTimer
    $timer.Interval = [timespan]::FromSeconds(30)
    $timer.Add_Tick({
        try { Invoke-ReminderCycle }
        catch { Write-Log "Reminder cycle failed: $($_.Exception.Message)" 'WARN' }
    })
    $timer.Start()

    Invoke-ReminderCycle
    [System.Windows.Threading.Dispatcher]::Run()
}
catch {
    Show-ErrorMessage $_.Exception.Message
    exit 1
}
finally {
    if ($notifyIcon) {
        $notifyIcon.Visible = $false
        $notifyIcon.Dispose()
    }
    Remove-Item -LiteralPath $PidPath -Force -ErrorAction SilentlyContinue
    if ($mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
    Write-Log 'Worker stopped.'
}
