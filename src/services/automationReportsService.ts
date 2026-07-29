/**
 * Automation Reports Service
 *
 * First-class automation jobs for:
 * 1. Developer reminders about incomplete / due tasks
 * 2. Manager velocity & sprint progress reports
 * 3. Sentiment analysis digests for managers
 */

import adoService, { Sprint, SprintStatistics, WorkItem } from './adoService';
import emailService from './emailService';
import teamsNotificationService from './teamsNotificationService';
import sentimentAnalysisBackgroundService from './sentimentAnalysisBackgroundService';
import { SentimentAnalysisResult } from './sentimentAnalysisService';

export interface AutomationReportsConfig {
  developerReminders: {
    enabled: boolean;
    /** Remind for Active/In Progress items older than this many days */
    staleDays: number;
    /** Also include New/To Do items assigned to the developer */
    includeBacklogAssigned: boolean;
    channels: Array<'ado' | 'email' | 'teams' | 'console'>;
    cooldownHours: number;
  };
  velocityReport: {
    enabled: boolean;
    /** HH:MM local time window start for daily manager digest */
    dailyTime: string;
    includeWeekends: boolean;
    managerEmails: string[];
    channels: Array<'email' | 'teams' | 'console'>;
    historicalSprints: number;
  };
  sentimentDigest: {
    enabled: boolean;
    managerEmails: string[];
    channels: Array<'email' | 'teams' | 'console'>;
    /** Alert managers when average score drops below this */
    negativeThreshold: number;
    alwaysSendDigest: boolean;
  };
}

export interface WriteAwareOptions {
  dryRun?: boolean;
  canWrite?: (count: number) => boolean;
  onWrite?: (count: number) => void;
}

export interface DeveloperReminderStats {
  developersNotified: number;
  tasksIncluded: number;
  simulated: number;
  channelResults: Record<string, number>;
}

export interface VelocityReportStats {
  delivered: boolean;
  simulated: boolean;
  managersNotified: number;
  sprintName?: string;
}

export interface SentimentDigestStats {
  delivered: boolean;
  simulated: boolean;
  managersNotified: number;
  overallSentiment?: string;
  score?: number;
  alertRaised?: boolean;
}

const STORAGE_KEY = 'automation_reports_config';
const REMINDER_COOLDOWN_KEY = 'automation_developer_reminder_cooldowns';
const VELOCITY_LAST_KEY = 'automation_velocity_last_delivery';
const SENTIMENT_LAST_KEY = 'automation_sentiment_last_delivery';

const DEFAULT_CONFIG: AutomationReportsConfig = {
  developerReminders: {
    enabled: true,
    staleDays: 2,
    includeBacklogAssigned: true,
    channels: ['ado', 'console'],
    cooldownHours: 24,
  },
  velocityReport: {
    enabled: true,
    dailyTime: '09:30',
    includeWeekends: false,
    managerEmails: [],
    channels: ['email', 'console'],
    historicalSprints: 3,
  },
  sentimentDigest: {
    enabled: true,
    managerEmails: [],
    channels: ['email', 'console'],
    negativeThreshold: -0.2,
    alwaysSendDigest: true,
  },
};

class AutomationReportsService {
  private config: AutomationReportsConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  public getConfig(): AutomationReportsConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public updateConfig(partial: Partial<AutomationReportsConfig>): AutomationReportsConfig {
    this.config = {
      developerReminders: {
        ...this.config.developerReminders,
        ...(partial.developerReminders || {}),
      },
      velocityReport: {
        ...this.config.velocityReport,
        ...(partial.velocityReport || {}),
      },
      sentimentDigest: {
        ...this.config.sentimentDigest,
        ...(partial.sentimentDigest || {}),
      },
    };
    this.saveConfig();
    return this.getConfig();
  }

  // ─── 1) Developer task reminders ─────────────────────────────

