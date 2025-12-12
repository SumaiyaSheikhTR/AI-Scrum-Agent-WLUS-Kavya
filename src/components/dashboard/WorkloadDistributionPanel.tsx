import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Avatar,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  Tooltip,
  Button
} from '@mui/material';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  Legend,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import RefreshIcon from '@mui/icons-material/Refresh';
import PersonIcon from '@mui/icons-material/Person';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import adoService, { WorkItem, Sprint, SprintCapacityData } from '../../services/adoService';
import developerEngagementService, { DeveloperActivity } from '../../services/developerEngagementService';

interface WorkloadData {
  developerId: string;
  developerName: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  stale: number;
  avgEstimate: number;
  capacity: number;
  utilizationRate: number;
  workItemTypes: { type: string; count: number }[];
  // Sprint-specific capacity data
  remainingEffortHours?: number;
  availableCapacityHours?: number;
  remainingDays?: number;
  elapsedDays?: number;
  totalSprintDays?: number;
}

interface TeamWorkloadSummary {
  totalWorkItems: number;
  totalCapacity: number;
  averageUtilization: number;
  overloadedMembers: number;
  underutilizedMembers: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

// Utility function to calculate working days (excluding weekends)
const getWorkingDaysBetween = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let workingDays = 0;
  
  // Ensure we're working with dates only (no time component)
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const current = new Date(start);
  while (current <= end) {
    const dayOfWeek = current.getDay();
    // 0 = Sunday, 6 = Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return workingDays;
};

const WorkloadDistributionPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);  // Changed from true to false to prevent loading spinner on startup
  const [workloadData, setWorkloadData] = useState<WorkloadData[]>([]);
  const [teamSummary, setTeamSummary] = useState<TeamWorkloadSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadWorkloadDataCallback = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current sprint work items
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        setError('No current sprint found');
        return;
      }

      const items = await adoService.getSprintWorkItems(currentSprint.id);
      console.log('Sprint Work Items:', items.length, 'items loaded');

      // Get actual team capacity data from ADO
      const capacityData = await adoService.getSprintCapacity(currentSprint.id);
      console.log('🔍 CAPACITY_DEBUG: Sprint Capacity API Response:', {
        sprintId: currentSprint.id,
        sprintName: currentSprint.name,
        teamCapacitiesCount: capacityData.teamCapacities.length,
        isUsingFallback: capacityData.isUsingFallback,
        totalWorkingDays: capacityData.totalWorkingDays
      });
      
      // Log details if we got capacity data
      if (capacityData.teamCapacities.length > 0) {
        console.log('🔍 CAPACITY_DEBUG: Found team members:');
        capacityData.teamCapacities.forEach(cap => {
          console.log(`  - ${cap.teamMember.displayName} (${cap.teamMember.uniqueName}): ${cap.totalCapacityPerDay}h/day, ${cap.workingDays} days`);
        });
      } else {
        console.warn('🔍 CAPACITY_DEBUG: No team capacity data returned from ADO API - this might be a team/sprint mismatch issue');
      }

      // Get developer activities
      const activities = developerEngagementService.getDeveloperActivities();

      // Calculate workload distribution with sprint data and capacity
      const workloadDistribution = calculateWorkloadDistribution(items, activities, currentSprint, capacityData);
      setWorkloadData(workloadDistribution);

      // Calculate team summary
      const summary = calculateTeamSummary(workloadDistribution);
      setTeamSummary(summary);

    } catch (err) {
      console.error('Error loading workload data:', err);
      setError('Failed to load workload data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWorkloadData = loadWorkloadDataCallback;

  // Auto-loading of workload data RE-ENABLED
  useEffect(() => {
    loadWorkloadData();
  }, [loadWorkloadData]);

  const calculateWorkloadDistribution = (items: WorkItem[], activities: DeveloperActivity[], currentSprint: Sprint, capacityData: SprintCapacityData): WorkloadData[] => {
    // Group work items by assignee
    const assigneeMap: Record<string, WorkItem[]> = {};
    
    items.forEach(item => {
      if (item.assignedTo) {
        if (!assigneeMap[item.assignedTo]) {
          assigneeMap[item.assignedTo] = [];
        }
        assigneeMap[item.assignedTo].push(item);
      }
    });

    // Sprint capacity calculation from actual ADO sprint data
    const currentDate = new Date();
    const sprintStartDate = new Date(currentSprint.startDate);
    const sprintEndDate = new Date(currentSprint.endDate);
    
    // Use capacity data from ADO or calculate working days if fallback
    const totalSprintDays = capacityData.totalWorkingDays || getWorkingDaysBetween(sprintStartDate, sprintEndDate);
    const elapsedDays = Math.max(0, getWorkingDaysBetween(sprintStartDate, currentDate));
    const remainingDays = Math.max(0, totalSprintDays - elapsedDays);
    
    console.log('🔍 SPRINT_DEBUG: Sprint dates and working days calculated:', {
      totalSprintDays,
      elapsedDays,
      remainingDays,
      isUsingFallback: capacityData.isUsingFallback
    });
    
    // Log work item assignees vs capacity data for debugging matching issues 
    console.log('🔍 MATCHING_DEBUG: Assignees in work items:', Object.keys(assigneeMap));
    if (capacityData.teamCapacities.length > 0) {
      console.log('🔍 MATCHING_DEBUG: Team members in capacity:', capacityData.teamCapacities.map(c => c.teamMember.displayName));
    }
    
    // Calculate workload for each developer
    return Object.entries(assigneeMap).map(([assignee, assignedItems]) => {
      // Improved name matching logic with better email matching
      const developerCapacity = capacityData.teamCapacities.find(cap => {
        // Extract clean names for comparison
        const assigneeName = assignee.split('<')[0].trim().toLowerCase();
        const assigneeEmail = assignee.includes('<') ? assignee.split('<')[1]?.replace('>', '')?.toLowerCase() : '';
        const memberDisplayName = cap.teamMember.displayName?.toLowerCase() || '';
        const memberUniqueName = cap.teamMember.uniqueName?.toLowerCase() || '';
        
        // Multiple matching strategies - simplified without excessive logging
        const exactMatch = cap.teamMember.uniqueName === assignee || cap.teamMember.displayName === assignee;
        const nameContains = assignee.includes(cap.teamMember.displayName) || assignee.includes(cap.teamMember.uniqueName);
        const namePartialMatch = memberDisplayName.includes(assigneeName) || assigneeName.includes(memberDisplayName);
        const emailMatch = assigneeEmail && (memberUniqueName.includes(assigneeEmail) || assigneeEmail.includes(memberUniqueName));
        
        // Additional email-based matching for Thomson Reuters format
        const emailExactMatch = assigneeEmail && assigneeEmail === memberUniqueName;
        const emailDomainMatch = assigneeEmail && memberUniqueName && 
          assigneeEmail.split('@')[0] === memberUniqueName.split('@')[0];
        
        return exactMatch || nameContains || namePartialMatch || emailMatch || emailExactMatch || emailDomainMatch;
      });
      
      // Log only if we have a matching issue for debugging
      if (!developerCapacity && capacityData.teamCapacities.length > 0) {
        console.log(`🔍 MATCH_ISSUE: No capacity match found for "${assignee}" among ${capacityData.teamCapacities.length} team members`);
      }
      
      // Determine capacity values - use matched capacity or fallback to available capacity data
      let dailyCapacityHours, totalSprintCapacityHours, workingDaysForDeveloper;
      
      if (developerCapacity) {
        // Use matched capacity from ADO
        dailyCapacityHours = developerCapacity.totalCapacityPerDay;
        totalSprintCapacityHours = developerCapacity.totalCapacityForSprint;
        workingDaysForDeveloper = developerCapacity.workingDays;
      } else if (capacityData.teamCapacities.length > 0) {
        // Use any available capacity as fallback template
        const fallbackCapacity = capacityData.teamCapacities[0];
        dailyCapacityHours = fallbackCapacity.totalCapacityPerDay;
        totalSprintCapacityHours = fallbackCapacity.totalCapacityForSprint;
        workingDaysForDeveloper = fallbackCapacity.workingDays;
      } else {
        // Final fallback to default values
        dailyCapacityHours = 3; // Use 3h/day as realistic default
        totalSprintCapacityHours = totalSprintDays * dailyCapacityHours;
        workingDaysForDeveloper = totalSprintDays;
      }
      
      const completed = assignedItems.filter(item => 
        item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done'
      ).length;
      
      const inProgress = assignedItems.filter(item => 
        item.state === 'Active' || item.state === 'In Progress'
      ).length;
      
      const stale = assignedItems.filter(item => {
        const lastUpdated = new Date(item.updatedDate);
        const daysSinceUpdate = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceUpdate >= 3 && item.state === 'Active';
      }).length;

      // Calculate total effort for remaining work (use actual effort from ADO)
      const remainingItems = assignedItems.filter(item => 
        item.state !== 'Completed' && item.state !== 'Closed' && item.state !== 'Done'
      );
      
      const totalRemainingEffort = remainingItems.reduce((sum, item) => {
        // Use actual effort from ADO work items
        // ADO effort could be in story points or hours depending on configuration
        // Check if the effort is already in hours or needs conversion
        let effortInHours = item.effort || 0;
        
        // If effort is in story points and not hours, convert based on team velocity
        // This could be configured per team or determined from historical data
        if (effortInHours > 0 && effortInHours <= 50) { // Likely story points if <= 50
          effortInHours = effortInHours * 8; // Convert story points to hours (configurable multiplier)
        }
        
        // Default to 3 story points (24 hours) if no effort specified
        return sum + (effortInHours || 24);
      }, 0);

      // Calculate available capacity for remaining sprint days (considering developer's actual capacity and days off)
      const remainingDaysForDeveloper = Math.max(0, workingDaysForDeveloper - elapsedDays);
      const totalAvailableCapacity = remainingDaysForDeveloper * dailyCapacityHours;
      
      // Calculate utilization based on remaining effort vs remaining capacity
      const utilizationRate = totalAvailableCapacity > 0 
        ? (totalRemainingEffort / totalAvailableCapacity) * 100 
        : totalRemainingEffort > 0 ? 999 : 0; // 999% indicates impossible to complete

      // Calculate average estimate in hours from actual ADO effort data
      const totalEffortHours = assignedItems.reduce((sum, item) => {
        let effortInHours = item.effort || 0;
        
        // Convert story points to hours if needed (same logic as above)
        if (effortInHours > 0 && effortInHours <= 50) {
          effortInHours = effortInHours * 8;
        }
        
        return sum + (effortInHours || 24); // Default 24 hours if no effort
      }, 0);
      const avgEstimate = assignedItems.length > 0 ? totalEffortHours / assignedItems.length : 0;

      // Group by work item type
      const workItemTypes: { type: string; count: number }[] = [];
      const typeMap: Record<string, number> = {};
      
      assignedItems.forEach(item => {
        const type = item.type || 'Unknown';
        typeMap[type] = (typeMap[type] || 0) + 1;
      });
      
      Object.entries(typeMap).forEach(([type, count]) => {
        workItemTypes.push({ type, count });
      });

      return {
        developerId: assignee,
        developerName: assignee.split('<')[0].trim(),
        totalAssigned: assignedItems.length,
        completed,
        inProgress,
        stale,
        avgEstimate,
        capacity: totalSprintCapacityHours, // Total sprint capacity in hours
        utilizationRate,
        workItemTypes,
        // Additional sprint-specific data
        remainingEffortHours: totalRemainingEffort,
        availableCapacityHours: totalAvailableCapacity,
        remainingDays: remainingDaysForDeveloper,
        elapsedDays,
        totalSprintDays: workingDaysForDeveloper
      };
    });
  };

  const calculateTeamSummary = (workloadData: WorkloadData[]): TeamWorkloadSummary => {
    const totalWorkItems = workloadData.reduce((sum, dev) => sum + dev.totalAssigned, 0);
    const totalCapacity = workloadData.reduce((sum, dev) => sum + dev.capacity, 0);
    const averageUtilization = workloadData.length > 0 
      ? workloadData.reduce((sum, dev) => sum + dev.utilizationRate, 0) / workloadData.length 
      : 0;
    
    const overloadedMembers = workloadData.filter(dev => dev.utilizationRate > 90).length;
    const underutilizedMembers = workloadData.filter(dev => dev.utilizationRate < 50).length;

    return {
      totalWorkItems,
      totalCapacity,
      averageUtilization,
      overloadedMembers,
      underutilizedMembers
    };
  };

  const prepareUtilizationChartData = () => {
    return workloadData.map(dev => ({
      name: dev.developerName.split(' ')[0],
      utilization: Math.round(dev.utilizationRate),
      assigned: dev.totalAssigned,
      capacity: dev.capacity
    }));
  };

  const prepareWorkloadPieData = () => {
    return workloadData.map(dev => ({
      name: dev.developerName.split(' ')[0],
      value: dev.totalAssigned
    }));
  };

  const prepareRadarData = () => {
    return workloadData.map(dev => ({
      name: dev.developerName.split(' ')[0],
      completed: (dev.completed / Math.max(dev.totalAssigned, 1)) * 100,
      utilization: dev.utilizationRate,
      avgEstimate: dev.avgEstimate * 10, // Scale for visibility
      staleItems: Math.max(100 - (dev.stale * 25), 0) // Inverse scale (fewer stale = better)
    }));
  };

  const getUtilizationColor = (rate: number) => {
    if (rate >= 999) return '#8b0000'; // Dark red - impossible to complete
    if (rate > 120) return '#f44336'; // Red - severely overloaded
    if (rate > 100) return '#ff5722'; // Deep orange - overloaded
    if (rate > 85) return '#ff9800'; // Orange - high utilization
    if (rate > 70) return '#4caf50'; // Green - good utilization
    if (rate > 40) return '#2196f3'; // Blue - moderate utilization
    return '#9e9e9e'; // Grey - underutilized
  };

  const getUtilizationStatus = (rate: number, remainingDays: number = 0) => {
    if (rate >= 999) return { label: 'Impossible', color: 'error' as const, tooltip: 'Cannot complete remaining work in available time' };
    if (rate > 120) return { label: 'Critical', color: 'error' as const, tooltip: 'Severely overallocated - needs immediate attention' };
    if (rate > 100) return { label: 'Overloaded', color: 'error' as const, tooltip: 'More work than available capacity' };
    if (rate > 85) return { label: 'High', color: 'warning' as const, tooltip: 'High utilization - monitor closely' };
    if (rate > 70) return { label: 'Good', color: 'success' as const, tooltip: 'Healthy utilization level' };
    if (rate > 40) return { label: 'Moderate', color: 'info' as const, tooltip: 'Moderate utilization - could take more work' };
    if (remainingDays <= 0) return { label: 'Sprint Done', color: 'default' as const, tooltip: 'Sprint has ended' };
    return { label: 'Low', color: 'default' as const, tooltip: 'Underutilized - can take more work' };
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box>
      {/* Header with refresh button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Workload Distribution</Typography>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadWorkloadData}>
          Refresh
        </Button>
      </Box>

      {/* Team Summary Cards */}
      {teamSummary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <AssignmentIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{teamSummary.totalWorkItems}</Typography>
                <Typography variant="body2" color="text.secondary">Total Work Items</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <PersonIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{Math.round(teamSummary.averageUtilization)}%</Typography>
                <Typography variant="body2" color="text.secondary">Avg Utilization</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <WarningIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{teamSummary.overloadedMembers}</Typography>
                <Typography variant="body2" color="text.secondary">Overloaded</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent sx={{ textAlign: 'center' }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                <Typography variant="h4">{teamSummary.underutilizedMembers}</Typography>
                <Typography variant="body2" color="text.secondary">Underutilized</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Charts Section */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Utilization Bar Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Team Utilization Rates" />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={prepareUtilizationChartData()}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="utilization" fill="#8884d8" name="Utilization %" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Workload Distribution Pie Chart */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="Work Items Distribution" />
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={prepareWorkloadPieData()}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {prepareWorkloadPieData().map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Performance Radar Chart */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12}>
          <Card>
            <CardHeader title="Team Performance Overview" />
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={prepareRadarData()}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="name" />
                  <PolarRadiusAxis angle={60} domain={[0, 100]} />
                  {workloadData.map((_, index) => (
                    <Radar
                      key={`radar-${index}`}
                      dataKey={workloadData[index]?.developerName.split(' ')[0]}
                      stroke={COLORS[index % COLORS.length]}
                      fill={COLORS[index % COLORS.length]}
                      fillOpacity={0.1}
                    />
                  ))}
                  <RechartsTooltip />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Detailed Table */}
      <Card>
        <CardHeader title="Detailed Workload Breakdown" />
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Developer</TableCell>
                  <TableCell align="center">Assigned</TableCell>
                  <TableCell align="center">Completed</TableCell>
                  <TableCell align="center">In Progress</TableCell>
                  <TableCell align="center">Remaining Effort (hrs)</TableCell>
                  <TableCell align="center">Available Capacity (hrs)</TableCell>
                  <TableCell align="center">Days Left</TableCell>
                  <TableCell align="center">Utilization</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workloadData.map((developer, index) => {
                  const status = getUtilizationStatus(developer.utilizationRate, developer.remainingDays);
                  return (
                    <TableRow key={developer.developerId}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar sx={{ mr: 2, bgcolor: COLORS[index % COLORS.length] }}>
                            {developer.developerName.substring(0, 2).toUpperCase()}
                          </Avatar>
                          <Typography variant="body2">{developer.developerName}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">{developer.totalAssigned}</TableCell>
                      <TableCell align="center">{developer.completed}</TableCell>
                      <TableCell align="center">{developer.inProgress}</TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={developer.remainingEffortHours && developer.remainingEffortHours > 0 ? 'text.primary' : 'text.secondary'}>
                          {developer.remainingEffortHours?.toFixed(0) || '0'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={developer.availableCapacityHours && developer.availableCapacityHours > 0 ? 'success.main' : 'error.main'}>
                          {developer.availableCapacityHours?.toFixed(0) || '0'}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2" color={developer.remainingDays && developer.remainingDays > 0 ? 'text.primary' : 'error.main'}>
                          {developer.remainingDays || 0}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Box sx={{ width: '100%', mr: 1 }}>
                            <LinearProgress 
                              variant="determinate" 
                              value={Math.min(developer.utilizationRate, 100)} 
                              sx={{ 
                                height: 8, 
                                borderRadius: 5,
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getUtilizationColor(developer.utilizationRate)
                                }
                              }}
                            />
                          </Box>
                          <Typography variant="body2" color={developer.utilizationRate >= 999 ? 'error.main' : 'text.primary'}>
                            {developer.utilizationRate >= 999 ? '∞' : `${Math.round(developer.utilizationRate)}%`}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={status.tooltip}>
                          <Chip
                            label={status.label}
                            color={status.color}
                            size="small"
                          />
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default WorkloadDistributionPanel;
