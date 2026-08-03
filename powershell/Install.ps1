[CmdletBinding()]
param(
    [switch]$SkipConfigure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$TaskName = 'Daily Task Reminder'
$WorkerPath = Join-Path $PSScriptRoot 'DailyTaskReminder.ps1'
$ConfigPath = Join-Path $env:LOCALAPPDATA 'DailyTaskReminder\config.json'

if (-not $SkipConfigure -or -not (Test-Path -LiteralPath $ConfigPath)) {
    & (Join-Path $PSScriptRoot 'Configure.ps1')
}

$powerShellExe = Join-Path $PSHOME 'powershell.exe'
$arguments = "-NoLogo -NoProfile -STA -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WorkerPath`""
$action = New-ScheduledTaskAction -Execute $powerShellExe -Argument $arguments -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $TaskName `
    -Description 'Imports the logged-in PAT user active ADO tasks and shows scheduled reminders.' `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null

Start-ScheduledTask -TaskName $TaskName

Write-Host ''
Write-Host "Installed and started '$TaskName'." -ForegroundColor Green
Write-Host 'It will start automatically at Windows logon and stop when that user session ends.'
Write-Host "Logs: $env:LOCALAPPDATA\DailyTaskReminder\reminder.log"
