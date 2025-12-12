// Commented out until TensorFlow packages are installed
// import * as tf from '@tensorflow/tfjs';
// import * as use from '@tensorflow-models/universal-sentence-encoder';

export interface TensorFlowSentimentResult {
  text: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  confidence: number; // 0 to 1
  score: number; // -1 to 1 where -1 is very negative, 1 is very positive
  modelUsed: 'tensorflow' | 'rule-based';
  processingTime: number; // milliseconds
}

export interface SentimentBatch {
  texts: string[];
  results: TensorFlowSentimentResult[];
  totalProcessingTime: number;
}

class TensorFlowSentimentService {
  // private model: tf.LayersModel | null = null;
  // private encoder: any = null;
  private isModelLoading: boolean = false;
  private modelLoadPromise: Promise<void> | null = null;
  
//   // Simple rule-based sentiment analysis as fallback
//   private positiveWords = [
//     'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic', 'wonderful', 
//     'perfect', 'outstanding', 'brilliant', 'superb', 'remarkable', 'impressive',
//     'successful', 'effective', 'efficient', 'helpful', 'useful', 'valuable',
//     'pleased', 'satisfied', 'happy', 'excited', 'thrilled', 'delighted',
//     'approve', 'appreciate', 'recommend', 'love', 'like', 'enjoy',
//     'resolved', 'fixed', 'completed', 'achieved', 'accomplished', 'delivered'
//   ];

//   private negativeWords = [
//     'bad', 'terrible', 'awful', 'horrible', 'disgusting', 'disappointing',
//     'frustrating', 'annoying', 'irritating', 'confusing', 'difficult', 'hard',
//     'impossible', 'broken', 'failed', 'error', 'bug', 'issue', 'problem',
//     'concern', 'worried', 'anxious', 'stressed', 'overwhelmed', 'blocked',
//     'stuck', 'delayed', 'behind', 'late', 'missed', 'wrong', 'incorrect',
//     'hate', 'dislike', 'reject', 'deny', 'refuse', 'oppose', 'disagree'
//   ];

//   private neutralWords = [
//     'okay', 'fine', 'average', 'normal', 'standard', 'typical', 'regular',
//     'update', 'status', 'progress', 'review', 'meeting', 'discussion',
//     'question', 'clarification', 'information', 'data', 'report', 'summary'
//   ];

//   /**
//    * Initialize TensorFlow.js and load the sentiment analysis model
//    */
//   async initializeModel(): Promise<void> {
//     if (this.model || this.isModelLoading) {
//       return this.modelLoadPromise || Promise.resolve();
//     }

//     this.isModelLoading = true;
//     console.log('🤖 TensorFlow.js: Loading sentiment analysis model...');

//     this.modelLoadPromise = this.loadModel();
//     return this.modelLoadPromise;
//   }

//   private async loadModel(): Promise<void> {
//     try {
//       // Try to load Universal Sentence Encoder for better text understanding
//       console.log('🔄 Loading Universal Sentence Encoder...');
//       this.encoder = await use.load();
//       console.log('✅ Universal Sentence Encoder loaded successfully');

//       // For this example, we'll create a simple sentiment model
//       // In production, you'd load a pre-trained sentiment model
//       this.model = this.createSimpleSentimentModel();
//       console.log('✅ TensorFlow.js sentiment model initialized');

//     } catch (error) {
//       console.warn('⚠️ Failed to load advanced models, using rule-based fallback:', error);
//       this.model = null;
//       this.encoder = null;
//     } finally {
//       this.isModelLoading = false;
//     }
//   }

//   /**
//    * Create a simple sentiment analysis model
//    * In production, you'd load a pre-trained model
//    */
//   private createSimpleSentimentModel(): tf.LayersModel {
//     const model = tf.sequential({
//       layers: [
//         tf.layers.dense({ inputShape: [512], units: 64, activation: 'relu' }),
//         tf.layers.dropout({ rate: 0.5 }),
//         tf.layers.dense({ units: 32, activation: 'relu' }),
//         tf.layers.dense({ units: 3, activation: 'softmax' }) // negative, neutral, positive
//       ]
//     });

//     model.compile({
//       optimizer: 'adam',
//       loss: 'categoricalCrossentropy',
//       metrics: ['accuracy']
//     });

//     return model;
//   }

//   /**
//    * Analyze sentiment of a single text
//    */
//   async analyzeSentiment(text: string): Promise<TensorFlowSentimentResult> {
//     const startTime = Date.now();
    
//     if (!text || text.trim().length === 0) {
//       return {
//         text,
//         sentiment: 'neutral',
//         confidence: 0,
//         score: 0,
//         modelUsed: 'rule-based',
//         processingTime: Date.now() - startTime
//       };
//     }

//     try {
//       // Try TensorFlow.js model first
//       if (this.model && this.encoder) {
//         const result = await this.analyzeSentimentWithTensorFlow(text, startTime);
//         if (result) return result;
//       }
//     } catch (error) {
//       console.warn('TensorFlow.js analysis failed, falling back to rule-based:', error);
//     }

//     // Fallback to rule-based analysis
//     return this.analyzeSentimentRuleBased(text, startTime);
//   }

//   /**
//    * Analyze sentiment using TensorFlow.js model
//    */
//   private async analyzeSentimentWithTensorFlow(text: string, startTime: number): Promise<TensorFlowSentimentResult | null> {
//     try {
//       // Convert text to embeddings using Universal Sentence Encoder
//       const embeddings = await this.encoder.embed([text]);
      
//       // Get predictions from sentiment model
//       const predictions = this.model!.predict(embeddings) as tf.Tensor;
//       const scores = await predictions.data();
      
//       // Interpret results [negative, neutral, positive]
//       const negativeScore = scores[0];
//       const neutralScore = scores[1]; 
//       const positiveScore = scores[2];
      
//       let sentiment: 'positive' | 'negative' | 'neutral';
//       let confidence: number;
//       let score: number; // -1 to 1 scale

//       if (positiveScore > negativeScore && positiveScore > neutralScore) {
//         sentiment = 'positive';
//         confidence = positiveScore;
//         score = positiveScore * 2 - 1; // Convert 0-1 to -1 to 1
//       } else if (negativeScore > neutralScore) {
//         sentiment = 'negative';
//         confidence = negativeScore;
//         score = -(negativeScore * 2 - 1); // Convert to negative scale
//       } else {
//         sentiment = 'neutral';
//         confidence = neutralScore;
//         score = 0;
//       }

//       // Cleanup tensors
//       embeddings.dispose();
//       predictions.dispose();

//       return {
//         text,
//         sentiment,
//         confidence,
//         score,
//         modelUsed: 'tensorflow',
//         processingTime: Date.now() - startTime
//       };

//     } catch (error) {
//       console.error('TensorFlow.js sentiment analysis error:', error);
//       return null;
//     }
//   }

//   /**
//    * Rule-based sentiment analysis as fallback
//    */
//   private analyzeSentimentRuleBased(text: string, startTime: number): TensorFlowSentimentResult {
//     const normalizedText = text.toLowerCase();
//     const words = normalizedText.split(/\s+/);
    
//     let positiveScore = 0;
//     let negativeScore = 0;
//     let neutralScore = 0;

//     for (const word of words) {
//       if (this.positiveWords.some(pw => word.includes(pw))) {
//         positiveScore++;
//       } else if (this.negativeWords.some(nw => word.includes(nw))) {
//         negativeScore++;
//       } else if (this.neutralWords.some(neuw => word.includes(neuw))) {
//         neutralScore++;
//       }
//     }

//     // Calculate overall sentiment
//     const totalScore = positiveScore + negativeScore + neutralScore;
//     let sentiment: 'positive' | 'negative' | 'neutral';
//     let confidence: number;
//     let score: number;

//     if (positiveScore > negativeScore && positiveScore > neutralScore) {
//       sentiment = 'positive';
//       confidence = totalScore > 0 ? positiveScore / totalScore : 0.5;
//       score = Math.min(positiveScore / Math.max(words.length * 0.1, 1), 1);
//     } else if (negativeScore > neutralScore && negativeScore > positiveScore) {
//       sentiment = 'negative';
//       confidence = totalScore > 0 ? negativeScore / totalScore : 0.5;
//       score = -Math.min(negativeScore / Math.max(words.length * 0.1, 1), 1);
//     } else {
//       sentiment = 'neutral';
//       confidence = totalScore > 0 ? Math.max(neutralScore / totalScore, 0.3) : 0.7;
//       score = 0;
//     }

//     return {
//       text,
//       sentiment,
//       confidence,
//       score,
//       modelUsed: 'rule-based',
//       processingTime: Date.now() - startTime
//     };
//   }

//   /**
//    * Analyze sentiment for multiple texts in batch
//    */
//   async analyzeSentimentBatch(texts: string[]): Promise<SentimentBatch> {
//     const startTime = Date.now();
//     const results: TensorFlowSentimentResult[] = [];

//     console.log(`🔄 Analyzing ${texts.length} texts for sentiment...`);

//     // Process texts in parallel for better performance
//     const promises = texts.map(text => this.analyzeSentiment(text));
//     const analysisResults = await Promise.all(promises);
    
//     results.push(...analysisResults);

//     const totalProcessingTime = Date.now() - startTime;
    
//     console.log(`✅ Batch sentiment analysis complete: ${results.length} texts analyzed in ${totalProcessingTime}ms`);

//     return {
//       texts,
//       results,
//       totalProcessingTime
//     };
//   }

//   /**
//    * Get model status and performance info
//    */
//   getModelInfo(): {
//     isLoaded: boolean;
//     hasEncoder: boolean;
//     isLoading: boolean;
//     modelType: string;
//   } {
//     return {
//       isLoaded: !!this.model,
//       hasEncoder: !!this.encoder,
//       isLoading: this.isModelLoading,
//       modelType: this.model && this.encoder ? 'TensorFlow.js + USE' : 'Rule-based'
//     };
//   }

//   /**
//    * Cleanup resources
//    */
//   dispose(): void {
//     if (this.model) {
//       this.model.dispose();
//       this.model = null;
//     }
//     if (this.encoder) {
//       // Universal Sentence Encoder cleanup if needed
//       this.encoder = null;
//     }
//     console.log('🧹 TensorFlow.js sentiment service disposed');
//   }
// }

// // Export singleton instance
// export const tensorflowSentimentService = new TensorFlowSentimentService();
// export default tensorflowSentimentService;
}