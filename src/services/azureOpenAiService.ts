import axios from 'axios';

// Types for Azure OpenAI API
interface AzureOpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface TROpenAIConfig {
  tokenUrl: string;
  endpoint: string;
  workspaceId: string;
  assetId: string;
  modelName: string;
  apiVersion: string;
}

interface TROpenAICredentials {
  openai_key: string;
  openai_endpoint: string;
  azure_deployment: string;
  openai_api_version: string;
  token: string;
}

// Type guard for Axios errors
function isAxiosError(error: any): error is import('axios').AxiosError {
  return error && error.isAxiosError === true;
}

// Service for interacting with Thomson Reuters Azure OpenAI
class AzureOpenAIService {
  private config: TROpenAIConfig | null = null;
  private credentials: TROpenAICredentials | null = null;
  private messages: AzureOpenAIMessage[] = [];

  constructor() {
    // Load configuration from environment variables and localStorage
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
  
  // Load configuration from environment variables and localStorage
  private loadConfig(): void {
    try {
      // Try to load from localStorage first (for user-configured values)
      const configStr = localStorage.getItem('tr_openai_config');
      let storedConfig = null;
      
      if (configStr) {
        storedConfig = JSON.parse(configStr);
      }
      
      // Use environment variables as defaults, localStorage values as overrides
      this.config = {
        tokenUrl: storedConfig?.tokenUrl || process.env.REACT_APP_AZURE_OPENAI_TOKEN_URL || '',
        endpoint: storedConfig?.endpoint || process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || '',
        workspaceId: storedConfig?.workspaceId || process.env.REACT_APP_AZURE_OPENAI_WORKSPACE_ID || '',
        assetId: storedConfig?.assetId || process.env.REACT_APP_AZURE_OPENAI_ASSET_ID || '',
        modelName: storedConfig?.modelName || process.env.REACT_APP_AZURE_OPENAI_MODEL_NAME || 'gpt-4o',
        apiVersion: storedConfig?.apiVersion || process.env.REACT_APP_AZURE_OPENAI_API_VERSION || '2024-02-15-preview'
      };
      
      console.log('Thomson Reuters OpenAI configuration loaded:', {
        endpoint: this.config.endpoint,
        workspaceId: this.config.workspaceId,
        assetId: this.config.assetId,
        modelName: this.config.modelName,
        apiVersion: this.config.apiVersion,
        hasTokenUrl: !!this.config.tokenUrl
      });
    } catch (error) {
      console.error('Error loading Thomson Reuters OpenAI configuration:', error);
      this.config = null;
    }
  }

  // Update configuration
  public updateConfig(config: Partial<TROpenAIConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...config };
    } else {
      this.config = config as TROpenAIConfig;
    }
    
