import { useState } from 'react'
import type { FormEvent } from 'react'
import adoClient from '../services/adoClient'
import type { AdoConfig, AdoUser } from '../types'

interface ConnectFormProps {
  onConnected: (user: AdoUser, config: AdoConfig) => void
}

const emptyConfig: AdoConfig = {
  organization: '',
  project: '',
  teamName: '',
  personalAccessToken: '',
  apiVersion: '7.1',
}

export default function ConnectForm({ onConnected }: ConnectFormProps) {
  const [config, setConfig] = useState<AdoConfig>(() => adoClient.getConfig() || emptyConfig)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const user = await adoClient.testConnection(config)
      adoClient.saveConfig(config)
      onConnected(user, config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect to Azure DevOps.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel hero-panel">
      <p className="brand">Daily Task Reminder</p>
      <h1>Connect your Azure DevOps identity</h1>
      <p className="lede">
        We read the PAT owner&apos;s ADO id, pull your active sprint tasks, and keep reminding you until logout.
      </p>
      <form className="stack" onSubmit={onSubmit}>
        <label>
          Organization
          <input
            required
            value={config.organization}
            onChange={(e) => setConfig({ ...config, organization: e.target.value })}
            placeholder="contoso"
          />
        </label>
        <label>
          Project
          <input
            required
            value={config.project}
            onChange={(e) => setConfig({ ...config, project: e.target.value })}
            placeholder="MyProject"
          />
        </label>
        <label>
          Team name
          <input
            required
            value={config.teamName}
            onChange={(e) => setConfig({ ...config, teamName: e.target.value })}
            placeholder="MyProject Team"
          />
        </label>
        <label>
          Personal Access Token
          <input
            required
            type="password"
            value={config.personalAccessToken}
            onChange={(e) => setConfig({ ...config, personalAccessToken: e.target.value })}
            placeholder="ADO PAT"
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Connecting…' : 'Connect and continue'}
        </button>
      </form>
    </section>
  )
}
