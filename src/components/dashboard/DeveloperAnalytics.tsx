import React from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Avatar, 
  Divider, 
  LinearProgress,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import { WorkItem } from '../../services/adoService';

interface DeveloperStats {
  name: string;
  avatar?: string;
  completedItems: number;
  inProgressItems: number;
  staleItems: number;
  totalEffort: number;
  completedEffort: number;
  averageCompletionTime: number; // in days
}

interface DeveloperAnalyticsProps {
  workItems: WorkItem[];
}

// Get initials from a name
const getInitials = (name: string | null): string => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
};

// Get random color for avatar based on name
const getAvatarColor = (name: string | null): string => {
  if (!name) return '#757575';
  
  const colors = [
    '#1976d2', // blue
    '#388e3c', // green
    '#d32f2f', // red
    '#f57c00', // orange
    '#7b1fa2', // purple
    '#0097a7', // teal
    '#c2185b', // pink
    '#5d4037', // brown
  ];
  
  // Simple hash function to get consistent color for the same name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
};

const DeveloperAnalytics: React.FC<DeveloperAnalyticsProps> = ({ workItems }) => {
  // Process work items to get developer statistics
  const getDeveloperStats = (): DeveloperStats[] => {
    const developerMap = new Map<string, DeveloperStats>();
    
    // Process each work item
    workItems.forEach(item => {
      const assignee = item.assignedTo || 'Unassigned';
      
      // Initialize developer stats if not exists
      if (!developerMap.has(assignee)) {
        developerMap.set(assignee, {
          name: assignee,
          completedItems: 0,
          inProgressItems: 0,
          staleItems: 0,
          totalEffort: 0,
          completedEffort: 0,
          averageCompletionTime: 0,
        });
      }
      
      const stats = developerMap.get(assignee)!;
      
      // Update stats based on work item
      if (item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done') {
        stats.completedItems += 1;
        stats.completedEffort += item.effort || 0;
      } else if (item.state === 'In Progress' || item.state === 'Active') {
        stats.inProgressItems += 1;
      }
      
      // Check if item is stale (not updated in 5 days)
      const lastUpdated = new Date(item.updatedDate);
      const now = new Date();
      const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceUpdate > 5 && item.state !== 'Completed' && item.state !== 'Closed' && item.state !== 'Done') {
        stats.staleItems += 1;
      }
      
      stats.totalEffort += item.effort || 0;
    });
    
    // Convert map to array and sort by completed items (descending)
    return Array.from(developerMap.values())
      .sort((a, b) => b.completedItems - a.completedItems);
  };
  
  const developerStats = getDeveloperStats();
  
  // Calculate team totals
  const teamTotals = developerStats.reduce(
    (acc, dev) => {
      acc.completedItems += dev.completedItems;
      acc.inProgressItems += dev.inProgressItems;
      acc.staleItems += dev.staleItems;
      acc.totalEffort += dev.totalEffort;
      acc.completedEffort += dev.completedEffort;
      return acc;
    },
    { 
      completedItems: 0, 
      inProgressItems: 0, 
      staleItems: 0, 
      totalEffort: 0, 
      completedEffort: 0 
    }
  );
  
  if (workItems.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="body1" color="text.secondary">
          No work items available for analysis
        </Typography>
      </Box>
    );
  }
  
  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Grid container spacing={2}>
        {/* Team Summary */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Team Performance
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {teamTotals.completedItems}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Completed Items
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color="primary">
                    {teamTotals.completedEffort}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Story Points
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" color={teamTotals.staleItems > 0 ? 'error' : 'primary'}>
                    {teamTotals.staleItems}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Stale Items
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
        
        {/* Developer Leaderboard */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Developer Leaderboard
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Developer</TableCell>
                    <TableCell align="center">Completed</TableCell>
                    <TableCell align="center">In Progress</TableCell>
                    <TableCell align="center">Story Points</TableCell>
                    <TableCell align="center">Stale Items</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {developerStats.map((dev) => (
                    <TableRow key={dev.name} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar 
                            sx={{ 
                              width: 28, 
                              height: 28, 
                              mr: 1, 
                              bgcolor: getAvatarColor(dev.name) 
                            }}
                          >
                            {getInitials(dev.name)}
                          </Avatar>
                          <Typography variant="body2" noWrap>
                            {dev.name}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">{dev.completedItems}</TableCell>
                      <TableCell align="center">{dev.inProgressItems}</TableCell>
                      <TableCell align="center">{dev.completedEffort}/{dev.totalEffort}</TableCell>
                      <TableCell align="center" sx={{ color: dev.staleItems > 0 ? 'error.main' : 'inherit' }}>
                        {dev.staleItems}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        
        {/* Developer Contribution Chart */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Contribution Distribution
            </Typography>
            <Box sx={{ mt: 2 }}>
              {developerStats.map((dev) => (
                <Box key={dev.name} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Avatar 
                      sx={{ 
                        width: 24, 
                        height: 24, 
                        mr: 1, 
                        bgcolor: getAvatarColor(dev.name) 
                      }}
                    >
                      {getInitials(dev.name)}
                    </Avatar>
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {dev.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {Math.round((dev.completedItems / teamTotals.completedItems) * 100)}%
                    </Typography>
                  </Box>
                  <Tooltip title={`${dev.completedItems} completed items (${Math.round((dev.completedItems / teamTotals.completedItems) * 100)}%)`}>
                    <LinearProgress 
                      variant="determinate" 
                      value={(dev.completedItems / teamTotals.completedItems) * 100} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getAvatarColor(dev.name),
                        }
                      }} 
                    />
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
        
        {/* Effort Distribution */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Effort Distribution
            </Typography>
            <Box sx={{ mt: 2 }}>
              {developerStats.map((dev) => (
                <Box key={`effort-${dev.name}`} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Avatar 
                      sx={{ 
                        width: 24, 
                        height: 24, 
                        mr: 1, 
                        bgcolor: getAvatarColor(dev.name) 
                      }}
                    >
                      {getInitials(dev.name)}
                    </Avatar>
                    <Typography variant="body2" sx={{ flexGrow: 1 }}>
                      {dev.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {dev.completedEffort} pts
                    </Typography>
                  </Box>
                  <Tooltip title={`${dev.completedEffort} story points (${Math.round((dev.completedEffort / teamTotals.completedEffort) * 100)}%)`}>
                    <LinearProgress 
                      variant="determinate" 
                      value={(dev.completedEffort / teamTotals.completedEffort) * 100} 
                      sx={{ 
                        height: 8, 
                        borderRadius: 4,
                        backgroundColor: '#e0e0e0',
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: getAvatarColor(dev.name),
                        }
                      }} 
                    />
                  </Tooltip>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DeveloperAnalytics;
