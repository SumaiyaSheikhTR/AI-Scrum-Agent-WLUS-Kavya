/**
 * Teams Notification Service
 * 
 * This service provides functionality for sending notifications to Microsoft Teams:
 * - Direct messages to users
 * - Channel messages
 * - Adaptive cards with interactive elements
 */

// Define interfaces for the service
export interface TeamsNotificationConfig {
  enabled: boolean;
  webhookUrl: string | null;
  useDirectMessages: boolean;
  useChannelMessages: boolean;
  defaultChannel: string | null;
  userMappings: Record<string, string>; // Map from ADO user email to Teams user ID
}

export interface TeamsMessage {
  type: 'direct' | 'channel';
  recipient: string; // Teams user ID for direct messages, channel name for channel messages
  title: string;
  message: string;
  color?: string; // Hex color code for message theme
  buttons?: {
    text: string;
    url: string;
  }[];
}

// Default configuration
const DEFAULT_CONFIG: TeamsNotificationConfig = {
  enabled: false,
  webhookUrl: null,
  useDirectMessages: true,
  useChannelMessages: true,
  defaultChannel: 'General',
  userMappings: {}
};

class TeamsNotificationService {
  private config: TeamsNotificationConfig;

  constructor() {
    // Load config from localStorage or use defaults
    this.config = this.loadConfig() || DEFAULT_CONFIG;
  }

  /**
   * Load configuration from localStorage
   */
  private loadConfig(): TeamsNotificationConfig | null {
    try {
      const configStr = localStorage.getItem('teamsNotificationConfig');
      if (configStr) {
        return JSON.parse(configStr);
      }
      return null;
    } catch (error) {
      console.error('Error loading Teams notification config:', error);
      return null;
    }
  }

  /**
   * Save configuration to localStorage
   */
  private saveConfig(): void {
    try {
      localStorage.setItem('teamsNotificationConfig', JSON.stringify(this.config));
    } catch (error) {
      console.error('Error saving Teams notification config:', error);
    }
  }

  /**
   * Update the configuration
   * @param config New configuration
   */
  updateConfig(config: Partial<TeamsNotificationConfig>): void {
    // Update config
    this.config = { ...this.config, ...config };
    
    // Save to localStorage
    this.saveConfig();
  }

  /**
   * Get the current configuration
   */
  getConfig(): TeamsNotificationConfig {
    return { ...this.config };
  }

  /**
   * Send a notification to Microsoft Teams
   * @param message The message to send
   * @returns Promise with success status
   */
  async sendNotification(message: TeamsMessage): Promise<boolean> {
    if (!this.config.enabled) {
      console.log('Teams notifications are disabled. Skipping notification.');
      return false;
    }

    if (!this.config.webhookUrl) {
      console.error('Teams webhook URL is not configured.');
      return false;
    }

    try {
      // For direct messages, check if we have a mapping for the recipient
      if (message.type === 'direct') {
        const teamsUserId = this.config.userMappings[message.recipient];
        if (!teamsUserId) {
          console.warn(`No Teams user mapping found for ${message.recipient}. Falling back to default channel.`);
          message.type = 'channel';
          message.recipient = this.config.defaultChannel || 'General';
        } else {
          message.recipient = teamsUserId;
        }
      }

      // In a real implementation, we would use the Microsoft Graph API or Teams webhook
      // to send the message. For now, we'll just log it.
      console.log(`[TEAMS NOTIFICATION] ${message.type.toUpperCase()} to ${message.recipient}: ${message.title}`);
      console.log(`Message: ${message.message}`);
      
      if (message.buttons && message.buttons.length > 0) {
        console.log('Buttons:');
        message.buttons.forEach(button => {
          console.log(`- ${button.text}: ${button.url}`);
        });
      }

      // Simulate API call to Teams webhook
      // In a real implementation, we would use fetch or axios to send the request
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

      return true;
    } catch (error) {
      console.error('Error sending Teams notification:', error);
      return false;
    }
  }

  /**
   * Send a direct message to a user
   * @param userEmail The user's email address
   * @param title The message title
   * @param message The message content
   * @param buttons Optional buttons to include
   * @returns Promise with success status
   */
  async sendDirectMessage(
    userEmail: string,
    title: string,
    message: string,
    buttons?: { text: string; url: string }[]
  ): Promise<boolean> {
    return this.sendNotification({
      type: 'direct',
      recipient: userEmail,
      title,
      message,
      color: '#0078d4', // Microsoft blue
      buttons
    });
  }

  /**
   * Send a message to a channel
   * @param channel The channel name
   * @param title The message title
   * @param message The message content
   * @param buttons Optional buttons to include
   * @returns Promise with success status
   */
  async sendChannelMessage(
    channel: string | null,
    title: string,
    message: string,
    buttons?: { text: string; url: string }[]
  ): Promise<boolean> {
    return this.sendNotification({
      type: 'channel',
      recipient: channel || this.config.defaultChannel || 'General',
      title,
      message,
      color: '#0078d4', // Microsoft blue
      buttons
    });
  }

  /**
   * Send a work item reminder to a user
   * @param userEmail The user's email address
   * @param workItemId The work item ID
   * @param workItemTitle The work item title
   * @param message The reminder message
   * @returns Promise with success status
   */
  async sendWorkItemReminder(
    userEmail: string,
    workItemId: number,
    workItemTitle: string,
    message: string
  ): Promise<boolean> {
    const title = `Reminder: Work Item #${workItemId}`;
    const fullMessage = `**${workItemTitle}**\n\n${message}`;
    
    // Add a button to view the work item
    const buttons = [
      {
        text: 'View Work Item',
        url: `https://dev.azure.com/your-org/your-project/_workitems/edit/${workItemId}`
      }
    ];
    
    return this.sendDirectMessage(userEmail, title, fullMessage, buttons);
  }

  /**
   * Send a stale work item notification to a user
   * @param userEmail The user's email address
   * @param workItemId The work item ID
   * @param workItemTitle The work item title
   * @param daysSinceUpdate Days since the work item was last updated
   * @returns Promise with success status
   */
  async sendStaleWorkItemNotification(
    userEmail: string,
    workItemId: number,
    workItemTitle: string,
    daysSinceUpdate: number
  ): Promise<boolean> {
    const title = `Stale Work Item: #${workItemId}`;
    const message = `Your work item **${workItemTitle}** has not been updated in ${daysSinceUpdate} days. Please provide a status update or move it to the appropriate state.`;
    
    // Add buttons to view the work item and update its status
    const buttons = [
      {
        text: 'View Work Item',
        url: `https://dev.azure.com/your-org/your-project/_workitems/edit/${workItemId}`
      },
      {
        text: 'Mark as Completed',
        url: `https://dev.azure.com/your-org/your-project/_workitems/edit/${workItemId}?action=complete`
      }
    ];
    
    return this.sendDirectMessage(userEmail, title, message, buttons);
  }
}

// Export a singleton instance
export const teamsNotificationService = new TeamsNotificationService();

export default teamsNotificationService;
