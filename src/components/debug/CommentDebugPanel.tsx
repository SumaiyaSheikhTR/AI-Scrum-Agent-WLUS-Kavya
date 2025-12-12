import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BugReportIcon from '@mui/icons-material/BugReport';
import CommentIcon from '@mui/icons-material/Comment';
import PersonIcon from '@mui/icons-material/Person';
import { adoService, WorkItem, WorkItemComment } from '../../services/adoService';

interface DebugInfo {
  userStoryId: number;
  userStoryTitle: string;
  totalComments: number;
  nonAutomatedComments: number;
  taskAssignees: string[];
  commentsByAssignee: { [assignee: string]: number };
  comments: WorkItemComment[];
  childTasks: WorkItem[];
}

const CommentDebugPanel: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableSprints, setAvailableSprints] = useState<any[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');

  useEffect(() => {
    loadAvailableSprints();
  }, []);

  const loadAvailableSprints = async () => {
    try {
      const sprints = await adoService.getSprints();
      setAvailableSprints(sprints);
      if (sprints.length > 0) {
        // Find current sprint or use the first one
        const currentSprint = sprints.find((s: any) => s.name.toLowerCase().includes('current')) || sprints[0];
        setSelectedSprintId(currentSprint.id.toString());
      }
    } catch (error) {
      console.error('Error loading sprints:', error);
    }
  };

  const analyzeCommentMatching = (comments: WorkItemComment[], assignedUser: string): any => {
    if (!assignedUser || assignedUser === 'Unassigned') {
      return { matches: [], details: 'No assignee' };
    }

    const assignedUserLower = assignedUser.toLowerCase().trim();
    const results = comments.map(comment => {
      const commentAuthor = comment.author.toLowerCase().trim();
      
      // Skip automated system comments
      const isAutomated = comment.text && (
        comment.text.includes('Changed to Active from team automation rules triggered by') ||
        comment.text.includes('automated') ||
        comment.text.includes('system generated') ||
        comment.text.includes('Auto-generated') ||
        comment.text.startsWith('Moved from') ||
        comment.text.startsWith('State changed from')
      );

      if (isAutomated) {
        return { 
          comment, 
          match: false, 
          reason: 'Automated comment - skipped',
          authorNormalized: commentAuthor,
          assigneeNormalized: assignedUserLower 
        };
      }

      // Enhanced author matching logic
      const commentAuthorParts = commentAuthor.split(/[\s.,()]+/).filter(part => 
        part.length > 2 && !["tr", "technology", "the"].includes(part));
      const assignedNameParts = assignedUserLower.split(/[\s.,()]+/).filter(part => 
        part.length > 2 && !["tr", "technology", "the"].includes(part));

      // Various matching strategies
      const exactMatch = commentAuthor === assignedUserLower;
      
      // Check for matching name parts
      let namePartMatch = false;
      let matchingPart = '';
      for (const authorPart of commentAuthorParts) {
        for (const assigneePart of assignedNameParts) {
          if (authorPart === assigneePart && authorPart.length > 2) {
            namePartMatch = true;
            matchingPart = authorPart;
            break;
          }
        }
        if (namePartMatch) break;
      }

      // Special handling for TR Technology format
      const isTRTechFormat = commentAuthor.includes("tr technology") || assignedUserLower.includes("tr technology");
      let trFormatMatch = false;
      if (isTRTechFormat) {
        const commentNameOnly = commentAuthorParts.filter(p => p !== "tr" && p !== "technology");
        const assignedNameOnly = assignedNameParts.filter(p => p !== "tr" && p !== "technology");
        
        for (const commentPart of commentNameOnly) {
          for (const assignedPart of assignedNameOnly) {
            if (commentPart === assignedPart && commentPart.length > 2) {
              trFormatMatch = true;
              matchingPart = commentPart;
              break;
            }
          }
          if (trFormatMatch) break;
        }
      }

      // Fall back to substring matching
      const substringMatch = 
        (commentAuthor.includes(assignedUserLower) && assignedUserLower.length > 3) ||
        (assignedUserLower.includes(commentAuthor) && commentAuthor.length > 3);

      const isMatch = exactMatch || namePartMatch || trFormatMatch || substringMatch;
      
      let reason = '';
      if (exactMatch) reason = 'Exact match';
      else if (namePartMatch) reason = `Name part match: "${matchingPart}"`;
      else if (trFormatMatch) reason = `TR Technology format match: "${matchingPart}"`;
      else if (substringMatch) reason = 'Substring match';
      else reason = 'No match found';

      return {
        comment,
        match: isMatch,
        reason,
        authorNormalized: commentAuthor,
        assigneeNormalized: assignedUserLower,
        authorParts: commentAuthorParts,
        assigneeParts: assignedNameParts
      };
    });

    return results;
  };

  const debugUserStoryComments = async () => {
    if (!selectedSprintId) {
      setError('Please select a sprint first');
      return;
    }

    setIsLoading(true);
    setError(null);
    setDebugInfo([]);

    try {
      console.log('🔍 DEBUG: Starting User Story comment analysis...');
      
      // Get all sprint work items
      const sprintWorkItems = await adoService.getSprintWorkItems(selectedSprintId);
      console.log(`🔍 DEBUG: Found ${sprintWorkItems.length} total work items in sprint`);

      // Filter User Stories and Bugs (parent items)
      const userStories = sprintWorkItems.filter(item => 
        item.type === 'User Story' || item.type === 'Bug' || item.type === 'Feature'
      );
      console.log(`🔍 DEBUG: Found ${userStories.length} User Stories/Bugs/Features`);

      // Get child tasks
      const childTasks = sprintWorkItems.filter(item => 
        item.type === 'Task' && item.parentId
      );
      console.log(`🔍 DEBUG: Found ${childTasks.length} child tasks`);

      const debugResults: DebugInfo[] = [];

      for (const userStory of userStories) {
        console.log(`🔍 DEBUG: Analyzing User Story: ${userStory.title}`);
        
        // Get comments for this User Story
        const comments = await adoService.getWorkItemComments(userStory.id, userStory.title);
        console.log(`🔍 DEBUG: Found ${comments.length} total comments on User Story ${userStory.id}`);
        
        // Filter out automated comments
        const nonAutomatedComments = comments.filter(comment => {
          return !(comment.text && (
            comment.text.includes('Changed to Active from team automation rules triggered by') ||
            comment.text.includes('automated') ||
            comment.text.includes('system generated') ||
            comment.text.includes('Auto-generated') ||
            comment.text.startsWith('Moved from') ||
            comment.text.startsWith('State changed from')
          ));
        });

        // Get child tasks for this User Story
        const storyTasks = childTasks.filter(task => task.parentId === userStory.id);
        console.log(`🔍 DEBUG: Found ${storyTasks.length} child tasks for User Story ${userStory.id}`);

        // Get unique assignees from child tasks
        const taskAssignees = Array.from(new Set(storyTasks
          .map(task => task.assignedTo)
          .filter(assignee => assignee && assignee !== 'Unassigned')
        )) as string[];

        // Count comments by assignee using the same logic as the activity monitoring
        const commentsByAssignee: { [assignee: string]: number } = {};
        
        for (const assignee of taskAssignees) {
          const matchingResults = analyzeCommentMatching(nonAutomatedComments, assignee);
          const matchingComments = matchingResults.filter((result: any) => result.match);
          commentsByAssignee[assignee] = matchingComments.length;
          
          console.log(`🔍 DEBUG: Assignee "${assignee}" has ${matchingComments.length} matching comments out of ${nonAutomatedComments.length} non-automated comments`);
        }

        debugResults.push({
          userStoryId: userStory.id,
          userStoryTitle: userStory.title,
          totalComments: comments.length,
          nonAutomatedComments: nonAutomatedComments.length,
          taskAssignees,
          commentsByAssignee,
          comments: nonAutomatedComments,
          childTasks: storyTasks
        });
      }

      setDebugInfo(debugResults);
      console.log('🔍 DEBUG: Analysis complete');

    } catch (err) {
      console.error('🔍 DEBUG: Error during analysis:', err);
      setError(`Debug analysis failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <BugReportIcon sx={{ mr: 2, color: 'primary.main' }} />
            <Typography variant="h5">
              User Story Comment Debug Panel
            </Typography>
          </Box>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This panel helps debug why activity monitoring might not be detecting comments on User Stories.
            It shows the exact comment matching logic used by the system.
          </Typography>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 250 }}>
              <InputLabel>Select Sprint</InputLabel>
              <Select
                value={selectedSprintId}
                label="Select Sprint"
                onChange={(e) => setSelectedSprintId(e.target.value)}
              >
                {availableSprints.map((sprint) => (
                  <MenuItem key={sprint.id} value={sprint.id.toString()}>
                    {sprint.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            
            <Button
              variant="contained"
              onClick={debugUserStoryComments}
              disabled={isLoading || !selectedSprintId}
              startIcon={isLoading ? <CircularProgress size={20} /> : <BugReportIcon />}
            >
              {isLoading ? 'Analyzing...' : 'Debug Comments'}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>Debug Error</AlertTitle>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {debugInfo.length > 0 && (
        <Box>
          <Typography variant="h6" sx={{ mb: 2 }}>
            📊 Debug Results ({debugInfo.length} User Stories analyzed)
          </Typography>

          {debugInfo.map((info, index) => (
            <Accordion key={index} sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    {info.userStoryTitle} (ID: {info.userStoryId})
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip 
                      label={`${info.totalComments} total comments`} 
                      size="small" 
                      color="info" 
                    />
                    <Chip 
                      label={`${info.nonAutomatedComments} non-automated`} 
                      size="small" 
                      color="primary" 
                    />
                    <Chip 
                      label={`${info.taskAssignees.length} assignees`} 
                      size="small" 
                      color="secondary" 
                    />
                  </Box>
                </Box>
              </AccordionSummary>
              
              <AccordionDetails>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    📋 Child Tasks & Assignees
                  </Typography>
                  <TableContainer component={Paper} sx={{ mb: 3 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Task ID</TableCell>
                          <TableCell>Task Title</TableCell>
                          <TableCell>Assignee</TableCell>
                          <TableCell>State</TableCell>
                          <TableCell>Comments Found</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {info.childTasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>{task.id}</TableCell>
                            <TableCell>{task.title}</TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <PersonIcon sx={{ mr: 1, fontSize: 16 }} />
                                {task.assignedTo || 'Unassigned'}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={task.state} 
                                size="small" 
                                color={task.state === 'Completed' ? 'success' : 'default'} 
                              />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={info.commentsByAssignee[task.assignedTo || ''] || 0} 
                                size="small" 
                                color={
                                  (info.commentsByAssignee[task.assignedTo || ''] || 0) > 0 
                                    ? 'success' 
                                    : 'error'
                                } 
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    💬 All Non-Automated Comments
                  </Typography>
                  {info.comments.length === 0 ? (
                    <Alert severity="warning">
                      No non-automated comments found on this User Story
                    </Alert>
                  ) : (
                    <TableContainer component={Paper}>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Author</TableCell>
                            <TableCell>Comment Text (First 100 chars)</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Matching Assignees</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {info.comments.map((comment, commentIndex) => {
                            // Check which assignees this comment matches
                            const matchingAssignees = info.taskAssignees.filter(assignee => {
                              const results = analyzeCommentMatching([comment], assignee);
                              return results.some((result: any) => result.match);
                            });

                            return (
                              <TableRow key={commentIndex}>
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <CommentIcon sx={{ mr: 1, fontSize: 16 }} />
                                    {comment.author}
                                  </Box>
                                </TableCell>
                                <TableCell>
                                  {comment.text.substring(0, 100)}
                                  {comment.text.length > 100 && '...'}
                                </TableCell>
                                <TableCell>
                                  {new Date(comment.timestamp).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                  {matchingAssignees.length > 0 ? (
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                      {matchingAssignees.map((assignee) => (
                                        <Chip 
                                          key={assignee}
                                          label={assignee} 
                                          size="small" 
                                          color="success" 
                                        />
                                      ))}
                                    </Box>
                                  ) : (
                                    <Chip label="No matches" size="small" color="default" />
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default CommentDebugPanel;