  public async sendDeveloperTaskReminders(
    options: WriteAwareOptions = {}
  ): Promise<DeveloperReminderStats> {
    const cfg = this.config.developerReminders;
    const stats: DeveloperReminderStats = {
      developersNotified: 0,
      tasksIncluded: 0,
      simulated: 0,
      channelResults: {},
    };

    if (!cfg.enabled) return stats;

    const sprint = await adoService.getCurrentSprint();
    if (!sprint) {
      console.log('[AutomationReports] No active sprint for developer reminders');
      return stats;
    }

    const workItems = await adoService.getSprintWorkItems(sprint.id);
    const incomplete = workItems.filter((item) => !this.isDone(item.state));
    const byAssignee = this.groupIncompleteByAssignee(incomplete, cfg);

    const cooldowns = this.loadReminderCooldowns();
    const now = Date.now();

    for (const [assigneeKey, tasks] of Object.entries(byAssignee)) {
      if (tasks.length === 0) continue;

      const lastSent = cooldowns[assigneeKey] || 0;
      if (now - lastSent < cfg.cooldownHours * 60 * 60 * 1000) {
        continue;
      }

      const assigneeDisplay = this.extractDisplayName(tasks[0].assignedTo);
      const assigneeEmail = this.extractEmail(tasks[0].assignedTo);
      const message = this.buildDeveloperReminderMessage(
        assigneeDisplay,
        sprint.name,
        tasks,
        cfg.staleDays
      );

      let anySuccess = false;

      for (const channel of cfg.channels) {
        const result = await this.deliverDeveloperReminder(channel, {
          assigneeEmail,
          assigneeDisplay,
          message,
          tasks,
          options,
        });

        stats.channelResults[channel] = (stats.channelResults[channel] || 0) + (result.ok ? 1 : 0);
        if (result.simulated) stats.simulated++;
        if (result.ok) anySuccess = true;
      }

      if (anySuccess) {
        stats.developersNotified++;
        stats.tasksIncluded += tasks.length;
        cooldowns[assigneeKey] = now;
      }
    }

    this.saveReminderCooldowns(cooldowns);
    console.log(
      `[AutomationReports] Developer reminders: ${stats.developersNotified} people, ${stats.tasksIncluded} tasks`
    );
    return stats;
  }

  // ─── 2) Manager velocity report ──────────────────────────────

  public isVelocityReportDueNow(): boolean {
    const cfg = this.config.velocityReport;
    if (!cfg.enabled) return false;

    const now = new Date();
    if (!cfg.includeWeekends && (now.getDay() === 0 || now.getDay() === 6)) return false;

    const [hours, minutes] = cfg.dailyTime.split(':').map(Number);
    const current = now.getHours() * 60 + now.getMinutes();
    const target = hours * 60 + minutes;
    if (current < target || current > target + 45) return false;

    const today = now.toISOString().split('T')[0];
    try {
      if (localStorage.getItem(VELOCITY_LAST_KEY) === today) return false;
    } catch {
      /* ignore */
    }
    return true;
  }

  public async sendManagerVelocityReport(
    options: { force?: boolean } = {}
  ): Promise<VelocityReportStats> {
    const cfg = this.config.velocityReport;
    const stats: VelocityReportStats = {
      delivered: false,
      simulated: false,
      managersNotified: 0,
    };

    if (!cfg.enabled) return stats;
    if (!options.force && !this.isVelocityReportDueNow()) {
      return stats;
    }

    const sprint = await adoService.getCurrentSprint();
    if (!sprint) {
      console.log('[AutomationReports] No active sprint for velocity report');
      return stats;
    }

    const currentStats = await adoService.getSprintStatistics(sprint.id);
    const workItems = await adoService.getSprintWorkItems(sprint.id);
    const history = await this.buildVelocityHistory(cfg.historicalSprints);
    const report = this.buildVelocityReport(sprint, currentStats, workItems, history);

    const managers = this.resolveManagerEmails(cfg.managerEmails);
    if (managers.length === 0 && !cfg.channels.includes('console') && !cfg.channels.includes('teams')) {
      console.warn('[AutomationReports] Velocity report has no manager recipients configured');
    }

    for (const channel of cfg.channels) {
      await this.deliverManagerReport(channel, {
        subject: `Sprint Velocity Report — ${sprint.name}`,
        html: report.html,
        text: report.text,
        managers,
      });
    }

    stats.delivered = true;
    stats.managersNotified = managers.length;
    stats.sprintName = sprint.name;

    try {
      localStorage.setItem(VELOCITY_LAST_KEY, new Date().toISOString().split('T')[0]);
    } catch {
      /* ignore */
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('automation:alert', {
          detail: {
            type: 'velocity_report',
            title: `Velocity report — ${sprint.name}`,
            message: report.text.slice(0, 280),
          },
        })
      );
    }