    // Save to localStorage
    localStorage.setItem('tr_openai_config', JSON.stringify(this.config));
    console.log('Thomson Reuters OpenAI configuration updated');
  }

  // Get credentials from Thomson Reuters platform
  private async getCredentials(): Promise<TROpenAICredentials> {
    if (!this.config) {
      throw new Error('Configuration not loaded');
    }

    if (this.credentials) {
      // Return cached credentials if available
      return this.credentials as TROpenAICredentials;
    }

    try {
      const payload = {
        workspace_id: this.config.workspaceId,
        model_name: this.config.modelName
      };

      console.log('Getting credentials from TR platform...');
      const response = await axios.post(this.config.tokenUrl, payload);
      
      if (response.data && response.data.openai_key && response.data.openai_endpoint) {
        this.credentials = response.data;
        console.log('Thomson Reuters OpenAI credentials obtained successfully');
        return this.credentials as TROpenAICredentials;
      } else {
        throw new Error('Invalid credentials response from TR platform');
      }
    } catch (error) {
      console.error('Error getting TR OpenAI credentials:', error);
      throw new Error('Failed to obtain Thomson Reuters OpenAI credentials');
    }
  }

  // Validate configuration
  private validateConfig(): boolean {
    if (!this.config) {
      console.error('Thomson Reuters OpenAI configuration is not loaded');
      return false;
    }
    
    if (!this.config.tokenUrl) {
      console.error('TR OpenAI token URL is missing');
      return false;
    }
    
    if (!this.config.endpoint) {
      console.error('TR OpenAI endpoint is missing');
      return false;
    }
    
    if (!this.config.workspaceId) {
      console.error('TR OpenAI workspace ID is missing');
      return false;
    }

    if (!this.config.assetId) {
      console.error('TR OpenAI asset ID is missing');
      return false;
    }
    
    return true;
  }

  // Send a message to Thomson Reuters Azure OpenAI and get a response
  public async chat(userMessage: string): Promise<string> {
    try {
      // Reload configuration in case it was updated
      this.loadConfig();
      
      // Check if we're using mock data for development/testing
      if (process.env.REACT_APP_USE_MOCK_AI === 'true') {
        console.log('Using mock AI response for development');
        
        // Add user message to the conversation history
        this.messages.push({
          role: 'user',
          content: userMessage
        });
        
        // Generate a context-aware mock response
        let mockResponse = '';
        const lowerMessage = userMessage.toLowerCase();
        
        if (lowerMessage.includes('sprint') && (lowerMessage.includes('summary') || lowerMessage.includes('current'))) {
          mockResponse = `📊 **Current Sprint Summary** (Mock Data)

**Sprint Overview:**
• Sprint 24.3 - "Research Skills Enhancement"
• Duration: Dec 16, 2024 - Jan 6, 2025 (3 weeks)
• Team: Research Skills Development Team

**Work Items Progress:**
• **Total Items:** 12 work items
• **Completed:** 8 work items (67%)
• **In Progress:** 3 work items (25%)
• **Not Started:** 1 work item (8%)

**Key Highlights:**
• Work Item #2162601: "Negative Treatment Website Summary" - ✅ Completed
  - 4 pull requests merged successfully
  - GitHub repos: research-skills-app, platform-repo
• High velocity team with consistent delivery
• No major blockers identified

**Sprint Metrics:**
• Velocity: 34 story points
• Burn rate: On track
• PR review time: 1.2 days average

*Note: This is mock data for development. Configure Thomson Reuters OpenAI to get real sprint analysis.*`;
        } else if (lowerMessage.includes('work item') || lowerMessage.includes('pull request') || lowerMessage.includes('pr')) {
          mockResponse = `🔍 **Work Items & Pull Requests** (Mock Data)

**Recent Activity:**
• Work Item #2162601 has 4 associated pull requests
• All PRs are completed and merged
• GitHub integration working via AB# tagging

**Active PRs:**
Currently no active pull requests requiring attention.

**Completed This Sprint:**
• feat(NegativeTreatment): Add NT Summary... (#1128, #1105, #31215)
• feat(Platform): Add NT Summary to Delivery... (#18930)

*Configure Thomson Reuters OpenAI for real-time analysis.*`;
        } else if (lowerMessage.includes('team') || lowerMessage.includes('developer')) {
          mockResponse = `👥 **Team Analytics** (Mock Data)

**Team Members:**
• Kavya Sreedhar (TR Technology) - Primary assignee
• Active contributor with consistent commits

**Development Velocity:**
• Average cycle time: 3.2 days
• Code review participation: High
• Feature delivery rate: Excellent

*Real team insights available with Thomson Reuters OpenAI.*`;
        } else {
          mockResponse = `🤖 **AI Scrum Assistant** (Mock Mode)

I'm running in development mode with mock data. Here's what I can help you with:

• **Sprint Analysis:** Ask about current sprint summary, progress, or metrics
• **Work Item Tracking:** Get details on specific work items and their PRs
• **Team Insights:** Developer analytics and team performance
• **Process Improvement:** Scrum best practices and recommendations

Try asking: "What's the current sprint summary?" or "Show me work item progress"

*To get real AI insights, configure your Thomson Reuters OpenAI credentials in Settings.*`;
        }
        
        // Add mock assistant message to the conversation history
        this.messages.push({
          role: 'assistant',
          content: mockResponse
        });
        
        return mockResponse;
      }
      
      // Validate configuration
      if (!this.validateConfig() || !this.config) {
        throw new Error('Thomson Reuters OpenAI configuration is invalid. Please check your workspace ID, asset ID, and endpoint settings.');
      }
      
      // Get credentials from TR platform
      const credentials = await this.getCredentials();
      
      // Add user message to the conversation history
      this.messages.push({
        role: 'user',
        content: userMessage
      });

      // Extract deployment info for headers
      const llmProfileKey = credentials.azure_deployment.split("/")[0];

      // Prepare headers for Thomson Reuters API
      const headers = {
        'Authorization': `Bearer ${credentials.token}`,
        'api-key': credentials.openai_key,
        'Content-Type': 'application/json',
        'x-tr-chat-profile-name': 'ai-platforms-chatprofile-prod',
        'x-tr-userid': this.config.workspaceId,
        'x-tr-llm-profile-key': llmProfileKey,
        'x-tr-user-sensitivity': 'true',
        'x-tr-sessionid': credentials.azure_deployment,
        'x-tr-asset-id': this.config.assetId,
        'x-tr-authorization': this.config.endpoint
      };

      // Construct the Thomson Reuters Azure OpenAI endpoint URL
      const url = `${this.config.endpoint}/openai/deployments/${credentials.azure_deployment}/chat/completions?api-version=${this.config.apiVersion}`;
      
      console.log('Making request to Thomson Reuters Azure OpenAI:', {
        url: url.replace(credentials.openai_key, '[REDACTED]'),
        deployment: credentials.azure_deployment,
        messageCount: this.messages.length,
        workspaceId: this.config.workspaceId,
        assetId: this.config.assetId
      });
      
      // Make the request to Thomson Reuters Azure OpenAI
      const response = await axios.post(
        url,
        {
          model: this.config.modelName,
          messages: this.messages,
          temperature: 0.7,
          max_tokens: 1000,
          top_p: 0.95,
          frequency_penalty: 0,
          presence_penalty: 0,
          stop: null
        },
        { headers }
      );

      console.log('Received response from Thomson Reuters Azure OpenAI');
      
      // Extract the assistant's response
      const assistantMessage = response.data.choices[0].message.content;
      
      // Add assistant message to the conversation history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage
      });

      return assistantMessage;
    } catch (error) {
      console.error('Error in Thomson Reuters Azure OpenAI chat:', error);
      
      // Add more detailed error logging
      if (isAxiosError(error)) {
        console.error('Thomson Reuters Azure OpenAI API error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        
        // Provide more specific error messages based on status code
        if (error.response?.status === 401) {
          return 'Authentication failed. Please check your Thomson Reuters workspace credentials.';
        } else if (error.response?.status === 403) {
          return 'Access forbidden. Please check your Thomson Reuters permissions and subscription.';
        } else if (error.response?.status === 404) {
          return 'Thomson Reuters Azure OpenAI deployment not found. Please check your workspace configuration.';
        } else if (error.response?.status === 429) {
          return 'Rate limit exceeded. Please try again in a moment.';
        }
      }
      
      // Add a fallback response for development/testing
      if (process.env.REACT_APP_USE_MOCK_AI === 'true') {
        console.log('Using fallback mock response due to error');
        const fallbackResponse = `⚠️ **Error in Development Mode**

There was an issue processing your request, but since we're in mock mode, here's what I would help you with:

**For "${userMessage}":**
• Sprint analysis and metrics
• Work item progress tracking  
• Team performance insights
• Pull request monitoring

**To resolve:**
1. Check browser console for detailed error logs
2. Verify Thomson Reuters OpenAI configuration in Settings
3. Ensure network connectivity to TR services

*This is a development fallback response.*`;
        
        // Add fallback assistant message to the conversation history
        this.messages.push({
          role: 'assistant',
          content: fallbackResponse
        });
        
        return fallbackResponse;
      }
      
      return 'Sorry, I encountered an error while processing your request. Please check your Thomson Reuters OpenAI configuration and try again.';
    }
  }

  // Clear the conversation history
  public clearConversation(): void {
    // Keep the system message but clear the rest
    this.messages = this.messages.filter(msg => msg.role === 'system');
  }

  // Get the conversation history
  public getConversationHistory(): AzureOpenAIMessage[] {
    return [...this.messages];
  }

  // Get current configuration (without sensitive data)
  public getConfig(): Partial<TROpenAIConfig> {
    if (!this.config) {
      return {};
    }
    
    return {
      endpoint: this.config.endpoint,
      workspaceId: this.config.workspaceId,
      assetId: this.config.assetId,
      modelName: this.config.modelName,
      apiVersion: this.config.apiVersion,
      // Don't return the token URL for security
    };
  }

  // Test the connection to Thomson Reuters Azure OpenAI
  public async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      if (!this.validateConfig() || !this.config) {
        return {
          success: false,
          message: 'Configuration is invalid. Please check your settings.'
        };
      }

      // Get credentials from TR platform
      const credentials = await this.getCredentials();
      
      // Extract deployment info for headers
      const llmProfileKey = credentials.azure_deployment.split("/")[0];

      const headers = {
        'Authorization': `Bearer ${credentials.token}`,
        'api-key': credentials.openai_key,
        'Content-Type': 'application/json',
        'x-tr-chat-profile-name': 'ai-platforms-chatprofile-prod',
        'x-tr-userid': this.config.workspaceId,
        'x-tr-llm-profile-key': llmProfileKey,
        'x-tr-user-sensitivity': 'true',
        'x-tr-sessionid': credentials.azure_deployment,
        'x-tr-asset-id': this.config.assetId,
        'x-tr-authorization': this.config.endpoint
      };

      const url = `${this.config.endpoint}/openai/deployments/${credentials.azure_deployment}/chat/completions?api-version=${this.config.apiVersion}`;
      
      // Send a simple test message
      const response = await axios.post(
        url,
        {
          model: this.config.modelName,
          messages: [
            { role: 'user', content: 'Hello, this is a connection test.' }
          ],
          max_tokens: 10
        },
        { headers }
      );

      if (response.status === 200) {
        return {
          success: true,
          message: 'Successfully connected to Thomson Reuters Azure OpenAI!'
        };
      } else {
        return {
          success: false,
          message: `Unexpected response status: ${response.status}`
        };
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;
        
        return {
          success: false,
          message: `Connection failed (${status}): ${message}`
        };
      }
      
      return {
        success: false,
        message: 'Connection test failed with an unknown error.'
      };
    }
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
      return 'Unable to generate sprint summary at this time. Please check your Azure OpenAI configuration and try again.';
    }
  }
}

const azureOpenAIService = new AzureOpenAIService();
export default azureOpenAIService;
