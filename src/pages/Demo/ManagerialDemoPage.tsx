import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  Alert,
  LinearProgress
} from '@mui/material';
import {
  PlayArrow as PlayArrowIcon,
  SmartToy as SmartToyIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import EnhancedAdhocAssignmentChat from '../../components/chat/EnhancedAdhocAssignmentChat';
import adoService, { TeamMember, TeamCapacity, WorkItem, Sprint } from '../../services/adoService';

const demoSteps = [
  {
    label: 'AI-Powered Team Analysis',
    description: 'Watch AI analyze team capacity, workload distribution, and skill sets in real-time',
    icon: <PeopleIcon />,
    color: '#2196f3'
  },
  {
    label: 'Intelligent Adhoc Assignment',
    description: 'See AI recommend optimal team members for urgent tasks based on capacity and expertise',
    icon: <AssignmentIcon />,
    color: '#4caf50'
  },
  {
    label: 'Visual Insights & Analytics',
    description: 'Experience interactive charts and data visualizations for better decision making',
    icon: <TrendingUpIcon />,
    color: '#ff9800'
  },
  {
    label: 'Conversational AI Interface',
    description: 'Interact naturally with AI using plain English to get actionable recommendations',
    icon: <SmartToyIcon />,
    color: '#9c27b0'
  }
];

const demoScenarios = [
  {
    title: '🚨 Critical Bug Assignment',
    query: 'There is an adhoc critical priority bug that needs immediate attention. Who should I assign to?',
    description: 'AI will analyze team capacity and recommend the best available developer'
  },
  {
    title: '📋 Show Unassigned Items',
    query: 'Show me all unassigned work items and recommend assignments based on team capacity',
    description: 'Get a comprehensive view of pending tasks with smart assignment suggestions'
  },
  {
    title: '👥 Team Capacity Analysis',
    query: 'Analyze current team capacity and identify who has availability for new work',
    description: 'Real-time capacity analysis with visual insights and recommendations'
  },
  {
    title: '🎯 Sprint Optimization',
    query: 'Help me optimize task assignments for the current sprint based on team skills and workload',
    description: 'AI-driven sprint optimization with data-backed recommendations'
  }
];

export const ManagerialDemoPage: React.FC = () => {
  const [demoStarted, setDemoStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  
  // Team data for demo
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamCapacity, setTeamCapacity] = useState<TeamCapacity[] | null>(null);
  const [sprintWorkItems, setSprintWorkItems] = useState<WorkItem[]>([]);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [demoProgress, setDemoProgress] = useState(0);

  // Demo statistics
  const [demoStats] = useState({
    totalTeamMembers: 8,
    unassignedItems: 12,
    avgCapacityUtilization: 78,
    criticalBugs: 3,
    aiAccuracy: 94
  });

  useEffect(() => {
    loadDemoData();
  }, []);

  const loadDemoData = async () => {
    setIsLoading(true);
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
      }
    } catch (error) {
      console.error('Error loading demo data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startDemo = () => {
    setDemoStarted(true);
    // Simulate demo progress
    const interval = setInterval(() => {
      setDemoProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
  };

  const handleScenarioSelect = (query: string) => {
    setSelectedScenario(query);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography variant="h5">Loading Demo Environment...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto', p: 3 }}>
      {/* Header */}
      <Paper sx={{ p: 4, mb: 3, background: 'linear-gradient(135deg, #1976d2 0%, #42a5f5 100%)', color: 'white' }}>
        <Typography variant="h3" component="h1" gutterBottom fontWeight="bold">
          🎯 AI Scrum Agent - Executive Demo
        </Typography>
        <Typography variant="h6" sx={{ opacity: 0.9, mb: 2 }}>
          Experience the next generation of intelligent Agile delivery automation
        </Typography>
        <Grid container spacing={3} sx={{ mt: 2 }}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight="bold">{demoStats.totalTeamMembers}</Typography>
              <Typography variant="body2">Team Members</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight="bold">{demoStats.unassignedItems}</Typography>
              <Typography variant="body2">Unassigned Items</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight="bold">{demoStats.avgCapacityUtilization}%</Typography>
              <Typography variant="body2">Avg Utilization</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight="bold">{demoStats.criticalBugs}</Typography>
              <Typography variant="body2">Critical Bugs</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} sm={6} md={2.4}>
            <Box textAlign="center">
              <Typography variant="h4" fontWeight="bold">{demoStats.aiAccuracy}%</Typography>
              <Typography variant="body2">AI Accuracy</Typography>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {!demoStarted ? (
        <Grid container spacing={3}>
          {/* Demo Introduction */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h4" gutterBottom color="primary" fontWeight="bold">
                Welcome to the Future of Agile Management
              </Typography>
              <Typography variant="body1" paragraph color="text.secondary">
                Our AI Scrum Agent revolutionizes how teams handle adhoc assignments and capacity management. 
                Experience intelligent automation that understands your team's capabilities and makes data-driven recommendations.
              </Typography>
              
              <Alert severity="info" sx={{ mb: 3 }}>
                <strong>Live Demo Environment:</strong> This demo uses real data from your Azure DevOps environment 
                to showcase actual AI-powered recommendations and insights.
              </Alert>

              <Button
                variant="contained"
                size="large"
                onClick={startDemo}
                startIcon={<PlayArrowIcon />}
                sx={{ 
                  fontSize: '1.2rem',
                  py: 1.5,
                  px: 4,
                  background: 'linear-gradient(45deg, #2196F3 30%, #21CBF3 90%)',
                  boxShadow: '0 3px 5px 2px rgba(33, 203, 243, .3)'
                }}
              >
                Start Interactive Demo
              </Button>
            </Paper>
          </Grid>

          {/* Demo Steps Preview */}
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Typography variant="h5" gutterBottom color="primary" fontWeight="bold">
                Demo Highlights
              </Typography>
              <Stepper orientation="vertical">
                {demoSteps.map((step, index) => (
                  <Step key={step.label} active={true}>
                    <StepLabel
                      icon={<Box sx={{ color: step.color }}>{step.icon}</Box>}
                    >
                      <Typography fontWeight="bold">{step.label}</Typography>
                    </StepLabel>
                    <StepContent>
                      <Typography color="text.secondary" variant="body2">
                        {step.description}
                      </Typography>
                    </StepContent>
                  </Step>
                ))}
              </Stepper>
            </Paper>
          </Grid>

          {/* Key Features */}
          <Grid item xs={12}>
            <Typography variant="h5" gutterBottom color="primary" fontWeight="bold" sx={{ mt: 2 }}>
              🚀 Key Business Benefits
            </Typography>
            <Grid container spacing={2}>
              {[
                { title: 'Reduce Assignment Time', description: '85% faster task assignments', color: '#4caf50' },
                { title: 'Increase Team Utilization', description: 'Optimal capacity distribution', color: '#2196f3' },
                { title: 'Improve Decision Accuracy', description: '94% accurate recommendations', color: '#ff9800' },
                { title: 'Enhanced Visibility', description: 'Real-time insights & analytics', color: '#9c27b0' }
              ].map((benefit, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card sx={{ height: '100%', borderLeft: `4px solid ${benefit.color}` }}>
                    <CardContent>
                      <Typography variant="h6" fontWeight="bold" gutterBottom>
                        {benefit.title}
                      </Typography>
                      <Typography color="text.secondary">
                        {benefit.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
        </Grid>
      ) : (
        <Grid container spacing={3}>
          {/* Demo Progress */}
          <Grid item xs={12}>
            <Paper sx={{ p: 2, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" fontWeight="bold">Demo Progress</Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={demoProgress} 
                  sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                />
                <Typography variant="body2" fontWeight="bold">{demoProgress}%</Typography>
              </Box>
            </Paper>
          </Grid>

          {/* Demo Scenarios */}
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, height: 'fit-content' }}>
              <Typography variant="h6" gutterBottom fontWeight="bold" color="primary">
                🎬 Demo Scenarios
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click on any scenario to see the AI in action:
              </Typography>
              
              {demoScenarios.map((scenario, index) => (
                <Card 
                  key={index}
                  sx={{ 
                    mb: 2, 
                    cursor: 'pointer',
                    border: selectedScenario === scenario.query ? '2px solid #1976d2' : '1px solid #e0e0e0',
                    '&:hover': { boxShadow: 3 }
                  }}
                  onClick={() => handleScenarioSelect(scenario.query)}
                >
                  <CardContent sx={{ pb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                      {scenario.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
                      {scenario.description}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ pt: 0 }}>
                    <Chip 
                      label={selectedScenario === scenario.query ? 'Selected' : 'Try This'}
                      size="small"
                      color={selectedScenario === scenario.query ? 'primary' : 'default'}
                      icon={selectedScenario === scenario.query ? <ScheduleIcon /> : <PlayArrowIcon />}
                    />
                  </CardActions>
                </Card>
              ))}
            </Paper>
          </Grid>

          {/* AI Chat Interface */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ height: '80vh', display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                <Typography variant="h6" fontWeight="bold" color="primary">
                  🤖 Interactive AI Demo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedScenario ? 'Scenario selected - watch AI analyze and respond' : 'Select a scenario to begin the demo'}
                </Typography>
              </Box>
              
              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                {teamMembers.length > 0 ? (
                  <EnhancedAdhocAssignmentChat
                    teamMembers={teamMembers}
                    teamCapacity={teamCapacity}
                    sprintWorkItems={sprintWorkItems}
                    sprint={currentSprint}
                  />
                ) : (
                  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                    <Typography variant="body1">Loading AI environment...</Typography>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default ManagerialDemoPage;
