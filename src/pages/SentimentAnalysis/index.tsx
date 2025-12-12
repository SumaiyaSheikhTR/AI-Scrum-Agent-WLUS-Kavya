import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
  Paper,
  Button
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  SentimentVeryDissatisfied,
  SentimentDissatisfied,
  SentimentNeutral,
  SentimentSatisfied,
  SentimentVerySatisfied,
  Comment as CommentIcon,
  Person as PersonIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import sentimentAnalysisService from '../../services/sentimentAnalysisService';
import { adoService } from '../../services/adoService';

interface DeveloperSentiment {
  developerId: string;
  developerName: string;
  sentimentScores: {
    positive: number;
    neutral: number;
    negative: number;
    frustrated: number;
    averageScore: number;
  };
  commentCount: number;
  commentExamples: {
    positive: string[];
    negative: string[];
    neutral: string[];
  };
  keyWords: {
    positive: string[];
    negative: string[];
  };
}

interface SprintSentimentSummary {
  sprintName: string;
  sprintId: string;
  overallSentiment: {
    positive: number;
    neutral: number;
    negative: number;
    frustrated: number;
    averageScore: number;
  };
  totalComments: number;
  developersAnalyzed: number;
  topConcerns: string[];
  topPositives: string[];
}

const SentimentAnalysis: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sprintSummary, setSprintSummary] = useState<SprintSentimentSummary | null>(null);
  const [developerSentiments, setDeveloperSentiments] = useState<DeveloperSentiment[]>([]);

  const getSentimentIcon = (score: number) => {
    if (score >= 0.7) return <SentimentVerySatisfied color="success" />;
    if (score >= 0.5) return <SentimentSatisfied color="success" />;
    if (score >= 0.3) return <SentimentNeutral color="warning" />;
    if (score >= 0.1) return <SentimentDissatisfied color="error" />;
    return <SentimentVeryDissatisfied color="error" />;
  };

  const analyzeDeveloperSentiment = useCallback(async (developerId: string, sprintId?: string): Promise<DeveloperSentiment | null> => {
    try {
      // Get comments for this developer from work items they're involved in
      const allComments = await sentimentAnalysisService.getCommentsForAnalysis(sprintId);
      
      // Filter comments by this developer
      const developerName = developerId.split('<')[0].trim();
      const developerComments = allComments.filter((comment: any) => 
        comment.author.toLowerCase().includes(developerName.toLowerCase())
      );
      
      if (developerComments.length === 0) {
        return {
          developerId,
          developerName,
          sentimentScores: {
            positive: 0,
            neutral: 0,
            negative: 0,
            frustrated: 0,
            averageScore: 0
          },
          commentCount: 0,
          commentExamples: {
            positive: [],
            negative: [],
            neutral: []
          },
          keyWords: {
            positive: [],
            negative: []
          }
        };
      }

      // Analyze sentiment trends for this developer
      const trends = await sentimentAnalysisService.analyzeSentimentTrends(developerComments);
      
      // Convert to percentages
      const total = trends.sentimentDistribution.positive + 
                   trends.sentimentDistribution.neutral + 
                   trends.sentimentDistribution.negative;
      
      if (total === 0) {
        return null;
      }

      // Extract example comments for each sentiment
      const positiveExamples: string[] = [];
      const negativeExamples: string[] = [];
      const neutralExamples: string[] = [];

      // Analyze individual comments to categorize them
      for (const comment of developerComments.slice(0, 10)) { // Limit to prevent overwhelming
        const commentTrends = await sentimentAnalysisService.analyzeSentimentTrends([comment]);
        const commentTotal = commentTrends.sentimentDistribution.positive + 
                           commentTrends.sentimentDistribution.neutral + 
                           commentTrends.sentimentDistribution.negative;
        
        if (commentTotal > 0) {
          const positiveRatio = commentTrends.sentimentDistribution.positive / commentTotal;
          const negativeRatio = commentTrends.sentimentDistribution.negative / commentTotal;
          
          if (positiveRatio > 0.5 && positiveExamples.length < 3) {
            positiveExamples.push(comment.text);
          } else if (negativeRatio > 0.3 && negativeExamples.length < 3) {
            negativeExamples.push(comment.text);
          } else if (neutralExamples.length < 3) {
            neutralExamples.push(comment.text);
          }
        }
      }

      // Extract key words (simplified approach)
      const allText = developerComments.map((c: any) => c.text.toLowerCase()).join(' ');
      const positiveWords = ['good', 'great', 'excellent', 'completed', 'done', 'working', 'fixed', 'resolved', 'success', 'perfect'];
      const negativeWords = ['issue', 'problem', 'bug', 'error', 'failed', 'broken', 'stuck', 'blocked', 'difficult', 'concern'];
      
      const foundPositiveWords = positiveWords.filter(word => allText.includes(word));
      const foundNegativeWords = negativeWords.filter(word => allText.includes(word));

      return {
        developerId,
        developerName,
        sentimentScores: {
          positive: trends.sentimentDistribution.positive / total,
          neutral: trends.sentimentDistribution.neutral / total,
          negative: trends.sentimentDistribution.negative / total,
          frustrated: (trends.sentimentDistribution.negative / total) * 0.5,
          averageScore: trends.averageScore
        },
        commentCount: developerComments.length,
        commentExamples: {
          positive: positiveExamples,
          negative: negativeExamples,
          neutral: neutralExamples
        },
        keyWords: {
          positive: foundPositiveWords,
          negative: foundNegativeWords
        }
      };
      
    } catch (error) {
      console.error('Error analyzing developer sentiment:', error);
      return null;
    }
  }, []);

  const fetchSentimentData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current sprint
      const sprint = await adoService.getCurrentSprint();

      if (!sprint) {
        setError('No active sprint found. Please configure your sprint settings.');
        return;
      }

      // Get work items for the current sprint
      const items = await adoService.getSprintWorkItems(sprint.id);
      
      // Get all unique assignees
      const assignees = Array.from(new Set(items
        .filter(item => item.assignedTo)
        .map(item => item.assignedTo!)
      ));

      if (assignees.length === 0) {
        setError('No team members found with assigned work items.');
        return;
      }

      // Analyze sentiment for each developer
      const developerAnalyses: DeveloperSentiment[] = [];
      let totalComments = 0;
      let overallPositive = 0;
      let overallNeutral = 0;
      let overallNegative = 0;
      let overallScore = 0;
      let validAnalyses = 0;

      for (const assignee of assignees) {
        const analysis = await analyzeDeveloperSentiment(assignee, sprint.id);
        if (analysis) {
          developerAnalyses.push(analysis);
          totalComments += analysis.commentCount;
          
          if (analysis.commentCount > 0) {
            overallPositive += analysis.sentimentScores.positive;
            overallNeutral += analysis.sentimentScores.neutral;
            overallNegative += analysis.sentimentScores.negative;
            overallScore += analysis.sentimentScores.averageScore;
            validAnalyses++;
          }
        }
      }

      // Calculate sprint summary
      const sprintSummary: SprintSentimentSummary = {
        sprintName: sprint.name,
        sprintId: sprint.id,
        overallSentiment: {
          positive: validAnalyses > 0 ? overallPositive / validAnalyses : 0,
          neutral: validAnalyses > 0 ? overallNeutral / validAnalyses : 0,
          negative: validAnalyses > 0 ? overallNegative / validAnalyses : 0,
          frustrated: validAnalyses > 0 ? (overallNegative / validAnalyses) * 0.5 : 0,
          averageScore: validAnalyses > 0 ? overallScore / validAnalyses : 0
        },
        totalComments,
        developersAnalyzed: validAnalyses,
        topConcerns: Array.from(new Set(developerAnalyses.flatMap(d => d.keyWords.negative))).slice(0, 5),
        topPositives: Array.from(new Set(developerAnalyses.flatMap(d => d.keyWords.positive))).slice(0, 5)
      };

      setSprintSummary(sprintSummary);
      setDeveloperSentiments(developerAnalyses);

    } catch (err) {
      console.error('Error fetching sentiment data:', err);
      setError('Failed to load sentiment analysis. This may be due to authentication issues with Azure DevOps.');
    } finally {
      setIsLoading(false);
    }
  }, [analyzeDeveloperSentiment]);

  useEffect(() => {
    fetchSentimentData();
  }, [fetchSentimentData]);

  const handleRefresh = () => {
    fetchSentimentData();
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 2 }}>
        <CircularProgress size={60} />
        <Typography variant="h6">Analyzing Sprint Sentiment...</Typography>
        <Typography variant="body2" color="text.secondary">
          This may take a moment as we analyze work item comments
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert 
          severity="error" 
          action={
            <Button onClick={handleRefresh} startIcon={<RefreshIcon />}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" component="h1">
          Sprint Sentiment Analysis
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
        >
          Refresh Analysis
        </Button>
      </Box>

      {/* Sprint Summary Card */}
      {sprintSummary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" gutterBottom>
              {sprintSummary.sprintName} - Overall Sentiment
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    Overall Team Sentiment Score
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {getSentimentIcon(sprintSummary.overallSentiment.averageScore)}
                    <Typography variant="h6">
                      {(sprintSummary.overallSentiment.averageScore * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Sentiment Breakdown
                  </Typography>
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Positive</Typography>
                      <Typography variant="body2" fontWeight="bold" color="success.main">
                        {(sprintSummary.overallSentiment.positive * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={sprintSummary.overallSentiment.positive * 100} 
                      sx={{ height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' }}
                      color="success"
                    />
                  </Box>
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Neutral</Typography>
                      <Typography variant="body2" fontWeight="bold" color="warning.main">
                        {(sprintSummary.overallSentiment.neutral * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={sprintSummary.overallSentiment.neutral * 100} 
                      sx={{ height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' }}
                      color="warning"
                    />
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2">Negative</Typography>
                      <Typography variant="body2" fontWeight="bold" color="error.main">
                        {(sprintSummary.overallSentiment.negative * 100).toFixed(1)}%
                      </Typography>
                    </Box>
                    <LinearProgress 
                      variant="determinate" 
                      value={sprintSummary.overallSentiment.negative * 100} 
                      sx={{ height: 8, borderRadius: 4, backgroundColor: '#e0e0e0' }}
                      color="error"
                    />
                  </Box>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Analysis Summary
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Chip 
                    icon={<CommentIcon />}
                    label={`${sprintSummary.totalComments} Comments Analyzed`}
                    sx={{ mr: 1, mb: 1 }}
                  />
                  <Chip 
                    icon={<PersonIcon />}
                    label={`${sprintSummary.developersAnalyzed} Developers`}
                    sx={{ mr: 1, mb: 1 }}
                  />
                </Box>
                
                {sprintSummary.topPositives.length > 0 && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="success.main" gutterBottom>
                      Top Positive Keywords
                    </Typography>
                    <Box>
                      {sprintSummary.topPositives.map((keyword, index) => (
                        <Chip 
                          key={index}
                          label={keyword}
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
                
                {sprintSummary.topConcerns.length > 0 && (
                  <Box>
                    <Typography variant="body2" color="error.main" gutterBottom>
                      Top Concerns
                    </Typography>
                    <Box>
                      {sprintSummary.topConcerns.map((concern, index) => (
                        <Chip 
                          key={index}
                          label={concern}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Individual Developer Analysis */}
      <Typography variant="h5" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Individual Team Member Analysis
      </Typography>

      {developerSentiments.length === 0 ? (
        <Alert severity="info">
          No sentiment data available. This could be because:
          <List dense>
            <ListItem>
              <ListItemText primary="• No work item comments found for analysis" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• Authentication issues with Azure DevOps" />
            </ListItem>
            <ListItem>
              <ListItemText primary="• No team members have assigned work items" />
            </ListItem>
          </List>
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {developerSentiments.map((dev, index) => (
            <Grid item xs={12} key={index}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    {getSentimentIcon(dev.sentimentScores.averageScore)}
                    <Typography variant="h6">{dev.developerName}</Typography>
                    <Chip 
                      label={`${dev.commentCount} comments`}
                      size="small"
                      color={dev.commentCount > 0 ? "primary" : "default"}
                    />
                    <Box sx={{ flexGrow: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      Sentiment: {(dev.sentimentScores.averageScore * 100).toFixed(1)}%
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={3}>
                    {/* Sentiment Breakdown */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Sentiment Breakdown
                      </Typography>
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Positive</Typography>
                          <Typography variant="body2" color="success.main">
                            {(dev.sentimentScores.positive * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={dev.sentimentScores.positive * 100}
                          color="success"
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                      <Box sx={{ mb: 1 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Neutral</Typography>
                          <Typography variant="body2" color="warning.main">
                            {(dev.sentimentScores.neutral * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={dev.sentimentScores.neutral * 100}
                          color="warning"
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                      <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="body2">Negative</Typography>
                          <Typography variant="body2" color="error.main">
                            {(dev.sentimentScores.negative * 100).toFixed(1)}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={dev.sentimentScores.negative * 100}
                          color="error"
                          sx={{ height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    </Grid>

                    {/* Key Insights */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Key Insights
                      </Typography>
                      
                      {dev.keyWords.positive.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="success.main" gutterBottom>
                            Positive Keywords Found
                          </Typography>
                          <Box>
                            {dev.keyWords.positive.map((word, i) => (
                              <Chip 
                                key={i}
                                label={word}
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                      
                      {dev.keyWords.negative.length > 0 && (
                        <Box>
                          <Typography variant="body2" color="error.main" gutterBottom>
                            Concern Keywords Found
                          </Typography>
                          <Box>
                            {dev.keyWords.negative.map((word, i) => (
                              <Chip 
                                key={i}
                                label={word}
                                size="small"
                                color="error"
                                variant="outlined"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Grid>

                    {/* Comment Examples */}
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Comment Examples (Why These Scores?)
                      </Typography>
                      
                      <Grid container spacing={2}>
                        {dev.commentExamples.positive.length > 0 && (
                          <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200' }}>
                              <Typography variant="subtitle2" color="success.main" gutterBottom>
                                Positive Comments
                              </Typography>
                              {dev.commentExamples.positive.map((comment, i) => (
                                <Typography key={i} variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                                  "{comment.length > 100 ? comment.substring(0, 100) + '...' : comment}"
                                </Typography>
                              ))}
                            </Paper>
                          </Grid>
                        )}
                        
                        {dev.commentExamples.negative.length > 0 && (
                          <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, bgcolor: 'error.50', border: '1px solid', borderColor: 'error.200' }}>
                              <Typography variant="subtitle2" color="error.main" gutterBottom>
                                Negative/Concern Comments
                              </Typography>
                              {dev.commentExamples.negative.map((comment, i) => (
                                <Typography key={i} variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                                  "{comment.length > 100 ? comment.substring(0, 100) + '...' : comment}"
                                </Typography>
                              ))}
                            </Paper>
                          </Grid>
                        )}
                        
                        {dev.commentExamples.neutral.length > 0 && (
                          <Grid item xs={12} md={4}>
                            <Paper sx={{ p: 2, bgcolor: 'warning.50', border: '1px solid', borderColor: 'warning.200' }}>
                              <Typography variant="subtitle2" color="warning.main" gutterBottom>
                                Neutral Comments
                              </Typography>
                              {dev.commentExamples.neutral.map((comment, i) => (
                                <Typography key={i} variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                                  "{comment.length > 100 ? comment.substring(0, 100) + '...' : comment}"
                                </Typography>
                              ))}
                            </Paper>
                          </Grid>
                        )}
                      </Grid>
                      
                      {dev.commentExamples.positive.length === 0 && 
                       dev.commentExamples.negative.length === 0 && 
                       dev.commentExamples.neutral.length === 0 && (
                        <Alert severity="info">
                          No comment examples available for this team member.
                        </Alert>
                      )}
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Explanation */}
      <Card sx={{ mt: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            How Sentiment Analysis Works
          </Typography>
          <Typography variant="body2" paragraph>
            This analysis examines work item comments from team members during the current sprint to understand team sentiment and morale:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText 
                primary="Data Source" 
                secondary="Comments from Azure DevOps work items assigned to team members"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Analysis Method" 
                secondary="Natural language processing to identify positive, neutral, and negative sentiment"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Keywords Detection" 
                secondary="Identifies specific words that indicate satisfaction or concerns"
              />
            </ListItem>
            <ListItem>
              <ListItemText 
                primary="Score Calculation" 
                secondary="Weighted average based on comment frequency and sentiment strength"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SentimentAnalysis;
