import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Avatar,
  Chip,
  Grid,
  Card,
  CardContent,
  LinearProgress
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as SmartToyIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
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
  let processed = description
    .replace(/&lt;div&gt;/g, '<div>')
    .replace(/&lt;\/div&gt;/g, '</div>')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  
  // Convert markdown tables to HTML tables for better rendering
  processed = processed.replace(/\n\|(.*)\|\n\|([-\s|]+)\|\n/g, (match, headers, separator) => {
    const headerCells = headers.split('|').map((cell: string) => `<th>${cell.trim()}</th>`).join('');
    return `<table class="ai-table"><thead><tr>${headerCells}</tr></thead><tbody>`;
  });
  
  processed = processed.replace(/\|(.*)\|\n/g, (match, cells) => {
    if (cells.includes('---')) return match; // Skip separator row
    const rowCells = cells.split('|').map((cell: string) => `<td>${cell.trim()}</td>`).join('');
    return `<tr>${rowCells}</tr>\n`;
  });
  
  processed = processed.replace(/<\/tbody><\/table>\n\|/g, '</tbody></table>\n|');
  processed = processed.replace(/\n<\/tr>\n(?!\|)/g, '\n</tr></tbody></table>\n');
  
  return processed;
};

interface CentralizedAgenticChatProps {
  teamMembers: TeamMember[];
  teamCapacity?: TeamCapacity[] | null;
  sprint?: Sprint | null;
  workItems?: WorkItem[] | null;
  adoBaseUrl?: string;
  adoConfig?: any;
}

const CentralizedAgenticChat: React.FC<CentralizedAgenticChatProps> = ({
  teamMembers,
  teamCapacity,
  sprint,
  workItems,
  adoBaseUrl,
  adoConfig
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [sprintWorkItems, setSprintWorkItems] = useState<WorkItem[]>([]);

  // Calculate sprint days remaining and total days
  const sprintDays = useMemo(() => {
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
  }, [sprint]);

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
      const greeting = "👋 Hello! I'm your AI Scrum Assistant. " + 
        (sprint ? 
          `We're currently in sprint "${sprint.name}" with ${sprintDays.daysRemaining} days remaining out of ${sprintDays.totalDays} days.` : 
          'I can help analyze team capacity and provide recommendations.') +
        "\n\nPlease select a team member below to view their tasks and provide assistance. I can help with:" +
        "\n\n- Analyzing work items and capacity" +
        "\n- Suggesting task reassignments" +
        "\n- Providing sprint progress updates" +
        "\n- Identifying potential bottlenecks" +
        "\n- Generating reports and visualizations" +
        "\n- Tracking burndown and velocity metrics";
      
      setMessages([{
        sender: 'AI',
        text: greeting,
        timestamp: new Date(),
        visualType: null
      }]);
    }
  }, [messages.length, sprint, sprintDays]);
