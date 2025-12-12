import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Alert, 
  AlertTitle, 
  Divider, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Chip,
  CircularProgress,
  Card,
  CardContent,
  LinearProgress,
  Tooltip
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import adoService, { WorkItem, SprintStatistics, Sprint } from '../../services/adoService';
import workItemSuggestionService, { DuplicateTaskPair } from '../../services/workItemSuggestionService';

interface DeveloperContribution {
  name: string;
  completedItems: number;
  totalEffort: number;
  completedEffort: number;
  remainingEffort: number;
}

interface DataDrivenInsightsProps {
  sprint: Sprint | null;
  workItems: WorkItem[];
  sprintStats: SprintStatistics | null;
}

const DataDrivenInsights: React.FC<DataDrivenInsightsProps> = ({ sprint, workItems, sprintStats }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [developerContributions, setDeveloperContributions] = useState<DeveloperContribution[]>([]);
  const [duplicateTasks, setDuplicateTasks] = useState<{id1: number, id2: number, title1: string, title2: string, similarity: number, reason: string}[]>([]);
  const [anomalies, setAnomalies] = useState<{id: number, title: string, type: string, description: string}[]>([]);
  const [velocityTrend, setVelocityTrend] = useState<{sprint: string, velocity: number, goal: number}[]>([]);

  useEffect(() => {
    if (workItems.length > 0) {
      analyzeData();
    }
  }, [workItems, sprint]);

  const analyzeData = async () => {
    setIsLoading(true);
    
    try {
      // Calculate developer contributions
      calculateDeveloperContributions();
      
      // Find potential duplicate tasks
      findDuplicateTasks();
      
      // Detect anomalies in work items
      detectAnomalies();
      
      // Get velocity trends
      await getVelocityTrends();
    } catch (error) {
      console.error('Error analyzing data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateDeveloperContributions = () => {
    // Group work items by assigned developer
    const developerMap = new Map<string, WorkItem[]>();
    
    workItems.forEach(item => {
      const assignee = item.assignedTo || 'Unassigned';
      if (!developerMap.has(assignee)) {
        developerMap.set(assignee, []);
      }
      developerMap.get(assignee)?.push(item);
    });
    
    // Calculate metrics for each developer
    const contributions: DeveloperContribution[] = [];
    
    developerMap.forEach((items, name) => {
      const completedItems = items.filter(item => 
        item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done'
      ).length;
      
      const totalEffort = items.reduce((sum, item) => sum + (item.effort || 0), 0);
      
      const completedEffort = items
        .filter(item => item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done')
        .reduce((sum, item) => sum + (item.effort || 0), 0);
      
      const remainingEffort = totalEffort - completedEffort;
      
      contributions.push({
        name,
        completedItems,
        totalEffort,
        completedEffort,
        remainingEffort
      });
    });
    
    // Sort by completed effort (descending)
    contributions.sort((a, b) => b.completedEffort - a.completedEffort);
    
    setDeveloperContributions(contributions);
  };

  
  const findDuplicateTasks = () => {
    // Use the workItemSuggestionService to find duplicate tasks
    // This specifically looks for same task or user story under same parent assigned to none or same user
    let duplicates = workItemSuggestionService.findDuplicateTasks(workItems);
    
    // Also check for high similarity across different parents
    for (let i = 0; i < workItems.length; i++) {
      for (let j = i + 1; j < workItems.length; j++) {
        const item1 = workItems[i];
        const item2 = workItems[j];
        
        // Skip comparison if either item is completed
        if (
          item1.state === 'Completed' || 
          item1.state === 'Closed' || 
          item1.state === 'Done' ||
          item2.state === 'Completed' || 
          item2.state === 'Closed' || 
          item2.state === 'Done'
        ) {
          continue;
        }
        
        // Skip if they have the same parent (already checked by the service)
        if (
          item1.parentId && 
          item2.parentId && 
          item1.parentId === item2.parentId
        ) {
          continue;
        }
        
        // For items with different parents, use a higher similarity threshold
        const similarity = workItemSuggestionService.calculateSimilarity(item1.title, item2.title);
        if (similarity > 80) {
          duplicates.push({
            id1: item1.id,
            id2: item2.id,
            title1: item1.title,
            title2: item2.title,
            similarity,
            reason: 'Different parents, very similar titles'
          });
        }
      }
    }
    
    // Sort by similarity (descending)
    duplicates.sort((a, b) => b.similarity - a.similarity);
    
    // Limit to top 5 potential duplicates
    setDuplicateTasks(duplicates.slice(0, 5));
  };
  
  const detectAnomalies = () => {
    const anomaliesList: {id: number, title: string, type: string, description: string}[] = [];
    const now = new Date();
    
    // Check for anomalies in each work item
    workItems.forEach(item => {
      // Check for stale items (not updated in 7+ days)
      // Only consider Active items and Task type items as stale, not New items or other types
      const lastUpdated = new Date(item.updatedDate);
      const daysSinceUpdate = Math.floor((now.getTime() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceUpdate >= 7 && item.state === 'Active' && item.type === 'Task') {
        anomaliesList.push({
          id: item.id,
          title: item.title,
          type: 'stale',
          description: `No updates for ${daysSinceUpdate} days`
        });
      }
      
      // Check for blocked items
      if (item.state === 'Blocked' || item.tags.some(tag => tag.toLowerCase() === 'blocked')) {
        anomaliesList.push({
          id: item.id,
          title: item.title,
          type: 'blocked',
          description: 'Item is blocked'
        });
      }
      
      // Check for items with high effort but no progress
      // Only consider Active items, not New items
      if (
        (item.effort || 0) > 8 && 
        item.state === 'Active' &&
        daysSinceUpdate >= 5
      ) {
        anomaliesList.push({
          id: item.id,
          title: item.title,
          type: 'effort_no_progress',
          description: `High effort (${item.effort} points) with no recent progress`
        });
      }
    });
    
    // Sort anomalies by type (blocked first, then stale, then others)
    anomaliesList.sort((a, b) => {
      if (a.type === 'blocked' && b.type !== 'blocked') return -1;
      if (a.type !== 'blocked' && b.type === 'blocked') return 1;
      if (a.type === 'stale' && b.type !== 'stale') return -1;
      if (a.type !== 'stale' && b.type === 'stale') return 1;
      return 0;
    });
    
    setAnomalies(anomaliesList);
  };

  const getVelocityTrends = async () => {
    try {
      // Get all sprints
      const allSprints = await adoService.getSprints();
      
      // Sort sprints by date (oldest first)
      allSprints.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      // Get the last 4 completed sprints plus current sprint
      const recentSprints = allSprints.slice(-5);
      
      // Initialize velocity trend data
      const velocityData: {sprint: string, velocity: number, goal: number}[] = [];
      
      // Process each sprint
      for (const sprintItem of recentSprints) {
        // Skip future sprints
        if (sprintItem.state === 'future') {
          continue;
        }
        
        // Get sprint statistics
        const stats = await adoService.getSprintStatistics(sprintItem.id);
        
        // Add to velocity data
        velocityData.push({
          sprint: sprintItem.name,
          velocity: stats.completedEffort,
          goal: stats.totalEffort
        });
      }
      
      // If we have the current sprint stats, make sure it's included
      if (sprint && sprintStats) {
        // Check if current sprint is already in the data
        const currentSprintIndex = velocityData.findIndex(v => v.sprint === sprint.name);
        
        if (currentSprintIndex >= 0) {
          // Update current sprint data
          velocityData[currentSprintIndex] = {
            sprint: sprint.name,
            velocity: sprintStats.completedEffort,
            goal: sprintStats.totalEffort
          };
        } else {
          // Add current sprint data
          velocityData.push({
            sprint: sprint.name,
            velocity: sprintStats.completedEffort,
            goal: sprintStats.totalEffort
          });
        }
      }
      
      // Limit to 5 most recent sprints
      const limitedData = velocityData.slice(-5);
      
      setVelocityTrend(limitedData);
    } catch (error) {
      console.error('Error fetching velocity data:', error);
      
      // Fallback to current sprint only if we have stats
      if (sprint && sprintStats) {
        setVelocityTrend([
          {
            sprint: sprint.name,
            velocity: sprintStats.completedEffort,
            goal: sprintStats.totalEffort
          }
        ]);
      } else {
        setVelocityTrend([]);
      }
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress size={24} sx={{ mr: 1 }} />
        <Typography variant="body1" color="text.secondary">
          Analyzing sprint data...
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto' }}>
      <Grid container spacing={2}>
        {/* Total Effort Burned vs. Estimated */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Total Effort Burned vs. Estimated
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="body2">Completed Effort</Typography>
                <Typography variant="h6" color="primary">
                  {sprintStats?.completedEffort || 0} points
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" align="right">Total Estimated</Typography>
                <Typography variant="h6" color="text.secondary" align="right">
                  {sprintStats?.totalEffort || 0} points
                </Typography>
              </Box>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={sprintStats ? (sprintStats.completedEffort / (sprintStats.totalEffort || 1)) * 100 : 0} 
              sx={{ 
                height: 10, 
                borderRadius: 5,
                backgroundColor: '#e0e0e0',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#4caf50',
                }
              }} 
            />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {sprintStats ? Math.round((sprintStats.completedEffort / (sprintStats.totalEffort || 1)) * 100) : 0}% of estimated effort completed
            </Typography>
          </Paper>
        </Grid>

        {/* Developer Contribution Breakdown */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Developer Contribution Breakdown
            </Typography>
            <TableContainer component={Box}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Developer</TableCell>
                    <TableCell align="right">Completed Items</TableCell>
                    <TableCell align="right">Completed Effort</TableCell>
                    <TableCell align="right">Remaining Effort</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {developerContributions.map((dev, index) => (
                    <TableRow key={index}>
                      <TableCell component="th" scope="row">
                        {dev.name}
                      </TableCell>
                      <TableCell align="right">{dev.completedItems}</TableCell>
                      <TableCell align="right">{dev.completedEffort}</TableCell>
                      <TableCell align="right">{dev.remainingEffort}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Duplicate Tasks */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Potential Duplicate Tasks
            </Typography>
            {duplicateTasks.length > 0 ? (
              <TableContainer component={Box}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Work Item 1</TableCell>
                      <TableCell>Work Item 2</TableCell>
                      <TableCell>Reason</TableCell>
                      <TableCell align="right">Similarity</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {duplicateTasks.map((dup, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          #{dup.id1}: {dup.title1}
                        </TableCell>
                        <TableCell>
                          #{dup.id2}: {dup.title2}
                        </TableCell>
                        <TableCell>
                          {dup.reason || 'Similar titles'}
                        </TableCell>
                        <TableCell align="right">
                          <Chip 
                            label={`${dup.similarity}%`} 
                            size="small" 
                            color={dup.similarity > 80 ? "error" : "warning"} 
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No potential duplicate tasks detected
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Anomalies */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Detected Anomalies
            </Typography>
            {anomalies.length > 0 ? (
              <Box>
                {anomalies.map((anomaly, index) => (
                  <Alert 
                    key={index} 
                    severity={
                      anomaly.type === 'blocked' ? 'error' : 
                      anomaly.type === 'stale' ? 'warning' : 'info'
                    }
                    sx={{ mb: 1 }}
                  >
                    <AlertTitle>#{anomaly.id}: {anomaly.title}</AlertTitle>
                    {anomaly.description}
                  </Alert>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No anomalies detected
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Velocity Trends */}
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
            <Typography variant="subtitle1" gutterBottom>
              Velocity Trends and Goal Alignment
            </Typography>
            <Box sx={{ height: 120, display: 'flex', alignItems: 'flex-end', mt: 2 }}>
              {velocityTrend.map((sprint, index) => (
                <Tooltip 
                  key={index} 
                  title={`${sprint.sprint}: ${sprint.velocity}/${sprint.goal} points`}
                  arrow
                >
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: `${100 / velocityTrend.length}%` }}>
                    <Box 
                      sx={{ 
                        width: '60%',
                        height: `${(sprint.velocity / 35) * 100}%`,
                        backgroundColor: sprint.velocity >= sprint.goal ? '#4caf50' : '#2196f3',
                        borderTopLeftRadius: 2,
                        borderTopRightRadius: 2,
                      }} 
                    />
                    <Box 
                      sx={{ 
                        width: '80%',
                        height: 2,
                        backgroundColor: '#ff9800',
                        mt: -(sprint.goal / 35) * 100,
                        position: 'relative',
                      }} 
                    />
                    <Typography variant="caption" sx={{ mt: 1 }}>
                      {sprint.sprint.substring(0, 3)}
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2 }}>
              <Box sx={{ width: 12, height: 12, backgroundColor: '#4caf50', mr: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>Met Goal</Typography>
              <Box sx={{ width: 12, height: 12, backgroundColor: '#2196f3', mr: 1 }} />
              <Typography variant="caption" color="text.secondary" sx={{ mr: 2 }}>Below Goal</Typography>
              <Box sx={{ width: 12, height: 2, backgroundColor: '#ff9800', mr: 1 }} />
              <Typography variant="caption" color="text.secondary">Goal</Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default DataDrivenInsights;
