import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid,
  Paper,
  Typography,
  Box,
  Chip,
  Avatar,
  Button,
  LinearProgress,
  Card,
  CardContent,
  Alert,
  AlertTitle,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Badge
} from '@mui/material';
import {
  Comment as CommentIcon,
  Warning as WarningIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
  Timeline as TimelineIcon,
  School as SchoolIcon,
  LocalShipping as DeliveryIcon
} from '@mui/icons-material';
import adoService, { WorkItem, WorkItemComment } from '../../services/adoService';
import { categorizeWorkItem } from '../../utils/workItemCategorizer';

interface TaskActivity {
  id: string;
  title: string;
  type: string;
  state: string;
  assignedTo: string;
  activatedDate?: string;
  completedDate?: string;
  hasRecentCommentOnParent: boolean;
  parentCommentCount: number;
  lastParentCommentDate?: string;
  daysSinceActivation: number;
  daysSinceCompletion?: number;
  isViolation: boolean;
  violationType?: 'missing_activation_comment' | 'missing_completion_comment' | 'stale_item';
  parentComments?: WorkItemComment[];
}

interface StoryBugActivity {
  parentWorkItem: WorkItem;
  activeTasks: TaskActivity[];
  completedTasks: TaskActivity[];
  totalTasks: number;
  violationCount: number;
  complianceScore: number;
  parentComments: WorkItemComment[];
  priority: number;
}

interface ExecutiveSummaryProps {
  workItems: WorkItem[];
  isLoading?: boolean;
}

