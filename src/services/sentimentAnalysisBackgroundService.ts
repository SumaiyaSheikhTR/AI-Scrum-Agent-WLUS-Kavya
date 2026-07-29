import sentimentAnalysisService, { SentimentAnalysisResult } from './sentimentAnalysisService';
import adoService from './adoService';

interface CachedSentimentData {
  sprintId: string;
  sprintName: string;
  data: SentimentAnalysisResult;
  lastUpdated: number;
  expiresAt: number;
}

interface SentimentAnalysisCache {
  [sprintId: string]: CachedSentimentData;
}

class SentimentAnalysisBackgroundService {
  private cache: SentimentAnalysisCache = {};
  private isRunning = false;
  private orchestratedMode = false;
  private updateInterval: ReturnType<typeof setInterval> | null = null;
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
  private readonly UPDATE_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly STORAGE_KEY = 'sentiment_analysis_cache';

  constructor() {
    this.loadCacheFromStorage();
  }

  public setOrchestratedMode(enabled: boolean): void {
    this.orchestratedMode = enabled;
    if (enabled) {
      this.stopBackgroundUpdates();
    }
  }

  /**
   * Start background sentiment analysis updates (standalone mode).
   * Prefer AutomationOrchestrator which calls updateSentimentData() on a schedule.
   */
  public startBackgroundUpdates(): void {
    if (this.orchestratedMode) {
      this.isRunning = true;
      console.log('[Sentiment] running under AutomationOrchestrator');
      return;
    }

    if (this.isRunning) return;

    console.log('Starting sentiment analysis background service...');
    this.isRunning = true;

    if (typeof document === 'undefined' || !document.hidden) {
      void this.updateSentimentData();
    }

    this.updateInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void this.updateSentimentData();
    }, this.UPDATE_INTERVAL);
  }

  /**
   * Stop background updates
   */
  public stopBackgroundUpdates(): void {
    console.log('Stopping sentiment analysis background service...');
    this.isRunning = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get sentiment analysis data for a sprint (from cache if available)
   */
  public async getSentimentAnalysis(sprintId: string): Promise<SentimentAnalysisResult | null> {
    const cacheKey = sprintId.toString();
    const cached = this.cache[cacheKey];

    // Return cached data if valid
    if (cached && Date.now() < cached.expiresAt) {
      console.log(`Returning cached sentiment data for sprint ${sprintId}`);
      return cached.data;
    }

    // Try to get fresh data
    console.log(`Getting fresh sentiment data for sprint ${sprintId}`);
    try {
      const data = await this.fetchSentimentData(sprintId);
      if (data) {
        this.setCachedData(sprintId, data);
        return data;
      }
    } catch (error) {
      console.error(`Error fetching sentiment data for sprint ${sprintId}:`, error);
    }

    // Return stale data if available
    if (cached) {
      console.log(`Returning stale cached data for sprint ${sprintId}`);
      return cached.data;
    }

    return null;
  }

  /**
   * Get all cached sentiment data
   */
  public getAllCachedData(): CachedSentimentData[] {
    return Object.values(this.cache);
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    console.log('Clearing sentiment analysis cache...');
    this.cache = {};
    this.saveCacheToStorage();
  }

  /**
   * Force refresh sentiment data for a specific sprint
   */
  public async refreshSentimentData(sprintId: string): Promise<SentimentAnalysisResult | null> {
    console.log(`Force refreshing sentiment data for sprint ${sprintId}`);
    try {
      const data = await this.fetchSentimentData(sprintId);
      if (data) {
        this.setCachedData(sprintId, data);
        return data;
      }
    } catch (error) {
      console.error(`Error refreshing sentiment data for sprint ${sprintId}:`, error);
    }
    return null;
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    staleEntries: number;
    oldestEntry?: Date;
    newestEntry?: Date;
  } {
    const entries = Object.values(this.cache);
    const now = Date.now();
    
    const validEntries = entries.filter(entry => now < entry.expiresAt);
    const staleEntries = entries.filter(entry => now >= entry.expiresAt);
    
    const timestamps = entries.map(entry => entry.lastUpdated);
    const oldestTimestamp = timestamps.length > 0 ? Math.min(...timestamps) : null;
    const newestTimestamp = timestamps.length > 0 ? Math.max(...timestamps) : null;

    return {
      totalEntries: entries.length,
      validEntries: validEntries.length,
      staleEntries: staleEntries.length,
      oldestEntry: oldestTimestamp ? new Date(oldestTimestamp) : undefined,
      newestEntry: newestTimestamp ? new Date(newestTimestamp) : undefined
    };
  }

  /**
   * Update sentiment data for current/recent sprints.
   * Called by AutomationOrchestrator or standalone timer.
   */
  public async updateSentimentData(): Promise<void> {
    try {
      console.log('[Sentiment] Fetching sentiment data for current sprints...');

      const sprints = await adoService.getSprints();
      const currentAndRecentSprints = sprints
        .filter(
          (sprint) =>
            sprint.state === 'current' ||
            sprint.state === 'future' ||
            (sprint.state === 'past' &&
              new Date(sprint.endDate) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
        )
        .slice(0, 3); // keep load modest

      console.log(`[Sentiment] Updating ${currentAndRecentSprints.length} sprint(s)`);

      for (let index = 0; index < currentAndRecentSprints.length; index++) {
        const sprint = currentAndRecentSprints[index];
        if (index > 0) {
          await new Promise((resolve) => setTimeout(resolve, 750));
        }
        try {
          const data = await this.fetchSentimentData(sprint.id, sprint.name);
          if (data) {
            this.setCachedData(sprint.id, data, sprint.name);
          }
        } catch (error) {
          console.error(`[Sentiment] Failed for sprint ${sprint.name}:`, error);
        }
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('automation:status', {
            detail: { source: 'sentiment', updatedAt: new Date().toISOString() },
          })
        );
      }

      console.log('[Sentiment] Update completed');
    } catch (error) {
      console.error('[Sentiment] Error updating sentiment data:', error);
      throw error;
    }
  }

  /**
   * Fetch sentiment data for a specific sprint
   */
  private async fetchSentimentData(sprintId: string, sprintName?: string): Promise<SentimentAnalysisResult | null> {
    try {
      // Get work items for the sprint
      const workItems = await adoService.getSprintWorkItems(sprintId);
      
      if (workItems.length === 0) {
        console.log(`No work items found for sprint ${sprintId}`);
        return null;
      }

      // Get comments for the sprint and analyze sentiment
      const comments = await sentimentAnalysisService.getCommentsForAnalysis(sprintId);
      
      if (comments.length === 0) {
        console.log(`No comments found for sprint ${sprintId}`);
        return null;
      }

      // Analyze sentiment for all comments
      const sentimentResults = await sentimentAnalysisService.batchAnalyzeSentiment(comments);
      
      // Calculate aggregate sentiment data
      const totalComments = sentimentResults.length;
      const positiveCount = sentimentResults.filter(r => r.sentiment === 'positive').length;
      const negativeCount = sentimentResults.filter(r => r.sentiment === 'negative').length;
      const neutralCount = sentimentResults.filter(r => r.sentiment === 'neutral').length;
      
      const averageScore = sentimentResults.reduce((sum, r) => sum + r.score, 0) / totalComments;
      const averageConfidence = sentimentResults.reduce((sum, r) => sum + r.confidence, 0) / totalComments;
      
      const sentimentData: SentimentAnalysisResult = {
        text: `Sprint ${sprintName || sprintId} sentiment analysis`,
        sentiment: averageScore > 0.1 ? 'positive' : averageScore < -0.1 ? 'negative' : 'neutral',
        score: averageScore,
        confidence: averageConfidence,
        summary: `Analyzed ${totalComments} comments: ${positiveCount} positive, ${negativeCount} negative, ${neutralCount} neutral`
      };
      
      console.log(`Sentiment analysis completed for sprint ${sprintName || sprintId}: ${totalComments} comments analyzed`);
      
      return sentimentData;
    } catch (error) {
      console.error(`Error fetching sentiment data for sprint ${sprintId}:`, error);
      throw error;
    }
  }

  /**
   * Cache sentiment data
   */
  private setCachedData(sprintId: string, data: SentimentAnalysisResult, sprintName?: string): void {
    const now = Date.now();
    const cacheKey = sprintId;
    
    this.cache[cacheKey] = {
      sprintId,
      sprintName: sprintName || `Sprint ${sprintId}`,
      data,
      lastUpdated: now,
      expiresAt: now + this.CACHE_DURATION
    };

    this.saveCacheToStorage();
    console.log(`Cached sentiment data for sprint ${sprintName || sprintId}`);
  }

  /**
   * Load cache from localStorage
   */
  private loadCacheFromStorage(): void {
    try {
      const cached = localStorage.getItem(this.STORAGE_KEY);
      if (cached) {
        const parsedCache: SentimentAnalysisCache = JSON.parse(cached);
        
        // Filter out expired entries
        const now = Date.now();
        this.cache = Object.fromEntries(
          Object.entries(parsedCache).filter(([_, entry]) => 
            entry.expiresAt > now
          )
        ) as SentimentAnalysisCache;
        
        console.log(`Loaded sentiment analysis cache: ${Object.keys(this.cache).length} entries`);
      }
    } catch (error) {
      console.error('Error loading sentiment analysis cache from storage:', error);
      this.cache = {};
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveCacheToStorage(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Error saving sentiment analysis cache to storage:', error);
    }
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredKeys = Object.entries(this.cache)
      .filter(([_, entry]) => entry.expiresAt <= now)
      .map(([key, _]) => key);

    if (expiredKeys.length > 0) {
      console.log(`Cleaning up ${expiredKeys.length} expired cache entries`);
      expiredKeys.forEach(key => delete this.cache[key]);
      this.saveCacheToStorage();
    }
  }
}

// Export singleton instance
const sentimentAnalysisBackgroundService = new SentimentAnalysisBackgroundService();
export default sentimentAnalysisBackgroundService;
