import React, { useState, useRef, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Paper, 
  Typography, 
  Avatar, 
  CircularProgress,
  IconButton,
  Divider,
  Alert
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import azureOpenAIService from '../../services/azureOpenAiService';
import adoService from '../../services/adoService';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: Date;
}

const ChatPanel: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [adoConfigured, setAdoConfigured] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  // Check if ADO is configured
  useEffect(() => {
    const isAdoConfigured = adoService.loadConfig();
    setAdoConfigured(isAdoConfigured);
  }, []);

  // Initial greeting message
  useEffect(() => {
    if (messages.length === 0) {
      const config = azureOpenAIService.getConfig();
      const isConfigured = config && config.endpoint && config.workspaceId && config.assetId;
      
      const welcomeMessage = isConfigured 
        ? `🎯 **Hello! I'm your AI Scrum Assistant**

I'm powered by Thomson Reuters Azure OpenAI and ready to help you excel in your Agile journey!

**What I can help you with:**
• 📋 Current sprint analysis and work item summaries
• 📊 Sprint metrics and progress insights  
• 👥 Team performance and collaboration tips
• 🔄 Process improvement recommendations
• 📈 Agile best practices and ceremony guidance
• ✅ Work item suggestions and backlog management

Try asking me things like:
- "What's the current sprint summary?"
- "How is our sprint progressing?"
- "What work items need attention?"
- "Show me sprint metrics and insights"
- "Help me write better user stories"

I can access your actual Azure DevOps data to provide real insights!

How can I assist you today?`
        : `🎯 **Hello! I'm your AI Scrum Assistant**

I have built-in knowledge of Agile and Scrum practices, but for the best experience with dynamic AI responses and real sprint data analysis, please configure your Thomson Reuters Azure OpenAI connection in the Settings.

**Current capabilities:**
• Sprint planning guidance
• User story writing help  
• Retrospective facilitation
• Agile best practices
• Process improvement tips

**To unlock full AI capabilities with real data:**
1. Go to Settings → AI Configuration
2. Add your Thomson Reuters workspace and asset details
3. Come back and ask me for sprint summaries, work item analysis, and more!

How can I help you today?`;
      
      setMessages([
        {
          id: 'welcome',
          text: welcomeMessage,
          sender: 'ai',
          timestamp: new Date()
        }
      ]);
    }
  }, [messages.length]);

  // Auto-scroll to bottom when new messages are added (particularly AI responses)
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Only auto-scroll for AI messages or when loading
      if (lastMessage.sender === 'ai' || isLoading) {
        scrollToBottom();
      }
    }
  }, [messages, isLoading]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current && messagesEndRef.current) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        const container = messagesContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
  };

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user',
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      // Enhance the query with comprehensive ADO context if available and relevant
      let enhancedQuery = userMessage.text;
      
      // Check if the message is about sprint, work items, or current status
      const isSprintAnalysisRequest = /sprint.*summary|current sprint|sprint.*progress|sprint.*status|work.*items|sprint.*metrics|sprint.*analysis/i.test(userMessage.text);
      
      if (adoConfigured && isSprintAnalysisRequest) {
        try {
          console.log('Fetching comprehensive sprint data for AI analysis...');
          
          // Get current sprint info
          const currentSprint = await adoService.getCurrentSprint();
          let sprintContext = '';
          
          if (currentSprint) {
            // Get sprint work items
            const workItems = await adoService.getSprintWorkItems(currentSprint.id);
            
            // Calculate sprint metrics
            const totalItems = workItems.length;
            const completedItems = workItems.filter(item => item.state === 'Done' || item.state === 'Closed').length;
            const inProgressItems = workItems.filter(item => item.state === 'Active' || item.state === 'In Progress').length;
            const todoItems = workItems.filter(item => item.state === 'New' || item.state === 'To Do').length;
            
            const sprintDuration = Math.ceil((new Date(currentSprint.endDate).getTime() - new Date(currentSprint.startDate).getTime()) / (1000 * 60 * 60 * 24));
            const daysElapsed = Math.ceil((new Date().getTime() - new Date(currentSprint.startDate).getTime()) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.max(0, sprintDuration - daysElapsed);
            
            // Group work items by type
            const itemsByType = workItems.reduce((acc, item) => {
              acc[item.type] = (acc[item.type] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            // Group work items by assignee
            const itemsByAssignee = workItems.reduce((acc, item) => {
              const assignee = item.assignedTo || 'Unassigned';
              acc[assignee] = (acc[assignee] || 0) + 1;
              return acc;
            }, {} as Record<string, number>);
            
            sprintContext = `
[CURRENT SPRINT DATA]
Sprint: "${currentSprint.name}"
Duration: ${new Date(currentSprint.startDate).toLocaleDateString()} to ${new Date(currentSprint.endDate).toLocaleDateString()}
Days Elapsed: ${daysElapsed}/${sprintDuration} (${daysRemaining} days remaining)

WORK ITEMS SUMMARY:
- Total Items: ${totalItems}
- Completed: ${completedItems} (${totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0}%)
- In Progress: ${inProgressItems}
- To Do: ${todoItems}

ITEMS BY TYPE:
${Object.entries(itemsByType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

ITEMS BY ASSIGNEE:
${Object.entries(itemsByAssignee).map(([assignee, count]) => `- ${assignee}: ${count}`).join('\n')}

RECENT WORK ITEMS:
${workItems.slice(0, 10).map(item => `- [${item.id}] ${item.title} (${item.state}) - ${item.assignedTo || 'Unassigned'}`).join('\n')}

Based on this real sprint data, please provide insights and analysis for the user's question: "${userMessage.text}"
            `;
          } else {
            sprintContext = '[No current sprint found in Azure DevOps. Please ensure ADO configuration is correct and a sprint is active.]';
          }
          
          enhancedQuery = sprintContext + '\n\nUser Question: ' + userMessage.text;
          
        } catch (error) {
          console.error('Error getting comprehensive sprint context:', error);
          enhancedQuery = `[Error fetching sprint data: ${error instanceof Error ? error.message : 'Unknown error'}] ${enhancedQuery}`;
        }
      }
      
      // Send message to Thomson Reuters Azure OpenAI
      const response = await azureOpenAIService.chat(enhancedQuery);
      
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        text: response,
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error sending message to AI:', error);
      
      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        text: 'Sorry, I encountered an error while processing your request. Please check your Thomson Reuters Azure OpenAI configuration in Settings and try again.',
        sender: 'ai',
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    // Clear the conversation history in the service
    azureOpenAIService.clearConversation();
    
    setMessages([
      {
        id: 'welcome-new',
        text: "Chat history cleared. How can I help you today?",
        sender: 'ai',
        timestamp: new Date()
      }
    ]);
  };

  // Format message text with line breaks
  const formatMessageText = (text: string) => {
    return text.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < text.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Chat header */}
      <Box sx={{ p: 2, backgroundColor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <SmartToyIcon sx={{ mr: 1 }} />
          <Typography variant="h6">AI Scrum Assistant</Typography>
        </Box>
        <IconButton color="inherit" onClick={clearChat} title="Clear chat history">
          <DeleteIcon />
        </IconButton>
      </Box>
      
      <Divider />
      
      {/* Messages container */}
      <Box 
        ref={messagesContainerRef}
        sx={{ 
          flexGrow: 1, 
          overflow: 'auto', 
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          backgroundColor: '#f5f5f5'
        }}
      >
        {!adoConfigured && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Azure DevOps integration is configured in the application but not connected to the AI Assistant. 
            Sprint-related questions will have limited responses.
          </Alert>
        )}
        {messages.map((message) => (
          <Box
            key={message.id}
            sx={{
              display: 'flex',
              flexDirection: message.sender === 'user' ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: 1,
            }}
          >
            <Avatar
              sx={{
                bgcolor: message.sender === 'user' ? 'primary.main' : 'secondary.main',
              }}
            >
              {message.sender === 'user' ? <PersonIcon /> : <SmartToyIcon />}
            </Avatar>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                maxWidth: '70%',
                borderRadius: 2,
                backgroundColor: message.sender === 'user' ? 'primary.light' : 'white',
                color: message.sender === 'user' ? 'white' : 'text.primary',
              }}
            >
              <Typography variant="body1">{formatMessageText(message.text)}</Typography>
              <Typography variant="caption" color={message.sender === 'user' ? 'white' : 'text.secondary'} sx={{ display: 'block', mt: 1, textAlign: 'right' }}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            </Paper>
          </Box>
        ))}
        
        {isLoading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              <SmartToyIcon />
            </Avatar>
            <CircularProgress size={24} />
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Box>
      
      <Divider />
      
      {/* Input area */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1, backgroundColor: 'white' }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type your message..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          multiline
          maxRows={4}
          size="small"
        />
        <Button
          variant="contained"
          color="primary"
          endIcon={<SendIcon />}
          onClick={handleSendMessage}
          disabled={isLoading || inputValue.trim() === ''}
        >
          Send
        </Button>
      </Box>
    </Paper>
  );
};

export default ChatPanel;