const ExecutiveSummaryWithActivityMonitoring: React.FC<ExecutiveSummaryProps> = ({ 
  workItems, 
  isLoading = false 
}) => {
  const [storyBugActivities, setStoryBugActivities] = useState<StoryBugActivity[]>([]);
  const [selectedStoryBug, setSelectedStoryBug] = useState<StoryBugActivity | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);

  const analyzeActivityData = useCallback(async () => {
    setActivityLoading(true);
    
    try {
      // Separate parent items (User Stories, Bugs, Features) from child items (Tasks)
      const parentItems = workItems.filter(item => 
        item.type === 'User Story' || 
        item.type === 'Bug' || 
        item.type === 'Feature' || 
        item.type === 'Epic'
      );
      
      const childTasks = workItems.filter(item => 
        item.type === 'Task' && item.parentId
      );
      
      const activities: StoryBugActivity[] = [];
      
      for (const parentItem of parentItems) {
        // Get child tasks for this parent
        const parentTasks = childTasks.filter(task => task.parentId === parentItem.id);
        
        if (parentTasks.length === 0) continue;
        
        // Get comments for the parent work item
        const parentComments = await adoService.getWorkItemComments(parentItem.id, parentItem.title);
        
        const activeTasks: TaskActivity[] = [];
        const completedTasks: TaskActivity[] = [];
        
        for (const task of parentTasks) {
          const taskActivity = await analyzeTask(task, parentComments);
          
          if (taskActivity.state === 'In Progress' || taskActivity.state === 'Active') {
            activeTasks.push(taskActivity);
          } else if (taskActivity.state === 'Completed' || taskActivity.state === 'Done' || taskActivity.state === 'Closed') {
            completedTasks.push(taskActivity);
          }
        }
        
        // Calculate compliance score for this parent item
        const totalTasks = activeTasks.length + completedTasks.length;
        const violationCount = [...activeTasks, ...completedTasks].filter(task => task.isViolation).length;
        const complianceScore = totalTasks > 0 ? Math.round(((totalTasks - violationCount) / totalTasks) * 100) : 100;
        
        if (totalTasks > 0) {
          activities.push({
            parentWorkItem: parentItem,
            activeTasks,
            completedTasks,
            totalTasks,
            violationCount,
            complianceScore,
            parentComments,
            priority: parentItem.priority || 4
          });
        }
      }
      
      // Sort by priority and compliance score
      activities.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.violationCount - b.violationCount;
      });
      
      setStoryBugActivities(activities);
      
    } catch (error) {
      console.error('Error analyzing activity data:', error);
    } finally {
      setActivityLoading(false);
    }
  }, [workItems]);

  useEffect(() => {
    if (workItems && workItems.length > 0) {
      analyzeActivityData();
    }
  }, [workItems, analyzeActivityData]);

  const analyzeTask = async (task: WorkItem, parentComments: WorkItemComment[]): Promise<TaskActivity> => {
    // Filter comments from the assigned user for analysis (excluding automated comments)
    const userComments = parentComments.filter(comment => {
      if (!task.assignedTo || task.assignedTo === 'Unassigned') return false;
      
      // Skip automated system comments
      if (comment.text && (
        comment.text.includes('Changed to Active from team automation rules triggered by') ||
        comment.text.includes('automated') ||
        comment.text.includes('system generated') ||
        comment.text.includes('Auto-generated') ||
        comment.text.startsWith('Moved from') ||
        comment.text.startsWith('State changed from')
      )) {
        return false;
      }
      
      return comment.author === task.assignedTo || 
             comment.author.toLowerCase().includes(task.assignedTo.toLowerCase()) ||
             task.assignedTo.toLowerCase().includes(comment.author.toLowerCase());
    });
    
    // STRICT violation logic - EVERY active/completed task MUST have user comments
    let isViolation = false;
    let violationType: TaskActivity['violationType'];
    
    if (!task.assignedTo || task.assignedTo === 'Unassigned') {
      isViolation = false;
    } else if (userComments.length === 0) {
      if (task.state === 'In Progress' || task.state === 'Active') {
        isViolation = true;
        violationType = 'missing_activation_comment';
      } else if (task.state === 'Completed' || task.state === 'Done' || task.state === 'Closed' || task.state === 'Resolved') {
        isViolation = true;
        violationType = 'missing_completion_comment';
      }
    }
    
    const activatedDate = task.state === 'In Progress' || task.state === 'Active' ? task.updatedDate : undefined;
    const completedDate = task.state === 'Done' || task.state === 'Closed' || task.state === 'Completed' ? task.updatedDate : undefined;
    
    return {
      id: task.id.toString(),
      title: task.title,
      type: task.type,
      state: task.state,
      assignedTo: task.assignedTo || 'Unassigned',
      activatedDate,
      completedDate,
      hasRecentCommentOnParent: userComments.length > 0,
      parentCommentCount: userComments.length,
      lastParentCommentDate: userComments.length > 0 ? 
        userComments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp :
        undefined,
      daysSinceActivation: activatedDate ? Math.floor((Date.now() - new Date(activatedDate).getTime()) / (1000 * 60 * 60 * 24)) : 0,
      daysSinceCompletion: completedDate ? Math.floor((Date.now() - new Date(completedDate).getTime()) / (1000 * 60 * 60 * 24)) : undefined,
      isViolation,
      violationType,
      parentComments: userComments.slice(0, 5)
    };
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return '#dc3545'; // Red
      case 2: return '#ff9800'; // Orange
      case 3: return '#28a745'; // Green
      default: return '#6c757d'; // Gray
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 80) return '#28a745';
    if (score >= 60) return '#ff9800';
    return '#dc3545';
  };

  const openStoryBugDetails = (storyBug: StoryBugActivity) => {
    setSelectedStoryBug(storyBug);
    setDetailsOpen(true);
  };

  if (isLoading || activityLoading) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center' }}>
        <CircularProgress size={40} />
        <Typography sx={{ mt: 2 }}>Analyzing Executive Summary & Activity Monitoring...</Typography>
      </Paper>
    );
  }

  // Calculate overall metrics
  const totalViolations = storyBugActivities.reduce((sum, item) => sum + item.violationCount, 0);
  const averageCompliance = storyBugActivities.length > 0 ? 
    Math.round(storyBugActivities.reduce((sum, item) => sum + item.complianceScore, 0) / storyBugActivities.length) : 0;
  const totalTasks = storyBugActivities.reduce((sum, item) => sum + item.totalTasks, 0);
  const zeroCommentTasks = storyBugActivities.reduce((sum, item) => {
    return sum + [...item.activeTasks, ...item.completedTasks].filter(task => task.parentCommentCount === 0).length;
  }, 0);

  // Group by priority
  const p1Items = storyBugActivities.filter(item => item.priority === 1);
  const p2Items = storyBugActivities.filter(item => item.priority === 2);
  const p3Items = storyBugActivities.filter(item => item.priority === 3);
  const otherItems = storyBugActivities.filter(item => item.priority > 3 || !item.priority);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 3,
        p: 4,
        mb: 4,
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(102, 126, 234, 0.3)',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '200px',
          height: '200px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '50%',
          transform: 'translate(50px, -50px)'
        }
      }}>
        <Box sx={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <Typography variant="h4" component="h2" sx={{ 
            fontWeight: 700,
            mb: 1.5,
            fontSize: '1.8rem'
          }}>
            📈 Executive Summary with Activity Monitoring
          </Typography>
          <Typography variant="body1" sx={{ 
            opacity: 0.9,
            fontSize: '1rem',
            fontWeight: 500,
            maxWidth: '700px',
            mx: 'auto'
          }}>
            Strategic overview of user stories and defects with real-time activity compliance monitoring
          </Typography>
        </Box>
      </Box>

      {/* Overall Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={2.4}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <TrendingUpIcon sx={{ fontSize: 40, color: '#2196f3', mb: 1 }} />
              <Typography variant="h4">{storyBugActivities.length}</Typography>
              <Typography variant="body2" color="text.secondary">Work Items</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <CommentIcon sx={{ fontSize: 40, color: '#ff5722', mb: 1 }} />
              <Typography variant="h4" color="error.main">{zeroCommentTasks}</Typography>
              <Typography variant="body2" color="text.secondary">Zero Comments</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <WarningIcon sx={{ fontSize: 40, color: '#f44336', mb: 1 }} />
              <Typography variant="h4">{totalViolations}</Typography>
              <Typography variant="body2" color="text.secondary">Violations</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <SpeedIcon sx={{ fontSize: 40, color: getComplianceColor(averageCompliance), mb: 1 }} />
              <Typography variant="h4" sx={{ color: getComplianceColor(averageCompliance) }}>{averageCompliance}%</Typography>
              <Typography variant="body2" color="text.secondary">Compliance</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card sx={{ textAlign: 'center', height: '100%' }}>
            <CardContent>
              <TimelineIcon sx={{ fontSize: 40, color: '#ff9800', mb: 1 }} />
              <Typography variant="h4">{totalTasks}</Typography>
              <Typography variant="body2" color="text.secondary">Total Tasks</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Training/Delivery Categorization */}
      {(() => {
        const categorizedItems = storyBugActivities.reduce((acc, activity) => {
          const category = categorizeWorkItem(activity.parentWorkItem);
          const categoryName = category ? category.name : 'Other';
          if (!acc[categoryName]) {
            acc[categoryName] = {
              items: [],
              category: category,
              color: category ? category.color : '#6c757d'
            };
          }
          acc[categoryName].items.push(activity);
          return acc;
        }, {} as Record<string, { items: StoryBugActivity[], category: any, color: string }>);

        return Object.keys(categorizedItems).length > 0 ? (
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Typography variant="h5" sx={{ 
                fontWeight: 600, 
                mb: 3, 
                textAlign: 'center',
                color: '#2c3e50'
              }}>
                📚 Work Items by Category
              </Typography>
            </Grid>
            {Object.entries(categorizedItems).map(([categoryName, { items, category, color }]) => {
              const totalCategoryTasks = items.reduce((sum, item) => sum + item.totalTasks, 0);
              const completedCategoryTasks = items.reduce((sum, item) => sum + item.completedTasks.length, 0);
              const categoryProgress = totalCategoryTasks > 0 ? Math.round((completedCategoryTasks / totalCategoryTasks) * 100) : 0;
              const violationCount = items.reduce((sum, item) => sum + item.violationCount, 0);

              return (
                <Grid item xs={12} md={6} key={categoryName}>
                  <Card sx={{ 
                    height: '100%', 
                    background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
                    border: `2px solid ${color}30`,
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: `0 8px 25px ${color}40`,
                      transition: 'all 0.3s ease-in-out'
                    }
                  }}>
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        {categoryName === 'Training' ? (
                          <SchoolIcon sx={{ fontSize: 32, color: color, mr: 2 }} />
                        ) : categoryName === 'Delivery' ? (
                          <DeliveryIcon sx={{ fontSize: 32, color: color, mr: 2 }} />
                        ) : (
                          <TrendingUpIcon sx={{ fontSize: 32, color: color, mr: 2 }} />
                        )}
                        <Typography variant="h6" sx={{ 
                          fontWeight: 700, 
                          color: color,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {categoryName}
                        </Typography>
                        <Chip 
                          label={`${items.length} items`}
                          size="small"
                          sx={{ 
                            ml: 'auto',
                            backgroundColor: color,
                            color: 'white',
                            fontWeight: 600
                          }}
                        />
                      </Box>
                      
                      {/* Category Description */}
                      {category && category.description && (
                        <Typography variant="body2" sx={{ 
                          color: '#6c757d', 
                          mb: 2,
                          fontStyle: 'italic'
                        }}>
                          {category.description}
                        </Typography>
                      )}
                      
                      {/* Progress Bar */}
                      <Box sx={{ mb: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Task Progress
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: color }}>
                            {categoryProgress}%
                          </Typography>
                        </Box>
                        <LinearProgress 
                          variant="determinate" 
                          value={categoryProgress} 
                          sx={{ 
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: '#f0f0f0',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: color,
                              borderRadius: 4
                            }
                          }} 
                        />
                        <Typography variant="caption" sx={{ 
                          color: '#6c757d',
                          mt: 0.5,
                          display: 'block'
                        }}>
                          {completedCategoryTasks} of {totalCategoryTasks} tasks completed
                        </Typography>
                      </Box>
                      
                      {/* Category Metrics */}
                      <Grid container spacing={2}>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: color }}>
                              {items.length}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Work Items
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ fontWeight: 700, color: '#28a745' }}>
                              {completedCategoryTasks}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Completed
                            </Typography>
                          </Box>
                        </Grid>
                        <Grid item xs={4}>
                          <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ 
                              fontWeight: 700, 
                              color: violationCount > 0 ? '#dc3545' : '#28a745' 
                            }}>
                              {violationCount}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Violations
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {/* Show top work items in this category */}
                      {items.length > 0 && (
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                            Recent Items:
                          </Typography>
                          {items.slice(0, 3).map((item, index) => (
                            <Box key={item.parentWorkItem.id} sx={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              mb: 1,
                              p: 1,
                              backgroundColor: 'rgba(255,255,255,0.6)',
                              borderRadius: 1,
                              border: `1px solid ${color}20`
                            }}>
                              <Typography variant="caption" sx={{ 
                                fontWeight: 600,
                                color: color,
                                mr: 1,
                                minWidth: '20px'
                              }}>
                                {item.parentWorkItem.id}
                              </Typography>
                              <Typography variant="caption" sx={{ 
                                flexGrow: 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}>
                                {item.parentWorkItem.title}
                              </Typography>
                              {item.violationCount > 0 && (
                                <WarningIcon sx={{ 
                                  fontSize: 14, 
                                  color: '#dc3545',
                                  ml: 1
                                }} />
                              )}
                            </Box>
                          ))}
                          {items.length > 3 && (
                            <Typography variant="caption" sx={{ 
                              color: '#6c757d',
                              fontStyle: 'italic'
                            }}>
                              ... and {items.length - 3} more items
                            </Typography>
                          )}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : null;
      })()}

      {/* Priority-based Work Items */}
      <Grid container spacing={3}>
        {[
          { items: p1Items, priority: 1, label: 'Critical Priority' },
          { items: p2Items, priority: 2, label: 'High Priority' },
          { items: p3Items, priority: 3, label: 'Medium Priority' },
          { items: otherItems, priority: 4, label: 'Low Priority' }
        ].map(({ items, priority, label }) => (
          <Grid item xs={12} key={priority}>
            <Paper sx={{ p: 3, mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Chip 
                  label={`P${priority === 4 ? '4+' : priority}`}
                  sx={{ 
                    backgroundColor: getPriorityColor(priority),
                    color: 'white',
                    fontWeight: 700,
                    mr: 2
                  }}
                />
                <Typography variant="h6" sx={{ fontWeight: 700, color: getPriorityColor(priority) }}>
                  {label} ({items.length} items)
                </Typography>
              </Box>

              {items.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No {label.toLowerCase()} items found
                </Typography>
              ) : (
                <Grid container spacing={2}>
                  {items.map((item, index) => (
                    <Grid item xs={12} md={6} lg={4} key={index}>
                      <Card 
                        sx={{ 
                          cursor: 'pointer',
                          border: item.violationCount > 0 ? '2px solid #f44336' : '1px solid #e0e0e0',
                          '&:hover': { 
                            transform: 'translateY(-2px)', 
                            boxShadow: 4,
                            borderColor: item.violationCount > 0 ? '#f44336' : '#2196f3'
                          },
                          transition: 'all 0.2s ease-in-out'
                        }}
                        onClick={() => openStoryBugDetails(item)}
                      >
                        <CardContent sx={{ p: 2 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                            <Avatar 
                              sx={{ 
                                mr: 2, 
                                bgcolor: item.parentWorkItem.type === 'Bug' ? '#f44336' : '#2196f3',
                                width: 32,
                                height: 32,
                                fontSize: '0.875rem'
                              }}
                            >
                              {item.parentWorkItem.type === 'Bug' ? '🐛' : '📋'}
                            </Avatar>
                            <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                              <Typography variant="subtitle2" sx={{ 
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}>
                                {item.parentWorkItem.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.parentWorkItem.type} • ID: {item.parentWorkItem.id}
                              </Typography>
                            </Box>
                            {item.violationCount > 0 && (
                              <Badge badgeContent={item.violationCount} color="error">
                                <WarningIcon color="error" />
                              </Badge>
                            )}
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="caption">Compliance</Typography>
                              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                                {item.complianceScore}%
                              </Typography>
                            </Box>
                            <LinearProgress
                              variant="determinate"
                              value={item.complianceScore}
                              sx={{
                                height: 4,
                                borderRadius: 1,
                                '& .MuiLinearProgress-bar': {
                                  backgroundColor: getComplianceColor(item.complianceScore),
                                  borderRadius: 1
                                }
                              }}
                            />
                          </Box>

                          <Grid container spacing={1} sx={{ mb: 2 }}>
                            <Grid item xs={4}>
                              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', fontWeight: 600 }}>
                                {item.activeTasks.length}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                                Active
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', fontWeight: 600 }}>
                                {item.completedTasks.length}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                                Done
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', fontWeight: 600, color: '#f44336' }}>
                                {item.violationCount}
                              </Typography>
                              <Typography variant="caption" sx={{ display: 'block', textAlign: 'center', color: 'text.secondary' }}>
                                Issues
                              </Typography>
                            </Grid>
                          </Grid>

                          {item.violationCount > 0 && (
                            <Alert severity="warning" sx={{ mt: 1, p: 1 }}>
                              <Typography variant="caption">
                                {item.violationCount} task(s) missing comments
                              </Typography>
                            </Alert>
                          )}
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {selectedStoryBug && (
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Avatar 
                sx={{ 
                  mr: 2, 
                  bgcolor: selectedStoryBug.parentWorkItem.type === 'Bug' ? '#f44336' : '#2196f3',
                  width: 40,
                  height: 40
                }}
              >
                {selectedStoryBug.parentWorkItem.type === 'Bug' ? '🐛' : '📋'}
              </Avatar>
              <Box>
                <Typography variant="h6">{selectedStoryBug.parentWorkItem.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedStoryBug.parentWorkItem.type} • {selectedStoryBug.complianceScore}% Compliance • {selectedStoryBug.parentComments.length} Comments
                </Typography>
              </Box>
            </Box>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedStoryBug && (
            <Box>
              {selectedStoryBug.violationCount > 0 && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <AlertTitle>⚠️ Activity Monitoring Violations</AlertTitle>
                  <Typography variant="body2">
                    {selectedStoryBug.violationCount} task(s) where assigned team members haven't commented on the parent work item.
                  </Typography>
                </Alert>
              )}

              {/* Active Tasks */}
              {selectedStoryBug.activeTasks.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Active Tasks ({selectedStoryBug.activeTasks.length})
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Task</TableCell>
                          <TableCell>Assigned To</TableCell>
                          <TableCell>Comments</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedStoryBug.activeTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {task.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID: {task.id}
                              </Typography>
                            </TableCell>
                            <TableCell>{task.assignedTo}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CommentIcon sx={{ fontSize: 16, mr: 1 }} />
                                <Typography variant="body2">
                                  {task.parentCommentCount}
                                </Typography>
                                {task.parentCommentCount === 0 && (
                                  <Chip 
                                    label="NO COMMENTS" 
                                    size="small" 
                                    color="error" 
                                    sx={{ ml: 1, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={task.isViolation ? 'Missing Comments' : 'Compliant'}
                                size="small"
                                color={task.isViolation ? 'error' : 'success'}
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {/* Completed Tasks */}
              {selectedStoryBug.completedTasks.length > 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Completed Tasks ({selectedStoryBug.completedTasks.length})
                  </Typography>
                  <TableContainer component={Paper}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Task</TableCell>
                          <TableCell>Assigned To</TableCell>
                          <TableCell>Comments</TableCell>
                          <TableCell>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedStoryBug.completedTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {task.title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ID: {task.id}
                              </Typography>
                            </TableCell>
                            <TableCell>{task.assignedTo}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CommentIcon sx={{ fontSize: 16, mr: 1 }} />
                                <Typography variant="body2">
                                  {task.parentCommentCount}
                                </Typography>
                                {task.parentCommentCount === 0 && (
                                  <Chip 
                                    label="NO COMMENTS" 
                                    size="small" 
                                    color="error" 
                                    sx={{ ml: 1, fontSize: '0.7rem' }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={task.isViolation ? 'Missing Comments' : 'Compliant'}
                                size="small"
                                color={task.isViolation ? 'error' : 'success'}
                                sx={{ fontWeight: 600 }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ExecutiveSummaryWithActivityMonitoring;
