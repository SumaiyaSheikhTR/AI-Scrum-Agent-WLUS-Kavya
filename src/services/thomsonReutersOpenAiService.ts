import { WorkItem, TeamMember, TeamCapacity } from './adoService';

// Thomson Reuters Azure OpenAI Configuration
interface TROpenAICredentials {
  openai_key: string;
  azure_deployment: string;
  openai_api_version: string;
  token: string;
  openai_endpoint?: string;
}

interface TROpenAIConfig {
  workspace_id: string;
  model_name: string;
  asset_id: string;
  base_url: string;
  token_url: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIRequest {
  model: string;
  messages: OpenAIMessage[];
  max_tokens?: number;
  temperature?: number;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface CapacityRecommendation {
  member: string;
  utilizationLevel: 'optimal' | 'over' | 'under';
  currentCapacity: number;
  recommendation: string;
  suggestedActions: string[];
  tasksToRemove?: WorkItem[];
  tasksToAssign?: WorkItem[];
  priority: 'high' | 'medium' | 'low';
  adoLinks?: string[]; // Links to ADO work items
}

export class ThomsonReutersOpenAIService {
  private config: TROpenAIConfig;
  private credentials: TROpenAICredentials | null = null;
  private headers: Record<string, string> = {};

  constructor() {
    // Initialize with Thomson Reuters configuration
    // Use local backend API that replicates your Python notebook approach
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    this.config = {
      workspace_id: process.env.REACT_APP_AZURE_OPENAI_WORKSPACE_ID || "SumaiyaSheikEgRr",
      model_name: process.env.REACT_APP_AZURE_OPENAI_MODEL_NAME || "gpt-4o",
      asset_id: process.env.REACT_APP_AZURE_OPENAI_ASSET_ID || "208469",
      base_url: isLocalhost ? "http://localhost:3002/api/tr-openai" : "https://eais2-use.int.thomsonreuters.com",
      token_url: isLocalhost ? "http://localhost:3002/api/tr-openai/token" : "https://aiplatform.gcs.int.thomsonreuters.com/v1/openai/token"
    };
    
    if (isLocalhost) {
      console.log('🔧 Localhost detected - Using backend API service');
      console.log('📡 Backend Token URL:', this.config.token_url);
      console.log('📡 Backend Chat URL:', this.config.base_url + '/chat');
      console.log('⚠️  Make sure backend is running on port 3002');
    }
  }

  /**
   * Initialize OpenAI client with Thomson Reuters credentials
   */
  private async initializeClient(): Promise<boolean> {
    try {
      // Get stored configuration from localStorage
      const storedConfig = localStorage.getItem('trOpenAiConfig');
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        this.config = { ...this.config, ...config };
      }

      const payload = {
        workspace_id: this.config.workspace_id,
        model_name: this.config.model_name
      };

      console.log('🔄 Requesting Thomson Reuters OpenAI credentials...');
      console.log('🔗 Token URL:', this.config.token_url);
      console.log('📦 Payload:', payload);
      
      const response = await fetch(this.config.token_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('📡 Response status:', response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Failed to get credentials: ${response.status} ${response.statusText}`);
        console.error('❌ Error response:', errorText);
        throw new Error(`Failed to get credentials: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const responseData = await response.json();
      console.log('📝 Credential response received successfully');
      console.log('📝 Response structure:', Object.keys(responseData));
      
      // Extract credentials from backend response structure
      this.credentials = responseData.credentials || responseData;
      console.log('🔍 Extracted credentials structure:', Object.keys(this.credentials || {}));

      if (!this.credentials?.openai_key || !this.credentials?.azure_deployment) {
        console.error('❌ Invalid credential structure received:', this.credentials);
        throw new Error('Invalid credentials received - missing openai_key or azure_deployment');
      }

      const llm_profile_key = this.credentials.azure_deployment.split("/")[0];

      this.headers = {
        "Authorization": `Bearer ${this.credentials.token}`,
        "api-key": this.credentials.openai_key,
        "Content-Type": "application/json",
        "x-tr-chat-profile-name": "ai-platforms-chatprofile-prod",
        "x-tr-userid": this.config.workspace_id,
        "x-tr-llm-profile-key": llm_profile_key,
        "x-tr-user-sensitivity": "true",
        "x-tr-sessionid": this.credentials.azure_deployment,
        "x-tr-asset-id": this.config.asset_id,
        "x-tr-authorization": this.config.base_url
      };

      console.log('✅ Thomson Reuters OpenAI client initialized successfully');
      console.log('🔑 Credentials obtained for deployment:', this.credentials.azure_deployment);
      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Thomson Reuters OpenAI client:', error);
      
      // Provide specific error details
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('💡 Error details:', errorMessage);
      
      // Check for specific error types and provide solutions
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
        console.error('🚫 Network Error: Cannot reach Thomson Reuters backend');
        console.error('💡 Solutions:');
        console.error('   1. Ensure backend server is running on port 3002');
        console.error('   2. Check if VPN connection to Thomson Reuters network is active');
        console.error('   3. Verify backend service is properly configured');
      } else if (errorMessage.includes('401') || errorMessage.includes('403')) {
        console.error('🔐 Authentication Error: Invalid Thomson Reuters credentials');
        console.error('💡 Check your workspace ID and model configuration');
      } else if (errorMessage.includes('404')) {
        console.error('🔍 Not Found Error: Thomson Reuters endpoint not accessible');
        console.error('💡 Verify the Thomson Reuters API URLs are correct');
      } else if (errorMessage.includes('Invalid credentials')) {
        console.error('🔧 Configuration Error: Missing required credential fields');
        console.error('💡 Check if backend is returning proper credential structure');
      }
      
      return false; // Return false instead of throwing to allow graceful error handling
    }
  }

  /**
   * Make OpenAI API call using fetch
   */
  private async callOpenAI(messages: OpenAIMessage[], maxTokens: number = 500, temperature: number = 0.7): Promise<string> {
    if (!this.credentials) {
      throw new Error('OpenAI client not initialized');
    }

    try {
      console.log('🤖 Calling Thomson Reuters OpenAI API...');
      console.log('📝 System prompt:', messages[0]?.content?.substring(0, 150) + '...');
      console.log('❓ User message:', messages[1]?.content?.substring(0, 150) + '...');
      
      // Check if we're using the backend API (localhost)
      const isUsingBackend = this.config.base_url.includes('localhost:3002');
      
      if (isUsingBackend) {
        // Use backend API service (replicates your Python notebook approach)
        console.log('🤖 Making Thomson Reuters OpenAI API call via backend service...');
        
        const requestBody = {
          credentials: this.credentials,
          messages,
          model_name: this.config.model_name,
          asset_id: this.config.asset_id,
          max_tokens: maxTokens,
          temperature
        };

        const response = await fetch(`${this.config.base_url}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        }).catch(error => {
          console.error('❌ Network error calling OpenAI backend:', error);
          throw new Error(`Failed to connect to OpenAI backend: ${error.message}`);
        });

        if (!response.ok) {
          const errorText = await response.text().catch(e => 'Could not read error response');
          console.error('❌ Backend API call failed:', response.status, response.statusText, errorText);
          throw new Error(`Backend API call failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        
        if (!result.success || !result.response) {
          throw new Error('Backend API returned invalid response');
        }

        const content = result.response.choices[0]?.message?.content || "No response generated";
        console.log('🤖 ✅ LIVE Thomson Reuters AI recommendation received via backend:', content.substring(0, 100) + '...');
        return content;
        
      } else {
        // Direct API call for production
        const requestBody: OpenAIRequest = {
          model: this.config.model_name,
          messages,
          max_tokens: maxTokens,
          temperature
        };

        const chatUrl = `${this.config.base_url}/openai/deployments/${this.credentials.azure_deployment}/chat/completions?api-version=${this.credentials.openai_api_version}`;

        console.log('🤖 Making Thomson Reuters OpenAI API call to:', chatUrl);
        console.log('📤 Request payload:', { model: this.config.model_name, messageCount: messages.length, maxTokens, temperature });
        
        // Log the first 100 characters of the user message for debugging
        if (messages.length > 1) {
          console.log('📝 User message preview:', messages[1].content.substring(0, 100) + '...');
        }

        const response = await fetch(chatUrl, {
          method: 'POST',
          headers: this.headers,
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ OpenAI API call failed:', response.status, response.statusText, errorText);
          throw new Error(`OpenAI API call failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result: OpenAIResponse = await response.json();
        const content = result.choices[0]?.message?.content || "No response generated";
        
        console.log('✅ Thomson Reuters OpenAI response received, length:', content.length);
        return content;
      }
    } catch (error) {
      console.error('❌ Error in callOpenAI:', error);
      
      // Special handling for common error types
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        throw new Error('Network error: Failed to connect to OpenAI API. Check your network connection and make sure the service is accessible.');
      }
      
      // Re-throw the original error
      throw error;
    }
  }

  async processMemberChat(
    message: string,
    member: TeamMember,
    teamCapacity: TeamCapacity | null,
    assignedTasks: WorkItem[],
    unassignedTasks: WorkItem[],
    adoBaseUrl: string
  ): Promise<{ text: string; adoLinks: string[]; autoAssignTags?: string[]; autoRemoveTags?: string[] }> {
    try {
      if (!this.credentials && !(await this.initializeClient())) {
        throw new Error('Failed to initialize Thomson Reuters OpenAI client. Please check your configuration and network connection.');
      }
      
      // Create a prompt that includes information about the member, their tasks, and capacity
      let prompt = `You are an AI assistant helping with Azure DevOps team capacity management.
      
Team member: ${member.displayName}
Member ID: ${member.id}
Member has ${assignedTasks.length} assigned tasks and ${unassignedTasks.length} potential tasks to be assigned.
${teamCapacity ? `Current capacity: ${teamCapacity.totalAvailableCapacity} hours` : 'No capacity data available'}

The user asked: "${message}"

IMPORTANT: Your response should directly answer the user's question about ${member.displayName}'s tasks or capacity. 
Don't provide generic responses - be specific and detailed in addressing their exact query.

Analyze the question and provide a helpful response. Include specific tasks by ID when relevant.
For task assignment or removal suggestions, include the task ID so we can create links.

IMPORTANT: If you suggest to automatically assign tasks, include a line starting with "AUTO_ASSIGN:" followed by task IDs.
Example: AUTO_ASSIGN: #123, #456
  
IMPORTANT: If you suggest to automatically remove tasks, include a line starting with "AUTO_REMOVE:" followed by task IDs.
Example: AUTO_REMOVE: #789, #101

Available assigned tasks:
${assignedTasks.map(task => `- #${task.id}: ${task.title} (Effort: ${task.effort || 'unknown'}, State: ${task.state || 'Unknown'})`).join('\n')}

Available unassigned tasks:
${unassignedTasks.map(task => `- #${task.id}: ${task.title} (Effort: ${task.effort || 'unknown'}, State: ${task.state || 'Unknown'})`).join('\n')}

You have full access to these Azure DevOps tasks and permissions to recommend assignments, removals, and capacity adjustments.
Always be specific and answer the exact question asked. Don't provide generic responses.`;

      const messages: OpenAIMessage[] = [
        { role: 'system', content: 'You are an AI assistant for Azure DevOps capacity management with full access to work items and team capacity data. You can make specific recommendations and provide detailed analyses on work items.' },
        { role: 'user', content: prompt }
      ];
      
      const response = await this.callOpenAI(messages, 800, 0.7);
      
      // Parse the response to find any task IDs mentioned
      const taskIdRegex = /#(\d+)/g;
      const mentionedTaskIds: string[] = [];
      let match;
      while ((match = taskIdRegex.exec(response)) !== null) {
        mentionedTaskIds.push(match[1]);
      }
      
        // Create ADO links for each mentioned task
      const adoLinks = mentionedTaskIds.map(taskId => {
        // Ensure the adoBaseUrl has the proper format with organization name included
        const adoConfigStr = localStorage.getItem('adoConfig');
        let organization = '';
        
        if (adoConfigStr) {
          try {
            const adoConfig = JSON.parse(adoConfigStr);
            organization = adoConfig.organization;
          } catch (error) {
            console.error('Error parsing ADO config:', error);
          }
        }
        
        return `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
      });      // Extract auto assignment/removal tags
      const autoAssignRegex = /AUTO_ASSIGN:\s*([^"\n]+)/i;
      const autoRemoveRegex = /AUTO_REMOVE:\s*([^"\n]+)/i;
      
      const autoAssignMatch = response.match(autoAssignRegex);
      const autoRemoveMatch = response.match(autoRemoveRegex);
      
      // Ensure tags are properly formatted with # if missing
      const formatTags = (tags: string[]) => {
        return tags.map(tag => {
          // Remove any existing # to standardize format
          tag = tag.replace(/^#/, '');
          // Ensure the tag starts with #
          return tag.startsWith('#') ? tag : `#${tag}`;
        });
      };
      
      const autoAssignTags = autoAssignMatch 
        ? formatTags(autoAssignMatch[1].trim().split(/,\s*/).map(tag => tag.trim()))
        : [];
        
      const autoRemoveTags = autoRemoveMatch 
        ? formatTags(autoRemoveMatch[1].trim().split(/,\s*/).map(tag => tag.trim()))
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
      console.error('Error processing chat:', error);
      return {
        text: 'Sorry, I encountered an error processing your request. Please try again later.',
        adoLinks: []
      };
    }
  }

  /**
   * Process chat message about the entire team and return AI response with ADO links
   */
  async processTeamChat(
    message: string,
    teamMembers: TeamMember[],
    teamCapacities: TeamCapacity[] | null,
    workItems: WorkItem[],
    sprint: any,
    adoBaseUrl: string
  ): Promise<{ text: string; adoLinks: string[]; autoAssignTags?: string[]; autoRemoveTags?: string[] }> {
    try {
      if (!this.credentials && !(await this.initializeClient())) {
        throw new Error('Failed to initialize Thomson Reuters OpenAI client. Please check your configuration and network connection.');
      }
      
      // Check if we have any team members data
      if (!teamMembers || teamMembers.length === 0) {
        console.warn('⚠️ No team members data available');
        return {
          text: "I need information about your team members to provide a meaningful analysis. Please ensure team member data is loaded before asking team-level questions.",
          adoLinks: []
        };
      }
      
      // Get team utilization data
      console.log('Team capacities:', teamCapacities);
      
      // Handle null or empty teamCapacities safely
      const totalCapacity = teamCapacities?.reduce((sum, tc) => sum + (tc.totalCapacityForSprint || 0), 0) || 0;
      
      // Handle null or empty workItems safely
      const assignedEffort = workItems?.reduce((sum, item) => sum + (item.effort || 0), 0) || 0;
      
      const utilizationPercent = totalCapacity > 0 ? Math.min(100, Math.round((assignedEffort / totalCapacity) * 100)) : 0;
      
      // Get high and low utilization members
      const memberUtilization = teamMembers.map(member => {
        const capacity = teamCapacities?.find(tc => tc.teamMember.id === member.id)?.totalCapacityForSprint || 0;
        const assigned = workItems
          .filter(item => {
            if (!item.assignedTo) return false;
            const assignedToObj = item.assignedTo as any;
            return assignedToObj?.id === member.id || assignedToObj?.displayName === member.displayName;
          })
          .reduce((sum, item) => sum + (item.effort || 0), 0);
        const percent = capacity > 0 ? Math.round((assigned / capacity) * 100) : 0;
        return { member, capacity, assigned, percent };
      });
      
      // Create a detailed prompt for team-level analysis
      let prompt = `You are an AI assistant helping with Azure DevOps team capacity management.
      
Team information:
- Total members: ${teamMembers.length}
- Total work items: ${workItems.length}
- Team total capacity: ${totalCapacity} hours
- Team assigned work: ${assignedEffort} hours
- Team utilization: ${utilizationPercent}%

${sprint ? `Current sprint: ${sprint.name} (${sprint.startDate} to ${sprint.endDate})` : 'No active sprint'}

Member utilization:
${memberUtilization.map(m => `- ${m.member.displayName}: ${m.percent}% (${m.assigned}/${m.capacity} hours)`).join('\n')}

Work item details:
${workItems.slice(0, 10).map(item => `- #${item.id}: ${item.title} (Assigned to: ${(item.assignedTo as any)?.displayName || 'Unassigned'}, Effort: ${item.effort || 'unknown'})`).join('\n')}
${workItems.length > 10 ? `...and ${workItems.length - 10} more items` : ''}

The user asked: "${message}"

Provide a specific, helpful analysis based on the question. Include:
1. Relevant team capacity metrics
2. Member-specific insights if appropriate
3. Recommendations for workload balancing if needed
4. Suggestions for sprint management

For task reassignment suggestions, include the task ID so we can create links.

IMPORTANT: If you suggest to automatically assign tasks, include a line starting with "AUTO_ASSIGN:" followed by task IDs and member name.
Example: AUTO_ASSIGN: #123, #456 to Jane Doe
  
IMPORTANT: If you suggest to automatically remove tasks, include a line starting with "AUTO_REMOVE:" followed by task IDs and member name.
Example: AUTO_REMOVE: #789, #101 from John Smith

Be direct, detailed, and specific. Avoid generic responses asking for more information unless absolutely necessary.`;

      console.log('Sending prompt to OpenAI:', prompt.substring(0, 500) + '...');
      
      const messages: OpenAIMessage[] = [
        { role: 'system', content: 'You are an AI assistant for Azure DevOps capacity management specializing in team-level analysis.' },
        { role: 'user', content: prompt }
      ];
      
      // Make the API call with more tokens allowed for detailed team analysis
      const response = await this.callOpenAI(messages, 1000, 0.7);
      console.log('Response from OpenAI received, length:', response.length);
      
      // Parse the response to find any task IDs mentioned
      const taskIdRegex = /#(\d+)/g;
      const mentionedTaskIds: string[] = [];
      let match;
      while ((match = taskIdRegex.exec(response)) !== null) {
        mentionedTaskIds.push(match[1]);
      }
      
      // Create ADO links for each mentioned task
      const adoLinks = mentionedTaskIds.map(taskId => {
        // Ensure the adoBaseUrl has the proper format with organization name included
        const adoConfigStr = localStorage.getItem('adoConfig');
        let organization = '';
        
        if (adoConfigStr) {
          try {
            const adoConfig = JSON.parse(adoConfigStr);
            organization = adoConfig.organization;
          } catch (error) {
            console.error('Error parsing ADO config:', error);
          }
        }
        
        return `https://dev.azure.com/${organization}/_workitems/edit/${taskId}`;
      });
      
      // Extract auto assignment/removal tags
      const autoAssignRegex = /AUTO_ASSIGN:\s*([^"\n]+)/i;
      const autoRemoveRegex = /AUTO_REMOVE:\s*([^"\n]+)/i;
      
      const autoAssignMatch = response.match(autoAssignRegex);
      const autoRemoveMatch = response.match(autoRemoveRegex);
      
      // Ensure tags are properly formatted with # if missing
      const formatTags = (tags: string[]) => {
        return tags.map(tag => {
          // Remove any existing # to standardize format
          tag = tag.replace(/^#/, '');
          // Ensure the tag starts with #
          return tag.startsWith('#') ? tag : `#${tag}`;
        });
      };
      
      const autoAssignTags = autoAssignMatch 
        ? formatTags(autoAssignMatch[1].trim().split(/,\s*/).map(tag => tag.trim()))
        : [];
        
      const autoRemoveTags = autoRemoveMatch 
        ? formatTags(autoRemoveMatch[1].trim().split(/,\s*/).map(tag => tag.trim()))
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
      console.error('Error processing team chat:', error);
      return {
        text: `I encountered an error analyzing the team data. Details: ${error instanceof Error ? error.message : String(error)}`,
        adoLinks: []
      };
    }
  }

  /**
   * Generate capacity utilization recommendations for team members
   */
  async generateCapacityRecommendations(
  teamCapacities: TeamCapacity[],
    workItems: WorkItem[],
    sprintCapacity: any
  ): Promise<CapacityRecommendation[]> {
    try {
      if (!this.credentials && !(await this.initializeClient())) {
        console.warn('⚠️ Failed to initialize OpenAI client, using fallback recommendations');
        return this.generateFallbackRecommendations(teamCapacities.map(tc => tc.teamMember), workItems, sprintCapacity);
      }

      const recommendations: CapacityRecommendation[] = [];

      console.log('🚀 Generating LIVE AI-powered capacity recommendations using Thomson Reuters OpenAI...');

      for (const tc of teamCapacities) {
        const member = tc.teamMember;
        const activity = tc.activities?.[0]?.name || 'Development';
        const capacityPerDay = tc.totalCapacityPerDay;

        const memberWorkItems = workItems.filter(item => 
          item.assignedTo?.toLowerCase().includes(member.displayName.toLowerCase()) ||
          item.assignedTo?.toLowerCase().includes(member.uniqueName.toLowerCase())
        );

        const unassignedItems = workItems.filter(item => !item.assignedTo);

        // Calculate current capacity utilization
        const currentCapacity = this.calculateMemberCapacity(member, memberWorkItems, sprintCapacity);

        let utilizationLevel: 'optimal' | 'over' | 'under';
        if (currentCapacity >= 95 && currentCapacity <= 105) {
          utilizationLevel = 'optimal';
        } else if (currentCapacity > 105) {
          utilizationLevel = 'over';
        } else {
          utilizationLevel = 'under';
        }

        try {
          const recommendation = await this.generateMemberRecommendation(
            member,
            memberWorkItems,
            unassignedItems,
            utilizationLevel,
            currentCapacity,
            activity,
            capacityPerDay
          );
          
          // Generate ADO links for the tasks
          if (recommendation.tasksToRemove || recommendation.tasksToAssign) {
            // Get ADO config for organization name
            const adoConfigStr = localStorage.getItem('adoConfig');
            let organization = '';
            
            if (adoConfigStr) {
              try {
                const adoConfig = JSON.parse(adoConfigStr);
                organization = adoConfig.organization;
              } catch (error) {
                console.error('Error parsing ADO config:', error);
              }
            }
            
            const baseAdoUrl = "https://dev.azure.com/" + organization;
            
            const adoLinks: string[] = [];
            
            // Add links for tasks to remove
            if (recommendation.tasksToRemove && recommendation.tasksToRemove.length > 0) {
              recommendation.tasksToRemove.forEach(task => {
                if (task.id) {
                  adoLinks.push(`${baseAdoUrl}/_workitems/edit/${task.id}`);
                }
              });
            }
            
            // Add links for tasks to assign
            if (recommendation.tasksToAssign && recommendation.tasksToAssign.length > 0) {
              recommendation.tasksToAssign.forEach(task => {
                if (task.id) {
                  adoLinks.push(`${baseAdoUrl}/_workitems/edit/${task.id}`);
                }
              });
            }
            
            // Add the links to the recommendation
            recommendation.adoLinks = adoLinks;
          }
          
          recommendations.push(recommendation);
        } catch (error) {
          console.warn(`⚠️ Failed to generate AI recommendation for ${member.displayName}, using fallback:`, error);
          // Generate fallback recommendation for this member
          const fallbackRec = this.generateFallbackMemberRecommendation(
            member,
            memberWorkItems,
            unassignedItems,
            utilizationLevel,
            currentCapacity
          );
          recommendations.push(fallbackRec);
        }
      }

      console.log(`🤖 ✅ LIVE AI recommendations generated successfully: ${recommendations.length} recommendations`);
      return recommendations;

    } catch (error) {
      console.error('❌ Failed to generate capacity recommendations:', error);
      console.log('🔄 Falling back to STATIC recommendations (no live AI)...');
      return this.generateFallbackRecommendations(teamCapacities.map(tc => tc.teamMember), workItems, sprintCapacity);
    }
  }

  /**
   * Generate specific recommendation for a team member
   */
  private async generateMemberRecommendation(
    member: TeamMember,
    assignedTasks: WorkItem[],
    unassignedTasks: WorkItem[],
    utilizationLevel: 'optimal' | 'over' | 'under',
    currentCapacity: number,
    activity?: string,
    capacityPerDay?: number
  ): Promise<CapacityRecommendation> {
    
    const memberRole = this.inferMemberRole(member, assignedTasks);
    
    let prompt = '';
    let suggestedActions: string[] = [];
    let tasksToRemove: WorkItem[] = [];
    let tasksToAssign: WorkItem[] = [];

    // Use activity and capacityPerDay if provided
    const activityInfo = activity ? `\n\nTeam member is currently focused on ${activity} activity with ${capacityPerDay} hours capacity per day.` : '';

    switch (utilizationLevel) {
      case 'optimal':
        prompt = this.createOptimalCapacityPrompt(member, currentCapacity) + activityInfo;
        break;
      
      case 'over':
        prompt = this.createOverCapacityPrompt(member, assignedTasks, currentCapacity) + activityInfo;
        tasksToRemove = this.identifyTasksToRemove(assignedTasks);
        break;
      
      case 'under':
        prompt = this.createUnderCapacityPrompt(member, unassignedTasks, memberRole, currentCapacity) + activityInfo;
        tasksToAssign = this.identifyTasksToAssign(unassignedTasks, memberRole);
        break;
    }

    try {
      const recommendation = await this.callOpenAI([
        {
          role: "system",
          content: "You are an AI assistant specialized in agile project management and team capacity optimization. Provide actionable, specific recommendations for sprint planning and team member utilization."
        },
        {
          role: "user",
          content: prompt
        }
      ], 500, 0.7);

      // Generate specific actions based on utilization level
      if (utilizationLevel === 'over') {
        suggestedActions = [
          "Review task priorities and deadlines",
          "Consider redistributing lower-priority tasks",
          "Break down large tasks into smaller chunks",
          "Defer non-critical tasks to future sprints"
        ];
      } else if (utilizationLevel === 'under') {
        suggestedActions = [
          "Assign additional tasks matching skills",
          "Consider pairing or mentoring opportunities",
          "Take on technical debt or improvement tasks",
          "Explore cross-training opportunities"
        ];
      } else {
        suggestedActions = [
          "Maintain current workload",
          "Monitor progress regularly",
          "Be available for urgent tasks",
          "Continue with planned work"
        ];
      }

      return {
        member: member.displayName,
        utilizationLevel,
        currentCapacity,
        recommendation,
        suggestedActions,
        tasksToRemove: utilizationLevel === 'over' ? tasksToRemove : undefined,
        tasksToAssign: utilizationLevel === 'under' ? tasksToAssign : undefined,
        priority: utilizationLevel === 'optimal' ? 'low' : utilizationLevel === 'over' ? 'high' : 'medium'
      };

    } catch (error) {
      console.error(`❌ Failed to generate recommendation for ${member.displayName}:`, error);
      
      // Fallback recommendation without AI
      return {
        member: member.displayName,
        utilizationLevel,
        currentCapacity,
        recommendation: this.getFallbackRecommendation(utilizationLevel, currentCapacity),
        suggestedActions,
        tasksToRemove: utilizationLevel === 'over' ? tasksToRemove : undefined,
        tasksToAssign: utilizationLevel === 'under' ? tasksToAssign : undefined,
        priority: utilizationLevel === 'optimal' ? 'low' : utilizationLevel === 'over' ? 'high' : 'medium'
      };
    }
  }

  private createOptimalCapacityPrompt(member: TeamMember, capacity: number): string {
    return `Team member ${member.displayName} has optimal capacity utilization at ${capacity.toFixed(1)}%. 
    
    Provide a brief, encouraging message about their well-balanced workload and suggest ways to maintain this optimal utilization throughout the sprint. Focus on:
    - Acknowledging their good workload balance
    - Tips for maintaining productivity
    - Being available for urgent tasks if needed
    
    Keep the response concise and positive.`;
  }

  private createOverCapacityPrompt(member: TeamMember, tasks: WorkItem[], capacity: number): string {
    const taskSummary = tasks.map(task => 
      `- ${task.title} (${task.type}, Priority: ${task.priority || 'None'}, State: ${task.state})`
    ).join('\n');

    return `Team member ${member.displayName} is over capacity at ${capacity.toFixed(1)}%. 
    
    Current assigned tasks:
    ${taskSummary}
    
    Analyze the tasks and provide specific recommendations on:
    1. Which tasks should be deprioritized or moved to future sprints
    2. How to optimize their current workload
    3. Strategies to bring capacity back to 100%
    
    Consider task priorities, dependencies, and completion states. Be specific about which tasks to address first.`;
  }

  private createUnderCapacityPrompt(member: TeamMember, unassignedTasks: WorkItem[], role: string, capacity: number): string {
    const relevantTasks = unassignedTasks.slice(0, 10).map(task => 
      `- ${task.title} (${task.type}, Priority: ${task.priority || 'None'}, Tags: ${task.tags?.join(', ') || 'None'})`
    ).join('\n');

    return `Team member ${member.displayName} is under-utilized at ${capacity.toFixed(1)}%. 
    Their inferred role appears to be: ${role}
    
    Available unassigned tasks:
    ${relevantTasks}
    
    Recommend which tasks would be most suitable for this team member based on:
    1. Their apparent role and skills
    2. Task complexity and requirements
    3. Sprint goals and priorities
    4. Opportunities for growth or cross-training
    
    Suggest 2-3 specific tasks they should take on and explain why.`;
  }

  private inferMemberRole(member: TeamMember, tasks: WorkItem[]): string {
    const taskTypes = tasks.map(t => t.type.toLowerCase());
    const taskTitles = tasks.map(t => t.title.toLowerCase()).join(' ');
    
    if (taskTitles.includes('test') || taskTitles.includes('qa') || taskTitles.includes('quality')) {
      return 'QA/Testing';
    } else if (taskTitles.includes('dev') || taskTitles.includes('code') || taskTitles.includes('implement')) {
      return 'Developer';
    } else if (taskTitles.includes('design') || taskTitles.includes('ui') || taskTitles.includes('ux')) {
      return 'Designer';
    } else if (taskTypes.includes('bug')) {
      return 'Developer/Bug Fixing';
    } else {
      return 'General Contributor';
    }
  }

  private calculateMemberCapacity(member: TeamMember, workItems: WorkItem[], sprintCapacity: any): number {
    // Calculate based on task effort only (not story points)
    const totalEffort = workItems.reduce((sum, item) => {
      // Only count Task work items, not User Stories or Features
      if (item.type === 'Task') {
        return sum + (item.effort || 0);
      }
      return sum;
    }, 0);
    
    // Find the member's capacity from team capacities
    const teamMemberCapacity = sprintCapacity?.teamCapacities?.find((tc: any) => 
      tc.teamMember.id === member.id || tc.teamMember.displayName === member.displayName
    );
    
    const memberCapacityHours = teamMemberCapacity?.totalCapacityForSprint || 0;
    
    // Handle edge case of zero capacity
    if (memberCapacityHours <= 0) {
      return totalEffort > 0 ? 100 : 0; // If they have tasks but no capacity, show as 100%
    }
    
    return (totalEffort / memberCapacityHours) * 100;
  }

  private identifyTasksToRemove(tasks: WorkItem[]): WorkItem[] {
    // Prioritize removing low-priority, not-started tasks
    return tasks
      .filter(task => task.state === 'New' || task.state === 'To Do')
      .sort((a, b) => (b.priority || 99) - (a.priority || 99))
      .slice(0, 3);
  }

  private identifyTasksToAssign(unassignedTasks: WorkItem[], memberRole: string): WorkItem[] {
    // Filter tasks that match the member's role
    return unassignedTasks
      .filter(task => {
        const title = task.title.toLowerCase();
        const tags = task.tags?.join(' ').toLowerCase() || '';
        
        if (memberRole.includes('QA') || memberRole.includes('Testing')) {
          return title.includes('test') || title.includes('qa') || tags.includes('test');
        } else if (memberRole.includes('Developer')) {
          return title.includes('dev') || title.includes('code') || title.includes('implement') || task.type === 'Bug';
        } else if (memberRole.includes('Designer')) {
          return title.includes('design') || title.includes('ui') || tags.includes('design');
        }
        return true; // General tasks for general contributors
      })
      .sort((a, b) => (a.priority || 99) - (b.priority || 99))
      .slice(0, 3);
  }

  private getFallbackRecommendation(utilizationLevel: 'optimal' | 'over' | 'under', capacity: number): string {
    switch (utilizationLevel) {
      case 'optimal':
        return `Great job! Your current capacity utilization of ${capacity.toFixed(1)}% is optimal. Continue with your current workload and stay available for any urgent tasks that may arise.`;
      
      case 'over':
        return `Your capacity is at ${capacity.toFixed(1)}%, which is above optimal levels. Consider reviewing your task priorities and potentially deferring some non-critical items to maintain quality and avoid burnout.`;
      
      case 'under':
        return `Your current capacity utilization is ${capacity.toFixed(1)}%. You have bandwidth to take on additional tasks. Consider picking up unassigned work items that match your skills and expertise.`;
      
      default:
        return 'Unable to generate recommendation at this time.';
    }
  }

  /**
   * Generate fallback recommendations when AI is not available
   */
  private generateFallbackRecommendations(
    teamMembers: TeamMember[],
    workItems: WorkItem[],
    sprintCapacity: any
  ): CapacityRecommendation[] {
    return teamMembers.map(member => {
      const memberWorkItems = workItems.filter(item => 
        item.assignedTo?.toLowerCase().includes(member.displayName.toLowerCase()) ||
        item.assignedTo?.toLowerCase().includes(member.uniqueName.toLowerCase())
      );

      const unassignedItems = workItems.filter(item => !item.assignedTo);
      const currentCapacity = this.calculateMemberCapacity(member, memberWorkItems, sprintCapacity);
      
      let utilizationLevel: 'optimal' | 'over' | 'under';
      if (currentCapacity >= 95 && currentCapacity <= 105) {
        utilizationLevel = 'optimal';
      } else if (currentCapacity > 105) {
        utilizationLevel = 'over';
      } else {
        utilizationLevel = 'under';
      }

      return this.generateFallbackMemberRecommendation(
        member,
        memberWorkItems,
        unassignedItems,
        utilizationLevel,
        currentCapacity
      );
    });
  }

  /**
   * Generate intelligent fallback response when AI service is unavailable
   */
  private generateIntelligentFallbackResponse(
    message: string,
    member: TeamMember,
    assignedTasks: WorkItem[],
    unassignedTasks: WorkItem[],
    teamCapacity: TeamCapacity | null
  ): { text: string; adoLinks: string[]; autoAssignTags?: string[]; autoRemoveTags?: string[] } {
    console.log('🔄 Generating intelligent fallback response for:', member.displayName);
    
    const memberName = member.displayName;
    const assignedCount = assignedTasks.length;
    const unassignedCount = unassignedTasks.length;
    const capacity = teamCapacity?.totalAvailableCapacity || teamCapacity?.totalCapacityForSprint || 40;
    
    // Analyze the message to provide contextual responses
    const messageLower = message.toLowerCase();
    
    let fallbackText = '';
    let autoAssignTags: string[] = [];
    let autoRemoveTags: string[] = [];
    const adoLinks: string[] = [];
    
    if (messageLower.includes('capacity') || messageLower.includes('workload')) {
      const utilizationLevel = assignedCount > 3 ? 'High' : assignedCount > 1 ? 'Optimal' : 'Light';
      fallbackText = `📊 **${memberName}'s Capacity Analysis** (Fallback Mode)

**Current Status:**
• Assigned Tasks: ${assignedCount} items
• Available Capacity: ${capacity} hours this sprint
• Utilization Level: ${utilizationLevel}

**AI Analysis:**
${assignedCount > 3 
  ? `${memberName} appears to have a heavy workload. Consider redistributing 1-2 lower priority tasks to balance the team.` 
  : assignedCount < 2 
    ? `${memberName} has capacity for additional work. Consider assigning ${Math.min(unassignedCount, 2)} unassigned tasks.`
    : `${memberName}'s workload looks well-balanced for this sprint.`}

${unassignedCount > 0 ? `\n**Available for Assignment:** ${unassignedCount} unassigned tasks in backlog` : ''}

*Note: Thomson Reuters AI service temporarily unavailable. Using intelligent fallback analysis.*`;
      
    } else if (messageLower.includes('assign') || messageLower.includes('task')) {
      const suggestedTasks = unassignedTasks.slice(0, 2);
      fallbackText = `🎯 **Task Assignment for ${memberName}** (Fallback Mode)

**Current Assignments:** ${assignedCount} tasks
**Recommendation:** ${assignedCount < 3 ? 'Can take additional work' : 'At capacity, avoid new assignments'}

${suggestedTasks.length > 0 ? `**Suggested Tasks:**
${suggestedTasks.map(task => `• #${task.id}: ${task.title} (${task.effort || 'TBD'} hrs)`).join('\n')}

**Auto-Assignment Recommendation:**` : '**No unassigned tasks available**'}

*Note: Thomson Reuters AI service temporarily unavailable. Using intelligent fallback analysis.*`;
      
      // Add auto-assignment tags for fallback
      if (assignedCount < 3 && suggestedTasks.length > 0) {
        autoAssignTags = suggestedTasks.map(t => `#${t.id}`);
      }
      
    } else if (messageLower.includes('status') || messageLower.includes('progress')) {
      const completedTasks = assignedTasks.filter(t => t.state === 'Done' || t.state === 'Completed' || t.state === 'Closed');
      const progressRate = assignedTasks.length > 0 ? Math.round((completedTasks.length / assignedTasks.length) * 100) : 0;
      
      fallbackText = `📈 **${memberName}'s Sprint Progress** (Fallback Mode)

**Sprint Summary:**
• Total Tasks: ${assignedCount}
• Completed: ${completedTasks.length}
• In Progress: ${assignedTasks.length - completedTasks.length}
• Progress Rate: ${progressRate}%

**Status Analysis:** ${progressRate > 70 ? 'On track ✅' : progressRate > 30 ? 'Needs attention ⚠️' : 'At risk ❌'}

**Recent Tasks:**
${assignedTasks.slice(0, 3).map(task => `• #${task.id}: ${task.title} (${task.state})`).join('\n')}

*Note: Thomson Reuters AI service temporarily unavailable. Using intelligent fallback analysis.*`;
      
    } else {
      // Generic helpful response
      fallbackText = `💬 **AI Assistant Response for ${memberName}** (Fallback Mode)

I understand you're asking about ${memberName}. Here's what I can help with:

• **Capacity Analysis** - Check workload and utilization
• **Task Assignment** - Recommend optimal task assignments  
• **Progress Tracking** - Monitor sprint progress and completion
• **Workload Balancing** - Suggest task redistributions

**Current Status:**
• Assigned Tasks: ${assignedCount}
• Team Capacity: ${capacity} hours
• Available Unassigned: ${unassignedCount} tasks

**Quick Actions:**
- Ask: "What's ${memberName}'s capacity?"
- Ask: "Assign tasks to ${memberName}"
- Ask: "Show ${memberName}'s progress"

*Note: Thomson Reuters AI service temporarily unavailable. Using intelligent fallback analysis.*`;
    }
    
    // Generate ADO links for mentioned tasks
    const taskIdRegex = /#(\d+)/g;
    const mentionedTaskIds: string[] = [];
    let match;
    while ((match = taskIdRegex.exec(fallbackText)) !== null) {
      mentionedTaskIds.push(match[1]);
    }
    
    // Create ADO links
    if (mentionedTaskIds.length > 0) {
      const adoConfigStr = localStorage.getItem('adoConfig');
      let organization = '';
      
      if (adoConfigStr) {
        try {
          const adoConfig = JSON.parse(adoConfigStr);
          organization = adoConfig.organization;
        } catch (error) {
          console.error('Error parsing ADO config:', error);
        }
      }
      
      mentionedTaskIds.forEach(taskId => {
        adoLinks.push(`https://dev.azure.com/${organization}/_workitems/edit/${taskId}`);
      });
    }
    
    return {
      text: fallbackText,
      adoLinks,
      autoAssignTags: autoAssignTags.length > 0 ? autoAssignTags : undefined,
      autoRemoveTags: autoRemoveTags.length > 0 ? autoRemoveTags : undefined
    };
  }

  /**
   * Generate fallback recommendation for a single member
   */
  private generateFallbackMemberRecommendation(
    member: TeamMember,
    assignedTasks: WorkItem[],
    unassignedTasks: WorkItem[],
    utilizationLevel: 'optimal' | 'over' | 'under',
    currentCapacity: number
  ): CapacityRecommendation {
    let suggestedActions: string[] = [];
    let tasksToRemove: WorkItem[] = [];
    let tasksToAssign: WorkItem[] = [];

    switch (utilizationLevel) {
      case 'over':
        suggestedActions = [
          "Review task priorities and deadlines",
          "Consider redistributing lower-priority tasks",
          "Break down large tasks into smaller chunks",
          "Defer non-critical tasks to future sprints"
        ];
        tasksToRemove = this.identifyTasksToRemove(assignedTasks);
        break;
      
      case 'under':
        suggestedActions = [
          "Assign additional tasks matching skills",
          "Consider pairing or mentoring opportunities",
          "Take on technical debt or improvement tasks",
          "Explore cross-training opportunities"
        ];
        tasksToAssign = this.identifyTasksToAssign(unassignedTasks, this.inferMemberRole(member, assignedTasks));
        break;
      
      default:
        suggestedActions = [
          "Maintain current workload",
          "Monitor progress regularly",
          "Be available for urgent tasks",
          "Continue with planned work"
        ];
    }

    return {
      member: member.displayName,
      utilizationLevel,
      currentCapacity,
      recommendation: this.getFallbackRecommendation(utilizationLevel, currentCapacity),
      suggestedActions,
      tasksToRemove: utilizationLevel === 'over' ? tasksToRemove : undefined,
      tasksToAssign: utilizationLevel === 'under' ? tasksToAssign : undefined,
      priority: utilizationLevel === 'optimal' ? 'low' : utilizationLevel === 'over' ? 'high' : 'medium'
    };
  }

  /**
   * Test the OpenAI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.credentials && !(await this.initializeClient())) {
        return false;
      }

      const response = await this.callOpenAI([
        {
          role: "user",
          content: "Hello, can you confirm this connection is working?"
        }
      ], 50);

      console.log('✅ Thomson Reuters OpenAI connection test successful:', response);
      return true;

    } catch (error) {
      console.error('❌ Thomson Reuters OpenAI connection test failed:', error);
      return false;
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TROpenAIConfig>): void {
    this.config = { ...this.config, ...config };
    localStorage.setItem('trOpenAiConfig', JSON.stringify(this.config));
    // Reset credentials to force re-initialization with new config
    this.credentials = null;
    this.headers = {};
  }

  /**
   * Get current configuration
   */
  getConfig(): TROpenAIConfig {
    return { ...this.config };
  }

  /**
   * Check if we're running in development mode with mock data
   */
  isDevelopmentMode(): boolean {
    return false; // Always return false - force production mode
  }

  /**
   * Generic chat method for AI processing
   */
  async processGenericChat(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number = 500
  ): Promise<string> {
    try {
      if (!this.credentials && !(await this.initializeClient())) {
        throw new Error('Failed to initialize OpenAI client');
      }

      const messages: OpenAIMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      return await this.callOpenAI(messages, maxTokens, 0.7);
    } catch (error) {
      console.error('Error in generic chat:', error);
      throw error;
    }
  }

  /**
   * Get status information about the service
   */
  getServiceStatus(): { 
    isInitialized: boolean; 
    isDevelopment: boolean; 
    hasCredentials: boolean;
    lastError?: string;
  } {
    return {
      isInitialized: !!this.credentials,
      isDevelopment: false, // Always false - force production mode
      hasCredentials: !!this.credentials?.openai_key,
      lastError: undefined // Could store last error if needed
    };
  }
}

// Create singleton instance
export const thomsonReutersOpenAIService = new ThomsonReutersOpenAIService();
