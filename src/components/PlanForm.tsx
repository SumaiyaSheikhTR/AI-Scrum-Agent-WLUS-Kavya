import { useState } from 'react'
import type { DailyTask, NewManualTask, Priority } from '../types'

interface PlanFormProps {
  userName: string
  adoTasks: DailyTask[]
  adoMessage: string | null
  error: string | null
  loadingAdo: boolean
  onRefreshAdo: () => void
  onSave: (userName: string, manualTasks: NewManualTask[]) => void
}

function emptyTask(): NewManualTask {
  return {
    title: '',
    scheduledTime: new Date().toTimeString().slice(0, 5),
    priority: 'medium',
  }
}

export default function PlanForm({
  userName,
  adoTasks,
  adoMessage,
  error,
  loadingAdo,
  onRefreshAdo,
  onSave,
}: PlanFormProps) {
  const [name, setName] = useState(userName)
  const [manualTasks, setManualTasks] = useState<NewManualTask[]>([emptyTask()])

  return (
    <section className="panel">
      <p className="eyebrow">First check-in today</p>
      <h2>Confirm today&apos;s active work</h2>
      <p className="lede">
        Active ADO tasks assigned to you are loaded automatically. Add any personal TODOs, then reminders
        follow schedule and priority until you log out.
      </p>

      {loadingAdo && <p className="muted">Syncing Azure DevOps tasks…</p>}
      {adoMessage && <p className="success">{adoMessage}</p>}
      {error && <p className="error">{error}</p>}

      <label>
        User
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {adoTasks.length > 0 && (
        <div className="ado-list">
          <h3>Active ADO tasks</h3>
          <ul>
            {adoTasks.map((task) => (
              <li key={task.id}>
                <strong>#{task.adoWorkItemId}</strong> {task.title}
                <span>{task.priority}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="manual-list">
        <h3>Additional TODOs</h3>
        {manualTasks.map((task, index) => (
          <div className="row" key={index}>
            <input
              placeholder="Task title"
              value={task.title}
              onChange={(e) =>
                setManualTasks((current) =>
                  current.map((item, i) => (i === index ? { ...item, title: e.target.value } : item))
                )
              }
            />
            <input
              type="time"
              value={task.scheduledTime}
              onChange={(e) =>
                setManualTasks((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, scheduledTime: e.target.value } : item
                  )
                )
              }
            />
            <select
              value={task.priority}
              onChange={(e) =>
                setManualTasks((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, priority: e.target.value as Priority } : item
                  )
                )
              }
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button
              type="button"
              className="ghost"
              disabled={manualTasks.length === 1}
              onClick={() => setManualTasks((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
        <button type="button" className="ghost" onClick={() => setManualTasks((c) => [...c, emptyTask()])}>
          Add TODO
        </button>
      </div>

      <div className="actions">
        <button type="button" className="ghost" onClick={onRefreshAdo} disabled={loadingAdo}>
          Refresh ADO
        </button>
        <button type="button" onClick={() => onSave(name, manualTasks)} disabled={loadingAdo}>
          Start reminders
        </button>
      </div>
    </section>
  )
}
