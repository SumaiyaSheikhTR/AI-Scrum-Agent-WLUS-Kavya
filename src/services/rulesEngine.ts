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
  lastExecuted?: Date;
  executionCount: number;
}

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than' | 'in' | 'not_in' | 'is_null' | 'is_not_null' | 'days_since' | 'regex';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export interface RuleAction {
  type: 'update_status' | 'add_comment' | 'assign_user' | 'add_tag' | 'create_task' | 'send_notification' | 'update_field';
  parameters: Record<string, any>;
}

export interface RuleExecutionResult {
  ruleId: string;
  workItemId: number;
  executed: boolean;
  actions: RuleActionResult[];
  error?: string;
  timestamp: Date;
}

export interface RuleActionResult {
  action: RuleAction;
  success: boolean;
  result?: any;
  error?: string;
}

class RulesEngine {
  private rules: Rule[] = [];
  private isRunning = false;
  private executionInterval: NodeJS.Timeout | null = null;
  private readonly EXECUTION_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly STORAGE_KEY = 'scrum_agent_rules';

  constructor() {
    this.loadRulesFromStorage();
    this.initializeDefaultRules();
  }

  /**
   * Start the rules engine
   */
  public start(): void {
    if (this.isRunning) return;

    console.log('Starting Rules Engine...');
    this.isRunning = true;

    // Initial execution - DISABLED to prevent page refreshing
    console.log('Rules engine initial execution DISABLED to prevent page refreshing');

    // Set up periodic execution - DISABLED to prevent page refreshing
    console.log('Rules engine periodic execution DISABLED to prevent page refreshing');
    
    /* Original rules execution commented out:
    this.executeRules();

    // Set up periodic execution
    this.executionInterval = setInterval(() => {
      this.executeRules();
    }, this.EXECUTION_INTERVAL);
    */
  }

  /**
   * Stop the rules engine
   */
  public stop(): void {
    console.log('Stopping Rules Engine...');
    this.isRunning = false;

    if (this.executionInterval) {
      clearInterval(this.executionInterval);
      this.executionInterval = null;
    }
  }

  /**
   * Add a new rule
   */
  public addRule(rule: Omit<Rule, 'id' | 'lastExecuted' | 'executionCount'>): Rule {
    const newRule: Rule = {
      ...rule,
      id: this.generateRuleId(),
      executionCount: 0
    };

    this.rules.push(newRule);
    this.saveRulesToStorage();
    
    console.log(`Added new rule: ${newRule.name}`);
    return newRule;
  }

  /**
   * Update an existing rule
   */
  public updateRule(ruleId: string, updates: Partial<Rule>): boolean {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    this.rules[ruleIndex] = { ...this.rules[ruleIndex], ...updates };
    this.saveRulesToStorage();
    
    console.log(`Updated rule: ${this.rules[ruleIndex].name}`);
    return true;
  }

  /**
   * Delete a rule
   */
  public deleteRule(ruleId: string): boolean {
    const ruleIndex = this.rules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    const deletedRule = this.rules.splice(ruleIndex, 1)[0];
    this.saveRulesToStorage();
    
    console.log(`Deleted rule: ${deletedRule.name}`);
    return true;
  }

  /**
   * Get all rules
   */
  public getRules(): Rule[] {
    return [...this.rules];
  }

  /**
   * Get a specific rule
   */
  public getRule(ruleId: string): Rule | null {
    return this.rules.find(r => r.id === ruleId) || null;
  }

  /**
   * Execute all enabled rules
   */
  public async executeRules(): Promise<RuleExecutionResult[]> {
    if (!this.isRunning) return [];

    console.log('Executing rules engine...');
    const results: RuleExecutionResult[] = [];

    try {
      // Get all work items
      const workItems = await adoService.getAllWorkItems();
      
      // Execute each enabled rule
      for (const rule of this.rules.filter(r => r.enabled)) {
        try {
          const ruleResults = await this.executeRule(rule, workItems);
          results.push(...ruleResults);
          
          // Update rule execution stats
          rule.lastExecuted = new Date();
          rule.executionCount++;
        } catch (error) {
          console.error(`Error executing rule ${rule.name}:`, error);
          results.push({
            ruleId: rule.id,
            workItemId: -1,
            executed: false,
            actions: [],
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date()
          });
        }
      }

      this.saveRulesToStorage();
      console.log(`Rules execution completed. ${results.length} results.`);
      
    } catch (error) {
      console.error('Error during rules execution:', error);
    }

    return results;
  }

