import React, { useState } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Chip, 
  Divider,
  Avatar,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  SelectChangeEvent
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import CommentIcon from '@mui/icons-material/Comment';
import { WorkItem, adoService } from '../../services/adoService';

interface WorkItemsBoardProps {
  workItems: WorkItem[];
}

// Group work items by state
const groupWorkItemsByState = (workItems: WorkItem[]) => {
  const groups: Record<string, WorkItem[]> = {};
  
  workItems.forEach(item => {
    if (!groups[item.state]) {
      groups[item.state] = [];
    }
    groups[item.state].push(item);
  });
  
  return groups;
};

// Get color for work item state
const getStateColor = (state: string): string => {
  const lowerState = state.toLowerCase();
  if (lowerState.includes('new') || lowerState.includes('to do') || lowerState.includes('backlog')) {
    return '#e3f2fd'; // Light blue
  } else if (lowerState.includes('active') || lowerState.includes('in progress')) {
    return '#fff3e0'; // Light orange
  } else if (lowerState.includes('resolved') || lowerState.includes('ready')) {
    return '#e8f5e9'; // Light green
  } else if (lowerState.includes('closed') || lowerState.includes('done') || lowerState.includes('completed')) {
    return '#c8e6c9'; // Green
  } else if (lowerState.includes('blocked') || lowerState.includes('impediment')) {
    return '#ffebee'; // Light red
  }
  return '#f5f5f5'; // Default light gray
};

// Get color for work item type
const getTypeColor = (type: string): string => {
  const lowerType = type.toLowerCase();
  if (lowerType.includes('bug')) {
    return '#f44336'; // Red
  } else if (lowerType.includes('user story') || lowerType.includes('story')) {
    return '#2196f3'; // Blue
  } else if (lowerType.includes('task')) {
    return '#ff9800'; // Orange
  } else if (lowerType.includes('feature')) {
    return '#4caf50'; // Green
  } else if (lowerType.includes('epic')) {
    return '#9c27b0'; // Purple
  }
  return '#757575'; // Default gray
};

// Get initials from a name
const getInitials = (name: string | null): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Define available states for work items
const WORK_ITEM_STATES = [
  'New',
  'Active',
  'In Progress',
  'Ready for Review',
  'Resolved',
  'Closed',
  'Blocked'
];

