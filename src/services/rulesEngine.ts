import adoService, { WorkItem } from './adoService';
import improvedOpenAiService from './improvedOpenAiService';

export interface Rule {
  id: string;
  name: string;
  description: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
  priority: number;
  enabled: boolean;
  lastExecuted?: Date | string;
  executionCount: number;
}

export interface RuleCondition {
  field: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'not_contains'
    | 'greater_than'
    | 'less_than'
    | 'in'
    | 'not_in'
    | 'is_null'
    | 'is_not_null'
    | 'days_since'
    | 'regex';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface RuleAction {
  type:
    | 'update_status'
    | 'add_comment'
    | 'assign_user'
    | 'add_tag'
    | 'create_task'
    | 'send_notification'
    | 'update_field';
  parameters: Record<string, any>;
}

export interface RuleExecutionResult {
  ruleId: string;
  ruleName?: string;
  workItemId: number;
  executed: boolean;
  actions: RuleActionResult[];
  error?: string;
  timestamp: Date;
  dryRun?: boolean;
}

export interface RuleActionResult {
  action: RuleAction;
  success: boolean;
  simulated?: boolean;
  result?: any;
  error?: string;
}

export interface RulesExecutionSummary {
  workItemsScanned: number;
  matched: number;
  actionsApplied: number;
  actionsSimulated: number;
  results: RuleExecutionResult[];
}

export interface RulesExecutionOptions {
  dryRun?: boolean;
  canWrite?: (count: number) => boolean;
  onWrite?: (count: number) => void;
}

class RulesEngine {
  private rules: Rule[] = [];
  private isRunning = false;
  private orchestratedMode = false;
  private executionInterval: ReturnType<typeof setInterval> | null = null;
  private readonly EXECUTION_INTERVAL = 15 * 60 * 1000;
  private readonly STORAGE_KEY = 'scrum_agent_rules';

  constructor() {
    this.loadRulesFromStorage();
    this.initializeDefaultRules();
  }

  public setOrchestratedMode(enabled: boolean): void {
    this.orchestratedMode = enabled;
    if (enabled) {
      this.stopInternalTimer();
    }
  }

