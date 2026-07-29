import adoService, { WorkItem, Sprint, WorkItemComment } from './adoService';
import improvedOpenAiService from './improvedOpenAiService';
import sentimentAnalysisBackgroundService from './sentimentAnalysisBackgroundService';
import teamsNotificationService from './teamsNotificationService';
import emailService from './emailService';

export interface DailySummary {
  id: string;
  sprintId: string;
  sprintName: string;
  date: string;
  summary: string;
  metrics: SprintMetrics;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
  sentiment: SentimentSummary;
  workItemUpdates: WorkItemUpdate[];
  generatedAt: Date;
}

export interface SprintMetrics {
  totalWorkItems: number;
  completedToday: number;
  inProgress: number;
  blocked: number;
  newItems: number;
  burndownProgress: number;
  velocityTrend: string;
  effortRemaining: number;
  daysRemaining: number;
}

export interface SentimentSummary {
  overallSentiment: number;
  sentimentTrend: string;
  topConcerns: string[];
  positiveHighlights: string[];
}

export interface WorkItemUpdate {
  workItemId: number;
  title: string;
  previousState: string;
  currentState: string;
  assignee: string;
  comments: string[];
}

export interface SchedulerConfig {
  enabled: boolean;
  dailyTime: string; // HH:MM format
  timezone: string;
  recipients: string[];
  includeWeekends: boolean;
  channels: ('email' | 'teams' | 'console')[];
  customPrompt?: string;
}

class DailySummaryScheduler {
  private config: SchedulerConfig;
  private isRunning = false;
  private orchestratedMode = false;
  private schedulerTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly STORAGE_KEY = 'daily_summary_config';
  private readonly SUMMARIES_STORAGE_KEY = 'daily_summaries';
  private readonly LAST_DELIVERY_KEY = 'daily_summary_last_delivery';
  private summaries: DailySummary[] = [];

  constructor() {
    this.config = this.loadConfig();
    this.loadSummaries();
  }

