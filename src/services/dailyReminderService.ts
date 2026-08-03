import adoClient from './adoClient'
import type {
  AdoUser,
  AdoWorkItem,
  DailyTask,
  NewManualTask,
  Priority,
  ReminderPayload,
  TaskStatus,
} from '../types'

export const REMINDER_EVENT = {
  CHANGED: 'dtr:changed',
  REMINDER: 'dtr:reminder',
  INPUT_REQUIRED: 'dtr:input-required',
  SESSION_ENDED: 'dtr:session-ended',
} as const

const TASKS_KEY = 'dtr_tasks_v1'
const USER_KEY = 'dtr_user_v1'
const SESSION_KEY = 'dtr_session_active'
const TICK_MS = 30_000
const REMINDER_INTERVAL_MS = 15 * 60_000

type TaskStore = Record<string, DailyTask[]>

export function localDateKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function compareTasks(a: DailyTask, b: DailyTask): number {
  const rank: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
  const byTime = a.scheduledTime.localeCompare(b.scheduledTime)
  if (byTime !== 0) return byTime
  const byPriority = rank[a.priority] - rank[b.priority]
  if (byPriority !== 0) return byPriority
  return a.createdAt.localeCompare(b.createdAt)
}

export function isTaskDue(task: DailyTask, now = new Date()): boolean {
  if (task.status === 'completed') return false
  if (task.snoozedUntil && new Date(task.snoozedUntil).getTime() > now.getTime()) return false
  const [hours, minutes] = task.scheduledTime.split(':').map(Number)
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return true
  return now.getHours() * 60 + now.getMinutes() >= hours * 60 + minutes
}

function isDoneState(state: string): boolean {
  return ['done', 'closed', 'completed', 'removed'].includes((state || '').toLowerCase())
}

function mapPriority(priority: number | null): Priority {
  if (priority === 1) return 'high'
  if (priority === 2) return 'medium'
  return 'low'
}

function isAssignedToUser(item: AdoWorkItem, user: AdoUser): boolean {
  const candidates = [item.assignedToId, item.assignedToUniqueName, item.assignedTo]
    .filter(Boolean)
    .map((value) => String(value).trim().toLowerCase())

  return [user.id, user.uniqueName, user.displayName]
    .filter(Boolean)
    .some((value) => candidates.includes(value.trim().toLowerCase()))
}

class DailyReminderService {
  private timer: ReturnType<typeof setInterval> | null = null

  startSession(): void {
    sessionStorage.setItem(SESSION_KEY, 'true')
    if (!this.timer) {
      this.timer = setInterval(() => this.checkReminders(), TICK_MS)
    }
    window.setTimeout(() => {
      if (this.needsDailyInput()) {
        this.emit(REMINDER_EVENT.INPUT_REQUIRED, { date: localDateKey() })
      } else {
        this.checkReminders()
      }
    }, 0)
  }

  endSession(): void {
    sessionStorage.removeItem(SESSION_KEY)
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.emit(REMINDER_EVENT.SESSION_ENDED, undefined)
  }

  isSessionActive(): boolean {
    return sessionStorage.getItem(SESSION_KEY) === 'true'
  }

  getUserName(): string {
    return localStorage.getItem(USER_KEY) || ''
  }

  setUserName(name: string): void {
    localStorage.setItem(USER_KEY, name.trim())
  }

  needsDailyInput(date = new Date()): boolean {
    return !Object.prototype.hasOwnProperty.call(this.loadStore(), localDateKey(date))
  }

  getTodayTasks(): DailyTask[] {
    return [...(this.loadStore()[localDateKey()] || [])].sort(compareTasks)
  }

  saveTodayPlan(userName: string, manualTasks: NewManualTask[]): DailyTask[] {
    const now = new Date().toISOString()
    const manual = manualTasks
      .filter((task) => task.title.trim())
      .map((task, index): DailyTask => ({
        id: `manual_${Date.now()}_${index}`,
        title: task.title.trim(),
        scheduledTime: task.scheduledTime,
        priority: task.priority,
        status: 'pending',
        source: 'manual',
        createdAt: now,
      }))

    const adoTasks = this.getTodayTasks().filter((task) => task.source === 'ado')
    const tasks = [...adoTasks, ...manual].sort(compareTasks)
    if (tasks.length === 0) throw new Error('Add at least one task, or sync active ADO work first.')

    this.setUserName(userName || 'User')
    this.writeToday(tasks)
    this.checkReminders(true)
    return tasks
  }

