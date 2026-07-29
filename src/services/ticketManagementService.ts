/**
 * Ticket Management Service
 *
 * Smart ticket automation with JSON-serializable declarative rules
 * (functions cannot survive localStorage round-trips).
 */

import adoService, { WorkItem } from './adoService';
import { RuleCondition } from './rulesEngine';

export interface DeclarativeStatusUpdateRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  targetState: string;
  enabled: boolean;
}

export interface DeclarativeCommentRule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  commentTemplate: string;
  enabled: boolean;
  cooldownDays: number;
}

/** @deprecated kept for Settings form type compatibility */
export interface StatusUpdateRule {
  id: string;
  name: string;
  description: string;
  condition?: (workItem: WorkItem) => boolean;
  conditions?: RuleCondition[];
  targetState: string;
  enabled: boolean;
}

/** @deprecated kept for Settings form type compatibility */
export interface CommentRule {
  id: string;
  name: string;
  description: string;
  condition?: (workItem: WorkItem) => boolean;
  conditions?: RuleCondition[];
  commentTemplate: string;
  enabled: boolean;
  cooldownDays: number;
}

export interface TicketManagementConfig {
  statusUpdateRules: DeclarativeStatusUpdateRule[];
  commentRules: DeclarativeCommentRule[];
  enableAutoUpdates: boolean;
  updateInterval: number;
  lastRunTimestamp: number | null;
}

export interface TicketProcessingOptions {
  dryRun?: boolean;
  canWrite?: (count: number) => boolean;
  onWrite?: (count: number) => void;
}

export interface TicketProcessingStats {
  processed: number;
  statusUpdates: number;
  comments: number;
  simulated: number;
}

const DEFAULT_CONFIG: TicketManagementConfig = {
  statusUpdateRules: [
    {
      id: 'pr_merged_to_qa',
      name: 'PR Merged → Ready for QA',
      description: 'Move work items to Ready for QA when tagged as PR merged',
      conditions: [
        { field: 'state', operator: 'equals', value: 'In Progress' },
        { field: 'tags', operator: 'contains', value: 'pr-merged', logicalOperator: 'AND' },
      ],
      targetState: 'Ready for QA',
      enabled: true,
    },
    {
      id: 'stale_active_to_at_risk',
      name: 'Stale Active → At Risk',
      description: 'Flag Active/In Progress items stale for 5+ days',
      conditions: [
        { field: 'state', operator: 'in', value: ['Active', 'In Progress'] },
        { field: 'updatedDate', operator: 'days_since', value: 5, logicalOperator: 'AND' },
      ],
      targetState: 'At Risk',
      enabled: false, // opt-in: state names vary by process template
    },
    {
      id: 'qa_passed_to_ready_for_release',
      name: 'QA Passed → Ready for Release',
      description: 'Move Ready for QA items tagged qa-passed',
      conditions: [
        { field: 'state', operator: 'equals', value: 'Ready for QA' },
        { field: 'tags', operator: 'contains', value: 'qa-passed', logicalOperator: 'AND' },
      ],
      targetState: 'Ready for Release',
      enabled: true,
    },
  ],
  commentRules: [
    {
      id: 'missing_effort',
      name: 'Missing Effort Estimate',
      description: 'Prompt for effort on active items without estimates',
      conditions: [
        { field: 'state', operator: 'in', value: ['Active', 'In Progress'] },
        { field: 'effort', operator: 'is_null', value: null, logicalOperator: 'AND' },
      ],
      commentTemplate:
        'This work item is missing an effort estimate. Please update Effort to help with sprint planning.',
      enabled: true,
      cooldownDays: 2,
    },
    {
      id: 'stale_item',
      name: 'Stale Work Item',
      description: 'Prompt updates for Active Tasks stale 3+ days',
      conditions: [
        { field: 'state', operator: 'equals', value: 'Active' },
        { field: 'type', operator: 'equals', value: 'Task', logicalOperator: 'AND' },
        { field: 'updatedDate', operator: 'days_since', value: 3, logicalOperator: 'AND' },
      ],
      commentTemplate:
        'This work item has not been updated in {daysSinceUpdate} days. Please provide a status update or move it to the appropriate state.',
      enabled: true,
      cooldownDays: 3,
    },
    {
      id: 'high_effort_clarification',
      name: 'High Effort Clarification',
      description: 'Ask for clarification on high-effort items',
      conditions: [{ field: 'effort', operator: 'greater_than', value: 13 }],
      commentTemplate:
        'This work item has a high effort estimate ({effort} points). Consider breaking it down or clarifying the scope.',
      enabled: true,
      cooldownDays: 5,
    },
  ],
  enableAutoUpdates: true,
  updateInterval: 60,
  lastRunTimestamp: null,
};

