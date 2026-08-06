import axios from 'axios';
import adoService, { WorkItem, WorkItemComment } from './adoService';

export interface SentimentAnalysisConfig {
  enableSentimentAnalysis: boolean;
  confidenceThreshold: number;
  analyzeAllComments: boolean;
  includeKeywordExtraction: boolean;
  includeEntityAnalysis: boolean;
  sentimentRefreshInterval: number; // minutes
  alertOnNegativeTrend: boolean;
  negativeThreshold: number;
  positiveThreshold: number;
  defaultLanguage: string;
  useRealData: boolean;
}

export interface SentimentAnalysisResult {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number; // -1 to 1 where -1 is very negative, 1 is very positive
  confidence: number; // 0 to 1
  entities?: {
    text: string;
    type: string;
    sentiment: 'positive' | 'negative' | 'neutral';
  }[];
  keywords?: string[];
  summary?: string;
}

export interface CommentData {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  workItemId: number;
  workItemTitle: string;
}

class SentimentAnalysisService {
  private config: SentimentAnalysisConfig = {
    enableSentimentAnalysis: true,
    confidenceThreshold: 0.7,
    analyzeAllComments: true,
    includeKeywordExtraction: true,
    includeEntityAnalysis: true,
    sentimentRefreshInterval: 60, // minutes
    alertOnNegativeTrend: true,
    negativeThreshold: -0.3,
    positiveThreshold: 0.3,
    defaultLanguage: 'en',
    useRealData: true  // Always true by default
  };

