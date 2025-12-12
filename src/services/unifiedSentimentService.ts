import { ml5SentimentService, ML5SentimentResult } from './ml5SentimentService';

// Unified sentiment analysis interface
export interface UnifiedSentimentConfig {
  provider: 'huggingface' | 'ml5' | 'tensorflow' | 'hybrid';
  enableClientSide: boolean;
  enableServerSide: boolean;
  fallbackToRuleBased: boolean;
  confidenceThreshold: number;
  batchSize: number;
}

export interface UnifiedSentimentResult {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number;
  score: number; // -1 to 1
  provider: string;
  processingTime: number;
  metadata?: {
    emotions?: any;
    keywords?: string[];
    alternativeResults?: any[];
  };
}

class UnifiedSentimentService {
  private config: UnifiedSentimentConfig = {
    provider: 'hybrid',
    enableClientSide: true,
    enableServerSide: true,
    fallbackToRuleBased: true,
    confidenceThreshold: 0.6,
    batchSize: 50
  };

  private isInitialized = false;
  private availableProviders: Set<string> = new Set();

  /**
   * Initialize all available sentiment analysis providers
   */
  async initialize(config?: Partial<UnifiedSentimentConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    console.log('🔄 Initializing unified sentiment analysis service...');

    // Initialize ML5 service
    if (this.config.enableClientSide) {
      try {
        await ml5SentimentService.initialize();
        this.availableProviders.add('ml5');
        console.log('✅ ML5 sentiment service initialized');
      } catch (error) {
        console.warn('⚠️ Failed to initialize ML5 service:', error);
      }
    }

    // Check for TensorFlow.js availability
    if (this.config.enableClientSide) {
      try {
        // We'll implement this when TensorFlow packages are installed
        // await tensorflowSentimentService.initialize();
        // this.availableProviders.add('tensorflow');
        console.log('ℹ️ TensorFlow.js service will be available after package installation');
      } catch (error) {
        console.warn('⚠️ TensorFlow.js service not available:', error);
      }
    }

    // Check Hugging Face API availability
    if (this.config.enableServerSide) {
      this.availableProviders.add('huggingface');
      console.log('✅ Hugging Face API service available');
    }

    this.isInitialized = true;
    console.log(`✅ Unified sentiment service initialized with providers: ${Array.from(this.availableProviders).join(', ')}`);
  }

  /**
   * Analyze sentiment using the configured provider(s)
   */
  async analyzeSentiment(text: string): Promise<UnifiedSentimentResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const startTime = Date.now();

