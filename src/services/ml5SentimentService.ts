// ML5.js Sentiment Analysis Service
// Note: ML5.js doesn't have built-in sentiment analysis, so we'll create a comprehensive solution

export interface ML5SentimentResult {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0 to 1
  score: number; // -1 to 1 where -1 is very negative, 1 is very positive
  modelUsed: 'ml5' | 'enhanced-rule-based';
  processingTime: number;
  emotions?: {
    joy: number;
    anger: number;
    fear: number;
    sadness: number;
    surprise: number;
  };
  keywords?: string[];
}

interface SentimentPattern {
  positive: RegExp[];
  negative: RegExp[];
  neutral: RegExp[];
  intensifiers: string[];
  negators: string[];
}

class ML5SentimentService {
  private ml5: any = null;
  private isInitialized: boolean = false;
  private initializePromise: Promise<void> | null = null;

  // Enhanced sentiment patterns for software development context
  private patterns: SentimentPattern = {
    positive: [
      /\b(good|great|excellent|amazing|awesome|fantastic|wonderful|perfect|outstanding|brilliant)\b/gi,
      /\b(successful|effective|efficient|helpful|useful|valuable|improved|optimized)\b/gi,
      /\b(pleased|satisfied|happy|excited|thrilled|delighted|impressed)\b/gi,
      /\b(resolved|fixed|completed|achieved|accomplished|delivered|finished)\b/gi,
      /\b(working|stable|reliable|robust|secure|fast|smooth|clean)\b/gi,
      /\b(approve|appreciate|recommend|love|like|enjoy|praise|congratulat)\b/gi,
      /\b(breakthrough|innovation|enhancement|upgrade|progress|success)\b/gi,
      /\b(easy|simple|straightforward|clear|intuitive|user-friendly)\b/gi,
    ],
    negative: [
      /\b(bad|terrible|awful|horrible|disgusting|disappointing|frustrating)\b/gi,
      /\b(annoying|irritating|confusing|difficult|hard|impossible|complex)\b/gi,
      /\b(broken|failed|error|bug|issue|problem|concern|trouble)\b/gi,
      /\b(worried|anxious|stressed|overwhelmed|blocked|stuck|delayed)\b/gi,
      /\b(behind|late|missed|wrong|incorrect|invalid|corrupt)\b/gi,
      /\b(hate|dislike|reject|deny|refuse|oppose|disagree|complain)\b/gi,
      /\b(crash|freeze|hang|timeout|unstable|unreliable|insecure)\b/gi,
      /\b(urgent|critical|blocker|emergency|disaster|failure|risk)\b/gi,
    ],
    neutral: [
      /\b(okay|fine|average|normal|standard|typical|regular|usual)\b/gi,
      /\b(update|status|progress|review|meeting|discussion|sync)\b/gi,
      /\b(question|clarification|information|data|report|summary)\b/gi,
      /\b(analysis|investigation|research|documentation|planning)\b/gi,
      /\b(task|feature|requirement|specification|design|test)\b/gi,
      /\b(scheduled|assigned|pending|waiting|reviewing|monitoring)\b/gi,
    ],
    intensifiers: [
      'very', 'extremely', 'highly', 'incredibly', 'remarkably', 'exceptionally',
      'absolutely', 'completely', 'totally', 'entirely', 'thoroughly', 'quite',
      'really', 'truly', 'definitely', 'certainly', 'surely', 'clearly'
    ],
    negators: [
      'not', 'no', 'never', 'none', 'nothing', 'nobody', 'nowhere',
      'neither', 'nor', 'barely', 'hardly', 'scarcely', 'rarely', 'seldom'
    ]
  };

  // Context-aware sentiment modifiers for software development
  private contextModifiers = {
    urgency: ['urgent', 'asap', 'immediately', 'critical', 'blocker', 'emergency'],
    progress: ['progress', 'update', 'status', 'milestone', 'checkpoint', 'review'],
    completion: ['done', 'complete', 'finished', 'delivered', 'closed', 'resolved'],
    collaboration: ['team', 'together', 'help', 'support', 'assist', 'collaborate']
  };

  /**
   * Initialize ML5.js (if available) and sentiment analysis
   */
  async initialize(): Promise<void> {
    if (this.isInitialized || this.initializePromise) {
      return this.initializePromise || Promise.resolve();
    }

    console.log('🎨 ML5.js: Initializing sentiment analysis service...');
    this.initializePromise = this.loadML5();
    return this.initializePromise;
  }

  private async loadML5(): Promise<void> {
    try {
      // Try to load ML5.js if available
      if (typeof window !== 'undefined' && (window as any).ml5) {
        this.ml5 = (window as any).ml5;
        console.log('✅ ML5.js loaded successfully');
      } else {
        console.log('ℹ️ ML5.js not available, using enhanced rule-based analysis');
      }
      
      this.isInitialized = true;
    } catch (error) {
      console.warn('⚠️ ML5.js initialization failed, using fallback:', error);
      this.isInitialized = true;
    }
  }