  constructor() {
    this.loadConfig();
    
    // Log the config to verify
    console.log('Sentiment analysis config initialized:', this.config);
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): void {
    try {
      const configStr = localStorage.getItem('sentimentAnalysisConfig');
      if (configStr) {
        this.config = { ...this.config, ...JSON.parse(configStr), useRealData: true };
      }
      console.log('Loaded sentiment analysis config:', this.config);
    } catch (error) {
      console.error('Error loading sentiment analysis config:', error);
    }
  }
  
  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('sentimentAnalysisConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving sentiment analysis config:', error);
    }
  }

  /**
   * Get the current configuration
   * @returns The current sentiment analysis configuration
   */
  getConfig(): SentimentAnalysisConfig {
    return { ...this.config };
  }

  /**
   * Update the configuration
   * @param config New configuration (partial or complete)
   */
  updateConfig(config: Partial<SentimentAnalysisConfig>): void {
    // Force real ADO data — dummy/sample datasets are not supported
    const updatedConfig = { ...this.config, ...config, useRealData: true };
    this.config = updatedConfig;
    
    try {
      localStorage.setItem('sentimentAnalysisConfig', JSON.stringify(this.config));
      console.log('Updated sentiment analysis config:', this.config);
      
      // Force a refresh of the data
      const event = new CustomEvent('sentiment-config-updated', { 
        detail: { useRealData: true } 
      });
      window.dispatchEvent(event);
    } catch (error) {
      console.error('Error saving sentiment analysis config:', error);
      throw new Error('Failed to save sentiment analysis configuration');
    }
  }

  /**
   * Get comments for sentiment analysis
   * @param sprintId Optional sprint ID to filter comments
   * @param workItemId Optional work item ID to filter comments
   * @param teamName Optional team name to filter comments
   * @returns Promise with array of comments
   */
  async getCommentsForAnalysis(sprintId?: string, workItemId?: number, teamName?: string): Promise<CommentData[]> {
    // Empty array to return if no comments are found
    const NO_COMMENTS: CommentData[] = [];
    
    console.log('Fetching real comments from ADO for sentiment analysis');
    console.log('Sprint ID:', sprintId);
    console.log('Work Item ID:', workItemId);
    
    try {
      // Force reload ADO config to ensure it's up to date
      const isAdoConfigured = adoService.loadConfig();
      console.log('ADO configured:', isAdoConfigured);
      
      if (!isAdoConfigured) {
        console.error('ADO is not configured');
        return NO_COMMENTS;
      }
      
      // Test ADO connection by getting sprints
      const sprints = await adoService.getSprints();
      console.log('ADO sprints loaded:', sprints.length);
      
      if (sprints.length === 0) {
        console.error('No sprints found in ADO');
        return NO_COMMENTS;
      }
      
      // If workItemId is provided, get comments for that specific work item
      if (workItemId) {
        console.log(`Fetching comments for work item ${workItemId}`);
        const workItem = await adoService.getWorkItem(workItemId);
        if (!workItem) {
          console.error(`Work item ${workItemId} not found`);
          return NO_COMMENTS;
        }
        
        console.log('Work item found:', JSON.stringify(workItem));
        const comments = await adoService.getWorkItemComments(workItemId, workItem.title);
        console.log(`Found ${comments.length} comments for work item ${workItemId}`);
        
        return comments;
      }
      
      // If sprintId is provided, get comments for User Stories and Bugs in that sprint
      if (sprintId) {
        console.log(`Fetching User Story and Bug comments for sprint ${sprintId}${teamName ? `, team ${teamName}` : ''}`);
        
        // Get comments grouped by work item for User Stories and Bugs only
        const commentsByWorkItem = await adoService.getCommentsGroupedByWorkItem(
          sprintId, 
          ['User Story', 'Bug']
        );
        
        console.log(`Found comments for ${commentsByWorkItem.size} User Stories and Bugs`);
        
        // Flatten the map to an array of comments
        let allComments: WorkItemComment[] = [];
        commentsByWorkItem.forEach(({ workItem, comments }) => {
          // Filter by team name if provided
          if (teamName && workItem.assignedTo) {
            // This is a simple implementation - in a real app, you would need to
            // check if the assignedTo user belongs to the specified team
            // For now, we'll just include all comments if no team is specified
            allComments.push(...comments);
          } else if (!teamName) {
            allComments.push(...comments);
          }
        });
        
        console.log(`Found comments for ${commentsByWorkItem.size} User Stories and Bugs`);
        
        // If team name is provided, filter the comments
        if (teamName) {
          console.log(`Filtering comments by team: ${teamName}`);
          // In a real implementation, you would filter by team name here
          // For now, we'll just log that we're filtering
        }
        
        console.log(`Total comments found: ${allComments.length}`);
        
        return allComments;
      }
      
      // If neither workItemId nor sprintId is provided, get current sprint
      console.log('Fetching current sprint');
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        console.error('No current sprint found');
        return NO_COMMENTS;
      }
      
      console.log(`Current sprint found: ${currentSprint.name} (${currentSprint.id})`);
      
      // Get comments for User Stories and Bugs in the current sprint
      const commentsByWorkItem = await adoService.getCommentsGroupedByWorkItem(
        currentSprint.id, 
        ['User Story', 'Bug']
      );
      
      console.log(`Found comments for ${commentsByWorkItem.size} User Stories and Bugs`);
      
      // Flatten the map to an array of comments
      const allComments: WorkItemComment[] = [];
      commentsByWorkItem.forEach(({ comments }) => {
        allComments.push(...comments);
      });
      
      console.log(`Total comments found: ${allComments.length}`);
      
      return allComments;
    } catch (error) {
      console.error('Error fetching real comments from ADO:', error);
      return NO_COMMENTS;
    }
  }
  
  /**
   * Get comments grouped by work item for sentiment analysis
   * @param sprintId Optional sprint ID to filter comments
   * @param teamName Optional team name to filter comments
   * @returns Promise with map of work item ID to comments and sentiment
   */
  async getCommentsGroupedByWorkItem(sprintId?: string, teamName?: string): Promise<Map<number, {
    workItem: WorkItem, 
    comments: WorkItemComment[],
    sentiment?: {
      overallSentiment: 'positive' | 'negative' | 'neutral',
      averageScore: number,
      commentCount: number
    }
  }>> {
    try {
      // Get the sprint ID to use
      let targetSprintId: string | undefined = sprintId;
      
      if (!targetSprintId) {
        const currentSprint = await adoService.getCurrentSprint();
        if (!currentSprint) {
          console.error('No current sprint found');
          return new Map();
        }
        targetSprintId = currentSprint.id;
      }
      
      // Get comments grouped by work item for User Stories and Bugs only
      const commentsByWorkItem = await adoService.getCommentsGroupedByWorkItem(
        targetSprintId, 
        ['User Story', 'Bug']
      );
      
      console.log(`Found comments for ${commentsByWorkItem.size} User Stories and Bugs`);
      
      // If team name is provided, filter the work items
      if (teamName) {
        console.log(`Filtering work items by team: ${teamName}`);
        // In a real implementation, you would filter by team name here
        // For now, we'll just log that we're filtering
      }
      
      console.log(`Found comments for ${commentsByWorkItem.size} User Stories and Bugs`);
      
      // Calculate sentiment for each work item
      const result = new Map<number, {
        workItem: WorkItem, 
        comments: WorkItemComment[],
        sentiment?: {
          overallSentiment: 'positive' | 'negative' | 'neutral',
          averageScore: number,
          commentCount: number
        }
      }>();
      
      for (const [workItemId, { workItem, comments }] of Array.from(commentsByWorkItem.entries())) {
        // Analyze sentiment for all comments in this work item
        const sentiments = await this.batchAnalyzeSentiment(comments);
        
        // Calculate average sentiment score
        const averageScore = sentiments.reduce((sum: number, item: SentimentAnalysisResult) => sum + item.score, 0) / sentiments.length;
        
        // Determine overall sentiment
        let overallSentiment: 'positive' | 'negative' | 'neutral';
        if (averageScore > 0.1) {
          overallSentiment = 'positive';
        } else if (averageScore < -0.1) {
          overallSentiment = 'negative';
        } else {
          overallSentiment = 'neutral';
        }
        
        result.set(workItemId, {
          workItem,
          comments,
          sentiment: {
            overallSentiment,
            averageScore,
            commentCount: comments.length
          }
        });
      }
      
      return result;
    } catch (error) {
      console.error('Error getting comments grouped by work item:', error);
      return new Map();
    }
  }
  
  /**
   * Analyze the sentiment of a batch of comments
   * @param comments Array of comments to analyze
   * @returns Promise with array of sentiment analysis results
   */
  async batchAnalyzeSentiment(comments: CommentData[]): Promise<SentimentAnalysisResult[]> {
    const results: SentimentAnalysisResult[] = [];
    
    for (const comment of comments) {
      try {
        const result = await this.analyzeSentiment(comment.text);
        results.push(result);
      } catch (error) {
        console.error(`Error analyzing sentiment for comment ${comment.id}:`, error);
        // Add a neutral sentiment as fallback
        results.push(this.generateFallbackSentiment(comment.text));
      }
    }
    
    return results;
  }
  
  /**
   * Generate a fallback sentiment analysis result
   * @param text The text to analyze
   * @returns A simple sentiment analysis result
   */
  private generateFallbackSentiment(text: string): SentimentAnalysisResult {
    // Simple fallback sentiment analysis
    const lowerText = text.toLowerCase();
    
    // Check for obvious positive/negative indicators
    const hasPositive = lowerText.includes('good') || 
                        lowerText.includes('great') || 
                        lowerText.includes('excellent') ||
                        lowerText.includes('thanks') ||
                        lowerText.includes('happy');
                        
    const hasNegative = lowerText.includes('bad') || 
                        lowerText.includes('issue') || 
                        lowerText.includes('problem') ||
                        lowerText.includes('bug') ||
                        lowerText.includes('error');
    
    let sentiment: 'positive' | 'negative' | 'neutral';
    let score = 0;
    
    if (hasPositive && !hasNegative) {
      sentiment = 'positive';
      score = 0.5;
    } else if (hasNegative && !hasPositive) {
      sentiment = 'negative';
      score = -0.5;
    } else if (hasPositive && hasNegative) {
      sentiment = 'neutral';
      score = 0;
    } else {
      sentiment = 'neutral';
      score = 0;
    }
    
    // Extract some keywords
    const words = text.toLowerCase().split(/\W+/).filter(word => 
      word.length > 3 && 
      !['this', 'that', 'with', 'from', 'have', 'were', 'they', 'will', 'what', 'when', 'where', 'which'].includes(word)
    );
    
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });
    
    // Sort by frequency and take top 5
    const keywords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0]);
    
    return {
      text,
      sentiment,
      score,
      confidence: 0.6, // Medium confidence for fallback
      keywords,
      summary: `Fallback sentiment analysis detected ${sentiment} sentiment.`
    };
  }
  
  /**
   * Analyze the sentiment of a single comment using Hugging Face model
   * @param text The comment text to analyze
   * @returns Promise with sentiment analysis result
   */
  async analyzeSentiment(text: string): Promise<SentimentAnalysisResult> {
    try {
      console.log('Analyzing sentiment with Hugging Face model');
      
      // Get the API URL from environment variables
      const apiUrl = process.env.REACT_APP_SENTIMENT_ANALYSIS_API_URL || 'http://localhost:3001/api/sentiment-analysis';
      
      // Truncate very long text to avoid request header size issues
      const maxLength = 1000;
      const truncatedText = text.length > maxLength 
        ? text.substring(0, maxLength) + "..." 
        : text;
      
      // Call the sentiment analysis API
      const response = await axios.post(apiUrl, { text: truncatedText });
      
      // Extract keywords if available
      const extractedKeywords = response.data.keywords || [];
      
      // Map the response to our SentimentAnalysisResult interface
      return {
        text,
        sentiment: response.data.sentiment || 'neutral',
        score: response.data.score || 0,
        confidence: response.data.confidence || 0.7,
        keywords: extractedKeywords,
        summary: response.data.summary || `Sentiment analysis detected ${response.data.sentiment || 'neutral'} sentiment.`
      };
    } catch (error) {
      console.error('Error analyzing sentiment with Hugging Face model:', error);
      // If the Hugging Face model fails, use the fallback sentiment generator
      return this.generateFallbackSentiment(text);
    }
  }
  
  /**
   * Analyze sentiment trends over time
   * @param comments Array of comments to analyze
   * @returns Promise with trend analysis results
   */
  async analyzeSentimentTrends(comments: CommentData[]): Promise<{
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
    // Sort comments by timestamp
    const sortedComments = [...comments].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
    
    // Analyze sentiment for each comment
    const sentiments = await this.batchAnalyzeSentiment(sortedComments);
    
    // Create time series data
    const timeSeriesData = sentiments.map((sentiment, index) => ({
      timestamp: sortedComments[index].timestamp,
      sentiment: sentiment.sentiment,
      score: sentiment.score
    }));
    
    // Calculate trend
    let trendScore = 0;
    if (timeSeriesData.length >= 2) {
      // Simple linear regression to determine trend
      const n = timeSeriesData.length;
      const timestamps = timeSeriesData.map((_, i) => i); // Use indices as x values
      const scores = timeSeriesData.map(item => item.score);
      
      const sumX = timestamps.reduce((sum, x) => sum + x, 0);
      const sumY = scores.reduce((sum, y) => sum + y, 0);
      const sumXY = timestamps.reduce((sum, x, i) => sum + x * scores[i], 0);
      const sumXX = timestamps.reduce((sum, x) => sum + x * x, 0);
      
      // Calculate slope of the trend line
      trendScore = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }
    
    // Determine overall trend
    let overallTrend: 'improving' | 'declining' | 'stable';
    if (trendScore > 0.05) {
      overallTrend = 'improving';
    } else if (trendScore < -0.05) {
      overallTrend = 'declining';
    } else {
      overallTrend = 'stable';
    }
    
    // Calculate average score
    const averageScore = sentiments.length > 0
      ? sentiments.reduce((sum, sentiment) => sum + sentiment.score, 0) / sentiments.length
      : 0;
    
    // Determine overall sentiment based on average score
    let overallSentiment: 'positive' | 'negative' | 'neutral';
    if (averageScore > 0.1) {
      overallSentiment = 'positive';
    } else if (averageScore < -0.1) {
      overallSentiment = 'negative';
    } else {
      overallSentiment = 'neutral';
    }
    
    // Calculate sentiment distribution
    const sentimentDistribution = {
      positive: sentiments.filter(s => s.sentiment === 'positive').length,
      neutral: sentiments.filter(s => s.sentiment === 'neutral').length,
      negative: sentiments.filter(s => s.sentiment === 'negative').length
    };
    
    // Extract keywords from all comments
    const allKeywords = sentiments
      .flatMap(s => s.keywords || [])
      .filter(Boolean);
    
    // Count keyword occurrences
    const keywordCounts: Record<string, number> = {};
    allKeywords.forEach(keyword => {
      keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
    });
    
    // Get top keywords
    const topKeywords = Object.entries(keywordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([keyword]) => keyword);
    
    // Format sentiment over time for the expected return type
    const sentimentOverTime = timeSeriesData.map(item => ({
      timestamp: item.timestamp,
      score: item.score
    }));
    
    // Generate summary
    let summary = `Analysis of ${comments.length} comments shows an overall ${overallSentiment} sentiment `;
    summary += `with an average score of ${averageScore.toFixed(2)}. `;
    
    if (overallTrend === 'improving') {
      summary += 'The sentiment trend is improving over time.';
    } else if (overallTrend === 'declining') {
      summary += 'The sentiment trend is declining over time.';
    } else {
      summary += 'The sentiment trend is stable over time.';
    }
    
    return {
      overallSentiment,
      averageScore,
      sentimentDistribution,
      topKeywords,
      sentimentOverTime,
      summary
    };
  }
}

// Create and export a singleton instance
const sentimentAnalysisService = new SentimentAnalysisService();
export default sentimentAnalysisService;
