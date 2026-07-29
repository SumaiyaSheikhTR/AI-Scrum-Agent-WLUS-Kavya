/**
 * Automation Orchestrator
 *
 * Central coordinator for all background automation in the AI Scrum Agent.
 * Replaces ad-hoc timers that previously caused UI refresh storms by:
 * - Using a single staggered scheduler loop
 * - Pausing when the tab is hidden
 * - Enforcing dry-run / write rate limits
 * - Emitting CustomEvents instead of forcing page reloads
 * - Preventing overlapping job execution with a mutex
 */

import {
  AUTOMATION_EVENT,
  AutomationExecutionLogEntry,
  AutomationJobResult,
  AutomationOrchestratorConfig,
  AutomationPlatformStatus,
  AutomationServiceId,
  DEFAULT_ORCHESTRATOR_CONFIG,
  SERVICE_META,
} from './automationTypes';
import rulesEngine from './rulesEngine';
import dailySummaryScheduler from './dailySummaryScheduler';
import notificationAlertingSystem from './notificationAlertingSystem';
import ticketManagementService from './ticketManagementService';
import sentimentAnalysisBackgroundService from './sentimentAnalysisBackgroundService';
import developerEngagementService from './developerEngagementService';

const STORAGE_KEY = 'automation_orchestrator_config';
const LOG_STORAGE_KEY = 'automation_orchestrator_logs';
const WRITE_WINDOW_KEY = 'automation_write_timestamps';
const MAX_LOG_ENTRIES = 100;
const TICK_MS = 30_000;

class AutomationOrchestrator {
  private config: AutomationOrchestratorConfig;
  private isRunning = false;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private jobInFlight = false;
  private currentService: AutomationServiceId | null = null;
  private lastJobFinishedAt = 0;
  private lastRunByService: Partial<Record<AutomationServiceId, number>> = {};
  private nextRunByService: Partial<Record<AutomationServiceId, number>> = {};
  private executionLog: AutomationExecutionLogEntry[] = [];
  private writeTimestamps: number[] = [];
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.config = this.loadConfig();
    this.executionLog = this.loadLogs();
    this.writeTimestamps = this.loadWriteTimestamps();
    this.seedNextRuns();
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.bindVisibility();
    this.seedNextRuns(true);

    // Align child services with orchestrator config (no independent aggressive loops)
    this.syncChildServices();

    this.tickTimer = setInterval(() => {
      void this.tick();
    }, TICK_MS);

