// Simplified Sentiment Analysis Demo Service
// This is a demo implementation that works without external ML packages

export interface SimpleSentimentResult {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  score: number;
  confidence: number;
  provider: string;
  processingTime: number;
  keywords?: string[];
  emotion?: string;
}

export interface SimpleSentimentConfig {
  provider: 'rule-based' | 'enhanced-rules';
  enableEmotionDetection: boolean;
  confidenceThreshold: number;
}

class SimplifiedSentimentService {
  private config: SimpleSentimentConfig = {
    provider: 'enhanced-rules',
    enableEmotionDetection: true,
    confidenceThreshold: 0.6
  };

  private positiveWords = [
    'excellent', 'amazing', 'great', 'good', 'awesome', 'fantastic', 'wonderful', 
    'perfect', 'outstanding', 'brilliant', 'superb', 'impressive', 'love', 'like',
    'happy', 'pleased', 'satisfied', 'excited', 'thrilled', 'delighted', 'successful',
    'effective', 'efficient', 'helpful', 'useful', 'valuable', 'important', 'significant',
    'resolved', 'fixed', 'working', 'completed', 'achieved', 'accomplished'
  ];

  private negativeWords = [
    'terrible', 'awful', 'bad', 'horrible', 'disappointing', 'frustrating', 'annoying',
    'broken', 'failed', 'error', 'bug', 'issue', 'problem', 'critical', 'urgent',
    'disaster', 'nightmare', 'useless', 'worthless', 'hate', 'dislike', 'angry',
    'upset', 'concerned', 'worried', 'blocked', 'stuck', 'failing', 'crashed'
  ];

  private emotionWords = {
    joy: ['happy', 'excited', 'thrilled', 'delighted', 'cheerful', 'elated'],
    anger: ['angry', 'furious', 'mad', 'irritated', 'annoyed', 'frustrated'],
    fear: ['scared', 'afraid', 'worried', 'anxious', 'concerned', 'nervous'],
    sadness: ['sad', 'disappointed', 'depressed', 'down', 'upset', 'unhappy'],
    surprise: ['surprised', 'amazed', 'shocked', 'astonished', 'stunned'],
    trust: ['confident', 'secure', 'reliable', 'trustworthy', 'dependable'],
    anticipation: ['excited', 'eager', 'looking forward', 'anticipating', 'expecting']
  };

  private softwareContextWords = {
    positive: ['deployed', 'released', 'merged', 'tested', 'documented', 'optimized', 'refactored', 'implemented'],
    negative: ['regression', 'outage', 'downtime', 'vulnerability', 'deprecated', 'legacy', 'technical debt']
  };

  async initialize(config?: Partial<SimpleSentimentConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    // Simulate initialization delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  updateConfig(newConfig: Partial<SimpleSentimentConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getStatus() {
    return {
      isInitialized: true,
      availableProviders: ['rule-based', 'enhanced-rules'],
      currentProvider: this.config.provider,
      recommendations: [
        'Install @tensorflow/tfjs for advanced ML analysis',
        'Install ml5 for enhanced pattern matching',
        'Consider external API integration for production use'
      ]
    };
  }

  async analyzeSentiment(text: string): Promise<SimpleSentimentResult> {
    const startTime = performance.now();
    
    const words = this.tokenize(text.toLowerCase());
    const result = this.analyzeWithRules(words, text);
    
    const processingTime = Math.round(performance.now() - startTime);

    return {
      text,
      sentiment: result.sentiment,
      score: result.score,
      confidence: result.confidence,
      provider: this.config.provider,
      processingTime,
      keywords: result.keywords,
      emotion: this.config.enableEmotionDetection ? result.emotion : undefined
    };
  }

  async analyzeBatch(texts: string[]): Promise<SimpleSentimentResult[]> {
    const results: SimpleSentimentResult[] = [];
    
    for (const text of texts) {
      const result = await this.analyzeSentiment(text);
      results.push(result);
      // Small delay to simulate batch processing
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return results;
  }

  private tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private analyzeWithRules(words: string[], originalText: string) {
    let positiveScore = 0;
    let negativeScore = 0;
    const foundKeywords: string[] = [];
    const foundEmotions: string[] = [];

    // Analyze individual words
    words.forEach(word => {
      if (this.positiveWords.includes(word)) {
        positiveScore += 1;
        foundKeywords.push(word);
      }
      if (this.negativeWords.includes(word)) {
        negativeScore += 1;
        foundKeywords.push(word);
      }

      // Software context analysis
      if (this.softwareContextWords.positive.includes(word)) {
        positiveScore += 1.2; // Slightly higher weight for context-specific words
        foundKeywords.push(word);
      }
      if (this.softwareContextWords.negative.includes(word)) {
        negativeScore += 1.2;
        foundKeywords.push(word);
      }

      // Emotion detection
      Object.entries(this.emotionWords).forEach(([emotion, emotionWords]) => {
        if (emotionWords.includes(word)) {
          foundEmotions.push(emotion);
        }
      });
    });

    // Pattern matching for enhanced analysis
    if (this.config.provider === 'enhanced-rules') {
      // Negation handling
      const negationPattern = /\b(not|no|never|neither|nor|nothing|nobody|nowhere|none)\s+\w+/g;
      const negations = originalText.toLowerCase().match(negationPattern);
      if (negations) {
        // Flip sentiment for negated phrases
        const temp = positiveScore;
        positiveScore = negativeScore * 0.8;
        negativeScore = temp * 0.8;
      }

      // Intensity modifiers
      const intensifiers = ['very', 'extremely', 'really', 'completely', 'totally', 'absolutely'];
      const hasIntensifier = words.some(word => intensifiers.includes(word));
      if (hasIntensifier) {
        positiveScore *= 1.3;
        negativeScore *= 1.3;
      }

      // Question marks reduce confidence
      if (originalText.includes('?')) {
        positiveScore *= 0.8;
        negativeScore *= 0.8;
      }

      // Exclamation marks increase intensity
      const exclamationCount = (originalText.match(/!/g) || []).length;
      if (exclamationCount > 0) {
        positiveScore *= (1 + exclamationCount * 0.2);
        negativeScore *= (1 + exclamationCount * 0.2);
      }
    }

    // Calculate final sentiment
    const totalScore = positiveScore + negativeScore;
    const normalizedScore = totalScore > 0 ? (positiveScore - negativeScore) / totalScore : 0;
    
    let sentiment: 'positive' | 'negative' | 'neutral';
    if (normalizedScore > 0.1) {
      sentiment = 'positive';
    } else if (normalizedScore < -0.1) {
      sentiment = 'negative';
    } else {
      sentiment = 'neutral';
    }

    // Calculate confidence based on score strength and keyword count
    const confidence = Math.min(
      Math.abs(normalizedScore) + (foundKeywords.length * 0.1),
      0.95
    );

    // Determine primary emotion
    const primaryEmotion = foundEmotions.length > 0 
      ? foundEmotions.reduce((a, b) => 
          foundEmotions.filter(v => v === a).length >= foundEmotions.filter(v => v === b).length ? a : b
        )
      : sentiment === 'positive' ? 'joy' 
      : sentiment === 'negative' ? 'sadness' 
      : 'neutral';

    return {
      sentiment,
      score: normalizedScore,
      confidence,
      keywords: Array.from(new Set(foundKeywords)), // Remove duplicates
      emotion: primaryEmotion
    };
  }
}

export const simplifiedSentimentService = new SimplifiedSentimentService();
