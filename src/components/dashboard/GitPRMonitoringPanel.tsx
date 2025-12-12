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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
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
  Divider,
  Alert,
  AlertTitle
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
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [prDialogOpen, setPrDialogOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const loadWorkItemsWithPRs = useCallback(async () => {
    setLoading(true);
    try {
      console.log('Loading work items with PRs...');
      const [workItems, statistics] = await Promise.all([
        gitPRMonitoringService.getWorkItemsWithPRs(),
        gitPRMonitoringService.getStatistics()
      ]);
      
      console.log('Loaded work items with PRs:', workItems);
      console.log('Statistics:', statistics);
      setWorkItemsWithPRs(workItems);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading work items with PRs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-loading of Git PR monitoring data DISABLED to prevent page refreshing
  console.log('Git PR monitoring auto-load DISABLED to prevent page refreshing');
  
  /* Original auto-load commented out:
  useEffect(() => {
    loadWorkItemsWithPRs();
  }, [loadWorkItemsWithPRs]);
  */

  const handleForceRefresh = async () => {
    console.log('Force refreshing - clearing cache...');
    gitPRMonitoringService.clearCache();
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

  const renderWorkItemsTab = () => {
    const filteredWorkItems = getFilteredWorkItems();

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Work Item ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>State</TableCell>
              <TableCell>Assigned To</TableCell>
              <TableCell>Pull Requests</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredWorkItems.map((workItemWithPR) => (
              <TableRow key={workItemWithPR.workItem.id}>
                <TableCell>
                  <Chip 
                    label={`#${workItemWithPR.workItem.id}`} 
                    size="small" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      maxWidth: 300, 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {workItemWithPR.workItem.title}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={workItemWithPR.workItem.type} 
                    color={getWorkItemTypeColor(workItemWithPR.workItem.type) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip 
                    label={workItemWithPR.workItem.state} 
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {workItemWithPR.workItem.assignedTo || 'Unassigned'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {workItemWithPR.pullRequests.slice(0, 3).map((pr) => (
                      <Chip 
                        key={pr.id} 
                        label={`PR #${pr.id}`} 
                        size="small" 
                        color={getStatusColor(pr.status) as any}
                        onClick={() => handlePRClick(pr)}
                        clickable
                      />
                    ))}
                    {workItemWithPR.pullRequests.length > 3 && (
                      <Typography variant="caption">
                        +{workItemWithPR.pullRequests.length - 3}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {formatDate(workItemWithPR.workItem.updatedDate)}
                  </Typography>
                </TableCell>
                <TableCell>
                  {/* Actions column - could add future actions here */}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredWorkItems.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No work items with pull requests found
            </Typography>
          </Box>
        )}
      </TableContainer>
    );
  };

  const renderPullRequestsTab = () => {
    const allPRs = workItemsWithPRs.flatMap(item => 
      item.pullRequests.map(pr => ({
        ...pr,
        workItemId: item.workItem.id,
        workItemTitle: item.workItem.title
      }))
    );

    const filteredPRs = filterStatus === 'all' 
      ? allPRs 
      : allPRs.filter(pr => pr.status === filterStatus);

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>PR ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Author</TableCell>
              <TableCell>Repository</TableCell>
              <TableCell>Work Item</TableCell>
              <TableCell>Reviewers</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPRs.map((pr) => (
              <TableRow key={pr.id}>
                <TableCell>
                  <Chip 
                    label={`#${pr.id}`} 
                    size="small" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Tooltip title={pr.description}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        maxWidth: 300, 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {pr.title}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={pr.status} 
                    color={getStatusColor(pr.status) as any}
                    size="small"
                  />
                </TableCell>
                <TableCell>{pr.author}</TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {pr.repositoryName}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={`#${(pr as any).workItemId}`} 
                    size="small" 
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {pr.reviewers.slice(0, 3).map((reviewer, index) => (
                      <Tooltip key={index} title={`${reviewer.displayName} - Vote: ${reviewer.vote}`}>
                        <Box sx={{ position: 'relative' }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: 12 }}>
                            {reviewer.displayName.charAt(0)}
                          </Avatar>
                          <Box sx={{ position: 'absolute', bottom: -2, right: -2 }}>
                            {getVoteIcon(reviewer.vote)}
                          </Box>
                        </Box>
                      </Tooltip>
                    ))}
                    {pr.reviewers.length > 3 && (
                      <Typography variant="caption">
                        +{pr.reviewers.length - 3}
                      </Typography>
                    )}
                  </Box>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {formatDate(pr.updatedDate)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <IconButton 
                      size="small" 
                      onClick={() => handlePRClick(pr)}
                      title="View Details"
                    >
                      <VisibilityIcon />
                    </IconButton>
                    <IconButton 
                      size="small" 
                      onClick={() => window.open(pr.url, '_blank')}
                      title="Open in Azure DevOps"
                    >
                      <LinkIcon />
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {filteredPRs.length === 0 && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography color="text.secondary">
              No pull requests found
            </Typography>
          </Box>
        )}
      </TableContainer>
    );
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
          onClick={handleForceRefresh}
        >
          Force Refresh
        </Button>
      </Paper>
    );
  }

  return (
    <Box>
      <Typography variant="h5" gutterBottom>
        Work Items with Pull Requests
      </Typography>

      {/* Information Alert */}
      <Alert severity="info" sx={{ mb: 2 }}>
        <AlertTitle>CORS Solution Implemented</AlertTitle>
        This application now uses a backend proxy to communicate with Azure DevOps APIs, 
        which resolves CORS limitations. Make sure the backend server is running on the correct port.
      </Alert>

      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="filter-type-label">Filter by Work Item Type</InputLabel>
              <Select
                labelId="filter-type-label"
                value={filterType}
                label="Filter by Work Item Type"
                onChange={(e) => setFilterType(e.target.value as string)}
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="User Story">User Story</MenuItem>
                <MenuItem value="Bug">Bug</MenuItem>
                <MenuItem value="Task">Task</MenuItem>
                <MenuItem value="Feature">Feature</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
              <InputLabel id="filter-status-label">Filter by PR Status</InputLabel>
              <Select
                labelId="filter-status-label"
                value={filterStatus}
                label="Filter by PR Status"
                onChange={(e) => setFilterStatus(e.target.value as string)}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="abandoned">Abandoned</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleForceRefresh}
                disabled={loading}
              >
                Force Refresh
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

        <Box sx={{ p: 0 }}>
          {activeTab === 0 && renderWorkItemsTab()}
          {activeTab === 1 && renderPullRequestsTab()}
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
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Details</Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Status:</strong> <Chip label={selectedPR.status} color={getStatusColor(selectedPR.status) as any} size="small" />
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Author:</strong> {selectedPR.author}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Source:</strong> {selectedPR.sourceRefName}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Target:</strong> {selectedPR.targetRefName}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Created:</strong> {formatDate(selectedPR.createdDate)}
                  </Typography>
                  <Typography variant="body2" paragraph>
                    <strong>Updated:</strong> {formatDate(selectedPR.updatedDate)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Reviewers</Typography>
                  <List dense>
                    {selectedPR.reviewers.map((reviewer, index) => (
                      <ListItem key={index}>
                        <Avatar sx={{ width: 32, height: 32, mr: 2 }}>
                          {reviewer.displayName.charAt(0)}
                        </Avatar>
                        <ListItemText
                          primary={reviewer.displayName}
                          secondary={`Vote: ${reviewer.vote} ${reviewer.isRequired ? '(Required)' : ''}`}
                        />
                        <ListItemSecondaryAction>
                          {getVoteIcon(reviewer.vote)}
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                </Grid>
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Description</Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedPR.description || 'No description provided'}
                  </Typography>
                </Grid>
              </Grid>
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