import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Chip,
  Menu,
  MenuItem,
  Divider,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as SmartToyIcon,
  Person as PersonIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
  BarChart as BarChartIcon,
  Timeline as TimelineIcon,
  PieChart as PieChartIcon
} from '@mui/icons-material';
import { TeamMember, TeamCapacity, WorkItem, Sprint } from '../../services/adoService';
import { thomsonReutersOpenAIService } from '../../services/thomsonReutersOpenAiService';
import adoService from '../../services/adoService';

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: Date;
  adoLinks?: string[];
  autoAssignTags?: string[];
  autoRemoveTags?: string[];
  visualType?: 'chart' | 'timeline' | 'pie' | null;
}

// Helper function to process HTML description
const processHtmlDescription = (description: string | null | undefined): string => {
  if (!description || typeof description !== 'string') return '';
  
  // Replace all HTML entities with their respective HTML tags
  return description
    .replace(/&lt;div&gt;/g, '<div>')
    .replace(/&lt;\/div&gt;/g, '</div>')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
};

interface CentralizedAIChatProps {
  teamMembers: TeamMember[];
  teamCapacity?: TeamCapacity[] | null;
  sprint?: Sprint | null;
  workItems?: WorkItem[] | null;
  adoConfig?: any;
  onTeamMemberSelect?: (member: TeamMember | null) => void;
}

