import React, { useState, useEffect, useCallback } from 'react';
import { 
  Typography, 
  Box, 
  CircularProgress, 
  Alert, 
  Tabs, 
  Tab,
  Button
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import adoService, { WorkItem, SprintStatistics } from '../../services/adoService';
import DeveloperAnalytics from '../../components/dashboard/DeveloperAnalytics';
import SprintMetricsPanel from '../../components/dashboard/SprintMetricsPanel';
import DataDrivenInsights from '../../components/dashboard/DataDrivenInsights';
import SentimentAnalysisPanel from '../../components/dashboard/SentimentAnalysisPanel';
import VelocityAnalysisPanel from '../../components/dashboard/VelocityAnalysisPanel';

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
      id={`analytics-tabpanel-${index}`}
      aria-labelledby={`analytics-tab-${index}`}
      {...other}
      style={{ height: 'calc(100% - 48px)' }}
    >
      {value === index && (
        <Box sx={{ pt: 2, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `analytics-tab-${index}`,
    'aria-controls': `analytics-tabpanel-${index}`,
  };
};

const AnalyticsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [sprintStats, setSprintStats] = useState<SprintStatistics | null>(null);
  const [tabValue, setTabValue] = useState(0);

  const fetchAnalyticsData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let items: WorkItem[] = [];
      let stats: SprintStatistics | null = null;
      
      // Fetch data for current sprint
      const sprints = await adoService.getSprints();
      if (sprints.length > 0) {
        const currentSprint = sprints.find(sprint => sprint.state === 'current') || sprints[0];
        items = await adoService.getSprintWorkItems(currentSprint.id);
        stats = await adoService.getSprintStatistics(currentSprint.id);
      }

      setWorkItems(items);
      setSprintStats(stats);
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleRefresh = () => {
    fetchAnalyticsData();
  };

  const handleExportData = () => {
    // In a real application, this would generate a CSV or Excel file
    alert('Export functionality would be implemented here');
  };

  if (isLoading && workItems.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && workItems.length === 0) {
    return (
      <Box sx={{ mt: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, height: 'calc(100vh - 120px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Sprint Analytics
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />} 
            onClick={handleRefresh}
            sx={{ mr: 1 }}
          >
            Refresh
          </Button>
          <Button 
            variant="contained" 
            startIcon={<DownloadIcon />} 
            onClick={handleExportData}
          >
            Export
          </Button>
        </Box>
      </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={20} sx={{ mr: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Loading analytics data...
          </Typography>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Box sx={{ height: 'calc(100% - 100px)', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="analytics tabs">
            <Tab label="Developer Analytics" {...a11yProps(0)} />
            <Tab label="Sprint Metrics" {...a11yProps(1)} />
            <Tab label="Data-Driven Insights" {...a11yProps(2)} />
            <Tab label="Sentiment Analysis" {...a11yProps(3)} />
            <Tab label="Burndown Analysis" {...a11yProps(4)} />
            <Tab label="Velocity Trends" {...a11yProps(5)} />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <DeveloperAnalytics workItems={workItems} />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <SprintMetricsPanel 
            sprintStats={sprintStats} 
            sprintName={'Current Sprint'} 
          />
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <DataDrivenInsights 
            sprint={null}
            workItems={workItems}
            sprintStats={sprintStats}
          />
        </TabPanel>
        
        <TabPanel value={tabValue} index={3}>
          <SentimentAnalysisPanel 
            sprintId={undefined} 
            useRealData={true}
          />
        </TabPanel>
        
        <TabPanel value={tabValue} index={4}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <Typography variant="body1" color="text.secondary">
              Burndown Analysis will be implemented in a future update
            </Typography>
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={5}>
          <VelocityAnalysisPanel workItems={workItems} />
        </TabPanel>
      </Box>
    </Box>
  );
};

export default AnalyticsPage;
