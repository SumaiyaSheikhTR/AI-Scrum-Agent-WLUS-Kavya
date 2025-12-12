import adoService from './adoService';
import teamsNotificationService from './teamsNotificationService';
import sentimentAnalysisBackgroundService from './sentimentAnalysisBackgroundService';

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  data: any;
  workItemIds?: number[];
  sprintId?: number;
  userId?: string;
  createdAt: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  dismissedAt?: Date;
  dismissedBy?: string;
}

export type AlertType = 
  | 'stale_work_item'
  | 'blocked_item_timeout'
  | 'sprint_at_risk'
  | 'velocity_drop'
  | 'sentiment_decline'
  | 'no_activity'
  | 'effort_mismatch'
  | 'pr_conflicts'
  | 'missing_estimation'
  | 'overdue_review'
  | 'build_failure'
  | 'code_without_workitem'
  | 'workitem_without_code';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: AlertType;
  conditions: AlertCondition[];
  severity: AlertSeverity;
  enabled: boolean;
  throttleMinutes: number; // Minimum time between alerts of same type
  notificationChannels: NotificationChannel[];
  recipients: string[];
  customMessage?: string;
}

export interface AlertCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'days_since' | 'percentage_below';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

export type NotificationChannel = 'console' | 'teams' | 'email' | 'dashboard';

export interface AlertingConfig {
  enabled: boolean;
  checkInterval: number; // Minutes
  maxAlertsPerHour: number;
  autoResolveStaleAlerts: boolean;
  staleAlertDays: number;
}

export interface AlertAnalytics {
  totalAlerts: number;
  criticalAlerts: number;
  resolvedAlerts: number;
  averageResolutionTime: number; // Hours
  alertsByType: Record<AlertType, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  trendData: AlertTrendData[];
}

export interface AlertTrendData {
  date: string;
  alerts: number;
  resolved: number;
  critical: number;
}

class NotificationAlertingSystem {
  private config: AlertingConfig;
  private alertRules: AlertRule[] = [];
  private alerts: Alert[] = [];
  private isRunning = false;
  private checkTimer: NodeJS.Timeout | null = null;
  private alertThrottle: Map<string, Date> = new Map();
  private readonly STORAGE_KEY = 'alerting_system_config';
  private readonly RULES_STORAGE_KEY = 'alerting_rules';
  private readonly ALERTS_STORAGE_KEY = 'alerting_alerts';

  constructor() {
    this.config = this.loadConfig();
    this.loadAlertRules();
    this.loadAlerts();
    this.initializeDefaultRules();
  }

  /**
   * Start the alerting system
   */
  public start(): void {
    if (this.isRunning || !this.config.enabled) return;

    console.log('Notification & Alerting System startup DISABLED to prevent page refreshing');
    
    /* Original alerting system startup commented out:
    console.log('Starting Notification & Alerting System...');
    this.isRunning = true;
    this.checkForAlerts();

    this.checkTimer = setInterval(() => {
      this.checkForAlerts();
    }, this.config.checkInterval * 60 * 1000);
    */
  }

  /**
   * Stop the alerting system
   */
  public stop(): void {
    console.log('Stopping Notification & Alerting System...');
    this.isRunning = false;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AlertingConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();

    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): AlertingConfig {
    return { ...this.config };
  }

  /**
   * Add alert rule
   */
  public addAlertRule(rule: Omit<AlertRule, 'id'>): AlertRule {
    const newRule: AlertRule = {
      ...rule,
      id: this.generateAlertRuleId()
    };

    this.alertRules.push(newRule);
    this.saveAlertRules();
    return newRule;
  }

