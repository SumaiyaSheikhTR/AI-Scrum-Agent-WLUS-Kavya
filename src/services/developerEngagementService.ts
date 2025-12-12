/**
 * Developer Engagement Service
 * 
 * This service provides functionality for monitoring developer engagement and sentiment:
 * - Tracking developer activity on work items
 * - Sending reminders for stale tickets
 * - Analyzing comment sentiment and engagement patterns
 * - Providing insights on developer productivity and engagement
 */

import adoService, { WorkItem } from './adoService';
import openArenaService from './openArenaService';
import ticketManagementService from './ticketManagementService';
import sentimentAnalysisService, { CommentData, SentimentAnalysisResult } from './sentimentAnalysisService';
import teamsNotificationService from './teamsNotificationService';

// Define interfaces for the service
export interface DeveloperEngagementConfig {
  enableReminders: boolean;
  reminderThresholdDays: number; // Days before sending a reminder
  enableSentimentAnalysis: boolean;
  trackingEnabled: boolean;
  reminderCooldownDays: number; // Minimum days between reminders
  reminderTemplates: ReminderTemplate[];
  lastRunTimestamp: number | null;
  updateInterval: number; // in minutes
  teamsNotifications: {
    enabled: boolean;
    sendToTeams: boolean; // Whether to send reminders to Teams
    sendToAdo: boolean; // Whether to send reminders to ADO
  };
}

export interface ReminderTemplate {
  id: string;
  name: string;
  condition: string; // 'stale', 'blocked', 'high_effort', 'missing_info'
  messageTemplate: string;
  enabled: boolean;
}

export interface DeveloperActivity {
  developerId: string;
  developerName: string;
  lastActive: string;
  workItemsAssigned: number;
  workItemsCompleted: number;
  averageCompletionTime: number; // in days
  commentCount: number;
  averageResponseTime: number; // in hours
  sentimentScores: SentimentScores;
  staleItemCount: number;
  engagementScore: number; // 0-100
}

export interface SentimentScores {
  positive: number;
  neutral: number;
  negative: number;
  frustrated: number;
  averageScore: number; // -1 to 1 where -1 is very negative, 1 is very positive
}

export interface WorkItemEngagement {
  workItemId: number;
  title: string;
  assignedTo: string | null;
  state: string;
  type: string;
  daysSinceLastUpdate: number;
  commentCount: number;
  lastCommentDate: string | null;
  lastCommentSentiment: string | null;
  remindersSent: number;
  lastReminderDate: string | null;
}

// Default configuration
const DEFAULT_CONFIG: DeveloperEngagementConfig = {
  enableReminders: true,
  reminderThresholdDays: 3,
  enableSentimentAnalysis: true,
  trackingEnabled: true,
  reminderCooldownDays: 2,
  reminderTemplates: [
    {
      id: 'stale_item_reminder',
      name: 'Stale Item Reminder',
      condition: 'stale',
      messageTemplate: 'Hi {assignee}, this work item has not been updated in {daysSinceUpdate} days. Could you please provide a status update or move it to the appropriate state?',
      enabled: true
    },
    {
      id: 'blocked_item_reminder',
      name: 'Blocked Item Reminder',
      condition: 'blocked',
      messageTemplate: 'Hi {assignee}, this work item has been blocked for {daysSinceBlocked} days. Is there anything the team can do to help unblock this item?',
      enabled: true
    },
    {
      id: 'high_effort_reminder',
      name: 'High Effort Item Check-in',
      condition: 'high_effort',
      messageTemplate: 'Hi {assignee}, this high-effort item ({effort} points) has been in progress for {daysInProgress} days. Do you need any assistance or would it help to break this down into smaller tasks?',
      enabled: true
    },
    {
      id: 'missing_info_reminder',
      name: 'Missing Information Reminder',
      condition: 'missing_info',
      messageTemplate: 'Hi {assignee}, this work item is missing important information (effort estimate, acceptance criteria, or description). Could you please update it with the necessary details?',
      enabled: true
    }
  ],
  lastRunTimestamp: null,
  updateInterval: 120, // Check every 2 hours
  teamsNotifications: {
    enabled: false,
    sendToTeams: false,
    sendToAdo: true
  }
};

