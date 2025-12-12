# Capacity Utilization Fix

## Issue
The Capacity Utilization component was unable to get real-time data from Azure DevOps (ADO) and was using fallback data instead of dynamic data. The logs showed:

```
🔍 CAPACITY_FETCH: API Response - found 0 team members
🔍 CAPACITY_FETCH: No capacity data found. This might be because:
  1. Team name mismatch - capacity is set for a different team
  2. Capacity not configured for this sprint
  3. Different team has the capacity data
  Current team name used: Westlaw US - Kavya
```

## Root Cause
The issue had two main causes:

1. **Missing Team Name**: In the ADO configuration, the `teamName` field was empty. The system was using "Westlaw US - Kavya" as the team name, but this needed to be explicitly set in the configuration.

2. **Fallback Data Handling**: When the Azure DevOps API returned no capacity data (0 team members), the system was falling back to empty data instead of using the manually configured team capacity data from localStorage.

## Solution
The solution involved two main fixes:

1. **Update ADO Configuration**: Set the correct team name in the ADO configuration.
2. **Improve Fallback Mechanism**: Add a method to retrieve and use manually configured team capacity data when the API fails.

## Implementation Details

### 1. Added new method to retrieve manual capacity data
Added a new method `getManualTeamCapacityData` to the adoService.ts file that:

- Retrieves the manually configured team capacity data from localStorage
- Formats it in the same structure as the data from the API
- Is called when the API returns no team members or when there's an error

### 2. Modified the `getSprintCapacity` method to use manual data
Updated the method to use the manually configured data when the API returns no team members or when there's an error fetching data from the API.

### 3. Created configuration tools
Created two tools to help set up the correct configuration:

- `setup-ado-config-fixed.js`: A script that can be run in the browser console to set up the ADO configuration with the correct team name and fallback capacity data.
- `setup-ado-config-fixed.html`: A web interface that allows users to easily apply the fix without having to use the browser console.

## How to Apply the Fix

### Option 1: Using the Web Interface (Recommended)

1. Open the `setup-ado-config-fixed.html` file in your web browser
2. Click the "Set Up ADO Configuration" button
3. The page will show a success message when the configuration is applied
4. Refresh your AI Scrum Agent application to see the changes

### Option 2: Using the Browser Console

1. Open the AI Scrum Agent application in your web browser (http://localhost:3000)
2. Open the browser's developer console (F12 or right-click > Inspect > Console)
3. Copy the contents of the `setup-ado-config-fixed.js` file
4. Paste the code into the console and press Enter
5. Refresh the application to see the changes

## Verifying the Fix

After setting up the ADO configuration:

1. Go to the dashboard to see if the capacity data is now showing
2. If the capacity data is still not showing, go to Settings > Debug > ADO Capacity Diagnostics to run diagnostic tests
3. The diagnostic tool will help identify any remaining issues with your ADO configuration

## Common Issues and Solutions

### 1. Team Name Issues
The team name must be exactly as it appears in Azure DevOps. This is case-sensitive and must include any spaces or special characters.

To find your exact team name in Azure DevOps:
1. Go to your Azure DevOps project
2. Click on "Project settings" at the bottom left
3. Click on "Teams" in the left sidebar
4. Find your team in the list and note the exact name

### 2. PAT Token Permissions
The Personal Access Token (PAT) needs the following permissions:
- Work Items (Read)
- Project and Team (Read)

To create a new PAT with the correct permissions:
1. Go to your Azure DevOps organization
2. Click on your profile picture in the top right
3. Click on "Personal access tokens"
4. Click on "New Token"
5. Give it a name and select the proper permissions
6. Click "Create" and save the token

### 3. Server Proxy Issues
If the server proxy is not running correctly, you might see errors in the browser console related to CORS or network requests.

To fix server proxy issues:
1. Make sure the server is running by executing `npm run dev` in the terminal
2. Check that the REACT_APP_ADO_PAT environment variable is set correctly in the `.env.development` file
3. Restart the server if necessary

## Additional Resources
- [Azure DevOps REST API Documentation](https://docs.microsoft.com/en-us/rest/api/azure/devops/?view=azure-devops-rest-7.0)
- [Creating Personal Access Tokens in Azure DevOps](https://docs.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate?view=azure-devops&tabs=preview-page)
- [Azure DevOps Capacity Planning](https://docs.microsoft.com/en-us/azure/devops/boards/sprints/set-capacity?view=azure-devops)
