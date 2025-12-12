/**
 * Ticket Management Service
 * 
 * This service provides functionality for smart ticket management, including:
 * - Automatic status updates based on predefined conditions
 * - Adding contextual comments to work items
 * - Prompting developers for updates on effort estimates and time logs
 */

import adoService, { WorkItem } from './adoService';
import openArenaService from './openArenaService';

// Define interfaces for the service
export interface StatusUpdateRule {
  id: string;
  name: string;
  description: string;
  condition: (workItem: WorkItem) => boolean;
  targetState: string;
  enabled: boolean;
}

export interface CommentRule {
  id: string;
  name: string;
  description: string;
  condition: (workItem: WorkItem) => boolean;
  commentTemplate: string;
  enabled: boolean;
  cooldownDays: number; // Minimum days between comments
}

export interface TicketManagementConfig {
  statusUpdateRules: StatusUpdateRule[];
  commentRules: CommentRule[];
  enableAutoUpdates: boolean;
  updateInterval: number; // in minutes
  lastRunTimestamp: number | null;
}

// Default configuration
const DEFAULT_CONFIG: TicketManagementConfig = {
  statusUpdateRules: [
    {
      id: 'pr_merged_to_qa',
      name: 'PR Merged → Ready for QA',
      description: 'Move work items to "Ready for QA" when PR is merged',
      condition: (workItem: WorkItem) => {
        // Check if the work item has a PR that was merged
        // This is a simplified condition - in a real implementation, we would
        // check for PR status in the work item's links or comments
        return workItem.state === 'In Progress' && 
               workItem.tags.some(tag => 
                 tag.toLowerCase().includes('pr') && 
                 tag.toLowerCase().includes('merged')
               );
      },
      targetState: 'Ready for QA',
      enabled: true
    },
    {
      id: 'stale_active_to_at_risk',
      name: 'Stale Active → At Risk',
      description: 'Flag work items as "At Risk" when they have been in "Active" state for too long',
      condition: (workItem: WorkItem) => {
        // Check if the work item has been in Active state for more than 5 days
        if (workItem.state !== 'Active' && workItem.state !== 'In Progress') {
          return false;
        }
        
        const now = new Date();
        const lastUpdated = new Date(workItem.updatedDate);
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
        
        return daysSinceUpdate >= 5;
      },
      targetState: 'At Risk',
      enabled: true
    },
    {
      id: 'qa_passed_to_ready_for_release',
      name: 'QA Passed → Ready for Release',
      description: 'Move work items to "Ready for Release" when QA is passed',
      condition: (workItem: WorkItem) => {
        // Check if the work item has passed QA
        return workItem.state === 'Ready for QA' && 
               workItem.tags.some(tag => 
                 tag.toLowerCase().includes('qa') && 
                 tag.toLowerCase().includes('passed')
               );
      },
      targetState: 'Ready for Release',
      enabled: true
    }
  ],
  commentRules: [
    {
      id: 'missing_effort',
      name: 'Missing Effort Estimate',
      description: 'Prompt developers to add effort estimates to work items',
      condition: (workItem: WorkItem) => {
        // Check if the work item is missing an effort estimate
        return (workItem.state === 'Active' || workItem.state === 'In Progress') && 
               (workItem.effort === null || workItem.effort === 0);
      },
      commentTemplate: 'This work item is missing an effort estimate. Please update the effort field to help with sprint planning and tracking.',
      enabled: true,
      cooldownDays: 2
    },
    {
      id: 'stale_item',
      name: 'Stale Work Item',
      description: 'Prompt developers to update stale work items',
      condition: (workItem: WorkItem) => {
        // Only consider Active items as stale, not New items
        if (workItem.state !== 'Active') {
          return false;
        }
        
        // Only consider Task type items as stale, not QA, DEV, etc.
        if (workItem.type !== 'Task') {
          return false;
        }
        
        // Check if the work item has not been updated recently
        const now = new Date();
        const lastUpdated = new Date(workItem.updatedDate);
        const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
        
        return daysSinceUpdate >= 3;
      },
      commentTemplate: 'This work item has not been updated in {daysSinceUpdate} days. Please provide a status update or move it to the appropriate state.',
      enabled: true,
      cooldownDays: 3
    },
    {
      id: 'high_effort_clarification',
      name: 'High Effort Clarification',
      description: 'Ask for clarification on high-effort items',
      condition: (workItem: WorkItem) => {
        // Check if the work item has a high effort estimate
        return (workItem.effort !== null && workItem.effort > 13);
      },
      commentTemplate: 'This work item has a high effort estimate ({effort} points). Consider breaking it down into smaller tasks or provide more details on why this requires significant effort.',
      enabled: true,
      cooldownDays: 5
    }
  ],
  enableAutoUpdates: true,
  updateInterval: 60, // Check every 60 minutes
  lastRunTimestamp: null
};

