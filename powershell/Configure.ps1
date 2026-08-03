[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

$AppDataDir = Join-Path $env:LOCALAPPDATA 'DailyTaskReminder'
$ConfigPath = Join-Path $AppDataDir 'config.json'
New-Item -ItemType Directory -Path $AppDataDir -Force | Out-Null

function Read-Required {
    param([string]$Prompt, [string]$Default = '')
    do {
        $suffix = if ($Default) { " [$Default]" } else { '' }
        $value = Read-Host "$Prompt$suffix"
        if (-not $value) { $value = $Default }
    } while (-not $value)
    return $value.Trim()
}

Write-Host ''
Write-Host 'Daily Task Reminder - Azure DevOps setup' -ForegroundColor Green
Write-Host 'The PAT is protected with Windows DPAPI for the current Windows user.'
Write-Host ''

$existing = $null
if (Test-Path -LiteralPath $ConfigPath) {
    try { $existing = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json } catch {}
}

$organization = Read-Required 'ADO organization' $(if ($existing) { $existing.Organization } else { '' })
$project = Read-Required 'ADO project' $(if ($existing) { $existing.Project } else { '' })
$teamName = Read-Required 'ADO team name' $(if ($existing) { $existing.TeamName } else { '' })
$apiVersion = Read-Required 'ADO API version' $(if ($existing) { $existing.ApiVersion } else { '7.1' })
$intervalText = Read-Required 'Repeat reminder every N minutes' $(if ($existing) { [string]$existing.ReminderIntervalMinutes } else { '15' })
$interval = 15
if (-not [int]::TryParse($intervalText, [ref]$interval) -or $interval -lt 1) { $interval = 15 }

$pat = Read-Host 'ADO Personal Access Token (leave blank to retain existing)' -AsSecureString
$emptyPat = -not $pat -or $pat.Length -eq 0
if ($emptyPat -and $existing -and $existing.ProtectedPat) {
    $protectedPat = $existing.ProtectedPat
}
elseif ($emptyPat) {
    throw 'A Personal Access Token is required.'
}
else {
    $protectedPat = ConvertFrom-SecureString $pat
}

$config = [ordered]@{
    Organization = $organization
    Project = $project
    TeamName = $teamName
    ApiVersion = $apiVersion
    ReminderIntervalMinutes = $interval
    ProtectedPat = $protectedPat
}
$config | ConvertTo-Json | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

Write-Host ''
Write-Host "Configuration saved to $ConfigPath" -ForegroundColor Green
Write-Host 'Testing Azure DevOps connection...'

try {
    & (Join-Path $PSScriptRoot 'DailyTaskReminder.ps1') -RunOnce
    if (-not $?) { throw 'The reminder connection test failed.' }
    Write-Host 'Connection and one-time reminder check succeeded.' -ForegroundColor Green
}
catch {
    [System.Windows.Forms.MessageBox]::Show(
        "Configuration was saved, but the test failed:`n`n$($_.Exception.Message)",
        'Daily Task Reminder',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    ) | Out-Null
    throw
}