// Developer engagement data store
interface DeveloperEngagementStore {
  developerActivities: Record<string, DeveloperActivity>;
  workItemEngagements: Record<number, WorkItemEngagement>;
  sentimentHistory: Array<{
    date: string;
    developerId: string;
    developerName: string;
    workItemId: number;
    sentiment: string;
    comment: string;
  }>;
  reminderHistory: Array<{
    date: string;
    workItemId: number;
    developerId: string;
    reminderType: string;
    message: string;
  }>;
}

class DeveloperEngagementService {
  private config: DeveloperEngagementConfig;
  private store: DeveloperEngagementStore;
  private updateTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Load config and store from localStorage or use defaults
    this.config = this.loadConfig() || DEFAULT_CONFIG;
    this.store = this.loadStore() || {
      developerActivities: {},
      workItemEngagements: {},
      sentimentHistory: [],
      reminderHistory: []
    };
    
    // Start the update timer if tracking is enabled
    if (this.config.trackingEnabled) {
      this.startUpdateTimer();
    }
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): DeveloperEngagementConfig | null {
    try {
      const configStr = localStorage.getItem('developerEngagementConfig');
      if (configStr) {
        return JSON.parse(configStr);
      }
      return null;
    } catch (error) {
      console.error('Error loading developer engagement config:', error);
      return null;
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('developerEngagementConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving developer engagement config:', error);
    }
  }

  /**
   * Load store from localStorage
   */
  private loadStore(): DeveloperEngagementStore | null {
    try {
      const storeStr = localStorage.getItem('developerEngagementStore');
      if (storeStr) {
        return JSON.parse(storeStr);
      }
      return null;
    } catch (error) {
      console.error('Error loading developer engagement store:', error);
      return null;
    }
  }

  /**
   * Save store to localStorage
   */
  private saveStore(): void {
    try {
      localStorage.setItem('developerEngagementStore', JSON.stringify(this.store));
    } catch (error) {
      console.error('Error saving developer engagement store:', error);
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
    
    // Developer engagement tracking timer DISABLED to prevent page refreshing
    console.log('Developer engagement tracking timer DISABLED to prevent page refreshing');
    
    /* Original engagement tracking timer commented out:
    this.updateTimer = setInterval(() => {
      this.processEngagementTracking();
    }, intervalMs);

    console.log(`Developer engagement tracking started. Checking every ${this.config.updateInterval} minutes.`);
    */
  }

  /**
   * Stop the timer for automatic updates
   */
  private stopUpdateTimer(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
      console.log('Developer engagement tracking stopped.');
    }
  }

  /**
   * Update the configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<DeveloperEngagementConfig>): void {
    const wasTrackingEnabled = this.config.trackingEnabled;
    
    // Update config
    this.config = { ...this.config, ...config };
    
    // Save to localStorage
    this.saveConfig();
    
    // Handle tracking timer changes
    if (!wasTrackingEnabled && this.config.trackingEnabled) {
      this.startUpdateTimer();
    } else if (wasTrackingEnabled && !this.config.trackingEnabled) {
      this.stopUpdateTimer();
    } else if (wasTrackingEnabled && this.config.trackingEnabled) {
      // Restart timer with new interval
      this.startUpdateTimer();
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): DeveloperEngagementConfig {
    return { ...this.config };
  }

  /**
   * Process engagement tracking for all work items
   */
  async processEngagementTracking(): Promise<void> {
    try {
      // Update last run timestamp
      this.config.lastRunTimestamp = Date.now();
      this.saveConfig();
      
      // Get current sprint
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        console.log('No active sprint found. Skipping engagement tracking.');
        return;
      }
      
      // Get work items for the current sprint
      const workItems = await adoService.getSprintWorkItems(currentSprint.id);
      
      // Process each work item for engagement tracking
      for (const workItem of workItems) {
        await this.trackWorkItemEngagement(workItem);
      }
      
      // Update developer activity metrics
      await this.updateDeveloperActivityMetrics(workItems);
      
      // Send reminders if enabled
      if (this.config.enableReminders) {
        await this.sendReminders(workItems);
      }
      
      // Save updated store
      this.saveStore();
      
      console.log(`Processed ${workItems.length} work items for engagement tracking.`);
    } catch (error) {
      console.error('Error processing engagement tracking:', error);
    }
  }

  /**
   * Track engagement for a single work item
   * @param workItem The work item to track
   */
  private async trackWorkItemEngagement(workItem: WorkItem): Promise<void> {
    try {
      const now = new Date();
      const lastUpdated = new Date(workItem.updatedDate);
      const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      
      // Get or create work item engagement record
      let workItemEngagement = this.store.workItemEngagements[workItem.id] || {
        workItemId: workItem.id,
        title: workItem.title,
        assignedTo: workItem.assignedTo,
        state: workItem.state,
        type: workItem.type,
        daysSinceLastUpdate: daysSinceUpdate,
        commentCount: 0,
        lastCommentDate: null,
        lastCommentSentiment: null,
        remindersSent: 0,
        lastReminderDate: null
      };
      
      // Update basic info
      workItemEngagement.title = workItem.title;
      workItemEngagement.assignedTo = workItem.assignedTo;
      workItemEngagement.state = workItem.state;
      workItemEngagement.type = workItem.type;
      workItemEngagement.daysSinceLastUpdate = daysSinceUpdate;
      
      // TODO: In a real implementation, we would fetch the work item's comments
      // and analyze them for sentiment. For now, we'll use a simplified approach.
      
      // Store the updated engagement record
      this.store.workItemEngagements[workItem.id] = workItemEngagement;
    } catch (error) {
      console.error(`Error tracking engagement for work item ${workItem.id}:`, error);
    }
  }

  /**
   * Update developer activity metrics based on work items
   * @param workItems The work items to analyze
   */
  private async updateDeveloperActivityMetrics(workItems: WorkItem[]): Promise<void> {
    try {
      // Group work items by developer
      const developerWorkItems: Record<string, WorkItem[]> = {};
      
      for (const workItem of workItems) {
        if (workItem.assignedTo) {
          if (!developerWorkItems[workItem.assignedTo]) {
            developerWorkItems[workItem.assignedTo] = [];
          }
          developerWorkItems[workItem.assignedTo].push(workItem);
        }
      }
      
      // Update metrics for each developer
      for (const [developerId, items] of Object.entries(developerWorkItems)) {
        // Get or create developer activity record
        let activity = this.store.developerActivities[developerId] || {
          developerId,
          developerName: developerId.split('<')[0].trim(), // Extract name from "Name <email>" format
          lastActive: new Date().toISOString(),
          workItemsAssigned: 0,
          workItemsCompleted: 0,
          averageCompletionTime: 0,
          commentCount: 0,
          averageResponseTime: 0,
          sentimentScores: { positive: 0, neutral: 0, negative: 0, frustrated: 0 },
          staleItemCount: 0,
          engagementScore: 0
        };
        
        // Update basic metrics
        activity.workItemsAssigned = items.length;
        activity.workItemsCompleted = items.filter(item => 
          item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done'
        ).length;
        
        // Count stale items
        const now = new Date();
        activity.staleItemCount = items.filter(item => {
          // Only consider Active items as stale, not New items
          if (item.state !== 'Active') {
            return false;
          }
          
          // Only consider Task type items as stale, not QA, DEV, etc.
          if (item.type !== 'Task') {
            return false;
          }
          
          // Check if the item hasn't been updated recently
          const lastUpdated = new Date(item.updatedDate);
          const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
          return daysSinceUpdate >= this.config.reminderThresholdDays;
        }).length;
        
        // Calculate engagement score (simplified version)
        // In a real implementation, this would be more sophisticated
        const completionRatio = activity.workItemsAssigned > 0 
          ? activity.workItemsCompleted / activity.workItemsAssigned 
          : 0;
        
        const staleRatio = activity.workItemsAssigned > 0 
          ? 1 - (activity.staleItemCount / activity.workItemsAssigned) 
          : 1;
        
        // Simple engagement score formula
        activity.engagementScore = Math.round((completionRatio * 0.6 + staleRatio * 0.4) * 100);
        
        // Store the updated activity record
        this.store.developerActivities[developerId] = activity;
      }
    } catch (error) {
      console.error('Error updating developer activity metrics:', error);
    }
  }

  /**
   * Send reminders for stale work items
   * @param workItems The work items to check
   */
  private async sendReminders(workItems: WorkItem[]): Promise<void> {
    try {
      const now = new Date();
      const enabledTemplates = this.config.reminderTemplates.filter(template => template.enabled);
      
      for (const workItem of workItems) {
        // Skip completed items
        if (workItem.state === 'Completed' || workItem.state === 'Closed' || workItem.state === 'Done') {
          continue;
        }
        
        // Skip items without an assignee
        if (!workItem.assignedTo) {
          continue;
        }
        
        // Get work item engagement record
        const engagement = this.store.workItemEngagements[workItem.id];
        if (!engagement) {
          continue;
        }
        
        // Check if we've already sent a reminder recently (respect cooldown)
        if (engagement.lastReminderDate) {
          const lastReminder = new Date(engagement.lastReminderDate);
          const daysSinceLastReminder = Math.floor((now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceLastReminder < this.config.reminderCooldownDays) {
            continue; // Skip if we've sent a reminder recently
          }
        }
        
        // Check each template condition
        for (const template of enabledTemplates) {
          let shouldSendReminder = false;
          let reminderMessage = '';
          
          switch (template.condition) {
            case 'stale':
              // Check if the item is stale
              // Only consider Active items and Task type items as stale
              shouldSendReminder = workItem.state === 'Active' && 
                                  workItem.type === 'Task' &&
                                  engagement.daysSinceLastUpdate >= this.config.reminderThresholdDays;
              break;
              
            case 'blocked':
              // Check if the item is blocked
              // Only consider Task type items
              shouldSendReminder = workItem.type === 'Task' &&
                                  (workItem.state === 'Blocked' || 
                                  workItem.tags.some(tag => tag.toLowerCase() === 'blocked'));
              break;
              
            case 'high_effort':
              // Check if it's a high-effort item in progress for a while
              // Only consider Task type items
              shouldSendReminder = (workItem.effort !== null && workItem.effort > 8) && 
                                  (workItem.state === 'Active') &&
                                  workItem.type === 'Task' &&
                                  engagement.daysSinceLastUpdate >= 2;
              break;
              
            case 'missing_info':
              // Check if important information is missing
              // Only consider Task type items
              shouldSendReminder = workItem.type === 'Task' &&
                                  ((workItem.effort === null || workItem.effort === 0) ||
                                  (!workItem.description || workItem.description.length < 50));
              break;
          }
          
          if (shouldSendReminder) {
            // Format the reminder message
            reminderMessage = this.formatReminderTemplate(template.messageTemplate, workItem, engagement);
            
            let adoSuccess = true;
            let teamsSuccess = true;
            
            // Send the reminder to ADO if configured
            if (this.config.teamsNotifications.sendToAdo) {
              adoSuccess = await adoService.addWorkItemComment(workItem.id, reminderMessage);
            }
            
            // Send the reminder to Teams if configured
            if (this.config.teamsNotifications.enabled && this.config.teamsNotifications.sendToTeams && workItem.assignedTo) {
              // Extract email from "Name <email>" format
              const assigneeEmail = workItem.assignedTo.match(/<([^>]+)>/)?.[1] || workItem.assignedTo;
              
              teamsSuccess = await teamsNotificationService.sendStaleWorkItemNotification(
                assigneeEmail,
                workItem.id,
                workItem.title,
                engagement.daysSinceLastUpdate
              );
            }
            
            if (adoSuccess || teamsSuccess) {
              console.log(`Sent reminder for work item ${workItem.id} based on condition "${template.condition}"`);
              
              // Update engagement record
              engagement.remindersSent += 1;
              engagement.lastReminderDate = now.toISOString();
              
              // Add to reminder history
              this.store.reminderHistory.push({
                date: now.toISOString(),
                workItemId: workItem.id,
                developerId: workItem.assignedTo || '',
                reminderType: template.condition,
                message: reminderMessage
              });
              
              // Only send one reminder per work item per run
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
    }
  }

  /**
   * Format a reminder template with work item data
   * @param template The reminder template
   * @param workItem The work item data
   * @param engagement The work item engagement data
   */
  private formatReminderTemplate(template: string, workItem: WorkItem, engagement: WorkItemEngagement): string {
    // Replace placeholders with actual values
    let formattedMessage = template;
    
    // Extract assignee name from "Name <email>" format
    const assigneeName = workItem.assignedTo ? workItem.assignedTo.split('<')[0].trim() : 'Team';
    
    // Calculate days in various states
    const now = new Date();
    const lastUpdated = new Date(workItem.updatedDate);
    const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
    
    // Replace placeholders
    formattedMessage = formattedMessage.replace('{assignee}', assigneeName);
    formattedMessage = formattedMessage.replace('{id}', workItem.id.toString());
    formattedMessage = formattedMessage.replace('{title}', workItem.title);
    formattedMessage = formattedMessage.replace('{state}', workItem.state);
    formattedMessage = formattedMessage.replace('{effort}', (workItem.effort || 0).toString());
    formattedMessage = formattedMessage.replace('{daysSinceUpdate}', daysSinceUpdate.toString());
    formattedMessage = formattedMessage.replace('{daysSinceBlocked}', daysSinceUpdate.toString()); // Simplified
    formattedMessage = formattedMessage.replace('{daysInProgress}', daysSinceUpdate.toString()); // Simplified
    
    return formattedMessage;
  }

  /**
   * Analyze sentiment of a comment
   * @param comment The comment text
   * @returns Promise with the sentiment analysis result
   */
  async analyzeSentiment(comment: string): Promise<SentimentAnalysisResult> {
    if (!this.config.enableSentimentAnalysis) {
      // Return a neutral sentiment if analysis is disabled
      return {
        text: comment,
        sentiment: 'neutral',
        score: 0,
        confidence: 1,
        summary: 'Sentiment analysis is disabled'
      };
    }
    
    try {
      // Use the new sentiment analysis service
      return await sentimentAnalysisService.analyzeSentiment(comment);
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      // Return a neutral sentiment as fallback
      return {
        text: comment,
        sentiment: 'neutral',
        score: 0,
        confidence: 0.5,
        summary: 'Error analyzing sentiment'
      };
    }
  }

  /**
   * Analyze sentiment for multiple comments
   * @param comments Array of comment data
   * @returns Promise with sentiment analysis results
   */
  async analyzeCommentsBatch(comments: CommentData[]): Promise<SentimentAnalysisResult[]> {
    if (!this.config.enableSentimentAnalysis || comments.length === 0) {
      return [];
    }
    
    try {
      return await sentimentAnalysisService.batchAnalyzeSentiment(comments);
    } catch (error) {
      console.error('Error batch analyzing sentiment:', error);
      // Return neutral sentiments as fallback
      return comments.map(comment => ({
        text: comment.text,
        sentiment: 'neutral' as 'positive' | 'negative' | 'neutral',
        score: 0,
        confidence: 0.5,
        summary: 'Error analyzing sentiment'
      }));
    }
  }

  /**
   * Analyze sentiment trends for a developer's comments
   * @param developerId The developer ID
   * @param days Number of days to look back
   * @returns Promise with sentiment trend analysis
   */
  async analyzeDeveloperSentimentTrends(developerId: string, days: number = 30): Promise<{
    overallSentiment: 'positive' | 'negative' | 'neutral';
    averageScore: number;
    sentimentDistribution: {
      positive: number;
      neutral: number;
      negative: number;
    };
    topKeywords: string[];
    sentimentOverTime: {
      timestamp: string;
      score: number;
    }[];
    summary: string;
  }> {
    try {
      // Get sentiment history for the developer
      const sentimentHistory = this.getSentimentHistory(developerId, days);
      
      // Convert to CommentData format
      const comments: CommentData[] = sentimentHistory.map(item => ({
        id: item.id || `${item.workItemId}-${item.date}`,
        text: item.comment,
        author: item.developerName,
        timestamp: item.date,
        workItemId: item.workItemId,
        workItemTitle: `Work Item ${item.workItemId}`
      }));
      
      // If we have comments, analyze the trends
      if (comments.length > 0) {
        return await sentimentAnalysisService.analyzeSentimentTrends(comments);
      }
      
      // Return default values if no comments
      return {
        overallSentiment: 'neutral',
        averageScore: 0,
        sentimentDistribution: {
          positive: 0,
          neutral: 0,
          negative: 0
        },
        topKeywords: [],
        sentimentOverTime: [],
        summary: 'No comments found for sentiment analysis'
      };
    } catch (error) {
      console.error('Error analyzing developer sentiment trends:', error);
      // Return default values as fallback
      return {
        overallSentiment: 'neutral',
        averageScore: 0,
        sentimentDistribution: {
          positive: 0,
          neutral: 0,
          negative: 0
        },
        topKeywords: [],
        sentimentOverTime: [],
        summary: 'Error analyzing sentiment trends'
      };
    }
  }

  /**
   * Get all developer activities
   */
  getDeveloperActivities(): DeveloperActivity[] {
    return Object.values(this.store.developerActivities);
  }

  /**
   * Get a specific developer's activity
   * @param developerId The developer ID
   */
  getDeveloperActivity(developerId: string): DeveloperActivity | null {
    return this.store.developerActivities[developerId] || null;
  }

  /**
   * Get all work item engagements
   */
  getWorkItemEngagements(): WorkItemEngagement[] {
    return Object.values(this.store.workItemEngagements);
  }

  /**
   * Get stale work items that need attention
   * @param thresholdDays Optional custom threshold in days
   */
  getStaleWorkItems(thresholdDays?: number): WorkItemEngagement[] {
    const threshold = thresholdDays || this.config.reminderThresholdDays;
    
    return Object.values(this.store.workItemEngagements).filter(item => 
      // Only consider Active items as stale, not New items
      item.state === 'Active' &&
      // Only consider Task type items as stale, not QA, DEV, etc.
      item.type === 'Task' &&
      // Check if the item hasn't been updated recently
      item.daysSinceLastUpdate >= threshold
    );
  }

  /**
   * Get sentiment history for analysis
   * @param developerId Optional filter by developer
   * @param days Optional number of days to look back
   */
  getSentimentHistory(developerId?: string, days: number = 30): any[] {
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return this.store.sentimentHistory
      .filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= cutoff && (!developerId || item.developerId === developerId);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Get reminder history
   * @param developerId Optional filter by developer
   * @param days Optional number of days to look back
   */
  getReminderHistory(developerId?: string, days: number = 30): any[] {
    const now = new Date();
    const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    
    return this.store.reminderHistory
      .filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= cutoff && (!developerId || item.developerId === developerId);
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  /**
   * Run the engagement tracking process manually
   */
  async runManually(): Promise<void> {
    console.log('Running developer engagement tracking manually...');
    await this.processEngagementTracking();
    console.log('Manual developer engagement tracking completed.');
  }

  /**
   * Get a summary of the engagement tracking process
   */
  getProcessingSummary(): {
    lastRun: string | null;
    developerCount: number;
    remindersSent: number;
    staleItemCount: number;
    averageEngagementScore: number;
  } {
    const developers = Object.values(this.store.developerActivities);
    const staleItems = this.getStaleWorkItems();
    
    return {
      lastRun: this.config.lastRunTimestamp ? new Date(this.config.lastRunTimestamp).toLocaleString() : null,
      developerCount: developers.length,
      remindersSent: this.store.reminderHistory.length,
      staleItemCount: staleItems.length,
      averageEngagementScore: developers.length > 0 
        ? Math.round(developers.reduce((sum, dev) => sum + dev.engagementScore, 0) / developers.length) 
        : 0
    };
  }

  /**
   * Add a custom reminder template
   * @param template The template to add
   */
  addReminderTemplate(template: Omit<ReminderTemplate, 'id'>): string {
    const id = `custom_${Date.now()}`;
    const newTemplate: ReminderTemplate = {
      ...template,
      id
    };
    
    this.config.reminderTemplates.push(newTemplate);
    this.saveConfig();
    
    return id;
  }

  /**
   * Delete a reminder template
   * @param id The ID of the template to delete
   */
  deleteReminderTemplate(id: string): boolean {
    const initialLength = this.config.reminderTemplates.length;
    this.config.reminderTemplates = this.config.reminderTemplates.filter(template => template.id !== id);
    
    if (this.config.reminderTemplates.length !== initialLength) {
      this.saveConfig();
      return true;
    }
    
    return false;
  }

  /**
   * Update a reminder template
   * @param id The ID of the template to update
   * @param updates The updates to apply
   */
  updateReminderTemplate(id: string, updates: Partial<Omit<ReminderTemplate, 'id'>>): boolean {
    const templateIndex = this.config.reminderTemplates.findIndex(template => template.id === id);
    
    if (templateIndex >= 0) {
      this.config.reminderTemplates[templateIndex] = {
        ...this.config.reminderTemplates[templateIndex],
        ...updates
      };
      
      this.saveConfig();
      return true;
    }
    
    return false;
  }
}

// Export a singleton instance
export const developerEngagementService = new DeveloperEngagementService();

export default developerEngagementService;