    return stats;
  }

  // ─── 3) Sentiment digest ─────────────────────────────────────

  public async runAndDeliverSentimentDigest(
    options: { force?: boolean } = {}
  ): Promise<SentimentDigestStats> {
    const cfg = this.config.sentimentDigest;
    const stats: SentimentDigestStats = {
      delivered: false,
      simulated: false,
      managersNotified: 0,
    };

    if (!cfg.enabled) return stats;

    const sprint = await adoService.getCurrentSprint();
    if (!sprint) {
      console.log('[AutomationReports] No active sprint for sentiment digest');
      return stats;
    }

    // Refresh analysis first
    await sentimentAnalysisBackgroundService.updateSentimentData();
    const sentiment = await sentimentAnalysisBackgroundService.getSentimentAnalysis(sprint.id);

    if (!sentiment) {
      console.log('[AutomationReports] No sentiment data available yet');
      return stats;
    }

    const alertRaised = sentiment.score < cfg.negativeThreshold;
    stats.overallSentiment = sentiment.sentiment;
    stats.score = sentiment.score;
    stats.alertRaised = alertRaised;

    if (!cfg.alwaysSendDigest && !alertRaised && !options.force) {
      return stats;
    }

    // Avoid spamming more than once/day unless forced or alert
    if (!options.force && !alertRaised) {
      const today = new Date().toISOString().split('T')[0];
      try {
        if (localStorage.getItem(SENTIMENT_LAST_KEY) === today) {
          return { ...stats, delivered: false };
        }
      } catch {
        /* ignore */
      }
    }

    const managers = this.resolveManagerEmails(cfg.managerEmails);
    const digest = this.buildSentimentDigest(sprint, sentiment, alertRaised);

    for (const channel of cfg.channels) {
      await this.deliverManagerReport(channel, {
        subject: alertRaised
          ? `⚠ Team Sentiment Alert — ${sprint.name}`
          : `Team Sentiment Digest — ${sprint.name}`,
        html: digest.html,
        text: digest.text,
        managers,
      });
    }

    stats.delivered = true;
    stats.managersNotified = managers.length;

    try {
      localStorage.setItem(SENTIMENT_LAST_KEY, new Date().toISOString().split('T')[0]);
    } catch {
      /* ignore */
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('automation:alert', {
          detail: {
            type: 'sentiment_digest',
            title: digest.subject,
            message: sentiment.summary || `Overall ${sentiment.sentiment} (${sentiment.score.toFixed(2)})`,
            severity: alertRaised ? 'high' : 'info',
          },
        })
      );
    }

    return stats;
  }

  // ─── Helpers ─────────────────────────────────────────────────

  private isDone(state: string): boolean {
    const s = (state || '').toLowerCase();
    return s === 'done' || s === 'closed' || s === 'completed' || s === 'resolved';
  }

  private isActive(state: string): boolean {
    const s = (state || '').toLowerCase();
    return s === 'active' || s === 'in progress' || s === 'committed' || s === 'doing';
  }

  private groupIncompleteByAssignee(
    items: WorkItem[],
    cfg: AutomationReportsConfig['developerReminders']
  ): Record<string, WorkItem[]> {
    const now = Date.now();
    const groups: Record<string, WorkItem[]> = {};

    for (const item of items) {
      if (!item.assignedTo) continue;

      const daysSince = Math.floor(
        (now - new Date(item.updatedDate).getTime()) / (1000 * 60 * 60 * 24)
      );

      const isStaleActive = this.isActive(item.state) && daysSince >= cfg.staleDays;
      const isAssignedBacklog =
        cfg.includeBacklogAssigned &&
        !this.isActive(item.state) &&
        !this.isDone(item.state);

      // Prefer reminding on stale active work; also nudge assigned backlog tasks
      if (!isStaleActive && !(isAssignedBacklog && (item.type === 'Task' || item.type === 'Bug'))) {
        continue;
      }

      // For backlog assigned, only include if sitting > staleDays too
      if (isAssignedBacklog && !isStaleActive && daysSince < cfg.staleDays) {
        continue;
      }

      const key = item.assignedTo.toLowerCase();
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }

    // Sort each developer's list: most stale first
    Object.values(groups).forEach((list) =>
      list.sort(
        (a, b) => new Date(a.updatedDate).getTime() - new Date(b.updatedDate).getTime()
      )
    );

    return groups;
  }

  private buildDeveloperReminderMessage(
    name: string,
    sprintName: string,
    tasks: WorkItem[],
    staleDays: number
  ): string {
    const lines = tasks.slice(0, 8).map((t) => {
      const days = Math.floor(
        (Date.now() - new Date(t.updatedDate).getTime()) / (1000 * 60 * 60 * 24)
      );
      return `• #${t.id} [${t.state}] ${t.title} — last update ${days}d ago${
        t.effort != null ? ` (effort: ${t.effort})` : ''
      }`;
    });

    const more =
      tasks.length > 8 ? `\n…and ${tasks.length - 8} more incomplete item(s).` : '';

    return [
      `Hi ${name},`,
      '',
      `Friendly reminder from AI Scrum Agent for sprint "${sprintName}".`,
      `You have ${tasks.length} incomplete work item(s) that need attention (threshold: ${staleDays}+ days):`,
      '',
      ...lines,
      more,
      '',
      'Please update status, add a progress comment, or reassign if blocked.',
      '— AI Scrum Agent',
    ]
      .filter((l) => l !== undefined)
      .join('\n');
  }

  private async deliverDeveloperReminder(
    channel: 'ado' | 'email' | 'teams' | 'console',
    args: {
      assigneeEmail: string | null;
      assigneeDisplay: string;
      message: string;
      tasks: WorkItem[];
      options: WriteAwareOptions;
    }
  ): Promise<{ ok: boolean; simulated: boolean }> {
    const { assigneeEmail, assigneeDisplay, message, tasks, options } = args;

    switch (channel) {
      case 'console':
        console.log(`\n[Developer Reminder → ${assigneeDisplay}]\n${message}\n`);
        return { ok: true, simulated: false };

      case 'ado': {
        // Comment on the most stale item so it shows in their ADO notifications
        const target = tasks[0];
        if (options.dryRun || (options.canWrite && !options.canWrite(1))) {
          console.log(`[AutomationReports][dry-run] would comment on #${target.id}`);
          return { ok: true, simulated: true };
        }
        const ok = await adoService.addWorkItemComment(target.id, message);
        if (ok) options.onWrite?.(1);
        return { ok, simulated: false };
      }

      case 'email': {
        if (!assigneeEmail) {
          console.warn(`[AutomationReports] No email for ${assigneeDisplay}`);
          return { ok: false, simulated: false };
        }
        const ok = await emailService.sendGenericEmail({
          to: [assigneeEmail],
          subject: `Task reminder: ${tasks.length} incomplete item(s)`,
          html: `<pre style="font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap">${message}</pre>`,
          text: message,
        });
        return { ok, simulated: false };
      }

      case 'teams': {
        const recipient = assigneeEmail || assigneeDisplay;
        const ok = await teamsNotificationService.sendNotification({
          type: 'direct',
          recipient,
          title: `Task reminder (${tasks.length} items)`,
          message,
          color: 'FF8C00',
        });
        return { ok, simulated: false };
      }

      default:
        return { ok: false, simulated: false };
    }
  }

  private async buildVelocityHistory(count: number): Promise<
    Array<{ sprint: Sprint; stats: SprintStatistics; velocity: number }>
  > {
    const sprints = await adoService.getSprints();
    const pastAndCurrent = sprints
      .filter((s) => s.state === 'past' || s.state === 'current')
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())
      .slice(0, Math.max(1, count));

    const history = [];
    for (const sprint of pastAndCurrent) {
      const stats = await adoService.getSprintStatistics(sprint.id);
      history.push({
        sprint,
        stats,
        velocity: stats.completedEffort || stats.completedWorkItems,
      });
    }
    return history;
  }

  private buildVelocityReport(
    sprint: Sprint,
    stats: SprintStatistics,
    workItems: WorkItem[],
    history: Array<{ sprint: Sprint; stats: SprintStatistics; velocity: number }>
  ): { html: string; text: string } {
    const daysRemaining = Math.max(
      0,
      Math.ceil((new Date(sprint.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    const completionPct =
      stats.totalWorkItems > 0
        ? Math.round((stats.completedWorkItems / stats.totalWorkItems) * 100)
        : 0;
    const effortPct =
      stats.totalEffort > 0 ? Math.round((stats.completedEffort / stats.totalEffort) * 100) : 0;

    const byPerson = this.summarizeByAssignee(workItems);
    const personLines = Object.entries(byPerson)
      .sort((a, b) => b[1].remaining - a[1].remaining)
      .map(
        ([name, v]) =>
          `• ${name}: ${v.completed}/${v.total} done, ${v.remaining} remaining, effort left ${v.effortRemaining}`
      );

    const historyLines = history.map(
      (h) =>
        `• ${h.sprint.name}: velocity ${h.velocity} (completed ${h.stats.completedWorkItems}/${h.stats.totalWorkItems})`
    );

    const avgVelocity =
      history.length > 0
        ? Math.round(history.reduce((s, h) => s + h.velocity, 0) / history.length)
        : 0;

    const onTrack =
      daysRemaining === 0
        ? completionPct >= 90
        : effortPct >= Math.min(95, 100 - (daysRemaining / Math.max(daysRemaining + 1, 1)) * 100);

    const text = [
      `Sprint Velocity Report — ${sprint.name}`,
      `Period: ${sprint.startDate} → ${sprint.endDate} (${daysRemaining} day(s) remaining)`,
      '',
      `Completion: ${stats.completedWorkItems}/${stats.totalWorkItems} items (${completionPct}%)`,
      `Effort: ${stats.completedEffort}/${stats.totalEffort} (${effortPct}%)`,
      `In progress: ${stats.inProgressWorkItems} | Blocked: ${stats.blockedWorkItems}`,
      `Remaining effort: ${stats.remainingEffort}`,
      `Status signal: ${onTrack ? 'On track' : 'At risk — review capacity/scope'}`,
      '',
      'Team workload:',
      ...personLines,
      '',
      `Recent velocity (avg ${avgVelocity}):`,
      ...historyLines,
    ].join('\n');

    const html = `
      <h2>Sprint Velocity Report — ${sprint.name}</h2>
      <p><strong>Period:</strong> ${sprint.startDate} → ${sprint.endDate}<br/>
      <strong>Days remaining:</strong> ${daysRemaining}<br/>
      <strong>Status:</strong> ${onTrack ? 'On track' : 'At risk'}</p>
      <ul>
        <li>Completion: <strong>${stats.completedWorkItems}/${stats.totalWorkItems}</strong> (${completionPct}%)</li>
        <li>Effort: <strong>${stats.completedEffort}/${stats.totalEffort}</strong> (${effortPct}%)</li>
        <li>In progress: ${stats.inProgressWorkItems}</li>
        <li>Blocked: ${stats.blockedWorkItems}</li>
        <li>Remaining effort: ${stats.remainingEffort}</li>
        <li>Avg recent velocity: ${avgVelocity}</li>
      </ul>
      <h3>Team workload</h3>
      <ul>${personLines.map((l) => `<li>${l.replace(/^• /, '')}</li>`).join('')}</ul>
      <h3>Recent velocity</h3>
      <ul>${historyLines.map((l) => `<li>${l.replace(/^• /, '')}</li>`).join('')}</ul>
      <p><em>Generated by AI Scrum Agent automation</em></p>
    `;

    return { html, text };
  }

  private summarizeByAssignee(workItems: WorkItem[]): Record<
    string,
    { total: number; completed: number; remaining: number; effortRemaining: number }
  > {
    const map: Record<
      string,
      { total: number; completed: number; remaining: number; effortRemaining: number }
    > = {};

    for (const item of workItems) {
      const name = this.extractDisplayName(item.assignedTo || 'Unassigned');
      if (!map[name]) {
        map[name] = { total: 0, completed: 0, remaining: 0, effortRemaining: 0 };
      }
      map[name].total++;
      if (this.isDone(item.state)) {
        map[name].completed++;
      } else {
        map[name].remaining++;
        map[name].effortRemaining += item.effort || 0;
      }
    }
    return map;
  }

  private buildSentimentDigest(
    sprint: Sprint,
    sentiment: SentimentAnalysisResult,
    alertRaised: boolean
  ): { subject: string; html: string; text: string } {
    const subject = alertRaised
      ? `Team Sentiment Alert — ${sprint.name}`
      : `Team Sentiment Digest — ${sprint.name}`;

    const text = [
      subject,
      '',
      `Overall sentiment: ${sentiment.sentiment}`,
      `Score: ${sentiment.score.toFixed(2)} (confidence ${(sentiment.confidence * 100).toFixed(0)}%)`,
      sentiment.summary || '',
      alertRaised
        ? 'Action needed: negative trend detected — consider a team check-in.'
        : 'No critical sentiment alert at this time.',
    ].join('\n');

    const html = `
      <h2>${subject}</h2>
      <p><strong>Overall:</strong> ${sentiment.sentiment}<br/>
      <strong>Score:</strong> ${sentiment.score.toFixed(2)}<br/>
      <strong>Confidence:</strong> ${(sentiment.confidence * 100).toFixed(0)}%</p>
      <p>${sentiment.summary || ''}</p>
      ${
        alertRaised
          ? '<p style="color:#c62828"><strong>Action needed:</strong> negative trend detected — consider a team check-in.</p>'
          : '<p>No critical sentiment alert at this time.</p>'
      }
      <p><em>Generated by AI Scrum Agent automation</em></p>
    `;

    return { subject, html, text };
  }

  private async deliverManagerReport(
    channel: 'email' | 'teams' | 'console',
    args: { subject: string; html: string; text: string; managers: string[] }
  ): Promise<void> {
    const { subject, html, text, managers } = args;

    switch (channel) {
      case 'console':
        console.log(`\n=== ${subject} ===\n${text}\n================\n`);
        break;
      case 'email': {
        const recipients =
          managers.length > 0 ? managers : emailService.getScheduleConfig().recipients;
        if (!recipients.length) {
          console.warn(`[AutomationReports] Email channel skipped for "${subject}" — no managers`);
          break;
        }
        await emailService.sendGenericEmail({ to: recipients, subject, html, text });
        break;
      }
      case 'teams':
        await teamsNotificationService.sendNotification({
          type: 'channel',
          recipient: 'General',
          title: subject,
          message: text,
          color: '0078D4',
        });
        break;
    }
  }

  private resolveManagerEmails(configured: string[]): string[] {
    if (configured?.length) return configured;
    return emailService.getScheduleConfig().recipients || [];
  }

  private extractDisplayName(assignedTo: string): string {
    if (!assignedTo) return 'Team member';
    return assignedTo.split('<')[0].trim() || assignedTo;
  }

  private extractEmail(assignedTo: string): string | null {
    if (!assignedTo) return null;
    const match = assignedTo.match(/<([^>]+)>/);
    if (match) return match[1];
    if (assignedTo.includes('@')) return assignedTo.trim();
    return null;
  }

  private loadConfig(): AutomationReportsConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_CONFIG };
      const parsed = JSON.parse(raw);
      return {
        developerReminders: {
          ...DEFAULT_CONFIG.developerReminders,
          ...(parsed.developerReminders || {}),
        },
        velocityReport: {
          ...DEFAULT_CONFIG.velocityReport,
          ...(parsed.velocityReport || {}),
        },
        sentimentDigest: {
          ...DEFAULT_CONFIG.sentimentDigest,
          ...(parsed.sentimentDigest || {}),
        },
      };
    } catch {
      return { ...DEFAULT_CONFIG };
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('[AutomationReports] save config failed', error);
    }
  }

  private loadReminderCooldowns(): Record<string, number> {
    try {
      const raw = localStorage.getItem(REMINDER_COOLDOWN_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  private saveReminderCooldowns(map: Record<string, number>): void {
    try {
      localStorage.setItem(REMINDER_COOLDOWN_KEY, JSON.stringify(map));
    } catch {
      /* ignore */
    }
  }
}

const automationReportsService = new AutomationReportsService();
export default automationReportsService;