  /**
   * Execute a specific rule against work items
   */
  private async executeRule(rule: Rule, workItems: WorkItem[]): Promise<RuleExecutionResult[]> {
    const results: RuleExecutionResult[] = [];

    for (const workItem of workItems) {
      if (this.evaluateConditions(rule.conditions, workItem)) {
        const actionResults = await this.executeActions(rule.actions, workItem);
        
        results.push({
          ruleId: rule.id,
          workItemId: workItem.id,
          executed: true,
          actions: actionResults,
          timestamp: new Date()
        });
      }
    }

    return results;
  }

  /**
   * Evaluate rule conditions against a work item
   */
  private evaluateConditions(conditions: RuleCondition[], workItem: WorkItem): boolean {
    if (conditions.length === 0) return true;

    let result = this.evaluateCondition(conditions[0], workItem);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = this.evaluateCondition(condition, workItem);
      
      if (condition.logicalOperator === 'OR') {
        result = result || conditionResult;
      } else { // Default to AND
        result = result && conditionResult;
      }
    }

    return result;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(condition: RuleCondition, workItem: WorkItem): boolean {
    const fieldValue = this.getFieldValue(condition.field, workItem);

    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'not_contains':
        return !String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
      case 'greater_than':
        return Number(fieldValue) > Number(condition.value);
      case 'less_than':
        return Number(fieldValue) < Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(fieldValue);
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(fieldValue);
      case 'is_null':
        return fieldValue == null || fieldValue === '';
      case 'is_not_null':
        return fieldValue != null && fieldValue !== '';
      case 'days_since':
        if (!fieldValue) return false;
        const daysSince = Math.floor((Date.now() - new Date(fieldValue).getTime()) / (1000 * 60 * 60 * 24));
        return daysSince >= Number(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(fieldValue));
      default:
        return false;
    }
  }

  /**
   * Get field value from work item
   */
  private getFieldValue(field: string, workItem: WorkItem): any {
    const fieldPath = field.split('.');
    let value: any = workItem;

    for (const path of fieldPath) {
      if (value && typeof value === 'object') {
        value = value[path];
      } else {
        return null;
      }
    }

    return value;
  }

  /**
   * Execute rule actions
   */
  private async executeActions(actions: RuleAction[], workItem: WorkItem): Promise<RuleActionResult[]> {
    const results: RuleActionResult[] = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, workItem);
        results.push({
          action,
          success: true,
          result
        });
      } catch (error) {
        console.error(`Error executing action ${action.type} for work item ${workItem.id}:`, error);
        results.push({
          action,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Execute a single action
   */
  private async executeAction(action: RuleAction, workItem: WorkItem): Promise<any> {
    switch (action.type) {
      case 'update_status':
        return await adoService.updateWorkItem(workItem.id, {
          state: action.parameters.status
        });

      case 'add_comment':
        let comment = action.parameters.comment;
        
        // Use AI to generate contextual comment if needed
        if (action.parameters.useAI) {
          const aiComment = await improvedOpenAiService.generateContextualComment(workItem);
          comment = aiComment || comment;
        }
        
        return await adoService.addComment(workItem.id, comment);

      case 'assign_user':
        return await adoService.updateWorkItem(workItem.id, {
          assignedTo: action.parameters.userId
        });

      case 'add_tag':
        const currentTags = workItem.tags || [];
        const newTags = [...currentTags, action.parameters.tag];
        return await adoService.updateWorkItem(workItem.id, {
          tags: newTags
        });

      case 'update_field':
        return await adoService.updateWorkItem(workItem.id, {
          [action.parameters.field]: action.parameters.value
        });

      case 'create_task':
        return await adoService.createWorkItem({
          type: 'Task',
          title: action.parameters.title,
          description: action.parameters.description,
          assignedTo: action.parameters.assignedTo,
          parentId: workItem.id
        });

      case 'send_notification':
        // This would integrate with notification service
        console.log(`Notification: ${action.parameters.message} for work item ${workItem.id}`);
        return { sent: true, message: action.parameters.message };

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Initialize default rules
   */
  private initializeDefaultRules(): void {
    if (this.rules.length > 0) return; // Already initialized

    const defaultRules: Omit<Rule, 'id' | 'lastExecuted' | 'executionCount'>[] = [
      {
        name: 'Stale In Progress Items',
        description: 'Move items in progress for more than 5 days back to new with a comment',
        conditions: [
          { field: 'state', operator: 'equals', value: 'In Progress' },
          { field: 'changedDate', operator: 'days_since', value: 5 }
        ],
        actions: [
          { type: 'update_status', parameters: { status: 'New' } },
          { type: 'add_comment', parameters: { comment: 'Moved back to New due to inactivity for 5+ days. Please update status or reassign.', useAI: true } }
        ],
        priority: 8,
        enabled: true
      },
      {
        name: 'Ready for Review to Done',
        description: 'Move items in Ready for Review to Done if they have been reviewed',
        conditions: [
          { field: 'state', operator: 'equals', value: 'Ready for Review' },
          { field: 'description', operator: 'contains', value: 'reviewed' }
        ],
        actions: [
          { type: 'update_status', parameters: { status: 'Done' } },
          { type: 'add_comment', parameters: { comment: 'Automatically moved to Done based on review completion.', useAI: false } }
        ],
        priority: 9,
        enabled: true
      },
      {
        name: 'High Priority Unassigned',
        description: 'Add urgent tag and comment to high priority unassigned items',
        conditions: [
          { field: 'priority', operator: 'in', value: ['Critical', 'High'] },
          { field: 'assignedTo', operator: 'is_null', value: null }
        ],
        actions: [
          { type: 'add_tag', parameters: { tag: 'urgent-assignment' } },
          { type: 'add_comment', parameters: { comment: 'High priority item needs assignment urgently.', useAI: true } }
        ],
        priority: 10,
        enabled: true
      },
      {
        name: 'Blocked Items Follow-up',
        description: 'Add follow-up comment to blocked items after 2 days',
        conditions: [
          { field: 'state', operator: 'equals', value: 'Blocked' },
          { field: 'changedDate', operator: 'days_since', value: 2 }
        ],
        actions: [
          { type: 'add_comment', parameters: { comment: 'This item has been blocked for 2+ days. Please update status or escalate.', useAI: true } }
        ],
        priority: 7,
        enabled: true
      },
      {
        name: 'Sprint End Incomplete Items',
        description: 'Move incomplete items back to backlog when sprint ends',
        conditions: [
          { field: 'iterationPath', operator: 'contains', value: 'current' },
          { field: 'state', operator: 'not_in', value: ['Done', 'Closed'] },
          { field: 'sprintEndDate', operator: 'days_since', value: 0 }
        ],
        actions: [
          { type: 'update_field', parameters: { field: 'iterationPath', value: 'Backlog' } },
          { type: 'add_comment', parameters: { comment: 'Moved to backlog - incomplete at sprint end.', useAI: true } }
        ],
        priority: 6,
        enabled: true
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
    console.log('Initialized default rules');
  }

  /**
   * Generate unique rule ID
   */
  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load rules from storage
   */
  private loadRulesFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.rules = JSON.parse(stored);
        console.log(`Loaded ${this.rules.length} rules from storage`);
      }
    } catch (error) {
      console.error('Error loading rules from storage:', error);
      this.rules = [];
    }
  }

  /**
   * Save rules to storage
   */
  private saveRulesToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.rules));
    } catch (error) {
      console.error('Error saving rules to storage:', error);
    }
  }
}

// Export singleton instance
const rulesEngine = new RulesEngine();
export default rulesEngine;
