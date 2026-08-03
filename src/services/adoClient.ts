import axios from 'axios'
import type { AdoConfig, AdoUser, AdoWorkItem } from '../types'

const CONFIG_KEY = 'dtr_ado_config'

function authHeader(pat: string): string {
  return `Basic ${btoa(`:${pat}`)}`
}

class AdoClient {
  private config: AdoConfig | null = null

  constructor() {
    this.load()
  }

  load(): AdoConfig | null {
    try {
      const raw = localStorage.getItem(CONFIG_KEY)
      this.config = raw ? (JSON.parse(raw) as AdoConfig) : null
      return this.config
    } catch {
      this.config = null
      return null
    }
  }

  getConfig(): AdoConfig | null {
    return this.config ? { ...this.config } : null
  }

  saveConfig(config: AdoConfig): void {
    this.config = config
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
  }

  clearConfig(): void {
    this.config = null
    localStorage.removeItem(CONFIG_KEY)
  }

  private requireConfig(): AdoConfig {
    if (!this.config) throw new Error('Connect to Azure DevOps first.')
    return this.config
  }

  private async get<T>(path: string, config = this.requireConfig()): Promise<T> {
    const response = await axios.get<T>(`/api/ado/${path}`, {
      headers: {
        Authorization: authHeader(config.personalAccessToken),
        'Content-Type': 'application/json',
      },
      params: {
        'api-version': config.apiVersion || '7.1',
      },
    })
    return response.data
  }

  private async patch<T>(path: string, body: unknown, config = this.requireConfig()): Promise<T> {
    const response = await axios.patch<T>(`/api/ado/${path}`, body, {
      headers: {
        Authorization: authHeader(config.personalAccessToken),
        'Content-Type': 'application/json-patch+json',
      },
      params: {
        'api-version': config.apiVersion || '7.1',
      },
    })
    return response.data
  }

  async testConnection(config: AdoConfig): Promise<AdoUser> {
    const data = await this.get<{
      authenticatedUser?: {
        id?: string
        providerDisplayName?: string
        customDisplayName?: string
        uniqueName?: string
        properties?: { Account?: { $value?: string } }
      }
    }>(`${config.organization}/_apis/connectionData?connectOptions=1&lastChangeId=-1&lastChangeId64=-1`, config)

    const user = data.authenticatedUser
    if (!user?.id) throw new Error('ADO did not return an authenticated user for this PAT.')

    return {
      id: user.id,
      displayName: user.providerDisplayName || user.customDisplayName || user.uniqueName || 'ADO User',
      uniqueName: user.properties?.Account?.$value || user.uniqueName || '',
    }
  }

  async getCurrentUser(): Promise<AdoUser> {
    return this.testConnection(this.requireConfig())
  }

  async getCurrentSprintId(): Promise<string> {
    const config = this.requireConfig()
    const team = encodeURIComponent(config.teamName || config.project)
    const project = encodeURIComponent(config.project)
    const data = await this.get<{ value?: Array<{ id: string; attributes?: { timeFrame?: string } }> }>(
      `${config.organization}/${project}/${team}/_apis/work/teamsettings/iterations?$timeframe=current`
    )
    const sprint = data.value?.[0]
    if (!sprint?.id) throw new Error('No current Azure DevOps sprint found for this team.')
    return sprint.id
  }

  async getCurrentSprintWorkItems(): Promise<AdoWorkItem[]> {
    const config = this.requireConfig()
    const sprintId = await this.getCurrentSprintId()
    const project = encodeURIComponent(config.project)
    const team = encodeURIComponent(config.teamName || config.project)

    const board = await this.get<{ workItemRelations?: Array<{ target?: { id?: number } }> }>(
      `${config.organization}/${project}/${team}/_apis/work/teamsettings/iterations/${sprintId}/workitems`
    )

    const ids = (board.workItemRelations || [])
      .map((relation) => relation.target?.id)
      .filter((id): id is number => typeof id === 'number')

    if (ids.length === 0) return []

    const fields = [
      'System.Id',
      'System.Title',
      'System.State',
      'System.WorkItemType',
      'System.AssignedTo',
      'Microsoft.VSTS.Common.Priority',
      'System.CreatedDate',
      'System.ChangedDate',
    ].join(',')

    const batch = await this.get<{
      value?: Array<{
        id: number
        fields?: Record<string, unknown>
        _links?: { html?: { href?: string } }
      }>
    }>(
      `${config.organization}/${project}/_apis/wit/workitems?ids=${ids.join(',')}&fields=${encodeURIComponent(fields)}`
    )

    return (batch.value || []).map((item) => {
      const fieldsMap = item.fields || {}
      const assigned = fieldsMap['System.AssignedTo'] as
        | { displayName?: string; id?: string; uniqueName?: string }
        | undefined

      return {
        id: item.id,
        title: String(fieldsMap['System.Title'] || ''),
        state: String(fieldsMap['System.State'] || ''),
        type: String(fieldsMap['System.WorkItemType'] || ''),
        assignedTo: assigned?.displayName || '',
        assignedToId: assigned?.id,
        assignedToUniqueName: assigned?.uniqueName,
        priority: (fieldsMap['Microsoft.VSTS.Common.Priority'] as number | null) ?? null,
        createdDate: String(fieldsMap['System.CreatedDate'] || ''),
        updatedDate: String(fieldsMap['System.ChangedDate'] || ''),
        url: item._links?.html?.href || '',
      }
    })
  }

  async completeWorkItem(workItemId: number, currentState?: string): Promise<AdoWorkItem> {
    const config = this.requireConfig()
    const project = encodeURIComponent(config.project)
    const nextState = this.completionState(currentState)
    const updated = await this.patch<{
      id: number
      fields?: Record<string, unknown>
      _links?: { html?: { href?: string } }
    }>(`${config.organization}/${project}/_apis/wit/workitems/${workItemId}`, [
      { op: 'add', path: '/fields/System.State', value: nextState },
    ])

    return {
      id: updated.id,
      title: String(updated.fields?.['System.Title'] || ''),
      state: String(updated.fields?.['System.State'] || nextState),
      type: String(updated.fields?.['System.WorkItemType'] || ''),
      assignedTo: '',
      priority: null,
      createdDate: '',
      updatedDate: '',
      url: updated._links?.html?.href || '',
    }
  }

  private completionState(currentState?: string): string {
    const state = (currentState || '').toLowerCase()
    if (['new', 'active', 'resolved'].includes(state)) return 'Closed'
    if (['to do', 'committed', 'in progress'].includes(state)) return 'Done'
    return 'Completed'
  }
}

const adoClient = new AdoClient()
export default adoClient
