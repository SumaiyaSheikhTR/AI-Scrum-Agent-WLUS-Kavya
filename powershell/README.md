# Daily Task Reminder — PowerShell batch edition

This is the Windows background/batch version of Daily Task Reminder. It does not
need Node.js, a browser, or a web server.

## Interface

The UI is WPF-based, not classic message boxes:

- **Daily planner** — a full window on the first run each day listing imported ADO
  tasks and letting you add personal TODOs inline (Enter adds a row).
- **Reminder card** — a borderless card that slides into the bottom-right corner with a
  priority accent, day-progress bar, and Mark done / In progress / Snooze (5 min, 15 min, 1 hour).
- **Tray icon** — right-click for today's queue, manual ADO sync, pause for an hour, or exit.
  Double-click opens the queue.

## Behavior

- Starts automatically when the Windows user logs on.
- Uses the configured ADO PAT to resolve the authenticated user's ADO id.
- Loads active work items assigned to that user in the current team sprint.
- On the first run each day, asks for optional additional TODOs.
- Orders due work by scheduled time, then priority.
- Repeats reminders at the configured interval.
- Reminder actions: mark done (advances to the next due task), in progress, or snooze.
- For ADO tasks, completing the reminder updates `System.State` in ADO.
- Rolls over automatically at midnight and re-opens the planner for the new day.
- The worker is tied to the interactive Windows session and ends at logout.

## Requirements

- Windows 10/11
- Windows PowerShell 5.1
- Network access to `https://dev.azure.com`
- A PAT with at least:
  - **Work Items: Read** to import tasks
  - **Work Items: Read & write** to mark ADO tasks complete

## Install

1. Download or clone the repository.
2. Open the `powershell` folder.
3. Double-click **`Install.cmd`**.
4. Enter organization, project, team, PAT, and reminder interval.

The PAT is encrypted with Windows DPAPI and can only be decrypted by the same
Windows user on the same machine. Configuration and state are stored under:

```text
%LOCALAPPDATA%\DailyTaskReminder
```

The installer creates a Windows Scheduled Task named:

```text
Daily Task Reminder
```

## Run without installing

Double-click `Run.cmd`, or:

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\DailyTaskReminder.ps1
```

Only one worker can run per Windows session.

## Reconfigure

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\Configure.ps1
```

## Uninstall

Double-click `Uninstall.cmd`. This keeps config and daily history. To remove
those too:

```powershell
.\Uninstall.ps1 -RemoveData
```

## Logs

```text
%LOCALAPPDATA%\DailyTaskReminder\reminder.log
```

## Troubleshooting

Test just the ADO connection (no reminders, no prompts):

```powershell
powershell.exe -ExecutionPolicy Bypass -File .\DailyTaskReminder.ps1 -TestConnection
```

Common failures:

- **`Azure DevOps did not return an authenticated user`** — wrong organization, or the
  PAT is expired/revoked or lacks Work Items (Read) scope.
- **`No current sprint found for team ...`** — the team name must match Azure DevOps
  exactly (spaces allowed), and the team needs an active iteration.
- **TLS / secure channel errors** — the script forces TLS 1.2, which resolves the usual
  Windows PowerShell 5.1 handshake failure against `dev.azure.com`.
- **HTTP 400 on `connectionData`** — that endpoint is preview-only, so the script requests
  it with a `-preview` api-version and falls back to no api-version. A released version
  such as `7.1` alone returns `VssInvalidPreviewVersionException`.

Errors now include the HTTP status, the Azure DevOps message, and the request URL
(the PAT is sent in a header and is never part of the URL).

Organization, project, and team names may contain spaces; enter them as shown in
Azure DevOps (they are URL-encoded automatically).

## ADO process states

ADO process templates use different completion states. The worker maps:

- `New`, `Active`, `Resolved` → `Closed`
- `To Do`, `Committed`, `In Progress` → `Done`
- other states → `Completed`

If your project uses custom states, adjust `Get-AdoCompletionState` in
`DailyTaskReminder.ps1`.
