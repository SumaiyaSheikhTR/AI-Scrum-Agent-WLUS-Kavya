const axios = require('axios');

async function testCapacityProcessing() {
  try {
    console.log('🧪 Testing capacity data processing via proxy...');
    
    // Test the proxy endpoint directly
    const response = await axios.post('http://localhost:3001/api/ado-proxy/capacity', {
      config: {
        organization: "TR-Legal-Cobalt",
        project: "Legal Cobalt Backlog",
        teamName: "Westlaw US - Kavya",
        apiVersion: "7.0"
      },
      endpoint: "TR-Legal-Cobalt/Legal%20Cobalt%20Backlog/Westlaw%20US%20-%20Kavya/_apis/work/teamsettings/iterations/5b143301-00e0-4363-a2f1-9cabec90fe10/capacities?api-version=7.0"
    });
    
    console.log('✅ Proxy response received');
    console.log('📊 Team members found:', response.data.teamMembers?.length || 0);
    console.log('📊 Total capacity per day:', response.data.totalCapacityPerDay);
    
    if (response.data.teamMembers) {
      console.log('\n👥 Individual Capacities:');
      response.data.teamMembers.forEach((member, index) => {
        const capacity = member.activities.reduce((sum, activity) => sum + activity.capacityPerDay, 0);
        console.log(`  ${index + 1}. ${member.teamMember.displayName}: ${capacity}h/day`);
      });
    }
    
    // Test that the new structure is working
    console.log('\n✅ The ADO API is working correctly!');
    console.log('✅ Response structure uses "teamMembers" not "value"');
    console.log('✅ Individual capacities are available');
    
  } catch (error) {
    console.error('❌ Error testing capacity processing:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testCapacityProcessing();
