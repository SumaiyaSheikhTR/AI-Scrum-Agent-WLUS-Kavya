import { useCallback, useEffect, useState } from 'react'
import ConnectForm from './components/ConnectForm'
import PlanForm from './components/PlanForm'
import Workspace from './components/Workspace'
import adoClient from './services/adoClient'
import dailyReminderService, { REMINDER_EVENT } from './services/dailyReminderService'
import type { AdoUser, DailyTask, NewManualTask, ReminderPayload, TaskStatus } from './types'
import './App.css'

type Screen = 'connect' | 'plan' | 'workspace'

function App() {
  const [connected, setConnected] = useState(() => Boolean(adoClient.getConfig()))
  const [screen, setScreen] = useState<Screen>(() => {
    if (!adoClient.getConfig()) return 'connect'
    return dailyReminderService.needsDailyInput() ? 'plan' : 'workspace'
  })
  const [user, setUser] = useState<AdoUser | null>(null)
  const [tasks, setTasks] = useState<DailyTask[]>([])
  const [reminder, setReminder] = useState<ReminderPayload | null>(null)
  const [loadingAdo, setLoadingAdo] = useState(false)
  const [adoMessage, setAdoMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshTasks = useCallback(() => {
    setTasks(dailyReminderService.getTodayTasks())
  }, [])

  const syncAdo = useCallback(
    async (showProgress = false) => {
      if (showProgress) setLoadingAdo(true)
      try {
        const result = await dailyReminderService.syncFromAdo()
        setUser(result.user)
        setAdoMessage(
          `Connected as ${result.user.displayName} (${result.user.id}). Imported ${result.imported} active task${
            result.imported === 1 ? '' : 's'
          }.`
        )
        setError(null)
        refreshTasks()
      } catch (err) {
        setAdoMessage(null)
        setError(err instanceof Error ? err.message : 'ADO sync failed.')
      } finally {
        if (showProgress) setLoadingAdo(false)
      }
    },
    [refreshTasks]
  )

  useEffect(() => {
    if (!connected) return

    refreshTasks()
    dailyReminderService.startSession()
    void syncAdo(true)

    const onChanged = () => refreshTasks()
    const onInput = () => setScreen('plan')
    const onReminder = (event: Event) => {
      setReminder((event as CustomEvent<ReminderPayload>).detail)
      setScreen('workspace')
    }

    window.addEventListener(REMINDER_EVENT.CHANGED, onChanged)
    window.addEventListener(REMINDER_EVENT.INPUT_REQUIRED, onInput)
    window.addEventListener(REMINDER_EVENT.REMINDER, onReminder)

    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) void syncAdo(false)
    }, 15 * 60_000)

    return () => {
      window.clearInterval(refreshTimer)
      window.removeEventListener(REMINDER_EVENT.CHANGED, onChanged)
      window.removeEventListener(REMINDER_EVENT.INPUT_REQUIRED, onInput)
      window.removeEventListener(REMINDER_EVENT.REMINDER, onReminder)
      dailyReminderService.endSession()
    }
  }, [connected, refreshTasks, syncAdo])

  const handleConnected = (nextUser: AdoUser) => {
    setUser(nextUser)
    setConnected(true)
    setScreen(dailyReminderService.needsDailyInput() ? 'plan' : 'workspace')
  }

  const handleSavePlan = (userName: string, manualTasks: NewManualTask[]) => {
    try {
      dailyReminderService.saveTodayPlan(userName, manualTasks)
      setError(null)
      setScreen('workspace')
      refreshTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save today's plan.")
    }
  }

  const handleStatus = async (taskId: string, status: TaskStatus) => {
    try {
      await dailyReminderService.updateStatus(taskId, status)
      setError(null)
      if (reminder?.task.id === taskId && status === 'completed') setReminder(null)
      refreshTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update task status.')
    }
  }

  const handleLogout = () => {
    dailyReminderService.endSession()
    adoClient.clearConfig()
    setConnected(false)
    setReminder(null)
    setTasks([])
    setUser(null)
    setAdoMessage(null)
    setError(null)
    setScreen('connect')
  }

  if (screen === 'connect') {
    return (
      <main className="shell">
        <ConnectForm onConnected={handleConnected} />
      </main>
    )
  }

  if (screen === 'plan') {
    return (
      <main className="shell">
        <PlanForm
          userName={user?.displayName || dailyReminderService.getUserName()}
          adoTasks={tasks.filter((task) => task.source === 'ado' && task.status !== 'completed')}
          adoMessage={adoMessage}
          error={error}
          loadingAdo={loadingAdo}
          onRefreshAdo={() => void syncAdo(true)}
          onSave={handleSavePlan}
        />
      </main>
    )
  }

  return (
    <main className="shell">
      <Workspace
        userName={user?.displayName || dailyReminderService.getUserName()}
        tasks={tasks}
        reminder={reminder}
        error={error}
        onStatus={(taskId, status) => void handleStatus(taskId, status)}
        onSnooze={(taskId) => {
          dailyReminderService.snooze(taskId, 10)
          setReminder(null)
        }}
        onDismissReminder={() => setReminder(null)}
        onRefreshAdo={() => void syncAdo(true)}
        onLogout={handleLogout}
      />
    </main>
  )
}

export default App
