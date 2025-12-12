import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Divider, 
  Card, 
  CardContent,
  Alert,
  Grid,
  useTheme,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge,
  Chip
} from '@mui/material';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import SentimentNeutralIcon from '@mui/icons-material/SentimentNeutral';
import SentimentVeryDissatisfiedIcon from '@mui/icons-material/SentimentVeryDissatisfied';
import RefreshIcon from '@mui/icons-material/Refresh';
import CommentIcon from '@mui/icons-material/Comment';
import BugReportIcon from '@mui/icons-material/BugReport';
import AssignmentIcon from '@mui/icons-material/Assignment';
import adoService, { Sprint, WorkItem } from '../../services/adoService';
import sentimentAnalysisService, { CommentData, SentimentAnalysisResult } from '../../services/sentimentAnalysisService';
import sentimentAnalysisBackgroundService from '../../services/sentimentAnalysisBackgroundService';

interface SentimentAnalysisPanelProps {
  sprintId?: string;
  workItemId?: number;
  useRealData?: boolean;
  teamName?: string;
}

const SentimentAnalysisPanel: React.FC<SentimentAnalysisPanelProps> = ({ 
  sprintId: initialSprintId, 
  workItemId, 
  useRealData = false,
  teamName: initialTeamName
}) => {
  const [isLoading, setIsLoading] = useState(false); // Changed from true to false to prevent loading spinner
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [sentimentResults, setSentimentResults] = useState<SentimentAnalysisResult[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | undefined>(initialSprintId);
  const [selectedTeamName, setSelectedTeamName] = useState<string | undefined>(initialTeamName);
  const [isLoadingSprints, setIsLoadingSprints] = useState(false);
  const [trendAnalysis, setTrendAnalysis] = useState<any>(null);
  const [workItemSentiments, setWorkItemSentiments] = useState<Map<number, {
    workItem: WorkItem, 
    comments: CommentData[],
    sentiment?: {
      overallSentiment: 'positive' | 'negative' | 'neutral',
      averageScore: number,
      commentCount: number
    }
  }>>(new Map());
  const [viewMode, setViewMode] = useState<'comments' | 'workItems'>('workItems');
  
  const theme = useTheme();

  // Load sprints
  const loadSprints = React.useCallback(async () => {
    try {
      setIsLoadingSprints(true);
      const sprintsData = await adoService.getSprints();
      setSprints(sprintsData);
      
      if (!selectedSprintId && sprintsData.length > 0) {
        const currentSprint = sprintsData.find(s => s.state === 'current');
        if (currentSprint) {
          setSelectedSprintId(currentSprint.id);
        } else {
          setSelectedSprintId(sprintsData[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading sprints:', err);
      setError('Failed to load sprints');
    } finally {
      setIsLoadingSprints(false);
    }
  }, [selectedSprintId]);

  // Load comments and work item sentiments
  const loadComments = React.useCallback(async () => {
    if (!selectedSprintId && !workItemId) {
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      console.log(`Loading sentiment data for Sprint ID: ${selectedSprintId}, Work Item ID: ${workItemId}`);
      
      // Try to get cached sentiment data first
      if (selectedSprintId) {
        const cachedSentimentData = await sentimentAnalysisBackgroundService.getSentimentAnalysis(selectedSprintId);
        
        if (cachedSentimentData) {
          console.log('Using cached sentiment data');
          
          // Convert the cached data to the format expected by the UI
          setSentimentResults([cachedSentimentData]);
          
          // Get detailed comments for display (this can be faster since we have the overall sentiment)
          const commentsData = await sentimentAnalysisService.getCommentsForAnalysis(
            selectedSprintId, 
            workItemId,
            selectedTeamName
          );
          
          setComments(commentsData.slice(0, 50)); // Limit to 50 comments for performance
          
          if (commentsData.length > 0) {
            const trends = await sentimentAnalysisService.analyzeSentimentTrends(commentsData);
            setTrendAnalysis(trends);
          }
        } else {
          // Fallback to traditional analysis if no cached data
          console.log('No cached data available, performing traditional analysis');
          await performTraditionalAnalysis();
        }
      } else {
        // For work item specific analysis, use traditional method
        await performTraditionalAnalysis();
      }
      
      // Load work item level sentiment analysis
      if (selectedSprintId) {
        console.log(`Loading work item level sentiment analysis for Sprint ID: ${selectedSprintId}`);
        const workItemSentimentData = await sentimentAnalysisService.getCommentsGroupedByWorkItem(
          selectedSprintId,
          selectedTeamName
        );
        
        console.log(`Work item sentiment data loaded for ${workItemSentimentData.size} work items`);
        setWorkItemSentiments(workItemSentimentData);
      }
      
    } catch (err) {
      console.error('Error loading sentiment analysis:', err);
      setError('Failed to load sentiment analysis data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSprintId, workItemId, selectedTeamName]);

  // Traditional analysis method (fallback)
  const performTraditionalAnalysis = async () => {
    const commentsData = await sentimentAnalysisService.getCommentsForAnalysis(
      selectedSprintId, 
      workItemId,
      selectedTeamName
    );
    
    console.log(`Loaded ${commentsData.length} comments for sentiment analysis`);
    setComments(commentsData);
    
    if (commentsData.length > 0) {
      console.log('Analyzing sentiment for comments...');
      const results = await sentimentAnalysisService.batchAnalyzeSentiment(commentsData);
      console.log(`Sentiment analysis results: ${results.length} results`);
      setSentimentResults(results);
      
      console.log('Analyzing sentiment trends...');
      const trends = await sentimentAnalysisService.analyzeSentimentTrends(commentsData);
      console.log('Sentiment trends analysis complete:', trends ? 'Success' : 'Failed');
      setTrendAnalysis(trends);
    }
  };

  useEffect(() => {
    // Load available sprints
    loadSprints();
    
    // Update the service configuration with the useRealData prop
    const config = sentimentAnalysisService.getConfig();
    sentimentAnalysisService.updateConfig({
      ...config,
      useRealData
    });
    
    // Listen for sentiment config updates
    const handleConfigUpdate = (event: Event) => {
      console.log('Sentiment config updated event received');
      loadComments();
    };
    
    window.addEventListener('sentiment-config-updated', handleConfigUpdate);
    
    return () => {
      window.removeEventListener('sentiment-config-updated', handleConfigUpdate);
    };
  }, [useRealData, loadSprints, loadComments]);

  // Update selectedSprintId when initialSprintId prop changes
  useEffect(() => {
    if (initialSprintId !== undefined && initialSprintId !== selectedSprintId) {
      console.log(`Sprint ID prop changed from ${selectedSprintId} to ${initialSprintId}`);
      setSelectedSprintId(initialSprintId);
    }
  }, [initialSprintId, selectedSprintId]);
  
  // Update selectedTeamName when initialTeamName prop changes
  useEffect(() => {
    if (initialTeamName !== undefined && initialTeamName !== selectedTeamName) {
      console.log(`Team name prop changed from ${selectedTeamName} to ${initialTeamName}`);
      setSelectedTeamName(initialTeamName);
    }
  }, [initialTeamName, selectedTeamName]);

  useEffect(() => {
    // Auto-loading of sentiment comments RE-ENABLED
    loadComments();
  }, [loadComments]);
  
  const handleSprintChange = (event: SelectChangeEvent<string>) => {
    setSelectedSprintId(event.target.value);
  };
  
  const handleTeamChange = (event: SelectChangeEvent<string>) => {
    setSelectedTeamName(event.target.value);
  };

  const handleRefresh = () => {
    loadComments();
  };
  
  const handleViewModeChange = (mode: 'comments' | 'workItems') => {
    setViewMode(mode);
  };
  
  // Handle force refresh of sentiment data
  const handleForceRefresh = async () => {
    if (selectedSprintId) {
      setIsLoading(true);
      try {
        console.log('Force refreshing sentiment data...');
        const refreshedData = await sentimentAnalysisBackgroundService.refreshSentimentData(selectedSprintId);
        if (refreshedData) {
          setSentimentResults([refreshedData]);
        }
        await loadComments(); // Reload everything
      } catch (error) {
        console.error('Error force refreshing sentiment data:', error);
        setError('Failed to refresh sentiment data');
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Get cache statistics
  const cacheStats = sentimentAnalysisBackgroundService.getCacheStats();

  // Helper function to render sentiment icon
  const renderSentimentIcon = (sentiment: 'positive' | 'negative' | 'neutral', size: 'small' | 'medium' | 'large' = 'medium') => {
    switch (sentiment) {
      case 'positive':
        return <SentimentSatisfiedAltIcon color="success" fontSize={size} />;
      case 'negative':
        return <SentimentVeryDissatisfiedIcon color="error" fontSize={size} />;
      case 'neutral':
      default:
        return <SentimentNeutralIcon color="action" fontSize={size} />;
    }
  };

  if (isLoadingSprints) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          Loading sprints...
        </Typography>
      </Box>
    );
  }
  
  if (sprints.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">No sprints found. Please configure your Azure DevOps connection.</Alert>
      </Box>
    );
  }
  
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button 
            variant="contained" 
            startIcon={<RefreshIcon />} 
            onClick={handleRefresh}
          >
            Retry
          </Button>
        </Box>
      </Box>
    );
  }

  // Helper function to check if ADO is properly configured
  const checkAdoConfiguration = () => {
    // Check if ADO config exists in localStorage
    const adoConfigStr = localStorage.getItem('adoConfig');
    if (!adoConfigStr) {
      return {
        isConfigured: false,
        message: "Azure DevOps is not configured. Please go to Settings and configure your ADO connection."
      };
    }

    try {
      const adoConfig = JSON.parse(adoConfigStr);
      console.log("Current ADO config:", adoConfig);
      
      // Check if required fields are present
      if (!adoConfig.organization || !adoConfig.project || !adoConfig.personalAccessToken) {
        return {
          isConfigured: false,
          message: "Azure DevOps configuration is incomplete. Please go to Settings and complete your ADO configuration."
        };
      }
      
      return {
        isConfigured: true,
        config: adoConfig,
        message: "Azure DevOps is properly configured."
      };
    } catch (error) {
      console.error("Error parsing ADO config:", error);
      return {
        isConfigured: false,
        message: "Error reading Azure DevOps configuration. Please go to Settings and reconfigure your ADO connection."
      };
    }
  };
  
  // Helper function to test ADO connection
  const testAdoConnection = async () => {
    try {
      setIsLoading(true);
      const sprintsData = await adoService.getSprints();
      console.log("Test ADO connection - sprints:", sprintsData);
      
      if (sprintsData.length > 0) {
        return {
          success: true,
          message: `Connection successful! Found ${sprintsData.length} sprints.`
        };
      } else {
        return {
          success: false,
          message: "Connection successful, but no sprints were found. Please check your project configuration."
        };
      }
    } catch (error) {
      console.error("Error testing ADO connection:", error);
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`
      };
    } finally {
      setIsLoading(false);
    }
  };

  if (comments.length === 0) {
    const adoStatus = checkAdoConfiguration();
    
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="info">
          No comments found for sentiment analysis.
        </Alert>
        
        {!adoStatus.isConfigured && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {adoStatus.message}
          </Alert>
        )}
        
        {adoStatus.isConfigured && (
          <>
            <Alert severity="info" sx={{ mt: 2 }}>
              Your ADO configuration looks good, but no comments were found. This could be because:
              <ul>
                <li>There are no comments in your work items</li>
                <li>The current sprint doesn't have any work items with comments</li>
                <li>Your ADO personal access token doesn't have sufficient permissions</li>
              </ul>
            </Alert>
            
            <Card variant="outlined" sx={{ mt: 2, mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Current ADO Configuration
                </Typography>
                <Typography variant="body2">
                  Organization: {adoStatus.config?.organization || 'Not set'}
                </Typography>
                <Typography variant="body2">
                  Project: {adoStatus.config?.project || 'Not set'}
                </Typography>
                <Typography variant="body2">
                  Team: {adoStatus.config?.teamName || 'Default team'}
                </Typography>
                <Typography variant="body2">
                  API Version: {adoStatus.config?.apiVersion || 'Not set'}
                </Typography>
                <Typography variant="body2">
                  Token: {adoStatus.config?.personalAccessToken ? '********' : 'Not set'}
                </Typography>
              </CardContent>
            </Card>
            
            <Box sx={{ mt: 2, mb: 2, display: 'flex', justifyContent: 'center' }}>
              <Button 
                variant="outlined" 
                color="primary"
                onClick={async () => {
                  const result = await testAdoConnection();
                  if (result.success) {
                    setError(null);
                    alert(`ADO Connection Test: ${result.message}`);
                  } else {
                    setError(`ADO Connection Test Failed: ${result.message}`);
                  }
                }}
                disabled={isLoading}
              >
                Test ADO Connection
              </Button>
            </Box>
          </>
        )}
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button 
            variant="contained" 
            startIcon={<RefreshIcon />} 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </Button>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">
          Sentiment Analysis
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Cache Status Indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              size="small" 
              label={`Cache: ${cacheStats.validEntries}/${cacheStats.totalEntries}`}
              color={cacheStats.validEntries > 0 ? 'success' : 'default'}
              variant="outlined"
            />
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleForceRefresh}
              disabled={isLoading || !selectedSprintId}
              title="Force refresh sentiment data"
            >
              Refresh
            </Button>
          </Box>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            {!workItemId && (
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel id="sprint-select-label">Sprint</InputLabel>
                <Select
                  labelId="sprint-select-label"
                  id="sprint-select"
                  value={selectedSprintId || ''}
                  label="Sprint"
                  onChange={handleSprintChange}
                >
                  {sprints.map((sprint) => (
                    <MenuItem key={sprint.id} value={sprint.id}>
                      {sprint.name} {sprint.state === 'current' ? '(Current)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel id="team-select-label">Team</InputLabel>
              <Select
                labelId="team-select-label"
                id="team-select"
                value={selectedTeamName || ''}
                label="Team"
                onChange={handleTeamChange}
                displayEmpty
              >
                <MenuItem value="">All Teams</MenuItem>
                {(() => {
                  // Get team name from ADO config
                  try {
                    const adoConfigStr = localStorage.getItem('adoConfig');
                    if (adoConfigStr) {
                      const adoConfig = JSON.parse(adoConfigStr);
                      if (adoConfig.teamName) {
                        return (
                          <MenuItem value={adoConfig.teamName}>
                            {adoConfig.teamName}
                          </MenuItem>
                        );
                      }
                    }
                  } catch (error) {
                    console.error('Error parsing ADO config:', error);
                  }
                  return null;
                })()}
              </Select>
            </FormControl>
          </Box>
          
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />} 
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </Box>
      
      {/* Data Source Info */}
      <Alert severity="info" sx={{ mb: 2 }}>
        {sentimentAnalysisService.getConfig().useRealData 
          ? "Using real data from Azure DevOps"
          : "Using sample data (enable 'Use Real Data from ADO' in settings to use real data)"}
      </Alert>
      
      {/* View Mode Selector */}
      <Box sx={{ display: 'flex', mb: 3 }}>
        <Button 
          variant={viewMode === 'workItems' ? 'contained' : 'outlined'}
          onClick={() => handleViewModeChange('workItems')}
          sx={{ mr: 1 }}
        >
          Work Items
        </Button>
        <Button 
          variant={viewMode === 'comments' ? 'contained' : 'outlined'}
          onClick={() => handleViewModeChange('comments')}
        >
          Comments
        </Button>
      </Box>
      
      {/* Work Item Level Sentiment Analysis */}
      {viewMode === 'workItems' && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Work Item Sentiment Analysis
          </Typography>
          
          {Array.from(workItemSentiments.entries()).length === 0 ? (
            <Alert severity="info">No work items with comments found in this sprint.</Alert>
          ) : (
            <List>
              {Array.from(workItemSentiments.entries()).map(([workItemId, { workItem, comments, sentiment }]) => (
                <Card key={workItemId} sx={{ mb: 2 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ListItemIcon>
                          {workItem.type === 'Bug' ? (
                            <BugReportIcon color="error" />
                          ) : (
                            <AssignmentIcon color="primary" />
                          )}
                        </ListItemIcon>
                        <Typography variant="h6">
                          {workItem.id}: {workItem.title}
                        </Typography>
                      </Box>
                      
                      {sentiment && (
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          {renderSentimentIcon(sentiment.overallSentiment, 'large')}
                          <Typography variant="body1" sx={{ ml: 1 }}>
                            {sentiment.overallSentiment.charAt(0).toUpperCase() + sentiment.overallSentiment.slice(1)}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                    
                    <Divider sx={{ my: 1 }} />
                    
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">
                        {workItem.state} • Assigned to: {workItem.assignedTo || 'Unassigned'}
                      </Typography>
                      
                      <Badge badgeContent={comments.length} color="primary">
                        <CommentIcon />
                      </Badge>
                    </Box>
                    
                    {sentiment && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="body2">
                          Sentiment Score: {sentiment.averageScore.toFixed(2)}
                        </Typography>
                        
                        <Box sx={{ 
                          width: '100%', 
                          height: 8, 
                          bgcolor: 'grey.300', 
                          borderRadius: 5,
                          mt: 1
                        }}>
                          <Box sx={{ 
                            width: `${Math.max(0, Math.min(100, (sentiment.averageScore + 1) * 50))}%`, 
                            height: '100%', 
                            bgcolor: sentiment.overallSentiment === 'positive' 
                              ? 'success.main' 
                              : sentiment.overallSentiment === 'negative' 
                                ? 'error.main' 
                                : 'warning.main',
                            borderRadius: 5
                          }} />
                        </Box>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              ))}
            </List>
          )}
        </Box>
      )}
      
      {/* Comment Level Sentiment Analysis */}
      {viewMode === 'comments' && (
        <Box>
          <Typography variant="h6" gutterBottom>
            Comment Sentiment Analysis
          </Typography>
          
          {comments.length === 0 ? (
            <Alert severity="info">No comments found in this sprint.</Alert>
          ) : (
            <>
              {/* Sentiment Trend Analysis */}
              {trendAnalysis && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      Sentiment Trend Analysis
                    </Typography>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                      <Typography variant="body1">
                        Overall Trend: 
                      </Typography>
                      <Chip 
                        label={trendAnalysis.overallTrend ? 
                          (trendAnalysis.overallTrend.charAt(0).toUpperCase() + trendAnalysis.overallTrend.slice(1)) : 
                          'Neutral'} 
                        color={
                          trendAnalysis.overallTrend === 'improving' 
                            ? 'success' 
                            : trendAnalysis.overallTrend === 'declining' 
                              ? 'error' 
                              : 'default'
                        }
                        sx={{ ml: 1 }}
                      />
                    </Box>
                    
                    <Typography variant="body2" gutterBottom>
                      Trend Score: {trendAnalysis.trendScore ? trendAnalysis.trendScore.toFixed(3) : '0.000'}
                    </Typography>
                    
                    {/* Simple visualization of the trend */}
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        Sentiment Over Time:
                      </Typography>
                      
                      <Box sx={{ display: 'flex', alignItems: 'flex-end', height: 100, mt: 1 }}>
                        {trendAnalysis.timeSeriesData && trendAnalysis.timeSeriesData.map((point: { timestamp: string; sentiment: 'positive' | 'negative' | 'neutral'; score: number }, index: number) => (
                          <Box 
                            key={index}
                            sx={{ 
                              width: `${100 / trendAnalysis.timeSeriesData.length}%`,
                              height: `${Math.max(5, Math.min(100, (point.score + 1) * 50))}%`,
                              bgcolor: point.sentiment === 'positive' 
                                ? 'success.main' 
                                : point.sentiment === 'negative' 
                                  ? 'error.main' 
                                  : 'warning.main',
                              mx: 0.5,
                              borderTopLeftRadius: 4,
                              borderTopRightRadius: 4,
                              position: 'relative',
                              '&:hover': {
                                opacity: 0.8
                              }
                            }}
                            title={`${new Date(point.timestamp).toLocaleDateString()} - ${point.sentiment} (${point.score.toFixed(2)})`}
                          />
                        ))}
                      </Box>
                      
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                        <Typography variant="caption">
                          {trendAnalysis.timeSeriesData && trendAnalysis.timeSeriesData.length > 0 && 
                            new Date(trendAnalysis.timeSeriesData[0].timestamp).toLocaleDateString()}
                        </Typography>
                        <Typography variant="caption">
                          {trendAnalysis.timeSeriesData && trendAnalysis.timeSeriesData.length > 0 && 
                            new Date(trendAnalysis.timeSeriesData[trendAnalysis.timeSeriesData.length - 1].timestamp).toLocaleDateString()}
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              )}
              
              {/* Individual Comments */}
              <List>
                {comments.map((comment, index) => {
                  const sentiment = sentimentResults[index];
                  
                  return (
                    <Card key={comment.id} sx={{ mb: 2 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="subtitle1">
                            {comment.workItemTitle} (#{comment.workItemId})
                          </Typography>
                          
                          {sentiment && (
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              {renderSentimentIcon(sentiment.sentiment)}
                              <Typography variant="body2" sx={{ ml: 1 }}>
                                {sentiment.sentiment.charAt(0).toUpperCase() + sentiment.sentiment.slice(1)}
                              </Typography>
                            </Box>
                          )}
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          By {comment.author} on {new Date(comment.timestamp).toLocaleString()}
                        </Typography>
                        
                        <Divider sx={{ my: 1 }} />
                        
                        <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>
                          {comment.text}
                        </Typography>
                        
                        {sentiment && (
                          <>
                            <Box sx={{ mt: 2 }}>
                              <Typography variant="body2">
                                Sentiment Score: {sentiment.score.toFixed(2)} (Confidence: {(sentiment.confidence * 100).toFixed(0)}%)
                              </Typography>
                              
                              <Box sx={{ 
                                width: '100%', 
                                height: 8, 
                                bgcolor: 'grey.300', 
                                borderRadius: 5,
                                mt: 1
                              }}>
                                <Box sx={{ 
                                  width: `${Math.max(0, Math.min(100, (sentiment.score + 1) * 50))}%`, 
                                  height: '100%', 
                                  bgcolor: sentiment.sentiment === 'positive' 
                                    ? 'success.main' 
                                    : sentiment.sentiment === 'negative' 
                                      ? 'error.main' 
                                      : 'warning.main',
                                  borderRadius: 5
                                }} />
                              </Box>
                            </Box>
                            
                            {sentiment.keywords && sentiment.keywords.length > 0 && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" gutterBottom>
                                  Key Phrases:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                  {sentiment.keywords.map((keyword, i) => (
                                    <Chip key={i} label={keyword} size="small" />
                                  ))}
                                </Box>
                              </Box>
                            )}
                            
                            {sentiment.summary && (
                              <Box sx={{ mt: 2 }}>
                                <Typography variant="body2" gutterBottom>
                                  Summary:
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {sentiment.summary}
                                </Typography>
                              </Box>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </List>
            </>
          )}
        </Box>
      )}
    </Box>
  );
};

export default SentimentAnalysisPanel;