class TicketManagementService {
  private config: TicketManagementConfig;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Load config from localStorage or use defaults
    this.config = this.loadConfig() || DEFAULT_CONFIG;
    
    // Timer initialization DISABLED to prevent page refreshing
    console.log('Ticket management timer initialization DISABLED to prevent page refreshing');
    
    /* Original timer initialization commented out:
    // Start the update timer if auto-updates are enabled
    if (this.config.enableAutoUpdates) {
      this.startUpdateTimer();
    }
    */
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): TicketManagementConfig | null {
    try {
      const configStr = localStorage.getItem('ticketManagementConfig');
      if (configStr) {
        return JSON.parse(configStr);
      }
      return null;
    } catch (error) {
      console.error('Error loading ticket management config:', error);
      return null;
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('ticketManagementConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving ticket management config:', error);
    }
  }

  /**
   * Start the timer for automatic updates
   */
  private startUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    const intervalMs = this.config.updateInterval * 60 * 1000; // Convert minutes to milliseconds
    
    // Auto-update timer DISABLED to prevent page refreshing
    console.log('Ticket management auto-update timer DISABLED to prevent page refreshing');
    
    /* Original auto-update timer commented out:
    this.updateTimer = setInterval(() => {
      this.processAllWorkItems();
    }, intervalMs);
    
    console.log(`Ticket management auto-updates started. Checking every ${this.config.updateInterval} minutes.`);
    */
  }

  /**
   * Stop the timer for automatic updates
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      console.log('Ticket management auto-updates stopped.');
    }
  }

  /**
   * Update the configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<TicketManagementConfig>): void {
    const wasAutoUpdateEnabled = this.config.enableAutoUpdates;
    
    // Update config
    this.config = { ...this.config, ...config };
    
    // Save to localStorage
    this.saveConfig();
    
    // Handle auto-update timer changes
    if (!wasAutoUpdateEnabled && this.config.enableAutoUpdates) {
      this.startUpdateTimer();
    } else if (wasAutoUpdateEnabled && !this.config.enableAutoUpdates) {
      this.stopUpdateTimer();
    } else if (wasAutoUpdateEnabled && this.config.enableAutoUpdates) {
      // Restart timer with new interval
      this.startUpdateTimer();
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): TicketManagementConfig {
    return { ...this.config };
  }

  /**
   * Process all work items in the current sprint
   */
  async processAllWorkItems(): Promise<void> {
    try {
      // Update last run timestamp
      this.config.lastRunTimestamp = Date.now();
      this.saveConfig();
      
      // Get current sprint
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        console.log('No active sprint found. Skipping ticket management processing.');
        return;
      }
      
      // Get work items for the current sprint
      const workItems = await adoService.getSprintWorkItems(currentSprint.id);
      
      // Process each work item
      for (const workItem of workItems) {
        await this.processWorkItem(workItem);
      }
      
      console.log(`Processed ${workItems.length} work items for ticket management.`);
    } catch (error) {
      console.error('Error processing work items for ticket management:', error);
    }
  }

  /**
   * Process a single work item
   * @param workItem The work item to process
   */
  async processWorkItem(workItem: WorkItem): Promise<void> {
    try {
      // Check status update rules
      await this.checkStatusUpdateRules(workItem);
      
      // Check comment rules
      await this.checkCommentRules(workItem);
    } catch (error) {
      console.error(`Error processing work item ${workItem.id}:`, error);
    }
  }

  /**
   * Check status update rules for a work item
   * @param workItem The work item to check
   */
  private async checkStatusUpdateRules(workItem: WorkItem): Promise<void> {
    // Only process enabled rules
    const enabledRules = this.config.statusUpdateRules.filter(rule => rule.enabled);
    
    for (const rule of enabledRules) {
      try {
        // Skip if the work item is already in the target state
        if (workItem.state === rule.targetState) {
          continue;
        }
        
        // Check if the rule condition is met
        if (rule.condition(workItem)) {
          // Update the work item state
          const updatedWorkItem = await adoService.updateWorkItem(workItem.id, {
            'System.State': rule.targetState
          });
          
          if (updatedWorkItem) {
            console.log(`Updated work item ${workItem.id} state from "${workItem.state}" to "${rule.targetState}" based on rule "${rule.name}"`);
            
            // Add a comment explaining the automatic update
            await adoService.addWorkItemComment(
              workItem.id,
              `Automatically moved from "${workItem.state}" to "${rule.targetState}" based on rule: ${rule.description}`
            );
          }
        }
      } catch (error) {
        console.error(`Error applying status update rule "${rule.name}" to work item ${workItem.id}:`, error);
      }
    }
  }

  /**
   * Check comment rules for a work item
   * @param workItem The work item to check
   */
  private async checkCommentRules(workItem: WorkItem): Promise<void> {
    // Only process enabled rules
    const enabledRules = this.config.commentRules.filter(rule => rule.enabled);
    
    for (const rule of enabledRules) {
      try {
        // Check if the rule condition is met
        if (rule.condition(workItem)) {
          // Check if we've already commented recently (respect cooldown)
          const shouldComment = await this.shouldAddComment(workItem, rule);
          
          if (shouldComment) {
            // Format the comment template with work item data
            const comment = this.formatCommentTemplate(rule.commentTemplate, workItem);
            
            // Add the comment
            const success = await adoService.addWorkItemComment(workItem.id, comment);
            
            if (success) {
              console.log(`Added comment to work item ${workItem.id} based on rule "${rule.name}"`);
            }
          }
        }
      } catch (error) {
        console.error(`Error applying comment rule "${rule.name}" to work item ${workItem.id}:`, error);
      }
    }
  }

  /**
   * Check if we should add a comment based on cooldown period
   * @param workItem The work item to check
   * @param rule The comment rule
   */
  private async shouldAddComment(workItem: WorkItem, rule: CommentRule): Promise<boolean> {
    // In a real implementation, we would check the work item's comment history
    // to see if we've already added a similar comment recently
    
    // For now, we'll use a simplified approach based on the last updated date
    const now = new Date();
    const lastUpdated = new Date(workItem.updatedDate);
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    
    // Only comment if the item hasn't been updated in the cooldown period
    return daysSinceUpdate >= rule.cooldownDays;
  }

  /**
   * Format a comment template with work item data
   * @param template The comment template
   * @param workItem The work item data
   */
  private formatCommentTemplate(template: string, workItem: WorkItem): string {
    // Replace placeholders with actual values
    let formattedComment = template;
    
    // Calculate days since update
    const now = new Date();
    const lastUpdated = new Date(workItem.updatedDate);
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    
    // Replace placeholders
    formattedComment = formattedComment.replace('{id}', workItem.id.toString());
    formattedComment = formattedComment.replace('{title}', workItem.title);
    formattedComment = formattedComment.replace('{state}', workItem.state);
    formattedComment = formattedComment.replace('{assignedTo}', workItem.assignedTo || 'Unassigned');
    formattedComment = formattedComment.replace('{effort}', (workItem.effort || 0).toString());
    formattedComment = formattedComment.replace('{daysSinceUpdate}', daysSinceUpdate.toString());
    
    return formattedComment;
  }

  /**
   * Run the ticket management process manually
   */
  async runManually(): Promise<void> {
    console.log('Running ticket management process manually...');
    await this.processAllWorkItems();
    console.log('Manual ticket management process completed.');
  }

  /**
   * Get a summary of the ticket management process
   */
  async getProcessingSummary(): Promise<{
    lastRun: string | null;
    statusUpdatesApplied: number;
    commentsAdded: number;
    pendingUpdates: number;
  }> {
    // In a real implementation, we would track these metrics
    // For now, we'll return placeholder data
    return {
      lastRun: this.config.lastRunTimestamp ? new Date(this.config.lastRunTimestamp).toLocaleString() : null,
      statusUpdatesApplied: 0,
      commentsAdded: 0,
      pendingUpdates: 0
    };
  }

  /**
   * Add a custom status update rule
   * @param rule The rule to add
   */
  addStatusUpdateRule(rule: Omit<StatusUpdateRule, 'id'>): string {
    const id = `custom_${Date.now()}`;
    const newRule: StatusUpdateRule = {
      ...rule,
      id
    };
    
    this.config.statusUpdateRules.push(newRule);
    this.saveConfig();
    
    return id;
  }

  /**
   * Add a custom comment rule
   * @param rule The rule to add
   */
  addCommentRule(rule: Omit<CommentRule, 'id'>): string {
    const id = `custom_${Date.now()}`;
    const newRule: CommentRule = {
      ...rule,
      id
    };
    
    this.config.commentRules.push(newRule);
    this.saveConfig();
    
    return id;
  }

  /**
   * Delete a status update rule
   * @param id The ID of the rule to delete
   */
  deleteStatusUpdateRule(id: string): boolean {
    const initialLength = this.config.statusUpdateRules.length;
    this.config.statusUpdateRules = this.config.statusUpdateRules.filter(rule => rule.id !== id);
    
    if (this.config.statusUpdateRules.length !== initialLength) {
      this.saveConfig();
      return true;
    }
    
    return false;
  }

  /**
   * Delete a comment rule
   * @param id The ID of the rule to delete
   */
  deleteCommentRule(id: string): boolean {
    const initialLength = this.config.commentRules.length;
    this.config.commentRules = this.config.commentRules.filter(rule => rule.id !== id);
    
    if (this.config.commentRules.length !== initialLength) {
      this.saveConfig();
      return true;
    }
    
    return false;
  }

  /**
   * Update a status update rule
   * @param id The ID of the rule to update
   * @param updates The updates to apply
   */
  updateStatusUpdateRule(id: string, updates: Partial<Omit<StatusUpdateRule, 'id'>>): boolean {
    const ruleIndex = this.config.statusUpdateRules.findIndex(rule => rule.id === id);
    
    if (ruleIndex >= 0) {
      this.config.statusUpdateRules[ruleIndex] = {
        ...this.config.statusUpdateRules[ruleIndex],
        ...updates
      };
      
      this.saveConfig();
      return true;
    }
    
    return false;
  }

  /**
   * Update a comment rule
   * @param id The ID of the rule to update
   * @param updates The updates to apply
   */
  updateCommentRule(id: string, updates: Partial<Omit<CommentRule, 'id'>>): boolean {
    const ruleIndex = this.config.commentRules.findIndex(rule => rule.id === id);
    
    if (ruleIndex >= 0) {
      this.config.commentRules[ruleIndex] = {
        ...this.config.commentRules[ruleIndex],
        ...updates
      };
      
      this.saveConfig();
      return true;
    }
    
    return false;
  }
}

// Export a singleton instance
export const ticketManagementService = new TicketManagementService();

export default ticketManagementService;
