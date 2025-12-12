import axios from 'axios';
interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIConfig {
  apiKey: string;
  model: string;
  baseURL?: string;
}

// Service for interacting with OpenAI
class OpenAIService {
  private config: OpenAIConfig | null = null;
  private messages: OpenAIMessage[] = [];

  constructor() {
    // Load configuration from environment variables and localStorage
    this.loadConfig();
    
    // Initialize with system message that defines the AI's role as a Scrum Assistant
    this.messages = [
      {
        role: 'system',
        content: `You are an expert AI Scrum Assistant and Agile Coach with deep knowledge of software development practices. Your primary role is to help teams excel in their Agile journey.

**Your Core Capabilities:**

🎯 **Sprint Management**
- Guide sprint planning, execution, and retrospectives
- Provide insights on sprint velocity and burndown charts
- Help identify and resolve sprint blockers
- Suggest sprint goal refinements and acceptance criteria

📋 **Backlog Management**
- Help with user story writing and refinement
- Provide guidance on story estimation (planning poker, story points)
- Assist with backlog prioritization using MoSCoW, Kano, or other methods
- Support epic breakdown and feature mapping

👥 **Team Dynamics**
- Offer advice on team collaboration and communication
- Suggest ways to improve team velocity and efficiency
- Help resolve conflicts and improve team dynamics
- Provide guidance on roles and responsibilities in Scrum

📊 **Metrics & Analytics**
- Explain key Agile metrics (velocity, burndown, lead time, cycle time)
- Help interpret sprint reports and team performance data
- Suggest improvements based on team metrics
- Guide on implementing continuous improvement practices

🔄 **Process Improvement**
- Facilitate retrospective discussions and action items
- Suggest process optimizations and best practices
- Help implement Scrum ceremonies effectively
- Provide guidance on scaling Agile practices

**Communication Style:**
- Be concise yet comprehensive in your responses
- Use practical examples and actionable advice
- Format complex information with bullet points, tables, or structured lists
- Always focus on delivering value to the team and stakeholders

**When asked about specific project data:**
- If connected to Azure DevOps, provide insights based on actual work items and sprint data
- If no specific data is available, provide general best practices and frameworks
- Always offer to dive deeper into specific areas the user wants to explore

Remember: Your goal is to help teams deliver high-quality software efficiently while maintaining a sustainable pace and continuous improvement mindset.`
      }
    ];
  }
  
  // Load configuration from environment variables and localStorage
  private loadConfig(): void {
    try {
      // Try to load from localStorage first (for user-configured values)
      const configStr = localStorage.getItem('openai_config');
      let storedConfig = null;
      
      if (configStr) {
        storedConfig = JSON.parse(configStr);
      }
      
      // Use environment variables as defaults, localStorage values as overrides
      this.config = {
        apiKey: storedConfig?.apiKey || process.env.REACT_APP_OPENAI_API_KEY || '',
        model: storedConfig?.model || process.env.REACT_APP_OPENAI_MODEL || 'gpt-3.5-turbo',
        baseURL: storedConfig?.baseURL || process.env.REACT_APP_OPENAI_BASE_URL || 'https://api.openai.com/v1'
      };
      
      console.log('OpenAI configuration loaded:', {
        model: this.config.model,
        baseURL: this.config.baseURL,
        hasApiKey: !!this.config.apiKey
      });
    } catch (error) {
      console.error('Error loading OpenAI configuration:', error);
      this.config = null;
    }
  }

