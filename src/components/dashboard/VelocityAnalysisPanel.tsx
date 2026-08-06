import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  LinearProgress,
  Avatar
} from '@mui/material';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';
import adoService, { WorkItem } from '../../services/adoService';

interface VelocityData {
  sprint: string;
  totalStoryPoints: number;
  completedStoryPoints: number;
  totalHours: number;
  completedHours: number;
  teamVelocity: number;
}

interface UserVelocityData {
  userName: string;
  assigned: number;
  completed: number;
  pending: number;
  stale: number;
  completedHours: number;
  velocityPoints: number;
}

interface VelocityAnalysisPanelProps {
  workItems: WorkItem[];
}

const VelocityAnalysisPanel: React.FC<VelocityAnalysisPanelProps> = ({ workItems }) => {
  const [velocityHistory, setVelocityHistory] = useState<VelocityData[]>([]);
  const [userVelocities, setUserVelocities] = useState<UserVelocityData[]>([]);
  const [averageVelocity, setAverageVelocity] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  const calculateUserVelocities = useCallback(() => {
    const userStats: { [key: string]: UserVelocityData } = {};
    
    workItems?.forEach(item => {
      if (item.assignedTo && item.effort) {
        const userName = item.assignedTo.split('<')[0].trim();
        
        if (!userStats[userName]) {
          userStats[userName] = {
            userName,
            assigned: 0,
            completed: 0,
            pending: 0,
            stale: 0,
            completedHours: 0,
            velocityPoints: 0
          };
        }
        
        userStats[userName].assigned += 1;
        
        if (item.state === 'Done' || item.state === 'Completed') {
          userStats[userName].completed += 1;
          userStats[userName].completedHours += (item.effort * 4); // 4 hours per story point
          userStats[userName].velocityPoints += item.effort;
        } else if (item.state === 'Active' || item.state === 'In Progress') {
          // Check if stale (not updated in 3+ days)
          const lastUpdated = new Date(item.updatedDate);
          const daysSinceUpdate = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysSinceUpdate >= 3) {
            userStats[userName].stale += 1;
          } else {
            userStats[userName].pending += 1;
          }
        } else {
          userStats[userName].pending += 1;
        }
      }
    });
    
    setUserVelocities(Object.values(userStats));
  }, [workItems]);

  const fetchVelocityData = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get sprints for the past 3 sprints + current
      const sprints = await adoService.getSprints();
      const recentSprints = sprints.slice(0, 4); // Last 4 sprints including current
      
      // Calculate velocity for each sprint
      const velocityData: VelocityData[] = [];
      
      for (const sprint of recentSprints) {
        try {
          const sprintWorkItems = await adoService.getSprintWorkItems(sprint.id);
          // Note: We don't need individual sprint stats for velocity calculation
          
          const totalStoryPoints = sprintWorkItems.reduce((sum, item) => sum + (item.effort || 0), 0);
          const completedStoryPoints = sprintWorkItems
            .filter(item => item.state === 'Done' || item.state === 'Completed')
            .reduce((sum, item) => sum + (item.effort || 0), 0);
          
          // Estimate total hours from story points (4 hours per story point)
          const totalHours = totalStoryPoints * 4;
          const completedHours = completedStoryPoints * 4;
          
          velocityData.push({
            sprint: sprint.name,
            totalStoryPoints,
            completedStoryPoints,
            totalHours,
            completedHours,
            teamVelocity: completedStoryPoints
          });
        } catch (error) {
          console.warn(`Failed to fetch data for sprint ${sprint.name}:`, error);
        }
      }
      
      setVelocityHistory(velocityData);
      
      // Calculate average velocity over past 3 sprints (excluding current)
      const pastSprints = velocityData.slice(1, 4); // Skip current sprint
      const avgVelocity = pastSprints.length > 0 
        ? pastSprints.reduce((sum, sprint) => sum + sprint.teamVelocity, 0) / pastSprints.length
        : 0;
      setAverageVelocity(avgVelocity);
      
      // Calculate individual user velocities
      calculateUserVelocities();
      
    } catch (error) {
      console.error('Error fetching velocity data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [calculateUserVelocities]); // Add calculateUserVelocities as dependency

  useEffect(() => {
    fetchVelocityData();
  }, [fetchVelocityData]);

  const stringToColor = (string: string) => {
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
      hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      color += `00${value.toString(16)}`.slice(-2);
    }
    return color;
  };

  const stringAvatar = (name: string) => {
    const nameParts = name.split(' ');
    return {
      sx: { bgcolor: stringToColor(name), width: 32, height: 32, fontSize: '0.875rem' },
      children: nameParts.length > 1 
        ? `${nameParts[0][0]}${nameParts[1][0]}`
        : name.length > 0 ? name[0] : '?',
    };
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography>Loading velocity analysis...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
      {/* Velocity Overview */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e3f2fd', textAlign: 'center' }}>
            <Typography variant="h4">{velocityHistory[0]?.teamVelocity || 0}</Typography>
            <Typography variant="body2">Current Sprint Velocity</Typography>
            <Typography variant="caption" color="text.secondary">Story Points</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#e8f5e9', textAlign: 'center' }}>
            <Typography variant="h4">{averageVelocity.toFixed(1)}</Typography>
            <Typography variant="body2">Average Velocity</Typography>
            <Typography variant="caption" color="text.secondary">Past 3 Sprints</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#fff3e0', textAlign: 'center' }}>
            <Typography variant="h4">{velocityHistory[0]?.completedHours || 0}h</Typography>
            <Typography variant="body2">Completed Hours</Typography>
            <Typography variant="caption" color="text.secondary">Current Sprint</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Velocity Trend Chart */}
      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Velocity Trend</Typography>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={velocityHistory.slice().reverse()}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sprint" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="teamVelocity" 
              stroke="#8884d8" 
              strokeWidth={2}
              name="Team Velocity (Story Points)"
            />
            <Line 
              type="monotone" 
              dataKey="completedHours" 
              stroke="#82ca9d" 
              strokeWidth={2}
              name="Completed Hours"
            />
          </LineChart>
        </ResponsiveContainer>
      </Paper>

      {/* Individual User Velocity - Team Tab UI Style */}
      <Paper elevation={1} sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Individual Team Member Velocity</Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Team Member</TableCell>
                <TableCell align="center">Assigned</TableCell>
                <TableCell align="center">Completed</TableCell>
                <TableCell align="center">Pending</TableCell>
                <TableCell align="center">Stale</TableCell>
                <TableCell align="center">Velocity (Points)</TableCell>
                <TableCell align="center">Completed Hours</TableCell>
                <TableCell>Performance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {userVelocities.map((user) => {
                const completionRate = user.assigned > 0 ? (user.completed / user.assigned) * 100 : 0;
                
                return (
                  <TableRow key={user.userName}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar {...stringAvatar(user.userName)} />
                        <Typography variant="body2">{user.userName}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={user.assigned} size="small" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={user.completed} size="small" color="success" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={user.pending} size="small" color="warning" />
                    </TableCell>
                    <TableCell align="center">
                      <Chip 
                        label={user.stale} 
                        size="small" 
                        color={user.stale > 0 ? "error" : "default"}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                        {user.velocityPoints}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">
                        {user.completedHours}h
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 120 }}>
                        <Box sx={{ width: '100%' }}>
                          <LinearProgress 
                            variant="determinate" 
                            value={Math.min(completionRate, 100)}
                            sx={{
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: '#e0e0e0',
                              '& .MuiLinearProgress-bar': {
                                backgroundColor: 
                                  completionRate >= 80 ? '#4caf50' :
                                  completionRate >= 60 ? '#8bc34a' :
                                  completionRate >= 40 ? '#ff9800' : '#f44336'
                              }
                            }}
                          />
                        </Box>
                        <Typography variant="caption" sx={{ minWidth: 35 }}>
                          {completionRate.toFixed(0)}%
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        
        {userVelocities.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body1" color="text.secondary">
              No team member data available
            </Typography>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default VelocityAnalysisPanel;