    this.emitStatus();
    console.log('[AutomationOrchestrator] started', {
      enabled: this.config.enabled,
      dryRun: this.config.dryRun,
    });
  }

  public stop(): void {
    this.isRunning = false;
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    this.unbindVisibility();
    this.emitStatus();
    console.log('[AutomationOrchestrator] stopped');
  }

  public isOrchestratorRunning(): boolean {
    return this.isRunning;
  }

  public getConfig(): AutomationOrchestratorConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public updateConfig(partial: Partial<AutomationOrchestratorConfig>): AutomationOrchestratorConfig {
    const nextServices = partial.services
      ? { ...this.config.services, ...partial.services }
      : this.config.services;
    const nextIntervals = partial.intervalsMinutes
      ? { ...this.config.intervalsMinutes, ...partial.intervalsMinutes }
      : this.config.intervalsMinutes;

    this.config = {
      ...this.config,
      ...partial,
      services: nextServices,
      intervalsMinutes: nextIntervals,
    };

    this.saveConfig();
    this.syncChildServices();
    this.seedNextRuns(true);
    this.emit(AUTOMATION_EVENT.CONFIG, this.getConfig());
    this.emitStatus();
    return this.getConfig();
  }

  public setServiceEnabled(serviceId: AutomationServiceId, enabled: boolean): void {
    this.updateConfig({
      services: { ...this.config.services, [serviceId]: enabled },
    });
  }

  public getStatus(): AutomationPlatformStatus {
    const now = Date.now();
    return {
      orchestratorEnabled: this.config.enabled,
      dryRun: this.config.dryRun,
      running: this.isRunning,
      writesThisHour: this.pruneWrites(now).length,
      maxWritesPerHour: this.config.maxWritesPerHour,
      recentExecutions: this.getRecentExecutions(20),
      services: (Object.keys(SERVICE_META) as AutomationServiceId[]).map((id) => ({
        id,
        label: SERVICE_META[id].label,
        description: SERVICE_META[id].description,
        enabled: !!this.config.services[id],
        running: this.jobInFlight && this.currentService === id,
        lastRun: this.getLatestForService(id),
        nextRunAt: this.nextRunByService[id]
          ? new Date(this.nextRunByService[id] as number).toISOString()
          : null,
      })),
    };
  }

  public getRecentExecutions(limit = 50): AutomationExecutionLogEntry[] {
    return this.executionLog.slice(0, limit);
  }

  /**
   * Manually run a single automation service (respects dry-run / write limits).
   */
  public async runServiceNow(
    serviceId: AutomationServiceId,
    options?: { force?: boolean }
  ): Promise<AutomationExecutionLogEntry> {
    if (!options?.force && this.shouldPauseForVisibility()) {
      return this.recordResult({
        serviceId,
        status: 'skipped',
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        dryRun: this.config.dryRun,
        summary: 'Skipped: browser tab is hidden',
      });
    }

    return this.executeService(serviceId, { manual: true });
  }

  public async runAllNow(): Promise<AutomationExecutionLogEntry[]> {
    const results: AutomationExecutionLogEntry[] = [];
    for (const id of Object.keys(SERVICE_META) as AutomationServiceId[]) {
      if (!this.config.services[id]) continue;
      results.push(await this.runServiceNow(id, { force: true }));
    }
    return results;
  }

  /**
   * Gate for services that mutate Azure DevOps.
   * Returns false when the write should be skipped (caller should simulate).
   */
  public canPerformWrite(count = 1): boolean {
    if (this.config.dryRun) return false;
    const now = Date.now();
    const recent = this.pruneWrites(now);
    return recent.length + count <= this.config.maxWritesPerHour;
  }

  public recordWrite(count = 1): void {
    const now = Date.now();
    for (let i = 0; i < count; i++) {
      this.writeTimestamps.push(now);
    }
    this.saveWriteTimestamps();
  }

  public isDryRun(): boolean {
    return this.config.dryRun;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  // ─── Internals ───────────────────────────────────────────────

  private async tick(): Promise<void> {
    if (!this.config.enabled || this.jobInFlight) return;
    if (this.shouldPauseForVisibility()) return;

    const now = Date.now();
    if (now - this.lastJobFinishedAt < this.config.globalCooldownMs) return;

    const due = (Object.keys(SERVICE_META) as AutomationServiceId[])
      .filter((id) => this.config.services[id])
      .filter((id) => (this.nextRunByService[id] || 0) <= now)
      .sort((a, b) => (this.nextRunByService[a] || 0) - (this.nextRunByService[b] || 0));

    if (due.length === 0) return;

    // Run one due job per tick to avoid request storms
    const serviceId = due[0];
    await this.executeService(serviceId, { manual: false });
  }

  private async executeService(
    serviceId: AutomationServiceId,
    opts: { manual: boolean }
  ): Promise<AutomationExecutionLogEntry> {
    this.jobInFlight = true;
    this.currentService = serviceId;
    const startedAt = new Date().toISOString();
    let result: AutomationJobResult;

    try {
      switch (serviceId) {
        case 'rulesEngine':
          result = await this.runRulesEngine();
          break;
        case 'dailySummary':
          result = await this.runDailySummary(opts.manual);
          break;
        case 'alerting':
          result = await this.runAlerting();
          break;
        case 'ticketManagement':
          result = await this.runTicketManagement();
          break;
        case 'sentiment':
          result = await this.runSentiment();
          break;
        case 'developerEngagement':
          result = await this.runDeveloperEngagement();
          break;
        default:
          result = {
            serviceId,
            status: 'error',
            startedAt,
            finishedAt: new Date().toISOString(),
            dryRun: this.config.dryRun,
            summary: `Unknown service: ${serviceId}`,
            error: 'Unknown service',
          };
      }
    } catch (error) {
      result = {
        serviceId,
        status: 'error',
        startedAt,
        finishedAt: new Date().toISOString(),
        dryRun: this.config.dryRun,
        summary: 'Execution failed',
        error: error instanceof Error ? error.message : String(error),
      };
    }

    if (!result.startedAt) result.startedAt = startedAt;
    if (!result.finishedAt) result.finishedAt = new Date().toISOString();
    result.dryRun = this.config.dryRun;

    const entry = this.recordResult(result);
    this.lastRunByService[serviceId] = Date.now();
    this.lastJobFinishedAt = Date.now();
    this.scheduleNext(serviceId);
    this.jobInFlight = false;
    this.currentService = null;
    this.emitStatus();
    return entry;
  }

  private async runRulesEngine(): Promise<AutomationJobResult> {
    const startedAt = new Date().toISOString();
    const execution = await rulesEngine.executeRules({
      dryRun: this.config.dryRun,
      canWrite: (n) => this.canPerformWrite(n),
      onWrite: (n) => this.recordWrite(n),
    });

    return {
      serviceId: 'rulesEngine',
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: `Evaluated rules: ${execution.matched} matches, ${execution.actionsApplied} applied, ${execution.actionsSimulated} simulated`,
      itemsProcessed: execution.workItemsScanned,
      actionsTaken: execution.actionsApplied,
      actionsSimulated: execution.actionsSimulated,
      details: { results: execution.results.length },
    };
  }

  private async runDailySummary(manual: boolean): Promise<AutomationJobResult> {
    const startedAt = new Date().toISOString();
    const config = dailySummaryScheduler.getConfig();

    if (!manual && !config.enabled) {
      return {
        serviceId: 'dailySummary',
        status: 'skipped',
        startedAt,
        finishedAt: new Date().toISOString(),
        dryRun: this.config.dryRun,
        summary: 'Daily summary scheduler is disabled in its own config',
      };
    }

    // Scheduled path: only generate when the daily window matches
    if (!manual && !dailySummaryScheduler.isDueNow()) {
      return {
        serviceId: 'dailySummary',
        status: 'skipped',
        startedAt,
        finishedAt: new Date().toISOString(),
        dryRun: this.config.dryRun,
        summary: 'Not within the configured daily summary window',
      };
    }

    const summary = await dailySummaryScheduler.generateSummaryNow();
    await dailySummaryScheduler.deliverSummaryPublic(summary);

    return {
      serviceId: 'dailySummary',
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: `Generated daily summary for ${summary.sprintName}`,
      itemsProcessed: summary.metrics.totalWorkItems,
      details: {
        date: summary.date,
        highlights: summary.highlights.length,
        concerns: summary.concerns.length,
      },
    };
  }

  private async runAlerting(): Promise<AutomationJobResult> {
    const startedAt = new Date().toISOString();
    const alertConfig = notificationAlertingSystem.getConfig();

    if (!alertConfig.enabled) {
      return {
        serviceId: 'alerting',
        status: 'skipped',
        startedAt,
        finishedAt: new Date().toISOString(),
        dryRun: this.config.dryRun,
        summary: 'Alerting system disabled in its own config',
      };
    }

    const created = await notificationAlertingSystem.checkForAlertsNow();
    return {
      serviceId: 'alerting',
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: `Alert check complete: ${created} new alert(s)`,
      actionsTaken: created,
    };
  }

  private async runTicketManagement(): Promise<AutomationJobResult> {
    const startedAt = new Date().toISOString();
    const cfg = ticketManagementService.getConfig();

    if (!cfg.enableAutoUpdates) {
      return {
        serviceId: 'ticketManagement',
        status: 'skipped',
        startedAt,
        finishedAt: new Date().toISOString(),
        dryRun: this.config.dryRun,
        summary: 'Ticket management auto-updates disabled',
      };
    }

    const stats = await ticketManagementService.processAllWorkItems({
      dryRun: this.config.dryRun,
      canWrite: (n) => this.canPerformWrite(n),
      onWrite: (n) => this.recordWrite(n),
    });

    return {
      serviceId: 'ticketManagement',
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: `Processed ${stats.processed} items (${stats.statusUpdates} status, ${stats.comments} comments)`,
      itemsProcessed: stats.processed,
      actionsTaken: stats.statusUpdates + stats.comments,
      actionsSimulated: stats.simulated,
    };
  }

  private async runSentiment(): Promise<AutomationJobResult> {
    const startedAt = new Date().toISOString();
    await sentimentAnalysisBackgroundService.updateSentimentData();
    const stats = sentimentAnalysisBackgroundService.getCacheStats();
    return {
      serviceId: 'sentiment',
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: `Sentiment cache refreshed (${stats.validEntries} valid entries)`,
      itemsProcessed: stats.totalEntries,
    };
  }

  private async runDeveloperEngagement(): Promise<AutomationJobResult> {
    const startedAt = new Date().toISOString();
    const cfg = developerEngagementService.getConfig();

    if (!cfg.trackingEnabled) {
      return {
        serviceId: 'developerEngagement',
        status: 'skipped',
        startedAt,
        finishedAt: new Date().toISOString(),
        dryRun: this.config.dryRun,
        summary: 'Developer engagement tracking disabled',
      };
    }

    const stats = await developerEngagementService.processEngagementTracking({
      dryRun: this.config.dryRun,
      canWrite: (n) => this.canPerformWrite(n),
      onWrite: (n) => this.recordWrite(n),
    });

    return {
      serviceId: 'developerEngagement',
      status: 'success',
      startedAt,
      finishedAt: new Date().toISOString(),
      dryRun: this.config.dryRun,
      summary: `Engagement pass: ${stats.promptsSent} prompts, ${stats.simulated} simulated`,
      itemsProcessed: stats.processed,
      actionsTaken: stats.promptsSent,
      actionsSimulated: stats.simulated,
    };
  }

  private syncChildServices(): void {
    // Child services no longer own aggressive timers; keep their flags aligned.
    dailySummaryScheduler.setOrchestratedMode(true);
    notificationAlertingSystem.setOrchestratedMode(true);
    ticketManagementService.setOrchestratedMode(true);
    sentimentAnalysisBackgroundService.setOrchestratedMode(true);
    developerEngagementService.setOrchestratedMode(true);
    rulesEngine.setOrchestratedMode(true);

    if (this.config.enabled && this.config.services.dailySummary) {
      dailySummaryScheduler.updateConfig({ enabled: true });
    }
    if (this.config.enabled && this.config.services.alerting) {
      notificationAlertingSystem.updateConfig({ enabled: true });
    }
  }

  private seedNextRuns(reset = false): void {
    const now = Date.now();
    (Object.keys(SERVICE_META) as AutomationServiceId[]).forEach((id, index) => {
      if (reset || !this.nextRunByService[id]) {
        // Stagger first runs by 20s * index so services don't pile up
        this.nextRunByService[id] = now + index * 20_000;
      }
    });
  }

  private scheduleNext(serviceId: AutomationServiceId): void {
    const minutes = this.config.intervalsMinutes[serviceId] || 30;
    this.nextRunByService[serviceId] = Date.now() + minutes * 60_000;
  }

  private shouldPauseForVisibility(): boolean {
    if (!this.config.pauseWhenHidden) return false;
    if (typeof document === 'undefined') return false;
    return document.hidden;
  }

  private bindVisibility(): void {
    if (typeof document === 'undefined' || this.visibilityHandler) return;
    this.visibilityHandler = () => this.emitStatus();
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  private unbindVisibility(): void {
    if (typeof document === 'undefined' || !this.visibilityHandler) return;
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.visibilityHandler = null;
  }

  private recordResult(result: AutomationJobResult): AutomationExecutionLogEntry {
    const entry: AutomationExecutionLogEntry = {
      ...result,
      id: `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    };
    this.executionLog.unshift(entry);
    if (this.executionLog.length > MAX_LOG_ENTRIES) {
      this.executionLog = this.executionLog.slice(0, MAX_LOG_ENTRIES);
    }
    this.saveLogs();
    this.emit(AUTOMATION_EVENT.EXECUTION, entry);
    return entry;
  }

  private getLatestForService(serviceId: AutomationServiceId): AutomationExecutionLogEntry | null {
    return this.executionLog.find((e) => e.serviceId === serviceId) || null;
  }

  private pruneWrites(now: number): number[] {
    const hourAgo = now - 60 * 60 * 1000;
    this.writeTimestamps = this.writeTimestamps.filter((t) => t >= hourAgo);
    return this.writeTimestamps;
  }

  private emitStatus(): void {
    this.emit(AUTOMATION_EVENT.STATUS, this.getStatus());
  }

  private emit(name: string, detail: unknown): void {
    if (typeof window === 'undefined') return;
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private loadConfig(): AutomationOrchestratorConfig {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_ORCHESTRATOR_CONFIG };
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_ORCHESTRATOR_CONFIG,
        ...parsed,
        services: { ...DEFAULT_ORCHESTRATOR_CONFIG.services, ...(parsed.services || {}) },
        intervalsMinutes: {
          ...DEFAULT_ORCHESTRATOR_CONFIG.intervalsMinutes,
          ...(parsed.intervalsMinutes || {}),
        },
      };
    } catch {
      return { ...DEFAULT_ORCHESTRATOR_CONFIG };
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('[AutomationOrchestrator] failed to save config', error);
    }
  }

  private loadLogs(): AutomationExecutionLogEntry[] {
    try {
      const raw = localStorage.getItem(LOG_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveLogs(): void {
    try {
      localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.executionLog.slice(0, MAX_LOG_ENTRIES)));
    } catch (error) {
      console.error('[AutomationOrchestrator] failed to save logs', error);
    }
  }

  private loadWriteTimestamps(): number[] {
    try {
      const raw = localStorage.getItem(WRITE_WINDOW_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private saveWriteTimestamps(): void {
    try {
      localStorage.setItem(WRITE_WINDOW_KEY, JSON.stringify(this.writeTimestamps));
    } catch (error) {
      console.error('[AutomationOrchestrator] failed to save write timestamps', error);
    }
  }
}

const automationOrchestrator = new AutomationOrchestrator();
export default automationOrchestrator;
