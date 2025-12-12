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
  LinearProgress,
  Collapse,
  IconButton
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as SmartToyIcon,
  Assignment as AssignmentIcon,
  Group as GroupIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon
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
  const [isGeneralChat, setIsGeneralChat] = useState(false);
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

  // Helper function to calculate business days (excluding weekends)
  const calculateBusinessDays = (startDate: Date, endDate: Date): number => {
    let count = 0;
    const current = new Date(startDate);
    
    while (current <= endDate) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  // Calculate sprint days remaining and total days (business days only)
  const sprintDays = useMemo(() => {
    if (!sprint) return { daysRemaining: 0, totalDays: 0, percentComplete: 0 };
    
    const startDate = new Date(sprint.startDate);
    const endDate = new Date(sprint.endDate);
    const currentDate = new Date();
    
    // Calculate total business days in sprint
    const totalDays = calculateBusinessDays(startDate, endDate);
    
    // Calculate remaining business days
    let daysRemaining = 0;
    if (currentDate < endDate) {
      daysRemaining = calculateBusinessDays(currentDate, endDate);
    }
    
    const daysElapsed = totalDays - daysRemaining;
    const percentComplete = totalDays > 0 ? Math.min(100, Math.round((daysElapsed / totalDays) * 100)) : 0;
    
    return { daysRemaining, totalDays, percentComplete };
  }, [sprint]);

  // Generate team summary for General Team Chat
  const generateTeamSummary = () => {
    if (!sprint) return "No active sprint selected.";
    
    const totalCapacity = teamCapacity?.reduce((sum, tc) => sum + (tc.totalCapacityForSprint || tc.totalCapacityPerDay || 0), 0) || 0;
    
    // Only count effort from Task work items, not parent User Stories/Bugs
    const taskWorkItems = sprintWorkItems.filter(wi => wi.type === 'Task');
    const totalAssigned = taskWorkItems.reduce((sum, wi) => sum + (wi.effort || 0), 0);
    
    const completedTasks = taskWorkItems.filter(wi => 
      wi.state === 'Done' || wi.state === 'Closed' || wi.state === 'Completed'
    );
    const activeTasks = taskWorkItems.filter(wi => 
      wi.state === 'Active' || wi.state === 'In Progress'
    );
    const newTasks = taskWorkItems.filter(wi => 
      wi.state === 'New' || wi.state === 'To Do'
    );
    
    // Calculate team utilization
    const utilizationPercent = totalCapacity > 0 ? Math.round((totalAssigned / totalCapacity) * 100) : 0;
    
    // Get work distribution by team member (only count effort from tasks, not parent items)
    const memberWorkload = teamMembers.map(member => {
      // Filter for tasks only (not parent User Stories/Bugs) and assigned to this member
      const memberTasks = sprintWorkItems.filter(item => {
        // Only include Task work items for effort calculation
        if (item.type !== 'Task') return false;
        
        if (!item.assignedTo) return false;
        if (typeof item.assignedTo === 'string') {
          return item.assignedTo === member.id || item.assignedTo.includes(member.displayName);
        }
        const assignedToObj = item.assignedTo as any;
        return assignedToObj.id === member.id || assignedToObj.displayName === member.displayName;
      });
      
      const memberCapacity = teamCapacity?.find(tc => tc.teamMember.id === member.id);
      const assignedEffort = memberTasks.reduce((sum, item) => sum + (item.effort || 0), 0);
      const completedEffort = memberTasks
        .filter(item => item.state === 'Done' || item.state === 'Closed' || item.state === 'Completed')
        .reduce((sum, item) => sum + (item.effort || 0), 0);
      
      return {
        name: member.displayName,
        assigned: assignedEffort,
        completed: completedEffort,
        capacity: memberCapacity?.totalCapacityForSprint || memberCapacity?.totalCapacityPerDay || 0,
        taskCount: memberTasks.length,
        completedCount: memberTasks.filter(item => 
          item.state === 'Done' || item.state === 'Closed' || item.state === 'Completed'
        ).length
      };
    });

    return `# 🚀 **Team Sprint Overview**

## **Sprint Details**
- **Sprint:** ${sprint.name}
- **Duration:** ${sprintDays.totalDays} business days (${sprintDays.daysRemaining} remaining)
- **Progress:** ${sprintDays.percentComplete}% complete

## **Capacity & Utilization**
- **Total Team Capacity:** ${totalCapacity} hours
- **Total Assigned Work:** ${totalAssigned} hours
- **Team Utilization:** ${utilizationPercent}%

## **Work Items Status**
| Status | Count | Effort |
|--------|-------|--------|
| ✅ Completed | ${completedTasks.length} | ${completedTasks.reduce((sum, item) => sum + (item.effort || 0), 0)} hrs |
| 🔄 Active | ${activeTasks.length} | ${activeTasks.reduce((sum, item) => sum + (item.effort || 0), 0)} hrs |
| 📋 New/To Do | ${newTasks.length} | ${newTasks.reduce((sum, item) => sum + (item.effort || 0), 0)} hrs |
| **Total** | **${taskWorkItems.length}** | **${totalAssigned} hrs** |

## **Team Member Workload**
| Team Member | Tasks | Completed | Effort | Capacity | Utilization |
|-------------|-------|-----------|--------|----------|-------------|
${memberWorkload.map(member => 
  `| ${member.name} | ${member.taskCount} | ${member.completedCount} | ${member.assigned} hrs | ${member.capacity} hrs | ${member.capacity > 0 ? Math.round((member.assigned / member.capacity) * 100) : 0}% |`
).join('\n')}

## **Quick Insights**
- **Completion Rate:** ${taskWorkItems.length > 0 ? Math.round((completedTasks.length / taskWorkItems.length) * 100) : 0}%
- **Average Utilization:** ${memberWorkload.length > 0 ? Math.round(memberWorkload.reduce((sum, m) => sum + (m.capacity > 0 ? (m.assigned / m.capacity) * 100 : 0), 0) / memberWorkload.length) : 0}%
- **Unassigned Tasks:** ${taskWorkItems.filter(item => !item.assignedTo).length}

---
💬 **Ask me anything about the team's progress, capacity planning, or work distribution!**`;
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
      const greeting = "👋 Hello! I'm your AI Scrum Assistant. " + 
        (sprint ? 
          `We're currently in sprint "${sprint.name}" with ${sprintDays.daysRemaining} business days remaining out of ${sprintDays.totalDays} business days.` : 
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
      let response;
      if (selectedMember) {
        // Individual member chat
        response = await thomsonReutersOpenAIService.processMemberChat(
          inputText,
          selectedMember,
          memberCapacity || null,
          memberItems,
          unassignedItems,
          baseUrl
        );
      } else {
        // Team-level chat - use processTeamChat method
        response = await thomsonReutersOpenAIService.processTeamChat(
          inputText,
          teamMembers,
          teamCapacity || null,
          sprintWorkItems,
          sprint,
          baseUrl
        );
      }
      
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
      
      // Show detailed error information instead of generic message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const detailedError = `❌ **Thomson Reuters AI Service Error**

${errorMessage}

**Troubleshooting steps:**
1. Check browser console for detailed error logs
2. Verify Thomson Reuters backend is running on port 3002
3. Ensure VPN connection to Thomson Reuters network is active
4. Check Thomson Reuters OpenAI configuration in Settings

**Status:** Service temporarily unavailable`;

      // Add error message
      setMessages(prev => [...prev, {
        sender: 'AI',
        text: detailedError,
        timestamp: new Date(),
        visualType: null
      }]);
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
        setInputText(''); // Clear input before processing
        
        // Add user message
        const userMessage: ChatMessage = {
          sender: 'User',
          text: finalPrompt,
          timestamp: new Date()
        };
        
        setMessages(prev => [...prev, userMessage]);
        setIsLoading(true);
        
        // Process the message (same logic as handleSendMessage)
        processQuickPrompt(finalPrompt);
      }
    }, 300);
  };

  // Process quick prompt message
  const processQuickPrompt = async (promptText: string) => {
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
      } else {
        // For general team chat, get unassigned items
        unassignedItems = sprintWorkItems.filter(item => !item.assignedTo || item.assignedTo === 'Unassigned');
      }

      // Get member capacity
      const memberCapacity = selectedMember ? 
        teamCapacity?.find(tc => tc.teamMember.id === selectedMember.id) : null;

      // Process chat with AI service
      const response = await thomsonReutersOpenAIService.processMemberChat(
        promptText,
        selectedMember ? selectedMember : { displayName: '', uniqueName: '', id: '', imageUrl: '' },
        memberCapacity || null,
        memberItems,
        unassignedItems,
        baseUrl
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
      console.error('Error processing quick prompt:', error);
      
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
            onDelete={() => {
              setSelectedMember(null);
              setIsGeneralChat(false);
            }}
          />
        )}
        {isGeneralChat && !selectedMember && (
          <Chip 
            avatar={<GroupIcon />}
            label="General Team Chat"
            color="secondary"
            variant="outlined"
            onDelete={() => {
              setIsGeneralChat(false);
              setMessages([]);
            }}
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
      {!selectedMember && !isGeneralChat && (
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
                // Generate and display team-wide summary
                setSelectedMember(null);
                setIsGeneralChat(true);
                
                const teamSummary = generateTeamSummary();
                
                setMessages(prev => [...prev, {
                  sender: 'AI',
                  text: teamSummary,
                  timestamp: new Date(),
                  visualType: null
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
      
      {/* Quick Prompts Section */}
      {(selectedMember || isGeneralChat) && (
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
      )}
      
      {/* Input area */}
      {(selectedMember || isGeneralChat) && (
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
            placeholder={
              selectedMember 
                ? `Ask about ${selectedMember.displayName}'s tasks or capacity...`
                : "Ask anything about the team's progress, capacity, or work distribution..."
            }
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
