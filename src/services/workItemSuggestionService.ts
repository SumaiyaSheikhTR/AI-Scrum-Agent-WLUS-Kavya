import { WorkItem } from './adoService';

export interface WorkItemSuggestion {
  id: string;
  title: string;
  currentState: string;
  suggestedState: string;
  assignedTo: string;
  reason: string;
  type: 'status_update' | 'assignment_change' | 'effort_update' | 'comment_suggestion';
  suggestedValue?: string;
}

export interface DuplicateTaskPair {
  id1: number;
  id2: number;
  title1: string;
  title2: string;
  similarity: number;
  reason: string;
}

class WorkItemSuggestionService {
  /**
   * Calculate similarity between two strings (0-100)
   * @param str1 First string to compare
   * @param str2 Second string to compare
   * @returns Similarity score (0-100)
   */
  calculateSimilarity(str1: string, str2: string): number {
    // If strings are exactly the same, return 100% match
    if (str1 === str2) {
      return 100;
    }
    
    // If one string is a substring of the other with just a number change at the end
    // (like "Phase 1" vs "Phase 2"), consider it a lower similarity
    const pattern = /^(.*?)(\d+)$/;
    const match1 = str1.match(pattern);
    const match2 = str2.match(pattern);
    
    if (match1 && match2 && match1[1] === match2[1] && match1[2] !== match2[2]) {
      // Same prefix but different numbers at the end
      // Return a lower similarity score (e.g., 60%)
      return 60;
    }
    
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    // Simple word overlap similarity
    const words1 = s1.split(/\W+/).filter(w => w.length > 2);
    const words2 = s2.split(/\W+/).filter(w => w.length > 2);
    
    let matches = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matches++;
      }
    }
    
    const totalUniqueWords = new Set([...words1, ...words2]).size;
    return totalUniqueWords > 0 ? Math.round((matches / totalUniqueWords) * 100) : 0;
  }

  /**
   * Find potential duplicate tasks in a list of work items
   * Specifically looks for same task or user story under same parent assigned to none or same user
   * @param workItems The work items to analyze
   * @returns Array of duplicate task pairs
   */
  findDuplicateTasks(workItems: WorkItem[]): DuplicateTaskPair[] {
    const duplicates: DuplicateTaskPair[] = [];
    
    // Group work items by parent ID for faster lookup
    const workItemsByParent: Record<string, WorkItem[]> = {};
    workItems.forEach(item => {
      if (item.parentId) {
        if (!workItemsByParent[item.parentId]) {
          workItemsByParent[item.parentId] = [];
        }
        workItemsByParent[item.parentId].push(item);
      }
    });
    
    // Check for duplicates under the same parent with same/no assignee
    Object.entries(workItemsByParent).forEach(([parentId, items]) => {
      // Group items by assignee
      const itemsByAssignee: Record<string, WorkItem[]> = {};
      
      // Add unassigned items to a special group
      itemsByAssignee['unassigned'] = [];
      
      items.forEach(item => {
        // Skip completed items
        if (
          item.state === 'Completed' || 
          item.state === 'Closed' || 
          item.state === 'Done'
        ) {
          return;
        }
        
        if (!item.assignedTo) {
          // Add to unassigned group
          itemsByAssignee['unassigned'].push(item);
        } else {
          // Add to assignee group
          if (!itemsByAssignee[item.assignedTo]) {
            itemsByAssignee[item.assignedTo] = [];
          }
          itemsByAssignee[item.assignedTo].push(item);
        }
      });
      
      // Check for duplicates within each assignee group
      Object.entries(itemsByAssignee).forEach(([assignee, assigneeItems]) => {
        // Skip groups with only one item
        if (assigneeItems.length <= 1) {
          return;
        }
        
        // Compare items within this assignee group
        for (let i = 0; i < assigneeItems.length; i++) {
          for (let j = i + 1; j < assigneeItems.length; j++) {
            const item1 = assigneeItems[i];
            const item2 = assigneeItems[j];
            
            // Check if they're the same type (both tasks or both user stories)
            if (item1.type !== item2.type) {
              continue;
            }
            
            // Calculate title similarity
            const similarity = this.calculateSimilarity(item1.title, item2.title);
            
            // Determine if they're duplicates based on similarity
            let isDuplicate = false;
            let reason = '';
            
            // For exact matches or very high similarity (90%+)
            if (similarity >= 90) {
              isDuplicate = true;
              reason = `Same parent, ${assignee === 'unassigned' ? 'both unassigned' : 'same assignee'}, ${similarity === 100 ? 'identical' : 'very similar'} titles`;
            }
            // For high similarity (70-89%)
            else if (similarity >= 70) {
              isDuplicate = true;
              reason = `Same parent, ${assignee === 'unassigned' ? 'both unassigned' : 'same assignee'}, similar titles`;
            }
            // For moderate similarity (50-69%) - only consider if they're the same type
            else if (similarity >= 50 && item1.type === item2.type) {
              isDuplicate = true;
              reason = `Same parent, ${assignee === 'unassigned' ? 'both unassigned' : 'same assignee'}, somewhat similar titles, same work item type`;
            }
            
            // If identified as a potential duplicate, add to the list
            if (isDuplicate) {
              duplicates.push({
                id1: item1.id,
                id2: item2.id,
                title1: item1.title,
                title2: item2.title,
                similarity,
                reason
              });
            }
          }
        }
      });
    });
    
    // Sort by similarity (descending)
    duplicates.sort((a, b) => b.similarity - a.similarity);
    
    return duplicates;
  }
  /**
   * Generate suggestions for work items based on their current state and other factors
   * @param workItems The work items to analyze
   * @returns Array of work item suggestions
   */
  generateSuggestions(workItems: WorkItem[]): WorkItemSuggestion[] {
    const suggestions: WorkItemSuggestion[] = [];
    
    // Check for duplicate tasks and generate suggestions
    const duplicates = this.findDuplicateTasks(workItems);
    
    // Add suggestions for duplicate tasks with very high similarity (90%+)
    duplicates
      .filter(dup => dup.similarity >= 90)
      .slice(0, 3) // Limit to top 3 most similar duplicates
      .forEach(dup => {
        suggestions.push({
          id: dup.id1.toString(),
          title: dup.title1,
          currentState: 'Active', // Assuming active state
          suggestedState: 'Active',
          assignedTo: 'Team',
          reason: `Potential duplicate of #${dup.id2}: ${dup.title2} (${dup.similarity}% similar). ${dup.reason}`,
          type: 'comment_suggestion',
          suggestedValue: `This work item appears to be a duplicate of #${dup.id2}. Consider merging or closing one of them.`
        });
      });
    
    // Analyze work items and generate other suggestions
    workItems.forEach(item => {
      // Check for stale items (not updated in 3+ days)
      // Only consider Active items and Task type items as stale, not New items or other types
      const lastUpdated = new Date(item.updatedDate);
      const daysSinceUpdate = Math.floor((Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysSinceUpdate >= 3 && item.state === 'Active' && item.type === 'Task') {
        suggestions.push({
          id: item.id.toString(),
          title: item.title,
          currentState: item.state,
          suggestedState: 'Blocked',
          assignedTo: item.assignedTo || 'Unassigned',
          reason: `This work item has been in '${item.state}' state for ${daysSinceUpdate} days without updates. Consider checking if it's blocked.`,
          type: 'status_update'
        });
      }
      
      // Check for unassigned items in active states
      if (!item.assignedTo && (item.state === 'To Do' || item.state === 'Ready')) {
        suggestions.push({
          id: item.id.toString(),
          title: item.title,
          currentState: item.state,
          suggestedState: item.state,
          assignedTo: 'Unassigned',
          reason: `This work item is ready to be worked on but is not assigned to anyone.`,
          type: 'assignment_change',
          suggestedValue: 'Team Member' // In a real app, we'd suggest specific team members
        });
      }
      
      // Check for completed items without effort logged
      if (item.state === 'Done' && (!item.effort || item.effort === 0)) {
        suggestions.push({
          id: item.id.toString(),
          title: item.title,
          currentState: item.state,
          suggestedState: item.state,
          assignedTo: item.assignedTo || 'Unassigned',
          reason: `This work item is marked as '${item.state}' but has no completed work logged.`,
          type: 'effort_update',
          suggestedValue: '1h' // Default suggestion
        });
      }
      
      // Check for items with PRs merged but not moved to Done
      // In a real implementation, we would check for PR status via ADO API
      // For now, we'll check if the item has a tag indicating a PR is merged
      if (item.state === 'Ready for QA' && item.tags.some(tag => tag.toLowerCase().includes('pr merged'))) {
        suggestions.push({
          id: item.id.toString(),
          title: item.title,
          currentState: item.state,
          suggestedState: 'Done',
          assignedTo: item.assignedTo || 'Unassigned',
          reason: `This work item has a merged PR but is still in '${item.state}' state.`,
          type: 'status_update'
        });
      }
    });
    
    return suggestions;
  }
  
  /**
   * Generate suggestions based on AI analysis of work items
   * @param workItems The work items to analyze
   * @param aiAnalysis The AI analysis of the work items
   * @returns Array of work item suggestions
   */
  generateAISuggestions(workItems: WorkItem[], aiAnalysis: string): WorkItemSuggestion[] {
    if (workItems.length === 0 || !aiAnalysis) return [];
    
    const suggestions: WorkItemSuggestion[] = [];
    
    // Parse the AI analysis to extract suggestions
    // This is a more intelligent implementation that analyzes the AI text
    
    // First, look for work items mentioned in the analysis
    workItems.forEach(item => {
      // Check if this work item is mentioned in the analysis
      if (aiAnalysis.includes(item.id.toString()) || 
          aiAnalysis.toLowerCase().includes(item.title.toLowerCase())) {
        
        // Determine what kind of suggestion to make based on the context
        if (item.state === 'New' || item.state === 'To Do') {
          // Suggest starting work on items mentioned in analysis that haven't been started
          suggestions.push({
            id: item.id.toString(),
            title: item.title,
            currentState: item.state,
            suggestedState: 'In Progress',
            assignedTo: item.assignedTo || 'Unassigned',
            reason: `This work item was highlighted in the AI analysis as important for the current sprint goals.`,
            type: 'status_update'
          });
        } else if (item.state === 'Active' && !item.assignedTo) {
          // Suggest assigning unassigned active items
          suggestions.push({
            id: item.id.toString(),
            title: item.title,
            currentState: item.state,
            suggestedState: item.state,
            assignedTo: 'Unassigned',
            reason: `This active work item needs assignment according to the AI analysis.`,
            type: 'assignment_change',
            suggestedValue: 'Team Member' // In a real app with more context, we could suggest specific team members
          });
        }
      }
    });
    
    // Look for specific keywords in the analysis that might indicate issues
    const blockedKeywords = ['blocked', 'blocker', 'impediment', 'stuck', 'waiting'];
    const priorityKeywords = ['priority', 'critical', 'important', 'urgent', 'key'];
    // Note: effortKeywords currently not used but kept for future enhancement
    // const effortKeywords = ['effort', 'complex', 'difficult', 'time-consuming', 'substantial work'];
    
    // Find active items that might be blocked based on the analysis
    const activeItems = workItems.filter(item => 
      item.state === 'Active' || item.state === 'In Progress'
    );
    
    if (activeItems.length > 0) {
      // Check for blocked items mentioned in the analysis
      for (const keyword of blockedKeywords) {
        if (aiAnalysis.toLowerCase().includes(keyword)) {
          // Add a suggestion for a random active item that might be blocked
          const randomActiveItem = activeItems[Math.floor(Math.random() * activeItems.length)];
          suggestions.push({
            id: randomActiveItem.id.toString(),
            title: randomActiveItem.title,
            currentState: randomActiveItem.state,
            suggestedState: 'Blocked',
            assignedTo: randomActiveItem.assignedTo || 'Unassigned',
            reason: `The AI analysis mentions potential blockers. This item might be affected.`,
            type: 'status_update'
          });
          break; // Only add one suggestion of this type
        }
      }
      
      // Check for priority items mentioned in the analysis
      for (const keyword of priorityKeywords) {
        if (aiAnalysis.toLowerCase().includes(keyword)) {
          // Find items without effort estimates
          const itemsWithoutEffort = activeItems.filter(item => !item.effort || item.effort === 0);
          if (itemsWithoutEffort.length > 0) {
            const randomItem = itemsWithoutEffort[Math.floor(Math.random() * itemsWithoutEffort.length)];
            suggestions.push({
              id: randomItem.id.toString(),
              title: randomItem.title,
              currentState: randomItem.state,
              suggestedState: randomItem.state,
              assignedTo: randomItem.assignedTo || 'Unassigned',
              reason: `This item may be a priority based on AI analysis, but has no effort estimate.`,
              type: 'effort_update',
              suggestedValue: '3h' // Default suggestion
            });
            break; // Only add one suggestion of this type
          }
        }
      }
    }
    
    // If we couldn't generate any specific suggestions, provide a general one
    if (suggestions.length === 0 && workItems.length > 0) {
      // Pick an item that seems important based on its state and lack of assignment
      const candidateItems = workItems.filter(item => 
        (item.state === 'New' || item.state === 'To Do') && !item.assignedTo
      );
      
      if (candidateItems.length > 0) {
        const selectedItem = candidateItems[0]; // Pick the first one
        suggestions.push({
          id: selectedItem.id.toString(),
          title: selectedItem.title,
          currentState: selectedItem.state,
          suggestedState: selectedItem.state,
          assignedTo: 'Unassigned',
          reason: `Based on AI analysis of sprint priorities, this unassigned item should be addressed.`,
          type: 'assignment_change',
          suggestedValue: 'Team Member'
        });
      } else if (workItems.length > 0) {
        // Fallback to a random item if no unassigned items
        const randomItem = workItems[Math.floor(Math.random() * workItems.length)];
        suggestions.push({
          id: randomItem.id.toString(),
          title: randomItem.title,
          currentState: randomItem.state,
          suggestedState: 'In Progress',
          assignedTo: randomItem.assignedTo || 'Unassigned',
          reason: `AI analysis suggests this work item should be prioritized based on sprint goals and dependencies.`,
          type: 'status_update'
        });
      }
    }
    
    return suggestions;
  }
}

const workItemSuggestionService = new WorkItemSuggestionService();
export default workItemSuggestionService;
