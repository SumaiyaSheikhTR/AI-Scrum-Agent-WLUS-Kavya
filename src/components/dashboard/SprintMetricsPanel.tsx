import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  LinearProgress, 
  Divider,
  Tooltip,
  CircularProgress
} from '@mui/material';
import adoService, { SprintStatistics, Sprint, WorkItem } from '../../services/adoService';

interface BurndownDataPoint {
  day: string;
  actual: number;
  ideal: number;
}

interface VelocityDataPoint {
  sprint: string;
  velocity: number;
}

interface SprintMetricsPanelProps {
  sprintStats: SprintStatistics | null;
  sprintName: string;
}

const SprintMetricsPanel: React.FC<SprintMetricsPanelProps> = ({ sprintStats, sprintName }) => {
  const [burndownData, setBurndownData] = useState<BurndownDataPoint[]>([]);
  const [velocityData, setVelocityData] = useState<VelocityDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (sprintStats) {
      void generateBurndownData();
      void fetchVelocityData();
    }
  }, [sprintStats, sprintName]);
  
  const generateBurndownData = async () => {
    if (!sprintStats) return;

    // Build burndown from real sprint dates + current ADO effort stats
    let totalDays = 10;
    let elapsedDays = 0;
    try {
      const currentSprint = await adoService.getCurrentSprint();
      if (currentSprint?.startDate && currentSprint?.endDate) {
        const start = new Date(currentSprint.startDate).getTime();
        const end = new Date(currentSprint.endDate).getTime();
        totalDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
        elapsedDays = Math.min(
          totalDays,
          Math.max(0, Math.ceil((Date.now() - start) / (1000 * 60 * 60 * 24)))
        );
      }
    } catch (error) {
      console.warn('Could not load sprint dates for burndown; using effort-based estimate', error);
    }

    const data: BurndownDataPoint[] = [];
    const startEffort = sprintStats.totalEffort;
    const idealBurnPerDay = totalDays > 0 ? startEffort / totalDays : 0;
    const burnedSoFar = sprintStats.completedEffort;
    const remainingEffort = sprintStats.remainingEffort;
    const estimatedCurrentDay =
      elapsedDays > 0
        ? elapsedDays
        : Math.min(
            Math.max(1, Math.ceil(burnedSoFar / Math.max(idealBurnPerDay, 0.0001))),
            totalDays
          );

    for (let i = 0; i < totalDays; i++) {
      const day = i + 1;
      const ideal = Math.max(0, startEffort - idealBurnPerDay * day);

      let actual: number;
      if (day < estimatedCurrentDay) {
        // Deterministic linear burn to current completed effort (no random dummy noise)
        actual = startEffort - (burnedSoFar / estimatedCurrentDay) * day;
      } else if (day === estimatedCurrentDay) {
        actual = remainingEffort;
      } else {
        const projectedBurn = (burnedSoFar / Math.max(estimatedCurrentDay, 1)) * day;
        actual = Math.max(0, startEffort - projectedBurn);
      }

      data.push({
        day: `Day ${day}`,
        actual: Math.round(actual),
        ideal: Math.round(ideal),
      });
    }

    setBurndownData(data);
  };

  const fetchVelocityData = async () => {
    try {
      setIsLoading(true);

      const allSprints = await adoService.getSprints();
      const pastSprints = allSprints
        .filter((sprint) => sprint.state === 'past' || sprint.state === 'current')
        .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
        .slice(-5);

      if (pastSprints.length === 0) {
        setVelocityData(
          sprintStats
            ? [{ sprint: sprintName || 'Current', velocity: sprintStats.completedEffort || 0 }]
            : []
        );
        return;
      }

      const velocityPromises = pastSprints.map(async (sprint) => {
        const stats = await adoService.getSprintStatistics(sprint.id);
        return {
          sprint: sprint.name,
          velocity: stats.completedEffort,
        };
      });
      
      const pastVelocities = await Promise.all(velocityPromises);
      
      // Add current sprint
      pastVelocities.push({
        sprint: 'Current',
        velocity: sprintStats?.completedEffort || 0
      });
      
      setVelocityData(pastVelocities);
    } catch (error) {
      console.error('Error fetching velocity data:', error);
      // No synthetic fallback — show real current sprint only when available
      setVelocityData(
        sprintStats
          ? [{ sprint: sprintName || 'Current', velocity: sprintStats.completedEffort || 0 }]
          : []
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  if (!sprintStats) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="body1" color="text.secondary">
          No sprint statistics available
        </Typography>
      </Box>
    );
  }
  
  if (isLoading && (!burndownData.length || !velocityData.length)) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress size={24} sx={{ mr: 1 }} />
        <Typography variant="body1" color="text.secondary">
          Loading sprint metrics...
        </Typography>
      </Box>
    );
  }

  // Calculate completion percentage
  const completionPercentage = Math.round((sprintStats.completedWorkItems / (sprintStats.totalWorkItems || 1)) * 100);
  
  // Calculate effort completion percentage
  const effortCompletionPercentage = Math.round((sprintStats.completedEffort / (sprintStats.totalEffort || 1)) * 100);

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Grid container spacing={2}>
        {/* Sprint Progress */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Sprint Progress
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box sx={{ flexGrow: 1, mr: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={completionPercentage} 
                  sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: completionPercentage > 90 ? '#4caf50' : '#2196f3',
                    }
                  }} 
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {completionPercentage}%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {sprintStats.completedWorkItems} of {sprintStats.totalWorkItems} work items completed
            </Typography>
          </Paper>
        </Grid>

        {/* Effort Burndown */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Effort Burndown
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box sx={{ flexGrow: 1, mr: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={effortCompletionPercentage} 
                  sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: effortCompletionPercentage > 90 ? '#4caf50' : '#ff9800',
                    }
                  }} 
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {effortCompletionPercentage}%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              {sprintStats.completedEffort} of {sprintStats.totalEffort} story points completed
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Remaining effort: {sprintStats.remainingEffort} points
            </Typography>
          </Paper>
        </Grid>

        {/* Burndown Chart (simplified visualization) */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Burndown Trend
            </Typography>
            <Box sx={{ height: 120, display: 'flex', alignItems: 'flex-end', mt: 2 }}>
              {burndownData.map((day, index) => (
                <Tooltip 
                  key={index} 
                  title={`${day.day}: Actual ${day.actual}, Ideal ${day.ideal}`}
                  arrow
                >
                  <Box 
                    sx={{ 
                      width: `${100 / burndownData.length}%`, 
                      height: `${(day.actual / 80) * 100}%`,
                      backgroundColor: day.actual <= day.ideal ? '#4caf50' : '#ff9800',
                      mx: 0.5,
                      borderTopLeftRadius: 2,
                      borderTopRightRadius: 2,
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        width: '80%',
                        height: 2,
                        backgroundColor: '#1976d2',
                        top: `${(day.ideal / 80) * 100}%`,
                        left: '10%',
                      }
                    }} 
                  />
                </Tooltip>
              ))}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="caption" color="text.secondary">Start</Typography>
              <Typography variant="caption" color="text.secondary">End</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: '#ff9800', mr: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>Actual</Typography>
              <Box sx={{ width: 12, height: 2, backgroundColor: '#1976d2', mr: 1 }} />
              <Typography variant="caption" color="text.secondary">Ideal</Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Velocity Chart (simplified visualization) */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Velocity Trend
            </Typography>
            <Box sx={{ height: 120, display: 'flex', alignItems: 'flex-end', mt: 2 }}>
              {velocityData.map((sprint, index) => (
                <Tooltip 
                  key={index} 
                  title={`${sprint.sprint}: ${sprint.velocity} points`}
                  arrow
                >
                  <Box 
                    sx={{ 
                      width: `${100 / velocityData.length}%`, 
                      height: `${(sprint.velocity / 35) * 100}%`,
                      backgroundColor: index === velocityData.length - 1 ? '#2196f3' : '#90caf9',
                      mx: 0.5,
                      borderTopLeftRadius: 2,
                      borderTopRightRadius: 2,
                    }} 
                  />
                </Tooltip>
              ))}
            </Box>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>
                <Typography variant="body2">Current Velocity</Typography>
                <Typography variant="h6" color="primary">
                  {velocityData.length > 0 ? velocityData[velocityData.length - 1].velocity : 0} points
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" align="right">Average Velocity</Typography>
                <Typography variant="h6" color="text.secondary" align="right">
                  {velocityData.length > 0 
                    ? Math.round(velocityData.reduce((sum, item) => sum + item.velocity, 0) / velocityData.length) 
                    : 0} points
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>

        {/* Team Capacity */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Team Capacity
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Box sx={{ flexGrow: 1, mr: 1 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={65} 
                  sx={{ 
                    height: 10, 
                    borderRadius: 5,
                    backgroundColor: '#e0e0e0',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: '#673ab7',
                    }
                  }} 
                />
              </Box>
              <Typography variant="body2" color="text.secondary">
                65%
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              78 of 120 hours used
            </Typography>
          </Paper>
        </Grid>

        {/* Work Item Distribution */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Work Item Distribution
            </Typography>
            <Grid container spacing={1} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 1, 
                    textAlign: 'center',
                    backgroundColor: '#e3f2fd',
                    borderRadius: 2
                  }}
                >
                  <Typography variant="h6">{sprintStats.totalWorkItems - sprintStats.inProgressWorkItems - sprintStats.completedWorkItems - sprintStats.blockedWorkItems}</Typography>
                  <Typography variant="caption">To Do</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 1, 
                    textAlign: 'center',
                    backgroundColor: '#fff3e0',
                    borderRadius: 2
                  }}
                >
                  <Typography variant="h6">{sprintStats.inProgressWorkItems}</Typography>
                  <Typography variant="caption">In Progress</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 1, 
                    textAlign: 'center',
                    backgroundColor: '#e8f5e9',
                    borderRadius: 2
                  }}
                >
                  <Typography variant="h6">{sprintStats.completedWorkItems}</Typography>
                  <Typography variant="caption">Completed</Typography>
                </Paper>
              </Grid>
              <Grid item xs={6}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 1, 
                    textAlign: 'center',
                    backgroundColor: '#ffebee',
                    borderRadius: 2
                  }}
                >
                  <Typography variant="h6">{sprintStats.blockedWorkItems}</Typography>
                  <Typography variant="caption">Blocked</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SprintMetricsPanel;
