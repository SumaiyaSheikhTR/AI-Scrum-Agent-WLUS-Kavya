import React, { useState } from 'react';
import { 
  Box, 
  Paper, 
  Tabs, 
  Tab, 
  Typography, 
  Divider,
  useTheme,
  useMediaQuery,
  Badge
} from '@mui/material';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SuggestIcon from '@mui/icons-material/Lightbulb';
import MoodIcon from '@mui/icons-material/Mood';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import AiAssistantPanel from './AiAssistantPanel';
import WorkItemSuggestions from './WorkItemSuggestions';
import SentimentAnalysisPanel from './SentimentAnalysisPanel';
import DuplicateWorkItemsPanel from './DuplicateWorkItemsPanel';
import workItemSuggestionService from '../../services/workItemSuggestionService';
import adoService from '../../services/adoService';
import azureOpenAIService from '../../services/azureOpenAiService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-assistant-tabpanel-${index}`}
      aria-labelledby={`ai-assistant-tab-${index}`}
      style={{ height: '100%', overflow: 'hidden' }}
      {...other}
    >
      {value === index && (
        <Box sx={{ height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `ai-assistant-tab-${index}`,
    'aria-controls': `ai-assistant-tabpanel-${index}`,
  };
};

const AiScrumAssistant: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Load AI-powered suggestions
  React.useEffect(() => {
    const loadAiSuggestions = async () => {
      try {
        // Fetch work items from ADO
        const currentSprint = await adoService.getCurrentSprint();
        if (currentSprint) {
          const workItems = await adoService.getSprintWorkItems(currentSprint.id);
          
          // Get sprint statistics for AI analysis
          const stats = await adoService.getSprintStatistics(currentSprint.id);
          
          // Generate AI analysis using Azure OpenAI
          const aiAnalysis = await azureOpenAIService.generateSprintSummary(
            currentSprint.name,
            stats.completedWorkItems,
            stats.inProgressWorkItems,
            stats.blockedWorkItems
          );
          
          // Generate suggestions based on AI analysis
          const generatedSuggestions = workItemSuggestionService.generateAISuggestions(workItems, aiAnalysis);
          setSuggestions(generatedSuggestions);
          
          // If no AI suggestions were generated, fall back to rule-based suggestions
          if (generatedSuggestions.length === 0) {
            console.log('No AI suggestions generated, falling back to rule-based suggestions');
            const fallbackSuggestions = workItemSuggestionService.generateSuggestions(workItems);
            setSuggestions(fallbackSuggestions);
          }
        }
      } catch (error) {
        console.error('Error loading AI suggestions:', error);
        // Fallback to rule-based suggestions
        try {
          const currentSprint = await adoService.getCurrentSprint();
          if (currentSprint) {
            const workItems = await adoService.getSprintWorkItems(currentSprint.id);
            const fallbackSuggestions = workItemSuggestionService.generateSuggestions(workItems);
            setSuggestions(fallbackSuggestions);
          }
        } catch (fallbackError) {
          console.error('Error loading fallback suggestions:', fallbackError);
          // Fallback to empty suggestions
          setSuggestions([]);
        }
      }
    };

    loadAiSuggestions();
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSuggestionApplied = (suggestionId: number) => {
    // In a real app, this would apply the suggestion to the work item
    // For now, we'll just remove it from the list
    setSuggestions(prev => prev.filter((_, index) => index !== suggestionId));
  };

  const handleSuggestionDismissed = (suggestionId: number) => {
    // Remove the suggestion from the list
    setSuggestions(prev => prev.filter((_, index) => index !== suggestionId));
  };

  return (
    <Paper sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: 2
    }}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          aria-label="AI assistant tabs"
          variant={isMobile ? "fullWidth" : "standard"}
          centered={!isMobile}
        >
          <Tab 
            icon={<AssessmentIcon />} 
            label={isMobile ? undefined : "Sprint Analysis"} 
            {...a11yProps(0)} 
          />
          <Tab 
            icon={<SuggestIcon />} 
            label={isMobile ? undefined : "Suggestions"} 
            {...a11yProps(1)} 
            sx={{ position: 'relative' }}
          />
          <Tab 
            icon={<MoodIcon />} 
            label={isMobile ? undefined : "Sentiment Analysis"} 
            {...a11yProps(2)} 
          />
          <Tab 
            icon={<ContentCopyIcon />} 
            label={isMobile ? undefined : "Duplicate Items"} 
            {...a11yProps(3)} 
          />
        </Tabs>
      </Box>

      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <AiAssistantPanel />
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Work Item Suggestions
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              AI-powered suggestions to help you manage your work items more effectively.
            </Typography>
            
            <Divider sx={{ mb: 3 }} />
            
            {suggestions.length > 0 ? (
              <WorkItemSuggestions 
                suggestions={suggestions}
                onSuggestionApplied={handleSuggestionApplied}
                onSuggestionDismissed={handleSuggestionDismissed}
              />
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <SuggestIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="body1" color="text.secondary">
                  No suggestions available at the moment.
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Check back later for AI-generated recommendations.
                </Typography>
              </Box>
            )}
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <SentimentAnalysisPanel />
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            <DuplicateWorkItemsPanel />
          </Box>
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default AiScrumAssistant;