class TicketManagementService {
  private config: TicketManagementConfig;
  private updateTimer: ReturnType<typeof setInterval> | null = null;
  private orchestratedMode = false;
  private lastStats: TicketProcessingStats = {
    processed: 0,
    statusUpdates: 0,
    comments: 0,
    simulated: 0,
  };

  constructor() {
    this.config = this.normalizeConfig(this.loadConfig() || DEFAULT_CONFIG);
  }

  public setOrchestratedMode(enabled: boolean): void {
    this.orchestratedMode = enabled;
    if (enabled) {
      this.stopUpdateTimer();
    }
  }

  private loadConfig(): TicketManagementConfig | null {
    try {
      const configStr = localStorage.getItem('ticketManagementConfig');
      if (!configStr) return null;
      return JSON.parse(configStr);
    } catch (error) {
      console.error('[TicketManagement] load error:', error);
      return null;
    }
  }

  private saveConfig(): void {
    try {
      localStorage.setItem('ticketManagementConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('[TicketManagement] save error:', error);
    }
  }

  /**
   * Migrate legacy function-based rules / incomplete stored configs.
   */
  private normalizeConfig(raw: any): TicketManagementConfig {
    const base = { ...DEFAULT_CONFIG, ...(raw || {}) };

    const statusUpdateRules: DeclarativeStatusUpdateRule[] = (
      Array.isArray(raw?.statusUpdateRules) ? raw.statusUpdateRules : DEFAULT_CONFIG.statusUpdateRules
    )
      .map((rule: any) => {
        const defaults = DEFAULT_CONFIG.statusUpdateRules.find((d) => d.id === rule.id);
        return {
          id: rule.id || `status_${Date.now()}`,
          name: rule.name || 'Custom status rule',
          description: rule.description || '',
          targetState: rule.targetState,
          enabled: !!rule.enabled,
          conditions:
            Array.isArray(rule.conditions) && rule.conditions.length > 0
              ? rule.conditions
              : defaults?.conditions || [],
        };
      })
      .filter((r: DeclarativeStatusUpdateRule) => r.conditions.length > 0 || !!r.targetState);

    const commentRules: DeclarativeCommentRule[] = (
      Array.isArray(raw?.commentRules) ? raw.commentRules : DEFAULT_CONFIG.commentRules
    )
      .map((rule: any) => {
        const defaults = DEFAULT_CONFIG.commentRules.find((d) => d.id === rule.id);
        return {
          id: rule.id || `comment_${Date.now()}`,
          name: rule.name || 'Custom comment rule',
          description: rule.description || '',
          commentTemplate: rule.commentTemplate || defaults?.commentTemplate || 'Please update this work item.',
          enabled: !!rule.enabled,
          cooldownDays: typeof rule.cooldownDays === 'number' ? rule.cooldownDays : 2,
          conditions:
            Array.isArray(rule.conditions) && rule.conditions.length > 0
              ? rule.conditions
              : defaults?.conditions || [],
        };
      })
      .filter((r: DeclarativeCommentRule) => r.conditions.length > 0);

    // If stored rules lost conditions (legacy function serialization), fall back to defaults
    return {
      enableAutoUpdates: base.enableAutoUpdates !== false,
      updateInterval: base.updateInterval || 60,
      lastRunTimestamp: base.lastRunTimestamp ?? null,
      statusUpdateRules:
        statusUpdateRules.length > 0 ? statusUpdateRules : DEFAULT_CONFIG.statusUpdateRules,
      commentRules: commentRules.length > 0 ? commentRules : DEFAULT_CONFIG.commentRules,
    };
  }

  private startUpdateTimer(): void {
    if (this.orchestratedMode) return;
    if (this.updateTimer) clearInterval(this.updateTimer);
    const intervalMs = this.config.updateInterval * 60 * 1000;
    this.updateTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void this.processAllWorkItems();
    }, intervalMs);
  }

  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  }

  updateConfig(config: Partial<TicketManagementConfig>): void {
    const wasEnabled = this.config.enableAutoUpdates;
    this.config = this.normalizeConfig({ ...this.config, ...config });
    this.saveConfig();

    if (this.orchestratedMode) return;

    if (!wasEnabled && this.config.enableAutoUpdates) this.startUpdateTimer();
    else if (wasEnabled && !this.config.enableAutoUpdates) this.stopUpdateTimer();
    else if (this.config.enableAutoUpdates) this.startUpdateTimer();
  }

  getConfig(): TicketManagementConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  async processAllWorkItems(options: TicketProcessingOptions = {}): Promise<TicketProcessingStats> {
    const stats: TicketProcessingStats = {
      processed: 0,
      statusUpdates: 0,
      comments: 0,
      simulated: 0,
    };

    try {
      this.config.lastRunTimestamp = Date.now();
      this.saveConfig();

      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        console.log('[TicketManagement] No active sprint; skipping');
        this.lastStats = stats;
        return stats;
      }

      const workItems = await adoService.getSprintWorkItems(currentSprint.id);
      for (const workItem of workItems) {
        const itemStats = await this.processWorkItem(workItem, options);
        stats.processed++;
        stats.statusUpdates += itemStats.statusUpdates;
        stats.comments += itemStats.comments;
        stats.simulated += itemStats.simulated;
      }

      console.log(
        `[TicketManagement] processed ${stats.processed} items (${stats.statusUpdates} status, ${stats.comments} comments, ${stats.simulated} simulated)`
      );
    } catch (error) {
      console.error('[TicketManagement] process error:', error);
      throw error;
    }

    this.lastStats = stats;
    return stats;
  }

  async processWorkItem(
    workItem: WorkItem,
    options: TicketProcessingOptions = {}
  ): Promise<TicketProcessingStats> {
    const stats: TicketProcessingStats = {
      processed: 1,
      statusUpdates: 0,
      comments: 0,
      simulated: 0,
    };

    const statusResult = await this.checkStatusUpdateRules(workItem, options);
    stats.statusUpdates += statusResult.applied;
    stats.simulated += statusResult.simulated;

    const commentResult = await this.checkCommentRules(workItem, options);
    stats.comments += commentResult.applied;
    stats.simulated += commentResult.simulated;

    return stats;
  }

  private evaluateConditions(conditions: RuleCondition[], workItem: WorkItem): boolean {
    if (!conditions || conditions.length === 0) return false;

    let result = this.evaluateCondition(conditions[0], workItem);
    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const next = this.evaluateCondition(condition, workItem);
      result = condition.logicalOperator === 'OR' ? result || next : result && next;
    }
    return result;
  }

  private evaluateCondition(condition: RuleCondition, workItem: WorkItem): boolean {
    const fieldValue = this.getFieldValue(condition.field, workItem);

    switch (condition.operator) {
      case 'equals':
        return this.norm(fieldValue) === this.norm(condition.value);
      case 'not_equals':
        return this.norm(fieldValue) !== this.norm(condition.value);
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.some((t) =>
            String(t).toLowerCase().includes(String(condition.value).toLowerCase())
          );
        }
        return String(fieldValue ?? '')
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());
      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some((t) =>
            String(t).toLowerCase().includes(String(condition.value).toLowerCase())
          );
        }
        return !String(fieldValue ?? '')
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in':
        return (
          Array.isArray(condition.value) &&
          condition.value.map((v) => this.norm(v)).includes(this.norm(fieldValue))
        );
      case 'not_in':
        return (
          Array.isArray(condition.value) &&
          !condition.value.map((v) => this.norm(v)).includes(this.norm(fieldValue))
        );
      case 'is_null':
        return fieldValue == null || fieldValue === '' || fieldValue === 0;
      case 'is_not_null':
        return fieldValue != null && fieldValue !== '' && fieldValue !== 0;
      case 'days_since': {
        if (!fieldValue) return false;
        const days = Math.floor(
          (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24)
        );
        return days >= Number(condition.value);
      }
      case 'regex':
        try {
          return new RegExp(condition.value).test(String(fieldValue ?? ''));
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private norm(value: any): any {
    if (typeof value === 'string') return value.trim().toLowerCase();
    return value;
  }

  private getFieldValue(field: string, workItem: WorkItem): any {
    const aliases: Record<string, keyof WorkItem | string> = {
      changedDate: 'updatedDate',
      'System.State': 'state',
      'System.Tags': 'tags',
    };
    const key = (aliases[field] || field) as keyof WorkItem;
    return workItem[key];
  }

  private async checkStatusUpdateRules(
    workItem: WorkItem,
    options: TicketProcessingOptions
  ): Promise<{ applied: number; simulated: number }> {
    let applied = 0;
    let simulated = 0;

    for (const rule of this.config.statusUpdateRules.filter((r) => r.enabled)) {
      try {
        if (workItem.state === rule.targetState) continue;
        if (!this.evaluateConditions(rule.conditions, workItem)) continue;

        if (options.dryRun || (options.canWrite && !options.canWrite(1))) {
          simulated++;
          console.log(
            `[TicketManagement][dry-run] would move #${workItem.id} → "${rule.targetState}" (${rule.name})`
          );
          continue;
        }

        const updated = await adoService.updateWorkItem(workItem.id, {
          state: rule.targetState,
        });
        if (updated) {
          options.onWrite?.(1);
          applied++;
          await adoService.addWorkItemComment(
            workItem.id,
            `Automatically moved from "${workItem.state}" to "${rule.targetState}" based on rule: ${rule.description}`
          );
          options.onWrite?.(1);
          workItem.state = rule.targetState;
        }
      } catch (error) {
        console.error(`[TicketManagement] status rule "${rule.name}" failed:`, error);
      }
    }

    return { applied, simulated };
  }

  private async checkCommentRules(
    workItem: WorkItem,
    options: TicketProcessingOptions
  ): Promise<{ applied: number; simulated: number }> {
    let applied = 0;
    let simulated = 0;

    for (const rule of this.config.commentRules.filter((r) => r.enabled)) {
      try {
        if (!this.evaluateConditions(rule.conditions, workItem)) continue;
        if (!(await this.shouldAddComment(workItem, rule))) continue;

        const comment = this.formatCommentTemplate(rule.commentTemplate, workItem);

        if (options.dryRun || (options.canWrite && !options.canWrite(1))) {
          simulated++;
          console.log(
            `[TicketManagement][dry-run] would comment on #${workItem.id} (${rule.name}): ${comment}`
          );
          continue;
        }

        const success = await adoService.addWorkItemComment(workItem.id, comment);
        if (success) {
          options.onWrite?.(1);
          applied++;
        }
      } catch (error) {
        console.error(`[TicketManagement] comment rule "${rule.name}" failed:`, error);
      }
    }

    return { applied, simulated };
  }

  private async shouldAddComment(
    workItem: WorkItem,
    rule: DeclarativeCommentRule
  ): Promise<boolean> {
    const now = new Date();
    const lastUpdated = new Date(workItem.updatedDate);
    const daysSinceUpdate = Math.floor(
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSinceUpdate >= rule.cooldownDays;
  }

  private formatCommentTemplate(template: string, workItem: WorkItem): string {
    const now = new Date();
    const lastUpdated = new Date(workItem.updatedDate);
    const daysSinceUpdate = Math.floor(
      (now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24)
    );

    return template
      .replace(/\{id\}/g, workItem.id.toString())
      .replace(/\{title\}/g, workItem.title)
      .replace(/\{state\}/g, workItem.state)
      .replace(/\{assignedTo\}/g, workItem.assignedTo || 'Unassigned')
      .replace(/\{effort\}/g, (workItem.effort || 0).toString())
      .replace(/\{daysSinceUpdate\}/g, daysSinceUpdate.toString());
  }

  async runManually(options: TicketProcessingOptions = {}): Promise<TicketProcessingStats> {
    return this.processAllWorkItems(options);
  }

  async getProcessingSummary(): Promise<{
    lastRun: string | null;
    statusUpdatesApplied: number;
    commentsAdded: number;
    pendingUpdates: number;
  }> {
    return {
      lastRun: this.config.lastRunTimestamp
        ? new Date(this.config.lastRunTimestamp).toLocaleString()
        : null,
      statusUpdatesApplied: this.lastStats.statusUpdates,
      commentsAdded: this.lastStats.comments,
      pendingUpdates: this.lastStats.simulated,
    };
  }

  addStatusUpdateRule(rule: Omit<DeclarativeStatusUpdateRule, 'id'>): string {
    const id = `custom_${Date.now()}`;
    this.config.statusUpdateRules.push({ ...rule, id });
    this.saveConfig();
    return id;
  }

  addCommentRule(rule: Omit<DeclarativeCommentRule, 'id'>): string {
    const id = `custom_${Date.now()}`;
    this.config.commentRules.push({ ...rule, id });
    this.saveConfig();
    return id;
  }

  deleteStatusUpdateRule(id: string): boolean {
    const before = this.config.statusUpdateRules.length;
    this.config.statusUpdateRules = this.config.statusUpdateRules.filter((r) => r.id !== id);
    if (this.config.statusUpdateRules.length !== before) {
      this.saveConfig();
      return true;
    }
    return false;
  }

  deleteCommentRule(id: string): boolean {
    const before = this.config.commentRules.length;
    this.config.commentRules = this.config.commentRules.filter((r) => r.id !== id);
    if (this.config.commentRules.length !== before) {
      this.saveConfig();
      return true;
    }
    return false;
  }

  updateStatusUpdateRule(
    id: string,
    updates: Partial<Omit<DeclarativeStatusUpdateRule, 'id'>>
  ): boolean {
    const idx = this.config.statusUpdateRules.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    this.config.statusUpdateRules[idx] = { ...this.config.statusUpdateRules[idx], ...updates };
    this.saveConfig();
    return true;
  }

  updateCommentRule(id: string, updates: Partial<Omit<DeclarativeCommentRule, 'id'>>): boolean {
    const idx = this.config.commentRules.findIndex((r) => r.id === id);
    if (idx < 0) return false;
    this.config.commentRules[idx] = { ...this.config.commentRules[idx], ...updates };
    this.saveConfig();
    return true;
  }
}

export const ticketManagementService = new TicketManagementService();
export default ticketManagementService;
