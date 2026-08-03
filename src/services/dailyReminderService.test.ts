import { describe, expect, it } from 'vitest'
import { compareTasks, isTaskDue, localDateKey } from './dailyReminderService'
import type { DailyTask } from '../types'

describe('daily reminder helpers', () => {
  it('orders by schedule then priority', () => {
    const tasks: DailyTask[] = [
      {
        id: '1',
        title: 'later high',
        scheduledTime: '14:00',
        priority: 'high',
        status: 'pending',
        source: 'manual',
        createdAt: '2026-08-03T10:00:00.000Z',
      },
      {
        id: '2',
        title: 'earlier low',
        scheduledTime: '09:00',
        priority: 'low',
        status: 'pending',
        source: 'manual',
        createdAt: '2026-08-03T10:00:00.000Z',
      },
      {
        id: '3',
        title: 'earlier high',
        scheduledTime: '09:00',
        priority: 'high',
        status: 'pending',
        source: 'ado',
        createdAt: '2026-08-03T09:00:00.000Z',
      },
    ]

    const ordered = [...tasks].sort(compareTasks).map((task) => task.id)
    expect(ordered).toEqual(['3', '2', '1'])
  })

  it('treats tasks as due after scheduled time', () => {
    const task: DailyTask = {
      id: '1',
      title: 'due',
      scheduledTime: '08:00',
      priority: 'medium',
      status: 'pending',
      source: 'manual',
      createdAt: '2026-08-03T10:00:00.000Z',
    }
    expect(isTaskDue(task, new Date('2026-08-03T09:00:00'))).toBe(true)
    expect(isTaskDue({ ...task, status: 'completed' }, new Date('2026-08-03T09:00:00'))).toBe(false)
  })

  it('builds a stable local date key', () => {
    expect(localDateKey(new Date(2026, 7, 3))).toBe('2026-08-03')
  })
})
