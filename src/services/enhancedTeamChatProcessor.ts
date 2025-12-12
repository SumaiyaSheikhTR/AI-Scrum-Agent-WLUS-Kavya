import { businessDaysHelper } from '../utils/business-days-helper';

/**
 * Creates an ADO work item URL for a given work item ID
 * @param adoBaseUrl The base URL for the ADO instance
 * @param workItemId The work item ID
 * @returns The complete URL to the work item
 */
export function createAdoWorkItemUrl(adoBaseUrl: string, workItemId: string | number): string {
  // Ensure the ADO base URL doesn't end with a slash
  const baseUrl = adoBaseUrl.endsWith('/') ? adoBaseUrl.slice(0, -1) : adoBaseUrl;
  return `${baseUrl}/_workitems/edit/${workItemId}`;
}

/**
 * Enhanced version of the Team Chat processor in Thomson Reuters OpenAI Service
 * This adds better sprint information and business day calculations
 */
export async function processTeamChat(
  message: string,
  teamMembers: any[],
  teamCapacity: any[] | null,
  workItems: any[],
  sprint: any | null,
  adoBaseUrl: string,
  thomsonReutersOpenAIService: any
): Promise<{ text: string; adoLinks: string[]; autoAssignTags?: string[]; autoRemoveTags?: string[] }> {
  try {
    console.log('Processing team chat with enhanced sprint data...');
    
    // Check if thomsonReutersOpenAIService is ready
    try {
      const isConnected = await thomsonReutersOpenAIService.testConnection();
      if (!isConnected) {
        throw new Error('Failed to connect to OpenAI service');
      }
    } catch (error) {
      console.error('❌ Failed to initialize OpenAI service:', error);
      return {
        text: 'I apologize, but I cannot process your request at the moment. The AI service is not available. Please check your API configuration and try again.',
        adoLinks: []
      };
    }
    
    const capacityData = teamCapacity?.map(cap => ({
      memberName: cap.teamMember.displayName,
      totalCapacity: cap.totalCapacityForSprint || 0,
      remainingCapacity: cap.remainingCapacityForSprint || 0,
      daysOff: cap.plannedDaysOff || 0,
      activities: cap.activities || []
    })) || [];
    
    // Organize work items by state and assignee
    let assignedItems: Record<string, any[]> = {};
    let unassignedItems: any[] = [];
    let completedItems: any[] = [];
    
    workItems.forEach(item => {
      const itemData = {
        id: item.id,
        title: item.title,
        state: item.state,
        effort: item.effort || 0,
        workItemType: item.workItemType,
        priority: item.priority,
        tags: item.tags
      };
      
      if (item.state === 'Closed' || item.state === 'Completed' || item.state === 'Done') {
        completedItems.push(itemData);
      } else if (!item.assignedTo) {
        unassignedItems.push(itemData);
      } else {
        const assignedToObj = item.assignedTo as any;
        const assigneeName = assignedToObj.displayName || assignedToObj;
        
        if (!assignedItems[assigneeName]) {
          assignedItems[assigneeName] = [];
        }
        assignedItems[assigneeName].push(itemData);
      }
    });
    
    // Calculate sprint days remaining and total days with more precise data
    let sprintDetails = null;
    if (sprint) {
      const startDate = new Date(sprint.startDate);
      const endDate = new Date(sprint.endDate);
      const currentDate = new Date();
      
      // Calculate business days
      const totalBusinessDays = businessDaysHelper.getBusinessDayCount(startDate, endDate);
      let remainingBusinessDays = businessDaysHelper.getBusinessDayCount(currentDate, endDate);
      remainingBusinessDays = Math.max(0, remainingBusinessDays);
      
      const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      let daysRemaining = Math.ceil((endDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));
      daysRemaining = Math.max(0, daysRemaining);
      
      const daysElapsed = totalDays - daysRemaining;
      const percentComplete = Math.min(100, Math.round((daysElapsed / totalDays) * 100));
      
      // Calculate burndown metrics - only count Task work items to avoid double counting
      const totalEffort = workItems
        .filter(item => item.workItemType === 'Task')
        .reduce((sum, item) => sum + (item.effort || 0), 0);
      const completedEffort = completedItems
        .filter(item => item.workItemType === 'Task')
        .reduce((sum, item) => sum + (item.effort || 0), 0);
      const remainingEffort = totalEffort - completedEffort;
      const idealBurndown = totalBusinessDays > 0 ? 
        (remainingBusinessDays / totalBusinessDays) * totalEffort : 0;
      
      sprintDetails = {
        name: sprint.name,
        startDate: startDate.toISOString().split('T')[0],  // Format as YYYY-MM-DD
        endDate: endDate.toISOString().split('T')[0],      // Format as YYYY-MM-DD
        daysRemaining,
        totalDays,
        businessDaysRemaining: remainingBusinessDays,
        totalBusinessDays,
        percentComplete,
        totalEffort,
        completedEffort,
        remainingEffort,
        idealRemainingEffort: idealBurndown,
        isAheadOfSchedule: remainingEffort < idealBurndown,
        isBehindSchedule: remainingEffort > idealBurndown
      };
    }
    
    // Get total team capacity
    const totalTeamCapacity = capacityData.reduce((sum, cap) => sum + cap.totalCapacity, 0);
    const totalRemainingCapacity = capacityData.reduce((sum, cap) => sum + cap.remainingCapacity, 0);
    
    // Gather detailed work item information for the AI to reference
    const detailedWorkItems = workItems.map(item => {
      const assignedToObj = item.assignedTo as any;
      return {
        id: item.id,
        title: item.title,
        state: item.state,
        effort: item.effort || 0,
        assignedTo: assignedToObj ? (assignedToObj.displayName || 'Unknown') : 'Unassigned',
        type: item.workItemType,
        priority: item.priority,
        description: item.description ? item.description.substring(0, 200) : '',
        tags: item.tags || []
      };
    });
    
    // Construct the system prompt with enhanced sprint details
    const systemPrompt = `You are an AI Scrum Assistant helping with Azure DevOps team-level analysis. 
    
Focus on addressing the specific user's query about team capacity, sprint progress, or task assignments.
Provide detailed and accurate information about the sprint status.
When mentioning work items, always include their ID in the format #ID.

IMPORTANT FORMATTING GUIDELINES:
- Use **bold formatting** for team member names, important metrics, and critical information
- Use \`code formatting\` for work item IDs and numerical values
- Organize your response with clear sections and bullet points
- Highlight urgent or critical information with 🚨 emoji

For adhoc task assignment questions (like "whom to assign tasks to", "who should handle this", "who has availability"), provide SPECIFIC team member recommendations based on:
- Current workload and capacity
- Skills and expertise (inferred from current assignments)
- Activity type (Development or Testing) based on their current work
- Availability (remaining capacity)
- Work distribution balance

When calculating sprint days and timelines, always exclude weekends (Saturday and Sunday) and any team days off specified in the capacity data.

Always suggest specific team members by name with clear reasoning when asked about task assignments.

Current Sprint Information:
${sprintDetails ? 
`Sprint Name: ${sprintDetails.name}
Start Date: ${sprintDetails.startDate}
End Date: ${sprintDetails.endDate}
Days Remaining: ${sprintDetails.daysRemaining} out of ${sprintDetails.totalDays} calendar days
Business Days Remaining: ${sprintDetails.businessDaysRemaining} out of ${sprintDetails.totalBusinessDays} business days (excluding weekends and holidays)
Sprint Progress: ${sprintDetails.percentComplete}% complete

Sprint Burndown:
- Total Task Effort: ${sprintDetails.totalEffort} hours (Tasks only, not including Story Points)
- Completed Task Effort: ${sprintDetails.completedEffort} hours (${Math.round((sprintDetails.completedEffort/sprintDetails.totalEffort || 1)*100)}%)
- Remaining Task Effort: ${sprintDetails.remainingEffort} hours
- Ideal Remaining Effort at this point: ${Math.round(sprintDetails.idealRemainingEffort)} hours
- Sprint is ${sprintDetails.isAheadOfSchedule ? 'AHEAD of schedule' : sprintDetails.isBehindSchedule ? 'BEHIND schedule' : 'ON schedule'}`
: 'No active sprint information available.'}

Team Capacity:
- Total Team Capacity: ${totalTeamCapacity} hours
- Remaining Team Capacity: ${totalRemainingCapacity} hours
${capacityData.length > 0 ? 
capacityData.map(cap => {
  // Extract activity types from the member's activities
  const activityTypes = cap.activities?.map((act: any) => act.activityType || "Unknown").join(", ") || "Unknown";
  const primaryRole = activityTypes.toLowerCase().includes("development") ? "Development" : 
                   activityTypes.toLowerCase().includes("testing") ? "Testing" : 
                   "General";
                   
  return `- ${cap.memberName}: ${cap.totalCapacity} hours total capacity, ${cap.remainingCapacity} hours remaining, ${cap.daysOff} days off, Primary Role: ${primaryRole}`;
}).join('\n') 
: 'No capacity data available.'}

Work Item Summary:
- Total Work Items: ${workItems.length}
- Completed Items: ${completedItems.length}
- Unassigned Items: ${unassignedItems.length}
- Remaining Items: ${workItems.length - completedItems.length}

Team Member Work Distribution:
${Object.keys(assignedItems).map(memberName => {
const items = assignedItems[memberName];
// Only count Task items, not User Stories or Features to avoid double counting
const taskItems = items.filter(item => item.workItemType === 'Task');
const totalEffort = taskItems.reduce((sum, item) => sum + item.effort, 0);
const activeItems = items.filter(item => item.state === 'Active' || item.state === 'In Progress');
const memberCapacity = capacityData.find(cap => cap.memberName === memberName);

// Determine task types to infer member's role/skills
const bugCount = items.filter(item => item.workItemType === 'Bug').length;
const featureCount = items.filter(item => item.workItemType === 'Feature').length;
const taskCount = items.filter(item => item.workItemType === 'Task').length;

// Check member's activity types
const activityTypes = memberCapacity?.activities?.map((act: any) => act.activityType || "Unknown").join(", ") || "Unknown";
const primaryRole = activityTypes.toLowerCase().includes("development") ? "Development" : 
                 activityTypes.toLowerCase().includes("testing") ? "Testing" : 
                 "General";

// Calculate utilization
const utilizationPercent = memberCapacity && memberCapacity.totalCapacity > 0 ? 
  Math.round((totalEffort / memberCapacity.totalCapacity) * 100) : 0;

// Identify high-priority items
const highPriorityItems = items.filter(item => item.priority <= 2).length;
  
return `- ${memberName}: ${items.length} items (${totalEffort} hours from ${taskItems.length} tasks), ${activeItems.length} active items, ${utilizationPercent}% utilization, ${memberCapacity?.remainingCapacity || 0} hours remaining capacity
  • Role: ${primaryRole}
  • Work breakdown: ${taskCount} tasks, ${bugCount} bugs, ${featureCount} features
  • High priority items: ${highPriorityItems}`;
}).join('\n')}

Unassigned Work Items Available:
${unassignedItems.slice(0, 10).map(item => 
  `- #${item.id}: ${item.title} (${item.effort} hrs, ${item.workItemType}, Priority: ${item.priority || 'Unknown'})`
).join('\n')}
${unassignedItems.length > 10 ? `...and ${unassignedItems.length - 10} more unassigned items` : ''}