  public setOrchestratedMode(enabled: boolean): void {
    this.orchestratedMode = enabled;
    if (enabled && this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * Start the daily summary scheduler
   */
  public start(): void {
    if (this.isRunning) return;

    console.log('Starting Daily Summary Scheduler...');
    this.isRunning = true;
    if (!this.orchestratedMode) {
      this.scheduleNextExecution();
    }
  }

  /**
   * Stop the daily summary scheduler
   */
  public stop(): void {
    console.log('Stopping Daily Summary Scheduler...');
    this.isRunning = false;

    if (this.schedulerTimer) {
      clearTimeout(this.schedulerTimer);
      this.schedulerTimer = null;
    }
  }

  /**
   * True when current local time matches the configured daily window
   * and we have not already delivered today.
   */
  public isDueNow(): boolean {
    if (!this.config.enabled) return false;

    const now = new Date();
    if (!this.config.includeWeekends && (now.getDay() === 0 || now.getDay() === 6)) {
      return false;
    }

    const [hours, minutes] = this.config.dailyTime.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = hours * 60 + minutes;
    // Due within a 45-minute window after the scheduled time
    if (currentMinutes < targetMinutes || currentMinutes > targetMinutes + 45) {
      return false;
    }

    const today = now.toISOString().split('T')[0];
    try {
      const last = localStorage.getItem(this.LAST_DELIVERY_KEY);
      if (last === today) return false;
    } catch {
      /* ignore */
    }
    return true;
  }

  public async deliverSummaryPublic(summary: DailySummary): Promise<void> {
    await this.deliverSummary(summary);
    try {
      localStorage.setItem(this.LAST_DELIVERY_KEY, summary.date);
    } catch {
      /* ignore */
    }
  }

  /**
   * Update scheduler configuration
   */
  public updateConfig(newConfig: Partial<SchedulerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.saveConfig();

    // Restart scheduler with new config
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }

  /**
   * Get current configuration
   */
  public getConfig(): SchedulerConfig {
    return { ...this.config };
  }

  /**
   * Generate summary manually
   */
  public async generateSummaryNow(sprintId?: string): Promise<DailySummary> {
    console.log('Generating daily summary manually...');

    const currentSprint = await this.findTargetSprint(sprintId);

    if (!currentSprint) {
      throw new Error('No active sprint found');
    }

    return await this.generateDailySummary(currentSprint);
  }

  /**
   * Get historical summaries
   */
  public getSummaries(limit?: number): DailySummary[] {
    const sorted = [...this.summaries].sort((a, b) => 
      new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime()
    );
    
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Get summary for specific date
   */
  public getSummaryByDate(date: string): DailySummary | null {
    return this.summaries.find(s => s.date === date) || null;
  }

  /**
   * Schedule next execution (standalone mode only — orchestrator owns timing otherwise)
   */
  private scheduleNextExecution(): void {
    if (!this.config.enabled || !this.isRunning || this.orchestratedMode) return;

    const now = new Date();
    const nextExecution = this.calculateNextExecution(now);
    const timeUntilExecution = Math.max(5_000, nextExecution.getTime() - now.getTime());

    console.log(`Next daily summary scheduled for: ${nextExecution.toLocaleString()}`);

    this.schedulerTimer = setTimeout(async () => {
      if (typeof document !== 'undefined' && document.hidden) {
        this.scheduleNextExecution();
        return;
      }
      await this.executeScheduledSummary();
      this.scheduleNextExecution();
    }, timeUntilExecution);
  }

  /**
   * Calculate next execution time
   */
  private calculateNextExecution(fromDate: Date): Date {
    const [hours, minutes] = this.config.dailyTime.split(':').map(Number);
    const nextExecution = new Date(fromDate);
    
    nextExecution.setHours(hours, minutes, 0, 0);

    // If the time has already passed today, schedule for tomorrow
    if (nextExecution <= fromDate) {
      nextExecution.setDate(nextExecution.getDate() + 1);
    }

    // Skip weekends if not included
    if (!this.config.includeWeekends) {
      while (nextExecution.getDay() === 0 || nextExecution.getDay() === 6) {
        nextExecution.setDate(nextExecution.getDate() + 1);
      }
    }

    return nextExecution;
  }

  /**
   * Execute scheduled summary generation
   */
  private async executeScheduledSummary(): Promise<void> {
    try {
      console.log('Executing scheduled daily summary generation...');
      
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        console.log('No active sprint found, skipping summary generation');
        return;
      }

      const summary = await this.generateDailySummary(currentSprint);
      await this.deliverSummary(summary);
      
      console.log('Scheduled daily summary completed successfully');
    } catch (error) {
      console.error('Error during scheduled summary generation:', error);
    }
  }

  /**
   * Generate daily summary for a sprint
   */
  private async generateDailySummary(sprint: Sprint): Promise<DailySummary> {
    console.log(`Generating daily summary for sprint: ${sprint.name}`);

    // Gather data
    const workItems = await adoService.getSprintWorkItems(sprint.id);
    const sprintStats = await adoService.getSprintStatistics(sprint.id);
    const comments = await adoService.getSprintComments(sprint.id);
    
    // Get yesterday's summary for comparison
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const previousSummary = this.getSummaryByDate(yesterdayStr);

    // Analyze work item changes since yesterday
    const workItemUpdates = await this.analyzeWorkItemChanges(workItems, previousSummary);

    // Get sentiment analysis
    const sentimentData = await sentimentAnalysisBackgroundService.getSentimentAnalysis(sprint.id);
    const sentimentSummary = this.analyzeSentimentTrends(sentimentData, previousSummary);

    // Calculate metrics
    const metrics = this.calculateDailyMetrics(sprintStats, sprint, workItems);

    // Generate AI-powered insights
    const aiInsights = await this.generateAIInsights(
      sprint, 
      workItems, 
      comments, 
      metrics, 
      sentimentSummary,
      workItemUpdates
    );

    const summary: DailySummary = {
      id: this.generateSummaryId(),
      sprintId: sprint.id,
      sprintName: sprint.name,
      date: new Date().toISOString().split('T')[0],
      summary: aiInsights.summary,
      metrics,
      highlights: aiInsights.highlights,
      concerns: aiInsights.concerns,
      recommendations: aiInsights.recommendations,
      sentiment: sentimentSummary,
      workItemUpdates,
      generatedAt: new Date()
    };

    // Store summary
    this.summaries.push(summary);
    this.saveSummaries();

    return summary;
  }

  /**
   * Analyze work item changes since previous summary
   */
  private async analyzeWorkItemChanges(
    currentWorkItems: WorkItem[], 
    previousSummary: DailySummary | null
  ): Promise<WorkItemUpdate[]> {
    const updates: WorkItemUpdate[] = [];

    if (!previousSummary) {
      // First summary, consider all items as new
      return currentWorkItems.map(item => ({
        workItemId: item.id,
        title: item.title,
        previousState: 'New',
        currentState: item.state,
        assignee: item.assignedTo || 'Unassigned',
        comments: []
      }));
    }

    // Compare with previous summary's work items
    const previousWorkItems = new Map(
      previousSummary.workItemUpdates.map(update => [update.workItemId, update])
    );

    for (const currentItem of currentWorkItems) {
      const previousItem = previousWorkItems.get(currentItem.id);
      
      if (!previousItem) {
        // New work item
        updates.push({
          workItemId: currentItem.id,
          title: currentItem.title,
          previousState: 'New',
          currentState: currentItem.state,
          assignee: currentItem.assignedTo || 'Unassigned',
          comments: []
        });
      } else if (previousItem.currentState !== currentItem.state) {
        // State changed
        updates.push({
          workItemId: currentItem.id,
          title: currentItem.title,
          previousState: previousItem.currentState,
          currentState: currentItem.state,
          assignee: currentItem.assignedTo || 'Unassigned',
          comments: []
        });
      }
    }

    return updates;
  }

  /**
   * Analyze sentiment trends
   */
  private analyzeSentimentTrends(
    currentSentiment: any, 
    previousSummary: DailySummary | null
  ): SentimentSummary {
    const overallSentiment = currentSentiment?.overallSentiment || 0;
    let sentimentTrend = 'stable';

    if (previousSummary) {
      const previousSentiment = previousSummary.sentiment.overallSentiment;
      const change = overallSentiment - previousSentiment;
      
      if (change > 0.1) sentimentTrend = 'improving';
      else if (change < -0.1) sentimentTrend = 'declining';
    }

    return {
      overallSentiment,
      sentimentTrend,
      topConcerns: currentSentiment?.concerns || [],
      positiveHighlights: currentSentiment?.positives || []
    };
  }

  /**
   * Calculate daily metrics
   */
  private calculateDailyMetrics(
    sprintStats: any, 
    sprint: Sprint, 
    workItems: WorkItem[]
  ): SprintMetrics {
    const sprintEnd = new Date(sprint.endDate);
    const today = new Date();
    const daysRemaining = Math.max(0, Math.ceil((sprintEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
    
    const totalDays = Math.ceil((sprintEnd.getTime() - new Date(sprint.startDate).getTime()) / (1000 * 60 * 60 * 24));
    const daysElapsed = totalDays - daysRemaining;
    const burndownProgress = totalDays > 0 ? (daysElapsed / totalDays) * 100 : 0;

    return {
      totalWorkItems: sprintStats.totalWorkItems || 0,
      completedToday: workItems.filter(item => 
        item.state === 'Done' && 
        new Date(item.updatedDate).toDateString() === today.toDateString()
      ).length,
      inProgress: sprintStats.inProgressWorkItems || 0,
      blocked: sprintStats.blockedWorkItems || 0,
      newItems: workItems.filter(item => 
        new Date(item.createdDate).toDateString() === today.toDateString()
      ).length,
      burndownProgress,
      velocityTrend: 'on-track', // This would need historical data
      effortRemaining: sprintStats.remainingEffort || 0,
      daysRemaining
    };
  }

  /**
   * Generate AI-powered insights
   */
  private async generateAIInsights(
    sprint: Sprint,
    workItems: WorkItem[],
    comments: WorkItemComment[],
    metrics: SprintMetrics,
    sentiment: SentimentSummary,
    updates: WorkItemUpdate[]
  ): Promise<{
    summary: string;
    highlights: string[];
    concerns: string[];
    recommendations: string[];
  }> {
    const prompt = this.config.customPrompt || this.buildDefaultPrompt(
      sprint, workItems, comments, metrics, sentiment, updates
    );

    try {
      const aiResponse = await improvedOpenAiService.chat(prompt);
      return this.parseAIResponse(aiResponse);
    } catch (error) {
      console.error('Error generating AI insights:', error);
      return this.generateFallbackInsights(metrics, sentiment, updates);
    }
  }

  /**
   * Build default prompt for AI insights
   */
  private buildDefaultPrompt(
    sprint: Sprint,
    workItems: WorkItem[],
    comments: WorkItemComment[],
    metrics: SprintMetrics,
    sentiment: SentimentSummary,
    updates: WorkItemUpdate[]
  ): string {
    return `Generate a comprehensive daily sprint summary for "${sprint.name}".

SPRINT METRICS:
- Total Work Items: ${metrics.totalWorkItems}
- Completed Today: ${metrics.completedToday}
- In Progress: ${metrics.inProgress}
- Blocked: ${metrics.blocked}
- New Items: ${metrics.newItems}
- Days Remaining: ${metrics.daysRemaining}
- Burndown Progress: ${metrics.burndownProgress.toFixed(1)}%

SENTIMENT ANALYSIS:
- Overall Sentiment: ${sentiment.overallSentiment.toFixed(2)} (${sentiment.sentimentTrend})
- Top Concerns: ${sentiment.topConcerns.join(', ')}
- Positive Highlights: ${sentiment.positiveHighlights.join(', ')}

WORK ITEM UPDATES (${updates.length} changes):
${updates.map(update => 
  `- ${update.title}: ${update.previousState} → ${update.currentState} (${update.assignee})`
).join('\n')}

RECENT ACTIVITY:
${comments.slice(-5).map(c => `- ${c.author}: ${c.text.substring(0, 100)}...`).join('\n')}

Please provide:
1. SUMMARY: A concise 2-3 sentence overview of today's progress
2. HIGHLIGHTS: 3-5 key achievements or positive developments
3. CONCERNS: 2-4 issues that need attention
4. RECOMMENDATIONS: 3-5 actionable suggestions for tomorrow

Format your response as JSON with keys: summary, highlights, concerns, recommendations (each as arrays except summary which is a string).`;
  }

  /**
   * Parse AI response into structured format
   */
  private parseAIResponse(response: string): {
    summary: string;
    highlights: string[];
    concerns: string[];
    recommendations: string[];
  } {
    try {
      // Try to parse as JSON first
      const parsed = JSON.parse(response);
      return {
        summary: parsed.summary || '',
        highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
        recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : []
      };
    } catch {
      // Fallback: parse text format
      const lines = response.split('\n').filter(line => line.trim());
      let currentSection = '';
      const result = {
        summary: '',
        highlights: [] as string[],
        concerns: [] as string[],
        recommendations: [] as string[]
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.toLowerCase().includes('summary')) {
          currentSection = 'summary';
        } else if (trimmed.toLowerCase().includes('highlights')) {
          currentSection = 'highlights';
        } else if (trimmed.toLowerCase().includes('concerns')) {
          currentSection = 'concerns';
        } else if (trimmed.toLowerCase().includes('recommendations')) {
          currentSection = 'recommendations';
        } else if (trimmed.startsWith('-') || trimmed.startsWith('•')) {
          const item = trimmed.substring(1).trim();
          if (currentSection === 'highlights') result.highlights.push(item);
          else if (currentSection === 'concerns') result.concerns.push(item);
          else if (currentSection === 'recommendations') result.recommendations.push(item);
        } else if (currentSection === 'summary' && trimmed.length > 10) {
          result.summary = trimmed;
        }
      }

      return result;
    }
  }

  /**
   * Generate fallback insights when AI fails
   */
  private generateFallbackInsights(
    metrics: SprintMetrics,
    sentiment: SentimentSummary,
    updates: WorkItemUpdate[]
  ): {
    summary: string;
    highlights: string[];
    concerns: string[];
    recommendations: string[];
  } {
    const highlights = [];
    const concerns = [];
    const recommendations = [];

    // Generate based on metrics
    if (metrics.completedToday > 0) {
      highlights.push(`${metrics.completedToday} work items completed today`);
    }
    
    if (metrics.blocked > 0) {
      concerns.push(`${metrics.blocked} work items are currently blocked`);
      recommendations.push('Review and resolve blocked work items');
    }

    if (metrics.daysRemaining < 3) {
      concerns.push('Sprint is nearing completion with limited time remaining');
      recommendations.push('Focus on completing high-priority items');
    }

    if (sentiment.sentimentTrend === 'declining') {
      concerns.push('Team sentiment is declining');
      recommendations.push('Address team concerns and improve communication');
    }

    const summary = `Sprint progress: ${metrics.burndownProgress.toFixed(1)}% complete with ${metrics.daysRemaining} days remaining. ${updates.length} work items updated today.`;

    return {
      summary,
      highlights: highlights.length > 0 ? highlights : ['Team is making steady progress'],
      concerns: concerns.length > 0 ? concerns : ['No major concerns identified'],
      recommendations: recommendations.length > 0 ? recommendations : ['Continue current progress']
    };
  }

  /**
   * Deliver summary via configured channels
   */
  private async deliverSummary(summary: DailySummary): Promise<void> {
    for (const channel of this.config.channels) {
      try {
        switch (channel) {
          case 'console':
            this.deliverToConsole(summary);
            break;
          case 'teams':
            await this.deliverToTeams(summary);
            break;
          case 'email':
            await this.deliverToEmail(summary);
            break;
        }
      } catch (error) {
        console.error(`Error delivering summary via ${channel}:`, error);
      }
    }
  }

  /**
   * Deliver to console
   */
  private deliverToConsole(summary: DailySummary): void {
    console.log('\n=== DAILY SPRINT SUMMARY ===');
    console.log(`Sprint: ${summary.sprintName}`);
    console.log(`Date: ${summary.date}`);
    console.log(`\nSUMMARY:\n${summary.summary}`);
    console.log(`\nHIGHLIGHTS:\n${summary.highlights.map(h => `• ${h}`).join('\n')}`);
    console.log(`\nCONCERNS:\n${summary.concerns.map(c => `• ${c}`).join('\n')}`);
    console.log(`\nRECOMMENDATIONS:\n${summary.recommendations.map(r => `• ${r}`).join('\n')}`);
    console.log('========================\n');
  }

  /**
   * Deliver to Teams
   */
  private async deliverToTeams(summary: DailySummary): Promise<void> {
    const message = this.formatSummaryForTeams(summary);
    await teamsNotificationService.sendNotification({
      type: 'channel',
      recipient: 'General',
      title: `Daily Sprint Summary - ${summary.sprintName}`,
      message: message,
      color: '0078D4'
    });
  }

  /**
   * Deliver to Email via shared email service / backend API
   */
  private async deliverToEmail(summary: DailySummary): Promise<void> {
    const recipients = this.config.recipients?.length
      ? this.config.recipients
      : emailService.getScheduleConfig().recipients;

    if (!recipients || recipients.length === 0) {
      console.warn('[DailySummary] Email channel enabled but no recipients configured');
      return;
    }

    const subject = `Daily Sprint Summary — ${summary.sprintName} (${summary.date})`;
    const html = `
      <h2>Daily Sprint Summary — ${summary.sprintName}</h2>
      <p><strong>Date:</strong> ${summary.date}</p>
      <p>${summary.summary}</p>
      <h3>Highlights</h3>
      <ul>${summary.highlights.map((h) => `<li>${h}</li>`).join('')}</ul>
      <h3>Concerns</h3>
      <ul>${summary.concerns.map((c) => `<li>${c}</li>`).join('')}</ul>
      <h3>Recommendations</h3>
      <ul>${summary.recommendations.map((r) => `<li>${r}</li>`).join('')}</ul>
      <h3>Metrics</h3>
      <ul>
        <li>Completed today: ${summary.metrics.completedToday}</li>
        <li>In progress: ${summary.metrics.inProgress}</li>
        <li>Blocked: ${summary.metrics.blocked}</li>
        <li>Days remaining: ${summary.metrics.daysRemaining}</li>
        <li>Burndown: ${summary.metrics.burndownProgress.toFixed(1)}%</li>
      </ul>
    `;

    const ok = await emailService.sendGenericEmail({
      to: recipients,
      subject,
      html,
      text: this.formatSummaryForTeams(summary),
    });

    if (!ok) {
      console.warn('[DailySummary] Email delivery failed or was skipped');
    }
  }

  /**
   * Format summary for Teams
   */
  private formatSummaryForTeams(summary: DailySummary): string {
    return `
## 📊 Daily Sprint Summary - ${summary.sprintName}
**Date:** ${summary.date}

### 📋 Summary
${summary.summary}

### ✨ Highlights
${summary.highlights.map(h => `• ${h}`).join('\n')}

### ⚠️ Concerns
${summary.concerns.map(c => `• ${c}`).join('\n')}

### 💡 Recommendations
${summary.recommendations.map(r => `• ${r}`).join('\n')}

### 📈 Key Metrics
• **Completed Today:** ${summary.metrics.completedToday}
• **In Progress:** ${summary.metrics.inProgress}
• **Blocked:** ${summary.metrics.blocked}
• **Days Remaining:** ${summary.metrics.daysRemaining}
• **Burndown Progress:** ${summary.metrics.burndownProgress.toFixed(1)}%

### 😊 Team Sentiment
**Overall:** ${summary.sentiment.overallSentiment.toFixed(2)} (${summary.sentiment.sentimentTrend})
`;
  }

  /**
   * Find target sprint
   */
  private async findTargetSprint(sprintId?: string): Promise<Sprint | null> {
    if (sprintId) {
      const sprints = await adoService.getSprints();
      return sprints.find(s => s.id === sprintId) || null;
    }
    
    return await adoService.getCurrentSprint();
  }

  /**
   * Generate unique summary ID
   */
  private generateSummaryId(): string {
    return `summary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load configuration from storage
   */
  private loadConfig(): SchedulerConfig {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        return { ...this.getDefaultConfig(), ...JSON.parse(stored) };
      }
    } catch (error) {
      console.error('Error loading scheduler config:', error);
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
      console.error('Error saving scheduler config:', error);
    }
  }

  /**
   * Load summaries from storage
   */
  private loadSummaries(): void {
    try {
      const stored = localStorage.getItem(this.SUMMARIES_STORAGE_KEY);
      if (stored) {
        this.summaries = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
      this.summaries = [];
    }
  }

  /**
   * Save summaries to storage
   */
  private saveSummaries(): void {
    try {
      // Keep only last 30 summaries
      const recentSummaries = this.summaries.slice(-30);
      localStorage.setItem(this.SUMMARIES_STORAGE_KEY, JSON.stringify(recentSummaries));
    } catch (error) {
      console.error('Error saving summaries:', error);
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): SchedulerConfig {
    return {
      enabled: false,
      dailyTime: '09:00',
      timezone: 'UTC',
      recipients: [],
      includeWeekends: false,
      channels: ['console']
    };
  }
}

// Export singleton instance
const dailySummaryScheduler = new DailySummaryScheduler();
export default dailySummaryScheduler;
