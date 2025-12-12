/**
 * Setup ADO Configuration Script (FIXED)
 * 
 * This script sets up the ADO configuration in localStorage using the values from .env.development.
 * Run this script in the browser console to quickly configure ADO without going through the setup wizard.
 * 
 * IMPORTANT: This version includes the correct team name for capacity data access.
 */

// ADO configuration based on .env.development values
const adoConfig = {
  organization: "TR-Legal-Cobalt", // From REACT_APP_ADO_ORG
  project: "Legal Cobalt Backlog", // From REACT_APP_ADO_PROJECT
  personalAccessToken: "3UGSuHftE2DVi40n4oaa4og1HVAUYpcaQcdd5LDII9VAXV0AhSkdJQQJ99BGACAAAAADXeeUAAASAZDO4YqM", // From REACT_APP_ADO_PAT
  apiVersion: "7.0", // From REACT_APP_ADO_API_VERSION
  teamName: "Westlaw US - Kavya", // FIXED: Set to the exact team name as it appears in Azure DevOps
  refreshInterval: 15,
  enableAutoRefresh: true
};

// Save the configuration to localStorage
localStorage.setItem('adoConfig', JSON.stringify(adoConfig));

// Set up team capacity configuration as fallback
const teamCapacityConfig = {
  // Add team members with their daily capacity
  // Format: "Member Name": dailyCapacityInHours
  "Team Member 1": 6,
  "Team Member 2": 8,
  "Team Member 3": 6,
  // Add more team members as needed
  "Kavya": 8,
  "John Doe": 6,
  "Jane Smith": 7
};

// Save the team capacity configuration to localStorage
localStorage.setItem('teamCapacityConfig', JSON.stringify(teamCapacityConfig));

console.log("✅ ADO configuration has been set up successfully!");
console.log("✅ Team name has been set to: " + adoConfig.teamName);
console.log("✅ Team capacity fallback configuration has been set up with " + Object.keys(teamCapacityConfig).length + " team members");
console.log("📋 Instructions:");
console.log("1. Refresh the page to load the new configuration");
console.log("2. Go to the dashboard to see the capacity data");
console.log("3. If capacity data is still not loading from ADO, it will use the fallback configuration");
