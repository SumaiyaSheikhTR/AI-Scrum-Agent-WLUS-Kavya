import {
  Typography,
  Alert,
  AlertTitle,
  Button,
  FormControlLabel,
  Switch,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  MenuItem,
  Box,
  Paper,
  Grid,
  CircularProgress,
  Chip,
  Card,
  CardContent,
  Avatar,
  Divider,
  LinearProgress
} from '@mui/material';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Person as PersonIcon,
  Schedule as ScheduleIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  Refresh as RefreshIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  ErrorOutline as ErrorOutlineIcon,
  SmartToy as SmartToyIcon,
  Email as EmailIcon
} from '@mui/icons-material';
import adoService, { TeamCapacity, TeamMember, SprintCapacityData, Sprint, WorkItem } from '../../services/adoService';
import TeamCapacityConfigForm from '../config/TeamCapacityConfigForm';
import AdoCapacityDiagnostics from '../debug/AdoCapacityDiagnostics';
import { thomsonReutersOpenAIService } from '../../services/thomsonReutersOpenAiService';
import emailService from '../../services/emailService';
import AIRecommendationDialog from './AIRecommendationDialog';
import CentralizedAgenticChat from '../chat/CentralizedAgenticChat';

// Type for AI recommendations
interface AIRecommendation {
  member: string;
  recommendation: string;
  suggestedActions: string[];
  adoLinks?: string[];
  utilizationLevel?: string;
  priority?: string;
  tasksToRemove?: any[];
  tasksToAssign?: any[];
  autoAssignTags?: string[];  // Tags for automatic assignment
  autoRemoveTags?: string[];  // Tags for automatic removal
}

interface CapacityUtilizationProps {
  sprintId?: string | null;
}

interface UtilizationData {
  member: TeamMember;
  capacity: TeamCapacity;
  utilization: number;
  assignedEffort: number;
  completedEffort: number;
  remainingCapacity: number;
  dailyBurnRate: number;
  expectedDailyBurn: number;
  isCapacityMismatch: boolean;
  capacityMismatchSeverity: 'low' | 'medium' | 'high' | 'none';
  burnRateAnalysis: {
    daysIntoSprint: number;
    expectedProgressPercentage: number;
    actualProgressPercentage: number;
    isOnTrack: boolean;
    recommendation: string;
    expectedCumulativeEffort: number;
    actualCumulativeEffort: number;
    dailyBurnHistory: Array<{
      day: number;
      date: string;
      expectedCumulative: number;
      actualCumulative: number;
      dailyBurn: number;
      isWeekend: boolean;
    }>;
  };
}