const WorkItemCard: React.FC<{ workItem: WorkItem, onUpdate?: () => void }> = ({ workItem, onUpdate }) => {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [updatedState, setUpdatedState] = useState(workItem.state);
  const [updatedEffort, setUpdatedEffort] = useState<number | null>(workItem.effort);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleOpenEditDialog = () => {
    setUpdatedState(workItem.state);
    setUpdatedEffort(workItem.effort);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setErrorMessage(null);
  };

  const handleOpenCommentDialog = () => {
    setComment('');
    setCommentDialogOpen(true);
  };

  const handleCloseCommentDialog = () => {
    setCommentDialogOpen(false);
    setErrorMessage(null);
  };

  const handleStateChange = (event: SelectChangeEvent) => {
    setUpdatedState(event.target.value);
  };

  const handleEffortChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setUpdatedEffort(value === '' ? null : Number(value));
  };

  const handleCommentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setComment(event.target.value);
  };

  const handleSubmitEdit = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const updates: Record<string, any> = {};
      
      if (updatedState !== workItem.state) {
        updates['System.State'] = updatedState;
      }
      
      if (updatedEffort !== workItem.effort) {
        updates['Microsoft.VSTS.Scheduling.Effort'] = updatedEffort;
      }
      
      if (Object.keys(updates).length === 0) {
        setIsSubmitting(false);
        return;
      }
      
      await adoService.updateWorkItem(workItem.id, updates);
      
      if (onUpdate) {
        onUpdate();
      }
      
      handleCloseEditDialog();
    } catch (error) {
      console.error('Error updating work item:', error);
      setErrorMessage('Failed to update work item. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim()) return;
    
    setIsSubmitting(true);
    setErrorMessage(null);
    
    try {
      const success = await adoService.addWorkItemComment(workItem.id, comment);
      
      if (success) {
        if (onUpdate) {
          onUpdate();
        }
        
        handleCloseCommentDialog();
      } else {
        setErrorMessage('Failed to add comment. Please try again.');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      setErrorMessage('Failed to add comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2, 
          mb: 1, 
          borderLeft: `4px solid ${getTypeColor(workItem.type)}`,
          '&:hover': {
            boxShadow: 3
          }
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="subtitle2" noWrap sx={{ maxWidth: '70%' }}>
            {workItem.id}: {workItem.title}
          </Typography>
          <Chip 
            label={workItem.type} 
            size="small" 
            sx={{ 
              backgroundColor: getTypeColor(workItem.type),
              color: 'white',
              fontSize: '0.7rem',
              height: 20
            }} 
          />
        </Box>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {workItem.assignedTo ? (
              <Tooltip title={workItem.assignedTo}>
                <Avatar 
                  sx={{ 
                    width: 24, 
                    height: 24, 
                    fontSize: '0.8rem', 
                    bgcolor: 'primary.main' 
                  }}
                >
                  {getInitials(workItem.assignedTo)}
                </Avatar>
              </Tooltip>
            ) : (
              <Avatar 
                sx={{ 
                  width: 24, 
                  height: 24, 
                  fontSize: '0.8rem', 
                  bgcolor: 'grey.400' 
                }}
              >
                ?
              </Avatar>
            )}
            
            <IconButton 
              size="small" 
              onClick={handleOpenCommentDialog}
              sx={{ ml: 0.5 }}
            >
              <CommentIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {workItem.effort !== null && (
              <Chip 
                label={`${workItem.effort} pts`} 
                size="small" 
                variant="outlined"
                sx={{ 
                  fontSize: '0.7rem',
                  height: 20,
                  mr: 0.5
                }} 
              />
            )}
            
            <IconButton 
              size="small" 
              onClick={handleOpenEditDialog}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Paper>
      
      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseEditDialog}>
        <DialogTitle>Edit Work Item #{workItem.id}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle1">{workItem.title}</Typography>
            
            <FormControl fullWidth margin="normal">
              <InputLabel id="state-select-label">State</InputLabel>
              <Select
                labelId="state-select-label"
                value={updatedState}
                label="State"
                onChange={handleStateChange}
              >
                {WORK_ITEM_STATES.map((state) => (
                  <MenuItem key={state} value={state}>{state}</MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <TextField
              margin="normal"
              label="Effort (points)"
              type="number"
              fullWidth
              value={updatedEffort === null ? '' : updatedEffort}
              onChange={handleEffortChange}
              inputProps={{ min: 0 }}
            />
            
            {errorMessage && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {errorMessage}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEditDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmitEdit} 
            variant="contained" 
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Comment Dialog */}
      <Dialog open={commentDialogOpen} onClose={handleCloseCommentDialog}>
        <DialogTitle>Add Comment to Work Item #{workItem.id}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle1">{workItem.title}</Typography>
            
            <TextField
              margin="normal"
              label="Comment"
              multiline
              rows={4}
              fullWidth
              value={comment}
              onChange={handleCommentChange}
            />
            
            {errorMessage && (
              <Typography color="error" variant="body2" sx={{ mt: 1 }}>
                {errorMessage}
              </Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCommentDialog}>Cancel</Button>
          <Button 
            onClick={handleSubmitComment} 
            variant="contained" 
            disabled={isSubmitting || !comment.trim()}
          >
            {isSubmitting ? 'Posting...' : 'Post Comment'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const WorkItemsBoard: React.FC<WorkItemsBoardProps> = ({ workItems }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const groupedItems = groupWorkItemsByState(workItems);
  const states = Object.keys(groupedItems);
  
  // Function to trigger a refresh of the board
  const handleWorkItemUpdate = () => {
    setRefreshKey(prevKey => prevKey + 1);
    // In a real implementation, you would also trigger a refresh of the data from the server
  };
  
  if (workItems.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="body1" color="text.secondary">
          No work items found for the current sprint
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Grid container spacing={2} sx={{ height: '100%' }}>
        {states.map(state => (
          <Grid item xs={12} sm={6} md={4} key={state}>
            <Paper 
              elevation={0} 
              sx={{ 
                p: 1, 
                backgroundColor: getStateColor(state),
                height: '100%',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle1">{state}</Typography>
                <Chip 
                  label={groupedItems[state].length} 
                  size="small" 
                  sx={{ height: 20 }} 
                />
              </Box>
              <Divider sx={{ mb: 1 }} />
              <Box sx={{ flexGrow: 1, overflow: 'auto', maxHeight: 320 }}>
                {groupedItems[state].map(item => (
                  <WorkItemCard 
                    key={item.id} 
                    workItem={item} 
                    onUpdate={handleWorkItemUpdate}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
};

export default WorkItemsBoard;