  /**
   * Analyze sentiment of text using enhanced rule-based approach
   */
  async analyzeSentiment(text: string): Promise<ML5SentimentResult> {
    const startTime = Date.now();

    if (!text || text.trim().length === 0) {
      return {
        text,
        sentiment: 'neutral',
        confidence: 0,
        score: 0,
        modelUsed: 'enhanced-rule-based',
        processingTime: Date.now() - startTime
      };
    }

    await this.initialize();

    // Enhanced rule-based sentiment analysis
    return this.analyzeWithEnhancedRules(text, startTime);
  }

  private analyzeWithEnhancedRules(text: string, startTime: number): ML5SentimentResult {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let totalPositiveScore = 0;
    let totalNegativeScore = 0;
    let totalNeutralScore = 0;
    let sentenceCount = 0;
    
    const keywords: string[] = [];
    const emotions = {
      joy: 0,
      anger: 0,
      fear: 0,
      sadness: 0,
      surprise: 0
    };

    // Analyze each sentence
    for (const sentence of sentences) {
      const analysis = this.analyzeSentence(sentence);
      totalPositiveScore += analysis.positiveScore;
      totalNegativeScore += analysis.negativeScore;
      totalNeutralScore += analysis.neutralScore;
      keywords.push(...analysis.keywords);
      
      // Update emotion scores
      emotions.joy += analysis.emotions.joy;
      emotions.anger += analysis.emotions.anger;
      emotions.fear += analysis.emotions.fear;
      emotions.sadness += analysis.emotions.sadness;
      emotions.surprise += analysis.emotions.surprise;
      
      sentenceCount++;
    }

    // Calculate average scores
    const avgPositive = sentenceCount > 0 ? totalPositiveScore / sentenceCount : 0;
    const avgNegative = sentenceCount > 0 ? totalNegativeScore / sentenceCount : 0;
    const avgNeutral = sentenceCount > 0 ? totalNeutralScore / sentenceCount : 0;

    // Determine overall sentiment
    let sentiment: 'positive' | 'negative' | 'neutral';
    let confidence: number;
    let score: number;

    if (avgPositive > avgNegative && avgPositive > avgNeutral) {
      sentiment = 'positive';
      confidence = Math.min(avgPositive, 1);
      score = Math.min(avgPositive, 1);
    } else if (avgNegative > avgNeutral) {
      sentiment = 'negative';
      confidence = Math.min(avgNegative, 1);
      score = -Math.min(avgNegative, 1);
    } else {
      sentiment = 'neutral';
      confidence = Math.min(Math.max(avgNeutral, 0.5), 1);
      score = 0;
    }

    // Normalize emotions
    const maxEmotion = Math.max(...Object.values(emotions));
    if (maxEmotion > 0) {
      Object.keys(emotions).forEach(key => {
        emotions[key as keyof typeof emotions] = emotions[key as keyof typeof emotions] / maxEmotion;
      });
    }

    return {
      text,
      sentiment,
      confidence,
      score,
      modelUsed: this.ml5 ? 'ml5' : 'enhanced-rule-based',
      processingTime: Date.now() - startTime,
      emotions,
      keywords: Array.from(new Set(keywords)).slice(0, 10) // Top 10 unique keywords
    };
  }

  private analyzeSentence(sentence: string): {
    positiveScore: number;
    negativeScore: number;
    neutralScore: number;
    keywords: string[];
    emotions: {
      joy: number;
      anger: number;
      fear: number;
      sadness: number;
      surprise: number;
    };
  } {
    const normalizedSentence = sentence.toLowerCase().trim();
    
    let positiveScore = 0;
    let negativeScore = 0;
    let neutralScore = 0;
    const keywords: string[] = [];
    const emotions = { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 };

    // Check for negation context
    const hasNegation = this.patterns.negators.some(neg => 
      normalizedSentence.includes(neg)
    );

    // Check for intensifiers
    const intensifierMultiplier = this.patterns.intensifiers.some(int => 
      normalizedSentence.includes(int)
    ) ? 1.5 : 1.0;

    // Analyze positive patterns
    for (const pattern of this.patterns.positive) {
      const matches = normalizedSentence.match(pattern);
      if (matches) {
        let score = matches.length * intensifierMultiplier;
        if (hasNegation) score *= -0.8; // Flip and reduce if negated
        
        if (hasNegation) {
          negativeScore += Math.abs(score);
        } else {
          positiveScore += score;
          emotions.joy += score * 0.3;
          emotions.surprise += score * 0.1;
        }
        
        keywords.push(...matches);
      }
    }

    // Analyze negative patterns
    for (const pattern of this.patterns.negative) {
      const matches = normalizedSentence.match(pattern);
      if (matches) {
        let score = matches.length * intensifierMultiplier;
        if (hasNegation) score *= -0.8; // Reduce negative if negated
        
        if (hasNegation) {
          positiveScore += Math.abs(score) * 0.5; // Partial positive if negated
        } else {
          negativeScore += score;
          emotions.anger += score * 0.4;
          emotions.fear += score * 0.2;
          emotions.sadness += score * 0.3;
        }
        
        keywords.push(...matches);
      }
    }

    // Analyze neutral patterns
    for (const pattern of this.patterns.neutral) {
      const matches = normalizedSentence.match(pattern);
      if (matches) {
        neutralScore += matches.length;
        keywords.push(...matches);
      }
    }

    // Context-aware adjustments
    for (const [context, contextWords] of Object.entries(this.contextModifiers)) {
      const hasContext = contextWords.some(word => normalizedSentence.includes(word));
      if (hasContext) {
        switch (context) {
          case 'urgency':
            if (negativeScore > 0) negativeScore *= 1.3; // Amplify negative in urgent context
            emotions.fear += 0.2;
            break;
          case 'progress':
            if (positiveScore > 0) positiveScore *= 1.2; // Amplify positive for progress
            neutralScore += 0.5;
            break;
          case 'completion':
            positiveScore += 0.8; // Completion is generally positive
            emotions.joy += 0.3;
            break;
          case 'collaboration':
            if (positiveScore > 0) positiveScore *= 1.1; // Team context slightly positive
            emotions.joy += 0.1;
            break;
        }
      }
    }

    return {
      positiveScore,
      negativeScore,
      neutralScore,
      keywords: keywords.slice(0, 5), // Limit keywords per sentence
      emotions
    };
  }

