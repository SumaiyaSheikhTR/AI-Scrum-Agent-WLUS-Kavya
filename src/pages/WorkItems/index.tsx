import React, { useState, useEffect, useCallback } from 'react';
import { 
  Paper, 
  Typography, 
  Box, 
  CircularProgress, 
  Alert, 
  Tabs, 
  Tab,
  Button,
  Menu,
  MenuItem
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import FilterListIcon from '@mui/icons-material/FilterList';
import adoService, { WorkItem } from '../../services/adoService';
import WorkItemsBoard from '../../components/dashboard/WorkItemsBoard';
import DuplicateWorkItemsPanel from '../../components/dashboard/DuplicateWorkItemsPanel';
import WorkItemSuggestions from '../../components/dashboard/WorkItemSuggestions';
import workItemSuggestionService, { WorkItemSuggestion } from '../../services/workItemSuggestionService';
import FilterComponent, { FilterState } from '../../components/common/FilterComponent';

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
      id={`workitems-tabpanel-${index}`}
      aria-labelledby={`workitems-tab-${index}`}
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
    id: `workitems-tab-${index}`,
    'aria-controls': `workitems-tabpanel-${index}`,
  };
};

const WorkItemsPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [staleItems, setStaleItems] = useState<WorkItem[]>([]);
  const [suggestions, setSuggestions] = useState<WorkItemSuggestion[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState<null | HTMLElement>(null);
  const [filter, setFilter] = useState<string>('all');
  const [filters, setFilters] = useState<FilterState>({
    selectedSprints: [],
    selectedUsers: []
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (filters.selectedSprints.length > 0) {
      fetchWorkItemsData();
    }
  }, [filters]);

  const fetchWorkItemsData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      let items: WorkItem[] = [];
      
      if (filters.selectedSprints.length > 0) {
        // Fetch work items for selected sprints
        for (const sprintName of filters.selectedSprints) {
          try {
            const sprints = await adoService.getSprints();
            const sprint = sprints.find(s => s.name === sprintName);
            if (sprint) {
              const sprintItems = await adoService.getSprintWorkItems(sprint.id);
              items = [...items, ...sprintItems];
            }
          } catch (err) {
            console.warn(`Failed to fetch work items for sprint ${sprintName}:`, err);
          }
        }
      } else {
        // Fetch all work items if no sprint filter
        const sprints = await adoService.getSprints();
        if (sprints.length > 0) {
          const currentSprint = sprints.find(sprint => sprint.state === 'current') || sprints[0];
          items = await adoService.getSprintWorkItems(currentSprint.id);
        }
      }

      // Filter by user if selected
      if (filters.selectedUsers.length > 0) {
        items = items.filter(item => 
          item.assignedTo && filters.selectedUsers.includes(item.assignedTo)
        );
      }

      setWorkItems(items);

      // Fetch stale items
      const stale = await adoService.getStaleWorkItems(5); // Items not updated in 5 days
      setStaleItems(stale);
      
      // Generate work item suggestions
      const newSuggestions = workItemSuggestionService.generateSuggestions(items);
      setSuggestions(newSuggestions);
    } catch (err) {
      console.error('Error fetching work items data:', err);
      setError('Failed to load work items data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters.selectedSprints, filters.selectedUsers]);

  const fetchInitialData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await fetchWorkItemsData();
    } catch (err) {
      console.error('Error fetching initial data:', err);
      setError('Failed to load data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fetchWorkItemsData]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleFilterMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setFilterMenuAnchor(event.currentTarget);
  };

  const handleFilterMenuClose = () => {
    setFilterMenuAnchor(null);
  };

  const handleFilterSelect = (filterValue: string) => {
    setFilter(filterValue);
    handleFilterMenuClose();
  };

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
  };

  const handleRefresh = () => {
    fetchWorkItemsData();
  };

  // Filter work items based on selected filter
  const filteredWorkItems = React.useMemo(() => {
    if (filter === 'all') {
      return workItems;
    } else if (filter === 'active') {
      return workItems.filter(item => 
        item.state === 'Active' || 
        item.state === 'In Progress'
      );
    } else if (filter === 'blocked') {
      return workItems.filter(item => 
        item.state === 'Blocked' || 
        item.tags.some(tag => tag.toLowerCase() === 'blocked')
      );
    } else if (filter === 'completed') {
      return workItems.filter(item => 
        item.state === 'Completed' || 
        item.state === 'Closed' || 
        item.state === 'Done'
      );
    } else if (filter === 'unassigned') {
      return workItems.filter(item => !item.assignedTo);
    } else if (filter === 'stale') {
      return staleItems;
    }
    return workItems;
  }, [workItems, staleItems, filter]);

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
          Work Items
        </Typography>
        <Box>
          <Button 
            variant="outlined" 
            startIcon={<FilterListIcon />} 
            onClick={handleFilterMenuOpen}
            sx={{ mr: 1 }}
          >
            Filter: {filter.charAt(0).toUpperCase() + filter.slice(1)}
          </Button>
          <Menu
            anchorEl={filterMenuAnchor}
            open={Boolean(filterMenuAnchor)}
            onClose={handleFilterMenuClose}
          >
            <MenuItem onClick={() => handleFilterSelect('all')} selected={filter === 'all'}>
              All
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('active')} selected={filter === 'active'}>
              Active
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('blocked')} selected={filter === 'blocked'}>
              Blocked
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('completed')} selected={filter === 'completed'}>
              Completed
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('unassigned')} selected={filter === 'unassigned'}>
              Unassigned
            </MenuItem>
            <MenuItem onClick={() => handleFilterSelect('stale')} selected={filter === 'stale'}>
              Stale
            </MenuItem>
          </Menu>
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />} 
            onClick={handleRefresh}
          >
            Refresh
          </Button>
        </Box>
      </Box>
      
      {/* Global Filters */}
      <Box sx={{ mb: 3 }}>
        <FilterComponent
          onFilterChange={handleFilterChange}
          initialFilters={filters}
          showUserFilter={true}
          showSprintFilter={true}
        />
      </Box>
      
      {isLoading && (
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <CircularProgress size={20} sx={{ mr: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Loading work items...
          </Typography>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {/* Work Item Suggestions */}
      {suggestions.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <WorkItemSuggestions 
            suggestions={suggestions}
            onSuggestionApplied={() => {
              fetchWorkItemsData();
            }}
            onSuggestionDismissed={(suggestionId) => {
              setSuggestions(prev => prev.filter((_, index) => index !== suggestionId));
            }}
          />
        </Box>
      )}
      
      <Box sx={{ height: 'calc(100% - 100px)', border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="work items tabs">
            <Tab label="Board View" {...a11yProps(0)} />
            <Tab label="List View" {...a11yProps(1)} />
            <Tab label="Duplicate Items" {...a11yProps(2)} />
          </Tabs>
        </Box>
        
        <TabPanel value={tabValue} index={0}>
          <WorkItemsBoard workItems={filteredWorkItems} />
        </TabPanel>
        
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ height: '100%', overflow: 'auto' }}>
            {filteredWorkItems.length === 0 ? (
              <Typography variant="body1" color="text.secondary" sx={{ textAlign: 'center', mt: 10 }}>
                No work items found matching the current filter
              </Typography>
            ) : (
              filteredWorkItems.map((item) => (
                <Paper 
                  key={item.id} 
                  elevation={0} 
                  sx={{ 
                    p: 2, 
                    mb: 1, 
                    backgroundColor: '#f5f5f5', 
                    borderLeft: '4px solid',
                    borderLeftColor: 
                      item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done' 
                        ? '#4caf50' 
                        : item.state === 'Blocked' || item.tags.some(tag => tag.toLowerCase() === 'blocked')
                          ? '#f44336'
                          : item.state === 'Active' || item.state === 'In Progress'
                            ? '#2196f3'
                            : '#ff9800'
                  }}
                >
                  <Typography variant="subtitle1">
                    {item.id}: {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Type: {item.type} | State: {item.state} | Assigned to: {item.assignedTo || 'Unassigned'} | Effort: {item.effort || 'Not set'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last updated: {new Date(item.updatedDate).toLocaleDateString()}
                  </Typography>
                </Paper>
              ))
            )}
          </Box>
        </TabPanel>
        
        <TabPanel value={tabValue} index={2}>
          <DuplicateWorkItemsPanel />
        </TabPanel>
      </Box>
    </Box>
  );
};

export default WorkItemsPage;
