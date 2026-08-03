# Daily Task Reminder

Standalone Azure DevOps daily task reminder app (separate from AI Scrum Agent).

## What it does

1. Connects with your ADO org / project / team / PAT
2. Resolves the authenticated user's ADO id from the PAT
3. Imports active sprint work items assigned to that user
4. On first visit each day, lets you confirm ADO tasks and add manual TODOs
5. Reminds by scheduled time + priority while the session is active
6. Marks completed tasks done (updates ADO state for ADO-sourced items) and advances to the next task
7. Stops reminding on logout

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

Vite proxies `/api/ado/*` to `https://dev.azure.com` to avoid browser CORS issues.

## Notes

- PAT stays in browser `localStorage` for this app only.
- Completing an ADO task attempts `System.State` update (`Done` / `Closed` / `Completed` based on current state).
- Reminders run in the open browser session (30s check loop, 15-minute re-ping interval).
