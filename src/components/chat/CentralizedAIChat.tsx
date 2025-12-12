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
      const greeting: ChatMessage = {
        sender: 'AI',
        text: `👋 Hello! I'm your AI Scrum Assistant. ${sprint ? 
          `We're currently in sprint "${sprint.name}" with ${sprintDays.daysRemaining} days remaining out of ${sprintDays.totalDays} days.` : 
          'I can help analyze team capacity and provide recommendations.'}\n          
Please select a team member below to view their tasks and provide assistance.`,
        timestamp: new Date(),
        visualType: null
      };
      setMessages([greeting]);
    }
  }, [messages.length, sprint, sprintDays]);

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
    
    // Add a message indicating cleared selection
    setMessages(prev => [...prev, {
      sender: 'System',
      text: 'Now focusing on the entire team',
      timestamp: new Date()
    }]);
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
        // This would be a different method if needed for team-level analysis
        
        // Example response for team-level analysis (placeholder)
        aiResponse = {
          sender: 'AI',
          text: `Team-level analysis:\n\nBased on current sprint data, the team is currently at 78% capacity utilization.\n\nHigh utilization team members:\n- John Smith: 105% assigned\n- Mary Johnson: 95% assigned\n\nUnderutilized team members:\n- Alex Williams: 45% assigned\n- Sarah Parker: 60% assigned\n\nRecommended actions:\n1. Redistribute 2-3 tasks from John to Alex\n2. Consider moving some tasks to the next sprint`,
          timestamp: new Date(),
          visualType: inputText.toLowerCase().includes('chart') ? 'chart' as const :
                    inputText.toLowerCase().includes('timeline') ? 'timeline' as const :
                    inputText.toLowerCase().includes('pie') || inputText.toLowerCase().includes('graph') ||
                    inputText.toLowerCase().includes('visual') ? 'pie' as const : null
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">AI Scrum Assistant</Typography>
          
          <Button
            variant="outlined"
            color="primary"
            size="small"
            startIcon={selectedMember ? <PersonIcon /> : <GroupIcon />}
            endIcon={<span>▼</span>}
            onClick={handleMenuOpen}
          >
            {selectedMember ? selectedMember.displayName : 'Team View'}
          </Button>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
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
            placeholder="Ask a question about the sprint or team capacity..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
            disabled={isLoading}
            size="small"
            sx={{ mr: 1 }}
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
    </Card>
  );
};

export default CentralizedAIChat;
