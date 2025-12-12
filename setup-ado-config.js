/**
 * Setup ADO Configuration Script
 * 
 * This script sets up the ADO configuration in localStorage using the values from .env.development.
 * Run this script in the browser console to quickly configure ADO without going through the setup wizard.
 */

// ADO configuration based on .env.development values
const adoConfig = {
  organization: "TR-Legal-Cobalt", // From REACT_APP_ADO_ORG
  project: "Legal Cobalt Backlog", // From REACT_APP_ADO_PROJECT
  personalAccessToken: "3UGSuHftE2DVi40n4oaa4og1HVAUYpcaQcdd5LDII9VAXV0AhSkdJQQJ99BGACAAAAADXeeUAAASAZDO4YqM", // From REACT_APP_ADO_PAT
  apiVersion: "7.0", // From REACT_APP_ADO_API_VERSION
  teamName: "", // This is likely the missing piece - needs to be set to the exact team name
  refreshInterval: 15,
  enableAutoRefresh: true
};

// Save the configuration to localStorage
localStorage.setItem('adoConfig', JSON.stringify(adoConfig));

// Optional: Set up some team capacity configuration as fallback
const teamCapacityConfig = {
  // Add team members with their daily capacity
  // Format: "Member Name": dailyCapacityInHours
  "Team Member 1": 6,
  "Team Member 2": 8,
  "Team Member 3": 6
};

// Save the team capacity configuration to localStorage
localStorage.setItem('teamCapacityConfig', JSON.stringify(teamCapacityConfig));

console.log("✅ ADO configuration has been set up successfully!");
console.log("⚠️ IMPORTANT: You need to set the correct team name in the ADO configuration.");
console.log("📋 Instructions:");
console.log("1. Go to Settings > Azure DevOps Configuration");
console.log("2. Enter your exact team name (as it appears in Azure DevOps)");
console.log("3. Save the configuration");
console.log("4. Return to the dashboard to see the capacity data");
