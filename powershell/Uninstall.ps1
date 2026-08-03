[CmdletBinding()]
param(
    [switch]$RemoveData
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$TaskName = 'Daily Task Reminder'
$AppDataDir = Join-Path $env:LOCALAPPDATA 'DailyTaskReminder'
$PidPath = Join-Path $AppDataDir 'worker.pid'

if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

if (Test-Path -LiteralPath $PidPath) {
    $workerPid = Get-Content -LiteralPath $PidPath -ErrorAction SilentlyContinue
    if ($workerPid -match '^\d+$') {
        Stop-Process -Id ([int]$workerPid) -Force -ErrorAction SilentlyContinue
    }
}

if ($RemoveData -and (Test-Path -LiteralPath $AppDataDir)) {
    Remove-Item -LiteralPath $AppDataDir -Recurse -Force
}

Write-Host "Uninstalled '$TaskName'." -ForegroundColor Green
if (-not $RemoveData) {
    Write-Host "Configuration and daily state were retained in $AppDataDir"
    Write-Host 'Run with -RemoveData to delete them.'
}
