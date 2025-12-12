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