  /**
   * Legacy start — only used when not under the orchestrator.
   */
  public start(): void {
    if (this.orchestratedMode) {
      this.isRunning = true;
      console.log('[RulesEngine] running under AutomationOrchestrator');
      return;
    }

    if (this.isRunning) return;
    console.log('[RulesEngine] starting standalone mode');
    this.isRunning = true;
    void this.executeRules();
    this.executionInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void this.executeRules();
    }, this.EXECUTION_INTERVAL);
  }

  public stop(): void {
    this.isRunning = false;
    this.stopInternalTimer();
  }

  private stopInternalTimer(): void {
    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
  }

  public addRule(rule: Omit<Rule, 'id' | 'lastExecuted' | 'executionCount'>): Rule {
    const newRule: Rule = {
      ...rule,
      id: this.generateRuleId(),
      executionCount: 0,
    };
    this.rules.push(newRule);
    this.saveRulesToStorage();
    return newRule;
  }

  public updateRule(ruleId: string, updates: Partial<Rule>): boolean {
    const ruleIndex = this.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return false;
    this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    this.saveRulesToStorage();
    return true;
  }

  public deleteRule(ruleId: string): boolean {
    const ruleIndex = this.rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return false;
    this.rules.splice(ruleIndex, 1);
    this.saveRulesToStorage();
    return true;
  }

  public getRules(): Rule[] {
    return [...this.rules].sort((a, b) => b.priority - a.priority);
  }

  public getRule(ruleId: string): Rule | null {
    return this.rules.find((r) => r.id === ruleId) || null;
  }

  public async executeRules(options: RulesExecutionOptions = {}): Promise<RulesExecutionSummary> {
    const dryRun = !!options.dryRun;
    const results: RuleExecutionResult[] = [];
    let matched = 0;
    let actionsApplied = 0;
    let actionsSimulated = 0;
    let workItemsScanned = 0;

    try {
      const workItems = await adoService.getAllWorkItems();
      workItemsScanned = workItems.length;

      const enabledRules = this.rules
        .filter((r) => r.enabled)
        .sort((a, b) => b.priority - a.priority);

      for (const rule of enabledRules) {
        try {
          const ruleResults = await this.executeRule(rule, workItems, options);
          results.push(...ruleResults);
          matched += ruleResults.length;

          for (const r of ruleResults) {
            for (const a of r.actions) {
              if (a.simulated) actionsSimulated++;
              else if (a.success) actionsApplied++;
            }
          }

          rule.lastExecuted = new Date();
          rule.executionCount++;
        } catch (error) {
          results.push({
            ruleId: rule.id,
            ruleName: rule.name,
            workItemId: -1,
            executed: false,
            actions: [],
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date(),
            dryRun,
          });
        }
      }

      this.saveRulesToStorage();
    } catch (error) {
      console.error('[RulesEngine] execution error:', error);
      throw error;
    }

    return { workItemsScanned, matched, actionsApplied, actionsSimulated, results };
  }

  private async executeRule(
    rule: Rule,
    workItems: WorkItem[],
    options: RulesExecutionOptions
  ): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    for (const workItem of workItems) {
      if (!this.evaluateConditions(rule.conditions, workItem)) continue;

      const actionResults = await this.executeActions(rule.actions, workItem, options);
      results.push({
        ruleId: rule.id,
        ruleName: rule.name,
        workItemId: workItem.id,
        executed: true,
        actions: actionResults,
        timestamp: new Date(),
        dryRun: !!options.dryRun,
      });
    }

    return results;
  }

  public evaluateConditions(conditions: RuleCondition[], workItem: WorkItem): boolean {
    if (conditions.length === 0) return true;

    let result = this.evaluateCondition(conditions[0], workItem);
    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, workItem);
      if (condition.logicalOperator === 'OR') {
        result = result || conditionResult;
      } else {
        result = result && conditionResult;
      }
    }
    return result;
  }

  private evaluateCondition(condition: RuleCondition, workItem: WorkItem): boolean {
    const fieldValue = this.getFieldValue(condition.field, workItem);

    switch (condition.operator) {
      case 'equals':
        return this.normalize(fieldValue) === this.normalize(condition.value);
      case 'not_equals':
        return this.normalize(fieldValue) !== this.normalize(condition.value);
      case 'contains':
        if (Array.isArray(fieldValue)) {
          return fieldValue.some((item) =>
            String(item).toLowerCase().includes(String(condition.value).toLowerCase())
          );
        }
        return String(fieldValue ?? '')
          .toLowerCase()
          .includes(String(condition.value).toLowerCase());
      case 'not_contains':
        if (Array.isArray(fieldValue)) {
          return !fieldValue.some((item) =>
            String(item).toLowerCase().includes(String(condition.value).toLowerCase())
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
          condition.value.map((v) => this.normalize(v)).includes(this.normalize(fieldValue))
        );
      case 'not_in':
        return (
          Array.isArray(condition.value) &&
          !condition.value.map((v) => this.normalize(v)).includes(this.normalize(fieldValue))
        );
      case 'is_null':
        return fieldValue == null || fieldValue === '';
      case 'is_not_null':
        return fieldValue != null && fieldValue !== '';
      case 'days_since': {
        if (!fieldValue) return false;
        const daysSince = Math.floor(
          (Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24)
        );
        return daysSince >= Number(condition.value);
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

  private normalize(value: any): any {
    if (typeof value === 'string') return value.trim().toLowerCase();
    return value;
  }

  private getFieldValue(field: string, workItem: WorkItem): any {
    // Map common aliases used by default rules / UI
    const aliases: Record<string, string> = {
      changedDate: 'updatedDate',
      changeddate: 'updatedDate',
      System_State: 'state',
      'System.State': 'state',
      'System.AssignedTo': 'assignedTo',
      'System.Tags': 'tags',
      'System.ChangedDate': 'updatedDate',
    };

    const resolved = aliases[field] || field;
    const fieldPath = resolved.split('.');
    let value: any = workItem;

    for (const path of fieldPath) {
      if (value && typeof value === 'object') {
        value = (value as any)[path];
      } else {
        return null;
      }
    }

    // assignedTo may be an object in some code paths
    if (resolved === 'assignedTo' && value && typeof value === 'object') {
      return value.displayName || value.uniqueName || value.email || '';
    }

    return value;
  }

  private async executeActions(
    actions: RuleAction[],
    workItem: WorkItem,
    options: RulesExecutionOptions
  ): Promise<RuleActionResult[]> {
    const results: RuleActionResult[] = [];
    for (const action of actions) {
      try {
        const result = await this.executeAction(action, workItem, options);
        results.push(result);
      } catch (error) {
        results.push({
          action,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
    return results;
  }

  private isWriteAction(type: RuleAction['type']): boolean {
    return ['update_status', 'add_comment', 'assign_user', 'add_tag', 'create_task', 'update_field'].includes(
      type
    );
  }

  private async executeAction(
    action: RuleAction,
    workItem: WorkItem,
    options: RulesExecutionOptions
  ): Promise<RuleActionResult> {
    const dryRun = !!options.dryRun;
    const isWrite = this.isWriteAction(action.type);

    if (isWrite && (dryRun || (options.canWrite && !options.canWrite(1)))) {
      return {
        action,
        success: true,
        simulated: true,
        result: { simulated: true, reason: dryRun ? 'dry-run' : 'write-limit' },
      };
    }

    switch (action.type) {
      case 'update_status': {
        const result = await adoService.updateWorkItem(workItem.id, {
          state: action.parameters.status,
        });
        options.onWrite?.(1);
        return { action, success: !!result, result };
      }
      case 'add_comment': {
        let comment = action.parameters.comment;
        if (action.parameters.useAI) {
          const aiComment = await improvedOpenAiService.generateContextualComment(workItem);
          comment = aiComment || comment;
        }
        const result = await adoService.addComment(workItem.id, comment);
        options.onWrite?.(1);
        return { action, success: true, result };
      }
      case 'assign_user': {
        const result = await adoService.updateWorkItem(workItem.id, {
          assignedTo: action.parameters.userId,
        });
        options.onWrite?.(1);
        return { action, success: !!result, result };
      }
      case 'add_tag': {
        const currentTags = workItem.tags || [];
        const tag = action.parameters.tag;
        if (currentTags.includes(tag)) {
          return { action, success: true, result: { skipped: true, reason: 'tag-exists' } };
        }
        const result = await adoService.updateWorkItem(workItem.id, {
          tags: [...currentTags, tag].join('; '),
        });
        options.onWrite?.(1);
        return { action, success: !!result, result };
      }
      case 'update_field': {
        const result = await adoService.updateWorkItem(workItem.id, {
          [action.parameters.field]: action.parameters.value,
        });
        options.onWrite?.(1);
        return { action, success: !!result, result };
      }
      case 'create_task': {
        const title = (action.parameters.title || '').trim();
        if (!title) {
          throw new Error('create_task requires a non-empty "title" parameter');
        }
        const result = await adoService.createWorkItem({
          type: action.parameters.workItemType || 'Task',
          title,
          description: action.parameters.description,
          assignedTo: action.parameters.assignedTo,
          parentId: workItem.id,
        });
        options.onWrite?.(1);
        return { action, success: !!result, result };
      }
      case 'send_notification':
        console.log(`[RulesEngine] notification: ${action.parameters.message} (WI ${workItem.id})`);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('automation:alert', {
              detail: {
                title: 'Rules Engine Notification',
                message: action.parameters.message,
                workItemId: workItem.id,
              },
            })
          );
        }
        return { action, success: true, result: { sent: true } };
      default:
        throw new Error(`Unknown action type: ${(action as RuleAction).type}`);
    }
  }

  private initializeDefaultRules(): void {
    if (this.rules.length > 0) return;

    const defaultRules: Omit<Rule, 'id' | 'lastExecuted' | 'executionCount'>[] = [
      {
        name: 'Stale In Progress Items',
        description: 'Comment on items in progress with no updates for 5+ days',
        conditions: [
          { field: 'state', operator: 'equals', value: 'In Progress' },
          { field: 'updatedDate', operator: 'days_since', value: 5, logicalOperator: 'AND' },
        ],
        actions: [
          {
            type: 'add_comment',
            parameters: {
              comment:
                'This item has been In Progress without updates for 5+ days. Please update status, add a comment, or reassign.',
              useAI: true,
            },
          },
          { type: 'add_tag', parameters: { tag: 'needs-update' } },
        ],
        priority: 8,
        enabled: true,
      },
      {
        name: 'High Priority Unassigned',
        description: 'Flag high/critical priority unassigned items',
        conditions: [
          { field: 'priority', operator: 'in', value: [1, 2, 'Critical', 'High', '1', '2'] },
          { field: 'assignedTo', operator: 'is_null', value: null, logicalOperator: 'AND' },
        ],
        actions: [
          { type: 'add_tag', parameters: { tag: 'urgent-assignment' } },
          {
            type: 'add_comment',
            parameters: {
              comment: 'High priority item needs assignment urgently.',
              useAI: true,
            },
          },
          {
            type: 'send_notification',
            parameters: { message: 'High priority work item is unassigned' },
          },
        ],
        priority: 10,
        enabled: true,
      },
      {
        name: 'Blocked Items Follow-up',
        description: 'Follow up on blocked items after 2 days of inactivity',
        conditions: [
          { field: 'state', operator: 'equals', value: 'Blocked' },
          { field: 'updatedDate', operator: 'days_since', value: 2, logicalOperator: 'AND' },
        ],
        actions: [
          {
            type: 'add_comment',
            parameters: {
              comment:
                'This item has been blocked for 2+ days. Please update status, unblock, or escalate.',
              useAI: true,
            },
          },
        ],
        priority: 7,
        enabled: true,
      },
      {
        name: 'Missing Effort on Active Work',
        description: 'Prompt for effort estimates on active tasks without estimates',
        conditions: [
          { field: 'state', operator: 'in', value: ['Active', 'In Progress'] },
          { field: 'type', operator: 'equals', value: 'Task', logicalOperator: 'AND' },
          { field: 'effort', operator: 'is_null', value: null, logicalOperator: 'AND' },
        ],
        actions: [
          {
            type: 'add_comment',
            parameters: {
              comment:
                'This active task is missing an effort estimate. Please update Effort to improve capacity planning.',
              useAI: false,
            },
          },
        ],
        priority: 5,
        enabled: true,
      },
    ];

    defaultRules.forEach((rule) => this.addRule(rule));
  }

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  private loadRulesFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.rules = JSON.parse(stored);
      }
    } catch (error) {
      console.error('[RulesEngine] load error:', error);
      this.rules = [];
    }
  }

  private saveRulesToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.rules));
    } catch (error) {
      console.error('[RulesEngine] save error:', error);
    }
  }
}

const rulesEngine = new RulesEngine();
export default rulesEngine;
