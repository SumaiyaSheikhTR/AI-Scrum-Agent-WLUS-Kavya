import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Avatar,
  Chip,
  Alert,
  AlertTitle,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent
} from '@mui/material';
import {
  Person as PersonIcon,
  Comment as CommentIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Assignment as AssignmentIcon,
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import adoService, { WorkItem, WorkItemComment, Sprint } from '../../services/adoService';

interface TaskActivity {
  id: string;
  title: string;
  type: string;
  state: string;
  assignedTo: string;
  activatedDate?: string;
  completedDate?: string;
  updatedDate?: string;
  hasRecentCommentOnParent: boolean;
  parentCommentCount: number;
  lastParentCommentDate?: string;
  daysSinceActivation: number;
  daysSinceCompletion?: number;
  isViolation: boolean;
  violationType?: 'missing_activation_comment' | 'missing_completion_comment' | 'stale_item' | 'missing_user_story_comments';
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
}

// Helper function to get color based on days since update
const getUpdateAgeColor = (days: number | undefined): string => {
  if (days === undefined) return '#757575'; // Default gray for unknown
  if (days <= 1) return '#4caf50'; // Green for very recent (0-1 days)
  if (days <= 3) return '#8bc34a'; // Light green for recent (1-3 days)
  if (days <= 5) return '#ffeb3b'; // Yellow for moderate (3-5 days)
  if (days <= 7) return '#ff9800'; // Orange for aging (5-7 days)
  return '#f44336'; // Red for stale (>7 days)
};

const ActivityMonitoringPanel: React.FC = () => {
  console.log('🚀 ActivityMonitoringPanel: Component initializing...');
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storyBugActivities, setStoryBugActivities] = useState<StoryBugActivity[]>([]);
  const [selectedStoryBug, setSelectedStoryBug] = useState<StoryBugActivity | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [availableSprints, setAvailableSprints] = useState<Sprint[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);

  const fetchActivityData = async (sprintId?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('📊 ==================== ACTIVITY MONITORING FETCH ====================');
      console.log('📊 ACTIVITY_MONITORING: Input sprintId:', sprintId);
      console.log('📊 ACTIVITY_MONITORING: Available sprints:', availableSprints.length);
      
      // Check if ADO configuration is loaded
      if (!adoService.loadConfig()) {
        throw new Error('Azure DevOps is not configured. Please configure it in Settings.');
      }
      
      // Get current sprint if no specific sprint provided
      let sprint;
      if (sprintId) {
        sprint = availableSprints.find(s => s.id.toString() === sprintId);
        console.log('📊 ACTIVITY_MONITORING: Looking for sprint with ID:', sprintId);
        console.log('📊 ACTIVITY_MONITORING: Available sprint IDs:', availableSprints.map(s => s.id.toString()));
        
        if (!sprint) {
          console.warn('📊 ACTIVITY_MONITORING: Sprint not found in available sprints, fetching directly...');
          // Try to get the sprint directly from ADO service
          try {
            const allSprints = await adoService.getSprints();
            sprint = allSprints.find(s => s.id.toString() === sprintId);
            if (sprint) {
              console.log('📊 ACTIVITY_MONITORING: Found sprint via direct fetch:', sprint);
            }
          } catch (err) {
            console.error('📊 ACTIVITY_MONITORING: Error fetching sprints directly:', err);
          }
        }
      } else {
        sprint = await adoService.getCurrentSprint();
      }
      
      console.log('📊 ACTIVITY_MONITORING: Selected sprint:', sprint);
      
      if (!sprint) {
        const errorMsg = sprintId 
          ? `Sprint with ID ${sprintId} not found. Available sprints: ${availableSprints.map(s => `${s.name} (${s.id})`).join(', ')}`
          : 'No current sprint available for activity monitoring';
        console.error('📊 ACTIVITY_MONITORING: Sprint error:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log(`📊 ACTIVITY_MONITORING: Analyzing sprint ${sprint.name} (ID: ${sprint.id})`);
      
      // Get all work items in the sprint
      const allWorkItems = await adoService.getSprintWorkItems(sprint.id);
      console.log(`📊 ACTIVITY_MONITORING: Found ${allWorkItems.length} total work items`);
      
      if (allWorkItems.length === 0) {
        console.warn('📊 ACTIVITY_MONITORING: No work items found in sprint');
        setStoryBugActivities([]);
        setError('No work items found in the selected sprint. Please check if the sprint has work items assigned.');
        return;
      }
      
      // Separate parent items (User Stories, Bugs, Features) from child items (Tasks)
      const parentItems = allWorkItems.filter(item => 
        item.type === 'User Story' || 
        item.type === 'Bug' || 
        item.type === 'Feature' || 
        item.type === 'Epic'
      );
      
      const childTasks = allWorkItems.filter(item => 
        item.type === 'Task' && item.parentId
      );
      
      console.log(`📊 ACTIVITY_MONITORING: Found ${parentItems.length} parent items (Stories/Bugs/Features)`);
      console.log(`📊 ACTIVITY_MONITORING: Found ${childTasks.length} child tasks`);
      
      if (parentItems.length === 0) {
        console.warn('📊 ACTIVITY_MONITORING: No parent work items (Stories/Bugs) found');
        setStoryBugActivities([]);
        setError('No User Stories, Bugs, or Features found in the selected sprint.');
        return;
      }
      
      // Analyze each parent work item and its child tasks
      const activities: StoryBugActivity[] = [];
      
      for (const parentItem of parentItems) {
        console.log(`📊 ACTIVITY_MONITORING: Analyzing ${parentItem.type}: ${parentItem.title}`);
        
        // Get child tasks for this parent
        const parentTasks = childTasks.filter(task => task.parentId === parentItem.id);
        console.log(`📊 ACTIVITY_MONITORING: Found ${parentTasks.length} tasks for ${parentItem.title}`);
        
        if (parentTasks.length === 0) {
          console.log(`📊 ACTIVITY_MONITORING: No tasks found for ${parentItem.title}, skipping...`);
          continue;
        }
        
        // Get comments for the parent work item
        const parentComments = await adoService.getWorkItemComments(parentItem.id, parentItem.title);
        console.log(`📊 ACTIVITY_MONITORING: Found ${parentComments.length} comments on parent ${parentItem.title}`);
        
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
            parentComments
          });
          
          console.log(`📊 ACTIVITY_MONITORING: ${parentItem.title} - ${totalTasks} tasks, ${violationCount} violations, ${complianceScore}% compliance`);
        }
      }
      
      setStoryBugActivities(activities);
      console.log('📊 ACTIVITY_MONITORING: ✅ Analysis complete');
      
    } catch (err) {
      console.error('📊 ACTIVITY_MONITORING: ❌ Error fetching activity data:', err);
      const errorMessage = (err as Error).message;
      if (errorMessage.includes('not configured')) {
        setError('Azure DevOps is not configured. Please configure it in Settings.');
      } else if (errorMessage.includes('No sprint')) {
        setError('No sprint available. Please check if sprints are configured in Azure DevOps.');
      } else {
        setError('Failed to load activity data. Please check your connection and try again.');
      }
    } finally {
      setIsLoading(false);
      console.log('📊 ===============================================================');
    }
  };

  const analyzeTask = async (task: WorkItem, parentComments: WorkItemComment[]): Promise<TaskActivity> => {
    console.log(`🔍 Analyzing task: ${task.title} assigned to: ${task.assignedTo}`);
    
    try {
      // Determine activation and completion dates
      const activatedDate = getActivationDate(task);
      const completedDate = getCompletionDate(task);
      
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
        
        // Improved name matching logic
        // Handle format variations like "Sheikh, Sumaiya (TR Technology)" vs "Sumaiya Sheikh"
        const normalizedAuthor = comment.author.toLowerCase().trim();
        const normalizedAssignee = task.assignedTo.toLowerCase().trim();
        
        // Log the comparison to help with debugging
        console.log(`🔍 Comparing comment author: "${normalizedAuthor}" with assignee: "${normalizedAssignee}"`);
        
        // Extract email prefix if present (part before @)
        const authorEmailPrefix = normalizedAuthor.includes('@') ? 
          normalizedAuthor.split('@')[0].trim() : '';
        const assigneeEmailPrefix = normalizedAssignee.includes('@') ? 
          normalizedAssignee.split('@')[0].trim() : '';
        
        // Extract potential name parts (first/last name)
        const authorParts = normalizedAuthor.split(/[\s.,()]+/).filter(p => p.length > 1 && !["tr", "technology", "the"].includes(p));
        const assigneeParts = normalizedAssignee.split(/[\s.,()]+/).filter(p => p.length > 1 && !["tr", "technology", "the"].includes(p));
        
        // Handle special format like "Sheikh, Sumaiya (TR Technology)"
        const hasTRTech = normalizedAuthor.includes("tr technology") || normalizedAssignee.includes("tr technology");
        
        // Log parts for debugging
        console.log(`🔍 Author parts: [${authorParts.join(', ')}], Assignee parts: [${assigneeParts.join(', ')}]`);
        
        // Exact match
        if (normalizedAuthor === normalizedAssignee) {
          console.log(`✅ Exact match found`);
          return true;
        }
        
        // Email prefix match if both exist
        const authorEmail = authorEmailPrefix || authorParts.find(p => p.includes('@'));
        const assigneeEmail = assigneeEmailPrefix || assigneeParts.find(p => p.includes('@'));
        if (authorEmail && assigneeEmail && authorEmail === assigneeEmail) {
          console.log(`✅ Email match found: ${authorEmail}`);
          return true;
        }
        
        // Check for name parts matching
        for (const authorPart of authorParts) {
          for (const assigneePart of assigneeParts) {
            if (authorPart === assigneePart && authorPart.length > 2) {
              console.log(`✅ Name part match found: "${authorPart}"`);
              return true;
            }
          }
        }
        
        // Additional check for TR Technology format
        if (hasTRTech) {
          // Special case for Sheikh, Sumaiya (TR Technology) format
          console.log(`🔍 Checking TR Technology special format`);
          const authorNameOnly = authorParts.filter(p => p !== "tr" && p !== "technology");
          const assigneeNameOnly = assigneeParts.filter(p => p !== "tr" && p !== "technology");
          
          for (const authorPart of authorNameOnly) {
            for (const assigneePart of assigneeNameOnly) {
              if (authorPart === assigneePart && authorPart.length > 2) {
                console.log(`✅ TR Technology format match found: "${authorPart}"`);
                return true;
              }
            }
          }
        }
        
        // Check for substring inclusion as last resort (less precise)
        const result = normalizedAuthor.includes(normalizedAssignee) || normalizedAssignee.includes(normalizedAuthor);
        if (result) {
          console.log(`✅ Substring inclusion match found`);
        }
        return result;
      });
      
      console.log(`🔍 ${task.title}: Found ${userComments.length} comments from ${task.assignedTo} out of ${parentComments.length} total comments`);
      
      // Check for recent comments on parent around activation/completion from the assigned user
      const hasRecentCommentOnParent = checkForRecentCommentsFromUser(
        parentComments, 
        task.assignedTo || 'Unassigned',
        activatedDate, 
        completedDate
      );
      
      // Check if there are ANY non-automated comments on the parent User Story
      // This is needed to verify that the User Story has comments when tasks are in progress/completed
      // Filter out automated comments first
      const nonAutomatedParentComments = parentComments.filter(comment => {
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
        return true; // Keep all non-automated comments
      });
      
      // Check if there are any genuine comments on the User Story
      const hasAnyNonAutomatedCommentOnParent = nonAutomatedParentComments.length > 0;
      
      console.log(`🔍 ${task.title}: Parent story has ${nonAutomatedParentComments.length} non-automated comments: ${hasAnyNonAutomatedCommentOnParent}`);
      
      // Calculate days since activation/completion
      const daysSinceActivation = activatedDate ? 
        Math.floor((Date.now() - new Date(activatedDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
      
      const daysSinceCompletion = completedDate ? 
        Math.floor((Date.now() - new Date(completedDate).getTime()) / (1000 * 60 * 60 * 24)) : undefined;
      
      // Calculate task properties for checking requirements
      const isAssigned = task.assignedTo && task.assignedTo !== 'Unassigned';
      const isActive = task.state === 'In Progress' || task.state === 'Active';
      const isCompleted = task.state === 'Completed' || task.state === 'Done';
      const isNew = task.state === 'New' || task.state === 'To Do' || task.state === 'Proposed';
      const isClosed = task.state === 'Closed' || task.state === 'Resolved' || task.state === 'Removed';
      
      // Debug state info
      console.log(`🔍 Task state check: ${task.title} - State: ${task.state}, IsNew: ${isNew}, IsClosed: ${isClosed}`);
      
      // Skip checking comment requirements for new and closed tasks
      if (!isAssigned || isNew || isClosed) {
        console.log(`🔍 Skipping violation checks for task ${task.id} - ${task.title} with state ${task.state} - ${!isAssigned ? 'Not assigned' : (isNew ? 'New state' : 'Closed state')}`)
        return {
          id: task.id.toString(),
          title: task.title,
          type: task.type,
          state: task.state,
          assignedTo: task.assignedTo || 'Unassigned',
          activatedDate,
          completedDate,
          hasRecentCommentOnParent,
          parentCommentCount: parentComments.length,
          lastParentCommentDate: parentComments.length > 0 ? parentComments[0].timestamp : undefined,
          daysSinceActivation,
          daysSinceCompletion,
          isViolation: false, // New and closed tasks are never violations
          parentComments
        };
      }
      let isViolation = false;
      let violationType: TaskActivity['violationType'];
      
      // Check if the task was updated recently (in the last 3 days)
      const taskUpdateDate = new Date(task.updatedDate);
      const currentDate = new Date();
      const daysSinceUpdate = Math.floor((currentDate.getTime() - taskUpdateDate.getTime()) / (1000 * 60 * 60 * 24));
      const isRecentlyUpdated = daysSinceUpdate <= 3;
      
      console.log(`🔍 ${task.title}: Days since last update: ${daysSinceUpdate}, Recently updated: ${isRecentlyUpdated}`);
      
      // Check for parent comments if task is active or completed and recently updated
      if (nonAutomatedParentComments.length === 0 && 
          isRecentlyUpdated && 
          (isActive || isCompleted)) {
        isViolation = true;
        violationType = 'missing_user_story_comments';
        console.log(`🔍 VIOLATION: Parent User Story has NO comments while having recently updated ${task.state} tasks! (${daysSinceUpdate} days since update)`);
      } else if (userComments.length === 0) {
        // User has NEVER commented on parent
        if (isActive && daysSinceActivation > 2) {
          // Only mark as violation if task has been active for more than 2 days
          isViolation = true;
          violationType = 'missing_activation_comment';
        } else if (isCompleted) {
          // For completed tasks, we should definitely have a comment
          isViolation = true;
          violationType = 'missing_completion_comment';
        }
      } else if (userComments.length < 2) {
        // User has only 1 comment, check if timing is appropriate
        if (completedDate && !hasCommentAroundDateFromUser(userComments, completedDate, task.assignedTo)) {
          if ((daysSinceCompletion ?? 0) >= 2) {
            // Only mark as violation if completion was 2+ days ago
            isViolation = true;
            violationType = 'missing_completion_comment';
          }
        } else if (activatedDate && !hasCommentAroundDateFromUser(userComments, activatedDate, task.assignedTo)) {
          if (daysSinceActivation >= 3) {
            // For activation, be more lenient - only mark as violation if task has been active for 3+ days
            isViolation = true;
            violationType = 'missing_activation_comment';
          }
        }
      } else {
        // User has 2+ comments, consider it compliant regardless of timing
        isViolation = false;
      }
      
      const taskActivity: TaskActivity = {
        id: task.id.toString(),
        title: task.title,
        type: task.type,
        state: task.state,
        assignedTo: task.assignedTo || 'Unassigned',
        activatedDate,
        completedDate,
        updatedDate: task.updatedDate,
        hasRecentCommentOnParent,
        parentCommentCount: userComments.length, // Show only comments from assigned user
        lastParentCommentDate: userComments.length > 0 ? 
          userComments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0].timestamp :
          undefined,
        daysSinceActivation,
        daysSinceCompletion,
        isViolation: isViolation,
        violationType,
        parentComments: userComments.slice(0, 5) // Keep only recent 5 comments from assigned user
      };
      
      const statusMessage = isViolation 
        ? violationType === 'missing_user_story_comments'
          ? `❌ USER STORY MISSING COMMENTS - RECENTLY UPDATED TASK!`
          : `❌ VIOLATION (${violationType}) - MISSING COMMENTS!` 
        : userComments.length === 0 
          ? '✅ Compliant (No assignment or inactive task)'
          : `✅ Compliant (${userComments.length} user comments)`;
      
      console.log(`🔍 ${task.title} (${task.assignedTo}): ${statusMessage} - State: ${task.state}, User Comments: ${userComments.length}/${parentComments.length}, ${daysSinceActivation}d since activation, ${daysSinceCompletion || 'N/A'}d since completion`);
      
      return taskActivity;
      
    } catch (error) {
      console.error(`Error analyzing task ${task.id}:`, error);
      
      // Return a basic task activity with error state
      return {
        id: task.id.toString(),
        title: task.title,
        type: task.type,
        state: task.state,
        assignedTo: task.assignedTo || 'Unassigned',
        hasRecentCommentOnParent: false,
        parentCommentCount: 0,
        daysSinceActivation: 0,
        isViolation: true,
        violationType: 'stale_item'
      };
    }
  };

  const getActivationDate = (item: WorkItem): string | undefined => {
    // For tasks in In Progress or Active state, use the updatedDate as a proxy for when it was activated
    // This assumes the updatedDate reflects when the state was changed to active
    if (item.state === 'In Progress' || item.state === 'Active') {
      // Use updatedDate if it's recent, otherwise fall back to createdDate
      const updated = new Date(item.updatedDate);
      const created = new Date(item.createdDate);
      const now = new Date();
      
      // If updated date is more recent than created date and within reasonable timeframe, use it
      if (updated > created && (now.getTime() - updated.getTime()) < (30 * 24 * 60 * 60 * 1000)) { // Within 30 days
        return item.updatedDate;
      }
      return item.createdDate;
    }
    return undefined;
  };

  const getCompletionDate = (item: WorkItem): string | undefined => {
    // For completed/closed items, use the updatedDate as completion date
    if (item.state === 'Done' || item.state === 'Closed' || item.state === 'Completed' || item.state === 'Resolved') {
      // Use updatedDate if it's different from createdDate, indicating actual completion
      const updated = new Date(item.updatedDate);
      const created = new Date(item.createdDate);
      
      // If updated date is different from created date, it's likely the completion date
      if (updated.getTime() !== created.getTime()) {
        return item.updatedDate;
      }
      return item.createdDate; // Fallback if they're the same
    }
    return undefined;
  };

  const checkForRecentCommentsFromUser = (
    comments: WorkItemComment[], 
    assignedUser: string,
    activatedDate?: string, 
    completedDate?: string
  ): boolean => {
    if (comments.length === 0 || !assignedUser || assignedUser === 'Unassigned') return false;
    
    // Handle cases with minimal info - if we have lots of user comments but no specific dates
    // Consider it compliant if the user has at least some comments on the work item
    const userComments = comments.filter(comment => {
      if (!comment.author || !assignedUser) return false;
      
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
      
      // Enhanced author matching
      const commentAuthor = comment.author.toLowerCase().trim();
      const assignedUserLower = assignedUser.toLowerCase().trim();
      
      console.log(`🔍 Checking if comment by "${commentAuthor}" matches assigned user "${assignedUserLower}"`);
      
      // Handle special format like "Sheikh, Sumaiya (TR Technology)"
      const isTRTechFormat = commentAuthor.includes("tr technology") || assignedUserLower.includes("tr technology");
      
      // Extract key parts of assigned user name for more flexible matching
      // Exclude common words that aren't useful for matching
      const commentAuthorParts = commentAuthor.split(/[\s.,()]+/).filter(part => 
        part.length > 2 && !["tr", "technology", "the"].includes(part));
      const assignedNameParts = assignedUserLower.split(/[\s.,()]+/).filter(part => 
        part.length > 2 && !["tr", "technology", "the"].includes(part));
      
      console.log(`🔍 Comment author parts: [${commentAuthorParts.join(', ')}]`);
      console.log(`🔍 Assigned user parts: [${assignedNameParts.join(', ')}]`);
      
      // Various matching strategies
      const exactMatch = commentAuthor === assignedUserLower;
      
      // Check for matching name parts
      let namePartMatch = false;
      for (const authorPart of commentAuthorParts) {
        for (const assigneePart of assignedNameParts) {
          if (authorPart === assigneePart && authorPart.length > 2) {
            namePartMatch = true;
            console.log(`✅ Name part match found: "${authorPart}"`);
            break;
          }
        }
        if (namePartMatch) break;
      }
      
      // Special handling for TR Technology format
      let trFormatMatch = false;
      if (isTRTechFormat) {
        // Look for specific matches in the TR Technology format
        const commentNameOnly = commentAuthorParts.filter(p => p !== "tr" && p !== "technology");
        const assignedNameOnly = assignedNameParts.filter(p => p !== "tr" && p !== "technology");
        
        for (const commentPart of commentNameOnly) {
          for (const assignedPart of assignedNameOnly) {
            if (commentPart === assignedPart && commentPart.length > 2) {
              trFormatMatch = true;
              console.log(`✅ TR Technology format match found: "${commentPart}"`);
              break;
            }
          }
          if (trFormatMatch) break;
        }
      }
      
      // Fall back to substring matching only if necessary
      const substringMatch = 
        (commentAuthor.includes(assignedUserLower) && assignedUserLower.length > 3) ||
        (assignedUserLower.includes(commentAuthor) && commentAuthor.length > 3);
      
      const isMatch = exactMatch || namePartMatch || trFormatMatch || substringMatch;
      if (isMatch) {
        console.log(`✅ Comment author "${commentAuthor}" matched assigned user "${assignedUserLower}"`);
      }
      
      return isMatch;
    });
    
    console.log(`🔍 checkForRecentCommentsFromUser: ${userComments.length} comments from ${assignedUser} found`);
    
    if (userComments.length === 0) return false;
    
    // First check: If the user has significant number of comments (3+), we can assume they're actively communicating
    if (userComments.length >= 3) {
      console.log(`🔍 Found ${userComments.length} comments for ${assignedUser} - considering compliant based on volume`);
      return true;
    }
    
    // Second check: Check for comments within +/- 3 days of activation or completion
    if (activatedDate && hasCommentAroundDateFromUser(userComments, activatedDate, assignedUser)) {
      console.log(`🔍 Found activation comment for ${assignedUser} around ${activatedDate}`);
      return true;
    }
    
    if (completedDate && hasCommentAroundDateFromUser(userComments, completedDate, assignedUser)) {
      console.log(`🔍 Found completion comment for ${assignedUser} around ${completedDate}`);
      return true;
    }
    
    // If neither activation nor completion date has a comment but the user has some comments,
    // consider it compliant if the task was just activated recently (within last 2 days)
    if (activatedDate) {
      const activationDate = new Date(activatedDate);
      const now = new Date();
      const daysSinceActivation = Math.floor((now.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceActivation <= 2) {
        console.log(`🔍 Task was just activated ${daysSinceActivation} days ago, considering compliant for now`);
        return true;
      }
    }
    
    return false;
  };

  const hasCommentAroundDateFromUser = (
    comments: WorkItemComment[], 
    targetDate: string, 
    assignedUser: string
  ): boolean => {
    if (!assignedUser || assignedUser === 'Unassigned' || comments.length === 0) return false;
    
    const target = new Date(targetDate);
    // More lenient time window - 3 days before and after instead of just 1 day
    const threeDaysBefore = new Date(target.getTime() - 3 * 24 * 60 * 60 * 1000);
    const threeDaysAfter = new Date(target.getTime() + 3 * 24 * 60 * 60 * 1000);
    
    // Extract key parts of assigned user name for more flexible matching
    const assignedUserLower = assignedUser.toLowerCase();
    const assignedNameParts = assignedUserLower.split(/[\s@.]+/).filter(part => part.length > 2);
    
    return comments.some(comment => {
      const commentDate = new Date(comment.timestamp);
      const isWithinTimeRange = commentDate >= threeDaysBefore && commentDate <= threeDaysAfter;
      
      if (!isWithinTimeRange) return false;
      
      // Enhanced user matching with more flexibility
      const commentAuthor = comment.author?.toLowerCase() || '';
      
      // Exact match check
      if (commentAuthor === assignedUserLower) {
        console.log(`🔍 Found exact name match comment from ${comment.author} on ${comment.timestamp} for target date ${targetDate}`);
        return true;
      }
      
      // Check for name parts matching (e.g., first name, last name, username)
      const hasNamePartMatch = assignedNameParts.some(part => 
        commentAuthor.includes(part) && part.length > 2
      );
      
      // Check for email-style matching (e.g., "John Doe <john.doe@example.com>")
      const emailPattern = new RegExp(`<[^>]*${assignedUserLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^>]*>`, 'i');
      const hasEmailMatch = emailPattern.test(commentAuthor);
      
      // Check for substring matching with minimum length threshold
      const substringMatch = 
        (commentAuthor.includes(assignedUserLower) && assignedUserLower.length > 3) ||
        (assignedUserLower.includes(commentAuthor) && commentAuthor.length > 3);
      
      const isFromUser = hasNamePartMatch || hasEmailMatch || substringMatch;
      
      if (isFromUser) {
        console.log(`🔍 Found matching comment from ${comment.author} on ${comment.timestamp} for target date ${targetDate}`);
        console.log(`   Match type: ${hasNamePartMatch ? 'name part' : ''}${hasEmailMatch ? 'email' : ''}${substringMatch ? 'substring' : ''}`);
      }
      
      return isFromUser;
    });
  };

  // Function to determine if a parent work item needs comments based on its tasks
  const parentRequiresComments = (storyBug: StoryBugActivity): boolean => {
    // Check if ANY active or completed tasks were updated in the last 3 days
    // Only consider In Progress, Active, Completed, and Done states (NOT New, Closed, or Resolved)
    const now = new Date();
    const hasRecentlyUpdatedTasks = [...storyBug.activeTasks, ...storyBug.completedTasks].some(task => {
      // Only consider proper states - EXPLICITLY exclude New and Closed states
      const isActive = task.state === 'In Progress' || task.state === 'Active';
      const isCompleted = task.state === 'Completed' || task.state === 'Done';
      const isNew = task.state === 'New' || task.state === 'To Do' || task.state === 'Proposed';
      const isClosed = task.state === 'Closed' || task.state === 'Resolved' || task.state === 'Removed';
      
      // Skip the task if it's New or Closed
      if (isNew || isClosed) {
        console.log(`🔍 Parent comment check: Skipping task ${task.title} - state ${task.state} is New or Closed`);
        return false;
      }
      
      // Also skip if not Active or Completed
      if (!(isActive || isCompleted)) {
        return false;
      }
      
      // Calculate days since update
      const updateDate = task.updatedDate || task.activatedDate || task.completedDate;
      if (!updateDate) return false;
      
      const daysSinceUpdate = Math.floor((now.getTime() - new Date(updateDate).getTime()) / (1000 * 60 * 60 * 24));
      console.log(`🔍 Parent comment check: Task ${task.title} (${task.state}) was updated ${daysSinceUpdate} days ago`);
      
      // Consider tasks updated within the last 3 days
      return daysSinceUpdate <= 3;
    });
    
    // Check if parent has any non-automated comments
    const hasNonAutomatedComments = storyBug.parentComments.some(comment => {
      // Skip automated system comments
      return !(comment.text && (
        comment.text.includes('automated') ||
        comment.text.includes('system generated') ||
        comment.text.includes('Auto-generated') ||
        comment.text.startsWith('Moved from') ||
        comment.text.startsWith('State changed from')
      ));
    });
    
    // If there are recently active tasks but no comments, parent needs comments
    const needsComments = hasRecentlyUpdatedTasks && !hasNonAutomatedComments;
    console.log(`🔍 Parent work item "${storyBug.parentWorkItem.title}" needs comments? ${needsComments} (Has recent tasks: ${hasRecentlyUpdatedTasks}, Has comments: ${hasNonAutomatedComments})`);
    
    return needsComments;
  };

  const getViolationColor = (violationType?: TaskActivity['violationType']): string => {
    switch (violationType) {
      case 'missing_activation_comment': return '#ff9800'; // Orange
      case 'missing_completion_comment': return '#f44336'; // Red
      case 'stale_item': return '#9c27b0'; // Purple
      case 'missing_user_story_comments': return '#e91e63'; // Pink - for User Story level violations
      default: return '#4caf50'; // Green
    }
  };

  const getViolationLabel = (violationType?: TaskActivity['violationType']): string => {
    switch (violationType) {
      case 'missing_activation_comment': return 'Missing Comments';
      case 'missing_completion_comment': return 'Missing Comments';
      case 'stale_item': return 'Stale/Error';
      case 'missing_user_story_comments': return 'User Story Missing Comments (Recent Update)';
      default: return 'Compliant';
    }
  };

  const handleSprintChange = async (event: SelectChangeEvent<string>) => {
    const sprintId = event.target.value;
    setSelectedSprintId(sprintId);
    await fetchActivityData(sprintId);
  };

  const handleRefresh = () => {
    console.log('🔄 Manual refresh triggered for activity monitoring data');
    fetchActivityData(selectedSprintId || undefined);
  };

  const openStoryBugDetails = (storyBug: StoryBugActivity) => {
    // Debug info to verify comment counts
    console.log('DEBUG STORY COMMENTS:');
    console.log(`Parent work item "${storyBug.parentWorkItem.title}" has ${storyBug.parentComments.length} comments`);
    console.log(`Comment count in UI header: ${storyBug.parentComments.length} comments`);
    
    // Calculate days since last update for each task
    const now = new Date();
    const taskUpdateInfo = [...storyBug.activeTasks, ...storyBug.completedTasks].map(task => {
      // Calculate days since activation/completion
      const daysSinceActivation = task.daysSinceActivation || 0;
      const daysSinceCompletion = task.daysSinceCompletion || 0;
      const updatedDaysAgo = task.activatedDate ? 
        Math.floor((now.getTime() - new Date(task.activatedDate).getTime()) / (1000 * 60 * 60 * 24)) : 
        (task.completedDate ? 
          Math.floor((now.getTime() - new Date(task.completedDate).getTime()) / (1000 * 60 * 60 * 24)) : 
          0);
      
      return {
        title: task.title,
        state: task.state,
        daysSinceActivation,
        daysSinceCompletion,
        updatedDaysAgo,
        updatedRecently: updatedDaysAgo <= 3,
        isViolation: task.isViolation,
        violationType: task.violationType
      };
    });
    
    console.log('Task update information:', taskUpdateInfo);
    
    // Log all violation types on tasks
    const allViolations = [...storyBug.activeTasks, ...storyBug.completedTasks]
      .filter(task => task.isViolation)
      .map(task => `${task.title} (${task.violationType})`);
    
    console.log(`Tasks with violations (${allViolations.length}):`, allViolations);
    
    // Log assigned users and their comments
    const userCommentCounts = [...storyBug.activeTasks, ...storyBug.completedTasks]
      .map(task => ({ 
        task: task.title, 
        assignedTo: task.assignedTo, 
        commentsCount: task.parentCommentCount,
        isViolation: task.isViolation,
        violationType: task.violationType
      }));
    
    console.log('User comment stats:', userCommentCounts);
    
    setSelectedStoryBug(storyBug);
    setDetailsOpen(true);
  };

  useEffect(() => {
    if (selectedStoryBug) {
      // Debug parent comment requirement check
      const needsComments = parentRequiresComments(selectedStoryBug);
      console.log(`🔍 PARENT COMMENT CHECK: ${selectedStoryBug.parentWorkItem.title} needs comments? ${needsComments}`);
      
      // Log the task states
      console.log('🔍 Active Tasks:');
      selectedStoryBug.activeTasks.forEach(task => {
        console.log(`   - ${task.title} (${task.state}): ${task.daysSinceActivation} days since activation`);
      });
      
      console.log('🔍 Completed Tasks:');
      selectedStoryBug.completedTasks.forEach(task => {
        console.log(`   - ${task.title} (${task.state}): ${task.daysSinceCompletion ?? 'N/A'} days since completion`);
      });
    }
  }, [selectedStoryBug]);

  useEffect(() => {
    const initializeData = async () => {
      try {
        console.log('🔄 ACTIVITY_MONITORING: useEffect triggered, initializing data...');
        console.log('🔄 ACTIVITY_MONITORING: adoService available:', !!adoService);
        
        // Check if ADO configuration is loaded
        const configLoaded = adoService.loadConfig();
        console.log('🔄 ACTIVITY_MONITORING: Config loaded:', configLoaded);
        
        if (!configLoaded) {
          console.warn('🔄 ACTIVITY_MONITORING: ADO not configured');
          setError('Azure DevOps is not configured. Please configure it in Settings.');
          setIsLoading(false);
          return;
        }
        
        console.log('🔄 ACTIVITY_MONITORING: Fetching sprints...');
        
        // Load available sprints with better error handling
        let current, sprints;
        try {
          [current, sprints] = await Promise.all([
            adoService.getCurrentSprint(),
            adoService.getSprints()
          ]);
        } catch (sprintError) {
          console.error('🔄 ACTIVITY_MONITORING: Error fetching sprints:', sprintError);
          throw new Error(`Failed to fetch sprints: ${(sprintError as Error).message}`);
        }
        
        console.log('🔄 ACTIVITY_MONITORING: Current sprint:', current);
        console.log('🔄 ACTIVITY_MONITORING: Available sprints:', sprints.length, sprints.map(s => `${s.name} (${s.id})`));
        
        if (!sprints || sprints.length === 0) {
          throw new Error('No sprints found in Azure DevOps. Please ensure sprints are configured for your project.');
        }
        
        setAvailableSprints(sprints);
        setSelectedSprintId(current?.id.toString() || sprints[0]?.id.toString() || null);
        
        // Fetch activity data for current sprint or first available sprint
        const sprintToUse = current || sprints[0];
        if (sprintToUse) {
          console.log('🔄 ACTIVITY_MONITORING: Fetching data for sprint:', sprintToUse.name, 'ID:', sprintToUse.id);
          await fetchActivityData(sprintToUse.id.toString());
        } else {
          console.warn('🔄 ACTIVITY_MONITORING: No sprints available');
          setError('No sprints available in Azure DevOps. Please check if sprints are configured for your project.');
          setIsLoading(false);
        }
      } catch (error) {
        console.error('🔄 ACTIVITY_MONITORING: Error initializing activity monitoring:', error);
        const errorMessage = (error as Error).message;
        if (errorMessage.includes('not configured')) {
          setError('Azure DevOps is not configured. Please configure it in Settings.');
        } else {
          setError('Failed to initialize activity monitoring: ' + errorMessage);
        }
        setIsLoading(false);
      }
    };

    console.log('🔄 ACTIVITY_MONITORING: About to call initializeData...');
    initializeData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  console.log('🎯 ActivityMonitoringPanel: Render called with state:', { 
    isLoading, 
    error: !!error, 
    activitiesCount: storyBugActivities.length,
    selectedSprintId 
  });

  if (isLoading) {
    console.log('🎯 ActivityMonitoringPanel: Rendering loading state...');
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Analyzing story/bug activities...</Typography>
      </Box>
    );
  }

  if (error) {
    console.log('🎯 ActivityMonitoringPanel: Rendering error state:', error);
    return (
      <Box sx={{ m: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Configuration Issue</AlertTitle>
          <Typography variant="body2" component="div" sx={{ whiteSpace: 'pre-line' }}>
            {error}
          </Typography>
        </Alert>
        
        <Alert severity="info">
          <AlertTitle>Troubleshooting Steps</AlertTitle>
          <Typography variant="body2" component="div">
            1. Go to <strong>Settings</strong> and verify your Azure DevOps configuration<br/>
            2. Ensure the <strong>Project Name</strong> is correct<br/>
            3. Check that your Personal Access Token has permissions to read work items<br/>
            4. Verify sprints are configured in Azure DevOps<br/>
            5. Ensure there are User Stories or Bugs with child Tasks in the sprint
          </Typography>
        </Alert>
      </Box>
    );
  }

  const totalViolations = storyBugActivities.reduce((sum, storyBug) => sum + storyBug.violationCount, 0);
  const averageCompliance = storyBugActivities.length > 0 ? 
    Math.round(storyBugActivities.reduce((sum, storyBug) => sum + storyBug.complianceScore, 0) / storyBugActivities.length) : 0;
  const totalTasks = storyBugActivities.reduce((sum, storyBug) => sum + storyBug.totalTasks, 0);
  
  // Calculate tasks with zero comments (major violation)
  const zeroCommentTasks = storyBugActivities.reduce((sum, storyBug) => {
    return sum + [...storyBug.activeTasks, ...storyBug.completedTasks].filter(task => task.parentCommentCount === 0).length;
  }, 0);

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Card sx={{ p: 3 }}>
          <CardContent>
            <Box display="flex" alignItems="center" justifyContent="center" minHeight="200px">
              <CircularProgress size={40} />
              <Typography variant="h6" sx={{ ml: 2 }}>
                Loading activity monitoring data...
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Card sx={{ p: 3 }}>
          <CardContent>
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>Error Loading Activity Monitoring</AlertTitle>
              {error}
            </Alert>
            <Button 
              variant="contained" 
              onClick={handleRefresh}
              startIcon={<RefreshIcon />}
            >
              Retry Loading Data
            </Button>
          </CardContent>
        </Card>
      </Box>
    );
  }

  // No data state
  if (storyBugActivities.length === 0 && !isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Card sx={{ p: 3 }}>
          <CardContent>
            <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="200px">
              <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No Team Activity Data Available
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
                There are no work items or team activities to monitor for the current sprint.
              </Typography>
              <Button 
                variant="outlined" 
                onClick={handleRefresh}
                startIcon={<RefreshIcon />}
              >
                Refresh Data
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      p: 2,
      '& @keyframes pulse': {
        '0%': { opacity: 1 },
        '50%': { opacity: 0.6 },
        '100%': { opacity: 1 }
      }
    }}>
      {/* Header and Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          📊 Story/Bug Activity Monitoring
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 250 }}>
            <InputLabel>Select Sprint</InputLabel>
            <Select
              value={selectedSprintId || ''}
              label="Select Sprint"
              onChange={handleSprintChange}
            >
              {availableSprints.map((sprint) => (
                <MenuItem key={sprint.id} value={sprint.id.toString()}>
                  {sprint.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={isLoading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <PersonIcon sx={{ fontSize: 32, color: '#2196f3', mb: 1 }} />
              <Typography variant="h4">{storyBugActivities.length}</Typography>
              <Typography variant="body2" color="text.secondary">Stories/Bugs</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CommentIcon sx={{ fontSize: 32, color: '#ff5722', mb: 1 }} />
              <Typography variant="h4" color="error.main">{zeroCommentTasks}</Typography>
              <Typography variant="body2" color="text.secondary">Zero Comments</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <WarningIcon sx={{ fontSize: 32, color: '#f44336', mb: 1 }} />
              <Typography variant="h4">{totalViolations}</Typography>
              <Typography variant="body2" color="text.secondary">Total Violations</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <CheckCircleIcon sx={{ fontSize: 32, color: '#4caf50', mb: 1 }} />
              <Typography variant="h4">{averageCompliance}%</Typography>
              <Typography variant="body2" color="text.secondary">Average Compliance</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <AssignmentIcon sx={{ fontSize: 32, color: '#ff9800', mb: 1 }} />
              <Typography variant="h4">{totalTasks}</Typography>
              <Typography variant="body2" color="text.secondary">Total Tasks</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Story/Bug Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {storyBugActivities.map((storyBugActivity, index) => (
          <Grid item xs={12} md={6} lg={4} key={index}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                transition: 'all 0.2s ease-in-out',
                border: storyBugActivity.violationCount > 0 ? '2px solid #f44336' : '1px solid #e0e0e0'
              }}
              onClick={() => openStoryBugDetails(storyBugActivity)}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar 
                    sx={{ 
                      mr: 2, 
                      bgcolor: storyBugActivity.parentWorkItem.type === 'Bug' ? '#f44336' : '#2196f3',
                      width: 40,
                      height: 40,
                      fontSize: '1rem'
                    }}
                  >
                    {storyBugActivity.parentWorkItem.type === 'Bug' ? '🐛' : '📋'}
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600 }}>
                      {storyBugActivity.parentWorkItem.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {storyBugActivity.parentWorkItem.type} • ID: {storyBugActivity.parentWorkItem.id}
                    </Typography>
                  </Box>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">Compliance Score</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {storyBugActivity.complianceScore}%
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={storyBugActivity.complianceScore}
                    sx={{
                      height: 8,
                      borderRadius: 1,
                      backgroundColor: '#f5f5f5',
                      '& .MuiLinearProgress-bar': {
                        backgroundColor: storyBugActivity.complianceScore >= 80 ? '#4caf50' : 
                                         storyBugActivity.complianceScore >= 60 ? '#ff9800' : '#f44336',
                        borderRadius: 1
                      }
                    }}
                  />
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={4}>
                    <Typography variant="h6" sx={{ textAlign: 'center' }}>
                      {storyBugActivity.activeTasks.length}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center' }}>
                      Active
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="h6" sx={{ textAlign: 'center' }}>
                      {storyBugActivity.completedTasks.length}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center' }}>
                      Completed
                    </Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="h6" sx={{ textAlign: 'center', color: '#f44336' }}>
                      {storyBugActivity.violationCount}
                    </Typography>
                    <Typography variant="caption" sx={{ display: 'block', textAlign: 'center' }}>
                      Violations
                    </Typography>
                  </Grid>
                </Grid>

                {storyBugActivity.violationCount > 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      {storyBugActivity.violationCount} task(s) where assigned members haven't commented on parent
                    </Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Story/Bug Details Dialog */}
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
                  height: 40,
                  fontSize: '1rem'
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
          {selectedStoryBug && parentRequiresComments(selectedStoryBug) && (
            <Alert 
              severity="error" 
              sx={{ mb: 3, fontWeight: 'bold' }}
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => window.open(`https://dev.azure.com/${selectedStoryBug.parentWorkItem.url}`, '_blank')}
                >
                  ADD COMMENT
                </Button>
              }
            >
              Parent {selectedStoryBug.parentWorkItem.type} requires comments! You have recently updated tasks but no comments on the parent item.
            </Alert>
          )}
          {selectedStoryBug && (
            <Box>
              {/* Violations Summary */}
              {selectedStoryBug.violationCount > 0 && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  <AlertTitle>⚠️ CRITICAL: Comment Violations Found</AlertTitle>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                    {selectedStoryBug.violationCount} task(s) where assigned team members have NOT commented on the parent story/bug.
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    🚨 <strong>REQUIREMENTS:</strong> 
                  </Typography>
                  <Typography variant="body2" component="div">
                    <Box component="ul" sx={{ margin: '4px 0', paddingLeft: '20px' }}>
                      <li><strong>Parent Work Item:</strong> Must have comments if there are any active/completed tasks updated within the last 3 days</li>
                      <li><strong>Task Level:</strong> Every active/completed task must have at least 1 comment from the assigned user on the parent work item</li>
                    </Box>
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 1, color: 'error.main' }}>
                    Tasks with 0 comments are automatically flagged as violations regardless of timing.
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
                          <TableCell>Last Updated</TableCell>
                          <TableCell>Assigned Comments</TableCell>
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
                              <Tooltip title={`Last updated on ${task.activatedDate ? new Date(task.activatedDate).toLocaleString() : 'unknown date'}`}>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    fontWeight: 'bold', 
                                    display: 'block',
                                    color: getUpdateAgeColor(task.activatedDate ? 
                                      Math.floor((new Date().getTime() - new Date(task.activatedDate).getTime()) / (1000 * 60 * 60 * 24)) : 
                                      undefined)
                                  }}
                                >
                                  {task.activatedDate ? 
                                    `${Math.floor((new Date().getTime() - new Date(task.activatedDate).getTime()) / (1000 * 60 * 60 * 24))} days ago` :
                                    'Not activated'
                                  }
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CommentIcon sx={{ fontSize: 16, mr: 1 }} />
                                <Typography variant="body2">
                                  {task.parentCommentCount}
                                </Typography>
                                {task.parentCommentCount === 0 && (
                                  <Chip 
                                    label="NO COMMENTS - VIOLATION!" 
                                    size="small" 
                                    color="error" 
                                    sx={{ 
                                      ml: 1, 
                                      fontSize: '0.7rem',
                                      fontWeight: 'bold',
                                      animation: 'pulse 2s infinite'
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={task.isViolation ? getViolationLabel(task.violationType) : 'Compliant'}
                                size="small"
                                sx={{
                                  backgroundColor: getViolationColor(task.violationType),
                                  color: 'white',
                                  fontWeight: 600
                                }}
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
                          <TableCell>Last Updated</TableCell>
                          <TableCell>Assigned Comments</TableCell>
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
                              {task.completedDate ? (
                                <>
                                  <Typography variant="body2">
                                    {new Date(task.completedDate).toLocaleDateString()}
                                  </Typography>
                                <Tooltip title={`Completed on ${new Date(task.completedDate).toLocaleString()}`}>
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      fontWeight: 'bold', 
                                      display: 'block',
                                      color: getUpdateAgeColor(
                                        Math.floor((new Date().getTime() - new Date(task.completedDate).getTime()) / (1000 * 60 * 60 * 24))
                                      )
                                    }}
                                  >
                                    {Math.floor((new Date().getTime() - new Date(task.completedDate).getTime()) / (1000 * 60 * 60 * 24))} days ago
                                  </Typography>
                                </Tooltip>
                                </>
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  Unknown
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <CommentIcon sx={{ fontSize: 16, mr: 1 }} />
                                <Typography variant="body2">
                                  {task.parentCommentCount}
                                </Typography>
                                {task.parentCommentCount === 0 && (
                                  <Chip 
                                    label="NO COMMENTS - VIOLATION!" 
                                    size="small" 
                                    color="error" 
                                    sx={{ 
                                      ml: 1, 
                                      fontSize: '0.7rem',
                                      fontWeight: 'bold',
                                      animation: 'pulse 2s infinite'
                                    }}
                                  />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={task.isViolation ? getViolationLabel(task.violationType) : 'Compliant'}
                                size="small"
                                sx={{
                                  backgroundColor: getViolationColor(task.violationType),
                                  color: 'white',
                                  fontWeight: 600
                                }}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}

              {selectedStoryBug.activeTasks.length === 0 && selectedStoryBug.completedTasks.length === 0 && (
                <Alert severity="info">
                  <Typography variant="body2">
                    No tasks found for this story/bug in the selected sprint.
                  </Typography>
                </Alert>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Information Panel */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
          <InfoIcon sx={{ mr: 1 }} />
          Activity Monitoring Rules
        </Typography>
        <Typography variant="body2" paragraph>
          This panel monitors story/bug activities by checking task compliance with parent commenting requirements from the assigned team member:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Task Activation Comments" 
              secondary="When a task moves to 'In Progress' or 'Active', the assigned team member should add a comment on the parent story/bug within ±1 day"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <CheckCircleIcon color="success" />
            </ListItemIcon>
            <ListItemText 
              primary="Task Completion Comments" 
              secondary="When a task is completed/done, the assigned team member should add a comment on the parent story/bug within ±1 day"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <ErrorIcon color="error" />
            </ListItemIcon>
            <ListItemText 
              primary="Violations" 
              secondary="Tasks where the assigned member hasn't commented on the parent story/bug within the required timeframe are flagged as violations"
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
};

export default ActivityMonitoringPanel;
