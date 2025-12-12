const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: '.env.development' });

async function testCapacityAPI() {
  try {
    const organization = 'TR-Legal-Cobalt';
    const project = 'Legal Cobalt Backlog';
    const teamName = 'Westlaw US - Kavya';
    const sprintId = 'your-sprint-id'; // Replace with actual sprint ID
    
    const pat = process.env.REACT_APP_ADO_PAT;
    
    if (!pat) {
      console.error('❌ ADO PAT not found in environment variables');
      return;
    }
    
    // First get the sprints to find a valid sprint ID
    const encodedProject = encodeURIComponent(project);
    const encodedTeamName = encodeURIComponent(teamName);
    
    const sprintsUrl = `https://dev.azure.com/${organization}/${encodedProject}/${encodedTeamName}/_apis/work/teamsettings/iterations?api-version=7.0`;
    
    console.log('🔍 TESTING: Fetching sprints from:', sprintsUrl);
    
    const sprintsResponse = await axios.get(sprintsUrl, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('🔍 SPRINTS: Found', sprintsResponse.data.value?.length || 0, 'sprints');
    
    if (sprintsResponse.data.value && sprintsResponse.data.value.length > 0) {
      const currentSprint = sprintsResponse.data.value.find(s => s.attributes.timeFrame === 'current') 
                           || sprintsResponse.data.value[0]; // fallback to first sprint
      
      console.log('🔍 TESTING: Using sprint:', currentSprint.name, 'ID:', currentSprint.id);
      
      // Now test the capacity API
      const capacityUrl = `https://dev.azure.com/${organization}/${encodedProject}/${encodedTeamName}/_apis/work/teamsettings/iterations/${currentSprint.id}/capacities?api-version=7.0`;
      
      console.log('🔍 TESTING: Fetching capacity from:', capacityUrl);
      
      const capacityResponse = await axios.get(capacityUrl, {
        headers: {
          'Authorization': `Basic ${Buffer.from(`:${pat}`).toString('base64')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('🔍 CAPACITY: Response status:', capacityResponse.status);
      console.log('🔍 CAPACITY: Response structure:');
      console.log('  - Has value array:', !!capacityResponse.data?.value);
      console.log('  - Value array length:', capacityResponse.data?.value?.length || 0);
      console.log('  - Response keys:', Object.keys(capacityResponse.data || {}));
      console.log('🔍 CAPACITY: Full response:');
      console.log(JSON.stringify(capacityResponse.data, null, 2));
      
      if (capacityResponse.data?.value && capacityResponse.data.value.length > 0) {
        console.log('🔍 CAPACITY: Sample team member:');
        console.log(JSON.stringify(capacityResponse.data.value[0], null, 2));
      } else {
        console.log('❌ CAPACITY: No team members found in response');
        console.log('This could mean:');
        console.log('  1. Capacity is configured for a different team name');
        console.log('  2. Capacity is not configured for this sprint');
        console.log('  3. Different sprint ID is active in the UI');
        console.log('  4. API permissions issue');
      }
    } else {
      console.log('❌ SPRINTS: No sprints found');
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testCapacityAPI();
