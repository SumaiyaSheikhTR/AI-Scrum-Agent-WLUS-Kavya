import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  TextField, 
  Button, 
  CircularProgress, 
  Alert,
  Collapse,
  IconButton
} from '@mui/material';
import { 
  Send as SendIcon, 
  SmartToy as SmartToyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { TeamMember, TeamCapacity, WorkItem, Sprint } from '../../services/adoService';
import { thomsonReutersOpenAIService } from '../../services/thomsonReutersOpenAiService';
import { EnhancedAdhocAssignmentService, AdhocAssignmentResponse } from '../../services/enhancedAdhocAssignmentService';
import AdhocAssignmentVisuals from '../dashboard/AdhocAssignmentVisuals';

interface EnhancedAdhocAssignmentChatProps {
  teamMembers: TeamMember[];
  teamCapacity: TeamCapacity[] | null;
  sprintWorkItems: WorkItem[];
  sprint: Sprint | null;
}

interface ChatMessage {
  sender: string;
  text: string;
  timestamp: Date;
  visualData?: AdhocAssignmentResponse;
}

export const EnhancedAdhocAssignmentChat: React.FC<EnhancedAdhocAssignmentChatProps> = ({
  teamMembers,
  teamCapacity,
  sprintWorkItems,
  sprint
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAdhocItem, setSelectedAdhocItem] = useState<number | null>(null);
  const [showQuickPrompts, setShowQuickPrompts] = useState(true);

  // Assignment-focused quick prompts for demo
  const quickPrompts = [
    "There is an adhoc critical priority bug, whom should I assign to?",
    "Show me unassigned items and recommend optimal assignments",
    "Analyze team capacity and suggest who has availability for new work",
    "Help me prioritize our remaining work items for maximum sprint success",
    "Which team member is best suited for a frontend development task?",
    "Who should handle urgent database performance issues?",
    "Show me team workload distribution and identify overutilized members",
    "Recommend assignments for high-priority user stories"
  ];

  const adhocService = new EnhancedAdhocAssignmentService(thomsonReutersOpenAIService);

  // Initial greeting
  useEffect(() => {
    if (messages.length === 0) {
      const greeting = `👋 Welcome to the Enhanced AI Assignment Assistant! 

I specialize in helping you assign adhoc priority tasks intelligently. I can:

🎯 **Analyze team capacity** in real-time
📊 **Recommend optimal assignments** based on workload, skills, and availability
📋 **Show unassigned items** for selection
📈 **Provide visual insights** with charts and analytics

Try asking: "There is an adhoc priority bug, whom should I assign to?" or "Show me unassigned items and recommend assignments"

${sprint ? `Current Sprint: "${sprint.name}" with ${teamMembers.length} team members` : 'No active sprint'}`;

      setMessages([{
        sender: 'AI',
        text: greeting,
        timestamp: new Date()
      }]);
    }
  }, [messages.length, sprint, teamMembers.length]);

  const detectAdhocRequest = (message: string): boolean => {
    const adhocKeywords = [
      'adhoc', 'ad hoc', 'priority', 'urgent', 'critical', 'assign',
      'who should', 'recommend', 'suggest', 'best person', 'available',
      'capacity', 'unassigned', 'bug', 'hotfix', 'emergency'
    ];
    
    return adhocKeywords.some(keyword => 
      message.toLowerCase().includes(keyword.toLowerCase())
    );
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      sender: 'User',
      text: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputText;
    setInputText('');
    setIsLoading(true);

    try {
      if (detectAdhocRequest(currentInput)) {
        // Process as adhoc assignment request
        console.log('🎯 Processing adhoc assignment request...');
        
        const adhocResponse = await adhocService.processAdhocAssignmentRequest(
          currentInput,
          teamMembers,
          teamCapacity || [],
          sprintWorkItems,
          sprint
        );

        const aiMessage: ChatMessage = {
          sender: 'AI',
          text: adhocResponse.conversationalResponse,
          timestamp: new Date(),
          visualData: adhocResponse
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Regular chat response
        const aiMessage: ChatMessage = {
          sender: 'AI',
          text: `I understand you're asking: "${currentInput}"

For best results with assignment recommendations, try asking about:
- Adhoc priority tasks or bugs
- Team capacity analysis
- Assignment suggestions
- Unassigned items review

Would you like me to show current team capacity and unassigned items?`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      
      const errorMessage: ChatMessage = {
        sender: 'AI',
        text: 'I apologize, but I encountered an error while processing your request. Please try again or contact support if the issue persists.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleItemSelect = async (itemId: number) => {
    setSelectedAdhocItem(itemId);
    
    // Generate specific recommendations for the selected item
    try {
      const selectedItem = sprintWorkItems.find(item => item.id === itemId);
      if (!selectedItem) return;

      setIsLoading(true);
      
      const specificRequest = `I've selected item #${itemId}: "${selectedItem.title}". 
      This is a ${selectedItem.type} with priority ${selectedItem.priority || 'unknown'} and estimated effort of ${selectedItem.effort || 'unknown'} hours. 
      
      Please provide specific assignment recommendations for this item based on team capacity and expertise.`;

      const adhocResponse = await adhocService.processAdhocAssignmentRequest(
        specificRequest,
        teamMembers,
        teamCapacity || [],
        sprintWorkItems,
        sprint
      );

      const aiMessage: ChatMessage = {
        sender: 'AI',
        text: `📌 **Specific Recommendations for #${itemId}**

${adhocResponse.conversationalResponse}

Based on detailed analysis, here are the top 3 recommendations:
${adhocResponse.recommendedAssignees.slice(0, 3).map((rec, index) => 
  `\n${index + 1}. **${rec.member.displayName}** (${rec.confidence.toFixed(0)}% confidence)
   - Available capacity: ${rec.remainingCapacity}h
   - Current utilization: ${rec.utilizationPercent.toFixed(1)}%
   - ${rec.recommendation}`
).join('')}`,
        timestamp: new Date(),
        visualData: { ...adhocResponse, selectedAdhocItem: selectedItem }
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error processing item selection:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle quick prompt selection
  const handleQuickPrompt = (prompt: string) => {
    setInputText(prompt);
    
    // Auto-send the message after a short delay to show it in the input field first
    setTimeout(() => {
      if (prompt.trim()) {
        const userMessage: ChatMessage = {
          sender: 'User',
          text: prompt,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputText('');
        setIsLoading(true);
        
        // Process the quick prompt
        processQuickPrompt(prompt);
      }
    }, 300);
  };

  // Process quick prompt message (same logic as handleSendMessage)
  const processQuickPrompt = async (promptText: string) => {
    try {
      if (detectAdhocRequest(promptText)) {
        // Process as adhoc assignment request
        const adhocResponse = await adhocService.processAdhocAssignmentRequest(
          promptText,
          teamMembers,
          teamCapacity || [],
          sprintWorkItems,
          sprint
        );

        const aiMessage: ChatMessage = {
          sender: 'AI',
          text: adhocResponse.conversationalResponse,
          timestamp: new Date(),
          visualData: adhocResponse
        };

        setMessages(prev => [...prev, aiMessage]);
      } else {
        // Handle as general query
        const aiMessage: ChatMessage = {
          sender: 'AI',
          text: `Thanks for your question! I'm specialized in adhoc assignment tasks. 

For best results with assignment recommendations, try asking about:
- Adhoc priority tasks or bugs
- Team capacity analysis
- Assignment suggestions
- Unassigned items review

Would you like me to show current team capacity and unassigned items?`,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error('Error processing quick prompt:', error);
      
      const errorMessage: ChatMessage = {
        sender: 'AI',
        text: 'I apologize, but I encountered an error while processing your request. Please try again or contact support if the issue persists.',
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f8f9fa' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SmartToyIcon color="primary" />
          <Typography variant="h6" sx={{ color: '#1976d2', fontWeight: 'bold' }}>
            🎯 Enhanced AI Assignment Assistant
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Intelligent adhoc task assignment with real-time capacity analysis
        </Typography>
      </Paper>

      {/* Messages */}
      <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
        {messages.map((message, index) => (
          <Box key={index} sx={{ mb: 3 }}>
            <Paper
              sx={{
                p: 2,
                backgroundColor: message.sender === 'User' ? '#e3f2fd' : '#f5f5f5',
                borderLeft: `4px solid ${message.sender === 'User' ? '#2196f3' : '#4caf50'}`,
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {message.sender} • {message.timestamp.toLocaleTimeString()}
              </Typography>
              <Typography
                variant="body1"
                sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
              >
                {message.text}
              </Typography>
            </Paper>

            {/* Visual Data */}
            {message.visualData && (
              <Box sx={{ mt: 2 }}>
                <AdhocAssignmentVisuals
                  teamCapacityChart={message.visualData.visualizationData.teamCapacityChart}
                  workloadDistribution={message.visualData.visualizationData.workloadDistribution}
                  priorityMatrix={message.visualData.visualizationData.priorityMatrix}
                  unassignedItems={message.visualData.unassignedItems}
                  recommendedAssignees={message.visualData.recommendedAssignees}
                  onItemSelect={handleItemSelect}
                />
              </Box>
            )}
          </Box>
        ))}

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Analyzing team capacity and generating recommendations...
            </Typography>
          </Box>
        )}
      </Box>

      {/* Quick Prompts Section */}
      <Box sx={{ 
        px: 2, 
        py: 1,
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e0e0e0'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="caption" sx={{ color: '#666', fontWeight: 500 }}>
            🚀 Quick Assignment Questions
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
            {quickPrompts.slice(0, 6).map((prompt, index) => (
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
                  border: '1px solid #e0e0e0',
                  '&:hover': {
                    backgroundColor: '#e3f2fd',
                    borderColor: '#2196f3'
                  }
                }}
              >
                {prompt.length > 65 ? prompt.substring(0, 62) + '...' : prompt}
              </Button>
            ))}
          </Box>
        </Collapse>
      </Box>

      {/* Input */}
      <Paper sx={{ p: 2, backgroundColor: '#fafafa' }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={4}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask about adhoc assignments, team capacity, or unassigned items..."
            variant="outlined"
            size="small"
            disabled={isLoading}
          />
          <Button
            variant="contained"
            onClick={handleSendMessage}
            disabled={isLoading || !inputText.trim()}
            endIcon={<SendIcon />}
            sx={{ minWidth: '120px', height: '40px' }}
          >
            Send
          </Button>
        </Box>
        
        {selectedAdhocItem && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Selected item #{selectedAdhocItem} for detailed analysis
          </Alert>
        )}
      </Paper>
    </Box>
  );
};

export default EnhancedAdhocAssignmentChat;