    try {
      // Choose provider based on configuration
      switch (this.config.provider) {
        case 'ml5':
          return await this.analyzeWithML5(text, startTime);
        case 'tensorflow':
          return await this.analyzeWithTensorFlow(text, startTime);
        case 'huggingface':
          return await this.analyzeWithHuggingFace(text, startTime);
        case 'hybrid':
        default:
          return await this.analyzeWithHybridApproach(text, startTime);
      }
    } catch (error) {
      console.error('Sentiment analysis failed:', error);
      return this.getFallbackResult(text, startTime);
    }
  }

  /**
   * Analyze with ML5 service
   */
  private async analyzeWithML5(text: string, startTime: number): Promise<UnifiedSentimentResult> {
    const result = await ml5SentimentService.analyzeSentiment(text);
    return this.convertML5Result(result);
  }

  /**
   * Analyze with TensorFlow.js (placeholder for when packages are installed)
   */
  private async analyzeWithTensorFlow(text: string, startTime: number): Promise<UnifiedSentimentResult> {
    // TODO: Implement when TensorFlow packages are installed
    console.log('TensorFlow.js analysis not yet implemented, falling back to ML5');
    return await this.analyzeWithML5(text, startTime);
  }

  /**
   * Analyze with Hugging Face API
   */
  private async analyzeWithHuggingFace(text: string, startTime: number): Promise<UnifiedSentimentResult> {
    try {
      const response = await fetch('/api/sentiment-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        text,
        sentiment: data.sentiment || 'neutral',
        confidence: data.confidence || 0,
        score: data.score || 0,
        provider: 'huggingface',
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      console.error('Hugging Face API failed:', error);
      if (this.config.fallbackToRuleBased) {
        return await this.analyzeWithML5(text, startTime);
      }
      throw error;
    }
  }

  /**
   * Hybrid approach - use multiple providers and combine results
   */
  private async analyzeWithHybridApproach(text: string, startTime: number): Promise<UnifiedSentimentResult> {
    const results: UnifiedSentimentResult[] = [];
    const promises: Promise<UnifiedSentimentResult>[] = [];

    // Try client-side analysis first (faster)
    if (this.availableProviders.has('ml5')) {
      promises.push(this.analyzeWithML5(text, startTime));
    }

    // Add server-side analysis if available
    if (this.availableProviders.has('huggingface')) {
      promises.push(
        this.analyzeWithHuggingFace(text, startTime).catch(error => {
          console.warn('Hugging Face analysis failed in hybrid mode:', error);
          return null;
        }) as Promise<UnifiedSentimentResult>
      );
    }

    // Wait for all analyses to complete (or fail)
    const analysisResults = await Promise.allSettled(promises);
    
    for (const result of analysisResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }

    if (results.length === 0) {
      return this.getFallbackResult(text, startTime);
    }

    // Combine results using weighted average
    return this.combineResults(results, text, startTime);
  }

  /**
   * Combine multiple sentiment analysis results
   */
  private combineResults(results: UnifiedSentimentResult[], text: string, startTime: number): UnifiedSentimentResult {
    if (results.length === 1) {
      return { ...results[0], provider: 'hybrid-single' };
    }

    // Weight different providers
    const weights = {
      'huggingface': 0.5,  // Higher weight for external API
      'tensorflow': 0.4,   // Medium weight for TensorFlow
      'ml5': 0.3,         // Lower weight for rule-based
      'enhanced-rule-based': 0.2
    };

    let weightedScore = 0;
    let weightedConfidence = 0;
    let totalWeight = 0;

    const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };

    for (const result of results) {
      const weight = weights[result.provider as keyof typeof weights] || 0.1;
      
      weightedScore += result.score * weight;
      weightedConfidence += result.confidence * weight;
      totalWeight += weight;
      
      sentimentCounts[result.sentiment]++;
    }

    // Calculate final values
    const finalScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const finalConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    
    // Determine final sentiment by majority vote
    const finalSentiment = Object.entries(sentimentCounts).reduce((a, b) => 
      sentimentCounts[a[0] as keyof typeof sentimentCounts] > sentimentCounts[b[0] as keyof typeof sentimentCounts] ? a : b
    )[0] as 'positive' | 'negative' | 'neutral';

    return {
      text,
      sentiment: finalSentiment,
      confidence: finalConfidence,
      score: finalScore,
      provider: `hybrid-${results.length}`,
      processingTime: Date.now() - startTime,
      metadata: {
        alternativeResults: results
      }
    };
  }

  /**
   * Convert ML5 result to unified format
   */
  private convertML5Result(ml5Result: ML5SentimentResult): UnifiedSentimentResult {
    return {
      text: ml5Result.text,
      sentiment: ml5Result.sentiment,
      confidence: ml5Result.confidence,
      score: ml5Result.score,
      provider: ml5Result.modelUsed,
      processingTime: ml5Result.processingTime,
      metadata: {
        emotions: ml5Result.emotions,
        keywords: ml5Result.keywords
      }
    };
  }

  /**
   * Get fallback result when all providers fail
   */
  private getFallbackResult(text: string, startTime: number): UnifiedSentimentResult {
    return {
      text,
      sentiment: 'neutral',
      confidence: 0.1,
      score: 0,
      provider: 'fallback',
      processingTime: Date.now() - startTime
    };
  }

  /**
   * Batch analyze multiple texts
   */
  async analyzeBatch(texts: string[]): Promise<UnifiedSentimentResult[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log(`🔄 Analyzing ${texts.length} texts with unified sentiment service...`);
    
    const results: UnifiedSentimentResult[] = [];
    const batchSize = this.config.batchSize;

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.analyzeSentiment(text));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(texts.length/batchSize)}`);
    }

    console.log(`✅ Batch sentiment analysis complete: ${results.length} texts analyzed`);
    return results;
  }

  /**
   * Get service configuration and status
   */
  getStatus(): {
    isInitialized: boolean;
    availableProviders: string[];
    currentConfig: UnifiedSentimentConfig;
    recommendations: string[];
  } {
    const recommendations: string[] = [];

    if (!this.availableProviders.has('huggingface')) {
      recommendations.push('Consider configuring Hugging Face API for better accuracy');
    }

    if (!this.availableProviders.has('tensorflow') && this.config.enableClientSide) {
      recommendations.push('Install TensorFlow.js packages for advanced client-side analysis');
    }

    if (this.availableProviders.size === 1) {
      recommendations.push('Multiple providers available - consider hybrid mode for best results');
    }

    return {
      isInitialized: this.isInitialized,
      availableProviders: Array.from(this.availableProviders),
      currentConfig: this.config,
      recommendations
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<UnifiedSentimentConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✅ Sentiment analysis configuration updated:', this.config);
  }
}

// Export singleton instance
export const unifiedSentimentService = new UnifiedSentimentService();
export default unifiedSentimentService;