const CapacityUtilization: React.FC<CapacityUtilizationProps> = ({ sprintId: initialSprintId }) => {
  // State for chat input and loading state
  const [chatMessages, setChatMessages] = useState<{ [member: string]: { sender: string; text: string; adoLinks?: string[]; autoAssignTags?: string[]; autoRemoveTags?: string[] }[] }>({});
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  // Commented out unused state
  // const [memberWorkItems, setMemberWorkItems] = useState<WorkItem[]>([]);

  // Function to fetch capacity data - defined outside useEffect so it can be reused
  const fetchCapacityData = async (targetSprintId?: string, forceRefresh = false) => {
    const sprintToFetch = targetSprintId || selectedSprintId;
    
    if (!sprintToFetch) {
      setError('No sprint selected');
      setIsLoading(false);
      return;
    }

    console.log('🏃‍♂️ ==================== CAPACITY DATA FETCH ====================');
    console.log(`🏃‍♂️ CAPACITY_FETCH: Fetching capacity for sprint ${sprintToFetch}, forceRefresh: ${forceRefresh}`);

    setIsLoading(true);
    setError(null);

    try {
      console.log('🏃‍♂️ CAPACITY_FETCH: Calling ADO service methods...');
      const [capacity, utilization] = await Promise.all([
        adoService.getSprintCapacity(sprintToFetch),
        adoService.getTeamUtilization(sprintToFetch)
      ]);

      console.log(`🏃‍♂️ CAPACITY_FETCH: ✅ Successfully loaded capacity data - ${capacity.teamCapacities.length} team members, ${utilization.length} utilization records`);
      console.log('🏃‍♂️ CAPACITY_FETCH: Capacity details:', {
        totalWorkingDays: capacity.totalWorkingDays,
        teamMembers: capacity.teamCapacities.length,
        utilizationRecords: utilization.length,
        isUsingFallback: capacity.isUsingFallback,
        timestamp: new Date().toISOString()
      });

      // Update state with capacity data
      setCapacityData(capacity);
      setIsUsingFallback(capacity.isUsingFallback ?? false);
      
      // Update team utilization data
      setUtilizationData(utilization);
      
      // Update work items if available (used for AI recommendations)
      if (sprintToFetch) {
        try {
          const items = await adoService.getSprintWorkItems(sprintToFetch);
          setSprintWorkItems(items);
          
          // Also load any ADO configuration we can find
          const configStr = localStorage.getItem('adoConfig');
          if (configStr) {
            setAdoConfig(JSON.parse(configStr));
          }
          
          // Generate AI recommendations if appropriate
          if (aiRecommendationsEnabled && !aiRecommendationsLoading && capacity && utilization.length > 0) {
            generateAiRecommendations(capacity, utilization, sprintToFetch);
          }
          
        } catch (err) {
          console.error('Error fetching sprint work items:', err);
        }
      }
      
      // Set last refresh time
      setLastRefreshTime(new Date());
      setIsLoading(false);
      
      return { capacity, utilization };
    } catch (error) {
      console.error('🏃‍♂️ CAPACITY_FETCH: ❌ Error fetching capacity data:', error);
      
      let errorMessage = 'Error loading capacity data. Please try again.';
      
      if (error instanceof Error) {
        errorMessage = `Error: ${error.message}`;
        
        // Check for specific error types for better user messaging
        if (error.message.includes('API rate limit')) {
          errorMessage = 'Azure DevOps API rate limit exceeded. Please try again later.';
        } else if (error.message.includes('401')) {
          errorMessage = 'Authentication error. Please check your Azure DevOps credentials.';
        } else if (error.message.includes('404')) {
          errorMessage = 'Sprint or team not found. Please check your configuration.';
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
      throw error;
    }
  };

  // Handle task assignment from chat
  const handleAssignTask = async (workItemId: string, memberId: string) => {
    console.log(`Task ${workItemId} assigned to team member ${memberId} from Capacity Utilization view`);
    
    // Optionally refresh the capacity data or update the UI
    
    // If you have the sprint ID, you can refresh the work items for that sprint
    if (selectedSprintId) {
      // Refresh capacity data using fetchCapacityDataManual
      (async () => {
        await fetchCapacityDataManual(selectedSprintId, true);
      })();
    }
  };

  // Handle chat send
  const handleSendChat = async () => {
    if (!selectedMember || !chatInput.trim()) return;
    const memberName = selectedMember.displayName;
    
    // Add user message to chat
    setChatMessages(prev => ({
      ...prev,
      [memberName]: [...(prev[memberName] || []), { sender: 'You', text: chatInput }]
    }));
    
    // Clear input and set loading state
    setChatInput('');
    setIsChatLoading(true);
    
    try {
      // Get member capacity and work items
      const memberCapacity = capacityData?.teamCapacities?.find(tc => tc.teamMember.id === selectedMember.id) || null;
      
      // If we don't have work items already loaded, fetch them
      let assignedTasks: WorkItem[] = [];
      let unassignedTasks: WorkItem[] = [];
      
      if (selectedSprintId) {
        try {
          // Fetch work items for the current sprint if not already available
          const sprintWorkItems = await adoService.getSprintWorkItems(selectedSprintId);
          // Commented out since memberWorkItems is unused
          // setMemberWorkItems(sprintWorkItems);
          
          // Filter for assigned and unassigned tasks
          // The WorkItem interface defines assignedTo as string | null, but it could be an object in runtime
          assignedTasks = sprintWorkItems.filter(item => {
            if (!item.assignedTo) return false;
            
            // Handle the case where assignedTo is a string containing the member's ID or display name
            if (typeof item.assignedTo === 'string') {
              return item.assignedTo === selectedMember.id || 
                     item.assignedTo.includes(selectedMember.displayName);
            }
            
            // Handle the case where assignedTo might be an object (runtime type)
            // This is a type assertion to avoid TypeScript errors
            const assignedToObj = item.assignedTo as any;
            return assignedToObj.id === selectedMember.id || 
                   assignedToObj.displayName === selectedMember.displayName;
          });
          
          unassignedTasks = sprintWorkItems.filter(item => !item.assignedTo);
        } catch (error) {
          console.error('Error fetching work items:', error);
        }
      }
      
      // Build ADO base URL - try to get from localStorage or fallback to defaults
      let organization = localStorage.getItem('adoOrganization') || '';
      let project = localStorage.getItem('adoProject') || '';
      
      // If not in localStorage, try to get from any available config
      if (!organization || !project) {
        try {
          // Try to get from capacityData if available
          if (capacityData) {
            const configStr = localStorage.getItem('adoConfig');
            if (configStr) {
              const config = JSON.parse(configStr);
              organization = organization || config.organization;
              project = project || config.project;
            }
          }
        } catch (error) {
          console.error('Error getting ADO config:', error);
        }
      }
      
      if (!organization || !project) {
        throw new Error('Azure DevOps organization/project is not configured. Configure them in Settings.');
      }

      const adoBaseUrl = `https://dev.azure.com/${organization}/${project}`;
      
      // Get AI response with ADO links
      const response = await thomsonReutersOpenAIService.processMemberChat(
        chatInput,
        selectedMember,
        memberCapacity,
        assignedTasks,
        unassignedTasks,
        adoBaseUrl
      );
      
      // Add AI response to chat
      setChatMessages(prev => ({
        ...prev,
        [memberName]: [
          ...(prev[memberName] || []),
          { 
            sender: 'Agentic AI', 
            text: response.text,
            adoLinks: response.adoLinks,
            autoAssignTags: response.autoAssignTags,
            autoRemoveTags: response.autoRemoveTags
          }
        ]
      }));
    } catch (error) {
      console.error('Error getting AI response:', error);
      
      // Add error message to chat
      setChatMessages(prev => ({
        ...prev,
        [memberName]: [
          ...(prev[memberName] || []),
          { 
            sender: 'Agentic AI', 
            text: 'Sorry, I encountered an error processing your request. Please try again.'
          }
        ]
      }));
    } finally {
      setIsChatLoading(false);
    }
  };
  // State for capacity mismatch toggle
  const [showCapacityMismatch, setShowCapacityMismatch] = useState(true);
  // State for AI recommendation dialog
  const [showRecommendationDialog, setShowRecommendationDialog] = useState(false);
  // Popup state for AI recommendation
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  // AI recommendations state
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendation[]>([]);
  // State for collapsible sections in dialog
  const [expandedSections, setExpandedSections] = useState({
    recommendation: true,
    tasksToAssign: true,
    tasksToRemove: true,
    chat: true
  });
  
  // Handler for member corner button click
  const handleMemberCornerClick = (member: TeamMember) => {
    setSelectedMember(member);
    setShowRecommendationDialog(true);
  };
  
  // Toggle section visibility in the dialog
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  const [isLoading, setIsLoading] = useState(false);  // Start with false for better UX
  const [error, setError] = useState<string | null>(null);
  const [capacityData, setCapacityData] = useState<SprintCapacityData | null>(null);
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([]);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [availableSprints, setAvailableSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(initialSprintId || null);
  const [sprintLoading, setSprintLoading] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const [showCapacityConfig, setShowCapacityConfig] = useState(false);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  
  // State for Centralized Agentic Chat
  const [showEnhancedChat, setShowEnhancedChat] = useState<boolean>(false);
  const [sprintWorkItems, setSprintWorkItems] = useState<WorkItem[]>([]);
  const [adoConfig, setAdoConfig] = useState<any>(null);
  
  // AI Recommendations state
  const [aiRecommendationsLoading, setAiRecommendationsLoading] = useState(false);
  // Using const instead of state since the value is never changed
  const aiRecommendationsEnabled = true;

  // Generate AI recommendations
  const generateAiRecommendations = useCallback(async (capacity: SprintCapacityData, utilization: UtilizationData[], sprintId: string) => {
    if (!aiRecommendationsEnabled) return;
    
    setAiRecommendationsLoading(true);
    
    try {
      console.log('🤖 Generating AI capacity recommendations...');
      
      // Get work items for the sprint
      const workItems = await adoService.getSprintWorkItems(sprintId);

      // Pass full TeamCapacity objects (includes activity/capacity)
      const recommendations = await thomsonReutersOpenAIService.generateCapacityRecommendations(
        capacity.teamCapacities, // <-- pass full objects
        workItems,
        capacity
      );
      
      setAiRecommendations(recommendations);
      
      console.log('🤖 ✅ AI recommendations generated successfully:', recommendations.length, 'recommendations');
      
    } catch (error) {
      console.error('🤖 ❌ Failed to generate AI recommendations:', error);
      
      // Check for specific error types and show user-friendly messages
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('BACKEND_ERROR')) {
        // Show backend-specific alert to user
        setTimeout(() => {
          alert('⚠️ Thomson Reuters AI Backend Service Unavailable\n\n' +
                'The backend API service is not running.\n\n' +
                'Solution:\n' +
                '• Open a new terminal\n' +
                '• Run: node tr-openai-backend.js\n' +
                '• Restart your React app\n\n' +
                'This backend service replicates your Python notebook functionality.');
        }, 1000);
      } else if (errorMessage.includes('CORS_ERROR')) {
        // Show CORS-specific alert to user
        setTimeout(() => {
          alert('⚠️ Thomson Reuters AI Service Unavailable\n\n' +
                'The Thomson Reuters AI platform cannot be accessed from localhost due to CORS policy.\n\n' +
                'Solutions:\n' +
                '• Deploy this application to Thomson Reuters infrastructure\n' +
                '• Connect via VPN to Thomson Reuters network\n' +
                '• Use the backend API service (recommended for development)\n\n' +
                'AI recommendations are temporarily disabled.');
        }, 1000);
      }
      
      // Don't show error to user for other errors, just log it - AI recommendations are optional
    } finally {
      setAiRecommendationsLoading(false);
    }
  }, [aiRecommendationsEnabled]);

  useEffect(() => {
    const fetchSprintOptions = async () => {
      try {
        const [current, sprints] = await Promise.all([
          adoService.getCurrentSprint(),
          adoService.getSprints()
        ]);
        
        setCurrentSprint(current);
        setAvailableSprints(sprints);
        
        // If no sprint is explicitly selected, use the current sprint or the initial sprint prop
        if (!selectedSprintId && !initialSprintId) {
          setSelectedSprintId(current?.id.toString() || null);
        }
      } catch (err) {
        console.error('Error fetching sprint options:', err);
      }
    };

    fetchSprintOptions();
  }, [initialSprintId, selectedSprintId]);

  useEffect(() => {
    // Auto-loading of capacity data RE-ENABLED
    const fetchCapacityData = async (targetSprintId?: string, forceRefresh = false) => {
      const sprintToFetch = targetSprintId || selectedSprintId;
      
      if (!sprintToFetch) {
        setError('No sprint selected');
        setIsLoading(false);
        return;
      }

      console.log('🏃‍♂️ ==================== CAPACITY DATA FETCH ====================');
      console.log(`🏃‍♂️ CAPACITY_FETCH: Fetching capacity for sprint ${sprintToFetch}, forceRefresh: ${forceRefresh}`);

      setIsLoading(true);
      setError(null);

      try {
        console.log('🏃‍♂️ CAPACITY_FETCH: Calling ADO service methods...');
        const [capacity, utilization] = await Promise.all([
          adoService.getSprintCapacity(sprintToFetch),
          adoService.getTeamUtilization(sprintToFetch)
        ]);

        console.log(`🏃‍♂️ CAPACITY_FETCH: ✅ Successfully loaded capacity data - ${capacity.teamCapacities.length} team members, ${utilization.length} utilization records`);
        console.log('🏃‍♂️ CAPACITY_FETCH: Capacity details:', {
          totalWorkingDays: capacity.totalWorkingDays,
          teamMembers: capacity.teamCapacities.length,
          utilizationRecords: utilization.length,
          isUsingFallback: capacity.isUsingFallback,
          timestamp: new Date().toISOString()
        });

        setCapacityData(capacity);
        setUtilizationData(utilization);
        setLastRefreshTime(new Date());
        setIsUsingFallback(capacity.isUsingFallback || false);
        
        // Generate AI recommendations if enabled
        if (aiRecommendationsEnabled && capacity.teamCapacities.length > 0) {
          generateAiRecommendations(capacity, utilization, sprintToFetch);
        }
        
        // Fetch work items for the sprint
        try {
          const workItems = await adoService.getSprintWorkItems(sprintToFetch);
          console.log(`🏃‍♂️ CAPACITY_FETCH: ✅ Successfully loaded ${workItems.length} work items for the sprint`);
        } catch (error) {
          console.error('Error fetching sprint work items:', error);
        }
      } catch (err) {
        console.error('🏃‍♂️ CAPACITY_FETCH: ❌ Error fetching capacity data:', err);
        setError('Failed to load capacity data. Please check your connection and try again.');
      } finally {
        setIsLoading(false);
        console.log('🏃‍♂️ ========================================================');
      }
    };

    if (selectedSprintId) {
      fetchCapacityData(selectedSprintId);
    }
  }, [selectedSprintId, aiRecommendationsEnabled, generateAiRecommendations]);

  // Separate function for manual refresh and sprint changes
  const fetchCapacityDataManual = useCallback(async (targetSprintId?: string, forceRefresh = false) => {
    const sprintToFetch = targetSprintId || selectedSprintId;
    
    if (!sprintToFetch) {
      setError('No sprint selected');
      setIsLoading(false);
      return;
    }

    console.log('🏃‍♂️ ==================== MANUAL CAPACITY DATA FETCH ====================');
    console.log(`🏃‍♂️ MANUAL_CAPACITY_FETCH: Fetching capacity for sprint ${sprintToFetch}, forceRefresh: ${forceRefresh}`);

    setIsLoading(true);
    setError(null);

    try {
      console.log('🏃‍♂️ MANUAL_CAPACITY_FETCH: Calling ADO service methods...');
      const [capacity, utilization] = await Promise.all([
        adoService.getSprintCapacity(sprintToFetch),
        adoService.getTeamUtilization(sprintToFetch)
      ]);

      console.log(`🏃‍♂️ MANUAL_CAPACITY_FETCH: ✅ Successfully loaded capacity data - ${capacity.teamCapacities.length} team members, ${utilization.length} utilization records`);
      
      // Fetch work items for the sprint (for CentralizedAgenticChat)
      try {
        const workItems = await adoService.getSprintWorkItems(sprintToFetch);
        console.log(`🏃‍♂️ MANUAL_CAPACITY_FETCH: ✅ Successfully loaded ${workItems.length} work items`);
        setSprintWorkItems(workItems);
        
        // Try to get ADO config
        try {
          const configStr = localStorage.getItem('adoConfig');
          if (configStr) {
            const config = JSON.parse(configStr);
            setAdoConfig(config);
          }
        } catch (configError) {
          console.error('Error loading ADO config:', configError);
        }
      } catch (itemsError) {
        console.error('Error fetching sprint work items:', itemsError);
      }
      
      setCapacityData(capacity);
      setUtilizationData(utilization);
      setLastRefreshTime(new Date());
      setIsUsingFallback(capacity.isUsingFallback || false);
    } catch (err) {
      console.error('🏃‍♂️ MANUAL_CAPACITY_FETCH: ❌ Error fetching capacity data:', err);
      setError('Failed to load capacity data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
      console.log('🏃‍♂️ ==============================================================');
    }
  }, [selectedSprintId]);

  const handleSprintChange = async (event: SelectChangeEvent<string>) => {
    const sprintId = event.target.value;
    
    console.log('🔄 ==================== CAPACITY SPRINT CHANGE ====================');
    console.log(`🔄 CAPACITY_SPRINT_CHANGE: User selected sprint ID: ${sprintId}`);
    
    setSelectedSprintId(sprintId);
    setSprintLoading(true);
    
    try {
      await fetchCapacityDataManual(sprintId, true); // Force refresh for sprint change
      console.log(`🔄 CAPACITY_SPRINT_CHANGE: ✅ Successfully switched to sprint ${sprintId}`);
    } catch (err) {
      console.error('🔄 CAPACITY_SPRINT_CHANGE: ❌ Error switching sprint:', err);
    } finally {
      setSprintLoading(false);
      console.log('🔄 ===============================================================');
    }
  };

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered for capacity data');
    fetchCapacityDataManual(selectedSprintId || undefined, true);
  };

  // Email reporting functionality
  const handleSendEmail = useCallback(async () => {
    if (!capacityData || !utilizationData.length) {
      alert('❌ No capacity data available to send. Please load the data first.');
      return;
    }

    try {
      const selectedSprint = availableSprints.find(sprint => sprint.id.toString() === selectedSprintId) || currentSprint;
      const sprintName = selectedSprint ? selectedSprint.name : 'Current Sprint';
      const totalCapacity = capacityData.teamCapacities.reduce(
        (sum, cap) => sum + (cap.totalCapacityForSprint || 0),
        0
      );
      const totalAssigned = utilizationData.reduce((sum, data) => sum + data.assignedEffort, 0);
      const totalCompleted = utilizationData.reduce((sum, data) => sum + data.completedEffort, 0);
      const overallUtilization = totalCapacity > 0 ? (totalAssigned / totalCapacity) * 100 : 0;

      const teamMembers = utilizationData.map((data) => {
        const utilization = data.utilization;
        let status = 'On Track';
        if (utilization > 100) status = 'Over Capacity';
        else if (utilization < 70) status = 'Under Utilized';
        else if (!data.burnRateAnalysis.isOnTrack) status = 'At Risk';

        return {
          name: data.member.displayName,
          utilization,
          capacity: data.capacity.totalCapacityForSprint || 0,
          assigned: data.assignedEffort,
          completed: data.completedEffort,
          status,
          isOnTrack: data.burnRateAnalysis.isOnTrack,
        };
      });

      const wellUtilized = teamMembers.filter((m) => m.utilization >= 70 && m.utilization <= 100).length;
      const underUtilized = teamMembers.filter((m) => m.utilization < 70).length;
      const overCapacity = teamMembers.filter((m) => m.utilization > 100).length;
      const atRisk = teamMembers.filter((m) => !m.isOnTrack).length;

      const ok = await emailService.sendCapacityReport({
        sprintName,
        sprintId: selectedSprintId || selectedSprint?.id?.toString() || '',
        reportDate: new Date().toISOString(),
        totalCapacity,
        totalAssigned,
        totalCompleted,
        overallUtilization,
        teamMembers,
        summary: { wellUtilized, underUtilized, overCapacity, atRisk },
      });

      if (ok) {
        alert('✅ Capacity report email sent successfully!');
      } else {
        alert('❌ Failed to send capacity report. Check Email settings and that email is enabled.');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('❌ Failed to send email: ' + (error as Error).message);
    }
  }, [capacityData, utilizationData, availableSprints, selectedSprintId, currentSprint]);

  /* Commented out unused function
  const runConnectionTest = async () => {
    console.log('🧪 Running ADO connection test...');
    try {
      const results = await adoService.testAdoConnection(selectedSprintId || undefined);
      
      console.log('🧪 Connection test results:', results);
      
      // Show a user-friendly alert with results
      if (results.canAccessCapacity) {
        alert('✅ ADO Connection Test PASSED!\n\nAll systems are working correctly. The capacity data should be available from Azure DevOps.');
      } else if (results.canAccessSprints) {
        alert('⚠️ ADO Connection Test PARTIAL!\n\nCan access sprints but not capacity data. This might be a permissions issue with the PAT token or the capacity API.');
      } else if (results.canAccessProject) {
        alert('⚠️ ADO Connection Test LIMITED!\n\nCan access project but not sprint/capacity data. Check team configuration and permissions.');
      } else {
        alert('❌ ADO Connection Test FAILED!\n\nCannot access Azure DevOps. Check your PAT token and configuration.\n\nErrors:\n' + results.errors.join('\n'));
      }
    } catch (error) {
      console.error('🧪 Error running connection test:', error);
      alert('❌ Connection test failed: ' + error);
    }
  };
  */

  const getUtilizationColor = (utilization: number): string => {
    if (utilization > 100) return '#f44336'; // Red - Over capacity
    if (utilization === 100) return '#4caf50'; // Green - Well utilized (exactly 100%)
    return '#ff9800'; // Orange - Under utilized (<100%)
  };

  const getUtilizationStatus = (utilization: number): string => {
    if (utilization === 100) return 'Well utilized';
    if (utilization > 100) return 'Over Capacity';
    return 'Under utilized'; // Show "Under utilized" for anything less than 100%
  };

  const stringToColor = (string: string): string => {
    let hash = 0;
    for (let i = 0; i < string.length; i += 1) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i += 1) {
      const value = (hash >> (i * 8)) & 0xff;
      color += `00${value.toString(16)}`.substr(-2);
    }
    return color;
  };

  const stringAvatar = (name: string) => ({
    sx: {
      bgcolor: stringToColor(name),
      width: 48,
      height: 48,
      fontSize: '1.2rem'
    },
    children: name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
  });

  useEffect(() => {
    if (!selectedSprintId || isUsingFallback) return;

    const interval = setInterval(() => {
      if (!document.hidden) {
        console.log('🕐 Auto-refreshing capacity data');
        fetchCapacityDataManual(selectedSprintId, true);
      }
    }, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedSprintId, isUsingFallback, fetchCapacityDataManual]);

  // Listen for scheduled email report events
  useEffect(() => {
    const handleScheduledReport = (event: CustomEvent) => {
      console.log('📧 Scheduled capacity report triggered:', event.detail);
      
      // Only send if we have current data
      if (capacityData && utilizationData.length > 0) {
        // Email functionality removed
        console.log('Email functionality has been removed');
      } else {
        console.warn('📧 Scheduled report skipped - no capacity data available');
      }
    };

    window.addEventListener('schedule-capacity-report', handleScheduledReport as EventListener);
    
    return () => {
      window.removeEventListener('schedule-capacity-report', handleScheduledReport as EventListener);
    };
  }, [capacityData, utilizationData]);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  if (!capacityData || utilizationData.length === 0) {
    return (
      <Alert severity="info" sx={{ m: 2 }}>
        No capacity data available for the selected sprint.
      </Alert>
    );
  }

  const totalTeamCapacity = capacityData.teamCapacities.reduce((sum, member) => sum + member.totalCapacityForSprint, 0);
  const totalAssignedEffort = utilizationData.reduce((sum, data) => sum + data.assignedEffort, 0);
  // Commented out unused calculation
  // const totalCompletedEffort = utilizationData.reduce((sum, data) => sum + data.completedEffort, 0);
  const overallUtilization = totalTeamCapacity > 0 ? (totalAssignedEffort / totalTeamCapacity) * 100 : 0;



  return (
    <Box sx={{ p: 2 }}>
      {/* Enhanced AI Chat Section */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<SmartToyIcon />}
          onClick={() => setShowEnhancedChat(!showEnhancedChat)}
        >
          {showEnhancedChat ? 'Hide' : 'Show'} Centralized AI Scrum Assistant
        </Button>
      </Box>
      
      {showEnhancedChat && (
        <Box sx={{ mb: 4, height: 700, border: '1px solid #e0e0e0', borderRadius: 2 }}>
          <CentralizedAgenticChat 
            teamMembers={capacityData?.teamCapacities?.map(tc => tc.teamMember) || []}
            teamCapacity={capacityData?.teamCapacities?.map(tc => ({
              ...tc,
              allocatedCapacity: tc.totalCapacityForSprint - (tc.totalAvailableCapacity || 0)
            }))}
            sprint={availableSprints.find(sprint => sprint.id.toString() === selectedSprintId) || currentSprint}
            workItems={sprintWorkItems.map(item => ({
              ...item,
              id: item.id,
              description: item.description || null,
              assignedTo: typeof item.assignedTo === 'string' ? item.assignedTo : '',
              storyPoints: item.effort || undefined,
              effort: item.effort,
              priority: item.priority,
              type: item.type || ''
            }))}
            adoConfig={adoConfig}
            adoBaseUrl={`https://dev.azure.com/${adoConfig?.organization || ''}/${adoConfig?.project || ''}`}
          />
        </Box>
      )}

      {/* Sprint Filter and Controls */}
      <Paper elevation={3} sx={{ 
        p: 3, 
        mb: 3, 
        borderRadius: 3,
        background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
        border: '1px solid #34495e'
      }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: { xs: 2, md: 0 } }}>
              <Typography variant="h6" sx={{ mr: 2, fontWeight: 500, color: '#ecf0f1' }}>
                🏃‍♂️ Sprint Capacity:
              </Typography>
              <Typography variant="h6" sx={{ 
                background: 'rgba(255,255,255,0.15)',
                px: 2,
                py: 1,
                borderRadius: 2,
                fontWeight: 600,
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.2)',
                backdropFilter: 'blur(10px)'
              }}>
                {(() => {
                  const selectedSprint = availableSprints.find(sprint => sprint.id.toString() === selectedSprintId) || currentSprint;
                  return selectedSprint ? selectedSprint.name : 'Unknown Sprint';
                })()}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <FormControl 
              size="small" 
              disabled={sprintLoading}
              sx={{ 
                minWidth: 300,
                '& .MuiInputLabel-root': { color: '#ecf0f1' },
                '& .MuiOutlinedInput-root': {
                  color: '#ffffff',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 2,
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: '#ffffff' }
                },
                '& .MuiSelect-icon': { color: '#ecf0f1' }
              }}
            >
              <InputLabel>Select Sprint</InputLabel>
              <Select
                value={availableSprints.some(s => s.id === selectedSprintId) ? (selectedSprintId || '') : ''}
                label="Select Sprint"
                onChange={handleSprintChange}
                MenuProps={{
                  PaperProps: {
                    sx: {
                      backgroundColor: '#2c3e50',
                      '& .MuiMenuItem-root': {
                        color: '#ecf0f1',
                        '&:hover': { backgroundColor: '#34495e' },
                        '&.Mui-selected': { 
                          backgroundColor: '#3498db',
                          '&:hover': { backgroundColor: '#2980b9' }
                        }
                      }
                    }
                  }
                }}
              >
                {availableSprints.map(sprint => (
                  <MenuItem key={sprint.id} value={sprint.id}>{sprint.name}</MenuItem>
                ))}
              </Select>
              {/* Move <Box> and comments outside of <Select> */}
              <Box sx={{ p: 2 }}>
                {/* ...existing code... */}
              </Box>
              {/* Remove stray style objects and misplaced tokens */}
              {/* ...existing code... */}
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={handleRefresh}
                disabled={isLoading || sprintLoading}
                sx={{
                  background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                  color: 'white',
                  fontWeight: 600,
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  mr: 2,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #229954 0%, #27ae60 100%)',
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(39, 174, 96, 0.3)'
                  },
                  '&:disabled': {
                    background: 'rgba(255,255,255,0.2)',
                    color: 'rgba(255,255,255,0.5)'
                  }
                }}
              >
                Refresh
              </Button>
            </FormControl>
          </Grid>
        </Grid>

        {/* Real-time Data Status */}
        {lastRefreshTime && (
          <Box sx={{ mt: 2, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 1 }}>
            <Chip 
              label={`Last updated: ${lastRefreshTime.toLocaleTimeString()}`}
              size="small"
              sx={{ 
                backgroundColor: 'rgba(46, 204, 113, 0.9)',
                color: '#ffffff',
                fontWeight: 500
              }}
            />
            {isUsingFallback && (
              <Chip 
                label="Fallback Data"
                size="small"
                sx={{ 
                  backgroundColor: 'rgba(255, 193, 7, 0.9)',
                  color: '#000',
                  fontWeight: 600
                }}
              />
            )}
            {!isUsingFallback && (
              <Chip 
                label="Live ADO Data"
                size="small"
                sx={{ 
                  backgroundColor: 'rgba(76, 175, 80, 0.9)',
                  color: '#ffffff',
                  fontWeight: 600
                }}
              />
            )}
          </Box>
        )}
      </Paper>

      {/* Fallback Data Warning */}
      {isUsingFallback && (
        <Alert 
          severity="warning" 
          sx={{ mb: 3 }}
          action={
            <Box>
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => setShowDiagnostics(true)}
              >
                Diagnose
              </Button>
              <Button 
                color="inherit" 
                size="small" 
                onClick={() => setShowCapacityConfig(true)}
              >
                Configure
              </Button>
            </Box>
          }
        >
          <Typography variant="body2">
            <strong>Using fallback capacity data.</strong> Azure DevOps capacity API is not accessible. 
            Click "Diagnose" to troubleshoot or "Configure" to set capacities manually.
          </Typography>
        </Alert>
      )}

      {/* Sprint Overview */}
      <Paper elevation={2} sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
          Sprint Capacity Overview
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <ScheduleIcon sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6">{capacityData?.totalWorkingDays}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Working Days</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <PersonIcon sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6">{capacityData?.teamCapacities?.length}</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Team Members</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <AssignmentIcon sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6">{totalTeamCapacity}h</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Total Capacity</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={3}>
            <Box sx={{ textAlign: 'center' }}>
              <TrendingUpIcon sx={{ fontSize: 32, mb: 1 }} />
              <Typography variant="h6">{Math.round(overallUtilization)}%</Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>Team Utilization</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Individual Team Member Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {utilizationData.map((data, index) => (
          <Grid item xs={12} md={6} lg={4} key={data.member.id || index}>
            <Card 
              elevation={3}
              sx={{ 
                height: '100%',
                transition: 'transform 0.2s ease-in-out, border-color 0.3s ease',
                border: data.isCapacityMismatch ? `2px solid ${
                  data.capacityMismatchSeverity === 'high' ? '#f44336' : 
                  data.capacityMismatchSeverity === 'medium' ? '#ff9800' : 
                  '#ffeb3b'
                }` : '1px solid #e0e0e0',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 6
                }
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar 
                    {...stringAvatar(data.member.displayName)} 
                    sx={{ mr: 2 }}
                  />
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {data.member.displayName}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Chip
                        label={getUtilizationStatus(data.utilization)}
                        size="small"
                        sx={{
                          backgroundColor: getUtilizationColor(data.utilization),
                          color: 'white',
                          fontWeight: 600,
                          fontSize: '0.75rem'
                        }}
                      />
                      {data.isCapacityMismatch && (
                        <Chip
                          label={`⚠️ ${data.capacityMismatchSeverity.toUpperCase()} MISMATCH`}
                          size="small"
                          sx={{
                            backgroundColor: data.capacityMismatchSeverity === 'high' ? '#f44336' : 
                              data.capacityMismatchSeverity === 'medium' ? '#ff9800' : '#ffeb3b',
                            color: data.capacityMismatchSeverity === 'low' ? '#000' : 'white',
                            fontWeight: 600,
                            fontSize: '0.65rem'
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  sx={{ ml: 2, minWidth: 120 }}
                  onClick={() => handleMemberCornerClick(data.member)}
                >
                  Agentic AI & ADO Links
                </Button>
                <Divider sx={{ mb: 2 }} />

                {/* Enhanced Capacity Details */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Daily Capacity</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {data.capacity.totalCapacityPerDay}h/day
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Daily Burn Rate</Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 600,
                        color: data.isCapacityMismatch ? 
                          (data.dailyBurnRate < data.expectedDailyBurn * 0.7 ? '#f44336' : '#ff9800') : 
                          '#4caf50'
                      }}
                    >
                      {data.dailyBurnRate.toFixed(1)}h/day
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Working Days</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {data.capacity.workingDays} days
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Progress</Typography>
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 600,
                        color: data.burnRateAnalysis?.isOnTrack ? '#4caf50' : '#f44336'
                      }}
                    >
                      {data.burnRateAnalysis?.actualProgressPercentage?.toFixed(1) ?? '0.0'}%
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Sprint Capacity</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#2196f3' }}>
                      {data.capacity.totalCapacityForSprint}h
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2" color="text.secondary">Work Allocated</Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#ff9800' }}>
                      {data.assignedEffort}h
                    </Typography>
                  </Grid>
                </Grid>

                {/* Enhanced Progress Bar with Burn Rate Analysis */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Utilization</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {data.utilization.toFixed(1)}%
                      </Typography>
                      {data.burnRateAnalysis?.isOnTrack ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', color: '#4caf50' }}>
                          <CheckCircleOutlineIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="caption">On Track</Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: 'flex', alignItems: 'center', color: '#f44336' }}>
                          <ErrorOutlineIcon sx={{ fontSize: 16, mr: 0.5 }} />
                          <Typography variant="caption">At Risk</Typography>
                        </Box>
                      )}
                    </Box>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(data.utilization, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      backgroundColor: '#f5f5f5',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: getUtilizationColor(data.utilization),
                        borderRadius: 1
                      }
                    }}
                  />
                  <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="caption" color="text.secondary">
                      Expected: {data.burnRateAnalysis?.expectedProgressPercentage?.toFixed(1) ?? '0.0'}%
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Actual: {data.burnRateAnalysis?.actualProgressPercentage?.toFixed(1) ?? '0.0'}%
                    </Typography>
                  </Box>
                </Box>

                {/* Enhanced Capacity Mismatch Details and Recommendations */}
                {/* Capacity Mismatch Toggle */}
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showCapacityMismatch}
                        onChange={() => setShowCapacityMismatch(!showCapacityMismatch)}
                        color="warning"
                      />
                    }
                    label="Show Capacity Mismatch Details"
                  />
                  {showCapacityMismatch && data.isCapacityMismatch && (
                    <Alert 
                      severity={data.capacityMismatchSeverity === 'high' ? 'error' : 
                               data.capacityMismatchSeverity === 'medium' ? 'warning' : 'info'}
                      sx={{ fontSize: '0.8rem' }}
                    >
                      <AlertTitle sx={{ fontSize: '0.85rem', fontWeight: 600 }}>
                        Capacity Mismatch Detected - {data.capacityMismatchSeverity.toUpperCase()}
                      </AlertTitle>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        <strong>Daily:</strong> {data.dailyBurnRate.toFixed(1)}h/day vs {data.expectedDailyBurn}h/day expected<br/>
                        <strong>Cumulative:</strong> {data.burnRateAnalysis?.actualCumulativeEffort ?? 0}h vs {data.burnRateAnalysis?.expectedCumulativeEffort ?? 0}h expected
                        {(data.burnRateAnalysis?.expectedCumulativeEffort ?? 0) > 0 && (
                          <span> ({(((data.burnRateAnalysis?.actualCumulativeEffort ?? 0) - (data.burnRateAnalysis?.expectedCumulativeEffort ?? 0)) / (data.burnRateAnalysis?.expectedCumulativeEffort ?? 1) * 100).toFixed(1)}% variance)</span>
                        )}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        📝 {data.burnRateAnalysis?.recommendation ?? 'Analysis pending...'}
                      </Typography>
                    </Alert>
                  )}
                </Box>
  {/* AI Recommendation Dialog using new component */}
  <AIRecommendationDialog 
    open={showRecommendationDialog}
    onClose={() => setShowRecommendationDialog(false)}
    selectedMember={selectedMember}
    aiRecommendations={aiRecommendations}
    chatMessages={chatMessages}
    chatInput={chatInput}
    isChatLoading={isChatLoading}
    onChatInputChange={(e) => setChatInput(e.target.value)}
    onSendChat={handleSendChat}
    expandedSections={expandedSections}
    toggleSection={toggleSection}
  />

                {/* Enhanced Sprint Progress Details with Cumulative Analysis */}
                <Box sx={{ mt: 2, p: 2, backgroundColor: '#f8f9fa', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, color: '#495057' }}>
                    Sprint Progress Analysis
                  </Typography>
                  <Grid container spacing={1} sx={{ mb: 2 }}>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Days In</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {data.burnRateAnalysis?.daysIntoSprint ?? 0} days
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Pace</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: data.burnRateAnalysis?.isOnTrack ? '#4caf50' : '#f44336' }}>
                        {data.burnRateAnalysis?.isOnTrack ? 'On Track' : 'Behind'}
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Expected</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {data.burnRateAnalysis?.expectedCumulativeEffort ?? 0}h
                      </Typography>
                    </Grid>
                    <Grid item xs={3}>
                      <Typography variant="caption" color="text.secondary">Actual</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: (data.burnRateAnalysis?.actualCumulativeEffort ?? 0) >= (data.burnRateAnalysis?.expectedCumulativeEffort ?? 0) ? '#4caf50' : '#f44336' }}>
                        {data.burnRateAnalysis?.actualCumulativeEffort ?? 0}h
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  {/* Cumulative Burn Progress Bar */}
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">Cumulative Progress</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }}>
                        {(data.burnRateAnalysis?.expectedCumulativeEffort ?? 0) > 0 
                          ? Math.round(((data.burnRateAnalysis?.actualCumulativeEffort ?? 0) / (data.burnRateAnalysis?.expectedCumulativeEffort ?? 1)) * 100)
                          : 0}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={(data.burnRateAnalysis?.expectedCumulativeEffort ?? 0) > 0 
                        ? Math.min(((data.burnRateAnalysis?.actualCumulativeEffort ?? 0) / (data.burnRateAnalysis?.expectedCumulativeEffort ?? 1)) * 100, 100)
                        : 0}
                      sx={{
                        height: 6,
                        borderRadius: 1,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: (data.burnRateAnalysis?.actualCumulativeEffort ?? 0) >= (data.burnRateAnalysis?.expectedCumulativeEffort ?? 0) * 0.85 
                            ? '#4caf50' : (data.burnRateAnalysis?.actualCumulativeEffort ?? 0) >= (data.burnRateAnalysis?.expectedCumulativeEffort ?? 0) * 0.6
                            ? '#ff9800' : '#f44336',
                          borderRadius: 1
                        }
                      }}
                    />
                  </Box>

                  {/* Daily Burn History Summary */}
                  {data.burnRateAnalysis.dailyBurnHistory && data.burnRateAnalysis.dailyBurnHistory.length > 0 && data.burnRateAnalysis.dailyBurnHistory.some(day => day.dailyBurn > 0) && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                        Daily Burn History
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {data.burnRateAnalysis.dailyBurnHistory
                          .filter(day => !day.isWeekend)
                          .slice(-5)
                          .map((day, index) => (
                            <Chip
                              key={index}
                              label={`${day.dailyBurn.toFixed(1)}h`}
                              size="small"
                              sx={{
                                fontSize: '0.65rem',
                                height: 20,
                                backgroundColor: day.dailyBurn >= data.expectedDailyBurn * 0.8 
                                  ? '#e8f5e8' : '#fff3e0',
                                color: day.dailyBurn >= data.expectedDailyBurn * 0.8 
                                  ? '#2e7d32' : '#f57c00'
                              }}
                            />
                          ))}
                      </Box>
                    </Box>
                  )}
                </Box>

                {/* Completion Progress */}
                <Box sx={{ mt: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Completion
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {data.assignedEffort > 0 ? Math.round((data.completedEffort / data.assignedEffort) * 100) : 0}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={data.assignedEffort > 0 ? Math.min((data.completedEffort / data.assignedEffort) * 100, 100) : 0}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: '#ecf0f1',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 4,
                        backgroundColor: '#4caf50'
                      }
                    }}
                  />
                </Box>

                {/* AI Recommendations Section */}
                {aiRecommendationsEnabled && (() => {
                  const memberRecommendation = aiRecommendations.find(rec => 
                    rec.member === data.member.displayName
                  );
                  
                  if (memberRecommendation) {
                    return (
                      <Box sx={{ 
                        mt: 2, 
                        p: 2, 
                        borderRadius: 2,
                        background: memberRecommendation.utilizationLevel === 'optimal' 
                          ? 'linear-gradient(135deg, #e8f5e8 0%, #f1f8e9 100%)'
                          : memberRecommendation.utilizationLevel === 'over'
                          ? 'linear-gradient(135deg, #ffebee 0%, #fce4ec 100%)'
                          : 'linear-gradient(135deg, #fff3e0 0%, #fdf7e8 100%)',
                        border: `1px solid ${
                          memberRecommendation.utilizationLevel === 'optimal' ? '#c8e6c9' :
                          memberRecommendation.utilizationLevel === 'over' ? '#ffcdd2' : '#ffcc02'
                        }`
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                          <SmartToyIcon sx={{ 
                            fontSize: 16, 
                            mr: 1, 
                            color: memberRecommendation.utilizationLevel === 'optimal' ? '#4caf50' :
                                   memberRecommendation.utilizationLevel === 'over' ? '#f44336' : '#ff9800'
                          }} />
                          <Typography variant="caption" sx={{ 
                            fontWeight: 600,
                            color: memberRecommendation.utilizationLevel === 'optimal' ? '#2e7d32' :
                                   memberRecommendation.utilizationLevel === 'over' ? '#d32f2f' : '#f57c00'
                          }}>
                            AI Recommendation {memberRecommendation.priority === 'high' && '⚠️'}
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" sx={{ 
                          fontSize: '0.8rem', 
                          lineHeight: 1.3,
                          mb: 1,
                          color: '#424242'
                        }}>
                          {memberRecommendation.recommendation.length > 120 
                            ? `${memberRecommendation.recommendation.substring(0, 120)}...` 
                            : memberRecommendation.recommendation}
                        </Typography>

                        {/* Quick Action Suggestions */}
                        {memberRecommendation.suggestedActions.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" sx={{ 
                              fontWeight: 600, 
                              color: '#666',
                              display: 'block',
                              mb: 0.5
                            }}>
                              Quick Actions:
                            </Typography>
                            {memberRecommendation.suggestedActions.slice(0, 2).map((action: string, idx: number) => (
                              <Chip
                                key={idx}
                                label={action.length > 40 ? `${action.substring(0, 40)}...` : action}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  mr: 0.5,
                                  mb: 0.5,
                                  backgroundColor: 'rgba(255,255,255,0.7)',
                                  border: '1px solid rgba(0,0,0,0.1)'
                                }}
                              />
                            ))}
                            {memberRecommendation.suggestedActions.length > 2 && (
                              <Chip
                                label={`+${memberRecommendation.suggestedActions.length - 2} more`}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  backgroundColor: 'rgba(0,0,0,0.05)',
                                  border: '1px solid rgba(0,0,0,0.1)'
                                }}
                              />
                            )}
                          </Box>
                        )}

                        {/* Task Recommendations Preview */}
                        {memberRecommendation.tasksToRemove && memberRecommendation.tasksToRemove.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" sx={{ 
                              fontWeight: 600, 
                              color: '#d32f2f',
                              display: 'block',
                              mb: 0.5
                            }}>
                              Consider Removing:
                            </Typography>
                            {memberRecommendation.tasksToRemove.slice(0, 1).map((task: any, idx: number) => (
                              <Chip
                                key={idx}
                                label={task.title.length > 35 ? `${task.title.substring(0, 35)}...` : task.title}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  mr: 0.5,
                                  backgroundColor: '#ffebee',
                                  color: '#d32f2f',
                                  border: '1px solid #ffcdd2'
                                }}
                              />
                            ))}
                            {memberRecommendation.tasksToRemove.length > 1 && (
                              <Chip
                                label={`+${memberRecommendation.tasksToRemove.length - 1} more tasks`}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  backgroundColor: '#ffebee',
                                  color: '#d32f2f',
                                  border: '1px solid #ffcdd2'
                                }}
                              />
                            )}
                          </Box>
                        )}

                        {memberRecommendation.tasksToAssign && memberRecommendation.tasksToAssign.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="caption" sx={{ 
                              fontWeight: 600, 
                              color: '#2e7d32',
                              display: 'block',
                              mb: 0.5
                            }}>
                              Consider Assigning:
                            </Typography>
                            {memberRecommendation.tasksToAssign.slice(0, 1).map((task: any, idx: number) => (
                              <Chip
                                key={idx}
                                label={task.title.length > 35 ? `${task.title.substring(0, 35)}...` : task.title}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  mr: 0.5,
                                  backgroundColor: '#e8f5e8',
                                  color: '#2e7d32',
                                  border: '1px solid #c8e6c9'
                                }}
                              />
                            ))}
                            {memberRecommendation.tasksToAssign.length > 1 && (
                              <Chip
                                label={`+${memberRecommendation.tasksToAssign.length - 1} more tasks`}
                                size="small"
                                sx={{
                                  fontSize: '0.65rem',
                                  height: 18,
                                  backgroundColor: '#e8f5e8',
                                  color: '#2e7d32',
                                  border: '1px solid #c8e6c9'
                                }}
                              />
                            )}
                          </Box>
                        )}
                      </Box>
                    );
                  } else if (aiRecommendationsLoading) {
                    return (
                      <Box sx={{ 
                        mt: 2, 
                        p: 2, 
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #f5f5f5 0%, #fafafa 100%)',
                        border: '1px solid #e0e0e0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <CircularProgress size={16} sx={{ mr: 1 }} />
                        <Typography variant="caption" color="text.secondary">
                          Generating AI recommendations...
                        </Typography>
                      </Box>
                    );
                  }
                  return null;
                })()}

                {/* Days Off */}
                {data.capacity.daysOff.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Days Off:
                    </Typography>
                    {data.capacity.daysOff.map((dayOff, idx) => (
                      <Chip
                        key={idx}
                        label={`${new Date(dayOff.start).toLocaleDateString()} - ${new Date(dayOff.end).toLocaleDateString()}`}
                        size="small"
                        variant="outlined"
                        sx={{ mr: 1, mb: 1 }}
                      />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Removed Detailed Capacity Breakdown and Detailed AI Capacity Recommendations as requested */}

      {/* Team Capacity Configuration Dialog */}
      <TeamCapacityConfigForm
        open={showCapacityConfig}
        onClose={() => setShowCapacityConfig(false)}
        onSave={(capacities) => {
          console.log('Team capacity configuration saved:', capacities);
          // Refresh capacity data to use new configuration
          handleRefresh();
        }}
      />

      {/* Diagnostics Dialog */}
      {showDiagnostics && (
        <Box 
          sx={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            bgcolor: 'rgba(0,0,0,0.5)', 
            zIndex: 1300,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            p: 2
          }}
          onClick={() => setShowDiagnostics(false)}
        >
          <Box 
            sx={{ 
              maxWidth: 800, 
              width: '100%', 
              maxHeight: '90vh', 
              overflow: 'auto' 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <AdoCapacityDiagnostics />
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Button 
                variant="contained" 
                onClick={() => setShowDiagnostics(false)}
              >
                Close
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default CapacityUtilization;