ADHOC TASK ASSIGNMENT GUIDANCE:
When asked about "whom to assign tasks to" or "who should handle new work":
1. Recommend the specific team member(s) with the lowest utilization percentage
2. Consider the type of work (Bug, Feature, Task) and match with member's primary role (Development or Testing)
3. Mention available capacity in hours and activity types
4. Even if a team member has 0 remaining capacity, still consider them for high-priority tasks (Priority 1-2)
5. For reassignments, identify overallocated team members and suggest moving their lower priority tasks
6. Always provide ADO links to specific work items when suggesting reassignments
7. Suggest 2-3 specific team members with detailed reasoning
8. Always provide member names, not just general advice

The user asked: "${message}"

Provide a helpful, specific response focused on their question. Include specific work item IDs when discussing tasks, using the format #ID.

IMPORTANT RESPONSE GUIDELINES:
- Use **bold text** to highlight team member names, important metrics, and key recommendations
- Use \`code formatting\` for numerical values and work item IDs
- For adhoc task assignment questions: ALWAYS recommend specific team member names with reasoning
- Consider team member's primary role (Development or Testing) when making recommendations
- For capacity questions: Provide specific utilization percentages and remaining hours
- For task reassignments: Explain reasoning based on capacity data and include specific work item IDs
- Even when a member has 0 remaining capacity, still consider them for high-priority tasks
- For sprint progress: Reference specific metrics and percentages, excluding weekends in calculations
- Include specific team member names when discussing workload distribution
- Base all recommendations on the actual data provided above
- Use 🔵 to highlight Development tasks and 🟢 to highlight Testing tasks
- Use 🚨 to highlight urgent or high-priority information

Example adhoc assignment response format:
For new adhoc tasks, I recommend assigning to **[Specific Name]** who has \`X hours\` remaining capacity (\`Y%\` utilization) and experience with [task type]. Their primary role is **Development/Testing** (🔵/🟢). Alternatively, **[Another Name]** has \`Z hours\` available...

Example task reassignment response format:
I recommend reassigning task \`#1234\` (high priority 🚨) from **[Current Owner]** who is at \`95%\` utilization to **[New Owner]** who has \`15 hours\` remaining capacity. The work item can be found here: [ADO Link].

AUTOMATIC ASSIGNMENT FUNCTIONALITY:
When providing specific team member recommendations for task assignments, include special AUTO_ASSIGN tags at the end of your response to enable automatic assignment:
- Format: AUTO_ASSIGN: MemberName1, MemberName2
- Use the exact display names from the team capacity data above
- Only include team members you specifically recommend
- Example: "AUTO_ASSIGN: John Smith, Jane Doe"

For task reassignments or workload rebalancing, you can also use:
- Format: AUTO_REMOVE: CurrentAssignee
- Then follow with: AUTO_ASSIGN: NewAssignee
- This helps with automatic task redistribution

Important: Any recommendations should be data-driven and based on the current sprint status, team capacity, and work items.

Additional work item details:
${detailedWorkItems.slice(0, 15).map(item => 
  `- #${item.id}: ${item.title} (${item.state}, ${item.effort} hrs, Assigned: ${item.assignedTo})`
).join('\n')}
${detailedWorkItems.length > 15 ? `...and ${detailedWorkItems.length - 15} more items` : ''}`;

    // Construct previous conversation context if needed
    const conversationContext = ""; // Could be expanded if we implement conversation history

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `${conversationContext ? conversationContext + "\n\nCurrent question: " : ""}${message}` }
    ];
    
    console.log('📊 Team Chat System Prompt Length:', systemPrompt.length);
    console.log('📊 Sprint Details:', sprintDetails);
    
    // Error handling around the OpenAI call
    let response;
    try {
      response = await thomsonReutersOpenAIService.callOpenAI(messages, 1500, 0.7);
      console.log('✅ Successfully received OpenAI response:', response.substring(0, 200) + '...');
    } catch (error) {
      console.error('❌ Error calling OpenAI:', error);
      return {
        text: 'Sorry, I encountered an error while processing your request. The AI service is currently unavailable. Please try again later.',
        adoLinks: []
      };
    }
    
    // Parse the response to extract ADO work item IDs
    const taskIdRegex = /#(\d+)/g;
    const mentionedTaskIds: string[] = [];
    let match;
    while ((match = taskIdRegex.exec(response)) !== null) {
      mentionedTaskIds.push(match[1]);
    }
    
    // Create ADO links for each mentioned task
    const adoLinks = mentionedTaskIds.map(taskId => {
      // Use the helper function to create ADO work item URLs
      return createAdoWorkItemUrl(adoBaseUrl, taskId);
    });
    
    // Extract auto assignment/removal tags
    const autoAssignRegex = /AUTO_ASSIGN:\s*([^"\n]+)/i;
    const autoRemoveRegex = /AUTO_REMOVE:\s*([^"\n]+)/i;
    
    const autoAssignMatch = response.match(autoAssignRegex);
    const autoRemoveMatch = response.match(autoRemoveRegex);
    
    // Ensure tags are properly formatted with # if missing
    const formatTags = (tags: string[]) => {
      return tags.map((tag: string) => {
        // Remove any existing # to standardize format
        tag = tag.replace(/^#/, '');
        // Ensure the tag starts with #
        return tag.startsWith('#') ? tag : `#${tag}`;
      });
    };
    
    const autoAssignTags = autoAssignMatch 
      ? formatTags(autoAssignMatch[1].trim().split(/,\s*/).map((tag: string) => tag.trim()))
      : [];
      
    const autoRemoveTags = autoRemoveMatch 
      ? formatTags(autoRemoveMatch[1].trim().split(/,\s*/).map((tag: string) => tag.trim()))
      : [];
    
    // Remove the AUTO tags from the response text
    let cleanedText = response
      .replace(autoAssignRegex, '')
      .replace(autoRemoveRegex, '')
      .trim();
    
    return {
      text: cleanedText,
      adoLinks,
      autoAssignTags,
      autoRemoveTags
    };
  } catch (error) {
    console.error('Error processing enhanced team chat:', error);
    return {
      text: 'Sorry, I encountered an error processing your request. Please try again later.',
      adoLinks: []
    };
  }
}