  async syncFromAdo(): Promise<{ user: AdoUser; imported: number; tasks: DailyTask[] }> {
    const user = await adoClient.getCurrentUser()
    const workItems = await adoClient.getCurrentSprintWorkItems()
    const current = this.getTodayTasks()
    const existingIds = new Set(
      current.filter((task) => task.adoWorkItemId).map((task) => task.adoWorkItemId as number)
    )

    const assigned = workItems.filter(
      (item) => isAssignedToUser(item, user) && (!isDoneState(item.state) || existingIds.has(item.id))
    )

    const byId = new Map(
      current.filter((task) => task.adoWorkItemId).map((task) => [task.adoWorkItemId as number, task])
    )
    const nowTime = new Date().toTimeString().slice(0, 5)

    const synced = assigned.map((item): DailyTask => {
      const existing = byId.get(item.id)
      const done = isDoneState(item.state)
      return {
        id: existing?.id || `ado_${item.id}`,
        title: item.title,
        scheduledTime: existing?.scheduledTime || nowTime,
        priority: mapPriority(item.priority),
        status: done ? 'completed' : existing?.status === 'in_progress' ? 'in_progress' : 'pending',
        source: 'ado',
        createdAt: existing?.createdAt || item.createdDate || new Date().toISOString(),
        completedAt: done ? existing?.completedAt || new Date().toISOString() : undefined,
        lastRemindedAt: existing?.lastRemindedAt,
        snoozedUntil: existing?.snoozedUntil,
        adoWorkItemId: item.id,
        adoState: item.state,
        adoUrl: item.url,
      }
    })

    const manual = current.filter((task) => task.source !== 'ado')
    const tasks = [...manual, ...synced].sort(compareTasks)
    this.setUserName(user.displayName)
    this.writeToday(tasks)

    return {
      user,
      imported: synced.filter((task) => task.status !== 'completed').length,
      tasks,
    }
  }

  async updateStatus(taskId: string, status: TaskStatus): Promise<DailyTask | null> {
    const tasks = this.getTodayTasks()
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return null

    if (status === 'completed' && task.adoWorkItemId) {
      const updated = await adoClient.completeWorkItem(task.adoWorkItemId, task.adoState)
      task.adoState = updated.state
    }

    task.status = status
    task.completedAt = status === 'completed' ? new Date().toISOString() : undefined
    task.snoozedUntil = undefined
    this.writeToday(tasks)

    if (status === 'completed') {
      window.setTimeout(() => this.checkReminders(true), 0)
    }
    return task
  }

  snooze(taskId: string, minutes = 10): void {
    const tasks = this.getTodayTasks()
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    task.snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString()
    this.writeToday(tasks)
  }

  checkReminders(force = false): ReminderPayload | null {
    if (!this.isSessionActive() || this.needsDailyInput()) return null

    const now = new Date()
    const tasks = this.getTodayTasks()
    const task = tasks.filter((item) => isTaskDue(item, now)).sort(compareTasks)[0]
    if (!task) return null

    const last = task.lastRemindedAt ? new Date(task.lastRemindedAt).getTime() : 0
    if (!force && now.getTime() - last < REMINDER_INTERVAL_MS) return null

    task.lastRemindedAt = now.toISOString()
    this.writeToday(tasks, false)

    const detail: ReminderPayload = {
      task: { ...task },
      remainingTasks: tasks.filter((item) => item.status !== 'completed').length,
    }
    this.emit(REMINDER_EVENT.REMINDER, detail)
    return detail
  }

  private writeToday(tasks: DailyTask[], emit = true): void {
    const store = this.loadStore()
    store[localDateKey()] = tasks
    localStorage.setItem(TASKS_KEY, JSON.stringify(store))
    if (emit) this.emit(REMINDER_EVENT.CHANGED, { tasks: [...tasks].sort(compareTasks) })
  }

  private loadStore(): TaskStore {
    try {
      const raw = localStorage.getItem(TASKS_KEY)
      return raw ? (JSON.parse(raw) as TaskStore) : {}
    } catch {
      return {}
    }
  }

  private emit(name: string, detail: unknown): void {
    window.dispatchEvent(new CustomEvent(name, { detail }))
  }
}

const dailyReminderService = new DailyReminderService()
export default dailyReminderService
