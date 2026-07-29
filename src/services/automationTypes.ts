/**
 * Shared types for the AI Scrum Agent automation platform.
 */

export type AutomationServiceId =
  | 'rulesEngine'
  | 'dailySummary'
  | 'alerting'
  | 'ticketManagement'
  | 'sentiment'
  | 'developerEngagement';

export type AutomationJobStatus = 'idle' | 'running' | 'success' | 'error' | 'skipped';

export interface AutomationOrchestratorConfig {
  /** Master switch for all automation */
  enabled: boolean;
  /** When true, ADO write actions are simulated (no mutations) */
  dryRun: boolean;
  /** Pause scheduled jobs when the browser tab is hidden */
  pauseWhenHidden: boolean;
  /** Minimum gap between any two job executions (ms) */
  globalCooldownMs: number;
  /** Max ADO write operations per hour (enforced outside dry-run) */
  maxWritesPerHour: number;
  /** Per-service enable flags */
  services: Record<AutomationServiceId, boolean>;
  /** Per-service interval overrides in minutes */
  intervalsMinutes: Record<AutomationServiceId, number>;
}

export interface AutomationJobResult {
  serviceId: AutomationServiceId;
  status: AutomationJobStatus;
  startedAt: string;
  finishedAt: string;
  dryRun: boolean;
  summary: string;
  itemsProcessed?: number;
  actionsTaken?: number;
  actionsSimulated?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface AutomationExecutionLogEntry extends AutomationJobResult {
  id: string;
}

export interface AutomationServiceStatus {
  id: AutomationServiceId;
  label: string;
  description: string;
  enabled: boolean;
  running: boolean;
  lastRun?: AutomationExecutionLogEntry | null;
  nextRunAt?: string | null;
}

export interface AutomationPlatformStatus {
  orchestratorEnabled: boolean;
  dryRun: boolean;
  running: boolean;
  services: AutomationServiceStatus[];
  recentExecutions: AutomationExecutionLogEntry[];
  writesThisHour: number;
  maxWritesPerHour: number;
}

export const AUTOMATION_EVENT = {
  STATUS: 'automation:status',
  EXECUTION: 'automation:execution',
  ALERT: 'automation:alert',
  CONFIG: 'automation:config',
} as const;

export const DEFAULT_ORCHESTRATOR_CONFIG: AutomationOrchestratorConfig = {
  enabled: false,
  dryRun: true,
  pauseWhenHidden: true,
  globalCooldownMs: 15_000,
  maxWritesPerHour: 30,
  services: {
    rulesEngine: true,
    dailySummary: true,
    alerting: true,
    ticketManagement: true,
    sentiment: false,
    developerEngagement: true,
  },
  intervalsMinutes: {
    rulesEngine: 15,
    dailySummary: 60, // scheduler uses dailyTime; this is a health tick
    alerting: 15,
    ticketManagement: 60,
    sentiment: 30,
    developerEngagement: 60,
  },
};

export const SERVICE_META: Record<
  AutomationServiceId,
  { label: string; description: string }
> = {
  rulesEngine: {
    label: 'Rules Engine',
    description: 'Evaluates configurable rules and applies work item actions',
  },
  dailySummary: {
    label: 'Daily Summaries',
    description: 'Generates and delivers AI sprint digests on a schedule',
  },
  alerting: {
    label: 'Alerts & Notifications',
    description: 'Detects sprint risks, stale items, and sentiment issues',
  },
  ticketManagement: {
    label: 'Smart Ticket Management',
    description: 'Auto status transitions and contextual comment prompts',
  },
  sentiment: {
    label: 'Sentiment Monitoring',
    description: 'Background sentiment cache refresh for the active sprint',
  },
  developerEngagement: {
    label: 'Developer Engagement',
    description: 'Tracks inactive items and prompts assignees for updates',
  },
};
