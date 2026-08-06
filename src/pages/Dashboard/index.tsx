import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Button,
  IconButton,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Fab,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab
} from '@mui/material';
import { WorkItemCategory, WorkItemCategoriesConfig } from '../../components/config/WorkItemCategoriesConfigForm';
import { 
  Menu as MenuIcon,
  ChevronLeft as ChevronLeftIcon,
  Dashboard as DashboardIcon,
  FilterList as FilterListIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Group as TeamIcon,
  Assignment as WorkItemsIcon,
  SmartToy as AiAssistantIcon,
  Close as CloseIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import adoService, { Sprint, WorkItem } from '../../services/adoService';
import ExecutiveSummaryWithActivityMonitoring from '../../components/dashboard/ExecutiveSummaryWithActivityMonitoring';
import CapacityUtilization from '../../components/dashboard/CapacityUtilization';
// Hidden components - uncomment if needed
// import AiScrumAssistant from '../../components/dashboard/AiScrumAssistant';
// import DeveloperEngagementPanel from '../../components/dashboard/DeveloperEngagementPanel';
// import GitPRMonitoringPanel from '../../components/dashboard/GitPRMonitoringPanel';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.mode === 'dark' ? '#1A2027' : '#ffffff',
  ...theme.typography.body2,
  padding: theme.spacing(2),
  color: theme.palette.text.secondary,
  borderRadius: 8,
  border: '1px solid #dee2e6',
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
}));

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
      id={`dashboard-tabpanel-${index}`}
      aria-labelledby={`dashboard-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ pt: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `dashboard-tab-${index}`,
    'aria-controls': `dashboard-tabpanel-${index}`,
  };
};

const Dashboard: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false); // Changed from true to false to prevent loading spinner
  const [error, setError] = useState<string | null>(null);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [availableSprints, setAvailableSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [metricsFilter, setMetricsFilter] = useState<string>('all');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [categoryConfig, setCategoryConfig] = useState<WorkItemCategoriesConfig | null>(null);
  const [tabValue, setTabValue] = useState(0);
  
  // Dialog states for showing work item details
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupDialogTitle, setGroupDialogTitle] = useState('');
  const [groupDialogItems, setGroupDialogItems] = useState<WorkItem[]>([]);
  
  // Use ref for cache to avoid dependency issues
  const dataCacheRef = useRef<{
    timestamp: number;
    sprintId: string | null;
    currentSprint: Sprint | null;
    availableSprints: Sprint[];
    workItems: WorkItem[];
  } | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cache duration: 10 minutes (increased from 5 to reduce flickering)
  const CACHE_DURATION = 10 * 60 * 1000;

  // Helper function to get selected sprint
  const getSelectedSprint = () => {
    if (!selectedSprintId) return currentSprint;
    return availableSprints.find(sprint => sprint.id.toString() === selectedSprintId) || currentSprint;
  };

  // Function to fetch dashboard data with caching
  const fetchDashboardData = useCallback(async (forceRefresh = false, targetSprintId?: string) => {
    try {
      // Determine which sprint ID to use - either passed parameter, selected sprint, or current sprint
      const sprintIdToFetch = targetSprintId || selectedSprintId;
      
      console.log('🔄 ==================== SPRINT DATA FETCH ====================');
      console.log(`🔄 SPRINT_FETCH: Starting fetch - targetSprintId: ${targetSprintId}, selectedSprintId: ${selectedSprintId}, final: ${sprintIdToFetch}`);
      
      // Check if we have valid cached data and not forcing refresh
      // Cache should also match the target sprint
      const currentCache = dataCacheRef.current;
      const cacheValid = !forceRefresh && 
        currentCache && 
        Date.now() - currentCache.timestamp < CACHE_DURATION &&
        currentCache.sprintId === sprintIdToFetch;
        
      if (cacheValid) {
        console.log(`🔄 SPRINT_FETCH: Using cached data for sprint ${sprintIdToFetch} (${currentCache.workItems.length} items)`);
        setCurrentSprint(currentCache.currentSprint);
        setAvailableSprints(currentCache.availableSprints);
        setWorkItems(currentCache.workItems);
        setIsLoading(false);
        console.log('🔄 ========================================================');
        return;
      }

      console.log(`🔄 SPRINT_FETCH: Cache invalid or force refresh - fetching fresh data for sprint ${sprintIdToFetch}`);
      setIsLoading(true);
      setError(null);

      // Get current sprint and available sprints (these don't change based on selection)
      const sprint = await adoService.getCurrentSprint();
      setCurrentSprint(sprint);
      console.log(`🔄 SPRINT_FETCH: Current sprint from API: ${sprint?.name} (ID: ${sprint?.id})`);

      const sprints = await adoService.getSprints();
      setAvailableSprints(sprints);
      console.log(`🔄 SPRINT_FETCH: Available sprints: ${sprints.length} sprints loaded`);

      // Determine which sprint to use for work items
      let sprintToUse = sprintIdToFetch;
      
      // If no sprint is selected, use current sprint but don't set selectedSprintId
      // This way, selectedSprintId remains null to indicate we're viewing the default (current) sprint
      if (!sprintToUse && sprint) {
        sprintToUse = sprint.id.toString();
        console.log(`🔄 SPRINT_FETCH: No sprint selected, using current sprint ${sprintToUse} (keeping selectedSprintId as null)`);
      }

      // Fetch work items for the determined sprint
      if (sprintToUse) {
        console.log(`🔄 SPRINT_FETCH: Fetching work items for sprint ID: ${sprintToUse}`);
        const items = await adoService.getSprintWorkItems(sprintToUse);
        setWorkItems(items);
        console.log(`🔄 SPRINT_FETCH: ✅ Successfully loaded ${items.length} work items for sprint ${sprintToUse}`);

        // Cache the data (cache is now sprint-specific)
        dataCacheRef.current = {
          timestamp: Date.now(),
          sprintId: sprintToUse,
          currentSprint: sprint,
          availableSprints: sprints,
          workItems: items
        };
        
        console.log(`🔄 SPRINT_FETCH: Data cached for sprint ${sprintToUse} at ${new Date().toLocaleTimeString()}`);
      }
      console.log('🔄 ========================================================');
    } catch (err) {
      console.error('🔄 SPRINT_FETCH: ❌ Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedSprintId, CACHE_DURATION]);

  // Handle sprint selection change
  const handleSprintChange = async (event: SelectChangeEvent<string>) => {
    const sprintId = event.target.value; // Keep as string, don't use parseInt
    
    console.log('📅 ==================== SPRINT CHANGE ====================');
    console.log(`📅 SPRINT_CHANGE: User selected sprint ID: ${sprintId}`);
    console.log(`📅 SPRINT_CHANGE: Previous selectedSprintId: ${selectedSprintId}`);
    
    setSelectedSprintId(sprintId);
    
    // Check if we already have cached data for this sprint
    const currentCache = dataCacheRef.current;
    const hasValidCache = currentCache && 
      currentCache.sprintId === sprintId && 
      Date.now() - currentCache.timestamp < CACHE_DURATION;
    
    if (hasValidCache) {
      console.log(`📅 SPRINT_CHANGE: ✅ Using cached data for sprint ${sprintId} (${currentCache.workItems.length} items)`);
      // Use cached data
      setWorkItems(currentCache.workItems);
      console.log('📅 ======================================================');
      return;
    }
    
    try {
      console.log(`📅 SPRINT_CHANGE: No valid cache found, fetching fresh data for sprint ${sprintId}`);
      setSprintLoading(true);
      setError(null);
      
      // Fetch work items for the selected sprint
      const items = await adoService.getSprintWorkItems(sprintId);
      setWorkItems(items);
      console.log(`📅 SPRINT_CHANGE: ✅ Successfully fetched ${items.length} work items for sprint ${sprintId}`);
      
      // Update cache with new sprint data
      dataCacheRef.current = {
        timestamp: Date.now(),
        sprintId: sprintId,
        currentSprint: currentSprint,
        availableSprints: availableSprints,
        workItems: items
      };
      
      console.log(`📅 SPRINT_CHANGE: Cache updated for sprint ${sprintId} at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      console.error('📅 SPRINT_CHANGE: ❌ Error fetching sprint work items:', err);
      setError('Failed to load sprint work items.');
    } finally {
      setSprintLoading(false);
      console.log('📅 ======================================================');
    }
  };

  // Handle opening work item details dialog
  // Hidden function - was used in User Stories Summary (now commented out)
  /*
  const handleWorkItemClick = (workItem: WorkItem) => {
    setSelectedWorkItem(workItem);
    setIsDialogOpen(true);
  };
  */

  const handleGroupClick = (title: string, items: WorkItem[]) => {
    setGroupDialogTitle(title);
    setGroupDialogItems(items);
    setIsGroupDialogOpen(true);
  };
  
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Helper function to generate a color gradient based on tag name
  // Load category configuration
  useEffect(() => {
    try {
      // Try to load from localStorage
      const savedConfig = localStorage.getItem('workItemCategoriesConfig');
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setCategoryConfig(config);
        console.log('🔍 Loaded work item categories config:', config);
      } else {
        console.log('⚠️ No saved work item categories config found in localStorage');
      }
    } catch (error) {
      console.error('❌ Error loading work item categories config:', error);
    }
  }, []);

  const getTagBackgroundGradient = (tag: string): string => {
    // Check if we have a matching category in the config
    if (categoryConfig && categoryConfig.categories) {
      // First try exact match
      const exactMatch = categoryConfig.categories.find(
        cat => cat.name.toLowerCase() === tag.toLowerCase()
      );
      
      if (exactMatch && exactMatch.color) {
        // Use the configured color as the base for the gradient
        const color = exactMatch.color;
        // Generate a slightly different shade for the gradient
        return `linear-gradient(135deg, ${color} 0%, ${adjustColorBrightness(color, 15)} 100%)`;
      }
      
      // Try to match by keywords or tags
      const matchingCategory = categoryConfig.categories.find(cat => 
        cat.enabled && (
          // Check if any keyword matches the tag
          cat.keywords.some(keyword => 
            tag.toLowerCase().includes(keyword.toLowerCase())
          ) ||
          // Check if any category tag matches the work item tag
          cat.tags.some(catTag => 
            catTag.toLowerCase() === tag.toLowerCase()
          )
        )
      );
      
      if (matchingCategory && matchingCategory.color) {
        // Use the configured color
        return `linear-gradient(135deg, ${matchingCategory.color} 0%, ${adjustColorBrightness(matchingCategory.color, 15)} 100%)`;
      }
    }
    
    // Fallback to the original algorithm if no match found
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate colors for the gradient
    const hue1 = Math.abs(hash % 360);
    const hue2 = (hue1 + 20) % 360;
    
    // Generate a gradient with medium saturation and light/brightness
    return `linear-gradient(135deg, hsl(${hue1}, 65%, 45%) 0%, hsl(${hue2}, 70%, 50%) 100%)`;
  };
  
  // Helper function to adjust color brightness
  const adjustColorBrightness = (color: string, amount: number): string => {
    // Handle hex colors
    if (color.startsWith('#')) {
      let hex = color.substring(1);
      
      // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
      if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
      }
      
      let r = parseInt(hex.substring(0, 2), 16);
      let g = parseInt(hex.substring(2, 4), 16);
      let b = parseInt(hex.substring(4, 6), 16);
      
      // Adjust brightness
      r = Math.min(255, Math.max(0, r + amount));
      g = Math.min(255, Math.max(0, g + amount));
      b = Math.min(255, Math.max(0, b + amount));
      
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    
    // Return the original color if not in hex format
    return color;
  };

  // Generate ADO work item URL
  // Hidden function - was used in User Stories Summary (now commented out)
  /*
  const getPriorityColor = (priority: number | null | undefined): string => {
    switch (priority) {
      case 1: return '#dc3545'; // Critical - Red
      case 2: return '#ffc107'; // High - Amber  
      case 3: return '#28a745'; // Medium - Green
      default: return '#6c757d'; // Low/None - Gray
    }
  };
  */

  const getAdoWorkItemUrl = (workItem: WorkItem) => {
    // If the work item already has a URL, use it
    if (workItem.url) {
      return workItem.url;
    }
    
    // First try to get configuration from localStorage (Settings page)
    let organization: string | undefined;
    let project: string | undefined;
    
    try {
      const adoConfigStr = localStorage.getItem('adoConfig');
      if (adoConfigStr) {
        const adoConfig = JSON.parse(adoConfigStr);
        organization = adoConfig.organization;
        project = adoConfig.project;
        console.log('Using ADO config from localStorage:', { organization, project });
      }
    } catch (error) {
      console.warn('Failed to parse ADO config from localStorage:', error);
    }
    
    // Fallback to environment variables if not found in localStorage
    if (!organization || !project) {
      organization = process.env.REACT_APP_ADO_ORG;
      project = process.env.REACT_APP_ADO_PROJECT;
      console.log('Using ADO config from environment variables:', { organization, project });
    }
    
    const adoBaseUrl = process.env.REACT_APP_ADO_API_URL || 'https://dev.azure.com';
    
    // Final fallback values
    if (!organization || organization === 'your-organization') {
      organization = 'TR-Legal-Cobalt';
    }
    if (!project || project === 'your-project') {
      project = 'Legal Cobalt Backlog';
    }
    
    // Clean up organization and project names (remove extra spaces)
    organization = organization?.trim();
    project = project?.trim();
    
    // Construct the proper ADO work item URL
    // URL encode the organization and project to handle spaces and special characters
    const encodedOrganization = encodeURIComponent(organization);
    const encodedProject = encodeURIComponent(project);
    const finalUrl = `${adoBaseUrl}/${encodedOrganization}/${encodedProject}/_workitems/edit/${workItem.id}`;
    console.log('Generated ADO URL:', finalUrl);
    return finalUrl;
  };

  // Function to clean and format HTML description (currently unused but may be needed for dialogs)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatDescription = (htmlString: string | null | undefined): string => {
    if (!htmlString) return 'No description available for this work item.';
    
    // Remove HTML tags and decode HTML entities
    const cleaned = htmlString
      .replace(/<br\s*\/?>/gi, '\n')          // Replace <br> with newlines
      .replace(/<\/div>/gi, '\n')              // Replace </div> with newlines
      .replace(/<div[^>]*>/gi, '')             // Remove <div> tags
      .replace(/<span[^>]*>/gi, '')            // Remove <span> tags
      .replace(/<\/span>/gi, '')               // Remove </span> tags
      .replace(/<p[^>]*>/gi, '\n')             // Replace <p> with newlines
      .replace(/<\/p>/gi, '\n')                // Replace </p> with newlines
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/gi, '$2 ($1)') // Convert links to text with URL
      .replace(/&nbsp;/gi, ' ')                // Replace &nbsp; with spaces
      .replace(/&amp;/gi, '&')                 // Replace &amp; with &
      .replace(/&lt;/gi, '<')                  // Replace &lt; with <
      .replace(/&gt;/gi, '>')                  // Replace &gt; with >
      .replace(/&quot;/gi, '"')                // Replace &quot; with "
      .replace(/<[^>]*>/g, '')                 // Remove any remaining HTML tags
      .replace(/\n\s*\n/g, '\n\n')             // Clean up multiple newlines
      .trim();                                 // Remove leading/trailing whitespace
    
    return cleaned || 'No description available for this work item.';
  };

  // Function to get PR links from work item data
  const getPRLinks = (workItem: WorkItem): string[] => {
    // Debug logging
    console.log(`Getting PR links for ${workItem.type} ${workItem.id}:`, {
      pullRequests: workItem.pullRequests,
      gitCommits: workItem.gitCommits,
      description: workItem.description?.substring(0, 200) + '...'
    });
    
    // First check if work item has pullRequests array from ADO relations
    if (workItem.pullRequests && workItem.pullRequests.length > 0) {
      console.log(`Found ${workItem.pullRequests.length} PR links in pullRequests array`);
      return workItem.pullRequests;
    }
    
    // Fallback: check Git commits if available and try to find related PRs
    if (workItem.gitCommits && workItem.gitCommits.length > 0) {
      // For ADO commits, we can't easily convert to PR URLs without additional API calls
      // So we'll return empty for now, but log that commits exist
      console.log(`Work item ${workItem.id} has ${workItem.gitCommits.length} git commits but no PR links`);
    }
    
    // Check for GitHub links in description
    const description = workItem.description || '';
    const githubPRMatches = description.match(/https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+/g);
    if (githubPRMatches) {
      console.log(`Found ${githubPRMatches.length} GitHub PR links in description`);
      return githubPRMatches;
    }
    
    // Check for ADO PR links in description
    const adoPRMatches = description.match(/https:\/\/dev\.azure\.com\/[^/]+\/[^/]+\/_git\/[^/]+\/pullrequest\/\d+/g);
    if (adoPRMatches) {
      console.log(`Found ${adoPRMatches.length} ADO PR links in description`);
      return adoPRMatches;
    }
    
    console.log(`No PR links found for work item ${workItem.id}`);
    return [];
  };

  // Function to check if a work item is blocked based on tags
  const isWorkItemBlocked = (workItem: WorkItem): boolean => {
    if (!workItem.tags || workItem.tags.length === 0) {
      return false;
    }
    
    // Check if any tag contains "blocked" (case-insensitive)
    return workItem.tags.some(tag => 
      tag.toLowerCase().includes('blocked')
    );
  };
  useEffect(() => {
    const handleDataRefresh = () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        console.log('🔄 Auto-refresh triggered by ADO service');
        fetchDashboardData(true, selectedSprintId || undefined);
      }, 1000);
    };

    window.addEventListener('ado-data-refresh', handleDataRefresh);

    return () => {
      window.removeEventListener('ado-data-refresh', handleDataRefresh);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [fetchDashboardData, selectedSprintId]);

  // Separate useEffect for initial load and sprint changes - RE-ENABLED
  useEffect(() => {
    console.log('⚡ ==================== USE EFFECT ====================');
    console.log(`⚡ USE_EFFECT: Triggered with selectedSprintId: ${selectedSprintId}`);
    
    if (!selectedSprintId) {
      // Initial load - get current sprint
      console.log('⚡ USE_EFFECT: Initial load detected - fetching current sprint data');
      fetchDashboardData();
    } else {
      // Sprint selection changed - fetch data for selected sprint
      console.log(`⚡ USE_EFFECT: Sprint selection detected - fetching data for sprint ${selectedSprintId}`);
      fetchDashboardData(false, selectedSprintId);
    }
    console.log('⚡ ====================================================');
  }, [selectedSprintId, fetchDashboardData]);

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
        <Button variant="contained" onClick={() => fetchDashboardData(true)}>
          Retry
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', position: 'relative' }}>
      {/* Left Sidebar */}
      <Drawer
        anchor="left"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        variant="temporary"
        sx={{
          '& .MuiDrawer-paper': {
            width: 320,
            backgroundColor: '#f8f9fa',
            borderRight: '1px solid #dee2e6',
            boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
          },
        }}
      >
        {/* Sidebar Header */}
        <Box sx={{ 
          p: 3, 
          background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            � AI Scrum Agent
          </Typography>
          <IconButton 
            onClick={() => setSidebarOpen(false)}
            sx={{ color: 'white' }}
          >
            <ChevronLeftIcon />
          </IconButton>
        </Box>
        
        <Divider />
        
        {/* Navigation Menu */}
        <List sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ 
            px: 2, 
            py: 1, 
            fontWeight: 600, 
            color: '#495057',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.5px'
          }}>
            Navigation
          </Typography>
          
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                backgroundColor: '#e3f2fd',
                '&:hover': { backgroundColor: '#bbdefb' }
              }}
              onClick={() => {
                // Current dashboard - just close sidebar
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <DashboardIcon sx={{ color: '#1976d2' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Dashboard" 
                secondary="Current view"
                primaryTypographyProps={{ fontWeight: 600, color: '#1976d2' }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                '&:hover': { backgroundColor: '#e9ecef' }
              }}
              onClick={() => {
                // Navigate to Analytics
                window.location.href = '/analytics';
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <AnalyticsIcon sx={{ color: '#495057' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Analytics" 
                secondary="Data insights"
                primaryTypographyProps={{ fontWeight: 500 }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                '&:hover': { backgroundColor: '#e9ecef' }
              }}
              onClick={() => {
                // Navigate to Work Items
                window.location.href = '/work-items';
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <WorkItemsIcon sx={{ color: '#495057' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Work Items" 
                secondary="Manage tasks"
                primaryTypographyProps={{ fontWeight: 500 }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                '&:hover': { backgroundColor: '#e9ecef' }
              }}
              onClick={() => {
                // Navigate to AI Assistant
                window.location.href = '/ai-assistant';
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <AiAssistantIcon sx={{ color: '#495057' }} />
              </ListItemIcon>
              <ListItemText 
                primary="AI Assistant" 
                secondary="Smart help"
                primaryTypographyProps={{ fontWeight: 500 }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                '&:hover': { backgroundColor: '#e9ecef' }
              }}
              onClick={() => {
                // Navigate to Team
                window.location.href = '/team';
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <TeamIcon sx={{ color: '#495057' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Team" 
                secondary="Team management"
                primaryTypographyProps={{ fontWeight: 500 }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>

          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                '&:hover': { backgroundColor: '#e9ecef' }
              }}
              onClick={() => {
                // Navigate to Settings
                window.location.href = '/settings';
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <SettingsIcon sx={{ color: '#495057' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Settings" 
                secondary="Configuration"
                primaryTypographyProps={{ fontWeight: 500 }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>
        </List>
        
        <Divider />
        
        {/* Quick Actions */}
        <List sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ 
            px: 2, 
            py: 1, 
            fontWeight: 600, 
            color: '#495057',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.5px'
          }}>
            Quick Actions
          </Typography>
          
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                '&:hover': { backgroundColor: '#e9ecef' }
              }}
              onClick={() => {
                // Refresh data with force refresh
                fetchDashboardData(true);
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <DashboardIcon sx={{ color: '#495057' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Refresh Dashboard" 
                secondary="Reload all data"
                primaryTypographyProps={{ fontWeight: 500 }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>
          
          <ListItem disablePadding sx={{ mb: 1 }}>
            <ListItemButton 
              sx={{ 
                borderRadius: 2,
                mx: 1,
                '&:hover': { backgroundColor: '#e9ecef' }
              }}
              onClick={() => {
                setMetricsFilter('all');
                setSidebarOpen(false);
              }}
            >
              <ListItemIcon>
                <FilterListIcon sx={{ color: '#495057' }} />
              </ListItemIcon>
              <ListItemText 
                primary="Reset Filters" 
                secondary="Show all work items"
                primaryTypographyProps={{ fontWeight: 500 }}
                secondaryTypographyProps={{ fontSize: '0.8rem' }}
              />
            </ListItemButton>
          </ListItem>
        </List>
        
        <Divider />
        
        {/* Filter Controls */}
        <Box sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ 
            px: 2, 
            py: 1, 
            fontWeight: 600, 
            color: '#495057',
            textTransform: 'uppercase',
            fontSize: '0.75rem',
            letterSpacing: '0.5px'
          }}>
            Filter Options
          </Typography>
          
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
              Work Item Types:
            </Typography>
            <ToggleButtonGroup
              value={metricsFilter}
              exclusive
              onChange={(event, newFilter) => {
                if (newFilter !== null) {
                  setMetricsFilter(newFilter);
                }
              }}
              orientation="vertical"
              size="small"
              sx={{
                width: '100%',
                '& .MuiToggleButton-root': {
                  width: '100%',
                  justifyContent: 'flex-start',
                  mb: 0.5,
                  border: '1px solid #dee2e6',
                  '&.Mui-selected': {
                    backgroundColor: '#2c3e50',
                    color: 'white',
                  }
                }
              }}
            >
              <ToggleButton value="all">All Items</ToggleButton>
              <ToggleButton value="user-story">User Stories</ToggleButton>
              <ToggleButton value="bug">Bugs</ToggleButton>
              <ToggleButton value="task">Tasks</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
        
        <Divider />
        
        {/* Sprint Info */}
        {(currentSprint || selectedSprintId) && (
          <Box sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ 
              px: 2, 
              py: 1, 
              fontWeight: 600, 
              color: '#495057',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              letterSpacing: '0.5px'
            }}>
              {selectedSprintId && currentSprint && selectedSprintId !== currentSprint.id.toString() ? 'Selected Sprint' : 'Current Sprint'}
            </Typography>
            
            <Paper elevation={1} sx={{ p: 2, m: 2, backgroundColor: '#ffffff' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                {(() => {
                  const selectedSprint = getSelectedSprint();
                  return selectedSprint ? selectedSprint.name : 'Unknown Sprint';
                })()}
              </Typography>
              <Typography variant="caption" sx={{ color: '#6c757d', mb: 1, display: 'block' }}>
                {(() => {
                  const selectedSprint = getSelectedSprint();
                  return selectedSprint 
                    ? `${new Date(selectedSprint.startDate).toLocaleDateString()} - ${new Date(selectedSprint.endDate).toLocaleDateString()}`
                    : 'Date range unknown';
                })()}
              </Typography>
              {dataCacheRef.current && (
                <Chip 
                  label={`Cached ${Math.round((Date.now() - dataCacheRef.current.timestamp) / 60000)}m ago`}
                  size="small"
                  sx={{ 
                    fontSize: '0.7rem',
                    backgroundColor: '#e8f5e8',
                    color: '#2e7d32',
                    mb: 1,
                    mr: 1
                  }}
                />
              )}
              {selectedSprintId && currentSprint && selectedSprintId !== currentSprint.id.toString() && (
                <Chip 
                  label="Historical Data"
                  size="small"
                  sx={{ 
                    fontSize: '0.7rem',
                    backgroundColor: '#fff3cd',
                    color: '#856404'
                  }}
                />
              )}
            </Paper>
          </Box>
        )}
      </Drawer>

      {/* Main Content */}
      <Box sx={{ 
        flexGrow: 1, 
        backgroundColor: '#f5f6fa', 
        minHeight: '100vh', 
        p: 3,
        transition: 'margin-left 0.3s ease-in-out'
      }}>
        {/* Floating Action Button for Sidebar Toggle */}
        <Fab
          size="medium"
          sx={{
            position: 'fixed',
            top: 100,
            left: 16,
            zIndex: 1000,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            '&:hover': {
              background: 'linear-gradient(135deg, #764ba2 0%, #667eea 100%)',
              transform: 'scale(1.1)',
            },
            transition: 'all 0.3s ease-in-out',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.4)',
          }}
          onClick={() => setSidebarOpen(true)}
        >
          <MenuIcon />
        </Fab>
      {/* Sprint Filter Section */}
      <Paper elevation={3} sx={{ 
        p: 4, 
        mb: 4, 
        borderRadius: 3,
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        border: '1px solid #34495e'
      }}>
        
        <Grid container spacing={3} alignItems="center" justifyContent="center">
          <Grid item xs={12} md={6}>
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ mr: 2, fontWeight: 500, color: '#ecf0f1' }}>
                Active Sprint:
              </Typography>
              <Typography variant="h6" sx={{ 
                background: 'rgba(255,255,255,0.15)',
                px: 3,
                py: 1.5,
                borderRadius: 2,
                fontWeight: 600,
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)'
              }}>
                {currentSprint 
                  ? `${currentSprint.name}` 
                  : 'No active sprint found'}
              </Typography>
              {selectedSprintId && currentSprint && selectedSprintId !== currentSprint.id.toString() && (
                <Chip 
                  label="Viewing different sprint"
                  size="small"
                  sx={{ 
                    ml: 2,
                    backgroundColor: 'rgba(255, 193, 7, 0.9)',
                    color: '#000',
                    fontWeight: 600
                  }}
                />
              )}
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl 
              size="small" 
              disabled={sprintLoading}
              sx={{ 
                minWidth: 300,
                '& .MuiInputLabel-root': { color: '#ecf0f1' },
                '& .MuiOutlinedInput-root': {
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#ffffff' }
                },
                '& .MuiSelect-icon': { color: '#ecf0f1' }
              }}
            >
              <InputLabel>Select Sprint</InputLabel>
              <Select
                value={selectedSprintId || ''}
                label="Select Sprint"
                onChange={handleSprintChange}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#2c3e50',
                      '& .MuiMenuItem-root': {
                        color: '#ecf0f1',
                        '&:hover': { backgroundColor: '#34495e' },
                        '&.Mui-selected': { 
                          backgroundColor: '#3498db',
                          '&:hover': { backgroundColor: '#2980b9' }
                        }
                      }
                    }
                  }
                }}
              >
                {availableSprints.map((sprint) => (
                  <MenuItem key={sprint.id} value={sprint.id.toString()}>
                    {sprint.name} ({new Date(sprint.startDate).toLocaleDateString()} - {new Date(sprint.endDate).toLocaleDateString()})
                  </MenuItem>
                ))}
              </Select>
              {sprintLoading && (
                <Box sx={{ 
                  position: 'absolute', 
                  right: 40, 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <CircularProgress size={20} sx={{ color: '#ecf0f1' }} />
                </Box>
              )}
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
      
      <Grid container spacing={3}>
        {/* Sprint Task Summary */}
        <Grid item xs={12}>
          <Item>
            {/* Header Section */}
            <Box sx={{ 
              background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)',
              borderRadius: 2,
              p: 3,
              mb: 3,
              boxShadow: '0 4px 12px rgba(52, 152, 219, 0.2)'
            }}>
              <Typography variant="h4" component="h2" sx={{ 
                color: '#ffffff', 
                fontWeight: 600,
                textAlign: 'center',
                mb: 1,
                letterSpacing: '0.5px'
              }}>
                📊 Sprint Task Summary
              </Typography>
              <Typography variant="body1" sx={{ 
                color: 'rgba(255,255,255,0.9)', 
                textAlign: 'center',
                fontSize: '1.1rem'
              }}>
                Real-time overview of current sprint progress and work item distribution
              </Typography>
            </Box>
            
            {/* Metrics Filter */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" sx={{ mb: 2, fontWeight: 600, color: '#495057' }}>Filter by Work Item Type:</Typography>
              <ToggleButtonGroup
                value={metricsFilter}
                exclusive
                onChange={(event, newFilter) => {
                  if (newFilter !== null) {
                    setMetricsFilter(newFilter);
                  }
                }}
                aria-label="metrics filter"
                size="medium"
                sx={{
                  '& .MuiToggleButton-root': {
                    borderRadius: 2,
                    mx: 0.5,
                    px: 3,
                    py: 1,
                    fontWeight: 600,
                    textTransform: 'none',
                    border: '2px solid #e0e0e0',
                    '&:hover': {
                      backgroundColor: '#f5f5f5',
                      transform: 'translateY(-1px)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    },
                    '&.Mui-selected': {
                      backgroundColor: '#2c3e50',
                      color: 'white',
                      border: '2px solid #2c3e50',
                      '&:hover': {
                        backgroundColor: '#1a252f',
                      }
                    },
                    transition: 'all 0.2s ease-in-out'
                  }
                }}
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
            
            {/* Filtered Metrics Display */}
            {(() => {
              const getFilteredItems = () => {
                // Get all Tasks that belong to User Stories and Bugs
                const tasksFromUserStoriesAndBugs = workItems.filter(item => {
                  if (item.type !== 'Task') return false;
                  
                  // Check if this task has a parent that is a User Story or Bug
                  const hasValidParent = workItems.some(parentItem => 
                    (parentItem.type === 'User Story' || parentItem.type === 'Bug') &&
                    item.parentId === parentItem.id
                  );
                  
                  return hasValidParent;
                });
                
                switch (metricsFilter) {
                  case 'user-story':
                    // Show tasks that belong to User Stories
                    return tasksFromUserStoriesAndBugs.filter(task => {
                      const parent = workItems.find(item => item.id === task.parentId);
                      return parent?.type === 'User Story';
                    });
                  case 'bug':
                    // Show tasks that belong to Bugs
                    return tasksFromUserStoriesAndBugs.filter(task => {
                      const parent = workItems.find(item => item.id === task.parentId);
                      return parent?.type === 'Bug';
                    });
                  case 'task':
                    // Show all tasks from User Stories and Bugs
                    return tasksFromUserStoriesAndBugs;
                  default:
                    // Show all tasks from User Stories and Bugs
                    return tasksFromUserStoriesAndBugs;
                }
              };
              
              const filteredItems = getFilteredItems();
              const completedFiltered = filteredItems.filter(item => item.state === 'Done' || item.state === 'Closed');
              const inProgressFiltered = filteredItems.filter(item => item.state === 'Active' || item.state === 'In Progress');
              
              // For blocked items in Sprint Task Summary, show User Stories and Bugs (not tasks)
              const blockedUserStoriesAndBugs = workItems.filter(item => 
                (item.type === 'User Story' || item.type === 'Bug') &&
                (item.state === 'Blocked' || isWorkItemBlocked(item))
              );
              
              // Use consistent filtering for both planned count and completed count
              const plannedCount = filteredItems.length;
              
              // Ensure percentage never exceeds 100%
              const progressPercentage = plannedCount > 0 ? Math.min(100, Math.round((completedFiltered.length / plannedCount) * 100)) : 0;
              
              return (
                <>
                  {/* Progress Overview */}
                  <Paper elevation={4} sx={{ 
                    p: 4, 
                    mb: 3, 
                    borderRadius: 3,
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                    border: '1px solid #e9ecef',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
                  }}>
                    <Box sx={{ position: 'relative', zIndex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#2c3e50' }}>
                          🚀 Sprint Progress Overview
                        </Typography>
                        <Chip 
                          label={`${progressPercentage}% Complete`}
                          sx={{ 
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            background: progressPercentage >= 75 
                              ? 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)'
                              : progressPercentage >= 50 
                              ? 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)'
                              : 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)',
                            color: 'white',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        />
                      </Box>
                      <Typography variant="body1" sx={{ 
                        mb: 3, 
                        color: '#5a6c7d',
                        fontWeight: 500,
                        fontSize: '1.1rem'
                      }}>
                        {metricsFilter === 'all' ? 'Tasks from User Stories & Bugs' : 
                         metricsFilter === 'user-story' ? 'Tasks from User Stories' :
                         metricsFilter === 'bug' ? 'Tasks from Bugs' :
                         'All Tasks from User Stories & Bugs'} • {plannedCount} total items
                      </Typography>
                      <LinearProgress 
                        variant="determinate" 
                        value={progressPercentage} 
                        sx={{ 
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: '#ecf0f1',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 6,
                            background: progressPercentage >= 75 
                              ? 'linear-gradient(90deg, #27ae60 0%, #2ecc71 100%)'
                              : progressPercentage >= 50 
                              ? 'linear-gradient(90deg, #f39c12 0%, #e67e22 100%)'
                              : 'linear-gradient(90deg, #e74c3c 0%, #c0392b 100%)',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }
                        }} 
                      />
                      <Typography variant="body2" sx={{ 
                        mt: 2, 
                        color: '#7f8c8d',
                        textAlign: 'center',
                        fontWeight: 500
                      }}>
                        {completedFiltered.length} completed • {inProgressFiltered.length} in progress • {blockedUserStoriesAndBugs.length} blocked (User Stories/Bugs)
                      </Typography>
                    </Box>
                  </Paper>
                  {/* Professional Metric Cards */}
                  <Grid container spacing={3} sx={{ mb: 4 }}>
                    {/* Planned Card */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={4} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          cursor: 'pointer',
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 8px 32px rgba(102, 126, 234, 0.25)',
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 12px 40px rgba(102, 126, 234, 0.35)'
                          },
                          '&::before': {
                            content: "''",
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '100px',
                            height: '100px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '50%',
                            transform: 'translate(30px, -30px)'
                          }
                        }}
                        onClick={() => {
                          if (filteredItems.length > 0) {
                            handleGroupClick('Sprint Task Summary - Planned', filteredItems);
                          }
                        }}
                      >
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                            {plannedCount}
                          </Typography>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 500, 
                            mb: 1,
                            opacity: 0.9,
                            fontSize: '1rem'
                          }}>
                            Planned Items
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            opacity: 0.8,
                            fontWeight: 400,
                            fontSize: '0.8rem'
                          }}>
                            Click to view details
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>

                    {/* Completed Card */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={4} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          cursor: 'pointer',
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #56ab2f 0%, #a8e6cf 100%)',
                          color: 'white',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 8px 32px rgba(86, 171, 47, 0.25)',
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 12px 40px rgba(86, 171, 47, 0.35)'
                          },
                        '&::before': {
                          content: "''",
                          position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '100px',
                            height: '100px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '50%',
                            transform: 'translate(30px, -30px)'
                          }
                        }}
                        onClick={() => {
                          if (completedFiltered.length > 0) {
                            handleGroupClick('Sprint Task Summary - Completed', completedFiltered);
                          }
                        }}
                      >
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                            {completedFiltered.length}
                          </Typography>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 500, 
                            mb: 1,
                            opacity: 0.9,
                            fontSize: '1rem'
                          }}>
                            Completed
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            opacity: 0.8,
                            fontWeight: 400,
                            fontSize: '0.8rem'
                          }}>
                            Click to view details
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>

                    {/* In Progress Card */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={4} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          cursor: 'pointer',
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #4b79a1 0%, #283e51 100%)',
                          color: 'white',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 8px 32px rgba(75, 121, 161, 0.25)',
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 12px 40px rgba(75, 121, 161, 0.35)'
                          },
                          '&::before': {
                            content: "''",
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '100px',
                            height: '100px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '50%',
                            transform: 'translate(30px, -30px)'
                          }
                        }}
                        onClick={() => {
                          if (inProgressFiltered.length > 0) {
                            handleGroupClick('Sprint Task Summary - In Progress', inProgressFiltered);
                          }
                        }}
                      >
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                            {inProgressFiltered.length}
                          </Typography>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 500, 
                            mb: 1,
                            opacity: 0.9,
                            fontSize: '1rem'
                          }}>
                            In Progress
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            opacity: 0.8,
                            fontWeight: 400,
                            fontSize: '0.8rem'
                          }}>
                            Click to view details
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>

                    {/* Blocked Card */}
                    <Grid item xs={12} sm={6} md={3}>
                      <Paper 
                        elevation={4} 
                        sx={{ 
                          p: 3, 
                          textAlign: 'center',
                          cursor: 'pointer',
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)',
                          color: 'white',
                          position: 'relative',
                          overflow: 'hidden',
                          boxShadow: '0 8px 32px rgba(255, 107, 107, 0.25)',
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 12px 40px rgba(255, 107, 107, 0.35)'
                          },
                          '&::before': {
                            content: "''",
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            width: '100px',
                            height: '100px',
                            background: 'rgba(255,255,255,0.1)',
                            borderRadius: '50%',
                            transform: 'translate(30px, -30px)'
                          }
                        }}
                        onClick={() => {
                          if (blockedUserStoriesAndBugs.length > 0) {
                            handleGroupClick('Sprint Task Summary - Blocked User Stories & Bugs', blockedUserStoriesAndBugs);
                          }
                        }}
                      >
                        <Box sx={{ position: 'relative', zIndex: 1 }}>
                          <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                            {blockedUserStoriesAndBugs.length}
                          </Typography>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 500, 
                            mb: 1,
                            opacity: 0.9,
                            fontSize: '1rem'
                          }}>
                            Blocked Stories/Bugs
                          </Typography>
                          <Typography variant="caption" sx={{ 
                            opacity: 0.8,
                            fontWeight: 400,
                            fontSize: '0.8rem'
                          }}>
                            Click to view details
                          </Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  </Grid>
                </>
              );
            })()}
          </Item>
        </Grid>

        {/* Training/Delivery Tag-Specific Tiles */}
        <Grid item xs={12}>
          <Item>
            {/* Header Section */}
            <Box sx={{ 
              background: 'linear-gradient(135deg, #546e7a 0%, #607d8b 100%)',
              borderRadius: 2,
              p: 3,
              mb: 3,
              boxShadow: '0 4px 12px rgba(84, 110, 122, 0.2)'
            }}>
              <Typography variant="h4" component="h2" sx={{ 
                color: '#ffffff', 
                fontWeight: 600,
                textAlign: 'center',
                mb: 1,
                letterSpacing: '0.5px'
              }}>
                📚 Task Categories by Tags
              </Typography>
              <Typography variant="body1" sx={{ 
                color: 'rgba(255,255,255,0.9)', 
                textAlign: 'center',
                fontSize: '1.1rem'
              }}>
                Tasks grouped by all available tags
              </Typography>
            </Box>

            {/* Tag-based Categorization Tiles */}
            <Grid container spacing={3}>
              {(() => {
                // Create a map to hold all unique tags and their associated tasks
                const tagMap = new Map<string, WorkItem[]>();
                
                // Add a category for items with no tags
                tagMap.set('No Tags', []);
                
                // Process each work item and categorize by tags
                workItems.forEach(item => {
                  if (item.type === 'Task' || item.type === 'User Story' || item.type === 'Bug') {
                    if (!item.tags || item.tags.length === 0) {
                      // Add to "No Tags" category
                      const noTagItems = tagMap.get('No Tags') || [];
                      noTagItems.push(item);
                      tagMap.set('No Tags', noTagItems);
                    } else {
                      // Add to each tag's category
                      item.tags.forEach(tag => {
                        const tagItems = tagMap.get(tag) || [];
                        tagItems.push(item);
                        tagMap.set(tag, tagItems);
                      });
                    }
                  }
                });
                
                // Convert the map to an array of tag/items pairs
                const tagCategories = Array.from(tagMap.entries())
                  .map(([tag, items]) => ({ tag, items }))
                  .filter(category => category.items.length > 0) // Only show categories with items
                  .sort((a, b) => b.items.length - a.items.length); // Sort by number of items

                return (
                  <>
                    {tagCategories.map(category => {
                      const completed = category.items.filter(item => 
                        item.state === 'Done' || item.state === 'Closed'
                      ).length;
                      
                      const progress = category.items.length > 0 
                        ? Math.round((completed / category.items.length) * 100) 
                        : 0;
                      
                      // Get a unique emoji for each tag category
                      const getTagEmoji = (tag: string) => {
                        const tagLower = tag.toLowerCase();
                        if (tagLower.includes('training')) return '📚';
                        if (tagLower.includes('delivery')) return '🚀';
                        if (tagLower.includes('bug') || tagLower.includes('fix')) return '🐛';
                        if (tagLower.includes('feature')) return '✨';
                        if (tagLower.includes('doc')) return '📄';
                        if (tagLower.includes('test')) return '🧪';
                        if (tagLower.includes('blocked')) return '🚫';
                        if (tagLower.includes('review')) return '👀';
                        if (tagLower.includes('design')) return '🎨';
                        if (tagLower.includes('dev') || tagLower.includes('code')) return '👨‍💻';
                        if (tagLower === 'no tags') return '🏷️';
                        
                        // For other tags, use a consistent emoji
                        return '🔖';
                      };
                      
                      return (
                        <Grid item xs={12} sm={6} md={4} key={category.tag}>
                          <Paper 
                            elevation={4} 
                            sx={{ 
                              p: 3, 
                              textAlign: 'center',
                              cursor: 'pointer',
                              borderRadius: 3,
                              background: getTagBackgroundGradient(category.tag),
                              color: 'white',
                              position: 'relative',
                              overflow: 'hidden',
                              boxShadow: '0 4px 16px rgba(108, 123, 127, 0.2)',
                              transition: 'all 0.3s ease-in-out',
                              '&:hover': {
                                transform: 'translateY(-2px)',
                                boxShadow: '0 6px 20px rgba(108, 123, 127, 0.3)'
                              },
                              '&::before': {
                                content: "''",
                                position: 'absolute',
                                top: 0,
                                right: 0,
                                width: '80px',
                                height: '80px',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '50%',
                                transform: 'translate(25px, -25px)'
                              }
                            }}
                            onClick={() => {
                              if (category.items.length > 0) {
                                handleGroupClick(`${category.tag} Tasks`, category.items);
                              }
                            }}
                          >
                            <Box sx={{ position: 'relative', zIndex: 1 }}>
                              <Typography variant="h3" sx={{ fontWeight: 700, mb: 1 }}>
                                {getTagEmoji(category.tag)}
                              </Typography>
                              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                                {category.items.length}
                              </Typography>
                              <Typography variant="h6" sx={{ 
                                fontWeight: 600, 
                                mb: 2,
                                opacity: 0.95,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                {category.tag}
                              </Typography>
                              
                              {/* Progress Section */}
                              <Box sx={{ mb: 2 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    Progress
                                  </Typography>
                                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                    {progress}%
                                  </Typography>
                                </Box>
                                <LinearProgress 
                                  variant="determinate" 
                                  value={progress} 
                                  sx={{ 
                                    height: 6,
                                    borderRadius: 3,
                                    backgroundColor: 'rgba(255,255,255,0.2)',
                                    '& .MuiLinearProgress-bar': {
                                      backgroundColor: '#ffffff',
                                      borderRadius: 3,
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
                                    }
                                  }} 
                                />
                                <Typography variant="caption" sx={{ 
                                  mt: 1, 
                                  opacity: 0.9,
                                  fontWeight: 500,
                                  display: 'block'
                                }}>
                                  {completed} of {category.items.length} completed
                                </Typography>
                              </Box>

                              {/* Work Item Types */}
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                                {(() => {
                                  const types = new Set(category.items.map(item => item.type));
                                  return Array.from(types).map(type => (
                                    <Chip 
                                      key={type}
                                      label={type} 
                                      size="small" 
                                      sx={{ 
                                        backgroundColor: 'rgba(255,255,255,0.15)', 
                                        color: 'white',
                                        fontWeight: 500,
                                        fontSize: '0.7rem'
                                      }} 
                                    />
                                  ));
                                })()}
                              </Box>
                            </Box>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </>
                );
              })()}
            </Grid>
          </Item>
        </Grid>

        {/* Priority-based Metrics - Beautiful Tile Layout */}
        <Grid item xs={12}>
          <Item>
            {/* Header Section */}
            <Box sx={{ 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 2,
              p: 3,
              mb: 3,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.2)'
            }}>
              <Typography variant="h4" component="h2" sx={{ 
                color: '#ffffff', 
                fontWeight: 600,
                textAlign: 'center',
                mb: 1,
                letterSpacing: '0.5px'
              }}>
                🎯 Priority-Based Work Items
              </Typography>
              <Typography variant="body1" sx={{ 
                color: 'rgba(255,255,255,0.9)', 
                textAlign: 'center',
                fontSize: '1.1rem'
              }}>
                User Stories & Bugs organized by priority with comprehensive metrics
              </Typography>
            </Box>

            {/* Priority-based Metrics */}
            {(() => {
              const parentItems = workItems.filter(item => 
                item.type === 'User Story' || item.type === 'Bug'
              );
              
              const p1Items = parentItems.filter(item => item.priority === 1);
              const p2Items = parentItems.filter(item => item.priority === 2);
              const p3Items = parentItems.filter(item => item.priority === 3);
              const otherItems = parentItems.filter(item => !item.priority || item.priority > 3);
              
              const getPriorityMetrics = (items: WorkItem[]) => {
                // Get all child tasks for these parent items
                const parentIds = items.map(item => item.id);
                const childTasks = workItems.filter(item => 
                  item.type === 'Task' && item.parentId && parentIds.includes(item.parentId)
                );
                
                // Separate bugs and user stories
                const bugs = items.filter(item => item.type === 'Bug');
                const userStories = items.filter(item => item.type === 'User Story');
                
                return {
                  total: items.length,
                  completed: items.filter(item => item.state === 'Done' || item.state === 'Closed').length,
                  inProgress: items.filter(item => item.state === 'Active' || item.state === 'In Progress').length,
                  // Check for blocked items by both state and tags
                  blocked: items.filter(item => item.state === 'Blocked' || isWorkItemBlocked(item)).length,
                  withPRs: items.filter(item => getPRLinks(item).length > 0).length,
                  // Bug and User Story breakdown
                  bugs: bugs.length,
                  userStories: userStories.length,
                  bugsCompleted: bugs.filter(item => item.state === 'Done' || item.state === 'Closed').length,
                  userStoriesCompleted: userStories.filter(item => item.state === 'Done' || item.state === 'Closed').length,
                  // Child task metrics
                  totalTasks: childTasks.length,
                  completedTasks: childTasks.filter(task => task.state === 'Done' || task.state === 'Closed').length,
                  inProgressTasks: childTasks.filter(task => task.state === 'Active' || task.state === 'In Progress').length,
                  // Check for blocked child tasks by both state and tags
                  blockedTasks: childTasks.filter(task => task.state === 'Blocked' || isWorkItemBlocked(task)).length,
                  pendingTasks: childTasks.filter(task => task.state !== 'Done' && task.state !== 'Closed').length,
                  // URLs
                  adoUrls: items.map(item => getAdoWorkItemUrl(item)),
                  prUrls: items.flatMap(item => getPRLinks(item)),
                  items: items,
                  childTasks: childTasks
                };
              };
              
              const p1Metrics = getPriorityMetrics(p1Items);
              const p2Metrics = getPriorityMetrics(p2Items);
              const p3Metrics = getPriorityMetrics(p3Items);
              const otherMetrics = getPriorityMetrics(otherItems);
              
              return (
                <Grid container spacing={3}>
                  {/* P1 Priority */}
                  <Grid item xs={12} md={3}>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 3, 
                        background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                        borderLeft: '6px solid #dc3545',
                        borderRadius: 3,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #ffcdd2 0%, #ef9a9a 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(220, 53, 69, 0.3)',
                        },
                        '&::before': {
                          content: "''",
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '100px',
                          height: '100px',
                          background: 'radial-gradient(circle, rgba(220, 53, 69, 0.1) 0%, transparent 70%)',
                          borderRadius: '50%',
                          transform: 'translate(50%, -50%)'
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      onClick={() => handleGroupClick('P1 Priority Items (User Stories & Bugs)', p1Metrics.items)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, position: 'relative', zIndex: 1 }}>
                        <Chip 
                          label="P1" 
                          sx={{ 
                            backgroundColor: '#dc3545', 
                            color: 'white', 
                            fontWeight: 700,
                            fontSize: '0.875rem',
                            mr: 1,
                            boxShadow: '0 2px 8px rgba(220, 53, 69, 0.3)'
                          }}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#dc3545' }}>
                          Critical Priority
                        </Typography>
                      </Box>
                      
                      <Typography variant="h3" sx={{ mb: 2, color: '#dc3545', fontWeight: 800, position: 'relative', zIndex: 1 }}>
                        {p1Metrics.total}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          ✅ Completed: {p1Metrics.completed}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔄 In Progress: {p1Metrics.inProgress}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🚫 Blocked: {p1Metrics.blocked}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔗 With PRs: {p1Metrics.withPRs}
                        </Typography>
                      </Box>

                      {/* URLs Section */}
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        {p1Metrics.adoUrls && p1Metrics.adoUrls.length > 0 ? (
                          <Button
                            href={p1Metrics.adoUrls[0]}
                            target="_blank"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                          >
                            ADO ({p1Metrics.adoUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No ADO Links" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                        {p1Metrics.prUrls && p1Metrics.prUrls.length > 0 ? (
                          <Button
                            href={p1Metrics.prUrls[0]}
                            target="_blank"
                            size="small"
                            variant="contained"
                            sx={{ 
                              fontSize: '0.7rem', 
                              minWidth: 'auto', 
                              px: 1,
                              backgroundColor: '#28a745',
                              '&:hover': { backgroundColor: '#1e7e34' }
                            }}
                          >
                            PR ({p1Metrics.prUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No PRs" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Click to view all P1 items
                      </Typography>
                    </Paper>
                  </Grid>

                  {/* P2 Priority */}
                  <Grid item xs={12} md={3}>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 3, 
                        background: 'linear-gradient(135deg, #fff3e0 0%, #ffe0b2 100%)',
                        borderLeft: '6px solid #ff9800',
                        borderRadius: 3,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #ffe0b2 0%, #ffcc02 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(255, 152, 0, 0.3)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '100px',
                          height: '100px',
                          background: 'radial-gradient(circle, rgba(255, 152, 0, 0.1) 0%, transparent 70%)',
                          borderRadius: '50%',
                          transform: 'translate(50%, -50%)'
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      onClick={() => handleGroupClick('P2 Priority Items (User Stories & Bugs)', p2Metrics.items)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, position: 'relative', zIndex: 1 }}>
                        <Chip 
                          label="P2" 
                          sx={{ 
                            backgroundColor: '#ff9800', 
                            color: 'white', 
                            fontWeight: 700,
                            mr: 1,
                            boxShadow: '0 2px 8px rgba(255, 152, 0, 0.3)'
                          }}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#ff9800' }}>
                          High Priority
                        </Typography>
                      </Box>
                      
                      <Typography variant="h3" sx={{ mb: 2, color: '#ff9800', fontWeight: 800, position: 'relative', zIndex: 1 }}>
                        {p2Metrics.total}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          ✅ Completed: {p2Metrics.completed}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔄 In Progress: {p2Metrics.inProgress}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🚫 Blocked: {p2Metrics.blocked}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔗 With PRs: {p2Metrics.withPRs}
                        </Typography>
                      </Box>

                      {/* URLs Section */}
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        {p2Metrics.adoUrls && p2Metrics.adoUrls.length > 0 ? (
                          <Button
                            href={p2Metrics.adoUrls[0]}
                            target="_blank"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                          >
                            ADO ({p2Metrics.adoUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No ADO Links" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                        {p2Metrics.prUrls && p2Metrics.prUrls.length > 0 ? (
                          <Button
                            href={p2Metrics.prUrls[0]}
                            target="_blank"
                            size="small"
                            variant="contained"
                            sx={{ 
                              fontSize: '0.7rem', 
                              minWidth: 'auto', 
                              px: 1,
                              backgroundColor: '#28a745',
                              '&:hover': { backgroundColor: '#1e7e34' }
                            }}
                          >
                            PR ({p2Metrics.prUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No PRs" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Click to view all P2 items
                      </Typography>
                    </Paper>
                  </Grid>

                  {/* P3 Priority */}
                  <Grid item xs={12} md={3}>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 3, 
                        background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                        borderLeft: '6px solid #2196f3',
                        borderRadius: 3,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #bbdefb 0%, #90caf9 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(33, 150, 243, 0.3)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '100px',
                          height: '100px',
                          background: 'radial-gradient(circle, rgba(33, 150, 243, 0.1) 0%, transparent 70%)',
                          borderRadius: '50%',
                          transform: 'translate(50%, -50%)'
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      onClick={() => handleGroupClick('P3 Priority Items (User Stories & Bugs)', p3Metrics.items)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, position: 'relative', zIndex: 1 }}>
                        <Chip 
                          label="P3" 
                          sx={{ 
                            backgroundColor: '#2196f3', 
                            color: 'white', 
                            fontWeight: 700,
                            mr: 1,
                            boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)'
                          }}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#2196f3' }}>
                          Medium Priority
                        </Typography>
                      </Box>
                      
                      <Typography variant="h3" sx={{ mb: 2, color: '#2196f3', fontWeight: 800, position: 'relative', zIndex: 1 }}>
                        {p3Metrics.total}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          ✅ Completed: {p3Metrics.completed}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔄 In Progress: {p3Metrics.inProgress}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🚫 Blocked: {p3Metrics.blocked}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔗 With PRs: {p3Metrics.withPRs}
                        </Typography>
                      </Box>

                      {/* URLs Section */}
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        {p3Metrics.adoUrls && p3Metrics.adoUrls.length > 0 ? (
                          <Button
                            href={p3Metrics.adoUrls[0]}
                            target="_blank"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                          >
                            ADO ({p3Metrics.adoUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No ADO Links" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                        {p3Metrics.prUrls && p3Metrics.prUrls.length > 0 ? (
                          <Button
                            href={p3Metrics.prUrls[0]}
                            target="_blank"
                            size="small"
                            variant="contained"
                            sx={{ 
                              fontSize: '0.7rem', 
                              minWidth: 'auto', 
                              px: 1,
                              backgroundColor: '#28a745',
                              '&:hover': { backgroundColor: '#1e7e34' }
                            }}
                          >
                            PR ({p3Metrics.prUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No PRs" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Click to view all P3 items
                      </Typography>
                    </Paper>
                  </Grid>

                  {/* Other/Low Priority */}
                  <Grid item xs={12} md={3}>
                    <Paper 
                      elevation={3} 
                      sx={{ 
                        p: 3, 
                        background: 'linear-gradient(135deg, #f5f5f5 0%, #eeeeee 100%)',
                        borderLeft: '6px solid #757575',
                        borderRadius: 3,
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #eeeeee 0%, #e0e0e0 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 8px 25px rgba(117, 117, 117, 0.3)',
                        },
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          top: 0,
                          right: 0,
                          width: '100px',
                          height: '100px',
                          background: 'radial-gradient(circle, rgba(117, 117, 117, 0.1) 0%, transparent 70%)',
                          borderRadius: '50%',
                          transform: 'translate(50%, -50%)'
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                      onClick={() => handleGroupClick('Low/No Priority Items (User Stories & Bugs)', otherMetrics.items)}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, position: 'relative', zIndex: 1 }}>
                        <Chip 
                          label="Low" 
                          sx={{ 
                            backgroundColor: '#757575', 
                            color: 'white', 
                            fontWeight: 700,
                            mr: 1,
                            boxShadow: '0 2px 8px rgba(117, 117, 117, 0.3)'
                          }}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#757575' }}>
                          Low/No Priority
                        </Typography>
                      </Box>
                      
                      <Typography variant="h3" sx={{ mb: 2, color: '#757575', fontWeight: 800, position: 'relative', zIndex: 1 }}>
                        {otherMetrics.total}
                      </Typography>
                      
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          ✅ Completed: {otherMetrics.completed}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔄 In Progress: {otherMetrics.inProgress}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🚫 Blocked: {otherMetrics.blocked}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          🔗 With PRs: {otherMetrics.withPRs}
                        </Typography>
                      </Box>

                      {/* URLs Section */}
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        {otherMetrics.adoUrls && otherMetrics.adoUrls.length > 0 ? (
                          <Button
                            href={otherMetrics.adoUrls[0]}
                            target="_blank"
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', minWidth: 'auto', px: 1 }}
                          >
                            ADO ({otherMetrics.adoUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No ADO Links" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                        {otherMetrics.prUrls && otherMetrics.prUrls.length > 0 ? (
                          <Button
                            href={otherMetrics.prUrls[0]}
                            target="_blank"
                            size="small"
                            variant="contained"
                            sx={{ 
                              fontSize: '0.7rem', 
                              minWidth: 'auto', 
                              px: 1,
                              backgroundColor: '#28a745',
                              '&:hover': { backgroundColor: '#1e7e34' }
                            }}
                          >
                            PR ({otherMetrics.prUrls.length})
                          </Button>
                        ) : (
                          <Chip 
                            label="No PRs" 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem', height: 24, color: 'text.secondary' }}
                          />
                        )}
                      </Box>
                      
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Click to view all low priority items
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              );
            })()}
          </Item>
        </Grid>
        
        {/* Dashboard Tabs */}
        <Grid item xs={12}>
          <Item>
            <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tabs value={tabValue} onChange={handleTabChange} aria-label="dashboard tabs">
                <Tab label="Overview" {...a11yProps(0)} />
                <Tab label="Activity Monitoring" {...a11yProps(1)} />
                <Tab label="Capacity Utilization" {...a11yProps(2)} />
              </Tabs>
            </Box>
            
            <TabPanel value={tabValue} index={0}>
              <ExecutiveSummaryWithActivityMonitoring 
                workItems={workItems} 
                isLoading={isLoading}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={1}>
              <ExecutiveSummaryWithActivityMonitoring 
                workItems={workItems} 
                isLoading={isLoading}
              />
            </TabPanel>
            
            <TabPanel value={tabValue} index={2}>
              <CapacityUtilization 
                sprintId={selectedSprintId}
              />
            </TabPanel>
          </Item>
        </Grid>
      </Grid>

      {/* Work Items Group Dialog - Enhanced with comprehensive ADO details */}
      <Dialog 
        open={isGroupDialogOpen} 
        onClose={() => setIsGroupDialogOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '95vh',
            minHeight: '75vh'
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          p: 3
        }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 1 }}>
              📋 {groupDialogTitle}
            </Typography>
            <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
              {groupDialogItems.length} work items with complete ADO details
            </Typography>
          </Box>
          <IconButton 
            onClick={() => setIsGroupDialogOpen(false)}
            sx={{ color: 'white' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 0 }}>
          {/* Summary Statistics Bar */}
          <Box sx={{ 
            p: 3, 
            backgroundColor: '#f8f9fa',
            borderBottom: '1px solid #dee2e6'
          }}>
            <Grid container spacing={3}>
              <Grid item xs={6} sm={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#e8f5e8' }}>
                  <Typography variant="h6" sx={{ color: '#2e7d32', fontWeight: 600 }}>
                    {groupDialogItems.filter(item => item.state === 'Done' || item.state === 'Closed').length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 500 }}>
                    ✅ Completed
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#fff3cd' }}>
                  <Typography variant="h6" sx={{ color: '#856404', fontWeight: 600 }}>
                    {groupDialogItems.filter(item => item.state === 'Active' || item.state === 'In Progress').length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#856404', fontWeight: 500 }}>
                    🔄 In Progress
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#ffebee' }}>
                  <Typography variant="h6" sx={{ color: '#d32f2f', fontWeight: 600 }}>
                    {groupDialogItems.filter(item => item.priority === 1).length}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#d32f2f', fontWeight: 500 }}>
                    🔥 Critical Priority
                  </Typography>
                </Paper>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Paper elevation={1} sx={{ p: 2, textAlign: 'center', backgroundColor: '#e3f2fd' }}>
                  <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 600 }}>
                    {groupDialogItems.filter(item => item.effort && item.effort > 0).reduce((sum, item) => sum + (item.effort || 0), 0)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#1976d2', fontWeight: 500 }}>
                    📊 Total Effort Points
                  </Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>

          {/* Comprehensive Work Items Table */}
          <TableContainer component={Paper} sx={{ maxHeight: '60vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 100,
                    fontSize: '0.9rem'
                  }}>
                    🔗 ADO ID
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 300,
                    fontSize: '0.9rem'
                  }}>
                    📝 Title
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 120,
                    fontSize: '0.9rem'
                  }}>
                    🏷️ Type
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 130,
                    fontSize: '0.9rem'
                  }}>
                    📊 State
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 120,
                    fontSize: '0.9rem'
                  }}>
                    ⚡ Priority
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 150,
                    fontSize: '0.9rem'
                  }}>
                    👤 Assigned To
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 100,
                    fontSize: '0.9rem'
                  }}>
                    📈 Effort Points
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 200,
                    fontSize: '0.9rem'
                  }}>
                    🏷️ Tags
                  </TableCell>
                  <TableCell sx={{ 
                    fontWeight: 700, 
                    color: '#2c3e50', 
                    backgroundColor: '#f8f9fa',
                    minWidth: 250,
                    fontSize: '0.9rem'
                  }}>
                    📄 Description
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groupDialogItems.map((item, index) => (
                  <TableRow 
                    key={item.id} 
                    hover 
                    sx={{ 
                      '&:hover': { backgroundColor: '#f5f5f5' },
                      backgroundColor: index % 2 === 0 ? '#fafafa' : 'white'
                    }}
                  >
                    {/* ADO ID with clickable link */}
                    <TableCell>
                      <Button
                        href={getAdoWorkItemUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="contained"
                        size="small"
                        sx={{ 
                          minWidth: 'auto', 
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #1565c0 0%, #0d47a1 100%)',
                            transform: 'scale(1.05)'
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                        startIcon={<OpenInNewIcon fontSize="small" />}
                      >
                        {item.id}
                      </Button>
                    </TableCell>

                    {/* Title with tooltip for full text */}
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          fontWeight: 600,
                          lineHeight: 1.4,
                          color: '#2c3e50'
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </Typography>
                    </TableCell>

                    {/* Type chip with appropriate colors */}
                    <TableCell>
                      <Chip 
                        label={item.type} 
                        size="small"
                        sx={{ 
                          backgroundColor: item.type === 'User Story' ? '#e3f2fd' : 
                                         item.type === 'Bug' ? '#ffebee' : 
                                         item.type === 'Task' ? '#f3e5f5' : 
                                         item.type === 'Feature' ? '#e8f5e8' : '#f5f5f5',
                          color: item.type === 'User Story' ? '#1976d2' : 
                                 item.type === 'Bug' ? '#d32f2f' : 
                                 item.type === 'Task' ? '#7b1fa2' : 
                                 item.type === 'Feature' ? '#388e3c' : '#666',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      />
                    </TableCell>

                    {/* State chip with status colors */}
                    <TableCell>
                      <Chip 
                        label={item.state} 
                        size="small"
                        sx={{ 
                          backgroundColor: item.state === 'Done' || item.state === 'Closed' ? '#e8f5e8' : 
                                         item.state === 'Active' || item.state === 'In Progress' ? '#fff3cd' : 
                                         item.state === 'New' ? '#e3f2fd' : 
                                         item.state === 'Blocked' ? '#ffebee' : '#f5f5f5',
                          color: item.state === 'Done' || item.state === 'Closed' ? '#2e7d32' : 
                                 item.state === 'Active' || item.state === 'In Progress' ? '#856404' : 
                                 item.state === 'New' ? '#1976d2' : 
                                 item.state === 'Blocked' ? '#d32f2f' : '#666',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      />
                    </TableCell>

                    {/* Priority with visual indicators */}
                    <TableCell>
                      <Chip 
                        label={
                          item.priority === 1 ? '🔥 Critical' : 
                          item.priority === 2 ? '⚡ High' : 
                          item.priority === 3 ? '📝 Medium' : 
                          item.priority === 4 ? '📋 Low' : '⚪ None'
                        } 
                        size="small"
                        sx={{ 
                          backgroundColor: item.priority === 1 ? '#ffebee' : 
                                         item.priority === 2 ? '#fff3cd' : 
                                         item.priority === 3 ? '#e8f5e8' : 
                                         item.priority === 4 ? '#e3f2fd' : '#f5f5f5',
                          color: item.priority === 1 ? '#d32f2f' : 
                                 item.priority === 2 ? '#856404' : 
                                 item.priority === 3 ? '#2e7d32' : 
                                 item.priority === 4 ? '#1976d2' : '#666',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      />
                    </TableCell>

                    {/* Assigned To with avatar or initials */}
                    <TableCell>
                      <Typography variant="body2" sx={{ 
                        color: item.assignedTo ? '#333' : '#999',
                        fontWeight: item.assignedTo ? 600 : 400,
                        fontStyle: item.assignedTo ? 'normal' : 'italic'
                      }}>
                        {item.assignedTo || '👤 Unassigned'}
                      </Typography>
                    </TableCell>

                    {/* Effort Points with visual emphasis */}
                    <TableCell>
                      <Chip
                        label={item.effort ? `${item.effort} pts` : 'No estimate'}
                        size="small"
                        sx={{
                          backgroundColor: item.effort ? '#e8f5e8' : '#f5f5f5',
                          color: item.effort ? '#2e7d32' : '#999',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      />
                    </TableCell>

                    {/* Tags with truncation and count */}
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 200 }}>
                        {item.tags && item.tags.length > 0 ? (
                          <>
                            {item.tags.slice(0, 2).map((tag, tagIndex) => (
                              <Chip
                                key={tagIndex}
                                label={tag}
                                size="small"
                                variant="outlined"
                                sx={{ 
                                  fontSize: '0.7rem', 
                                  height: 20,
                                  backgroundColor: '#f8f9fa',
                                  borderColor: '#dee2e6'
                                }}
                              />
                            ))}
                            {item.tags.length > 2 && (
                              <Chip
                                label={`+${item.tags.length - 2}`}
                                size="small"
                                sx={{ 
                                  fontSize: '0.65rem', 
                                  height: 20,
                                  backgroundColor: '#e9ecef',
                                  color: '#6c757d'
                                }}
                              />
                            )}
                          </>
                        ) : (
                          <Typography variant="caption" sx={{ color: '#999', fontStyle: 'italic' }}>
                            No tags
                          </Typography>
                        )}
                      </Box>
                    </TableCell>

                    {/* Description with formatting */}
                    <TableCell sx={{ maxWidth: 250 }}>
                      <Typography 
                        variant="caption" 
                        sx={{ 
                          color: '#666',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          lineHeight: 1.3
                        }}
                        title={item.description ? formatDescription(item.description) : 'No description'}
                      >
                        {item.description ? formatDescription(item.description).substring(0, 150) + '...' : '📝 No description available'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        
        <DialogActions sx={{ 
          p: 3, 
          backgroundColor: '#f8f9fa',
          borderTop: '1px solid #dee2e6',
          justifyContent: 'space-between'
        }}>
          <Typography variant="body2" sx={{ color: '#666' }}>
            💡 Click on work item IDs to open them directly in Azure DevOps | 📊 Comprehensive task details
          </Typography>
          <Button 
            onClick={() => setIsGroupDialogOpen(false)}
            variant="contained"
            sx={{
              background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #1a252f 0%, #2c3e50 100%)',
              }
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      </Box> {/* Close Main Content Box */}
    </Box>
  );
};

export default Dashboard;
