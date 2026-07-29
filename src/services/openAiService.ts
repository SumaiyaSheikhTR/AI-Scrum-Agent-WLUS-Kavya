import axios from 'axios';

// Types for OpenAI API
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface OpenAICredentials {
  openai_key: string;
  openai_endpoint: string;
  azure_deployment: string;
  openai_api_version: string;
  token: string;
}

// Service for interacting with OpenAI
class OpenAIService {
  private credentials: OpenAICredentials | null = null;
  private messages: OpenAIMessage[] = [];
  private baseUrl: string = 'https://eais2-use.int.thomsonreuters.com';
  private workspaceId: string = 'RittikaPlaygneUd';
  private assetId: string = '204383';
  private modelName: string = 'gpt-4o';

  constructor() {
    // Load configuration from localStorage
    this.loadConfig();
    
    // Initialize with system message that defines the AI's role
    this.messages = [
      {
        role: 'system',
        content: `You are an AI Scrum Assistant designed to help with Agile project management. 
        Your capabilities include:
        
        1. Automated Task Monitoring - You can analyze and report on task statuses from Azure DevOps boards.
        2. Sprint Summary Generation - You can compile daily digests of sprint progress.
        3. Smart Ticket Management - You can suggest updates to ticket statuses based on conditions.
        4. Developer Engagement & Follow-ups - You can monitor developer activity and send reminders.
        5. Data-Driven Insights - You can provide analytics on sprint performance and developer contributions.
        6. Interactive Work Item Updates - You can suggest updates to work items based on recent activity.
        
        When responding to queries, provide concise, actionable information. When appropriate, format your responses 
        with tables, charts (using markdown), or structured data to make the information more digestible.
        
        Always be helpful, professional, and focused on improving the team's Agile workflow.`
      }
    ];
  }
  
  // Load configuration from localStorage
  private loadConfig(): void {
    try {
      const configStr = localStorage.getItem('openai_config');
      if (configStr) {
        const config = JSON.parse(configStr);
        this.workspaceId = config.workspaceId || 'RittikaPlaygneUd';
        this.assetId = config.assetId || '204383';
        this.modelName = config.modelName || 'gpt-4o';
        this.baseUrl = config.baseUrl || 'https://eais2-use.int.thomsonreuters.com';
      } else {
        // Default values if no configuration is found
        this.baseUrl = 'https://eais2-use.int.thomsonreuters.com';
        this.workspaceId = 'RittikaPlaygneUd';
        this.assetId = '204383';
        this.modelName = 'gpt-4o';
      }
      console.log('OpenAI configuration loaded:', {
        workspaceId: this.workspaceId,
        assetId: this.assetId,
        modelName: this.modelName,
        baseUrl: this.baseUrl
      });
    } catch (error) {
      console.error('Error loading OpenAI configuration:', error);
      // Default values if there's an error
      this.baseUrl = 'https://eais2-use.int.thomsonreuters.com';
      this.workspaceId = 'RittikaPlaygneUd';
      this.assetId = '204383';
      this.modelName = 'gpt-4o';
    }
  }

  // Get credentials from the token endpoint
  private async getCredentials(): Promise<OpenAICredentials> {
    try {
      if (this.credentials) {
        return this.credentials;
      }

      const payload = {
        workspace_id: this.workspaceId,
        model_name: this.modelName
      };

      const url = 'https://aiplatform.gcs.int.thomsonreuters.com/v1/openai/token';
      const response = await axios.post(url, payload);
      this.credentials = response.data;
      
      if (!this.credentials) {
        throw new Error('Failed to retrieve OpenAI credentials');
      }
      
      return this.credentials;
    } catch (error) {
      console.error('Failed to retrieve OpenAI credentials:', error);
      throw new Error('Failed to retrieve OpenAI credentials. Please check your configuration.');
    }
  }

  // Send a message to OpenAI and get a response
  public async chat(userMessage: string): Promise<string> {
    try {
      // Reload configuration in case it was updated
      this.loadConfig();
      
      // For debugging purposes, log the configuration
      console.log('Using OpenAI configuration:', {
        workspaceId: this.workspaceId,
        assetId: this.assetId,
        modelName: this.modelName,
        baseUrl: this.baseUrl
      });
      
      // Get credentials for the API call
      const credentials = await this.getCredentials();
      
      // Add user message to the conversation history
      this.messages.push({
        role: 'user',
        content: userMessage
      });

      // Prepare headers for the request
      const llmProfileKey = credentials.azure_deployment.split('/')[0];
      const headers = {
        'Authorization': `Bearer ${credentials.token}`,
        'api-key': credentials.openai_key,
        'Content-Type': 'application/json',
        'x-tr-chat-profile-name': 'ai-platforms-chatprofile-prod',
        'x-tr-userid': this.workspaceId,
        'x-tr-llm-profile-key': llmProfileKey,
        'x-tr-user-sensitivity': 'true',
        'x-tr-sessionid': credentials.azure_deployment,
        'x-tr-asset-id': this.assetId,
        'x-tr-authorization': this.baseUrl
      };

      console.log('Making request to OpenAI with headers:', headers);
      
      // Make the request to OpenAI
      const response = await axios.post(
        `${this.baseUrl}/openai/deployments/${credentials.azure_deployment}/chat/completions?api-version=${credentials.openai_api_version}`,
        {
          messages: this.messages,
          model: this.modelName
        },
        { headers }
      );

      console.log('Received response from OpenAI:', response.data);
      
      // Extract the assistant's response
      const assistantMessage = response.data.choices[0].message.content;
      
      // Add assistant message to the conversation history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage
      });

      return assistantMessage;
    } catch (error) {
      console.error('Error in OpenAI chat:', error);
      
      // Add more detailed error logging
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method,
            headers: error.config?.headers,
            data: error.config?.data
          }
        });
      }
      
      throw error instanceof Error
        ? error
        : new Error('Failed to get a real AI response. Please verify OpenAI configuration.');
    }
  }

  // Clear the conversation history
  public clearConversation(): void {
    // Keep the system message but clear the rest
    this.messages = this.messages.filter(msg => msg.role === 'system');
  }

  // Get the conversation history
  public getConversationHistory(): OpenAIMessage[] {
    return [...this.messages];
  }

  // Generate a sprint summary
  public async generateSprintSummary(
    sprintName: string,
    completedItems: number,
    inProgressItems: number,
    blockedItems: number
  ): Promise<string> {
    const prompt = `
      Generate a concise sprint summary for "${sprintName}" with the following statistics:
      - Completed items: ${completedItems}
      - In progress items: ${inProgressItems}
      - Blocked items: ${blockedItems}
      
      Include insights about sprint progress, potential risks, and recommendations for the team.
      Format the response in a professional tone suitable for a sprint review meeting.
    `;

    try {
      const response = await this.chat(prompt);
      return response;
    } catch (error) {
      console.error('Error generating sprint summary:', error);
      return 'Unable to generate sprint summary at this time. Please try again later.';
    }
  }
}

export default new OpenAIService();
