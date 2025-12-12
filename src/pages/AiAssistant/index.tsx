import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Box, 
  CircularProgress, 
  Tabs, 
  Tab
} from '@mui/material';

import AiAssistantPanel from '../../components/dashboard/AiAssistantPanel';
import AiScrumAssistant from '../../components/dashboard/AiScrumAssistant';
import EnhancedAdhocAssignmentChat from '../../components/chat/EnhancedAdhocAssignmentChat';
import CentralizedAgenticChat from '../../components/chat/CentralizedAgenticChat';
import adoService, { TeamMember, TeamCapacity, WorkItem, Sprint } from '../../services/adoService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`ai-assistant-tabpanel-${index}`}
      aria-labelledby={`ai-assistant-tab-${index}`}
      {...other}
      style={{ height: 'calc(100% - 48px)' }}
    >
      {value === index && (
        <Box sx={{ pt: 2, height: '100%' }}>
          {children}
        </Box>
      )}
    </div>
  );
};

const a11yProps = (index: number) => {
  return {
    id: `ai-assistant-tab-${index}`,
    'aria-controls': `ai-assistant-tabpanel-${index}`,
  };
};

const AiAssistantPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  
  // State for Team data - used by both Chat and Enhanced Assignment tabs
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamCapacity, setTeamCapacity] = useState<TeamCapacity[] | null>(null);
  const [sprintWorkItems, setSprintWorkItems] = useState<WorkItem[]>([]);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);

  // Handle task assignment from chat
  const handleAssignTask = async (workItemId: string, memberId: string) => {
    console.log(`Task ${workItemId} assigned to team member ${memberId}`);
    // Here you can add logic to update UI, show notifications, etc.
    // For example, you could refresh work items or show a snackbar
  };

  // Load team data for Team Chat and Enhanced Assignment Chat
  useEffect(() => {
    const loadTeamData = async () => {
      try {
        // Get current sprint
        const sprints = await adoService.getSprints();
        const activeSprint = sprints.find(s => s.state === 'current') || sprints[0];
        if (activeSprint) {
          setCurrentSprint(activeSprint);
          
          // Get team members
          const members = await adoService.getTeamMembers();
          setTeamMembers(members);
          
          // Get team capacity
          const capacityData = await adoService.getSprintCapacity(activeSprint.id);
          setTeamCapacity(capacityData.teamCapacities);
          
          // Get sprint work items
          const workItems = await adoService.getSprintWorkItems(activeSprint.id);
          setSprintWorkItems(workItems);
          
          console.log('✅ Team data loaded successfully:', {
            sprint: activeSprint.name,
            members: members.length,
            capacities: capacityData.teamCapacities?.length || 0,
            workItems: workItems.length
          });
        }
      } catch (error) {
        console.error('❌ Error loading team data:', error);
        // Set empty arrays to prevent undefined errors
        setTeamMembers([]);
        setTeamCapacity([]);
        setSprintWorkItems([]);
        setCurrentSprint(null);
      }
    };

    if (tabValue === 0 || tabValue === 3) { // Load when Team Chat (0) or Enhanced Assignment (3) tab is active
      loadTeamData();
    }
  }, [tabValue]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ flexGrow: 1, height: 'calc(100vh - 120px)' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          AI Assistant
        </Typography>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="ai assistant tabs">
          <Tab label="General Chat" {...a11yProps(0)} />
          <Tab label="Sprint Analysis" {...a11yProps(1)} />
          <Tab label="Work Item Suggestions" {...a11yProps(2)} />
          <Tab label="🎯 Enhanced Assignment" {...a11yProps(3)} />
        </Tabs>
      </Box>
      
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ height: '100%' }}>
          {teamMembers.length > 0 ? (
            <CentralizedAgenticChat
              teamMembers={teamMembers}
              teamCapacity={teamCapacity?.map(tc => ({
                ...tc,
                allocatedCapacity: tc.totalCapacityForSprint - (tc.totalAvailableCapacity || 0)
              }))}
              sprint={currentSprint}
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
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Loading team data for sprint analysis...
              </Typography>
            </Box>
          )}
        </Box>
      </TabPanel>
      
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ height: '100%' }}>
          <AiScrumAssistant />
        </Box>
      </TabPanel>
      
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ height: '100%' }}>
          <AiAssistantPanel />
        </Box>
      </TabPanel>
      
      <TabPanel value={tabValue} index={3}>
        <Box sx={{ height: '100%' }}>
          {teamMembers.length > 0 ? (
            <EnhancedAdhocAssignmentChat
              teamMembers={teamMembers}
              teamCapacity={teamCapacity}
              sprintWorkItems={sprintWorkItems}
              sprint={currentSprint}
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
              <Typography variant="body1" sx={{ ml: 2 }}>
                Loading team data for enhanced assignment analysis...
              </Typography>
            </Box>
          )}
        </Box>
      </TabPanel>
    </Box>
);
};

export default AiAssistantPage;
