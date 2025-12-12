import axios from 'axios';
import adoService from './adoService';

/**
 * Service for interacting with the OpenArena AI service
 */
class OpenArenaService {
  private apiUrl: string;
  private workflowId: string;
  private isPersistenceAllowed: boolean;

  constructor() {
    this.apiUrl = process.env.REACT_APP_OPENARENA_API_URL || 'http://localhost:3001/api/openarena';
    this.workflowId = process.env.REACT_APP_OPENARENA_WORKFLOW_ID || '2db16fb7-64d1-4d44-b250-8cb95fced357';
    this.isPersistenceAllowed = process.env.REACT_APP_OPENARENA_PERSISTENCE_ALLOWED === 'true';
    
    // Load config from localStorage if available
    this.loadConfigFromStorage();
  }
  
  /**
   * Load configuration from localStorage
   */
  private loadConfigFromStorage(): void {
    try {
      const configStr = localStorage.getItem('openArenaConfig');
      if (configStr) {
        const config = JSON.parse(configStr);
        this.apiUrl = config.apiUrl || this.apiUrl;
        this.workflowId = config.workflowId || this.workflowId;
        this.isPersistenceAllowed = config.isPersistenceAllowed !== undefined 
          ? config.isPersistenceAllowed 
          : this.isPersistenceAllowed;
      }
    } catch (error) {
      console.error('Error loading OpenArena config from storage:', error);
    }
  }
  
  /**
   * Update the service configuration
   * @param config The new configuration
   */
  updateConfig(config: any): void {
    this.apiUrl = config.apiUrl || this.apiUrl;
    this.workflowId = config.workflowId || this.workflowId;
    this.isPersistenceAllowed = config.isPersistenceAllowed !== undefined 
      ? config.isPersistenceAllowed 
      : this.isPersistenceAllowed;
      
    // Save to localStorage
    try {
      localStorage.setItem('openArenaConfig', JSON.stringify(config));
    } catch (error) {
      console.error('Error saving OpenArena config to storage:', error);
      throw new Error('Failed to save OpenArena configuration');
    }
  }

  /**
   * Send a chat message to the OpenArena service
   * @param query The user's query
   * @returns Promise with the AI response
   */
  async chat(query: string): Promise<string> {
    try {
      // Limit query length to prevent 431 errors
      const maxQueryLength = 4000;
      let processedQuery = query;
      
      if (query.length > maxQueryLength) {
        console.warn(`Query length (${query.length}) exceeds maximum (${maxQueryLength}). Truncating.`);
        processedQuery = query.substring(0, maxQueryLength);
      }
      
      // Check if ADO is configured and the query is about work items or sprints
      const isAdoConfigured = adoService.loadConfig();
      const isSprintRelated = /sprint|work item|task|user story|backlog|ado|azure devops/i.test(processedQuery);
      
      // If ADO is configured and the query is sprint-related, enhance with ADO context
      if (isAdoConfigured && isSprintRelated && !processedQuery.includes('[Context:')) {
        try {
          // Get current sprint info
          const currentSprint = await adoService.getCurrentSprint();
          
          if (currentSprint) {
            // Get sprint statistics
            const sprintStats = await adoService.getSprintStatistics(currentSprint.id);
            
            // Get duplicate work items
            const duplicateItems = await adoService.findDuplicateWorkItems(currentSprint.id);
            
            // Build context string
            let contextStr = `[ADO Context: Current sprint is "${currentSprint.name}" from ${new Date(currentSprint.startDate).toLocaleDateString()} to ${new Date(currentSprint.endDate).toLocaleDateString()}. `;
            
            contextStr += `Sprint has ${sprintStats.totalWorkItems} total work items, ${sprintStats.completedWorkItems} completed, ${sprintStats.inProgressWorkItems} in progress, and ${sprintStats.blockedWorkItems} blocked. `;
            
            if (duplicateItems.length > 0) {
              contextStr += `There are ${duplicateItems.length} groups of potential duplicate work items. `;
            }
            
            contextStr += 'Use this context to provide more accurate responses.] ';
            
            // Add context to the query
            processedQuery = contextStr + processedQuery;
          }
        } catch (error) {
          console.error('Error enhancing query with ADO context:', error);
        }
      }
      
      const response = await axios.post(this.apiUrl, {
        query: processedQuery,
        workflow_id: this.workflowId,
        is_persistence_allowed: this.isPersistenceAllowed
      });

      return response.data.answer;
    } catch (error) {
      console.error('Error querying OpenArena:', error);
      throw new Error('Failed to communicate with AI service');
    }
  }

  /**
   * Send a query specifically about work items
   * @param workItemIds Array of work item IDs to query about
   * @param context Additional context about the work items
   * @returns Promise with the AI analysis
   */
  async analyzeWorkItems(workItemIds: number[], context?: string): Promise<string> {
    const workItemsStr = workItemIds.join(', ');
    const query = `Analyze the following work items: ${workItemsStr}. ${context || ''}`;
    
    return this.chat(query);
  }

  /**
   * Generate a daily sprint summary
   * @param sprintName The name of the sprint
   * @param completedItems Number of completed items
   * @param inProgressItems Number of in-progress items
   * @param blockedItems Number of blocked items
   * @returns Promise with the AI-generated summary
   */
  async generateSprintSummary(
    sprintName: string,
    completedItems: number,
    inProgressItems: number,
    blockedItems: number
  ): Promise<string> {
    const query = `Generate a daily summary for sprint "${sprintName}" with ${completedItems} completed items, ${inProgressItems} in-progress items, and ${blockedItems} blocked items.`;
    
    return this.chat(query);
  }

  /**
   * Analyze developer sentiment and engagement
   * @param developerData Data about developer activity and comments
   * @returns Promise with the AI analysis
   */
  async analyzeDeveloperEngagement(developerData: string): Promise<string> {
    const query = `Analyze the following developer engagement data and provide insights: ${developerData}`;
    
    return this.chat(query);
  }

  /**
   * Generate suggestions for work item updates
   * @param workItemData Data about work items that might need updates
   * @returns Promise with AI-generated suggestions
   */
  async generateWorkItemSuggestions(workItemData: string): Promise<string> {
    const query = `Based on the following work item data, suggest updates or actions: ${workItemData}`;
    
    return this.chat(query);
  }
}

// Create and export a singleton instance
const openArenaService = new OpenArenaService();
export default openArenaService;