// Removed duplicate and misplaced lines

  // Handle member selection
  const handleMemberSelect = async (member: TeamMember) => {
    setSelectedMember(member);
    setIsLoading(true);
    
    try {
      // Get member's work items
      const memberItems = sprintWorkItems.filter(item => {
        if (!item.assignedTo) return false;
        
        // Handle the case where assignedTo is a string
        if (typeof item.assignedTo === 'string') {
          return item.assignedTo === member.id || 
                 item.assignedTo.includes(member.displayName);
        }
        
        // Handle the case where assignedTo might be an object
        const assignedToObj = item.assignedTo as any;
        return assignedToObj.id === member.id || 
               assignedToObj.displayName === member.displayName;
      });
      
      // Get member's capacity
      const memberCapacity = teamCapacity?.find(tc => tc.teamMember.id === member.id);
      const capacityValue = memberCapacity?.totalCapacityPerDay || 0;
      const assignedEffort = memberItems.reduce((sum, item) => sum + (item.effort || 0), 0);
      const utilizationPercent = capacityValue > 0 ? Math.min(100, Math.round((assignedEffort / capacityValue) * 100)) : 0;
      
      // Categorize tasks by state
      const activeTasks = memberItems.filter(item => item.state === 'Active' || item.state === 'In Progress');
      const completedTasks = memberItems.filter(item => item.state === 'Closed' || item.state === 'Completed' || item.state === 'Done');
      const newTasks = memberItems.filter(item => 
        item.state === 'New' || item.state === 'To Do' || 
        (!activeTasks.includes(item) && !completedTasks.includes(item))
      );
      
      // Generate task overview text
      let taskOverview = "Sprint Overview for " + member.displayName + "\n\n";
      
      // Add sprint info
      taskOverview += sprint ? 
        "Sprint: \"" + sprint.name + "\" (" + sprintDays.daysRemaining + " days remaining)\n\n" : 
        "No active sprint\n\n";
      
      // Add capacity details
      taskOverview += "Capacity: " + capacityValue + " hours\n";
      taskOverview += "Assigned: " + assignedEffort + " hours\n";
      taskOverview += "Utilization: " + utilizationPercent + "%\n";
      taskOverview += "Completed Tasks: " + completedTasks.length + "/" + memberItems.length + "\n\n";
      
      // Add task summary
      taskOverview += "Task Summary:\n";
      taskOverview += "- Active Tasks: " + activeTasks.length + " (" + 
        activeTasks.reduce((sum, item) => sum + (item.effort || 0), 0) + " hrs)\n";
      taskOverview += "- New Tasks: " + newTasks.length + " (" + 
        newTasks.reduce((sum, item) => sum + (item.effort || 0), 0) + " hrs)\n";
      taskOverview += "- Completed: " + completedTasks.length + " (" + 
        completedTasks.reduce((sum, item) => sum + (item.effort || 0), 0) + " hrs)\n\n";
      
      // Add active tasks if any
      if (activeTasks.length > 0) {
        taskOverview += "Active Tasks:\n";
        activeTasks.forEach(item => {
          // WorkItem does not have remainingWork property, fallback to empty string
          const remainingText = "";
          taskOverview += "- " + item.title + " (" + (item.effort || 0) + " hrs" + remainingText + ")\n";
        });
        taskOverview += "\n";
      }
      
      // Add final question
      if (memberItems.length > 0) {
        taskOverview += "How would you like me to help with " + member.displayName + "'s tasks today?";
      } else {
        taskOverview += member.displayName + " has no work items assigned for this sprint. Would you like me to suggest some tasks that could be assigned?";
      }
      
      // Generate member-specific message
      const memberMessage = {
        sender: 'AI',
        text: taskOverview,
        timestamp: new Date(),
        visualType: null
      };
      
      setMessages(prev => [...prev, memberMessage]);
    } catch (error) {
      console.error('Error loading member details:', error);
      
      // Add error message
      setMessages(prev => [...prev, {
        sender: 'AI',
        text: "I'm sorry, I encountered an error while retrieving information for " + member.displayName + ". Please try again.",
        timestamp: new Date(),
        visualType: null
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle chat input submission
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    
    // Add user message
    const userMessage: ChatMessage = {
      sender: 'User',
      text: inputText,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);
    
    try {
      // Build ADO base URL from config
      const baseUrl = adoBaseUrl || '';
      
      // Get member's work items
      let memberItems: WorkItem[] = [];
      let unassignedItems: WorkItem[] = [];
      
      if (selectedMember) {
        memberItems = sprintWorkItems.filter(item => {
          if (!item.assignedTo) return false;
          
          if (typeof item.assignedTo === 'string') {
            return item.assignedTo === selectedMember.id || 
                   item.assignedTo.includes(selectedMember.displayName);
          }
          
          const assignedToObj = item.assignedTo as any;
          return assignedToObj.id === selectedMember.id || 
                 assignedToObj.displayName === selectedMember.displayName;
        });
        
        unassignedItems = sprintWorkItems.filter(item => !item.assignedTo);
      }
      
      // Get member's capacity
      const memberCapacity = selectedMember 
        ? teamCapacity?.find(tc => tc.teamMember.id === selectedMember.id) 
        : null;
      
      // Process chat with AI service
      const response = await thomsonReutersOpenAIService.processMemberChat(
  inputText,
  selectedMember ? selectedMember : { displayName: '', uniqueName: '', id: '', imageUrl: '' },
        memberCapacity || null,
        memberItems,
        unassignedItems,
        baseUrl
      );
      
      // Format response to include task categorization if relevant
      let formattedResponse = response.text;
      
      // If response mentions tasks and we have data, enhance with task summary
      if (
        (response.text.includes("task") || response.text.includes("work item") || inputText.includes("show tasks")) && 
        memberItems.length > 0
      ) {
        // Categorize tasks
        const highPriorityTasks = memberItems.filter(item => {
          // Handle both number and string types for priority
          const priority = item.priority !== null ? String(item.priority).toLowerCase() : '';
          return priority === '1' || priority === 'high' || item.state === 'Active';
        });
        const completedTasks = memberItems.filter(item => 
          item.state === 'Closed' || item.state === 'Completed' || item.state === 'Done'
        );
        const pendingTasks = memberItems.filter(item => 
          !completedTasks.includes(item) && !highPriorityTasks.includes(item)
        );
        
        // Create task summary table
        const taskSummary = 
          "\n\n### Task Summary for " + selectedMember?.displayName + "\n\n" +
          "| Category | Count | Effort |\n" +
          "|----------|-------|--------|\n" +
          "| High Priority | " + highPriorityTasks.length + " | " + 
            highPriorityTasks.reduce((sum, item) => sum + (item.effort || 0), 0) + " hrs |\n" +
          "| Pending | " + pendingTasks.length + " | " + 
            pendingTasks.reduce((sum, item) => sum + (item.effort || 0), 0) + " hrs |\n" +
          "| Completed | " + completedTasks.length + " | " + 
            completedTasks.reduce((sum, item) => sum + (item.effort || 0), 0) + " hrs |\n" +
          "| **Total** | **" + memberItems.length + "** | **" + 
            memberItems.reduce((sum, item) => sum + (item.effort || 0), 0) + " hrs** |\n\n" +
          "### Task Details\n\n";
        
        if (highPriorityTasks.length > 0) {
          const highPriorityList = "**High Priority Tasks:**\n" + 
            highPriorityTasks.map(item => "- " + item.title + " (" + (item.effort || 0) + " hrs)").join("\n");
          formattedResponse = formattedResponse + taskSummary + highPriorityList;
        } else {
          formattedResponse = formattedResponse + taskSummary;
        }
        
        if (pendingTasks.length > 0 && !formattedResponse.includes("Pending Tasks")) {
          const pendingList = "\n\n**Pending Tasks:**\n" + 
            pendingTasks.map(item => "- " + item.title + " (" + (item.effort || 0) + " hrs)").join("\n");
          formattedResponse = formattedResponse + pendingList;
        }
      }
      
      // Add AI response
      const aiResponse: ChatMessage = {
        sender: 'AI',
        text: formattedResponse,
        timestamp: new Date(),
        adoLinks: response.adoLinks,
        autoAssignTags: response.autoAssignTags,
        autoRemoveTags: response.autoRemoveTags
      };
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error processing message:', error);
      
      // Add error message
      setMessages(prev => [...prev, {
        sender: 'AI',
        text: 'I apologize, but I encountered an error while processing your request. Please try again.',
        timestamp: new Date(),
        visualType: null
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      overflow: 'hidden',
      borderRadius: 2
    }}>
      {/* Header with sprint info */}
      <Box sx={{ 
        p: 2, 
        backgroundColor: '#f5f5f5', 
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center' }}>
            <SmartToyIcon sx={{ mr: 1 }} />
            Agentic AI Assistant
          </Typography>
          {sprint && (
            <Typography variant="body2" color="text.secondary">
              Sprint: {sprint.name} • {sprintDays.daysRemaining} days remaining ({sprintDays.percentComplete}% complete)
            </Typography>
          )}
        </Box>
        {selectedMember && (
          <Chip 
            avatar={<Avatar>{selectedMember.displayName.charAt(0)}</Avatar>}
            label={selectedMember.displayName}
            color="primary"
            variant="outlined"
            onDelete={() => setSelectedMember(null)}
          />
        )}
      </Box>
      
      {/* Sprint progress bar */}
      {sprint && (
        <LinearProgress 
          variant="determinate" 
          value={sprintDays.percentComplete} 
          sx={{ height: 4 }}
        />
      )}
      
      {/* Team members selection section */}
      {!selectedMember && (
        <Box sx={{ p: 2 }}>
          {/* GENERAL TEAM CHAT BUTTON */}
          <Box sx={{ 
            width: '100%', 
            mb: 3, 
            display: 'flex', 
            justifyContent: 'center',
            backgroundColor: '#f0f7ff', 
            borderRadius: 2,
            p: 3,
            border: '2px solid #1976d2',
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
          }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<GroupIcon />}
              fullWidth
              sx={{ 
                fontSize: '1.2rem',
                py: 2,
                fontWeight: 'bold',
                textTransform: 'none'
              }}
              onClick={() => {
                // Keep selectedMember as null for General Team Chat
                // Just add a message to indicate it's being used
                setMessages(prev => [...prev, {
                  sender: 'System',
                  text: 'Using General Team Chat mode for team-wide analysis.',
                  timestamp: new Date()
                }]);
              }}
            >
              General Team Chat
            </Button>
          </Box>
          
          <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <GroupIcon fontSize="small" sx={{ mr: 1 }} />
            Select a Team Member:
          </Typography>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {teamMembers.map(member => (
              <Grid item key={member.id} xs={12} sm={6} md={4} lg={3}>
                <Card 
                  variant="outlined" 
                  sx={{ 
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': {
                      boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                      transform: 'translateY(-2px)'
                    }
                  }}
                  onClick={() => handleMemberSelect(member)}
                >
                  <CardContent sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    p: '12px !important'
                  }}>
                    <Avatar sx={{ mr: 1, bgcolor: '#1976d2' }}>
                      {member.displayName.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {member.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {teamCapacity?.find(tc => tc.teamMember.id === member.id)?.totalCapacityPerDay || 0} hrs capacity
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}
      
      {/* Chat messages area */}
      <Box sx={{ 
        flexGrow: 1, 
        overflowY: 'auto', 
        p: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}>
        {messages.map((message, index) => (
          <Box 
            key={index} 
            sx={{ 
              alignSelf: message.sender === 'User' ? 'flex-end' : 'flex-start',
              maxWidth: '80%'
            }}
          >
            <Box sx={{
              bgcolor: message.sender === 'User' ? '#e3f2fd' : '#fff',
              borderRadius: 2,
              p: 2,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid',
              borderColor: message.sender === 'User' ? '#bbdefb' : '#e0e0e0'
            }}>
              <Typography 
                variant="body2" 
                component="div"
                sx={{ 
                  whiteSpace: 'pre-wrap',
                  '& a': { color: '#1976d2', textDecoration: 'none' },
                  '& a:hover': { textDecoration: 'underline' },
                  '& p': { margin: '0.5em 0' },
                  '& ul, & ol': { paddingLeft: 2, margin: '0.5em 0' },
                  '& strong, & b': { fontWeight: 600 },
                  '& .ai-table': { 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    margin: '1em 0' 
                  },
                  '& .ai-table th': {
                    backgroundColor: '#f5f5f5',
                    padding: '8px',
                    borderBottom: '2px solid #ddd',
                    textAlign: 'left',
                    fontWeight: 600
                  },
                  '& .ai-table td': {
                    padding: '8px',
                    borderBottom: '1px solid #ddd',
                    borderTop: '1px solid #ddd'
                  }
                }}
                dangerouslySetInnerHTML={{ 
                  __html: processHtmlDescription(message.text)
                }}
              />
            </Box>
            
            {/* ADO links if available */}
            {message.adoLinks && message.adoLinks.length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {message.adoLinks.map((link, linkIdx) => (
                  <Button
                    key={linkIdx}
                    href={link}
                    target="_blank"
                    variant="outlined"
                    size="small"
                    startIcon={<AssignmentIcon />}
                    sx={{ fontSize: '0.7rem' }}
                  >
                    Item #{link.split('/').pop()}
                  </Button>
                ))}
              </Box>
            )}
          </Box>
        ))}
        
        {isLoading && (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            alignSelf: 'flex-start',
            bgcolor: '#f5f5f5',
            borderRadius: 2,
            p: 2
          }}>
            <CircularProgress size={20} sx={{ mr: 1.5 }} />
            <Typography variant="body2">AI is thinking...</Typography>
          </Box>
        )}
      </Box>
      
      {/* Input area */}
      {selectedMember && (
        <Box sx={{ 
          p: 2, 
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f9f9f9',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}>
          <TextField
            fullWidth
            size="small"
            placeholder={"Ask about " + selectedMember.displayName + "'s tasks or capacity..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            multiline
            maxRows={3}
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: '24px',
                backgroundColor: '#fff'
              }
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendMessage}
            disabled={!inputText.trim() || isLoading}
            sx={{ 
              borderRadius: '24px',
              minWidth: 'unset',
              width: '48px',
              height: '48px',
              p: 0
            }}
          >
            <SendIcon />
          </Button>
        </Box>
      )}
    </Paper>
  );
};

export default CentralizedAgenticChat;
