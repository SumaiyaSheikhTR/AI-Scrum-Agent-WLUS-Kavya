import type { DailyTask, ReminderPayload, TaskStatus } from '../types'

interface WorkspaceProps {
  userName: string
  tasks: DailyTask[]
  reminder: ReminderPayload | null
  error: string | null
  onStatus: (taskId: string, status: TaskStatus) => void
  onSnooze: (taskId: string) => void
  onDismissReminder: () => void
  onRefreshAdo: () => void
  onLogout: () => void
}

export default function Workspace({
  userName,
  tasks,
  reminder,
  error,
  onStatus,
  onSnooze,
  onDismissReminder,
  onRefreshAdo,
  onLogout,
}: WorkspaceProps) {
  const pending = tasks.filter((task) => task.status !== 'completed')

  return (
    <section className="workspace">
      <header className="topbar">
        <div>
          <p className="brand">Daily Task Reminder</p>
          <p className="muted">Signed in as {userName || 'ADO user'}</p>
        </div>
        <div className="actions">
          <button type="button" className="ghost" onClick={onRefreshAdo}>
            Refresh ADO
          </button>
          <button type="button" className="ghost danger" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="summary">
        <h2>{pending.length} open task{pending.length === 1 ? '' : 's'} today</h2>
        <p className="lede">Reminders keep pinging by schedule and priority. Mark done to advance.</p>
      </div>

      <ul className="queue">
        {tasks.map((task) => (
          <li key={task.id} className={task.status === 'completed' ? 'done' : ''}>
            <div>
              <strong>{task.title}</strong>
              <p>
                {task.scheduledTime} · {task.priority}
                {task.adoWorkItemId ? ` · ADO #${task.adoWorkItemId}` : ' · manual'}
              </p>
            </div>
            <select
              value={task.status}
              onChange={(e) => onStatus(task.id, e.target.value as TaskStatus)}
            >
              <option value="pending">Pending</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </select>
          </li>
        ))}
      </ul>

      {reminder && (
        <div className="reminder-modal" role="dialog" aria-modal="true">
          <div className="reminder-card">
            <p className="eyebrow">Task reminder</p>
            <h3>{reminder.task.title}</h3>
            <p>
              {reminder.task.scheduledTime} · {reminder.task.priority} priority
              {reminder.task.adoWorkItemId ? ` · ADO #${reminder.task.adoWorkItemId}` : ''}
            </p>
            <p className="muted">{reminder.remainingTasks} remaining today</p>
            <div className="actions">
              <button type="button" className="ghost" onClick={() => onSnooze(reminder.task.id)}>
                Snooze 10 min
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  onStatus(reminder.task.id, 'in_progress')
                  onDismissReminder()
                }}
              >
                In progress
              </button>
              <button type="button" onClick={() => onStatus(reminder.task.id, 'completed')}>
                Mark done
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