const CentralizedAIChat: React.FC<CentralizedAIChatProps> = ({
  teamMembers,
  teamCapacity,
  sprint,
  workItems,
  adoConfig,
  onTeamMemberSelect
}) => {
  // State variables
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [sprintWorkItems, setSprintWorkItems] = useState<WorkItem[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [currentVisual, setCurrentVisual] = useState<'chart' | 'timeline' | 'pie' | null>(null);
  const [visualDialogOpen, setVisualDialogOpen] = useState(false);
  const [showTeamChat, setShowTeamChat] = useState<boolean>(true);
  
  // Extract base URL from the ADO config
  const adoBaseUrl = adoConfig?.organizationUrl || '';
  
  // Calculate sprint days remaining and total days
  const calculateSprintDays = (sprint: Sprint | null) => {
    if (!sprint) return { daysRemaining: 0, totalDays: 0, percentComplete: 0 };
    
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const currentDate = new Date();
    
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let daysRemaining = Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, daysRemaining);
    
    const daysElapsed = totalDays - daysRemaining;
    const percentComplete = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
    
    return { daysRemaining, totalDays, percentComplete };
  };
  
  // Use memoized sprint days calculation
  const sprintDays = useMemo(() => {
    return sprint ? calculateSprintDays(sprint) : { daysRemaining: 0, totalDays: 0, percentComplete: 0 };
  }, [sprint]);
  
  // Calculate team capacity utilization
  const calculateTeamUtilization = () => {
    if (!teamCapacity || !workItems) return { utilizationPercent: 0, assignedEffort: 0, totalCapacity: 0 };
    
    const totalCapacity = teamCapacity.reduce((sum, tc) => sum + (tc.totalCapacityForSprint || 0), 0);
    const assignedEffort = workItems.reduce((sum, item) => sum + (item.effort || 0), 0);
    const utilizationPercent = totalCapacity > 0 ? Math.min(100, Math.round((assignedEffort / totalCapacity) * 100)) : 0;     
    
    return { utilizationPercent, assignedEffort, totalCapacity };
  };
  
  // Fetch sprint work items when sprint changes
  useEffect(() => {
    const fetchSprintWorkItems = async () => {
      if (sprint?.id) {
        try {
          const items = await adoService.getSprintWorkItems(sprint.id);
          setSprintWorkItems(items);
        } catch (error) {
          console.error('Error fetching sprint work items:', error);
        }
      }
    };
    
    fetchSprintWorkItems();
  }, [sprint]);

  // Initial greeting message
  useEffect(() => {
    if (messages.length === 0) {
      // Start with no selected member to default to General Team Chat
      setSelectedMember(null);
      if (onTeamMemberSelect) {
        onTeamMemberSelect(null);
      }
      
      const greeting: ChatMessage = {
        sender: 'AI',
        text: `👋 Hello! I'm your AI Scrum Assistant. ${sprint ? 
          `We're currently in sprint "${sprint.name}" with ${sprintDays.daysRemaining} days remaining out of ${sprintDays.totalDays} days.` : 
          'I can help analyze team capacity and provide recommendations.'}\n          
You are currently in General Team Chat mode. You can ask questions about the entire team, or select a specific team member from the dropdown menu to focus on their tasks.`,
        timestamp: new Date(),
        visualType: null
      };
      setMessages([greeting]);
    }
  }, [messages.length, sprint, sprintDays, onTeamMemberSelect]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // Function to handle team member selection
  const handleMemberSelect = (member: TeamMember) => {
    setSelectedMember(member);
    // If onTeamMemberSelect callback is provided in props, call it
    if (onTeamMemberSelect) {
      onTeamMemberSelect(member);
    }
    handleMenuClose();
    
    // Add a message indicating member selection
    setMessages(prev => [...prev, {
      sender: 'System',
      text: `Focusing on team member: ${member.displayName}`,
      timestamp: new Date()
    }]);
  };

  const handleClearMemberSelection = () => {
    setSelectedMember(null);
    // If onTeamMemberSelect callback is provided in props, call it with null
    if (onTeamMemberSelect) {
      onTeamMemberSelect(null);
    }
    handleMenuClose();
    
    // Add a message indicating cleared selection with clear instructions
    setMessages(prev => [...prev, {
      sender: 'System',
      text: '✅ General Team Chat mode activated. You can now type your team-related questions in the highlighted text box below.',
      timestamp: new Date()
    }]);
    
    // Focus the input field after a short delay to give time for UI update
    setTimeout(() => {
      const inputField = document.querySelector('input[type="text"], textarea');
      if (inputField) {
        (inputField as HTMLInputElement).focus();
        // Add a temporary flash effect to the input field
        const originalBackground = (inputField as HTMLInputElement).style.backgroundColor;
        (inputField as HTMLInputElement).style.backgroundColor = '#e3f2fd';
        (inputField as HTMLInputElement).style.transition = 'background-color 1.5s';
        
        setTimeout(() => {
          (inputField as HTMLInputElement).style.backgroundColor = originalBackground;
        }, 1500);
      }
    }, 500);
  };

  const [snackbar, setSnackbar] = useState<{open: boolean, message: string, severity: 'success' | 'error'}>({
    open: false,
    message: '',
    severity: 'success'
  });
  
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    content: string;
    onConfirm: () => Promise<void>;
  }>({
    open: false,
    title: '',
    content: '',
    onConfirm: async () => {}
  });

  const handleSendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: ChatMessage = {
      sender: 'You',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      let aiResponse: ChatMessage;

      if (selectedMember) {
        // Call AI service with selected member context
        const response = await thomsonReutersOpenAIService.processMemberChat(
          inputText,
          selectedMember,
          teamCapacity?.find(tc => tc.teamMember.id === selectedMember.id) || null,
          [], // assigned tasks would go here
          [], // unassigned tasks would go here
          adoBaseUrl
        );

        // Check if the response contains any chart-related keywords to add visualization
        const hasChartRequest = inputText.toLowerCase().includes('chart') ||
                              inputText.toLowerCase().includes('graph') ||
                              inputText.toLowerCase().includes('visual');

        const visualType = hasChartRequest ? 'chart' as const : null;

        aiResponse = {
          sender: 'AI',
          text: response.text,
          timestamp: new Date(),
          adoLinks: response.adoLinks,
          autoAssignTags: response.autoAssignTags,
          autoRemoveTags: response.autoRemoveTags,
          visualType
        };
      } else {
        // Call AI service with team-level context
        console.log('Processing team-level chat...');
        
        // Log the data being sent for debugging
        console.log({
          messageLength: inputText.length,
          teamMembersCount: teamMembers?.length || 0,
          teamCapacityCount: teamCapacity?.length || 0,
          workItemsCount: workItems?.length || 0,
          hasSprint: !!sprint
        });
        
        const response = await thomsonReutersOpenAIService.processTeamChat(
          inputText,
          teamMembers || [],
          teamCapacity || null,
          workItems || [],
          sprint,
          adoBaseUrl || ''
        );
        
        console.log('Team chat response received:', response);
        
        // Check if the response contains any visualization keywords
        const hasChartRequest = inputText.toLowerCase().includes('chart') ||
                              inputText.toLowerCase().includes('graph') ||
                              inputText.toLowerCase().includes('visual');

        const visualType = hasChartRequest ? 'chart' as const : 
                          inputText.toLowerCase().includes('timeline') ? 'timeline' as const :
                          inputText.toLowerCase().includes('pie') ? 'pie' as const : null;

        aiResponse = {
          sender: 'AI',
          text: response.text,
          timestamp: new Date(),
          adoLinks: response.adoLinks || [],
          autoAssignTags: response.autoAssignTags || [],
          autoRemoveTags: response.autoRemoveTags || [],
          visualType
        };
      }

      setMessages(prev => [...prev, aiResponse]);

      // If the message contains visualization, show dialog
      if (aiResponse.visualType) {
        setCurrentVisual(aiResponse.visualType);
        setVisualDialogOpen(true);
      }
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [...prev, {
        sender: 'AI',
        text: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Task assignment functions
  const handleAssignTasks = async (taskIds: string[], memberName: string) => {
    try {
      // Extract numeric IDs from tags (remove '#' if present)
      const numericIds = taskIds.map(id => parseInt(id.replace('#', ''), 10));
      
      // Find the team member object by name
      const member = teamMembers?.find(m => 
        m.displayName.toLowerCase() === memberName.toLowerCase()
      );
      
      if (!member) {
        throw new Error(`Team member "${memberName}" not found`);
      }
      
      setConfirmDialog({
        open: true,
        title: 'Confirm Task Assignment',
        content: `Are you sure you want to assign ${numericIds.length} task(s) to ${memberName}?`,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, open: false }));
          
          // Process each task assignment in sequence
          const results = [];
          for (const id of numericIds) {
            try {
              const result = await adoService.updateWorkItem(id, {
                assignedTo: member.uniqueName || member.displayName
              });
              results.push({ id, success: !!result });
            } catch (error) {
              console.error(`Failed to assign task #${id}:`, error);
              results.push({ id, success: false });
            }
          }
          
          // Show success/failure message
          const successCount = results.filter(r => r.success).length;
          
          if (successCount === numericIds.length) {
            setSnackbar({
              open: true,
              message: `Successfully assigned ${successCount} task(s) to ${memberName}`,
              severity: 'success'
            });
            
            // Add a system message to the chat
            setMessages(prev => [...prev, {
              sender: 'System',
              text: `✅ Successfully assigned ${successCount} task(s) to ${memberName}`,
              timestamp: new Date()
            }]);
          } else {
            setSnackbar({
              open: true,
              message: `Assigned ${successCount} of ${numericIds.length} task(s) to ${memberName}`,
              severity: successCount > 0 ? 'success' : 'error'
            });
            
            // Add a system message to the chat
            setMessages(prev => [...prev, {
              sender: 'System',
              text: `⚠️ Assigned ${successCount} of ${numericIds.length} task(s) to ${memberName}`,
              timestamp: new Date()
            }]);
          }
        }
      });
    } catch (error) {
      console.error('Error assigning tasks:', error);
      setSnackbar({
        open: true,
        message: `Error assigning tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  };
  
  const handleRemoveTasks = async (taskIds: string[], memberName: string) => {
    try {
      // Extract numeric IDs from tags (remove '#' if present)
      const numericIds = taskIds.map(id => parseInt(id.replace('#', ''), 10));
      
      setConfirmDialog({
        open: true,
        title: 'Confirm Task Removal',
        content: `Are you sure you want to unassign ${numericIds.length} task(s) from ${memberName}?`,
        onConfirm: async () => {
          setConfirmDialog(prev => ({ ...prev, open: false }));
          
          // Process each task unassignment in sequence
          const results = [];
          for (const id of numericIds) {
            try {
              // Set assignedTo to null to unassign
              const result = await adoService.updateWorkItem(id, {
                assignedTo: null
              });
              results.push({ id, success: !!result });
            } catch (error) {
              console.error(`Failed to unassign task #${id}:`, error);
              results.push({ id, success: false });
            }
          }
          
          // Show success/failure message
          const successCount = results.filter(r => r.success).length;
          
          if (successCount === numericIds.length) {
            setSnackbar({
              open: true,
              message: `Successfully unassigned ${successCount} task(s) from ${memberName}`,
              severity: 'success'
            });
            
            // Add a system message to the chat
            setMessages(prev => [...prev, {
              sender: 'System',
              text: `✅ Successfully unassigned ${successCount} task(s) from ${memberName}`,
              timestamp: new Date()
            }]);
          } else {
            setSnackbar({
              open: true,
              message: `Unassigned ${successCount} of ${numericIds.length} task(s) from ${memberName}`,
              severity: successCount > 0 ? 'success' : 'error'
            });
            
            // Add a system message to the chat
            setMessages(prev => [...prev, {
              sender: 'System',
              text: `⚠️ Unassigned ${successCount} of ${numericIds.length} task(s) from ${memberName}`,
              timestamp: new Date()
            }]);
          }
        }
      });
    } catch (error) {
      console.error('Error unassigning tasks:', error);
      setSnackbar({
        open: true,
        message: `Error unassigning tasks: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error'
      });
    }
  };

  // Parse auto task tags and extract member name
  const parseTaskTags = (tags: string[] | undefined): { taskIds: string[], memberName?: string } => {
    if (!tags || tags.length === 0) {
      return { taskIds: [] };
    }
    
    // The last tag might contain "to Person Name" or "from Person Name"
    const lastTag = tags[tags.length - 1];
    const toMatch = lastTag.match(/to\s+(.+)$/i);
    const fromMatch = lastTag.match(/from\s+(.+)$/i);
    
    if (toMatch || fromMatch) {
      // Remove the last tag from the list of task IDs
      const taskIds = tags.slice(0, -1);
      return { 
        taskIds, 
        memberName: toMatch ? toMatch[1].trim() : fromMatch ? fromMatch[1].trim() : undefined 
      };
    }
    
    // No member name found, assume all tags are task IDs
    return { taskIds: tags };
  };
  
  const renderVisual = () => {
    if (!currentVisual) return null;

    return (
      <Box sx={{ width: '100%', height: '300px', bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {currentVisual === 'chart' && (
          <Box sx={{ textAlign: 'center' }}>
            <BarChartIcon sx={{ fontSize: 80, color: '#1976d2', mb: 2 }} />
            <Typography>
              Team Capacity Chart Visualization
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (This is a placeholder for an actual chart visualization)
            </Typography>
          </Box>
        )}
        {currentVisual === 'timeline' && (
          <Box sx={{ textAlign: 'center' }}>
            <TimelineIcon sx={{ fontSize: 80, color: '#1976d2', mb: 2 }} />
            <Typography>
              Sprint Timeline Visualization
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (This is a placeholder for a timeline visualization)
            </Typography>
          </Box>
        )}
        {currentVisual === 'pie' && (
          <Box sx={{ textAlign: 'center' }}>
            <PieChartIcon sx={{ fontSize: 80, color: '#1976d2', mb: 2 }} />
            <Typography>
              Capacity Distribution Chart
            </Typography>
            <Typography variant="caption" color="text.secondary">
              (This is a placeholder for a pie chart visualization)
            </Typography>
          </Box>
        )}
      </Box>
    );
  };

  // Render chat messages
  const renderMessages = () => {
    return messages.map((message, index) => (
      <Box
        key={index}
        sx={{
          display: 'flex',
          justifyContent: message.sender === 'You' ? 'flex-end' : 'flex-start',
          mb: 2
        }}
      >
        <Box
          sx={{
            maxWidth: '80%',
            backgroundColor: message.sender === 'You' ? '#e3f2fd' : message.sender === 'System' ? '#f5f5f5' : '#f0f8ff',
            borderRadius: 2,
            p: 2,
            position: 'relative',
            ...(message.sender === 'You' ? {
              borderTopRightRadius: 0,
            } : message.sender === 'AI' ? {
              borderTopLeftRadius: 0,
            } : {})
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            {message.sender === 'AI' && (
              <SmartToyIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
            )}
            {message.sender === 'You' && (
              <PersonIcon fontSize="small" sx={{ mr: 1, color: 'primary.main' }} />
            )}
            {message.sender === 'System' && (
              <AssignmentIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
            )}
            <Typography variant="subtitle2" color="text.secondary">
              {message.sender}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </Typography>
          </Box>
          
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {message.text}
          </Typography>
          
          {message.adoLinks && message.adoLinks.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {message.adoLinks.map((link, i) => (
                <Chip 
                  key={i}
                  label={`View Work Item ${i+1}`}
                  size="small"
                  clickable
                  color="primary"
                  variant="outlined"
                  onClick={() => window.open(link, '_blank')}
                  sx={{ mr: 1, mt: 1 }}
                />
              ))}
            </Box>
          )}
          
          {/* Task management action buttons */}
          {message.sender === 'AI' && (
            <>
              {/* Auto assign tasks button */}
              {message.autoAssignTags && message.autoAssignTags.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  {(() => {
                    const { taskIds, memberName } = parseTaskTags(message.autoAssignTags);
                    if (taskIds.length > 0 && memberName) {
                      return (
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => handleAssignTasks(taskIds, memberName)}
                          startIcon={<AssignmentIcon />}
                          sx={{ mr: 1, mt: 1 }}
                        >
                          Assign {taskIds.length} task(s) to {memberName}
                        </Button>
                      );
                    }
                    return null;
                  })()}
                </Box>
              )}

              {/* Auto remove tasks button - Hidden as per request */}
              {/* Tasks to Remove section has been removed as requested */}
            </>
          )}
          
          {message.visualType && (
            <Box sx={{ mt: 2 }}>
              {renderVisual()}
            </Box>
          )}
        </Box>
      </Box>
    ));
  };

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 2 }}>
        {/* Big prominent General Team Chat button - only show when a member is selected */}
        {selectedMember && (
          <Box sx={{ 
            width: '100%', 
            mb: 3, 
            display: 'flex', 
            justifyContent: 'center',
            backgroundColor: '#e3f2fd',
            borderRadius: 2,
            p: 2,
            border: '2px solid #1976d2'
          }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<GroupIcon />}
              onClick={handleClearMemberSelection}
              sx={{ 
                fontSize: '1.1rem',
                py: 1.5,
                px: 3,
                boxShadow: 3
              }}
            >
              Switch to General Team Chat
            </Button>
          </Box>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">{selectedMember ? 'AI Scrum Assistant' : 'General Team Chat'}</Typography>
          
          <Button
            variant="contained"
            color={selectedMember ? "primary" : "secondary"}
            size="small"
            startIcon={selectedMember ? <PersonIcon /> : <GroupIcon />}
            endIcon={<span>▼</span>}
            onClick={handleMenuOpen}
            sx={{ 
              position: 'relative',
              '&::after': !selectedMember ? {
                content: '""',
                position: 'absolute',
                right: '-8px',
                top: '-8px',
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: 'secondary.main',
                animation: 'pulse 1.5s infinite'
              } : {}
            }}
          >
            {selectedMember ? selectedMember.displayName : 'General Team Chat'}
          </Button>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem 
              onClick={handleClearMemberSelection}
              sx={{
                backgroundColor: !selectedMember ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                fontWeight: !selectedMember ? 'bold' : 'normal',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.15)',
                }
              }}
            >
              <GroupIcon fontSize="small" sx={{ mr: 1, color: 'secondary.main' }} />
              General Team Chat
            </MenuItem>
            <Divider />
            {teamMembers.map(member => (
              <MenuItem
                key={member.id}
                onClick={() => handleMemberSelect(member)}
                selected={selectedMember?.id === member.id}
              >
                <PersonIcon fontSize="small" sx={{ mr: 1 }} />
                {member.displayName}
              </MenuItem>
            ))}
          </Menu>
        </Box>
        
        <Paper 
          elevation={0} 
          sx={{ 
            flexGrow: 1, 
            mb: 2, 
            p: 2,
            overflowY: 'auto',
            bgcolor: '#fafafa',
            borderRadius: 2
          }}
        >
          {!selectedMember && (
            <Paper sx={{ p: 3, textAlign: 'center', mb: 2, backgroundColor: '#f0f7ff', border: '2px solid #1976d2', boxShadow: '0 0 8px rgba(25, 118, 210, 0.3)' }}>
              <Typography variant="h5" color="primary" gutterBottom>
                General Team Chat - Active
              </Typography>
              <Typography variant="body1" color="text.primary" sx={{ mb: 2 }}>
                You are now in team-wide discussion mode.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Ask questions about team capacity, sprint progress, or task assignments for the entire team.
              </Typography>
            </Paper>
          )}
          {renderMessages()}
          {isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </Paper>
        
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder={selectedMember ? "Ask about this team member..." : "Ask about team capacity or sprint progress..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={isLoading}
            size="small"
            sx={{ 
              mr: 1,
              '& .MuiOutlinedInput-root': !selectedMember ? {
                borderColor: '#1976d2',
                boxShadow: '0 0 5px rgba(25, 118, 210, 0.3)',
                '&:hover': {
                  borderColor: '#1976d2',
                },
                '&.Mui-focused': {
                  borderColor: '#1976d2',
                  boxShadow: '0 0 8px rgba(25, 118, 210, 0.5)',
                }
              } : {}
            }}
          />
          <Button
            variant="contained"
            color="primary"
            endIcon={<SendIcon />}
            onClick={handleSendMessage}
            disabled={isLoading || !inputText.trim()}
          >
            Send
          </Button>
        </Box>
      </CardContent>
      
      {/* Confirmation Dialog for Task Management */}
      <Dialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog(prev => ({ ...prev, open: false }))}
      >
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <Typography>{confirmDialog.content}</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog(prev => ({ ...prev, open: false }))} color="inherit">
            Cancel
          </Button>
          <Button onClick={() => confirmDialog.onConfirm()} color="primary" autoFocus>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Snackbar Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  );
};

export default CentralizedAIChat;