  /**
   * Update alert rule
   */
  public updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
    this.saveAlertRules();
    return true;
  }

  /**
   * Delete alert rule
   */
  public deleteAlertRule(ruleId: string): boolean {
    const ruleIndex = this.alertRules.findIndex(r => r.id === ruleId);
    if (ruleIndex === -1) return false;

    this.alertRules.splice(ruleIndex, 1);
    this.saveAlertRules();
    return true;
  }

  /**
   * Get all alert rules
   */
  public getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }

  /**
   * Get all alerts
   */
  public getAlerts(filters?: {
    type?: AlertType;
    severity?: AlertSeverity;
    resolved?: boolean;
    limit?: number;
  }): Alert[] {
    let filteredAlerts = [...this.alerts];

    if (filters) {
      if (filters.type) {
        filteredAlerts = filteredAlerts.filter(a => a.type === filters.type);
      }
      if (filters.severity) {
        filteredAlerts = filteredAlerts.filter(a => a.severity === filters.severity);
      }
      if (filters.resolved !== undefined) {
        filteredAlerts = filteredAlerts.filter(a => a.resolved === filters.resolved);
      }
    }

    // Sort by creation date (newest first)
    filteredAlerts.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters?.limit) {
      filteredAlerts = filteredAlerts.slice(0, filters.limit);
    }

    return filteredAlerts;
  }

  /**
   * Get alert analytics
   */
  public getAlertAnalytics(days: number = 30): AlertAnalytics {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentAlerts = this.alerts.filter(a => a.createdAt >= cutoffDate);
    const resolvedAlerts = recentAlerts.filter(a => a.resolved);

    // Calculate average resolution time
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const alert of resolvedAlerts) {
      if (alert.resolvedAt) {
        const resolutionTime = alert.resolvedAt.getTime() - alert.createdAt.getTime();
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    }

    const averageResolutionTime = resolvedCount > 0 
      ? totalResolutionTime / resolvedCount / (1000 * 60 * 60) // Convert to hours
      : 0;

    // Count by type and severity
    const alertsByType = {} as Record<AlertType, number>;
    const alertsBySeverity = {} as Record<AlertSeverity, number>;

    for (const alert of recentAlerts) {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
    }

    // Generate trend data (daily)
    const trendData: AlertTrendData[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayAlerts = recentAlerts.filter(a => 
        a.createdAt.toISOString().split('T')[0] === dateStr
      );

      trendData.push({
        date: dateStr,
        alerts: dayAlerts.length,
        resolved: dayAlerts.filter(a => a.resolved).length,
        critical: dayAlerts.filter(a => a.severity === 'critical').length
      });
    }

    return {
      totalAlerts: recentAlerts.length,
      criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
      resolvedAlerts: resolvedAlerts.length,
      averageResolutionTime,
      alertsByType,
      alertsBySeverity,
      trendData
    };
  }

  /**
   * Resolve an alert
   */
  public resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.resolved) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;

    this.saveAlerts();
    console.log(`Alert ${alertId} resolved by ${resolvedBy || 'system'}`);
    return true;
  }

  /**
   * Dismiss an alert
   */
  public dismissAlert(alertId: string, dismissedBy?: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.dismissedAt = new Date();
    alert.dismissedBy = dismissedBy;

    this.saveAlerts();
    console.log(`Alert ${alertId} dismissed by ${dismissedBy || 'system'}`);
    return true;
  }

  /**
   * Create an alert manually
   */
  public createAlert(
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    data?: any,
    workItemIds?: number[]
  ): Alert {
    const alert: Alert = {
      id: this.generateAlertId(),
      type,
      severity,
      title,
      message,
      data: data || {},
      workItemIds,
      createdAt: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    this.saveAlerts();
    this.sendAlertNotifications(alert);

    return alert;
  }

  /**
   * Main alert checking function
   */
  private async checkForAlerts(): Promise<void> {
    if (!this.config.enabled) return;

    console.log('Checking for alerts...');

    try {
      // Clean up old alerts first
      await this.cleanupStaleAlerts();

      // Check each enabled rule
      for (const rule of this.alertRules.filter(r => r.enabled)) {
        try {
          await this.checkAlertRule(rule);
        } catch (error) {
          console.error(`Error checking alert rule ${rule.name}:`, error);
        }
      }

      console.log('Alert check completed');
    } catch (error) {
      console.error('Error during alert checking:', error);
    }
  }

  /**
   * Check a specific alert rule
   */
  private async checkAlertRule(rule: AlertRule): Promise<void> {
    // Check throttling
    const throttleKey = `${rule.type}_${rule.id}`;
    const lastAlert = this.alertThrottle.get(throttleKey);
    
    if (lastAlert) {
      const timeSinceLastAlert = Date.now() - lastAlert.getTime();
      const throttleTime = rule.throttleMinutes * 60 * 1000;
      
      if (timeSinceLastAlert < throttleTime) {
        return; // Still in throttle period
      }
    }

    // Get data based on alert type
    const data = await this.getAlertData(rule.type);
    if (!data) return;

    // Evaluate conditions
    const matches = this.evaluateAlertConditions(rule, data);
    
    if (matches.length > 0) {
      // Create alerts for matches
      for (const match of matches) {
        const alert = await this.createAlertFromRule(rule, match);
        if (alert) {
          this.alertThrottle.set(throttleKey, new Date());
        }
      }
    }
  }

  /**
   * Get data for alert evaluation
   */
  private async getAlertData(type: AlertType): Promise<any> {
    switch (type) {
      case 'stale_work_item':
      case 'blocked_item_timeout':
      case 'no_activity':
      case 'missing_estimation':
        return await adoService.getAllWorkItems();

      case 'sprint_at_risk':
      case 'velocity_drop':
        const currentSprint = await adoService.getCurrentSprint();
        if (!currentSprint) return null;
        return {
          sprint: currentSprint,
          workItems: await adoService.getSprintWorkItems(currentSprint.id),
          statistics: await adoService.getSprintStatistics(currentSprint.id)
        };

      case 'sentiment_decline':
        // Get current sprint for sentiment analysis
        const currentSprintForSentiment = await adoService.getCurrentSprint();
        if (!currentSprintForSentiment) {
          console.warn('No current sprint found for sentiment analysis');
          return null;
        }
        const sentiment = await sentimentAnalysisBackgroundService.getSentimentAnalysis(currentSprintForSentiment.id);
        return sentiment;

      case 'effort_mismatch':
        return await adoService.getAllWorkItems();

      default:
        return null;
    }
  }

  /**
   * Evaluate alert conditions
   */
  private evaluateAlertConditions(rule: AlertRule, data: any): any[] {
    const matches: any[] = [];

    switch (rule.type) {
      case 'stale_work_item':
        if (Array.isArray(data)) {
          const staleWorkItems = data.filter(item => {
            const daysSinceUpdate = Math.floor(
              (Date.now() - new Date(item.updatedDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysSinceUpdate >= 5 && item.state !== 'Done' && item.state !== 'Closed';
          });
          matches.push(...staleWorkItems);
        }
        break;

      case 'blocked_item_timeout':
        if (Array.isArray(data)) {
          const blockedItems = data.filter(item => {
            const daysSinceUpdate = Math.floor(
              (Date.now() - new Date(item.updatedDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            return item.state === 'Blocked' && daysSinceUpdate >= 2;
          });
          matches.push(...blockedItems);
        }
        break;

      case 'sprint_at_risk':
        if (data?.sprint && data?.statistics) {
          const daysRemaining = Math.ceil(
            (new Date(data.sprint.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );
          const completionRate = data.statistics.completedWorkItems / data.statistics.totalWorkItems;
          
          // Alert if less than 50% complete with less than 3 days remaining
          if (daysRemaining <= 3 && completionRate < 0.5) {
            matches.push(data);
          }
        }
        break;

      case 'sentiment_decline':
        if (data && data.overallSentiment < -0.5) {
          matches.push(data);
        }
        break;

      case 'missing_estimation':
        if (Array.isArray(data)) {
          const unestimatedItems = data.filter(item => 
            !item.effort && item.state !== 'Done' && item.state !== 'Closed'
          );
          matches.push(...unestimatedItems);
        }
        break;

      case 'no_activity':
        if (Array.isArray(data)) {
          const inactiveItems = data.filter(item => {
            const daysSinceUpdate = Math.floor(
              (Date.now() - new Date(item.updatedDate).getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysSinceUpdate >= 7 && item.state === 'In Progress';
          });
          matches.push(...inactiveItems);
        }
        break;
    }

    return matches;
  }

  /**
   * Create alert from rule and match data
   */
  private async createAlertFromRule(rule: AlertRule, matchData: any): Promise<Alert | null> {
    let title = '';
    let message = '';
    let workItemIds: number[] | undefined;

    switch (rule.type) {
      case 'stale_work_item':
        title = `Stale Work Item: ${matchData.title}`;
        message = `Work item #${matchData.id} has not been updated for more than 5 days and is still in ${matchData.state} state.`;
        workItemIds = [matchData.id];
        break;

      case 'blocked_item_timeout':
        title = `Blocked Item Timeout: ${matchData.title}`;
        message = `Work item #${matchData.id} has been blocked for more than 2 days without updates.`;
        workItemIds = [matchData.id];
        break;

      case 'sprint_at_risk':
        title = `Sprint At Risk: ${matchData.sprint.name}`;
        message = `Sprint "${matchData.sprint.name}" has less than 3 days remaining but only ${(matchData.statistics.completedWorkItems / matchData.statistics.totalWorkItems * 100).toFixed(1)}% completed.`;
        break;

      case 'sentiment_decline':
        title = 'Team Sentiment Declining';
        message = `Team sentiment has dropped to ${matchData.overallSentiment.toFixed(2)}, indicating potential issues that need attention.`;
        break;

      case 'missing_estimation':
        title = `Missing Effort Estimation: ${matchData.title}`;
        message = `Work item #${matchData.id} is missing effort estimation, which may impact sprint planning.`;
        workItemIds = [matchData.id];
        break;

      case 'no_activity':
        title = `No Recent Activity: ${matchData.title}`;
        message = `Work item #${matchData.id} has been in progress for over a week without updates.`;
        workItemIds = [matchData.id];
        break;

      default:
        return null;
    }

    // Use custom message if provided
    if (rule.customMessage) {
      message = rule.customMessage;
    }

    const alert: Alert = {
      id: this.generateAlertId(),
      type: rule.type,
      severity: rule.severity,
      title,
      message,
      data: matchData,
      workItemIds,
      createdAt: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    this.saveAlerts();
    
    // Send notifications
    await this.sendAlertNotifications(alert, rule);

    return alert;
  }

  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: Alert, rule?: AlertRule): Promise<void> {
    const channels = rule?.notificationChannels || ['console'];

    for (const channel of channels) {
      try {
        switch (channel) {
          case 'console':
            this.sendConsoleNotification(alert);
            break;
          case 'teams':
            await this.sendTeamsNotification(alert);
            break;
          case 'email':
            await this.sendEmailNotification(alert);
            break;
          case 'dashboard':
            // Dashboard notifications are handled by the UI polling
            break;
        }
      } catch (error) {
        console.error(`Error sending ${channel} notification for alert ${alert.id}:`, error);
      }
    }
  }

  /**
   * Send console notification
   */
  private sendConsoleNotification(alert: Alert): void {
    const emoji = this.getSeverityEmoji(alert.severity);
    console.log(`\n${emoji} ALERT [${alert.severity.toUpperCase()}]: ${alert.title}`);
    console.log(`Message: ${alert.message}`);
    console.log(`Time: ${alert.createdAt.toLocaleString()}`);
    console.log(`Alert ID: ${alert.id}\n`);
  }

  /**
   * Send Teams notification
   */
  private async sendTeamsNotification(alert: Alert): Promise<void> {
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);

    const message = `${emoji} **${alert.title}**\n\n${alert.message}\n\n*Alert ID: ${alert.id}*`;

    await teamsNotificationService.sendNotification({
      type: 'channel',
      recipient: 'General',
      title: `Alert: ${alert.title}`,
      message: message,
      color: color
    });
  }

  /**
   * Send email notification (placeholder)
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    // This would integrate with an email service
    console.log(`Email notification for alert ${alert.id} - not yet implemented`);
  }

  /**
   * Get severity emoji
   */
  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'low': return '💡';
      case 'medium': return '⚠️';
      case 'high': return '🚨';
      case 'critical': return '🔥';
      default: return '📢';
    }
  }

  /**
   * Get severity color
   */
  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'low': return '00B294';
      case 'medium': return 'FF8C00';
      case 'high': return 'FF4B4B';
      case 'critical': return 'DC143C';
      default: return '0078D4';
    }
  }

  /**
   * Clean up stale alerts
   */
  private async cleanupStaleAlerts(): Promise<void> {
    if (!this.config.autoResolveStaleAlerts) return;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.staleAlertDays);

    const staleAlerts = this.alerts.filter(alert => 
      !alert.resolved && 
      !alert.dismissedAt &&
      alert.createdAt < cutoffDate
    );

    for (const alert of staleAlerts) {
      this.resolveAlert(alert.id, 'system-auto-resolve');
    }

    if (staleAlerts.length > 0) {
      console.log(`Auto-resolved ${staleAlerts.length} stale alerts`);
    }
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    if (this.alertRules.length > 0) return;

    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'Stale Work Items',
        description: 'Alert when work items have not been updated for 5+ days',
        type: 'stale_work_item',
        conditions: [],
        severity: 'medium',
        enabled: true,
        throttleMinutes: 240, // 4 hours
        notificationChannels: ['console', 'teams'],
        recipients: []
      },
      {
        name: 'Blocked Items Timeout',
        description: 'Alert when blocked items have not been updated for 2+ days',
        type: 'blocked_item_timeout',
        conditions: [],
        severity: 'high',
        enabled: true,
        throttleMinutes: 120, // 2 hours
        notificationChannels: ['console', 'teams'],
        recipients: []
      },
      {
        name: 'Sprint At Risk',
        description: 'Alert when sprint completion is at risk',
        type: 'sprint_at_risk',
        conditions: [],
        severity: 'critical',
        enabled: true,
        throttleMinutes: 480, // 8 hours
        notificationChannels: ['console', 'teams'],
        recipients: []
      },
      {
        name: 'Team Sentiment Decline',
        description: 'Alert when team sentiment drops significantly',
        type: 'sentiment_decline',
        conditions: [],
        severity: 'high',
        enabled: true,
        throttleMinutes: 720, // 12 hours
        notificationChannels: ['console', 'teams'],
        recipients: []
      },
      {
        name: 'Missing Effort Estimation',
        description: 'Alert for work items without effort estimation',
        type: 'missing_estimation',
        conditions: [],
        severity: 'low',
        enabled: false, // Disabled by default as it might be noisy
        throttleMinutes: 1440, // 24 hours
        notificationChannels: ['console'],
        recipients: []
      }
    ];

    defaultRules.forEach(rule => this.addAlertRule(rule));
    console.log('Initialized default alert rules');
  }

  /**
   * Generate unique alert ID
   */
  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique alert rule ID
   */
  private generateAlertRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load configuration from storage
   */
  private loadConfig(): AlertingConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.getDefaultConfig(), ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading alerting config:', error);
    }
    
    return this.getDefaultConfig();
  }

  /**
   * Save configuration to storage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving alerting config:', error);
    }
  }

  /**
   * Load alert rules from storage
   */
  private loadAlertRules(): void {
    try {
      const stored = localStorage.getItem(this.RULES_STORAGE_KEY);
      if (stored) {
        this.alertRules = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading alert rules:', error);
      this.alertRules = [];
    }
  }

  /**
   * Save alert rules to storage
   */
  private saveAlertRules(): void {
    try {
      localStorage.setItem(this.RULES_STORAGE_KEY, JSON.stringify(this.alertRules));
    } catch (error) {
      console.error('Error saving alert rules:', error);
    }
  }

  /**
   * Load alerts from storage
   */
  private loadAlerts(): void {
    try {
      const stored = localStorage.getItem(this.ALERTS_STORAGE_KEY);
      if (stored) {
        const alertsData = JSON.parse(stored);
        this.alerts = alertsData.map((alert: any) => ({
          ...alert,
          createdAt: new Date(alert.createdAt),
          resolvedAt: alert.resolvedAt ? new Date(alert.resolvedAt) : undefined,
          dismissedAt: alert.dismissedAt ? new Date(alert.dismissedAt) : undefined
        }));
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
      this.alerts = [];
    }
  }

  /**
   * Save alerts to storage
   */
  private saveAlerts(): void {
    try {
      // Keep only last 500 alerts to prevent storage bloat
      const recentAlerts = this.alerts.slice(-500);
      localStorage.setItem(this.ALERTS_STORAGE_KEY, JSON.stringify(recentAlerts));
    } catch (error) {
      console.error('Error saving alerts:', error);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): AlertingConfig {
    return {
      enabled: false,
      checkInterval: 10, // 10 minutes
      maxAlertsPerHour: 20,
      autoResolveStaleAlerts: true,
      staleAlertDays: 7
    };
  }
}

// Export singleton instance
const notificationAlertingSystem = new NotificationAlertingSystem();
export default notificationAlertingSystem;
