export type Priority = 'high' | 'medium' | 'low'
export type TaskStatus = 'pending' | 'in_progress' | 'completed'
export type TaskSource = 'ado' | 'manual'

export interface AdoConfig {
  organization: string
  project: string
  teamName: string
  personalAccessToken: string
  apiVersion: string
}

export interface AdoUser {
  id: string
  displayName: string
  uniqueName: string
}

export interface AdoWorkItem {
  id: number
  title: string
  state: string
  type: string
  assignedTo: string
  assignedToId?: string
  assignedToUniqueName?: string
  priority: number | null
  createdDate: string
  updatedDate: string
  url: string
}

export interface DailyTask {
  id: string
  title: string
  scheduledTime: string
  priority: Priority
  status: TaskStatus
  source: TaskSource
  createdAt: string
  completedAt?: string
  lastRemindedAt?: string
  snoozedUntil?: string
  adoWorkItemId?: number
  adoState?: string
  adoUrl?: string
}

export interface NewManualTask {
  title: string
  scheduledTime: string
  priority: Priority
}

export interface ReminderPayload {
  task: DailyTask
  remainingTasks: number
}
