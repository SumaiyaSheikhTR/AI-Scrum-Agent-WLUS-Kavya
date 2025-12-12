import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Avatar,
  Card,
  CardContent,
  Menu,
  MenuItem,
  Divider,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as SmartToyIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  ArrowDropDown as ArrowDropDownIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { TeamMember, TeamCapacity, WorkItem, Sprint } from '../../services/adoService';
import { thomsonReutersOpenAIService } from '../../services/thomsonReutersOpenAiService';

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: Date;
  adoLinks?: string[];
  autoAssignTags?: string[];
  autoRemoveTags?: string[];
  visualType?: 'chart' | 'timeline' | 'pie' | null;
}

interface EnhancedAIChatProps {
  teamMembers: TeamMember[];
  teamCapacity?: TeamCapacity[] | null;
  sprint?: Sprint | null;
  workItems?: WorkItem[] | null;
  adoBaseUrl: string;
}

const EnhancedAIChat: React.FC<EnhancedAIChatProps> = ({
  teamMembers,
  teamCapacity,
  sprint,
  workItems,
  adoBaseUrl
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  // Removed unused state
  const [memberMenuAnchorEl, setMemberMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  // Quick prompt options for demo
  const quickPrompts = {
    general: [
      "Give me a comprehensive overview of our current sprint progress and team performance",
      "How is our team capacity looking? Are we on track for sprint completion?",
      "Which team members have capacity for additional work this sprint?",
      "Analyze team capacity and suggest optimizations",
      "What's the business impact of our current sprint progress and team utilization?",
      "Identify any risks to our sprint delivery and suggest mitigation strategies"
    ],
    member: [
      "Tell me about {member}'s current workload and task status",
      "What tasks are currently blocking {member}'s progress?",
      "How can we optimize {member}'s work distribution?",
      "Show me {member}'s high priority tasks and completion status"
    ],
    assignment: [
      "There is an adhoc critical priority bug, whom should I assign to?",
      "Show me unassigned items and recommend optimal assignments",
      "Help me prioritize our remaining work items for maximum sprint success",
      "Check our sprint compliance - are there any parent work items missing comments?"
    ]
  };
  
  // Calculate sprint days remaining and total days
  const calculateSprintDays = (sprint: Sprint | null) => {
    if (!sprint) return { daysRemaining: 0, totalDays: 0 };
    
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const currentDate = new Date();
    
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    let daysRemaining = Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
    daysRemaining = Math.max(0, daysRemaining);
    
    return { daysRemaining, totalDays };
  };
  
  const sprintDays = sprint ? calculateSprintDays(sprint) : { daysRemaining: 0, totalDays: 0 };

  // Initial greeting message
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = {
        sender: 'AI',
        text: `Hello! I'm your AI Scrum Assistant. ${sprint ? 
          `We're currently in sprint "${sprint.name}" with ${sprintDays.daysRemaining} days remaining out of ${sprintDays.totalDays} days.` : 
          'I can help analyze team capacity and provide recommendations.'}
          
What would you like to know about your team today?
        
You can:
• Get overall team capacity overview
• Select a team member to focus on their tasks
• Ask about sprint progress and status`,
        timestamp: new Date(),
        visualType: null
      };
      setMessages([greeting]);
    }
  }, [messages.length, sprint, sprintDays.daysRemaining, sprintDays.totalDays]);

  // Handle member menu
  const handleMemberMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMemberMenuAnchorEl(event.currentTarget);
  };

  const handleMemberMenuClose = () => {
    setMemberMenuAnchorEl(null);
  };

  const handleMemberSelect = (member: TeamMember) => {
    setSelectedMember(member);
    handleMemberMenuClose();
    
    // Add a message showing sprint and task information for the selected member
    setMessages(prev => [
      ...prev, 
      {
        sender: 'System',
        text: `Focusing on team member: ${member.displayName}`,
        timestamp: new Date()
      }
    ]);
    
    // Generate a summary of the member's tasks and status
    generateMemberSummary(member);
  };

  const handleClearMemberSelection = () => {
    setSelectedMember(null);
    handleMemberMenuClose();
    
    // Add a message indicating cleared selection
    setMessages(prev => [
      ...prev, 
      {
        sender: 'System',
        text: 'Now focusing on the entire team',
        timestamp: new Date()
      }
    ]);
    
    // Generate a summary of the team's sprint status
    generateTeamSummary();
  };

  const generateMemberSummary = async (member: TeamMember) => {
    if (!workItems) return;
    
    setIsLoading(true);
    
    // Filter work items for the selected member
    const memberItems = workItems.filter(item => 
      item.assignedTo === member.id || 
      (typeof item.assignedTo === 'string' && item.assignedTo.includes(member.displayName))
    );
    
    // Get the member's capacity
    const memberCapacityData = teamCapacity?.find(tc => tc.teamMember.id === member.id);
    
    try {
      // Get AI response for member summary
      const response = await thomsonReutersOpenAIService.processMemberChat(
        `Provide a summary of tasks and capacity for ${member.displayName}`,
        member,
        memberCapacityData || null,
        memberItems,
        workItems.filter(item => !item.assignedTo),
        adoBaseUrl
      );
      
      setMessages(prev => [
        ...prev, 
        {
          sender: 'AI',
          text: response.text,
          timestamp: new Date(),
          adoLinks: response.adoLinks,
          autoAssignTags: response.autoAssignTags,
          autoRemoveTags: response.autoRemoveTags
        }
      ]);
    } catch (error) {
      console.error('Error generating member summary:', error);
      setMessages(prev => [
        ...prev, 
        {
          sender: 'AI',
          text: `I couldn't retrieve information for ${member.displayName} at this time. Please try again later.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateTeamSummary = async () => {
    if (!sprint) return;
    
    setIsLoading(true);
    
    try {
      // Create a simple team summary based on available data
      const totalMembers = teamMembers.length;
      const totalWorkItems = workItems?.length || 0;
      const completedItems = workItems?.filter(item => item.state === 'Completed' || item.state === 'Done').length || 0;
      const percentComplete = totalWorkItems > 0 ? Math.round((completedItems / totalWorkItems) * 100) : 0;
      
      const teamSummary = {
        sender: 'AI',
        text: `# Sprint "${sprint.name}" Overview\n\n` +
              `**Team Status:**\n` +
              `• ${totalMembers} team members\n` +
              `• ${totalWorkItems} total work items\n` +
              `• ${completedItems} completed (${percentComplete}% done)\n` +
              `• ${sprintDays.daysRemaining} days remaining out of ${sprintDays.totalDays}\n\n` +
              `**Team members by capacity utilization:**\n` +
              generateTeamCapacityList(),
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, teamSummary]);
    } catch (error) {
      console.error('Error generating team summary:', error);
      setMessages(prev => [
        ...prev, 
        {
          sender: 'AI',
          text: `I couldn't retrieve the team summary at this time. Please try again later.`,
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const generateTeamCapacityList = () => {
    if (!teamCapacity) return "No capacity data available";
    
    // Sort team members by capacity utilization
    const sortedMembers = [...teamCapacity].sort((a, b) => {
      // Calculate utilization percentage
      const aUtilization = calculateUtilization(a);
      const bUtilization = calculateUtilization(b);
      return bUtilization - aUtilization;
    });
    
    return sortedMembers.map(tc => {
      const utilization = calculateUtilization(tc);
      const status = utilization > 100 ? '🔴' : utilization > 80 ? '🟡' : '🟢';
      return `${status} ${tc.teamMember.displayName}: ${utilization.toFixed(0)}%`;
    }).join('\n');
  };
  
  const calculateUtilization = (capacity: TeamCapacity) => {
    if (!capacity || !capacity.totalCapacityPerDay || !capacity.totalAvailableCapacity) return 0;
    
    // Calculate based on available capacity
    const totalCapacity = capacity.totalCapacityForSprint || capacity.totalAvailableCapacity;
    
    // Get assigned effort for this member
    const memberItems = workItems?.filter(item => 
      item.assignedTo === capacity.teamMember.id || 
      (typeof item.assignedTo === 'string' && item.assignedTo.includes(capacity.teamMember.displayName))
    ) || [];
    
    const totalEffort = memberItems.reduce((sum, item) => sum + (item.effort || 0), 0);
    
    return totalCapacity > 0 ? (totalEffort / totalCapacity) * 100 : 0;
  };

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
        // Filter work items for the selected member if we have them
        const memberItems = workItems?.filter(item => 
          item.assignedTo === selectedMember.id || 
          (typeof item.assignedTo === 'string' && item.assignedTo.includes(selectedMember.displayName))
        ) || [];
        
        // Get the member's capacity
        const memberCapacityData = teamCapacity?.find(tc => tc.teamMember.id === selectedMember.id);
        
        // Call AI service with selected member context
        const response = await thomsonReutersOpenAIService.processMemberChat(
          inputText,
          selectedMember,
          memberCapacityData || null,
          memberItems,
          workItems?.filter(item => !item.assignedTo) || [],
          adoBaseUrl
        );
        
        aiResponse = {
          sender: 'AI',
          text: response.text,
          timestamp: new Date(),
          adoLinks: response.adoLinks,
          autoAssignTags: response.autoAssignTags,
          autoRemoveTags: response.autoRemoveTags
        };
      } else {
        // Team-level response
        // This is a simplified version. In a real implementation, you would
        // call a specific method for team-level analysis
        aiResponse = {
          sender: 'AI',
          text: `Team-level analysis for sprint "${sprint?.name}":\n\n` +
                `Based on current data, the team has ${workItems?.length || 0} work items, ` +
                `with ${workItems?.filter(i => i.state === 'Completed' || i.state === 'Done').length || 0} completed.\n\n` +
                `${sprintDays.daysRemaining || 0} days remaining in the sprint.\n\n` +
                `Would you like to focus on a specific team member for more detailed insights?`,
          timestamp: new Date()
        };
      }
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error getting AI response:', error);
      setMessages(prev => [
        ...prev, 
        {
          sender: 'AI',
          text: 'Sorry, I encountered an error processing your request. Please try again later.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick prompt selection
  const handleQuickPrompt = (prompt: string) => {
    // Replace {member} placeholder with actual member name if applicable
    const finalPrompt = selectedMember 
      ? prompt.replace('{member}', selectedMember.displayName)
      : prompt;
    
    setInputText(finalPrompt);
    
    // Auto-send the message after a short delay to show it in the input field first
    setTimeout(() => {
      if (finalPrompt.trim()) {
        // Trigger the same logic as handleSendMessage
        const userMessage: ChatMessage = {
          sender: 'You',
          text: finalPrompt,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);
        
        // Process the quick prompt
        processQuickPrompt(finalPrompt);
      }
    }, 300);
  };

  // Process quick prompt message (same logic as handleSendMessage)
  const processQuickPrompt = async (promptText: string) => {
    try {
      let aiResponse: ChatMessage;
      
      if (selectedMember) {
        // Filter work items for the selected member if we have them
        const memberItems = workItems?.filter(item => 
          item.assignedTo === selectedMember.id || 
          (typeof item.assignedTo === 'string' && item.assignedTo.includes(selectedMember.displayName))
        ) || [];
        
        // Get the member's capacity
        const memberCapacityData = teamCapacity?.find(tc => tc.teamMember.id === selectedMember.id);
        
        // Call AI service with selected member context
        const response = await thomsonReutersOpenAIService.processMemberChat(
          promptText,
          selectedMember,
          memberCapacityData || null,
          memberItems,
          workItems?.filter(item => !item.assignedTo) || [],
          adoBaseUrl
        );
        
        aiResponse = {
          sender: 'AI',
          text: response.text,
          timestamp: new Date(),
          adoLinks: response.adoLinks,
          autoAssignTags: response.autoAssignTags,
          autoRemoveTags: response.autoRemoveTags
        };
      } else {
        // Team-level response
        aiResponse = {
          sender: 'AI',
          text: `Team-level analysis for sprint "${sprint?.name}":\n\n` +
                `Based on current data, the team has ${workItems?.length || 0} work items, ` +
                `with ${workItems?.filter(i => i.state === 'Completed' || i.state === 'Done').length || 0} completed.\n\n` +
                `${sprintDays.daysRemaining || 0} days remaining in the sprint.\n\n` +
                `Would you like to focus on a specific team member for more detailed insights?`,
          timestamp: new Date()
        };
      }
      
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('Error processing quick prompt:', error);
      setMessages(prev => [
        ...prev, 
        {
          sender: 'AI',
          text: 'Sorry, I encountered an error processing your request. Please try again later.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const parseHtmlContent = (content: string) => {
    // Simple function to convert certain HTML-like elements to React components
    // For a production app, you'd want a more robust solution like a markdown parser
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const renderChatMessage = (msg: ChatMessage, idx: number) => {
    const isUserMessage = msg.sender === 'You';
    const isSystemMessage = msg.sender === 'System';
    
    // Special styling for system messages
    if (isSystemMessage) {
      return (
        <Box key={idx} sx={{ 
          textAlign: 'center', 
          py: 1, 
          px: 2, 
          my: 1,
          mx: 'auto',
          borderRadius: 2,
          backgroundColor: 'rgba(0,0,0,0.04)',
          maxWidth: '80%'
        }}>
          <Typography variant="body2" color="text.secondary">
            {msg.text}
          </Typography>
        </Box>
      );
    }
    
    return (
      <Box key={idx} sx={{ mb: 2 }}>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'flex-start',
          justifyContent: isUserMessage ? 'flex-end' : 'flex-start' 
        }}>
          {!isUserMessage && (
            <Avatar sx={{ 
              width: 32, 
              height: 32, 
              mr: 1, 
              bgcolor: '#9c27b0',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
            }}>
              <SmartToyIcon fontSize="small" />
            </Avatar>
          )}
          <Box sx={{ 
            background: isUserMessage ? '#e3f2fd' : 'white', 
            borderRadius: '18px', 
            px: 2, 
            py: 1.5, 
            maxWidth: '75%',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: isUserMessage ? '1px solid #bbdefb' : '1px solid #e0e0e0'
          }}>
            <Typography 
              variant="body2" 
              color={isUserMessage ? 'primary' : 'text.primary'}
              sx={{ 
                whiteSpace: 'pre-wrap', 
                '& code': {
                  backgroundColor: '#f5f5f5',
                  padding: '2px 4px',
                  borderRadius: '3px',
                  fontFamily: 'monospace',
                  fontSize: '0.85em'
                }
              }}
            >
              {parseHtmlContent(msg.text)}
            </Typography>
          </Box>
          {isUserMessage && (
            <Avatar sx={{ 
              width: 32, 
              height: 32, 
              ml: 1, 
              bgcolor: '#1976d2',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)' 
            }}>
              <PersonIcon fontSize="small" />
            </Avatar>
          )}
        </Box>
        
        {/* Show ADO links if available */}
        {msg.adoLinks && msg.adoLinks.length > 0 && (
          <Box sx={{ mt: 1, ml: isUserMessage ? 0 : 5, mr: isUserMessage ? 5 : 0, textAlign: isUserMessage ? 'right' : 'left' }}>
            <Box sx={{ 
              display: 'inline-flex', 
              flexWrap: 'wrap', 
              gap: 0.5, 
              justifyContent: isUserMessage ? 'flex-end' : 'flex-start'
            }}>
              {msg.adoLinks.map((link, linkIdx) => (
                <Button 
                  key={linkIdx}
                  href={link}
                  target="_blank"
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<AssignmentIcon fontSize="small" />}
                  sx={{ 
                    fontSize: '0.7rem', 
                    py: 0.3, 
                    px: 0.8, 
                    borderRadius: '16px',
                    textTransform: 'none',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                  }}
                >
                  #{link.split('/').pop()}
                </Button>
              ))}
            </Box>
          </Box>
        )}
        
        {/* Show auto assign tags if available */}
        {msg.autoAssignTags && msg.autoAssignTags.length > 0 && (
          <Box sx={{ mt: 1, ml: isUserMessage ? 0 : 5, mr: isUserMessage ? 5 : 0, textAlign: isUserMessage ? 'right' : 'left' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'success.main', display: 'block', mb: 0.5 }}>
              Automatic Assignment Tags:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {msg.autoAssignTags.map((tag, tagIdx) => {
                // Extract the task ID from tag (remove # if present)
                const taskId = tag.replace('#', '');
                // Get organization from ADO config
                const adoConfig = localStorage.getItem('adoConfig') ? 
                  JSON.parse(localStorage.getItem('adoConfig') || '{}') : {};
                const organization = adoConfig.organization || '';
                const url = `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
                
                return (
                  <Button 
                    key={tagIdx}
                    href={url}
                    target="_blank"
                    variant="outlined"
                    color="success"
                    size="small"
                    startIcon={<AssignmentIcon fontSize="small" />}
                    sx={{ 
                      fontSize: '0.7rem',
                      py: 0.3,
                      px: 0.8,
                      borderRadius: '16px',
                      textTransform: 'none'
                    }}
                  >
                    #{taskId}
                  </Button>
                );
              })}
            </Box>
          </Box>
        )}
        
        {/* Show auto remove tags if available */}
        {msg.autoRemoveTags && msg.autoRemoveTags.length > 0 && (
          <Box sx={{ mt: 1, ml: isUserMessage ? 0 : 5, mr: isUserMessage ? 5 : 0, textAlign: isUserMessage ? 'right' : 'left' }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: 'error.main', display: 'block', mb: 0.5 }}>
              Automatic Removal Tags:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {msg.autoRemoveTags.map((tag, tagIdx) => {
                // Extract the task ID from tag (remove # if present)
                const taskId = tag.replace('#', '');
                // Get organization from ADO config
                const adoConfig = localStorage.getItem('adoConfig') ? 
                  JSON.parse(localStorage.getItem('adoConfig') || '{}') : {};
                const organization = adoConfig.organization || '';
                const url = `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
                
                return (
                  <Button 
                    key={tagIdx}
                    href={url}
                    target="_blank"
                    variant="outlined"
                    color="error"
                    size="small"
                    startIcon={<AssignmentIcon fontSize="small" />}
                    sx={{ 
                      fontSize: '0.7rem',
                      py: 0.3,
                      px: 0.8,
                      borderRadius: '16px',
                      textTransform: 'none'
                    }}
                  >
                    #{taskId}
                  </Button>
                );
              })}
            </Box>
          </Box>
        )}
      </Box>
    );
  };

  return (
    <Paper elevation={2} sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ 
        p: 2, 
        borderBottom: '1px solid #e0e0e0',
        backgroundColor: '#f5f5f5',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SmartToyIcon sx={{ mr: 1.5, color: '#9c27b0' }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>AI Scrum Assistant</Typography>
        </Box>
        
        <Box>
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={selectedMember ? <PersonIcon /> : <GroupIcon />}
            endIcon={<ArrowDropDownIcon />}
            onClick={handleMemberMenuOpen}
            sx={{ textTransform: 'none' }}
          >
            {selectedMember ? selectedMember.displayName : 'Team View'}
          </Button>
          
          <Menu
            anchorEl={memberMenuAnchorEl}
            open={Boolean(memberMenuAnchorEl)}
            onClose={handleMemberMenuClose}
          >
            <MenuItem onClick={handleClearMemberSelection}>
              <GroupIcon fontSize="small" sx={{ mr: 1 }} />
              Team View
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
      </Box>
      
      {/* Messages Container */}
      <Box sx={{ 
        p: 2, 
        flexGrow: 1, 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f9f9f9'
      }}>
        {messages.map(renderChatMessage)}
        
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} sx={{ mr: 1.5, color: '#9c27b0' }} />
            <Typography variant="body2" sx={{ color: '#666' }}>AI is thinking...</Typography>
          </Box>
        )}
      </Box>
      
      {/* Quick Prompts Section */}
      <Box sx={{ 
        px: 2, 
        py: 1,
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#f8f9fa'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>
            💡 Quick Questions
          </Typography>
          <IconButton 
            size="small" 
            onClick={() => setShowQuickPrompts(!showQuickPrompts)}
            sx={{ p: 0.5 }}
          >
            {showQuickPrompts ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Box>
        
        <Collapse in={showQuickPrompts}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {/* Show different prompts based on context */}
            {selectedMember ? (
              // Member-specific prompts
              quickPrompts.member.slice(0, 4).map((prompt, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  size="small"
                  onClick={() => handleQuickPrompt(prompt)}
                  disabled={isLoading}
                  sx={{
                    fontSize: '0.7rem',
                    textTransform: 'none',
                    borderRadius: '12px',
                    px: 1,
                    py: 0.5,
                    backgroundColor: '#fff',
                    '&:hover': {
                      backgroundColor: '#e3f2fd'
                    }
                  }}
                >
                  {prompt.replace('{member}', selectedMember.displayName).length > 50 
                    ? prompt.replace('{member}', selectedMember.displayName).substring(0, 47) + '...'
                    : prompt.replace('{member}', selectedMember.displayName)
                  }
                </Button>
              ))
            ) : (
              // General team prompts + assignment prompts
              [...quickPrompts.general.slice(0, 3), ...quickPrompts.assignment.slice(0, 3)].map((prompt, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  size="small"
                  onClick={() => handleQuickPrompt(prompt)}
                  disabled={isLoading}
                  sx={{
                    fontSize: '0.7rem',
                    textTransform: 'none',
                    borderRadius: '12px',
                    px: 1,
                    py: 0.5,
                    backgroundColor: '#fff',
                    '&:hover': {
                      backgroundColor: '#e3f2fd'
                    }
                  }}
                >
                  {prompt.length > 60 ? prompt.substring(0, 57) + '...' : prompt}
                </Button>
              ))
            )}
          </Box>
        </Collapse>
      </Box>
      
      {/* Input Area */}
      <Box sx={{ 
        p: 2, 
        borderTop: '1px solid #e0e0e0',
        backgroundColor: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: 1
      }}>
        <TextField
          fullWidth
          placeholder={selectedMember 
            ? `Ask about ${selectedMember.displayName}'s tasks and capacity...` 
            : "Ask about the sprint status or team capacity..."}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          variant="outlined"
          size="small"
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px',
              backgroundColor: '#f9fafc',
            }
          }}
        />
        <Button
          variant="contained"
          color="primary"
          disabled={isLoading || !inputText.trim()}
          onClick={handleSendMessage}
          endIcon={<SendIcon />}
          sx={{
            borderRadius: '20px',
            boxShadow: 'none',
            textTransform: 'none',
            px: 2
          }}
        >
          Send
        </Button>
      </Box>
      
      {/* Sprint Status Card */}
      {sprint && (
        <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0', backgroundColor: '#f5f5f5' }}>
          <Card variant="outlined" sx={{ backgroundColor: '#fff' }}>
            <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Sprint: <strong>{sprint.name}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {sprintDays.daysRemaining} days remaining
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Box>
      )}
    </Paper>
  );
};

export default EnhancedAIChat;
