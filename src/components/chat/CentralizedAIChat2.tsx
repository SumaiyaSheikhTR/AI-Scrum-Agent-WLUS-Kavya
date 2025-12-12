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
  Group as GroupIcon
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
}

const CentralizedAIChat: React.FC<CentralizedAIChatProps> = ({
  teamMembers,
  teamCapacity,
  sprint,
  workItems,
  adoConfig
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [sprintWorkItems, setSprintWorkItems] = useState<WorkItem[]>([]);

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
  
  // Use memoized value for sprint days to prevent unnecessary re-renders
  const sprintDays = useMemo(() => {
    return sprint ? calculateSprintDays(sprint) : { daysRemaining: 0, totalDays: 0, percentComplete: 0 };
  }, [sprint]);
  
  // Calculate team capacity utilization - commented out as it's not being used
  /*
  const calculateTeamUtilization = () => {
    if (!teamCapacity || !workItems) return { utilizationPercent: 0, assignedEffort: 0, totalCapacity: 0 };
    
    const totalCapacity = teamCapacity.reduce((sum, tc) => sum + (tc.totalCapacityForSprint || 0), 0);
    const assignedEffort = workItems.reduce((sum, item) => sum + (item.effort || 0), 0);
    const utilizationPercent = totalCapacity > 0 ? Math.min(100, Math.round((assignedEffort / totalCapacity) * 100)) : 0;
    
    return { utilizationPercent, assignedEffort, totalCapacity };
  };
  */

  // We'll use this calculation where needed rather than storing it as a variable
  // const teamUtilization = calculateTeamUtilization();

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
      const greeting = {
        sender: 'AI',
        text: `👋 Hello! I'm your AI Scrum Assistant. ${sprint ? 
          `We're currently in sprint "${sprint.name}" with ${sprintDays.daysRemaining} days remaining out of ${sprintDays.totalDays} days.` : 
          'I can help analyze team capacity and provide recommendations.'}
          
Please select a team member below to view their tasks and provide assistance. I can help with:

• Analyzing work items and capacity
• Suggesting task reassignments
• Providing sprint progress updates
• Identifying potential bottlenecks`,
        timestamp: new Date(),
        visualType: null
      };
      setMessages([greeting]);
    }
  }, [messages.length, sprint, sprintDays]);

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
      const capacityValue = memberCapacity?.totalCapacityForSprint || 0;
      const assignedEffort = memberItems.reduce((sum, item) => sum + (item.effort || 0), 0);
      const utilizationPercent = capacityValue > 0 ? Math.min(100, Math.round((assignedEffort / capacityValue) * 100)) : 0;
      
      // Generate member-specific message
      const memberMessage = {
        sender: 'AI',
        text: `📊 **Sprint Overview for ${member.displayName}**
        
${sprint ? `Sprint: "${sprint.name}" (${sprintDays.daysRemaining} days remaining)` : 'No active sprint'}

**Capacity**: ${capacityValue} hours
**Assigned**: ${assignedEffort} hours
**Utilization**: ${utilizationPercent}%

${memberItems.length > 0 
  ? `**Assigned Work Items (${memberItems.length}):**
${memberItems.slice(0, 5).map(item => `• ${item.title} (${item.effort || 0} hrs)`).join('\n')}
${memberItems.length > 5 ? `\n...and ${memberItems.length - 5} more` : ''}`
  : 'No work items currently assigned.'
}

How would you like me to help with ${member.displayName}'s tasks today?`,
        timestamp: new Date(),
        visualType: null
      };
      
      setMessages(prev => [...prev, memberMessage]);
    } catch (error) {
      console.error('Error loading member details:', error);
      
      // Add error message
      setMessages(prev => [...prev, {
        sender: 'AI',
        text: `I'm sorry, I encountered an error while retrieving information for ${member.displayName}. Please try again.`,
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
      const organization = adoConfig?.organization || '';
      const project = adoConfig?.project || '';
      const adoBaseUrl = `https://dev.azure.com/${organization}/${project}`;
      
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
        adoBaseUrl
      );
      
      // Add AI response
      const aiResponse: ChatMessage = {
        sender: 'AI',
        text: response.text,
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
                        {teamCapacity?.find(tc => tc.teamMember.id === member.id)?.totalCapacityForSprint || 0} hrs capacity
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
                  '& strong, & b': { fontWeight: 600 }
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
            placeholder={`Ask about ${selectedMember.displayName}'s tasks or capacity...`}
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

export default CentralizedAIChat;
