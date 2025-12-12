# Activity Monitoring Debug Guide

Comprehensive troubleshooting guide for User Story comment detection issues in the AI Scrum Agent application.

## 🚀 Quick Start

### Access the Debug Panel
1. Start the application: `npm start` (usually runs on http://localhost:3003)
2. Navigate to **Debug Comments** (🐛 icon) in the sidebar
3. Select your sprint from the dropdown
4. Click **"Debug Comments"** to run analysis

## 📊 Understanding the Debug Output

### Main Metrics
- **Total Comments**: All comments found on User Stories (including automated)
- **Non-Automated Comments**: Human-generated comments only
- **Task Assignees**: People assigned to child tasks under each User Story
- **Comment Matching Results**: Shows which comments match which assignees

### Comment Matching Algorithm
The system uses sophisticated name matching including:
1. **Exact Match**: "John Smith" = "John Smith"
2. **Name Parts**: "Smith, John (TR Technology)" matches "John Smith"
3. **TR Technology Format**: Handles corporate naming conventions
4. **Substring Matching**: Flexible matching for similar names
5. **Email Prefix**: Matches email prefixes to display names

## 🔍 Common Issues & Solutions

### Issue 1: "No Comments Detected"
**Symptoms**: Debug panel shows 0 total comments on User Stories

**Causes & Solutions**:
- ✅ **Verify User Story has comments in Azure DevOps**
  - Check the actual User Story in ADO web interface
  - Ensure comments are not just on child tasks

- ✅ **Check API Configuration**
  - Go to Settings → Azure DevOps configuration  
  - Verify Organization, Project, and PAT token are correct
  - Test connection with "Test Connection" button

- ✅ **API Permissions**
  - Ensure PAT token has "Work Items (Read)" permissions
  - Check if token has expired

### Issue 2: "Comments Found But Not Matching Assignees"
**Symptoms**: Comments exist but show 0 matches for task assignees

**Root Causes**:
1. **Name Format Mismatch**:
   - Comment Author: "Smith, John (TR Technology)"
   - Task Assignee: "John Smith"
   - **Solution**: The system handles this, but check debug panel for exact names

2. **Different User Accounts**:
   - Comment Author: "john.smith@company.com" 
   - Task Assignee: "John Smith (External)"
   - **Solution**: May need custom matching logic

3. **Automated Comments Being Included**:
   - System comments marked as from real users
   - **Solution**: Check automated comment filtering logic

### Issue 3: "Comments Marked as Automated"
**Symptoms**: Legitimate comments filtered out as automated

**Detection Keywords** (automatically filtered):
- "Changed to Active from team automation rules"
- "automated", "system generated", "Auto-generated"
- "Moved from", "State changed from"

**Solution**: Review comment text in debug panel to ensure filtering is correct

## 🛠️ Advanced Debugging

### Console Logging
The activity monitoring system provides extensive logging. Open browser DevTools (F12) and look for:

```javascript
// Comment retrieval
📊 ACTIVITY_MONITORING: Found 5 comments on parent User Story Title

// Comment matching per task
🔍 Task "Implement feature": Found 2 comments from "John Smith" out of 5 total comments

// Violation detection  
🚨 VIOLATION: Task "Fix bug" assigned to "Jane Doe" has NO comments on parent story/bug!
✅ COMPLIANT: Task "Review code" has 1 comment(s) on parent story/bug

// Name matching details
🔍 Checking if comment by "smith, john (tr technology)" matches assigned user "john smith"
🔍 Comment author parts: [smith, john]  
🔍 Assigned user parts: [john, smith]
✅ Name part match found: "john"
```

### API Request Analysis

Monitor network requests in DevTools → Network tab:

1. **Comment Requests**: Look for calls to:
   ```
   /{project}/_apis/wit/workitems/{id}/comments?api-version=7.1-preview.3
   ```

2. **Expected Response Format**:
   ```json
   {
     "comments": [
       {
         "id": "123",
         "text": "Comment text here",
         "createdBy": {
           "displayName": "John Smith"
         },
         "createdDate": "2025-08-29T10:00:00.000Z"
       }
     ]
   }
   ```

3. **Common API Issues**:
   - **401 Unauthorized**: PAT token expired or insufficient permissions
   - **404 Not Found**: Work item doesn't exist or project name incorrect
   - **403 Forbidden**: Token lacks "Work Items (Read)" permission

### Database/State Analysis

Check application state in React DevTools:
1. Install React Developer Tools browser extension
2. Navigate to Components → ActivityMonitoringPanel
3. Inspect state variables:
   - `storyBugActivities`: Array of analyzed User Stories
   - `selectedSprintId`: Current sprint being analyzed
   - `isLoading`: Loading state indicator

## 🔧 Code-Level Debugging

### Key Files to Examine

1. **ActivityMonitoringPanel.tsx** (Lines 180-500):
   ```typescript
   // Main analysis function
   const analyzeTask = async (task: WorkItem, parentComments: WorkItemComment[])
   
   // Comment matching logic
   const checkForRecentCommentsFromUser = (comments: WorkItemComment[], assignedUser: string)
   ```

2. **adoService.ts** (Lines 730-800):
   ```typescript
   // Comment retrieval method
   async getWorkItemComments(workItemId: number, workItemTitle: string): Promise<WorkItemComment[]>
   ```

### Adding Custom Debug Logs

To add temporary debugging, insert console logs in key locations:

```typescript
// In ActivityMonitoringPanel.tsx
console.log('🔍 DEBUG Custom:', {
  taskId: task.id,
  taskTitle: task.title,
  assignedTo: task.assignedTo,
  parentCommentsCount: parentComments.length,
  commentsFromUser: userComments.length
});
```

## 📋 Systematic Troubleshooting Checklist

### Step 1: Verify Data Source
- [ ] User Story exists in Azure DevOps with actual comments
- [ ] Comments are not only on child tasks, but on the parent User Story itself
- [ ] Child tasks are properly linked to parent User Story
- [ ] Task assignees match expected names

### Step 2: Check Configuration  
- [ ] Azure DevOps settings configured correctly in Settings page
- [ ] PAT token has "Work Items (Read)" permissions
- [ ] Organization and Project names are exact matches
- [ ] Test connection successful in Settings

### Step 3: API Verification
- [ ] Network requests show successful responses (200 status)
- [ ] Comment API responses contain expected data structure
- [ ] No CORS or authentication errors in console

### Step 4: Algorithm Analysis
- [ ] Debug panel shows expected comment matching results
- [ ] Name matching algorithm handles your team's naming conventions
- [ ] Automated comment filtering not removing legitimate comments
- [ ] Task assignee names match comment author names

### Step 5: Custom Fixes
If standard matching fails, consider:
- [ ] Custom name normalization rules for your organization
- [ ] Additional automated comment keywords to filter
- [ ] Modified matching algorithms for specific name formats

## 🚨 Emergency Fixes

### Temporary Workaround: Disable Strict Matching
If you need immediate results, you can temporarily lower matching requirements:

1. Edit `ActivityMonitoringPanel.tsx` around line 445
2. Change violation detection logic to be more lenient:
   ```typescript
   // Temporary: Consider any non-zero comments as compliant
   if (userComments.length === 0 && nonAutomatedParentComments.length === 0) {
     isViolation = true;
     violationType = 'missing_user_story_comments';
   }
   ```

### Reset Application State
If the app gets into a bad state:
1. Clear browser localStorage: DevTools → Application → Local Storage → Clear All
2. Restart the development server: `Ctrl+C` then `npm start`
3. Reconfigure settings from scratch

## 📞 Getting Additional Help

### Information to Gather
When reporting issues, please include:
1. **Debug panel screenshots** showing the analysis results
2. **Browser console logs** (F12 → Console tab) 
3. **Network requests** (F12 → Network tab) for comment API calls
4. **Azure DevOps work item URLs** for the problematic User Stories
5. **Configuration details** (organization, project names - redact sensitive info)

### Self-Service Resources
- **README.md**: Complete application documentation
- **Source code comments**: Detailed inline documentation in key files
- **TypeScript types**: Interface definitions for data structures
- **Console logging**: Extensive runtime information available in DevTools