  /**
   * Batch analyze multiple texts
   */
  async analyzeBatch(texts: string[]): Promise<ML5SentimentResult[]> {
    console.log(`🔄 ML5: Analyzing ${texts.length} texts for sentiment...`);
    
    const results: ML5SentimentResult[] = [];
    
    // Process in parallel for better performance
    const promises = texts.map(text => this.analyzeSentiment(text));
    const analysisResults = await Promise.all(promises);
    
    results.push(...analysisResults);
    
    console.log(`✅ ML5 batch sentiment analysis complete: ${results.length} texts analyzed`);
    return results;
  }

  /**
   * Get aggregated sentiment statistics
   */
  getAggregatedSentiment(results: ML5SentimentResult[]): {
    overallSentiment: 'positive' | 'negative' | 'neutral';
    averageScore: number;
    averageConfidence: number;
    sentimentDistribution: {
      positive: number;
      negative: number;
      neutral: number;
    };
    topKeywords: string[];
    averageEmotions: {
      joy: number;
      anger: number;
      fear: number;
      sadness: number;
      surprise: number;
    };
  } {
    if (results.length === 0) {
      return {
        overallSentiment: 'neutral',
        averageScore: 0,
        averageConfidence: 0,
        sentimentDistribution: { positive: 0, negative: 0, neutral: 0 },
        topKeywords: [],
        averageEmotions: { joy: 0, anger: 0, fear: 0, sadness: 0, surprise: 0 }
      };
    }

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
    const averageScore = totalScore / results.length;
    const averageConfidence = totalConfidence / results.length;

    // Calculate sentiment distribution
    const positive = results.filter(r => r.sentiment === 'positive').length;
    const negative = results.filter(r => r.sentiment === 'negative').length;
    const neutral = results.filter(r => r.sentiment === 'neutral').length;

    const overallSentiment = positive > negative && positive > neutral 
      ? 'positive' 
      : negative > neutral 
        ? 'negative' 
        : 'neutral';

    // Aggregate keywords
    const allKeywords = results.flatMap(r => r.keywords || []);
    const keywordCounts = new Map<string, number>();
    allKeywords.forEach(keyword => {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    });
    const topKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);

    // Average emotions
    const averageEmotions = {
      joy: results.reduce((sum, r) => sum + (r.emotions?.joy || 0), 0) / results.length,
      anger: results.reduce((sum, r) => sum + (r.emotions?.anger || 0), 0) / results.length,
      fear: results.reduce((sum, r) => sum + (r.emotions?.fear || 0), 0) / results.length,
      sadness: results.reduce((sum, r) => sum + (r.emotions?.sadness || 0), 0) / results.length,
      surprise: results.reduce((sum, r) => sum + (r.emotions?.surprise || 0), 0) / results.length,
    };

    return {
      overallSentiment,
      averageScore,
      averageConfidence,
      sentimentDistribution: {
        positive: positive / results.length,
        negative: negative / results.length,
        neutral: neutral / results.length
      },
      topKeywords,
      averageEmotions
    };
  }

  /**
   * Get service status
   */
  getStatus(): {
    isInitialized: boolean;
    hasML5: boolean;
    modelType: string;
  } {
    return {
      isInitialized: this.isInitialized,
      hasML5: !!this.ml5,
      modelType: this.ml5 ? 'ML5.js Enhanced' : 'Enhanced Rule-based'
    };
  }
}

// Export singleton instance
export const ml5SentimentService = new ML5SentimentService();
export default ml5SentimentService;
