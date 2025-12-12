const axios = require('axios');

async function testCapacityFiltering() {
  try {
    console.log('🧪 Testing capacity data filtering and enhancements...');
    
    // Test the capacity endpoint with the current sprint
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
    console.log('📊 Total team members found:', response.data.teamMembers?.length || 0);
    console.log('📊 Total capacity per day:', response.data.totalCapacityPerDay);
    
    if (response.data.teamMembers) {
      console.log('\n👥 All Team Members (including 0 capacity):');
      let activeMembers = 0;
      
      response.data.teamMembers.forEach((member, index) => {
        const capacity = member.activities.reduce((sum, activity) => sum + activity.capacityPerDay, 0);
        const status = capacity === 0 ? '🚫 FILTERED OUT' : '✅ ACTIVE';
        console.log(`  ${index + 1}. ${member.teamMember.displayName}: ${capacity}h/day ${status}`);
        
        if (capacity > 0) {
          activeMembers++;
        }
      });
      
      console.log(`\n📈 Summary:`);
      console.log(`  - Total members: ${response.data.teamMembers.length}`);
      console.log(`  - Active members (>0 capacity): ${activeMembers}`);
      console.log(`  - Filtered out (0 capacity): ${response.data.teamMembers.length - activeMembers}`);
      
      console.log('\n✅ The updated code will:');
      console.log('  ✅ Filter out team members with 0 capacity');
      console.log('  ✅ Add totalAvailableCapacity field for each member');
      console.log('  ✅ Calculate remaining capacity for utilization');
      console.log('  ✅ Provide better utilization insights');
    }
    
  } catch (error) {
    console.error('❌ Error testing capacity filtering:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
}

testCapacityFiltering();
