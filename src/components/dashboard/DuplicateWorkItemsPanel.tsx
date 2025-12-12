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
  List,
  ListItem,
  ListItemText,
  Chip,
  Alert,
  IconButton,
  Tooltip,
  Link,
  Collapse
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MergeTypeIcon from '@mui/icons-material/MergeType';
import adoService, { WorkItem } from '../../services/adoService';
import teamsNotificationService from '../../services/teamsNotificationService';

interface DuplicateGroup {
  parentItem: WorkItem | null;
  duplicates: WorkItem[];
}

const DuplicateWorkItemsPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);  // Changed from true to false to prevent loading on startup
  const [error, setError] = useState<string | null>(null);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [sprintName, setSprintName] = useState('Current Sprint');

  // Auto-loading of duplicate work items DISABLED to prevent page refreshing
  console.log('Duplicate work items auto-load DISABLED to prevent page refreshing');
  
  /* Original auto-load and refresh listener commented out:
  useEffect(() => {
    loadDuplicateWorkItems();

    // Set up refresh listener
    const handleRefresh = () => {
      loadDuplicateWorkItems();
    };

    window.addEventListener('ado-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('ado-data-refresh', handleRefresh);
    };
  }, []);
  */

  const loadDuplicateWorkItems = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current sprint
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        setError('No active sprint found');
        setIsLoading(false);
        return;
      }

      setSprintName(currentSprint.name);

      // Get duplicate work items
      const duplicates = await adoService.findDuplicateWorkItems(currentSprint.id);
      setDuplicateGroups(duplicates);

      // Initialize expanded state for each group
      const initialExpandedState: Record<string, boolean> = {};
      duplicates.forEach((group, index) => {
        initialExpandedState[`group-${index}`] = false;
      });
      setExpandedGroups(initialExpandedState);

    } catch (err) {
      console.error('Error loading duplicate work items:', err);
      setError('Failed to load duplicate work items');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  const handleNotifyTeam = async (group: DuplicateGroup) => {
    try {
      const parentName = group.parentItem ? group.parentItem.title : 'No parent';
      const duplicateIds = group.duplicates.map(item => `#${item.id}`).join(', ');
      const assignee = group.duplicates[0].assignedTo || 'Unassigned';
      
      const message = `
**Potential Duplicate Work Items Detected**

Parent: ${parentName}
Work Items: ${duplicateIds}
Assigned To: ${assignee}

These work items appear to be duplicates. Please review and consider merging or removing redundant items.
      `;
      
      // Send notification to Teams
      await teamsNotificationService.sendChannelMessage(
        null, // Use default channel
        'Duplicate Work Items Detected',
        message
      );
      
      // Also add a comment to each work item
      for (const item of group.duplicates) {
        const otherItems = group.duplicates
          .filter(other => other.id !== item.id)
          .map(other => `#${other.id}`)
          .join(', ');
          
        const comment = `This work item may be a duplicate of ${otherItems}. Please review.`;
        await adoService.addWorkItemComment(item.id, comment);
      }
      
    } catch (error) {
      console.error('Error sending notification:', error);
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
        Duplicate Work Items: {sprintName}
      </Typography>
      
      <Typography variant="body2" color="text.secondary" paragraph>
        This panel shows potential duplicate work items in the current sprint. 
        These are tasks or user stories under the same parent that are assigned to none or the same user.
      </Typography>
      
      {duplicateGroups.length === 0 ? (
        <Alert severity="success" sx={{ mt: 2 }}>
          No duplicate work items found in the current sprint.
        </Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            Found {duplicateGroups.length} group(s) of potential duplicate work items.
          </Alert>
          
          {duplicateGroups.map((group, groupIndex) => (
            <Card key={`duplicate-group-${groupIndex}`} variant="outlined" sx={{ mb: 2 }}>
              <CardContent sx={{ pb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <WarningIcon color="warning" sx={{ mr: 1 }} />
                    <Typography variant="subtitle1">
                      {group.parentItem ? (
                        <>
                          Parent: <Link href={group.parentItem.url} target="_blank" rel="noopener">{group.parentItem.title}</Link>
                        </>
                      ) : (
                        'No Parent'
                      )}
                    </Typography>
                  </Box>
                  
                  <Box>
                    <Tooltip title="Notify team about duplicates">
                      <IconButton 
                        size="small" 
                        onClick={() => handleNotifyTeam(group)}
                        sx={{ mr: 1 }}
                      >
                        <InfoIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <IconButton 
                      size="small" 
                      onClick={() => toggleGroupExpanded(`group-${groupIndex}`)}
                    >
                      {expandedGroups[`group-${groupIndex}`] ? (
                        <ExpandLessIcon fontSize="small" />
                      ) : (
                        <ExpandMoreIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Box>
                </Box>
                
                <Collapse in={expandedGroups[`group-${groupIndex}`]}>
                  <List dense>
                    {group.duplicates.map((item) => (
                      <ListItem 
                        key={`work-item-${item.id}`}
                        sx={{ 
                          borderLeft: '3px solid #ff9800',
                          pl: 2,
                          my: 1,
                          backgroundColor: 'rgba(255, 152, 0, 0.08)'
                        }}
                      >
                        <ListItemText
                          primary={
                            <Link href={item.url} target="_blank" rel="noopener">
                              {item.id}: {item.title}
                            </Link>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              <Chip 
                                label={item.state} 
                                size="small" 
                                sx={{ mr: 1, mb: 0.5 }} 
                              />
                              <Chip 
                                label={item.type} 
                                size="small" 
                                sx={{ mr: 1, mb: 0.5 }} 
                              />
                              {item.assignedTo && (
                                <Chip 
                                  label={item.assignedTo} 
                                  size="small" 
                                  sx={{ mr: 1, mb: 0.5 }} 
                                />
                              )}
                              {item.effort !== null && (
                                <Chip 
                                  label={`Effort: ${item.effort}`} 
                                  size="small" 
                                  sx={{ mr: 1, mb: 0.5 }} 
                                />
                              )}
                            </Box>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                  
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<MergeTypeIcon />}
                      onClick={() => window.open(group.duplicates[0].url, '_blank')}
                    >
                      View in ADO
                    </Button>
                  </Box>
                </Collapse>
              </CardContent>
            </Card>
          ))}
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button variant="contained" onClick={loadDuplicateWorkItems}>
              Refresh
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
};

export default DuplicateWorkItemsPanel;
