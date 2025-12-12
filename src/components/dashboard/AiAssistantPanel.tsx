import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress, 
  Divider, 
  Button,
  Card,
  CardContent,
  Grid,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Alert
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import adoService, { SprintStatistics } from '../../services/adoService';
import azureOpenAIService from '../../services/azureOpenAiService';

const AiAssistantPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sprintName, setSprintName] = useState('Current Sprint');
  const [sprintStats, setSprintStats] = useState<SprintStatistics | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [insights, setInsights] = useState<{
    title: string;
    description: string;
    type: 'success' | 'warning' | 'error' | 'info';
  }[]>([]);

  useEffect(() => {
    loadSprintData();
  }, []);

  const loadSprintData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current sprint
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        setError('No active sprint found');
        return;
      }

      setSprintName(currentSprint.name);

      // Get sprint statistics
      const stats = await adoService.getSprintStatistics(currentSprint.id);
      setSprintStats(stats);

      // Generate AI analysis
      await generateAiAnalysis(stats, currentSprint.name);
    } catch (err) {
      console.error('Error loading sprint data:', err);
      setError('Failed to load sprint data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateAiAnalysis = async (stats: SprintStatistics, sprint: string) => {
    try {
      // Generate sprint summary using Azure OpenAI
      const analysis = await azureOpenAIService.generateSprintSummary(
        sprint,
        stats.completedWorkItems,
        stats.inProgressWorkItems,
        stats.blockedWorkItems
      );

      setAiAnalysis(analysis);

      // Extract insights from the AI analysis
      // Generate real-time insights based on the AI analysis and sprint statistics
      const aiGeneratedInsights = [
        {
          title: 'Sprint Progress',
          description: `${stats.completedWorkItems} of ${stats.totalWorkItems} items completed (${Math.round((stats.completedWorkItems / (stats.totalWorkItems || 1)) * 100)}%)`,
          type: stats.completedWorkItems / (stats.totalWorkItems || 1) > 0.5 ? 'success' : 'warning'
        },
        {
          title: 'Blocked Items',
          description: `${stats.blockedWorkItems} items are currently blocked`,
          type: stats.blockedWorkItems > 0 ? 'error' : 'success'
        },
        {
          title: 'Effort Remaining',
          description: `${stats.remainingEffort} points of effort remaining`,
          type: stats.remainingEffort > stats.completedEffort ? 'warning' : 'info'
        }
      ] as {
        title: string;
        description: string;
        type: 'success' | 'warning' | 'error' | 'info';
      }[];

      // Extract additional insights from the AI analysis text
      if (analysis) {
        // Look for risk patterns in the AI analysis
        if (analysis.toLowerCase().includes('risk') || analysis.toLowerCase().includes('concern') || analysis.toLowerCase().includes('attention')) {
          aiGeneratedInsights.push({
            title: 'AI Risk Assessment',
            description: 'Potential risks identified in the sprint. Review the AI analysis for details.',
            type: 'warning'
          });
        }

        // Look for positive patterns
        if (analysis.toLowerCase().includes('good progress') || analysis.toLowerCase().includes('well') || analysis.toLowerCase().includes('on track')) {
          aiGeneratedInsights.push({
            title: 'AI Progress Assessment',
            description: 'The sprint appears to be progressing well according to AI analysis.',
            type: 'success'
          });
        }

        // Look for recommendations
        if (analysis.toLowerCase().includes('recommend') || analysis.toLowerCase().includes('suggest') || analysis.toLowerCase().includes('consider')) {
          aiGeneratedInsights.push({
            title: 'AI Recommendations',
            description: 'The AI has provided specific recommendations for this sprint. See analysis for details.',
            type: 'info'
          });
        }
      }

      setInsights(aiGeneratedInsights);
    } catch (err) {
      console.error('Error generating AI analysis:', err);
      setError('Failed to generate AI analysis');
    }
  };

  const getInsightIcon = (type: 'success' | 'warning' | 'error' | 'info') => {
    switch (type) {
      case 'success':
        return <CheckCircleIcon color="success" />;
      case 'warning':
        return <WarningIcon color="warning" />;
      case 'error':
        return <ErrorIcon color="error" />;
      case 'info':
        return <InfoIcon color="info" />;
    }
  };

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
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom>
        Sprint Review: {sprintName}
      </Typography>

      {/* Sprint Statistics */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={3}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e3f2fd', textAlign: 'center' }}>
            <Typography variant="h6">{sprintStats?.totalWorkItems || 0}</Typography>
            <Typography variant="body2">Total Items</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e8f5e9', textAlign: 'center' }}>
            <Typography variant="h6">{sprintStats?.completedWorkItems || 0}</Typography>
            <Typography variant="body2">Completed</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#fff3e0', textAlign: 'center' }}>
            <Typography variant="h6">{sprintStats?.inProgressWorkItems || 0}</Typography>
            <Typography variant="body2">In Progress</Typography>
          </Paper>
        </Grid>
        <Grid item xs={3}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#ffebee', textAlign: 'center' }}>
            <Typography variant="h6">{sprintStats?.blockedWorkItems || 0}</Typography>
            <Typography variant="body2">Blocked</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* AI Analysis */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            AI Sprint Analysis
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
          >
            {aiAnalysis || 'No analysis available'}
          </Typography>
        </CardContent>
      </Card>

      {/* Key Insights */}
      <Typography variant="h6" gutterBottom>
        Key Insights
      </Typography>
      <List>
        {insights.map((insight, index) => (
          <ListItem key={index} alignItems="flex-start">
            <ListItemIcon>
              {getInsightIcon(insight.type)}
            </ListItemIcon>
            <ListItemText
              primary={insight.title}
              secondary={insight.description}
            />
          </ListItem>
        ))}
      </List>

      {/* Velocity Trend */}
      <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
        Velocity Trend
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TrendingUpIcon color="success" sx={{ mr: 1 }} />
            <Typography variant="body1">
              {sprintStats ? `${sprintStats.completedEffort} points completed this sprint` : 'No data available'}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {sprintStats && sprintStats.completedWorkItems > 0
              ? `Average of ${(sprintStats.completedEffort / sprintStats.completedWorkItems).toFixed(1)} points per completed item`
              : 'No completed items to calculate average'}
          </Typography>
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, textAlign: 'center' }}>
        <Button variant="contained" onClick={loadSprintData}>
          Refresh Analysis
        </Button>
      </Box>
    </Box>
  );
};

export default AiAssistantPanel;
