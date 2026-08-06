import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Code as CodeIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Warning as WarningIcon,
  Visibility as VisibilityIcon,
  Assignment as AssignmentIcon
} from '@mui/icons-material';

import gitPRMonitoringService, { 
  WorkItemWithPR, 
  PullRequest
} from '../../services/gitPRMonitoringService';

interface GitPRMonitoringPanelProps {}

export const GitPRMonitoringPanel: React.FC<GitPRMonitoringPanelProps> = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [workItemsWithPRs, setWorkItemsWithPRs] = useState<WorkItemWithPR[]>([]);
  const [selectedWorkItem, setSelectedWorkItem] = useState<WorkItemWithPR | null>(null);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadWorkItemsWithPRs = useCallback(async () => {
    setLoading(true);
    try {
      const [workItems, statistics] = await Promise.all([
        gitPRMonitoringService.getWorkItemsWithPRs(),
        gitPRMonitoringService.getStatistics()
      ]);
      
      setWorkItemsWithPRs(workItems);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading work items with PRs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkItemsWithPRs();
  }, [loadWorkItemsWithPRs]);

  const handleRefresh = async () => {
    await loadWorkItemsWithPRs();
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handlePRClick = (pr: PullRequest) => {
    setSelectedPR(pr);
    setPrDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'primary';
      case 'completed': return 'success';
      case 'abandoned': return 'error';
      default: return 'default';
    }
  };

  const getWorkItemTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'user story': return 'info';
      case 'bug': return 'error';
      case 'task': return 'success';
      case 'feature': return 'primary';
      default: return 'default';
    }
  };

  const getVoteIcon = (vote: number) => {
    if (vote === 10) return <CheckIcon color="success" />;
    if (vote === -10) return <CloseIcon color="error" />;
    if (vote === -5) return <WarningIcon color="warning" />;
    return null;
  };

  const getFilteredWorkItems = () => {
    let filtered = workItemsWithPRs;

    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.workItem.type === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => 
        item.pullRequests.some(pr => pr.status === filterStatus)
      );
    }

    return filtered;
  };

  if (loading && workItemsWithPRs.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Loading work items with pull requests...
        </Typography>
      </Paper>
    );
  }

  if (workItemsWithPRs.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <AssignmentIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          No Work Items with Pull Requests Found
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          No work items with associated pull requests were found in your Azure DevOps project.
        </Typography>
        <Button
          variant="contained"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
        >
          Refresh
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Work Items with Pull Requests
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Filter by Work Item Type"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              SelectProps={{
                native: true,
              }}
            >
              <option value="all">All Types</option>
              <option value="User Story">User Story</option>
              <option value="Bug">Bug</option>
              <option value="Task">Task</option>
              <option value="Feature">Feature</option>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              select
              fullWidth
              label="Filter by PR Status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              SelectProps={{
                native: true,
              }}
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="abandoned">Abandoned</option>
            </TextField>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </Button>
              {loading && <CircularProgress size={20} />}
            </Box>
          </Grid>
        </Grid>
      </Box>

      {stats && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Work Items with Pull Requests Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {stats.totalWorkItemsWithPRs}
                  </Typography>
                  <Typography variant="body2">Work Items with PRs</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="info.main">
                    {stats.totalPRs}
                  </Typography>
                  <Typography variant="body2">Total PRs</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="warning.main">
                    {stats.activePRs}
                  </Typography>
                  <Typography variant="body2">Active PRs</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} md={3}>
                <Paper sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="h4" color="success.main">
                    {stats.completedPRs}
                  </Typography>
                  <Typography variant="body2">Completed PRs</Typography>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Paper sx={{ width: '100%' }}>
        <Tabs value={activeTab} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab 
            label={`Work Items (${getFilteredWorkItems().length})`} 
            icon={<AssignmentIcon />} 
            iconPosition="start" 
          />
          <Tab 
            label={`Pull Requests (${workItemsWithPRs.flatMap(item => item.pullRequests).length})`} 
            icon={<CodeIcon />} 
            iconPosition="start" 
          />
        </Tabs>

        <Box sx={{ p: 3 }}>
          {activeTab === 0 && (
            <Typography variant="body1">
              Work Items tab content - to be implemented with full table
            </Typography>
          )}
          {activeTab === 1 && (
            <Typography variant="body1">
              Pull Requests tab content - to be implemented with full table
            </Typography>
          )}
        </Box>
      </Paper>

      <Dialog 
        open={prDialogOpen} 
        onClose={() => setPrDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Pull Request #{selectedPR?.id} - {selectedPR?.title}
        </DialogTitle>
        <DialogContent>
          {selectedPR && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">
                PR details will be shown here
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            onClick={() => selectedPR && window.open(selectedPR.url, '_blank')}
            startIcon={<LinkIcon />}
          >
            Open in Azure DevOps
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default GitPRMonitoringPanel;
