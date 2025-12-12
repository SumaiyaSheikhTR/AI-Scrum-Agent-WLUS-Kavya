import React, { useState, useEffect } from 'react';
import { 
  Grid, 
  Paper, 
  Typography, 
  Box, 
  CircularProgress, 
  Alert, 
  LinearProgress, 
  ToggleButton, 
  ToggleButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Link,
  Chip,
  Divider
} from '@mui/material';
import { Close as CloseIcon, OpenInNew as OpenInNewIcon, GitHub as GitHubIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import adoService, { Sprint, WorkItem, SprintStatistics } from '../../services/adoService';
import AiScrumAssistant from '../../components/dashboard/AiScrumAssistant';
import DeveloperEngagementPanel from '../../components/dashboard/DeveloperEngagementPanel';
import GitPRMonitoringPanel from '../../components/dashboard/GitPRMonitoringPanel';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#fff',
  ...theme.typography.body2,
  padding: theme.spacing(2),
  color: theme.palette.text.secondary,
  borderRadius: 8,
  border: '1px solid #e0e0e0',
}));

const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [sprintStats, setSprintStats] = useState<SprintStatistics | null>(null);
  const [staleItems, setStaleItems] = useState<WorkItem[]>([]);
  const [metricsFilter, setMetricsFilter] = useState<string>('all');
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Function to fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current sprint
      const sprint = await adoService.getCurrentSprint();
      setCurrentSprint(sprint);

      if (sprint) {
        // Fetch work items for current sprint
        const items = await adoService.getSprintWorkItems(sprint.id);
        setWorkItems(items);

        // Fetch sprint statistics
        const stats = await adoService.getSprintStatistics(sprint.id);
        setSprintStats(stats);

        // Fetch stale items
        const stale = await adoService.getStaleWorkItems(5);
        setStaleItems(stale);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle opening work item details dialog
  const handleWorkItemClick = (workItem: WorkItem) => {
    setSelectedWorkItem(workItem);
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setSelectedWorkItem(null);
  };

  // Generate ADO work item URL
  const getAdoWorkItemUrl = (workItem: WorkItem) => {
    if (workItem.url) {
      return workItem.url;
    }
    const adoBaseUrl = process.env.REACT_APP_ADO_API_URL || 'https://dev.azure.com';
    return `${adoBaseUrl}/your-org/your-project/_workitems/edit/${workItem.id}`;
  };

  // Mock function to get PR links
  const getPRLinks = (workItem: WorkItem): string[] => {
    if (workItem.type === 'User Story' && workItem.tags?.includes('has-pr')) {
      return [
        'https://github.com/your-org/your-repo/pull/123',
        'https://github.com/your-org/your-repo/pull/124'
      ];
    }
    return [];
  };

  useEffect(() => {
    fetchDashboardData();

    const handleDataRefresh = () => {
      fetchDashboardData();
    };

    window.addEventListener('ado-data-refresh', handleDataRefresh);

    return () => {
      window.removeEventListener('ado-data-refresh', handleDataRefresh);
    };
  }, []);

  if (isLoading) {
    return (
      <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>Loading dashboard...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
        <Button variant="contained" onClick={fetchDashboardData}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Sprint Task Summary */}
        <Grid item xs={12}>
          <Item>
            <Typography variant="h5" component="h2" gutterBottom>
              Sprint Task Summary
            </Typography>
            
            {/* Metrics Filter */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>Filter by Work Item Type:</Typography>
              <ToggleButtonGroup
                value={metricsFilter}
                exclusive
                onChange={(event, newFilter) => {
                  if (newFilter !== null) {
                    setMetricsFilter(newFilter);
                  }
                }}
                aria-label="metrics filter"
                size="small"
              >
                <ToggleButton value="all" aria-label="all items">
                  All Items
                </ToggleButton>
                <ToggleButton value="user-story" aria-label="user stories">
                  User Stories
                </ToggleButton>
                <ToggleButton value="bug" aria-label="bugs">
                  Bugs
                </ToggleButton>
                <ToggleButton value="task" aria-label="tasks">
                  Tasks
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Typography variant="body1">
              Current Sprint: {currentSprint 
                ? `${currentSprint.name} (${new Date(currentSprint.startDate).toLocaleDateString()} - ${new Date(currentSprint.endDate).toLocaleDateString()})` 
                : 'No active sprint found'}
            </Typography>
            
            {/* Filtered Metrics Display */}
            {(() => {
              const getFilteredItems = () => {
                switch (metricsFilter) {
                  case 'user-story':
                    return workItems.filter(item => item.type === 'User Story');
                  case 'bug':
                    return workItems.filter(item => item.type === 'Bug');
                  case 'task':
                    return workItems.filter(item => item.type === 'Task');
                  default:
                    return workItems;
                }
              };
              
              const filteredItems = getFilteredItems();
              const completedFiltered = filteredItems.filter(item => item.state === 'Done');
              const inProgressFiltered = filteredItems.filter(item => item.state === 'Active' || item.state === 'In Progress');
              const blockedFiltered = filteredItems.filter(item => item.state === 'Blocked');
              const plannedCount = filteredItems.length;
              
              return (
                <>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body1">
                      Total Planned Work Items ({metricsFilter === 'all' ? 'All Types' : metricsFilter.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}): {plannedCount}
                    </Typography>
                    <Typography variant="body1">
                      Progress: {plannedCount > 0 ? Math.round((completedFiltered.length / plannedCount) * 100) : 0}% complete
                    </Typography>
                    <LinearProgress 
                      variant="determinate" 
                      value={plannedCount > 0 ? Math.round((completedFiltered.length / plannedCount) * 100) : 0} 
                      sx={{ mt: 1, height: 10, borderRadius: 1 }}
                    />
                  </Box>
                  <Grid container spacing={2} sx={{ mt: 2 }}>
                    <Grid item xs={3}>
                      <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e3f2fd', textAlign: 'center' }}>
                        <Typography variant="h6">{plannedCount}</Typography>
                        <Typography variant="body2">Planned Items</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={3}>
                      <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e8f5e9', textAlign: 'center' }}>
                        <Typography variant="h6">{completedFiltered.length}</Typography>
                        <Typography variant="body2">Completed</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={3}>
                      <Paper elevation={0} sx={{ p: 2, backgroundColor: '#fff3e0', textAlign: 'center' }}>
                        <Typography variant="h6">{inProgressFiltered.length}</Typography>
                        <Typography variant="body2">In Progress</Typography>
                      </Paper>
                    </Grid>
                    <Grid item xs={3}>
                      <Paper elevation={0} sx={{ p: 2, backgroundColor: '#ffebee', textAlign: 'center' }}>
                        <Typography variant="h6">{blockedFiltered.length}</Typography>
                        <Typography variant="body2">Blocked</Typography>
                      </Paper>
                    </Grid>
                  </Grid>
                </>
              );
            })()}
            
            {/* Training/Delivery Grouping */}
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>Work Item Categories</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f3e5f5', textAlign: 'center' }}>
                    <Typography variant="h5">{workItems.filter(item => item.tags?.includes('Training') || item.title.toLowerCase().includes('training')).length}</Typography>
                    <Typography variant="body2">Training Items</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Completed: {workItems.filter(item => (item.tags?.includes('Training') || item.title.toLowerCase().includes('training')) && item.state === 'Done').length}
                    </Typography>
                  </Paper>
                </Grid>
                <Grid item xs={6}>
                  <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e8f5e9', textAlign: 'center' }}>
                    <Typography variant="h5">{workItems.filter(item => !item.tags?.includes('Training') && !item.title.toLowerCase().includes('training')).length}</Typography>
                    <Typography variant="body2">Delivery Items</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Completed: {workItems.filter(item => (!item.tags?.includes('Training') && !item.title.toLowerCase().includes('training')) && item.state === 'Done').length}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Box>
          </Item>
        </Grid>

        {/* User Story/Bug Summary - P1 */}
        <Grid item xs={12} md={8}>
          <Item>
            <Typography variant="h5" component="h2" gutterBottom>
              User Stories & Bugs Summary
            </Typography>
            <Box sx={{ height: 400, overflow: 'auto' }}>
              {workItems.filter(item => ['User Story', 'Bug'].includes(item.type)).map((item) => (
                <Paper 
                  key={item.id} 
                  elevation={0} 
                  sx={{ 
                    p: 2, 
                    mb: 2, 
                    backgroundColor: item.type === 'Bug' ? '#ffebee' : '#e8f5e9',
                    borderLeft: `4px solid ${item.priority === 1 ? '#f44336' : item.priority === 2 ? '#ff9800' : '#4caf50'}`,
                    cursor: 'pointer',
                    '&:hover': {
                      backgroundColor: item.type === 'Bug' ? '#ffcdd2' : '#c8e6c9',
                      transform: 'translateY(-1px)',
                      boxShadow: 1,
                    },
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onClick={() => handleWorkItemClick(item)}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {item.type}: {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    ID: {item.id} | Priority: {item.priority} | State: {item.state}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Assigned to: {item.assignedTo || 'Unassigned'}
                  </Typography>
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">
                      Click for details
                    </Typography>
                    <OpenInNewIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </Box>
                </Paper>
              ))}
              {workItems.filter(item => ['User Story', 'Bug'].includes(item.type)).length === 0 && (
                <Alert severity="info">
                  No User Stories or Bugs found in the current sprint.
                </Alert>
              )}
            </Box>
          </Item>
        </Grid>

        {/* Capacity Utilization - P1 */}
        <Grid item xs={12} md={4}>
          <Item>
            <Typography variant="h5" component="h2" gutterBottom>
              Sprint Capacity Utilization
            </Typography>
            <Box sx={{ height: 400, overflow: 'auto' }}>
              {(() => {
                const userCapacity = workItems.reduce((acc, item) => {
                  if (item.assignedTo) {
                    const user = item.assignedTo;
                    if (!acc[user]) {
                      acc[user] = { assignedHours: 0, completedHours: 0 };
                    }
                    const hours = item.effort || 4;
                    acc[user].assignedHours += hours;
                    if (item.state === 'Done') {
                      acc[user].completedHours += hours;
                    }
                  }
                  return acc;
                }, {} as Record<string, { assignedHours: number; completedHours: number }>);

                const users = Object.keys(userCapacity);
                const totalCapacity = 40; // 40 hours per sprint per user (8 hours/day * 5 days)

                return users.length > 0 ? users.map((user) => {
                  const capacity = userCapacity[user];
                  const utilizationPercent = Math.min((capacity.assignedHours / totalCapacity) * 100, 100);
                  const completionPercent = capacity.assignedHours > 0 ? (capacity.completedHours / capacity.assignedHours) * 100 : 0;

                  return (
                    <Paper
                      key={user}
                      elevation={0}
                      sx={{
                        p: 2,
                        mb: 2,
                        backgroundColor: '#f5f5f5',
                        borderLeft: `4px solid ${utilizationPercent > 100 ? '#f44336' : utilizationPercent > 80 ? '#ff9800' : '#4caf50'}`
                      }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                        {user}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Assigned: {capacity.assignedHours}h / {totalCapacity}h ({utilizationPercent.toFixed(1)}%)
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Completed: {completionPercent.toFixed(1)}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(utilizationPercent, 100)}
                        sx={{ mt: 1, height: 6, borderRadius: 1 }}
                        color={utilizationPercent > 100 ? 'error' : utilizationPercent > 80 ? 'warning' : 'success'}
                      />
                    </Paper>
                  );
                }) : (
                  <Alert severity="info">
                    No capacity data available for the current sprint.
                  </Alert>
                );
              })()}
            </Box>
          </Item>
        </Grid>

        {/* Developer Engagement Panel */}
        <Grid item xs={12} md={6}>
          <Item>
            <Box sx={{ height: 'auto', minHeight: 600 }}>
              <DeveloperEngagementPanel />
            </Box>
          </Item>
        </Grid>

        {/* AI Scrum Assistant */}
        <Grid item xs={12} md={6}>
          <Item>
            <Box sx={{ height: 'auto', minHeight: 600 }}>
              <AiScrumAssistant />
            </Box>
          </Item>
        </Grid>

        {/* Git PR Monitoring Panel */}
        <Grid item xs={12}>
          <Item>
            <Box sx={{ height: 'auto', minHeight: 600 }}>
              <GitPRMonitoringPanel />
            </Box>
          </Item>
        </Grid>
      </Grid>

      {/* Work Item Details Dialog */}
      <Dialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              {selectedWorkItem ? `${selectedWorkItem.type}: ${selectedWorkItem.title}` : 'Work Item Details'}
            </Typography>
            <IconButton onClick={handleDialogClose} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {selectedWorkItem && (
            <Box>
              {/* Work Item Basic Info */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>ID:</strong> {selectedWorkItem.id} | 
                  <strong> Type:</strong> {selectedWorkItem.type} | 
                  <strong> State:</strong> {selectedWorkItem.state} | 
                  <strong> Priority:</strong> {selectedWorkItem.priority || 'Not set'}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  <strong>Assigned to:</strong> {selectedWorkItem.assignedTo || 'Unassigned'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Effort:</strong> {selectedWorkItem.effort || 'Not estimated'} points
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Description */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Description
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {selectedWorkItem.description || 'No description available.'}
                </Typography>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* ADO Link */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Azure DevOps Link
                </Typography>
                <Link
                  href={getAdoWorkItemUrl(selectedWorkItem)}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                >
                  <OpenInNewIcon fontSize="small" />
                  Open in Azure DevOps
                </Link>
              </Box>

              {/* Git PR Links */}
              {(() => {
                const prLinks = getPRLinks(selectedWorkItem);
                return prLinks.length > 0 && (
                  <>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        Related Pull Requests
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {prLinks.map((prLink, index) => (
                          <Link
                            key={index}
                            href={prLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                          >
                            <GitHubIcon fontSize="small" />
                            Pull Request #{index + 1}
                          </Link>
                        ))}
                      </Box>
                    </Box>
                  </>
                );
              })()}

              {/* Tags */}
              {selectedWorkItem.tags && selectedWorkItem.tags.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>
                      Tags
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {selectedWorkItem.tags.map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                </>
              )}

              {/* Timestamps */}
              <Divider sx={{ my: 2 }} />
              <Box>
                <Typography variant="body2" color="text.secondary">
                  <strong>Created:</strong> {new Date(selectedWorkItem.createdDate).toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  <strong>Last Updated:</strong> {new Date(selectedWorkItem.updatedDate).toLocaleString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose} color="primary">
            Close
          </Button>
          {selectedWorkItem && (
            <Button
              onClick={() => window.open(getAdoWorkItemUrl(selectedWorkItem), '_blank')}
              color="primary"
              variant="contained"
              startIcon={<OpenInNewIcon />}
            >
              Open in ADO
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Dashboard;