  // Update configuration
  public updateConfig(config: Partial<OpenAIConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...config };
    } else {
      this.config = config as OpenAIConfig;
    }
    
    // Save to localStorage
    localStorage.setItem('openai_config', JSON.stringify(this.config));
    console.log('OpenAI configuration updated');
  }

  // Validate configuration
  private validateConfig(): boolean {
    console.log('OpenAI Service: Validating configuration...');
    
    if (!this.config) {
      console.error('OpenAI Service: Configuration is not loaded');
      return false;
    }
    
    console.log('OpenAI Service: Config loaded:', {
      hasApiKey: !!this.config.apiKey,
      apiKeyStart: this.config.apiKey ? this.config.apiKey.substring(0, 10) + '...' : 'none',
      model: this.config.model,
      baseURL: this.config.baseURL
    });
    
    if (!this.config.apiKey || this.config.apiKey === 'sk-proj-your-actual-openai-api-key-here') {
      console.error('OpenAI Service: API key is missing or is placeholder');
      return false;
    }
    
    console.log('OpenAI Service: Configuration validation successful');
    return true;
  }

  // Send a message to OpenAI and get a response
  public async chat(userMessage: string): Promise<string> {
    console.log('OpenAI Service: Starting chat with message:', userMessage);
    
    try {
      // Reload configuration in case it was updated
      this.loadConfig();
      
      // Add user message to the conversation history
      this.messages.push({
        role: 'user',
        content: userMessage
      });
      
      if (!this.validateConfig()) {
        console.log('OpenAI Service: Configuration validation failed, using fallback');
        // Provide a helpful response when API is not configured
        const fallbackResponse = this.generateFallbackResponse(userMessage);
        
        // Add fallback response to conversation history
        this.messages.push({
          role: 'assistant',
          content: fallbackResponse
        });
        
        return fallbackResponse;
      }

      console.log('OpenAI Service: Making API call to OpenAI...');
      // Make API call to OpenAI
      const response = await axios.post(
        `${this.config!.baseURL}/chat/completions`,
        {
          model: this.config!.model,
          messages: this.messages,
          max_tokens: 1000,
          temperature: 0.7,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30 second timeout
        }
      );

      console.log('OpenAI Service: Received response from OpenAI');
      const assistantMessage = response.data.choices[0].message.content;
      
      // Add assistant response to conversation history
      this.messages.push({
        role: 'assistant',
        content: assistantMessage
      });

      return assistantMessage;
    } catch (error: any) {
      console.error('Error calling OpenAI API:', error);
      
      // Generate a helpful error response based on the error type
      let errorResponse = '';
      
      if (error.response?.status === 401) {
        errorResponse = "I'm having trouble with authentication. Please check if your OpenAI API key is correctly configured in the settings.";
      } else if (error.response?.status === 429) {
        errorResponse = "I'm currently experiencing high demand. Please try again in a moment. In the meantime, I can provide general Agile guidance based on best practices.";
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorResponse = "My response is taking longer than expected. Let me provide you with some immediate guidance while we work on the connection.";
      } else {
        errorResponse = "I'm experiencing a technical issue right now, but I can still help with general Scrum and Agile questions using my built-in knowledge.";
      }
      
      // Add a helpful fallback response
      const fallbackResponse = errorResponse + "\\n\\n" + this.generateFallbackResponse(userMessage);
      
      // Add to conversation history
      this.messages.push({
        role: 'assistant',
        content: fallbackResponse
      });
      
      return fallbackResponse;
    }
  }

  // Generate a fallback response based on common Scrum/Agile topics
  private generateFallbackResponse(userMessage: string): string {
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('sprint') && lowerMessage.includes('planning')) {
      return `Here are key Sprint Planning best practices:

📋 **Sprint Planning Essentials:**
• **Duration**: 2-4 hours for a 2-week sprint
• **Participants**: Scrum Team (PO, SM, Developers)
• **Outcomes**: Sprint Goal, Sprint Backlog, Definition of Done

🎯 **Sprint Planning Process:**
1. **Review sprint goal** - What business objective will this sprint achieve?
2. **Select backlog items** - Choose items that align with the sprint goal
3. **Break down work** - Create tasks and estimate effort
4. **Commit to deliverables** - Ensure team confidence in delivery

💡 **Tips for Success:**
• Use team velocity as a guide, not a rule
• Focus on value delivery over task completion
• Ensure stories meet Definition of Ready
• Plan for 70-80% capacity to allow for unexpected work

Would you like me to elaborate on any specific aspect of sprint planning?`;
    }
    
    if (lowerMessage.includes('retrospective') || lowerMessage.includes('retro')) {
      return `Sprint Retrospective Best Practices:

🔄 **Retrospective Structure:**
1. **Set the stage** (5 min) - Welcome and safety check
2. **Gather data** (10 min) - What happened during the sprint?
3. **Generate insights** (20 min) - Why did things happen?
4. **Decide what to do** (15 min) - What will we change?
5. **Close** (5 min) - Summary and appreciation

📊 **Popular Techniques:**
• **Start/Stop/Continue** - Simple and effective
• **Mad/Sad/Glad** - Focus on emotions and team dynamics
• **5 Whys** - Root cause analysis for problems
• **Starfish** - More/Less/Start/Stop/Keep doing

✅ **Key Success Factors:**
• Create psychological safety for honest feedback
• Focus on actionable improvements
• Limit action items to 1-3 per sprint
• Follow up on previous action items

What specific retrospective challenge would you like help with?`;
    }
    
    if (lowerMessage.includes('user stor') || lowerMessage.includes('backlog')) {
      return `User Story Writing Guidelines:

📝 **User Story Format:**
"As a [user type], I want [functionality] so that [benefit/value]"

🎯 **INVEST Criteria:**
• **Independent** - Can be developed in any order
• **Negotiable** - Details can be discussed
• **Valuable** - Provides business value
• **Estimable** - Team can estimate effort
• **Small** - Fits within a sprint
• **Testable** - Clear acceptance criteria

✅ **Acceptance Criteria:**
• Use Given/When/Then format
• Be specific and measurable
• Cover happy path and edge cases
• Include non-functional requirements

📏 **Story Estimation:**
• Use relative sizing (story points)
• Consider complexity, effort, and uncertainty
• Use planning poker for team consensus
• Break down large stories (epics)

Need help with a specific story or backlog challenge?`;
    }
    
    if (lowerMessage.includes('velocity') || lowerMessage.includes('burndown')) {
      return `Key Agile Metrics Explained:

📈 **Velocity**
• **Definition**: Story points completed per sprint
• **Use**: Capacity planning and forecasting
• **Tips**: Track trends, not absolute numbers
• **Range**: Expect 15-25% variation sprint-to-sprint

🔥 **Burndown Charts**
• **Sprint Burndown**: Work remaining vs. time in sprint
• **Release Burndown**: Features remaining vs. sprints
• **Ideal line**: Steady progress toward zero
• **Reality**: Expect some fluctuation

⚡ **Lead Time & Cycle Time**
• **Lead Time**: Customer request → delivery
• **Cycle Time**: Work started → work completed
• **Goal**: Reduce both through process improvement

📊 **Team Health Metrics**
• Sprint goal achievement rate
• Defect escape rate
• Team satisfaction scores
• Retrospective action item completion

Which metric would you like to dive deeper into?`;
    }
    
    if (lowerMessage.includes('standup') || lowerMessage.includes('daily scrum')) {
      return `Daily Scrum Best Practices:

⏰ **Meeting Structure:**
• **Duration**: 15 minutes maximum
• **Time**: Same time daily
• **Participants**: Development team (others can observe)
• **Focus**: Sprint goal progress

🎯 **Three Questions:**
1. What did I accomplish yesterday toward the sprint goal?
2. What will I work on today toward the sprint goal?
3. What obstacles are impeding my progress?

💡 **Success Tips:**
• Stand up to keep energy high
• Focus on work, not individuals
• Identify blockers, resolve them after
• Keep discussions brief and relevant
• Use a board to visualize progress

🚫 **Common Anti-patterns:**
• Turning into status reporting
• Problem-solving during the meeting
• Only talking to the Scrum Master
• Going over time regularly

What specific Daily Scrum challenge can I help you address?`;
    }
    
    // Default response for general questions
    return `I'm here to help with all aspects of Scrum and Agile development! Here are some areas I can assist with:

🎯 **Sprint Management**
• Sprint planning and goal setting
• Sprint review and demonstration
• Sprint retrospectives and improvement

📋 **Product Management**
• User story writing and refinement
• Backlog prioritization
• Acceptance criteria definition

👥 **Team Development**
• Scrum roles and responsibilities
• Team collaboration techniques
• Conflict resolution

📊 **Metrics & Analytics**
• Velocity tracking and forecasting
• Burndown chart interpretation
• Process improvement metrics

🔄 **Process Improvement**
• Retrospective facilitation
• Workflow optimization
• Scaling Agile practices

Feel free to ask me specific questions about any of these topics, or describe a particular challenge your team is facing!`;
  }

  // Clear conversation history
  public clearConversation(): void {
    // Keep only the system message
    this.messages = this.messages.slice(0, 1);
    console.log('Conversation cleared');
  }

  // Get current configuration status
  public getConfigStatus(): { configured: boolean; model?: string } {
    return {
      configured: this.validateConfig(),
      model: this.config?.model
    };
  }

  // Get conversation history (for debugging or export)
  public getConversationHistory(): OpenAIMessage[] {
    return [...this.messages];
  }

  // Generate contextual comment for work items
  public async generateContextualComment(workItem: any): Promise<string | null> {
    try {
      if (!this.validateConfig()) {
        return null;
      }

      // Accept expanded context: member, sprintStats, assignedTasks
      // workItem: { memberName, sprintStats, assignedTasks }
      const { memberName, sprintStats, assignedTasks } = workItem;

      // Build a table of assigned tasks
  let taskTable = 'Assigned Tasks:\nTitle | Priority | Effort | Status\n';
  taskTable += assignedTasks.map((task: any) => `${task.title} | ${task.priority} | ${task.effort}h | ${task.state}`).join('\n');

      // Build expanded prompt
      const contextualPrompt = `Sprint Member: ${memberName}
Sprint Stats:
- Daily Capacity: ${sprintStats.dailyCapacity}h/day
- Daily Burn Rate: ${sprintStats.dailyBurnRate}h/day
- Working Days: ${sprintStats.workingDays}
- Progress: ${sprintStats.progress}%
- Sprint Capacity: ${sprintStats.sprintCapacity}h
- Work Allocated: ${sprintStats.workAllocated}h
- Utilization: ${sprintStats.utilization}%
- At Risk: ${sprintStats.atRisk}
- Expected Progress: ${sprintStats.expectedProgress}%
- Actual Progress: ${sprintStats.actualProgress}%
- Capacity Mismatch: ${sprintStats.capacityMismatch}
- Daily Burn History: ${sprintStats.dailyBurnHistory.join(', ')}
  }
${taskTable}
}
Instruction: The member is over-allocated (>100% utilization). Recommend which tasks should be added or removed to balance capacity and improve sprint success. Prioritize based on task priority and effort. Respond with actionable recommendations.`;

      const response = await axios.post(
        `${this.config!.baseURL}/chat/completions`,
        {
          model: this.config!.model,
          messages: [
            {
              role: 'system',
              content: 'You are an AI assistant helping with Agile project management. Recommend task adjustments for balanced capacity.'
            },
            {
              role: 'user',
              content: contextualPrompt
            }
          ],
          max_tokens: 300,
          temperature: 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config!.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating contextual comment:', error);
      return null;
    }
  }
}
const openAIService = new OpenAIService();
export default openAIService;
