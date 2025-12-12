import React, { useState, useEffect } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Button,
  IconButton,
  Tooltip,
  LinearProgress,
  Grid,
  Alert,
  Tabs,
  Tab,
  Badge,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Notifications as NotificationsIcon,
  SentimentSatisfied as SentimentSatisfiedIcon,
  SentimentDissatisfied as SentimentDissatisfiedIcon,
  SentimentVeryDissatisfied as SentimentVeryDissatisfiedIcon,
  SentimentNeutral as SentimentNeutralIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip as RechartsTooltip, 
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import developerEngagementService, { 
  DeveloperActivity, 
  WorkItemEngagement 
} from '../../services/developerEngagementService';
import sentimentAnalysisService from '../../services/sentimentAnalysisService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`engagement-tabpanel-${index}`}
      aria-labelledby={`engagement-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `engagement-tab-${index}`,
    'aria-controls': `engagement-tabpanel-${index}`,
  };
}

const DeveloperEngagementPanel: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [developerActivities, setDeveloperActivities] = useState<DeveloperActivity[]>([]);
  const [staleWorkItems, setStaleWorkItems] = useState<WorkItemEngagement[]>([]);
  const [reminderHistory, setReminderHistory] = useState<any[]>([]);
  const [sentimentHistory, setSentimentHistory] = useState<any[]>([]);
  const [sentimentTrends, setSentimentTrends] = useState<any>(null);
  const [selectedDeveloper, setSelectedDeveloper] = useState<string | null>(null);
  const [processSummary, setProcessSummary] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedDeveloper) {
      loadDeveloperSentimentTrends(selectedDeveloper);
    }
  }, [selectedDeveloper]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Get developer activities
      const activities = developerEngagementService.getDeveloperActivities();
      setDeveloperActivities(activities);

      // Get stale work items
      const staleItems = developerEngagementService.getStaleWorkItems();
      setStaleWorkItems(staleItems);

      // Get reminder history
      const reminders = developerEngagementService.getReminderHistory();
      setReminderHistory(reminders);

      // Get sentiment history
      const sentiments = developerEngagementService.getSentimentHistory();
      setSentimentHistory(sentiments);

      // Get processing summary
      const summary = developerEngagementService.getProcessingSummary();
      setProcessSummary(summary);

      // If we have a selected developer, load their sentiment trends
      if (selectedDeveloper) {
        await loadDeveloperSentimentTrends(selectedDeveloper);
      } else if (activities.length > 0) {
        // Select the first developer by default
        setSelectedDeveloper(activities[0].developerId);
      }
    } catch (error) {
      console.error('Error loading developer engagement data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDeveloperSentimentTrends = async (developerId: string) => {
    try {
      const trends = await developerEngagementService.analyzeDeveloperSentimentTrends(developerId);
      setSentimentTrends(trends);
    } catch (error) {
      console.error('Error loading developer sentiment trends:', error);
      setSentimentTrends(null);
    }
  };

  const handleRefresh = async () => {
    await loadData();
  };

  const handleRunManually = async () => {
    setIsLoading(true);
    try {
      await developerEngagementService.runManually();
      await loadData();
    } catch (error) {
      console.error('Error running developer engagement tracking:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const getSentimentIcon = (sentiment: string, size: 'small' | 'medium' | 'large' | 'inherit' = 'medium') => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return <SentimentSatisfiedIcon color="success" fontSize={size} />;
      case 'negative':
        return <SentimentDissatisfiedIcon color="error" fontSize={size} />;
      case 'frustrated':
        return <SentimentVeryDissatisfiedIcon color="error" fontSize={size} />;
      case 'neutral':
      default:
        return <SentimentNeutralIcon color="action" fontSize={size} />;
    }
  };

  const theme = useTheme();
  
  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive':
        return theme.palette.success.main;
      case 'negative':
        return theme.palette.error.main;
      case 'frustrated':
        return theme.palette.error.dark;
      case 'neutral':
      default:
        return theme.palette.grey[500];
    }
  };

  const getEngagementScoreColor = (score: number) => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'error';
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  // Prepare data for charts
  const prepareEngagementScoreData = () => {
    return developerActivities.map(dev => ({
      name: dev.developerName.split(' ')[0], // Just use first name for chart
      score: dev.engagementScore,
      color: getEngagementScoreColor(dev.engagementScore),
    }));
  };

  const prepareSentimentData = () => {
    // Count sentiments by type
    const sentimentCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
      frustrated: 0,
    };

    sentimentHistory.forEach(item => {
      const sentiment = item.sentiment.toLowerCase();
      if (sentimentCounts.hasOwnProperty(sentiment)) {
        sentimentCounts[sentiment as keyof typeof sentimentCounts]++;
      } else {
        sentimentCounts.neutral++;
      }
    });

    return [
      { name: 'Positive', value: sentimentCounts.positive, color: '#4caf50' },
      { name: 'Neutral', value: sentimentCounts.neutral, color: '#9e9e9e' },
      { name: 'Negative', value: sentimentCounts.negative, color: '#f44336' },
      { name: 'Frustrated', value: sentimentCounts.frustrated, color: '#d32f2f' },
    ].filter(item => item.value > 0);
  };

  return (
    <Card>
      <CardHeader
        title="Developer Engagement & Follow-ups"
        subheader={`Last updated: ${processSummary?.lastRun || 'Never'}`}
        action={
          <Box sx={{ display: 'flex' }}>
            <Tooltip title="Refresh data">
              <IconButton onClick={handleRefresh} disabled={isLoading}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <Button
              variant="outlined"
              size="small"
              onClick={handleRunManually}
              disabled={isLoading}
              sx={{ ml: 1 }}
            >
              Run Now
            </Button>
          </Box>
        }
      />
      <Divider />

      {isLoading && <LinearProgress />}

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="engagement tabs">
          <Tab label="Developer Engagement" {...a11yProps(0)} />
          <Tab 
            label={
              <Badge badgeContent={staleWorkItems.length} color="error" max={99}>
                Stale Items
              </Badge>
            } 
            {...a11yProps(1)} 
          />
          <Tab label="Sentiment Analysis" {...a11yProps(2)} />
          <Tab 
            label={
              <Badge badgeContent={reminderHistory.length} color="info" max={99}>
                Reminders
              </Badge>
            } 
            {...a11yProps(3)} 
          />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
        {developerActivities.length === 0 ? (
          <Alert severity="info">
            No developer activity data available. Run the engagement tracking to collect data.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Developer Engagement Scores
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Developer</TableCell>
                      <TableCell>Assigned</TableCell>
                      <TableCell>Completed</TableCell>
                      <TableCell>Stale</TableCell>
                      <TableCell align="right">Engagement Score</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {developerActivities.map((dev) => (
                      <TableRow key={dev.developerId}>
                        <TableCell>{dev.developerName}</TableCell>
                        <TableCell>{dev.workItemsAssigned}</TableCell>
                        <TableCell>{dev.workItemsCompleted}</TableCell>
                        <TableCell>
                          {dev.staleItemCount > 0 ? (
                            <Chip 
                              size="small" 
                              color="error" 
                              label={dev.staleItemCount} 
                              icon={<WarningIcon />} 
                            />
                          ) : (
                            <Chip 
                              size="small" 
                              color="success" 
                              label="0" 
                              icon={<CheckCircleIcon />} 
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            label={`${dev.engagementScore}%`}
                            color={getEngagementScoreColor(dev.engagementScore) as any}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" gutterBottom>
                Engagement Score Comparison
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={prepareEngagementScoreData()}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <XAxis dataKey="name" />
                    <YAxis domain={[0, 100]} />
                    <RechartsTooltip />
                    <Bar dataKey="score" name="Engagement Score">
                      {prepareEngagementScoreData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={
                          entry.color === 'success' ? '#4caf50' :
                          entry.color === 'info' ? '#2196f3' :
                          entry.color === 'warning' ? '#ff9800' : '#f44336'
                        } />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  The engagement score is calculated based on work item completion rate, response time to comments, and stale item count.
                  Higher scores indicate better engagement with the team's work items.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        {staleWorkItems.length === 0 ? (
          <Alert severity="success">
            No stale work items found. All items are being actively worked on.
          </Alert>
        ) : (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Stale Work Items ({staleWorkItems.length})
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              These work items have not been updated in {developerEngagementService.getConfig().reminderThresholdDays} or more days.
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Assigned To</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell align="right">Days Since Update</TableCell>
                    <TableCell align="right">Reminders Sent</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {staleWorkItems.map((item) => (
                    <TableRow key={item.workItemId}>
                      <TableCell>{item.workItemId}</TableCell>
                      <TableCell>{item.title}</TableCell>
                      <TableCell>{item.assignedTo || 'Unassigned'}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={item.state} 
                          color={item.state === 'Blocked' ? 'error' : 'primary'} 
                          variant="outlined" 
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          size="small"
                          label={item.daysSinceLastUpdate}
                          color={
                            item.daysSinceLastUpdate >= 7 ? 'error' :
                            item.daysSinceLastUpdate >= 5 ? 'warning' : 'info'
                          }
                        />
                      </TableCell>
                      <TableCell align="right">{item.remindersSent}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {sentimentHistory.length === 0 ? (
          <Alert severity="info">
            No sentiment data available. As developers add comments to work items, their sentiment will be analyzed and displayed here.
          </Alert>
        ) : (
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <Typography variant="subtitle1" gutterBottom>
                Comment Sentiment Distribution
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={prepareSentimentData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {prepareSentimentData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            
            <Grid item xs={12} md={8}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  Developer Sentiment Trends
                </Typography>
                <Box>
                  <Typography variant="body2" component="span" sx={{ mr: 1 }}>
                    Select Developer:
                  </Typography>
                  <select 
                    value={selectedDeveloper || ''} 
                    onChange={(e) => setSelectedDeveloper(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '4px' }}
                    aria-label="Select developer"
                    title="Select developer"
                  >
                    {developerActivities.map(dev => (
                      <option key={dev.developerId} value={dev.developerId}>
                        {dev.developerName}
                      </option>
                    ))}
                  </select>
                </Box>
              </Box>
              
              {sentimentTrends ? (
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    {getSentimentIcon(sentimentTrends.overallSentiment, 'large')}
                    <Typography variant="h6" sx={{ ml: 1 }}>
                      Overall Sentiment: {sentimentTrends.overallSentiment.charAt(0).toUpperCase() + sentimentTrends.overallSentiment.slice(1)}
                    </Typography>
                    <Chip 
                      label={`Score: ${sentimentTrends.averageScore.toFixed(2)}`} 
                      size="small"
                      sx={{ 
                        ml: 2,
                        backgroundColor: getSentimentColor(sentimentTrends.overallSentiment),
                        color: 'white'
                      }}
                    />
                  </Box>
                  
                  <Typography variant="body2" paragraph>
                    {sentimentTrends.summary}
                  </Typography>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="subtitle2" gutterBottom>
                    Sentiment Over Time
                  </Typography>
                  
                  {sentimentTrends.sentimentOverTime.length > 1 ? (
                    <Box sx={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={sentimentTrends.sentimentOverTime.map((item: any) => ({
                            ...item,
                            date: formatDate(item.timestamp)
                          }))}
                          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis domain={[-1, 1]} />
                          <RechartsTooltip />
                          <Line 
                            type="monotone" 
                            dataKey="score" 
                            stroke="#8884d8" 
                            activeDot={{ r: 8 }} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      Not enough data to show sentiment trends over time
                    </Typography>
                  )}
                  
                  {sentimentTrends.topKeywords.length > 0 && (
                    <>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle2" gutterBottom>
                        Top Keywords
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                        {sentimentTrends.topKeywords.map((keyword: string, index: number) => (
                          <Chip 
                            key={index} 
                            label={keyword} 
                            size="small" 
                            variant="outlined" 
                          />
                        ))}
                      </Box>
                    </>
                  )}
                </Paper>
              ) : (
                <Alert severity="info">
                  Select a developer to view their sentiment trends
                </Alert>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
                Recent Comment Sentiment
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Developer</TableCell>
                      <TableCell>Work Item</TableCell>
                      <TableCell>Date</TableCell>
                      <TableCell>Sentiment</TableCell>
                      <TableCell>Comment</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sentimentHistory.slice(0, 5).map((item, index) => (
                      <TableRow key={index}>
                        <TableCell>{item.developerName}</TableCell>
                        <TableCell>{item.workItemId}</TableCell>
                        <TableCell>{formatDate(item.date)}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {getSentimentIcon(item.sentiment)}
                            <Typography variant="body2" sx={{ ml: 1 }}>
                              {item.sentiment}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                            {item.comment.length > 50 ? `${item.comment.substring(0, 50)}...` : item.comment}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Comment sentiment is analyzed using natural language processing to detect the emotional tone.
                  This helps identify potential issues or frustrations within the team.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        )}
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {reminderHistory.length === 0 ? (
          <Alert severity="info">
            No reminders have been sent yet. As work items become stale, reminders will be automatically sent to developers.
          </Alert>
        ) : (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Recent Reminders Sent
            </Typography>
            <List>
              {reminderHistory.slice(0, 10).map((reminder, index) => (
                <ListItem key={index} divider={index < reminderHistory.length - 1}>
                  <ListItemAvatar>
                    <Avatar>
                      <NotificationsIcon />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={`Work Item #${reminder.workItemId} - ${reminder.reminderType} reminder`}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.primary">
                          Sent to: {reminder.developerId}
                        </Typography>
                        <br />
                        <Typography component="span" variant="body2">
                          {formatDate(reminder.date)}
                        </Typography>
                        <br />
                        <Typography component="span" variant="body2" color="text.secondary">
                          {reminder.message}
                        </Typography>
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
            {reminderHistory.length > 10 && (
              <Box sx={{ mt: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Showing 10 of {reminderHistory.length} reminders
                </Typography>
              </Box>
            )}
          </>
        )}
      </TabPanel>
    </Card>
  );
};

export default DeveloperEngagementPanel;
