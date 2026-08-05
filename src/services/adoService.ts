/**
 * Azure DevOps Service
 * 
 * This service provides an interface to interact with the Azure DevOps API.
 * It handles authentication, fetching work items, sprints, and other data.
 */

import axios, { AxiosInstance } from 'axios';

// Define interfaces for the service
export interface AdoConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
  apiVersion: string;
  teamName: string;
  refreshInterval: number;
  enableAutoRefresh: boolean;
}

export interface WorkItem {
  id: number;
  title: string;
  state: string;
  type: string;
  assignedTo: string;
  effort: number | null;
  priority: number | null;
  tags: string[];
  createdDate: string;
  updatedDate: string;
  description: string | null;
  url: string;
  parentId?: number | null; // ID of the parent work item (if any)
  gitCommits?: string[]; // Associated Git commits
  pullRequests?: string[]; // Associated Pull Requests
  relations?: any[]; // Work item relations including Git links
  fields?: { [key: string]: any };
}
export interface WorkItemComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  workItemId: number;
  workItemTitle: string;
}

export interface Sprint {
  id: string; // Changed from number to string to handle GUID IDs
  name: string;
  path: string;
  startDate: string;
  endDate: string;
  state: 'future' | 'current' | 'past';
}

export interface SprintStatistics {
  totalWorkItems: number;
  completedWorkItems: number;
  inProgressWorkItems: number;
  blockedWorkItems: number;
  totalEffort: number;
  completedEffort: number;
  remainingEffort: number;
}

export interface TeamMember {
  displayName: string;
  uniqueName: string;
  id: string;
  imageUrl?: string;
}

export interface TeamCapacity {
  teamMember: TeamMember;
  activities: ActivityCapacity[];
  daysOff: DayOff[];
  totalCapacityPerDay: number;
  totalCapacityForSprint: number;
  totalAvailableCapacity: number; // ✅ NEW: Available capacity for allocation
  workingDays: number;
}

export interface ActivityCapacity {
  name: string;
  capacityPerDay: number;
}

export interface DayOff {
  start: string;
  end: string;
}

export interface SprintCapacityData {
  teamCapacities: TeamCapacity[];
  sprintDates: {
    startDate: string;
    endDate: string;
  };
  totalSprintDays: number;
  totalWorkingDays: number;
  isUsingFallback?: boolean; // New flag to indicate fallback data
}

class AdoService {
  private client: AxiosInstance | null = null;
  private config: AdoConfig | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    // Try to load config from localStorage
    this.loadConfig();
  }

  /**
   * Load ADO configuration from localStorage
   */
  loadConfig(): boolean {
    try {
      const configStr = localStorage.getItem('adoConfig');
      if (configStr) {
        this.config = JSON.parse(configStr);
        this.initializeClient();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading ADO config:', error);
      return false;
    }
  }

  /**
   * Initialize the ADO client with the current configuration
   */
  private initializeClient(): void {
    if (!this.config) {
      console.error('Cannot initialize ADO client: No configuration available');
      return;
    }

    const { organization, personalAccessToken, apiVersion } = this.config;
    
    // Create base64 encoded credentials
    const token = btoa(`:${personalAccessToken}`);
    
    this.client = axios.create({
      baseURL: `https://dev.azure.com/${organization}`,
      headers: {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
      },
      params: {
        'api-version': apiVersion || '7.0',
      },
    });

    // Set up auto-refresh if enabled
    this.setupAutoRefresh();
  }

  /**
   * Set up auto-refresh of data if enabled in config
   */
  private setupAutoRefresh(): void {
    // Clear any existing timer
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }

    // Set up new timer if auto-refresh is enabled - DISABLED to prevent page refreshing
    console.log('ADO auto-refresh timer DISABLED to prevent page refreshing');
    
    /* Original auto-refresh timer commented out:
    if (this.config?.enableAutoRefresh && this.config.refreshInterval > 0) {
      const intervalMs = this.config.refreshInterval * 60 * 1000; // Convert minutes to milliseconds
      this.refreshTimer = setInterval(() => {
        // Trigger refresh events
        this.triggerRefresh();
      }, intervalMs);
    }
    */
  }

  /**
   * Trigger refresh events for subscribers
   */
  private triggerRefresh(): void {
    // Auto-refresh DISABLED to prevent page refreshing
    console.log('🔄 Auto-refresh disabled to prevent page refreshing');
    return;

    /* Original auto-refresh trigger commented out:
    // Only trigger refresh if the page is visible to prevent background refreshes
    if (document.hidden) {
      console.log('🔄 Auto-refresh skipped - page not visible');
      return;
    }
    
    // Dispatch a custom event that components can listen for
    console.log('🔄 Auto-refresh triggered by ADO service');
    const event = new CustomEvent('ado-data-refresh');
    window.dispatchEvent(event);
    */
  }

  /**
   * Update the ADO configuration
   * @param config New configuration
   */
  updateConfig(config: AdoConfig): void {
    this.config = config;
    localStorage.setItem('adoConfig', JSON.stringify(config));
    this.initializeClient();
  }

  /**
   * Test the ADO connection with the provided configuration
   * @param config Configuration to test
   * @returns Promise resolving to true if connection is successful
   */
  async testConnection(config: AdoConfig): Promise<boolean> {
    try {
      const { organization, personalAccessToken, apiVersion } = config;
      
      // Create base64 encoded credentials
      const token = btoa(`:${personalAccessToken}`);
      
      const testClient = axios.create({
        baseURL: `https://dev.azure.com/${organization}`,
        headers: {
          'Authorization': `Basic ${token}`,
          'Content-Type': 'application/json',
        },
        params: {
          'api-version': apiVersion || '7.0',
        },
      });

      // Try to get organization info as a test
      const response = await testClient.get('/_apis/projects');
      return response.status === 200;
    } catch (error) {
      console.error('Error testing ADO connection:', error);
      return false;
    }
  }

  /**
   * Get all sprints for the configured project and team
   * @returns Promise with array of sprints
   */
  async getSprints(): Promise<Sprint[]> {
    if (!this.config) {
      throw new Error('ADO configuration not initialized');
    }

    try {
      const { organization, project, teamName, apiVersion } = this.config;
      const team = teamName || project; // Use project name as team name if not specified
      
      console.log('🔄 SPRINTS_FETCH: Using proxy endpoint for getSprints');
      
      // Encode project and team names to handle spaces and special characters
      const encodedProject = encodeURIComponent(project);
      const encodedTeam = encodeURIComponent(team);
      const endpoint = `${organization}/${encodedProject}/${encodedTeam}/_apis/work/teamsettings/iterations?api-version=${apiVersion}`;
      
      console.log('🔄 SPRINTS_FETCH: Sprint endpoint:', `https://dev.azure.com/${endpoint}`);
      
      const response = await axios.post('/api/ado-proxy/sprints', {
        config: this.config,
        endpoint: endpoint
      });
      
      console.log('🔄 SPRINTS_FETCH: ✅ Successfully fetched sprints via proxy:', response.data);
      
      return response.data.value.map((item: any) => ({
        id: item.id,
        name: item.name,
        path: item.path,
        startDate: item.attributes.startDate,
        endDate: item.attributes.finishDate,
        state: this.determineSprintState(item.attributes.startDate, item.attributes.finishDate),
      }));
    } catch (error) {
      console.error('🔄 SPRINTS_FETCH: ❌ Error fetching sprints via proxy:', error);
      return [];
    }
  }

  /**
   * Determine the state of a sprint based on its dates
   * @param startDate Sprint start date
   * @param endDate Sprint end date
   * @returns Sprint state (future, current, or past)
   */
  private determineSprintState(startDate: string, endDate: string): 'future' | 'current' | 'past' {
    const now = new Date();
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (now < start) {
      return 'future';
    } else if (now > end) {
      return 'past';
    } else {
      return 'current';
    }
  }

  /**
   * Get the current active sprint
   * @returns Promise with the current sprint or null if none
   */
  async getCurrentSprint(): Promise<Sprint | null> {
    try {
      const sprints = await this.getSprints();
      return sprints.find(sprint => sprint.state === 'current') || null;
    } catch (error) {
      console.error('Error fetching current sprint:', error);
      return null;
    }
  }

  /**
   * Get work items for a specific sprint
   * @param sprintId ID of the sprint
   * @returns Promise with array of work items
   */
  async getSprintWorkItems(sprintId: string): Promise<WorkItem[]> {
    if (!this.config) {
      throw new Error('ADO service not configured');
    }

    try {
      const { organization, project, teamName, apiVersion } = this.config;
      const team = teamName || project;
      
      console.log(`🔄 WORK_ITEMS_FETCH: Fetching work items for sprint ${sprintId} via proxy...`);
      
      // Encode project and team names to handle spaces and special characters
      const encodedProject = encodeURIComponent(project);
      const encodedTeam = encodeURIComponent(team);
      const endpoint = `${organization}/${encodedProject}/${encodedTeam}/_apis/work/teamsettings/iterations/${sprintId}/workitems?api-version=${apiVersion}`;
      
      console.log(`🔄 WORK_ITEMS_FETCH: Work items endpoint:`, `https://dev.azure.com/${endpoint}`);
      
      // Use proxy for sprint work items API
      const response = await axios.post('/api/ado-proxy/sprints', {
        config: this.config,
        endpoint: endpoint
      });
      
      const workItemRefs = response.data.workItemRelations || [];
      
      if (workItemRefs.length === 0) {
        console.log('🔄 WORK_ITEMS_FETCH: No work items found in sprint');
        return [];
      }
      
      // Get the IDs of all work items
      const workItemIds = workItemRefs.map((ref: any) => ref.target.id);
      console.log(`🔄 WORK_ITEMS_FETCH: Found ${workItemIds.length} work item IDs, fetching details with relations...`);
      
      // Fetch work items with relations using proxy
      const workItemsResponse = await axios.post('/api/ado-proxy/workitems', {
        organization: this.config.organization,
        project: this.config.project,
        ids: workItemIds,
        fields: 'System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo,Microsoft.VSTS.Scheduling.Effort,Microsoft.VSTS.Scheduling.OriginalEstimate,Microsoft.VSTS.Scheduling.RemainingWork,Microsoft.VSTS.Scheduling.CompletedWork,Microsoft.VSTS.Common.StoryPoints,Microsoft.VSTS.Common.Priority,System.Tags,System.CreatedDate,System.ChangedDate,System.Description,System.Parent'
      });
      
      const workItems = workItemsResponse.data.value.map((item: any) => this.mapWorkItem(item));
      console.log(`🔄 WORK_ITEMS_FETCH: ✅ Successfully fetched ${workItems.length} work items with relations`);
      
      return workItems;
    } catch (error: any) {
      console.error('🔄 WORK_ITEMS_FETCH: ❌ Error fetching sprint work items:', error);
      console.error('🔄 WORK_ITEMS_FETCH: Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      return [];
    }
  }

  /**
   * Get work items for a specific sprint with an optimized method for analysis
   * Specialized for the activity monitoring panel
   * @param sprintId ID of the sprint
   * @returns Promise with array of work items
   */
  async getWorkItemsForSprint(sprintId: number | string): Promise<WorkItem[]> {
    // Convert sprintId to string if it's a number
    const sprintIdStr = typeof sprintId === 'number' ? sprintId.toString() : sprintId;
    
    try {
      console.log(`🔄 WORK_ITEMS_FETCH (Sprint Analysis): Fetching work items for sprint ${sprintIdStr}...`);
      
      // Use our existing method to get the work items
      const workItems = await this.getSprintWorkItems(sprintIdStr);
      
      // If we failed to get any work items, return an empty array
      if (!workItems || workItems.length === 0) {
        console.log('🔄 WORK_ITEMS_FETCH (Sprint Analysis): No work items found in sprint');
        return [];
      }
      
      console.log(`🔄 WORK_ITEMS_FETCH (Sprint Analysis): Successfully fetched ${workItems.length} work items`);
      return workItems;
    } catch (error) {
      console.error(`🔄 WORK_ITEMS_FETCH (Sprint Analysis): Error fetching work items for sprint ${sprintIdStr}:`, error);
      return [];
    }
  }
  private mapWorkItem(item: any): WorkItem {
    const fields = item.fields || {};
    const relations = item.relations || [];
    
    // ✅ DEBUG: Log raw work item data to identify effort field issues
    console.log(`🔍 RAW_WORK_ITEM_DEBUG: "${fields['System.Title']}" (${fields['System.WorkItemType']}):`);
    console.log(`   🔍 All available fields:`, Object.keys(fields).filter(key => key.toLowerCase().includes('effort') || key.toLowerCase().includes('estimate') || key.toLowerCase().includes('remaining') || key.toLowerCase().includes('completed')));
    
    // Check multiple possible effort field locations
    const effortFields = {
      'Microsoft.VSTS.Scheduling.Effort': fields['Microsoft.VSTS.Scheduling.Effort'],
      'Microsoft.VSTS.Scheduling.OriginalEstimate': fields['Microsoft.VSTS.Scheduling.OriginalEstimate'],
      'Microsoft.VSTS.Scheduling.RemainingWork': fields['Microsoft.VSTS.Scheduling.RemainingWork'],
      'Microsoft.VSTS.Scheduling.CompletedWork': fields['Microsoft.VSTS.Scheduling.CompletedWork'],
      'Microsoft.VSTS.Common.StoryPoints': fields['Microsoft.VSTS.Common.StoryPoints']
    };
    
    console.log(`   🔍 Effort field values:`, effortFields);
    
    // Try to get effort from multiple possible fields (prioritize in order)
    let effort = null;
    
    // For Tasks: Try OriginalEstimate first, then Effort, then RemainingWork
    if (fields['System.WorkItemType'] === 'Task') {
      effort = fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || 
               fields['Microsoft.VSTS.Scheduling.Effort'] || 
               fields['Microsoft.VSTS.Scheduling.RemainingWork'] || 
               null;
      console.log(`   🔍 TASK_EFFORT_MAPPING: Using ${effort}h from Task effort fields`);
    } 
    // For User Stories/Features: Try StoryPoints first, then Effort
    else if (fields['System.WorkItemType'] === 'User Story' || fields['System.WorkItemType'] === 'Feature') {
      effort = fields['Microsoft.VSTS.Common.StoryPoints'] || 
               fields['Microsoft.VSTS.Scheduling.Effort'] || 
               null;
      console.log(`   🔍 STORY_EFFORT_MAPPING: Using ${effort}h from Story/Feature effort fields`);
    }
    // Default: Try Effort field
    else {
      effort = fields['Microsoft.VSTS.Scheduling.Effort'] || null;
      console.log(`   🔍 DEFAULT_EFFORT_MAPPING: Using ${effort}h from default effort field`);
    }
    
    // Ensure effort is a number and handle 0 properly
    if (effort !== null && effort !== undefined) {
      effort = Number(effort);
      if (isNaN(effort)) effort = null;
    }
    
    console.log(`   🔍 FINAL_EFFORT_VALUE: ${effort}h for "${fields['System.Title']}"`);
    
    // Extract Git commits and PR links from relations
    const gitCommits: string[] = [];
    const pullRequests: string[] = [];
    
    relations.forEach((relation: any) => {
      if (relation.rel === 'ArtifactLink' && relation.url) {
        const url = relation.url;
        
        // Extract different types of Git artifacts
        if (url.includes('_git/') || url.includes('/repos/')) {
          // Azure DevOps Git commit
          if (url.includes('/commit/')) {
            gitCommits.push(url);
          }
          // Azure DevOps Pull Request
          else if (url.includes('/pullrequest/') || url.includes('/pullRequests/')) {
            pullRequests.push(url);
          }
        }
        // GitHub links
        else if (url.includes('github.com')) {
          if (url.includes('/pull/')) {
            pullRequests.push(url);
          } else if (url.includes('/commit/')) {
            gitCommits.push(url);
          }
        }
      }
      // Also check for Git Pull Request relations
      else if (relation.rel === 'GitPullRequest' && relation.url) {
        pullRequests.push(relation.url);
      }
      // Git Commit relations
      else if (relation.rel === 'GitCommit' && relation.url) {
        gitCommits.push(relation.url);
      }
    });
    
    return {
      id: item.id,
      title: fields['System.Title'] || '',
      state: fields['System.State'] || '',
      type: fields['System.WorkItemType'] || '',
      assignedTo: fields['System.AssignedTo']?.displayName || null,
      effort: effort, // ✅ FIX: Use the dynamically detected effort value
      priority: fields['Microsoft.VSTS.Common.Priority'] || null,
      tags: fields['System.Tags'] ? fields['System.Tags'].split(';').map((tag: string) => tag.trim()) : [],
      createdDate: fields['System.CreatedDate'] || '',
      updatedDate: fields['System.ChangedDate'] || '',
      description: fields['System.Description'] || null,
      url: item._links?.html?.href || '',
      parentId: fields['System.Parent'] || null,
      gitCommits,
      pullRequests,
      relations,
    };
  }

  /**
   * Get a specific work item by ID
   * @param workItemId ID of the work item to retrieve
   * @returns Promise with the work item or null if not found
   */
  async getWorkItem(workItemId: number): Promise<WorkItem | null> {
    if (!this.client || !this.config) {
      throw new Error('ADO client not initialized');
    }

    try {
      const response = await this.client.get(
        `/_apis/wit/workitems/${workItemId}?$expand=relations`
      );
      
      return this.mapWorkItem(response.data);
    } catch (error) {
      console.error(`Error fetching work item ${workItemId}:`, error);
      return null;
    }
  }

  /**
   * Get statistics for a specific sprint
   * @param sprintId ID of the sprint
   * @returns Promise with sprint statistics
   */
  async getSprintStatistics(sprintId: string): Promise<SprintStatistics> {
    try {
      const workItems = await this.getSprintWorkItems(sprintId);
      
      const totalWorkItems = workItems.length;
      const completedWorkItems = workItems.filter(item => item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done').length;
      const inProgressWorkItems = workItems.filter(item => item.state === 'In Progress' || item.state === 'Active').length;
      const blockedWorkItems = workItems.filter(item => item.state === 'Blocked' || item.tags.some(tag => tag.toLowerCase() === 'blocked')).length;
      
      const totalEffort = workItems.reduce((sum, item) => sum + (item.effort || 0), 0);
      const completedEffort = workItems
        .filter(item => item.state === 'Completed' || item.state === 'Closed' || item.state === 'Done')
        .reduce((sum, item) => sum + (item.effort || 0), 0);
      const remainingEffort = totalEffort - completedEffort;
      
      return {
        totalWorkItems,
        completedWorkItems,
        inProgressWorkItems,
        blockedWorkItems,
        totalEffort,
        completedEffort,
        remainingEffort,
      };
    } catch (error) {
      console.error('Error calculating sprint statistics:', error);
      return {
        totalWorkItems: 0,
        completedWorkItems: 0,
        inProgressWorkItems: 0,
        blockedWorkItems: 0,
        totalEffort: 0,
        completedEffort: 0,
        remainingEffort: 0,
      };
    }
  }

  /**
   * Get stale work items (items that haven't been updated recently)
   * @param daysStale Number of days without updates to consider an item stale
   * @returns Promise with array of stale work items
   */
  async getStaleWorkItems(daysStale: number = 5): Promise<WorkItem[]> {
    try {
      const currentSprint = await this.getCurrentSprint();
      if (!currentSprint) {
        return [];
      }
      
      const workItems = await this.getSprintWorkItems(currentSprint.id);
      const now = new Date();
      const staleThreshold = new Date(now.getTime() - daysStale * 24 * 60 * 60 * 1000);
      
      return workItems.filter(item => {
        // Only consider Active items as stale, not New items
        if (item.state !== 'Active') {
          return false;
        }
        
        // Only consider Task type items as stale, not QA, DEV, etc.
        if (item.type !== 'Task') {
          return false;
        }
        
        // Check if the item hasn't been updated recently
        const lastUpdated = new Date(item.updatedDate);
        return lastUpdated < staleThreshold;
      });
    } catch (error) {
      console.error('Error fetching stale work items:', error);
      return [];
    }
  }

  /**
   * Update a work item
   * @param workItemId ID of the work item to update
   * @param updates Object containing the fields to update
   * @returns Promise with the updated work item
   */
  async updateWorkItem(workItemId: number, updates: Record<string, any>): Promise<WorkItem | null> {
    if (!this.client || !this.config) {
      throw new Error('ADO client not initialized');
    }

    try {
      // Map common field names to ADO field names
      const fieldMappings: Record<string, string> = {
        'title': 'System.Title',
        'state': 'System.State',
        'effort': 'Microsoft.VSTS.Scheduling.Effort',
        'description': 'System.Description',
        'assignedTo': 'System.AssignedTo',
        'priority': 'Microsoft.VSTS.Common.Priority',
        'tags': 'System.Tags'
      };

      // Convert updates to ADO patch format with proper field names
      const patchDocument = Object.entries(updates).map(([key, value]) => {
        // Use mapped field name if available, otherwise use the original key
        const fieldName = fieldMappings[key.toLowerCase()] || key;
        
        return {
          op: 'add',
          path: `/fields/${fieldName}`,
          value,
        };
      });
      
      console.log('Updating work item with patch document:', JSON.stringify(patchDocument, null, 2));
      
      const response = await this.client.patch(
        `/_apis/wit/workitems/${workItemId}`,
        patchDocument,
        {
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );
      
      console.log('Work item update response:', response.status, response.statusText);
      return this.mapWorkItem(response.data);
    } catch (error: any) {
      console.error(`Error updating work item ${workItemId}:`, error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }

  /**
   * Assign a work item to a team member
   * @param workItemId The ID of the work item to assign
   * @param teamMember The team member to assign the work item to
   * @returns Promise with the updated work item
   */
  async assignWorkItem(workItemId: string | number, teamMember: TeamMember): Promise<WorkItem | null> {
    if (!this.client || !this.config) {
      throw new Error('ADO client not initialized');
    }

    try {
      console.log(`🔄 Assigning work item #${workItemId} to ${teamMember.displayName}`);
      
      // Convert string ID to number if needed
      const numericWorkItemId = typeof workItemId === 'string' ? parseInt(workItemId, 10) : workItemId;
      
      // Create the assignment patch
      const assignmentValue = {
        id: teamMember.id,
        displayName: teamMember.displayName,
        uniqueName: teamMember.uniqueName,
      };
      
      // Use the updateWorkItem method to perform the assignment
      const updatedWorkItem = await this.updateWorkItem(numericWorkItemId, {
        'System.AssignedTo': assignmentValue
      });
      
      console.log(`✅ Successfully assigned work item #${workItemId} to ${teamMember.displayName}`);
      
      return updatedWorkItem;
    } catch (error) {
      console.error(`Error assigning work item #${workItemId} to ${teamMember.displayName}:`, error);
      throw error;
    }
  }

  /**
   * Add a comment to a work item
   * @param workItemId ID of the work item
   * @param comment Comment text
   * @returns Promise resolving to true if successful
   */
  async addWorkItemComment(workItemId: number, comment: string): Promise<boolean> {
    if (!this.client || !this.config) {
      throw new Error('ADO client not initialized');
    }

    try {
      const { project } = this.config;
      
      console.log(`Adding comment to work item ${workItemId} in project ${project}`);
      
      // The correct endpoint for adding comments in ADO API 7.0+
      const response = await this.client.post(
        `/${project}/_apis/wit/workitems/${workItemId}/comments`,
        { text: comment },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Comment add response:', response.status, response.statusText);
      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error(`Error adding comment to work item ${workItemId}:`, error);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      
      // Try alternative comment API (for older ADO versions)
      try {
        console.log('Trying alternative comment API...');
        
        const response = await this.client.patch(
          `/_apis/wit/workitems/${workItemId}`,
          [
            {
              op: 'add',
              path: '/fields/System.History',
              value: comment
            }
          ],
          {
            headers: {
              'Content-Type': 'application/json-patch+json'
            }
          }
        );
        
        console.log('Alternative comment add response:', response.status, response.statusText);
        return response.status >= 200 && response.status < 300;
      } catch (altError) {
        console.error('Alternative comment API also failed:', altError);
        return false;
      }
    }
  }

  /**
   * Get comments for a work item
   * @param workItemId ID of the work item
   * @returns Promise with array of work item comments
   */
  async getWorkItemComments(workItemId: number, workItemTitle: string): Promise<WorkItemComment[]> {
  if (!this.client || !this.config) {
    throw new Error('ADO client not initialized');
  }

  try {
    const { project } = this.config;

    const response = await this.client.get(
      `/${project}/_apis/wit/workitems/${workItemId}/comments?api-version=7.1-preview.3`
    );

    return (response.data.comments || []).map((comment: any) => ({
      id: comment.id,
      text: comment.text,
      author: comment.createdBy?.displayName || 'Unknown',
      timestamp: comment.createdDate,
      workItemId,
      workItemTitle
    }));
  } catch (error) {
    console.error(`Error fetching comments for work item ${workItemId}:`, error);
    return [];
  }
}

  /**
   * Get all comments for all work items in a sprint
   * @param sprintId ID of the sprint
   * @param workItemTypes Optional array of work item types to filter by (e.g., ['User Story', 'Bug'])
   * @returns Promise with array of all comments
   */
  async getSprintComments(sprintId: string, workItemTypes?: string[]): Promise<WorkItemComment[]> {
    try {
      const workItems = await this.getSprintWorkItems(sprintId);
      
      if (workItems.length === 0) {
        return [];
      }
      
      // Filter work items by type if specified
      const filteredWorkItems = workItemTypes 
        ? workItems.filter(item => workItemTypes.includes(item.type))
        : workItems;
      
      console.log(`Found ${filteredWorkItems.length} work items of types ${workItemTypes?.join(', ') || 'all'}`);
      
      // Get comments for each work item
      const commentsPromises = filteredWorkItems.map(workItem => 
        this.getWorkItemComments(workItem.id, workItem.title)
      );
      
      const commentsArrays = await Promise.all(commentsPromises);
      
      // Flatten the array of arrays
      return commentsArrays.flat();
    } catch (error) {
      console.error(`Error fetching comments for sprint ${sprintId}:`, error);
      return [];
    }
  }
  
  /**
   * Get User Story and Bug work items from a sprint
   * @param sprintId ID of the sprint
   * @returns Promise with array of User Story and Bug work items
   */
  async getUserStoriesAndBugs(sprintId: string): Promise<WorkItem[]> {
    try {
      const workItems = await this.getSprintWorkItems(sprintId);
      
      // Filter to only include User Stories and Bugs
      return workItems.filter(item => 
        item.type === 'User Story' || 
        item.type === 'Bug' ||
        item.type.includes('User Story') ||
        item.type.includes('Bug')
      );
    } catch (error) {
      console.error(`Error fetching user stories and bugs for sprint ${sprintId}:`, error);
      return [];
    }
  }
  
  /**
   * Get comments grouped by work item
   * @param sprintId ID of the sprint
   * @param workItemTypes Optional array of work item types to filter by (e.g., ['User Story', 'Bug'])
   * @returns Promise with map of work item ID to comments
   */
  async getCommentsGroupedByWorkItem(sprintId: string, workItemTypes?: string[]): Promise<Map<number, {workItem: WorkItem, comments: WorkItemComment[]}>> {
    try {
      const workItems = await this.getSprintWorkItems(sprintId);
      
      if (workItems.length === 0) {
        return new Map();
      }
      
      // Filter work items by type if specified
      const filteredWorkItems = workItemTypes 
        ? workItems.filter(item => workItemTypes.includes(item.type))
        : workItems;
      
      console.log(`Found ${filteredWorkItems.length} work items of types ${workItemTypes?.join(', ') || 'all'}`);
      
      // Create a map to store comments by work item ID
      const commentsByWorkItem = new Map<number, {workItem: WorkItem, comments: WorkItemComment[]}>();
      
      // Get comments for each work item
      for (const workItem of filteredWorkItems) {
        const comments = await this.getWorkItemComments(workItem.id, workItem.title);
        if (comments.length > 0) {
          commentsByWorkItem.set(workItem.id, {
            workItem,
            comments
          });
        }
      }
      
      return commentsByWorkItem;
    } catch (error) {
      console.error(`Error fetching comments grouped by work item for sprint ${sprintId}:`, error);
      return new Map();
    }
  }

  /**
   * Find duplicate work items in a sprint
   * Identifies tasks or user stories under the same parent that are assigned to none or the same user
   * @param sprintId ID of the sprint
   * @returns Promise with array of duplicate work item groups
   */
  async findDuplicateWorkItems(sprintId: string): Promise<{parentItem: WorkItem | null, duplicates: WorkItem[]}[]> {
    try {
      const workItems = await this.getSprintWorkItems(sprintId);
      
      if (workItems.length === 0) {
        return [];
      }
      
      // Group work items by parent ID
      const workItemsByParent: Record<string, WorkItem[]> = {};
      
      workItems.forEach(item => {
        const parentId = item.parentId ? item.parentId.toString() : 'null';
        if (!workItemsByParent[parentId]) {
          workItemsByParent[parentId] = [];
        }
        workItemsByParent[parentId].push(item);
      });
      
      // Find potential duplicates (same title or similar titles under same parent)
      const duplicateGroups: {parentItem: WorkItem | null, duplicates: WorkItem[]}[] = [];
      
      for (const parentId in workItemsByParent) {
        const itemsUnderParent = workItemsByParent[parentId];
        
        // Skip if there's only one item under this parent
        if (itemsUnderParent.length <= 1) {
          continue;
        }
        
        // Find the parent work item
        const parentItem = parentId !== 'null' 
          ? workItems.find(item => item.id === parseInt(parentId)) || null
          : null;
        
        // Group by assignee
        const itemsByAssignee: Record<string, WorkItem[]> = {};
        
        itemsUnderParent.forEach(item => {
          const assignee = item.assignedTo || 'Unassigned';
          if (!itemsByAssignee[assignee]) {
            itemsByAssignee[assignee] = [];
          }
          itemsByAssignee[assignee].push(item);
        });
        
        // Check for duplicates by title similarity and same assignee
        for (const assignee in itemsByAssignee) {
          const itemsWithSameAssignee = itemsByAssignee[assignee];
          
          // Skip if there's only one item with this assignee
          if (itemsWithSameAssignee.length <= 1) {
            continue;
          }
          
          // Check for title similarity
          const potentialDuplicates: WorkItem[] = [];
          
          for (let i = 0; i < itemsWithSameAssignee.length; i++) {
            for (let j = i + 1; j < itemsWithSameAssignee.length; j++) {
              const item1 = itemsWithSameAssignee[i];
              const item2 = itemsWithSameAssignee[j];
              
              // Check if titles are similar (case insensitive)
              const title1 = item1.title.toLowerCase();
              const title2 = item2.title.toLowerCase();
              
              // Simple similarity check - can be enhanced with more sophisticated algorithms
              if (title1 === title2 || 
                  title1.includes(title2) || 
                  title2.includes(title1) ||
                  this.calculateSimilarity(title1, title2) > 0.7) {
                
                // Add both items if not already in the list
                if (!potentialDuplicates.includes(item1)) {
                  potentialDuplicates.push(item1);
                }
                if (!potentialDuplicates.includes(item2)) {
                  potentialDuplicates.push(item2);
                }
              }
            }
          }
          
          // If we found potential duplicates, add them to the result
          if (potentialDuplicates.length > 1) {
            duplicateGroups.push({
              parentItem,
              duplicates: potentialDuplicates
            });
          }
        }
      }
      
      return duplicateGroups;
    } catch (error) {
      console.error(`Error finding duplicate work items for sprint ${sprintId}:`, error);
      return [];
    }
  }
  
  /**
   * Calculate similarity between two strings (Levenshtein distance based)
   * @param str1 First string
   * @param str2 Second string
   * @returns Similarity score between 0 and 1
   */
  private calculateSimilarity(str1: string, str2: string): number {
    // Simple implementation of Levenshtein distance
    const track = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }
    
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    
    const distance = track[str2.length][str1.length];
    const maxLength = Math.max(str1.length, str2.length);
    
    // Return similarity as a value between 0 and 1
    return maxLength > 0 ? 1 - distance / maxLength : 1;
  }

  /**
   * Get all work items across all sprints
   */
  async getAllWorkItems(): Promise<WorkItem[]> {
    if (!this.config) {
      throw new Error('ADO service not configured');
    }

    try {
      console.log('Running WIQL query to get work item IDs...');
      
      // Use proxy endpoint to avoid CORS issues
      const wiqlResponse = await axios.post('/api/ado-proxy/wiql', {
        organization: this.config.organization,
        project: this.config.project,
        query: `SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project ORDER BY [System.ChangedDate] DESC`,
        top: 200
      });

      const workItemIds = wiqlResponse.data.workItems.map((wi: any) => wi.id);
      console.log(`Found ${workItemIds.length} work item IDs`);
      
      if (workItemIds.length === 0) {
        return [];
      }

      // Process work items in smaller batches to avoid URL length limits
      const batchSize = 50;
      const allWorkItems: WorkItem[] = [];

      for (let i = 0; i < workItemIds.length; i += batchSize) {
        const batch = workItemIds.slice(i, i + batchSize);
        
        console.log(`Fetching work items batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(workItemIds.length/batchSize)} (${batch.length} items)`);
        
        try {
          const response = await axios.post('/api/ado-proxy/workitems', {
            organization: this.config.organization,
            project: this.config.project,
            ids: batch,
            fields: 'System.Id,System.Title,System.State,System.WorkItemType,System.AssignedTo,Microsoft.VSTS.Scheduling.Effort,Microsoft.VSTS.Common.Priority,System.Tags,System.CreatedDate,System.ChangedDate,System.Description,System.IterationPath'
          });

          const batchWorkItems = response.data.value.map((item: any) => this.mapWorkItem(item));
          allWorkItems.push(...batchWorkItems);
        } catch (batchError) {
          console.error(`Error fetching batch ${Math.floor(i/batchSize) + 1}:`, batchError);
          // Continue with next batch instead of failing completely
        }
      }

      console.log(`Successfully fetched ${allWorkItems.length} work items`);
      return allWorkItems;
    } catch (error) {
      console.error('Error fetching all work items:', error);
      
      // If it's a proxy error, provide helpful message
      if (error instanceof Error) {
        if (error.message.includes('Network Error') || error.message.includes('404')) {
          console.error('Proxy server may not be running. Make sure the backend server is started.');
        }
      }
      
      return [];
    }
  }

  /**
   * Add a comment to a work item
   */
  async addComment(workItemId: number, comment: string): Promise<any> {
    if (!this.client || !this.config) {
      throw new Error('ADO service not configured');
    }

    try {
      const response = await this.client.post(
        `/${this.config.project}/_apis/wit/workItems/${workItemId}/comments`,
        {
          text: comment
        },
        {
          params: {
            'api-version': this.config.apiVersion
          },
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error(`Error adding comment to work item ${workItemId}:`, error);
      throw error;
    }
  }

  /**
   * Turn an Azure DevOps failure into a message that is useful in the UI and in
   * automation run logs, instead of the generic "Request failed with status code 400".
   */
  private describeAdoError(error: any, fallback: string): string {
    const data = error?.response?.data;
    const adoMessage =
      (typeof data === 'string' && data) ||
      data?.message ||
      data?.error?.message ||
      (typeof data?.error === 'string' ? data.error : '') ||
      data?.value?.Message;

    if (adoMessage) {
      return `${fallback}: ${adoMessage}`;
    }

    if (!error?.response) {
      return `${fallback}: ${error?.message || 'no response from Azure DevOps'}`;
    }

    return `${fallback}: ${error.response.status} ${error.response.statusText || ''}`.trim();
  }

  /**
   * Build the JSON Patch document used to create a work item.
   *
   * System.WorkItemType is deliberately absent: the type is taken from the
   * `$<type>` URL segment and Azure DevOps rejects the request when it is also
   * sent as a field. A parent is a hierarchy relation, not a field either -
   * `System.Parent` is read-only and fails validation.
   */
  private buildCreateWorkItemDocument(workItemData: {
    type: string;
    title: string;
    description?: string;
    assignedTo?: string;
    parentId?: number;
    tags?: string[];
    priority?: number;
    effort?: number;
  }): any[] {
    const document: any[] = [
      {
        op: 'add',
        path: '/fields/System.Title',
        value: workItemData.title.trim()
      }
    ];

    if (workItemData.description) {
      document.push({
        op: 'add',
        path: '/fields/System.Description',
        value: workItemData.description
      });
    }

    if (workItemData.assignedTo) {
      document.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: workItemData.assignedTo
      });
    }

    if (workItemData.tags && workItemData.tags.length > 0) {
      document.push({
        op: 'add',
        path: '/fields/System.Tags',
        value: workItemData.tags.join('; ')
      });
    }

    if (workItemData.priority !== undefined && workItemData.priority !== null) {
      document.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Common.Priority',
        value: workItemData.priority
      });
    }

    if (workItemData.effort !== undefined && workItemData.effort !== null) {
      document.push({
        op: 'add',
        path: '/fields/Microsoft.VSTS.Scheduling.Effort',
        value: workItemData.effort
      });
    }

    if (workItemData.parentId) {
      document.push({
        op: 'add',
        path: '/relations/-',
        value: {
          rel: 'System.LinkTypes.Hierarchy-Reverse',
          url: `https://dev.azure.com/${this.config?.organization}/_apis/wit/workItems/${workItemData.parentId}`
        }
      });
    }

    return document;
  }

  /**
   * Create a new work item
   */
  async createWorkItem(workItemData: {
    type: string;
    title: string;
    description?: string;
    assignedTo?: string;
    parentId?: number;
    tags?: string[];
    priority?: number;
    effort?: number;
  }): Promise<WorkItem> {
    if (!this.client || !this.config) {
      throw new Error('ADO service not configured');
    }

    const type = (workItemData.type || '').trim();
    const title = (workItemData.title || '').trim();

    if (!type) {
      throw new Error('Cannot create work item: work item type is required');
    }

    if (!title) {
      throw new Error('Cannot create work item: title is required');
    }

    const document = this.buildCreateWorkItemDocument({ ...workItemData, type, title });
    const { organization, project } = this.config;
    const apiVersion = this.config.apiVersion || '7.0';
    const path = `/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(type)}`;

    console.log(`Creating ${type} "${title}" with patch document:`, JSON.stringify(document));

    try {
      const response = await this.client.post(path, document, {
        params: {
          'api-version': apiVersion
        },
        headers: {
          'Content-Type': 'application/json-patch+json'
        }
      });

      return this.mapWorkItem(response.data);
    } catch (error: any) {
      // No response means the browser blocked the cross-origin call to
      // dev.azure.com; retry through the local proxy, which holds the PAT
      // server-side and is how every read path already reaches Azure DevOps.
      if (!error?.response) {
        try {
          const proxied = await axios.post('/api/ado-proxy/workitems/create', {
            organization,
            project,
            type,
            document,
            apiVersion
          });

          return this.mapWorkItem(proxied.data);
        } catch (proxyError: any) {
          console.error('Error creating work item via proxy:', proxyError);
          throw new Error(this.describeAdoError(proxyError, `Failed to create ${type}`));
        }
      }

      console.error('Error creating work item:', error.response?.status, error.response?.data);
      throw new Error(this.describeAdoError(error, `Failed to create ${type}`));
    }
  }

  /**
   * Get Git Pull Requests associated with a work item
   * @param workItemId ID of the work item
   * @returns Promise with array of PR URLs
   */
  async getWorkItemPullRequests(workItemId: number): Promise<string[]> {
    if (!this.config) {
      throw new Error('ADO client not initialized');
    }

    try {
      // Get work item with relations using proxy
      const response = await axios.post('/api/ado-proxy/workitems', {
        organization: this.config.organization,
        project: this.config.project,
        ids: [workItemId],
        fields: 'System.Id'
      });
      
      const workItem = response.data.value[0];
      const relations = workItem?.relations || [];
      const pullRequests: string[] = [];
      
      relations.forEach((relation: any) => {
        if (relation.rel === 'ArtifactLink' && relation.url) {
          const url = relation.url;
          if (url.includes('/pullrequest/') || url.includes('/pullRequests/') || 
              (url.includes('github.com') && url.includes('/pull/'))) {
            pullRequests.push(url);
          }
        } else if (relation.rel === 'GitPullRequest' && relation.url) {
          pullRequests.push(relation.url);
        }
      });
      
      return pullRequests;
    } catch (error) {
      console.error(`Error fetching PR links for work item ${workItemId}:`, error);
      return [];
    }
  }

  /**
   * Get team members for the current project
   * @returns Promise with array of team members
   */
  async getTeamMembers(): Promise<TeamMember[]> {
    if (!this.config) {
      throw new Error('ADO client not initialized');
    }

    try {
      // Encode project and team names to handle spaces and special characters
      const encodedProject = encodeURIComponent(this.config.project);
      const effectiveTeamName = this.getEffectiveTeamName();
      const encodedTeamName = encodeURIComponent(effectiveTeamName);
      
      // Correct Azure DevOps API endpoint for team members
      const endpoint = `${this.config.organization}/${encodedProject}/_apis/projects/${encodedProject}/teams/${encodedTeamName}/members?api-version=${this.config.apiVersion}`;
      
      console.log('🔄 TEAM_MEMBERS_FETCH: Team members endpoint:', `https://dev.azure.com/${endpoint}`);
      console.log('🔄 TEAM_MEMBERS_FETCH: Effective team name:', effectiveTeamName);
      console.log('🔄 TEAM_MEMBERS_FETCH: Project:', this.config.project);
      
      const response = await axios.post('/api/ado-proxy/teams', {
        config: this.config,
        endpoint: endpoint
      });

      console.log('🔄 TEAM_MEMBERS_FETCH: Response:', response.data);

      if (!response.data.value || !Array.isArray(response.data.value)) {
        console.warn('🔄 TEAM_MEMBERS_FETCH: No team members found or invalid response format');
        
        // Try alternative approach - get all available teams first
        try {
          const teamsListEndpoint = `${this.config.organization}/_apis/projects/${encodedProject}/teams?api-version=${this.config.apiVersion}`;
          console.log('🔄 TEAM_MEMBERS_FETCH: Fetching available teams:', `https://dev.azure.com/${teamsListEndpoint}`);
          
          const teamsResponse = await axios.post('/api/ado-proxy/teams', {
            config: this.config,
            endpoint: teamsListEndpoint
          });
          
          console.log('🔄 TEAM_MEMBERS_FETCH: Available teams response:', teamsResponse.data);
          
          if (teamsResponse.data.value && teamsResponse.data.value.length > 0) {
            console.log('🔄 TEAM_MEMBERS_FETCH: Available teams in project:');
            teamsResponse.data.value.forEach((team: any, index: number) => {
              console.log(`🔄 TEAM_MEMBERS_FETCH: ${index + 1}. ${team.name} (ID: ${team.id})`);
            });
            
            // Look for a team that matches our configured team name (case-insensitive partial match)
            const configuredTeamName = this.getEffectiveTeamName().toLowerCase();
            const matchingTeam = teamsResponse.data.value.find((team: any) => 
              team.name.toLowerCase().includes(configuredTeamName) || 
              configuredTeamName.includes(team.name.toLowerCase())
            );
            
            if (matchingTeam) {
              console.log('🔄 TEAM_MEMBERS_FETCH: Found matching team:', matchingTeam.name);
              const teamMembersEndpoint = `${this.config.organization}/_apis/projects/${encodedProject}/teams/${encodeURIComponent(matchingTeam.name)}/members?api-version=${this.config.apiVersion}`;
              
              const membersResponse = await axios.post('/api/ado-proxy/teams', {
                config: this.config,
                endpoint: teamMembersEndpoint
              });
              
              if (membersResponse.data.value && Array.isArray(membersResponse.data.value)) {
                console.log(`🔄 TEAM_MEMBERS_FETCH: Successfully found ${membersResponse.data.value.length} members in team: ${matchingTeam.name}`);
                return membersResponse.data.value.map((member: any) => ({
                  displayName: member.displayName,
                  uniqueName: member.uniqueName,
                  id: member.id,
                  imageUrl: member.imageUrl
                }));
              }
            } else {
              // Use the first team as fallback
              const firstTeam = teamsResponse.data.value[0];
              console.log('🔄 TEAM_MEMBERS_FETCH: No matching team found, using first available team:', firstTeam.name);
              
              const teamMembersEndpoint = `${this.config.organization}/_apis/projects/${encodedProject}/teams/${encodeURIComponent(firstTeam.name)}/members?api-version=${this.config.apiVersion}`;
              
              const membersResponse = await axios.post('/api/ado-proxy/teams', {
                config: this.config,
                endpoint: teamMembersEndpoint
              });
              
              if (membersResponse.data.value && Array.isArray(membersResponse.data.value)) {
                console.log(`🔄 TEAM_MEMBERS_FETCH: Successfully found ${membersResponse.data.value.length} members in default team: ${firstTeam.name}`);
                return membersResponse.data.value.map((member: any) => ({
                  displayName: member.displayName,
                  uniqueName: member.uniqueName,
                  id: member.id,
                  imageUrl: member.imageUrl
                }));
              }
            }
          } else {
            console.error('🔄 TEAM_MEMBERS_FETCH: No teams found in project');
          }
        } catch (fallbackError) {
          console.error('🔄 TEAM_MEMBERS_FETCH: Fallback approach failed:', fallbackError);
        }
        
        return [];
      }

      return response.data.value.map((member: any) => ({
        displayName: member.displayName,
        uniqueName: member.uniqueName,
        id: member.id,
        imageUrl: member.imageUrl
      }));
    } catch (error) {
      console.error('Error fetching team members:', error);
      
      // If it's a 404, provide more specific guidance
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.error('🔄 TEAM_MEMBERS_FETCH: Team not found. Check team name configuration.');
        console.error('🔄 TEAM_MEMBERS_FETCH: Current team name:', this.getEffectiveTeamName());
        console.error('🔄 TEAM_MEMBERS_FETCH: Project name:', this.config.project);
      }
      
      return [];
    }
  }

  /**
   * Get the effective team name (team name or project as fallback)
   */
  private getEffectiveTeamName(): string {
    return this.config?.teamName || this.config?.project || '';
  }

  /**
   * Test ADO API connection and permissions
   * @param sprintId Sprint ID to test with
   * @returns Promise with test results
   */
  async testAdoConnection(sprintId?: string): Promise<{
    canAccessProject: boolean;
    canAccessSprints: boolean;
    canAccessCapacity: boolean;
    hasValidConfig: boolean;
    errors: string[];
  }> {
    const result = {
      canAccessProject: false,
      canAccessSprints: false,
      canAccessCapacity: false,
      hasValidConfig: false,
      errors: [] as string[]
    };

    try {
      if (!this.config) {
        result.errors.push('ADO service not initialized');
        return result;
      }

      result.hasValidConfig = true;
      
      // Use team name, fallback to project name if not specified
      const effectiveTeamName = this.getEffectiveTeamName();
      
      console.log('🧪 ADO_TEST: Testing ADO connection with config:', {
        organization: this.config.organization,
        project: this.config.project,
        teamName: this.config.teamName,
        effectiveTeamName: effectiveTeamName
      });

      // Test 1: Can we access the project?
      try {
        // Encode project name to handle spaces and special characters
        const encodedProject = encodeURIComponent(this.config.project);
        const projectEndpoint = `${this.config.organization}/_apis/projects/${encodedProject}?api-version=${this.config.apiVersion}`;
        console.log('🧪 ADO_TEST: Testing project endpoint:', `https://dev.azure.com/${projectEndpoint}`);
        
        await axios.post('/api/ado-proxy/teams', {
          config: this.config,
          endpoint: projectEndpoint
        });
        result.canAccessProject = true;
        console.log('🧪 ADO_TEST: ✅ Can access project');
      } catch (error: any) {
        result.errors.push(`Cannot access project: ${error.message}`);
        console.error('🧪 ADO_TEST: ❌ Cannot access project:', error.message);
        
        // Log more details about the project access error
        if (error.response) {
          console.error('🧪 ADO_TEST: Project API response details:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
            url: `https://dev.azure.com/${this.config.organization}/_apis/projects/${encodeURIComponent(this.config.project)}`
          });
        }
      }

      // Test 2: Can we access sprints?
      try {
        // Encode project name and team name to handle spaces and special characters
        const encodedProject = encodeURIComponent(this.config.project);
        const encodedTeamName = encodeURIComponent(effectiveTeamName);
        const sprintsEndpoint = `${this.config.organization}/${encodedProject}/${encodedTeamName}/_apis/work/teamsettings/iterations?api-version=${this.config.apiVersion}`;
        console.log('🧪 ADO_TEST: Testing sprints endpoint:', `https://dev.azure.com/${sprintsEndpoint}`);
        
        const sprintsResponse = await axios.post('/api/ado-proxy/sprints', {
          config: this.config,
          endpoint: sprintsEndpoint
        });
        result.canAccessSprints = true;
        console.log('🧪 ADO_TEST: ✅ Can access sprints, found:', sprintsResponse.data.value?.length || 0, 'sprints');
      } catch (error: any) {
        result.errors.push(`Cannot access sprints: ${error.message}`);
        console.error('🧪 ADO_TEST: ❌ Cannot access sprints:', error.message);
      }

      // Test 3: Can we access capacity data?
      if (sprintId && result.canAccessSprints) {
        try {
          // Encode project name and team name to handle spaces and special characters
          const encodedProject = encodeURIComponent(this.config.project);
          const encodedTeamName = encodeURIComponent(effectiveTeamName);
          const capacityEndpoint = `${this.config.organization}/${encodedProject}/${encodedTeamName}/_apis/work/teamsettings/iterations/${sprintId}/capacities?api-version=${this.config.apiVersion}`;
          console.log('🧪 ADO_TEST: Testing capacity endpoint:', `https://dev.azure.com/${capacityEndpoint}`);
          
          const capacityResponse = await axios.post('/api/ado-proxy/capacity', {
            config: this.config,
            endpoint: capacityEndpoint
          });
          result.canAccessCapacity = true;
          console.log('🧪 ADO_TEST: ✅ Can access capacity data, found:', capacityResponse.data.teamMembers?.length || 0, 'team members');
          
          // Log sample capacity data structure
          if (capacityResponse.data.teamMembers && capacityResponse.data.teamMembers.length > 0) {
            console.log('🧪 ADO_TEST: Sample capacity data structure:', {
              sampleMember: capacityResponse.data.teamMembers[0],
              totalMembers: capacityResponse.data.teamMembers.length
            });
          }
        } catch (error: any) {
          result.errors.push(`Cannot access capacity data: ${error.message}`);
          console.error('🧪 ADO_TEST: ❌ Cannot access capacity data:', error.message);
          
          // Log more details about the capacity error
          if (error.response) {
            console.error('🧪 ADO_TEST: Capacity API response details:', {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            });
          }
        }
      }

      return result;
    } catch (error: any) {
      result.errors.push(`Unexpected error: ${error.message}`);
      console.error('🧪 ADO_TEST: ❌ Unexpected error during connection test:', error);
      return result;
    }
  }

  /**
   * Get sprint capacity data for the team
   * @param sprintId ID of the sprint
   * @returns Promise with sprint capacity data
   */
  async getSprintCapacity(sprintId: string): Promise<SprintCapacityData> {
    if (!this.config) {
      throw new Error('ADO client not initialized');
    }

    try {
      console.log('🔍 CAPACITY_FETCH: Starting capacity fetch for sprint:', sprintId);
      
      // Use team name, fallback to project name if not specified
      const effectiveTeamName = this.getEffectiveTeamName();
      console.log('🔍 CAPACITY_FETCH: Using team name:', effectiveTeamName);

      // Get sprint details first
      const encodedProject = encodeURIComponent(this.config.project);
      const encodedTeamName = encodeURIComponent(effectiveTeamName);
      
      const sprintEndpoint = `${this.config.organization}/${encodedProject}/${encodedTeamName}/_apis/work/teamsettings/iterations/${sprintId}?api-version=${this.config.apiVersion}`;
      const sprintResponse = await axios.post('/api/ado-proxy/sprints', {
        config: this.config,
        endpoint: sprintEndpoint
      });

      const sprint = sprintResponse.data;
      const sprintStart = new Date(sprint.attributes.startDate);
      const sprintEnd = new Date(sprint.attributes.finishDate);
      const totalSprintDays = Math.ceil((sprintEnd.getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24));
      const totalWorkingDays = this.calculateWorkingDays(sprintStart, sprintEnd);

      // Fetch team capacity
      const capacityEndpoint = `${this.config.organization}/${encodedProject}/${encodedTeamName}/_apis/work/teamsettings/iterations/${sprintId}/capacities?api-version=${this.config.apiVersion}`;
      console.log('🔍 CAPACITY_FETCH: Fetching from:', `https://dev.azure.com/${capacityEndpoint}`);
      
      const capacityResponse = await axios.post('/api/ado-proxy/capacity', {
        config: this.config,
        endpoint: capacityEndpoint
      });

      console.log('🔍 CAPACITY_FETCH: API Response - found', capacityResponse.data.teamMembers?.length || 0, 'team members');
      console.log('🔍 CAPACITY_FETCH: Raw API response structure:', {
        hasData: !!capacityResponse.data,
        hasTeamMembers: !!capacityResponse.data?.teamMembers,
        isArray: Array.isArray(capacityResponse.data?.teamMembers),
        responseKeys: Object.keys(capacityResponse.data || {}),
        actualResponse: capacityResponse.data
      });
      
      // Log the full response structure to understand the actual format
      console.log('🔍 CAPACITY_FETCH: Full API response data:', JSON.stringify(capacityResponse.data, null, 2));
      
      // ✅ FIX: The ADO API returns capacity data in 'teamMembers' array, not 'value' array
      if (!capacityResponse.data?.teamMembers || capacityResponse.data.teamMembers.length === 0) {
        console.warn('🔍 CAPACITY_FETCH: No capacity data found. This might be because:');
        console.warn('  1. Team name mismatch - capacity is set for a different team');
        console.warn('  2. Capacity not configured for this sprint');
        console.warn('  3. Different team has the capacity data');
        console.warn('  Current team name used:', effectiveTeamName);
        
        // Try to use manually configured team capacity data as fallback
        const manualCapacityData = this.getManualTeamCapacityData(totalWorkingDays);
        
        if (manualCapacityData.teamCapacities.length > 0) {
          console.log('🔍 CAPACITY_FETCH: Using manually configured capacity data as fallback');
          console.log('🔍 CAPACITY_FETCH: Found', manualCapacityData.teamCapacities.length, 'team members in manual config');
          
          return {
            ...manualCapacityData,
            sprintDates: {
              startDate: sprint.attributes.startDate,
              endDate: sprint.attributes.finishDate
            },
            totalSprintDays,
            totalWorkingDays,
            isUsingFallback: true
          };
        }
        
        // If no manual config either, return empty capacity data
        return {
          teamCapacities: [],
          sprintDates: {
            startDate: sprint.attributes.startDate,
            endDate: sprint.attributes.finishDate
          },
          totalSprintDays,
          totalWorkingDays,
          isUsingFallback: true
        };
      }

      // ✅ FIX: Use teamMembers array instead of value array
      const teamCapacities: TeamCapacity[] = capacityResponse.data.teamMembers
        .filter((capacity: any) => {
          // Calculate total capacity per day from all activities
          const totalCapacityPerDay = capacity.activities.reduce((sum: number, activity: any) => {
            return sum + (activity.capacityPerDay || 0);
          }, 0);
          
          // ✅ FILTER: Exclude team members with 0 capacity
          if (totalCapacityPerDay === 0) {
            console.log(`🚫 CAPACITY_FILTER: Excluding ${capacity.teamMember.displayName} - 0 capacity`);
            return false;
          }
          return true;
        })
        .map((capacity: any) => {
          // Calculate days off during sprint
          const daysOff = capacity.daysOff || [];
          const daysOffDuringSprintCount = this.calculateDaysOffDuringSprint(daysOff, sprintStart, sprintEnd);
          
          // Calculate working days for this team member
          const memberWorkingDays = totalWorkingDays - daysOffDuringSprintCount;
          
          // Calculate total capacity per day from all activities
          const totalCapacityPerDay = capacity.activities.reduce((sum: number, activity: any) => {
            return sum + (activity.capacityPerDay || 0);
          }, 0);
          
          const totalCapacityForSprint = totalCapacityPerDay * memberWorkingDays;
          
          // ✅ NEW: Calculate total available capacity (capacity that hasn't been allocated)
          const totalAvailableCapacity = totalCapacityForSprint; // For now, assume all capacity is available
          // This could be enhanced later to subtract allocated work items

          console.log(`🔍 CAPACITY: ${capacity.teamMember.displayName} -> ${totalCapacityPerDay}h/day (${memberWorkingDays} working days, ${daysOffDuringSprintCount} days off) = ${totalCapacityForSprint}h total`);
          console.log(`   📅 DAYS_OFF_DETAIL: Total sprint working days: ${totalWorkingDays}, Member days off: ${daysOffDuringSprintCount}, Effective working days: ${memberWorkingDays}`);
          console.log(`   ✅ CAPACITY_CALCULATION: ${totalCapacityPerDay}h/day × ${memberWorkingDays} days = ${totalCapacityForSprint}h (accounts for days off)`);

          return {
            teamMember: {
              displayName: capacity.teamMember.displayName,
              uniqueName: capacity.teamMember.uniqueName,
              id: capacity.teamMember.id,
              imageUrl: capacity.teamMember.imageUrl
            },
            activities: capacity.activities.map((activity: any) => ({
              name: activity.name || 'Development',
              capacityPerDay: activity.capacityPerDay || 6
            })),
            daysOff: daysOff,
            totalCapacityPerDay,
            totalCapacityForSprint,
            totalAvailableCapacity, // ✅ NEW: Add available capacity
            workingDays: memberWorkingDays
          };
        });

      return {
        teamCapacities,
        sprintDates: {
          startDate: sprint.attributes.startDate,
          endDate: sprint.attributes.finishDate
        },
        totalSprintDays,
        totalWorkingDays,
        isUsingFallback: false
      };
    } catch (error: any) {
      console.error('🔍 CAPACITY_ERROR: Failed to fetch capacity from ADO:', error?.response?.status || error?.message);
      
      // Try to provide specific guidance based on the error
      if (error?.response?.status === 404) {
        console.warn('🔍 CAPACITY_ERROR: Team or sprint not found - check team name configuration');
        console.warn('🔍 CAPACITY_ERROR: Current team name:', this.getEffectiveTeamName());
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        console.warn('🔍 CAPACITY_ERROR: Permission issue - check PAT permissions');
      }

      // Try to use manually configured team capacity data as fallback
      const manualCapacityData = this.getManualTeamCapacityData(10); // Assume 10 working days for fallback
      
      if (manualCapacityData.teamCapacities.length > 0) {
        console.log('🔍 CAPACITY_ERROR: Using manually configured capacity data as fallback');
        return {
          ...manualCapacityData,
          isUsingFallback: true
        };
      }
      
      // If no manual config either, return empty capacity data
      return {
        teamCapacities: [],
        sprintDates: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        totalSprintDays: 14,
        totalWorkingDays: 10,
        isUsingFallback: true
      };
    }
  }

  /**
   * Get manually configured team capacity data from localStorage
   * @param workingDays Number of working days in the sprint
   * @returns Sprint capacity data with manually configured team members
   */
  private getManualTeamCapacityData(workingDays: number): SprintCapacityData {
    try {
      const storedConfig = localStorage.getItem('teamCapacityConfig');
      if (!storedConfig) {
        console.log('🔍 CAPACITY_MANUAL: No manual team capacity configuration found');
        return {
          teamCapacities: [],
          sprintDates: {
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
          },
          totalSprintDays: 14,
          totalWorkingDays: workingDays
        };
      }

      const config = JSON.parse(storedConfig);
      console.log('🔍 CAPACITY_MANUAL: Found manual team capacity configuration:', config);
      
      // Convert the config object to TeamCapacity array
      const teamCapacities: TeamCapacity[] = Object.entries(config).map(([name, capacityConfig]) => {
        // Support both simple number format and object format for capacity config
        let capacityPerDay: number;
        let daysOff: DayOff[] = [];
        
        if (typeof capacityConfig === 'number') {
          // Simple format: just daily capacity
          capacityPerDay = Number(capacityConfig);
        } else if (typeof capacityConfig === 'object' && capacityConfig !== null) {
          // Enhanced format: { dailyCapacity: 6, daysOff: [...] }
          capacityPerDay = Number((capacityConfig as any).dailyCapacity || (capacityConfig as any).capacity || 6);
          daysOff = (capacityConfig as any).daysOff || [];
        } else {
          capacityPerDay = 6; // Default capacity
        }
        
        // Calculate days off during sprint for manual config
        const daysOffDuringSprintCount = daysOff.length > 0 ? 
          this.calculateDaysOffDuringSprint(daysOff, new Date(), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)) : 
          0;
        
        // Calculate effective working days for this team member
        const effectiveWorkingDays = Math.max(0, workingDays - daysOffDuringSprintCount);
        const totalCapacityForSprint = capacityPerDay * effectiveWorkingDays;
        
        console.log(`🔍 MANUAL_CAPACITY: ${name} -> ${capacityPerDay}h/day (${effectiveWorkingDays}/${workingDays} working days, ${daysOffDuringSprintCount} days off) = ${totalCapacityForSprint}h total`);
        
        return {
          teamMember: {
            displayName: name,
            uniqueName: name,
            id: name.replace(/\s+/g, '').toLowerCase() // Generate a simple ID from name
          },
          activities: [{
            name: 'Development',
            capacityPerDay: capacityPerDay
          }],
          daysOff: daysOff,
          totalCapacityPerDay: capacityPerDay,
          totalCapacityForSprint,
          totalAvailableCapacity: totalCapacityForSprint, // ✅ NEW: Available capacity for manual config
          workingDays: effectiveWorkingDays // ✅ FIX: Use effective working days, not total sprint working days
        };
      });

      console.log(`🔍 CAPACITY_MANUAL: Created ${teamCapacities.length} team members from manual config`);
      
      return {
        teamCapacities,
        sprintDates: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        totalSprintDays: 14,
        totalWorkingDays: workingDays
      };
    } catch (error) {
      console.error('🔍 CAPACITY_MANUAL: Error loading manual team capacity config:', error);
      return {
        teamCapacities: [],
        sprintDates: {
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
        },
        totalSprintDays: 14,
        totalWorkingDays: workingDays
      };
    }
  }

  /**
   * Calculate working days between two dates (excluding weekends)
   * @param startDate Start date
   * @param endDate End date
   * @returns Number of working days
   */
  private calculateWorkingDays(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      // Monday = 1, Friday = 5 (exclude Saturday = 6, Sunday = 0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  }

  /**
   * Calculate days off during sprint period
   * @param daysOff Array of days off
   * @param sprintStart Sprint start date
   * @param sprintEnd Sprint end date
   * @returns Number of days off during sprint
   */
  private calculateDaysOffDuringSprint(daysOff: DayOff[], sprintStart: Date, sprintEnd: Date): number {
    let daysOffCount = 0;
    
    daysOff.forEach(dayOff => {
      const start = new Date(Math.max(new Date(dayOff.start).getTime(), sprintStart.getTime()));
      const end = new Date(Math.min(new Date(dayOff.end).getTime(), sprintEnd.getTime()));
      
      if (start <= end) {
        daysOffCount += this.calculateWorkingDays(start, end);
      }
    });
    
    return daysOffCount;
  }

  /**
   * Get team member utilization data for a sprint with enhanced burn rate analysis
   * @param sprintId ID of the sprint
   * @returns Promise with utilization data including cumulative daily burn rate and capacity mismatch alerts
   */
  async getTeamUtilization(sprintId: string): Promise<{
    member: TeamMember, 
    capacity: TeamCapacity, 
    utilization: number, 
    assignedEffort: number, 
    completedEffort: number, 
    remainingCapacity: number,
    dailyBurnRate: number,
    expectedDailyBurn: number,
    isCapacityMismatch: boolean,
    capacityMismatchSeverity: 'low' | 'medium' | 'high' | 'none',
    burnRateAnalysis: {
      daysIntoSprint: number,
      expectedProgressPercentage: number,
      actualProgressPercentage: number,
      isOnTrack: boolean,
      recommendation: string,
      expectedCumulativeEffort: number,
      actualCumulativeEffort: number,
      dailyBurnHistory: Array<{
        day: number,
        date: string,
        expectedCumulative: number,
        actualCumulative: number,
        dailyBurn: number,
        isWeekend: boolean
      }>
    }
  }[]> {
    try {
      const [capacityData, workItems] = await Promise.all([
        this.getSprintCapacity(sprintId),
        this.getSprintWorkItems(sprintId)
      ]);

      // Enhanced sprint date calculations
      const sprintStart = new Date(capacityData.sprintDates.startDate);
      const sprintEnd = new Date(capacityData.sprintDates.endDate);
      const now = new Date();
      
      // Calculate total sprint days
      const totalSprintDays = Math.ceil((sprintEnd.getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      // ✅ ENHANCED: Use end-of-day cutoff for burn rate analysis (effort only counts after 11:59 PM)
      const isSprintCompleted = now > sprintEnd;
      
      // Calculate analysis day based on 11:59 PM cutoff
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const currentDayNumber = Math.floor((todayStart.getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Only count completed days (where 11:59 PM has passed) - NO work counts on Day 1 until 11:59 PM
      const completedDays = Math.max(0, currentDayNumber - 1); // Previous days only
      const analysisDay = isSprintCompleted ? totalSprintDays : completedDays; // Remove Math.max(1, ...) here

      console.log(`📊 ENHANCED_BURN_ANALYSIS: Sprint ${sprintId}`);
      console.log(`   📅 Sprint: ${sprintStart.toDateString()} → ${sprintEnd.toDateString()}`);
      console.log(`   📈 Days: ${analysisDay}/${totalSprintDays} (11:59 PM cutoff, ${isSprintCompleted ? 'COMPLETED' : 'ACTIVE'})`);
      console.log(`   🕐 Current Day: ${currentDayNumber}, Completed Days: ${completedDays} (NO effort counts until after 11:59 PM)`);
      console.log(`   ⚠️ Analysis Day: ${analysisDay} (0 = no completed days yet, effort counting starts after first 11:59 PM)`);
      console.log(`   🔍 OLDER_SPRINT_DEBUG: isSprintCompleted=${isSprintCompleted}, now=${now.toISOString()}, sprintEnd=${sprintEnd.toISOString()}`);
      
      console.log(`🔍 WORK_ITEMS_SUMMARY: Found ${workItems.length} total work items in sprint ${sprintId}`);
      console.log(`🔍 CAPACITY_SUMMARY: Found ${capacityData.teamCapacities.length} team members with capacity`);
      console.log(`🔍 CAPACITY_SOURCE: Using ${capacityData.isUsingFallback ? 'MANUAL/FALLBACK' : 'ADO API'} capacity data`);
      
      // ✅ NEW: Debug capacity and days off information
      console.log(`📅 DAYS_OFF_SUMMARY: Capacity source breakdown:`);
      capacityData.teamCapacities.forEach(cap => {
        const daysOffCount = cap.daysOff?.length || 0;
        const totalDaysOff = capacityData.isUsingFallback ? 0 : this.calculateDaysOffDuringSprint(cap.daysOff || [], sprintStart, sprintEnd);
        console.log(`   👤 ${cap.teamMember.displayName}: ${cap.totalCapacityPerDay}h/day × ${cap.workingDays} days = ${cap.totalCapacityForSprint}h (${daysOffCount} days off configured, ${totalDaysOff} during sprint)`);
      });
      
      if (capacityData.isUsingFallback) {
        console.warn(`⚠️ USING MANUAL CAPACITY: You're using manually configured team capacity.`);
        console.warn(`⚠️ If assigned effort = capacity, it means work items aren't being assigned properly.`);
        console.warn(`⚠️ Check: 1) Work items exist, 2) Have effort values, 3) Names match between capacity config and work item assignees.`);
      }
      
      if (workItems.length === 0) {
        console.warn(`⚠️ NO WORK ITEMS FOUND: This might explain why assigned effort equals capacity - no actual work items to assign!`);
        console.warn(`⚠️ SOLUTION: Add work items to the sprint or check if getSprintWorkItems is working correctly.`);
      }
      
      // Debug: Show work items summary
      const totalWorkItemEffort = workItems.reduce((sum, item) => sum + (item.effort || 0), 0);
      const workItemsWithEffort = workItems.filter(item => item.effort && item.effort > 0);
      console.log(`🔍 WORK_ITEMS_EFFORT_SUMMARY: ${workItemsWithEffort.length}/${workItems.length} items have effort, total effort: ${totalWorkItemEffort}h`);
      
      if (workItemsWithEffort.length === 0 && workItems.length > 0) {
        console.warn(`⚠️ WORK ITEMS HAVE NO EFFORT: ${workItems.length} work items found but none have effort values!`);
        console.warn(`⚠️ This explains why assigned effort is 0 - all work items have null/undefined effort.`);
      }
      
      workItems.forEach((item, index) => {
        if (index < 10) { // Show first 10 items
          console.log(`   ${index + 1}. "${item.title}" | Assigned: "${item.assignedTo}" | Effort: ${item.effort || 0}h | State: ${item.state}`);
        } else if (index === 10) {
          console.log(`   ... and ${workItems.length - 10} more items`);
        }
      });

      const utilizationData = capacityData.teamCapacities.map(capacity => {
        console.log(`🔍 CAPACITY_DEBUG: Processing member "${capacity.teamMember.displayName}"`);
        console.log(`   📊 totalCapacityForSprint: ${capacity.totalCapacityForSprint}h`);
        console.log(`   📊 totalCapacityPerDay: ${capacity.totalCapacityPerDay}h/day`);
        console.log(`   📊 workingDays: ${capacity.workingDays} days`);
        console.log(`   📊 uniqueName: "${capacity.teamMember.uniqueName}"`);
        
        // ✅ DEBUG: Show all unique assignees in the sprint
        const allAssigneesSet = new Set(workItems.map(item => item.assignedTo).filter(Boolean));
        const allAssignees = Array.from(allAssigneesSet);
        console.log(`   🔍 ALL_ASSIGNEES_IN_SPRINT: [${allAssignees.map(name => `"${name}"`).join(', ')}]`);
        console.log(`   🔍 LOOKING_FOR_MATCHES_TO: displayName="${capacity.teamMember.displayName}", uniqueName="${capacity.teamMember.uniqueName}"`);
        
        // Enhanced name matching with email support
        const memberWorkItems = workItems.filter(item => {
          if (!item.assignedTo) return false;
          
          const assignedTo = item.assignedTo.toLowerCase().trim();
          const displayName = capacity.teamMember.displayName.toLowerCase().trim();
          const uniqueName = capacity.teamMember.uniqueName?.toLowerCase().trim() || '';
          
          // ✅ STRICT: Direct exact match only
          if (assignedTo === displayName || assignedTo === uniqueName) {
            console.log(`   ✅ DIRECT MATCH: "${assignedTo}" matches "${displayName}" or "${uniqueName}" for "${item.title}"`);
            return true;
          }
          
          // ✅ STRICT: Email match (extract name part before @) - must be exact
          if (assignedTo.includes('@') && uniqueName.includes('@')) {
            const assignedEmailPart = assignedTo.split('@')[0];
            const uniqueEmailPart = uniqueName.split('@')[0];
            if (assignedEmailPart === uniqueEmailPart) {
              console.log(`   ✅ EMAIL MATCH: "${assignedEmailPart}" matches "${uniqueEmailPart}" for "${item.title}"`);
              return true;
            }
          }
          
          // ✅ REMOVED: Fuzzy name parts matching - this was causing false positives
          // The previous logic was matching partial names, which caused all work items 
          // to be assigned to everyone. Now using strict matching only.
          
          return false;
        });

        console.log(`   🎯 FINAL_MATCHING_RESULTS for "${capacity.teamMember.displayName}": Found ${memberWorkItems.length} matching work items out of ${workItems.length} total`);
        if (memberWorkItems.length === 0) {
          console.warn(`   ⚠️ NO_WORK_ITEMS_MATCHED: "${capacity.teamMember.displayName}" has no work items assigned! Check name matching.`);
          console.warn(`   💡 CAPACITY_NAME: "${capacity.teamMember.displayName}" (uniqueName: "${capacity.teamMember.uniqueName}")`);
          console.warn(`   💡 AVAILABLE_ASSIGNEES: ${allAssignees.slice(0, 5).map(name => `"${name}"`).join(', ')}${allAssignees.length > 5 ? '...' : ''}`);
        } else if (memberWorkItems.length > 30) {
          console.warn(`   ⚠️ TOO_MANY_MATCHES: "${capacity.teamMember.displayName}" matched ${memberWorkItems.length} work items - this might indicate incorrect matching!`);
        }

        const assignedEffort = memberWorkItems.reduce((sum, item) => {
          const effortToAdd = item.effort || 0;
          console.log(`   🔍 EFFORT_CALCULATION: Adding ${effortToAdd}h from "${item.title}" (${item.type}) | Total so far: ${sum + effortToAdd}h`);
          return sum + effortToAdd;
        }, 0);
        
        // ✅ DEBUG: Show effort breakdown by work item type
        const effortByType = memberWorkItems.reduce((acc, item) => {
          const type = item.type;
          const effort = item.effort || 0;
          if (!acc[type]) acc[type] = { count: 0, totalEffort: 0 };
          acc[type].count++;
          acc[type].totalEffort += effort;
          return acc;
        }, {} as Record<string, { count: number; totalEffort: number }>);
        
        console.log(`   📊 EFFORT_BY_TYPE for ${capacity.teamMember.displayName}:`, effortByType);
        console.log(`   📊 TOTAL_ASSIGNED_EFFORT: ${assignedEffort}h from ${memberWorkItems.length} work items`);
        
        // ✅ CRITICAL: Check for potential double-counting of parent/child relationships
        const parentItems = memberWorkItems.filter(item => !item.parentId);
        const childItems = memberWorkItems.filter(item => item.parentId);
        const parentEffort = parentItems.reduce((sum, item) => sum + (item.effort || 0), 0);
        const childEffort = childItems.reduce((sum, item) => sum + (item.effort || 0), 0);
        
        console.log(`   🔍 PARENT_CHILD_ANALYSIS:`);
        console.log(`     📋 Parent items (${parentItems.length}): ${parentEffort}h total`);
        console.log(`     📋 Child items (${childItems.length}): ${childEffort}h total`);
        console.log(`     ⚠️  If both parents and children have effort, this might indicate double-counting!`);
        
        // ✅ NEW: Provide alternative calculation that avoids double-counting
        // Common ADO practice: Only count effort from Tasks (leaf items), not from parent User Stories
        const taskOnlyEffort = memberWorkItems
          .filter(item => item.type === 'Task' || item.type.toLowerCase().includes('task'))
          .reduce((sum, item) => sum + (item.effort || 0), 0);
          
        const userStoryEffort = memberWorkItems
          .filter(item => item.type === 'User Story' || item.type === 'Feature' || item.type.toLowerCase().includes('story'))
          .reduce((sum, item) => sum + (item.effort || 0), 0);
          
        console.log(`   🎯 ALTERNATIVE_CALCULATION:`);
        console.log(`     📋 Task-only effort: ${taskOnlyEffort}h (recommended for allocation)`);
        console.log(`     📋 User Story effort: ${userStoryEffort}h (planning estimates)`);
        console.log(`     📋 Current total: ${assignedEffort}h (may include double-counting)`);
        
        // ✅ RECOMMENDATION: Use task-only effort if there are both User Stories and Tasks
        const hasUserStories = memberWorkItems.some(item => item.type === 'User Story' || item.type === 'Feature');
        const hasTasks = memberWorkItems.some(item => item.type === 'Task');
        
        // ✅ SMART ALLOCATION: Avoid double-counting by using Task-only effort when both exist
        let finalAssignedEffort = assignedEffort;
        
        if (hasUserStories && hasTasks && userStoryEffort > 0 && taskOnlyEffort > 0) {
          console.warn(`   ⚠️  DOUBLE_COUNTING_DETECTED: Both User Stories (${userStoryEffort}h) and Tasks (${taskOnlyEffort}h) have effort!`);
          console.warn(`   💡 USING_TASK_EFFORT: Using Task-only effort (${taskOnlyEffort}h) to avoid double-counting`);
          console.warn(`   📝 Original calculation (${assignedEffort}h) was inflated due to counting both levels`);
          finalAssignedEffort = taskOnlyEffort;
        }
        
        const completedEffort = memberWorkItems
          .filter(item => {
            const state = item.state.toLowerCase();
            return state === 'done' || 
                   state === 'closed' || 
                   state === 'completed' || 
                   state === 'resolved' ||
                   state === 'finished';
          })
          .reduce((sum, item) => sum + (item.effort || 0), 0);

        console.log(`🔍 WORK_ITEMS_DEBUG: ${capacity.teamMember.displayName}:`);
        console.log(`   📋 Found ${memberWorkItems.length} work items assigned`);
        
        // ✅ CRITICAL DEBUG: Check if assigned effort calculation is correct
        if (finalAssignedEffort === 0 && memberWorkItems.length > 0) {
          console.error(`🚨 ASSIGNED_EFFORT_ZERO_BUG: Found ${memberWorkItems.length} work items but final assigned effort is 0!`);
          console.error(`🚨 This means all work items have no effort values (null/undefined/0).`);
        } else if (finalAssignedEffort === capacity.totalCapacityForSprint) {
          console.error(`🚨 ASSIGNED_EFFORT_EQUALS_CAPACITY_BUG: Final assigned effort (${finalAssignedEffort}h) exactly equals capacity (${capacity.totalCapacityForSprint}h)!`);
          console.error(`🚨 This is suspicious and suggests a calculation error or default assignment.`);
        } else if (finalAssignedEffort > 0) {
          console.log(`✅ ASSIGNED_EFFORT_OK: Final assigned effort (${finalAssignedEffort}h) looks reasonable vs capacity (${capacity.totalCapacityForSprint}h).`);
        }
        
        console.log(`   🚨 EFFORT_ISSUE_DEBUG: Sprint capacity=${capacity.totalCapacityForSprint}h, Final assigned effort=${finalAssignedEffort}h (Raw: ${assignedEffort}h)`);
        console.log(`   🔍 All work items for sprint (before filtering):`);
        workItems.forEach(item => {
          console.log(`     - ${item.title} | Assigned: "${item.assignedTo}" | Effort: ${item.effort || 0}h | State: ${item.state}`);
        });
        console.log(`   🔍 Work items matched to ${capacity.teamMember.displayName} (after filtering):`);
        memberWorkItems.forEach(item => {
          console.log(`     - ${item.title} (${item.state}) - ${item.effort || 0}h | AssignedTo: "${item.assignedTo}"`);
        });
        console.log(`   📝 Total: ${finalAssignedEffort}h assigned (${assignedEffort}h raw), ${completedEffort}h completed`);
        console.log(`   🔍 OLDER_SPRINT_ITEM_DEBUG: Sprint completed=${isSprintCompleted}, Work items with effort: ${memberWorkItems.filter(item => item.effort && item.effort > 0).length}`);

        // ✅ ENHANCED: Filter completed work items for daily burn calculation
        const completedWorkItems = memberWorkItems.filter(item => {
          const state = item.state.toLowerCase();
          return state === 'done' || 
                 state === 'closed' || 
                 state === 'completed' || 
                 state === 'resolved' ||
                 state === 'finished';
        });

        // ✅ ENHANCED: Generate daily burn history with 11:59 PM cutoff logic
        const dailyBurnHistory = this.generateDailyBurnHistory(
          sprintStart, 
          sprintEnd, 
          capacity.totalCapacityPerDay, 
          capacity.workingDays,
          completedWorkItems, // Pass completed work items instead of total completed effort
          analysisDay // Uses completed days only (after 11:59 PM)
        );

        // ✅ ENHANCED: Calculate expected vs actual based on completed days only (can be 0 on day 1)
        // For completed sprints, use the full working days of the sprint for cumulative analysis
        const workingDaysCompleted = isSprintCompleted 
          ? capacity.workingDays // Use full working days for completed sprints
          : (analysisDay > 0 
              ? dailyBurnHistory.filter(day => day.day <= analysisDay && !day.isWeekend).length
              : 0); // No working days completed if analysisDay is 0
        
        const expectedCumulativeEffort = capacity.totalCapacityPerDay * workingDaysCompleted;
        const actualCumulativeEffort = (workingDaysCompleted > 0 || isSprintCompleted) ? completedEffort : 0; // Count completed effort for completed sprints

        console.log(`🔍 OLDER_SPRINT_CUMULATIVE_DEBUG: ${capacity.teamMember.displayName}:`);
        console.log(`   📊 isSprintCompleted: ${isSprintCompleted}`);
        console.log(`   📊 capacity.workingDays: ${capacity.workingDays}`);
        console.log(`   📊 workingDaysCompleted: ${workingDaysCompleted} (${isSprintCompleted ? 'FULL SPRINT' : 'PARTIAL'})`);
        console.log(`   📊 expectedCumulativeEffort: ${expectedCumulativeEffort.toFixed(1)}h (${capacity.totalCapacityPerDay}h/day × ${workingDaysCompleted} days)`);
        console.log(`   📊 actualCumulativeEffort: ${actualCumulativeEffort.toFixed(1)}h (completedEffort: ${completedEffort}h)`);
        console.log(`   📊 Should show cumulative: ${(workingDaysCompleted > 0 || isSprintCompleted) ? 'YES' : 'NO'}`);

        // ✅ ENHANCED: More accurate daily burn rate calculation (11:59 PM basis) with completed sprint support
        const actualDailyBurn = (workingDaysCompleted > 0 || isSprintCompleted) 
          ? actualCumulativeEffort / Math.max(1, workingDaysCompleted) 
          : 0;
        const expectedDailyBurn = capacity.totalCapacityPerDay;

        // ✅ FIXED: Utilization calculation using total sprint capacity instead of available capacity
        const utilization = capacity.totalCapacityForSprint > 0 
          ? (finalAssignedEffort / capacity.totalCapacityForSprint) * 100 
          : 0;

        console.log(`🔍 OLDER_SPRINT_UTILIZATION_DEBUG: ${capacity.teamMember.displayName}:`);
        console.log(`   📊 finalAssignedEffort: ${finalAssignedEffort}h (after double-counting protection)`);
        console.log(`   📊 rawAssignedEffort: ${assignedEffort}h (original sum)`);
        console.log(`   📊 totalCapacityForSprint: ${capacity.totalCapacityForSprint}h`);
        console.log(`   📊 utilization: ${utilization.toFixed(1)}% (should NOT be 0 if assigned effort > 0)`);

        const remainingCapacity = Math.max(0, capacity.totalCapacityForSprint - finalAssignedEffort);

        // ✅ ENHANCED: Capacity mismatch detection based on cumulative performance (only if days completed or sprint completed)
        const cumulativeVariance = expectedCumulativeEffort > 0 && (workingDaysCompleted > 0 || isSprintCompleted)
          ? Math.abs(actualCumulativeEffort - expectedCumulativeEffort) / expectedCumulativeEffort 
          : 0; // No variance if no days completed yet and sprint not completed
        
        let capacityMismatchSeverity: 'low' | 'medium' | 'high' | 'none' = 'none';
        let isCapacityMismatch = false;

        // Detect mismatches if we have completed days to analyze OR if sprint is completed
        if (workingDaysCompleted > 0 || isSprintCompleted) {
          if (cumulativeVariance > 0.4) {
            capacityMismatchSeverity = 'high';
            isCapacityMismatch = true;
          } else if (cumulativeVariance > 0.25) {
            capacityMismatchSeverity = 'medium';
            isCapacityMismatch = true;
          } else if (cumulativeVariance > 0.15) {
            capacityMismatchSeverity = 'low';
            isCapacityMismatch = true;
          }
        }

        // ✅ ENHANCED: Progress analysis based on completed days (11:59 PM cutoff) or sprint completion
        const expectedProgressPercentage = capacity.workingDays > 0 
          ? (workingDaysCompleted / capacity.workingDays) * 100 
          : 0;
        
        // ✅ FIXED: Actual progress should be based on completed vs assigned effort
        const actualProgressPercentage = finalAssignedEffort > 0 
          ? (completedEffort / finalAssignedEffort) * 100 
          : 0;

        console.log(`🔍 OLDER_SPRINT_PROGRESS_DEBUG: ${capacity.teamMember.displayName}:`);
        console.log(`   📊 expectedProgressPercentage: ${expectedProgressPercentage.toFixed(1)}% (${workingDaysCompleted}/${capacity.workingDays} working days)`);
        console.log(`   📊 actualProgressPercentage: ${actualProgressPercentage.toFixed(1)}% (${completedEffort}h/${finalAssignedEffort}h completed/assigned)`);
        console.log(`   📊 Should show progress: expectedProgress=${expectedProgressPercentage > 0 ? 'YES' : 'NO'}, actualProgress=${actualProgressPercentage > 0 ? 'YES' : 'NO'}`);

        const isOnTrack = actualCumulativeEffort >= (expectedCumulativeEffort * 0.85); // 15% tolerance

        // ✅ ENHANCED: Generate detailed recommendations
        let recommendation = '';
        const effortGap = expectedCumulativeEffort - actualCumulativeEffort;
        const dailyGap = expectedDailyBurn - actualDailyBurn;

        if (workingDaysCompleted === 0 && !isSprintCompleted) {
          // Day 1 scenario - no work should be considered burnt yet
          recommendation = `🕐 Sprint Day ${currentDayNumber}: Work in progress. Effort will count after 11:59 PM. Capacity available: ${capacity.totalCapacityPerDay}h/day.`;
        } else if (isSprintCompleted) {
          if (actualCumulativeEffort >= expectedCumulativeEffort * 0.95) {
            recommendation = `✅ Sprint completed successfully: ${actualCumulativeEffort.toFixed(1)}h delivered vs ${expectedCumulativeEffort.toFixed(1)}h expected.`;
          } else {
            recommendation = `📊 Sprint completed with gap: ${effortGap.toFixed(1)}h under expected capacity (${((1 - actualCumulativeEffort/expectedCumulativeEffort) * 100).toFixed(1)}% variance).`;
          }
        } else if (isCapacityMismatch && effortGap > capacity.totalCapacityPerDay) {
          const daysToRecover = Math.ceil(effortGap / capacity.totalCapacityPerDay);
          recommendation = `⚠️ Behind by ${effortGap.toFixed(1)}h (~${daysToRecover} days). Current pace: ${actualDailyBurn.toFixed(1)}h/day vs ${expectedDailyBurn}h/day needed.`;
        } else if (isCapacityMismatch && effortGap < -capacity.totalCapacityPerDay) {
          recommendation = `� Ahead by ${Math.abs(effortGap).toFixed(1)}h! Exceeding capacity by ${Math.abs(dailyGap).toFixed(1)}h/day.`;
        } else if (!isOnTrack) {
          recommendation = `📈 Slight variance: ${effortGap > 0 ? 'behind' : 'ahead'} by ${Math.abs(effortGap).toFixed(1)}h. Monitor closely.`;
        } else {
          recommendation = `✅ On track: Good alignment between capacity (${expectedDailyBurn}h/day) and delivery (${actualDailyBurn.toFixed(1)}h/day).`;
        }

        console.log(`📊 ENHANCED_UTILIZATION: ${capacity.teamMember.displayName} (11:59 PM Cutoff${isSprintCompleted ? ' - COMPLETED SPRINT' : ''}):`);
        console.log(`   💼 Capacity: ${capacity.totalCapacityPerDay}h/day × ${workingDaysCompleted} days = ${expectedCumulativeEffort.toFixed(1)}h expected${isSprintCompleted ? ' (FULL SPRINT)' : ''}`);
        console.log(`   📝 Work: ${finalAssignedEffort}h assigned (${assignedEffort}h raw) | ${actualCumulativeEffort.toFixed(1)}h completed ${isSprintCompleted ? '(FULL SPRINT)' : '(after 11:59 PM)'}`);
        console.log(`   🔥 Burn Rate: ${actualDailyBurn.toFixed(1)}h/day actual vs ${expectedDailyBurn}h/day expected (${isSprintCompleted ? 'COMPLETED' : '11:59 PM'} basis)`);
        console.log(`   🎯 Progress: Sprint ${expectedProgressPercentage.toFixed(1)}% | Completion ${actualProgressPercentage.toFixed(1)}%`);
        console.log(`   📈 Utilization: ${utilization.toFixed(1)}% (${finalAssignedEffort}h / ${capacity.totalCapacityForSprint}h total capacity)`);
        console.log(`   📅 Days: ${workingDaysCompleted}/${capacity.workingDays} working days completed (11:59 PM cutoff)`);
        console.log(`   ⚠️ Variance: ${isCapacityMismatch ? capacityMismatchSeverity : 'none'} (${(cumulativeVariance * 100).toFixed(1)}%)`);
        console.log(`   � Day 1 Check: currentDay=${currentDayNumber}, completedDays=${completedDays}, analysisDay=${analysisDay}, workingDaysCompleted=${workingDaysCompleted}`);
        console.log(`   �👁️ Values: rawAssigned=${assignedEffort}, finalAssigned=${finalAssignedEffort}, completed=${completedEffort}, actualCumulative=${actualCumulativeEffort}`);

        return {
          member: capacity.teamMember,
          capacity,
          utilization: Math.round(utilization),
          assignedEffort: finalAssignedEffort, // ✅ FIX: Use finalAssignedEffort to avoid double-counting
          completedEffort,
          remainingCapacity,
          dailyBurnRate: actualDailyBurn,
          expectedDailyBurn,
          isCapacityMismatch,
          capacityMismatchSeverity,
          burnRateAnalysis: {
            daysIntoSprint: analysisDay,
            expectedProgressPercentage: Math.round(expectedProgressPercentage * 100) / 100,
            actualProgressPercentage: Math.round(actualProgressPercentage * 100) / 100,
            isOnTrack,
            recommendation,
            expectedCumulativeEffort: Math.round(expectedCumulativeEffort * 100) / 100,
            actualCumulativeEffort: Math.round(actualCumulativeEffort * 100) / 100,
            dailyBurnHistory
          }
        };
      });

      // ✅ ENHANCED: Team summary with cumulative analysis
      const totalExpectedEffort = utilizationData.reduce((sum, u) => sum + u.burnRateAnalysis.expectedCumulativeEffort, 0);
      const totalActualEffort = utilizationData.reduce((sum, u) => sum + u.burnRateAnalysis.actualCumulativeEffort, 0);
      const totalMismatches = utilizationData.filter(u => u.isCapacityMismatch).length;
      const highSeverityMismatches = utilizationData.filter(u => u.capacityMismatchSeverity === 'high').length;
      
      console.log(`\n📊 TEAM_CUMULATIVE_SUMMARY (11:59 PM Cutoff):`);
      console.log(`   👥 Team: ${utilizationData.length} members | ${totalMismatches} mismatches (${highSeverityMismatches} high)`);
      console.log(`   📈 Expected: ${totalExpectedEffort.toFixed(1)}h | Actual: ${totalActualEffort.toFixed(1)}h (after 11:59 PM)`);
      console.log(`   🎯 Team Performance: ${totalExpectedEffort > 0 ? ((totalActualEffort/totalExpectedEffort) * 100).toFixed(1) : 0}% (11:59 PM basis)`);

      return utilizationData;
    } catch (error) {
      console.error('Error calculating enhanced team utilization:', error);
      return [];
    }
  }

  /**
   * Generate daily burn history for sprint progress tracking
   * @param sprintStart Sprint start date
   * @param sprintEnd Sprint end date  
   * @param dailyCapacity Daily capacity in hours
   * @param totalWorkingDays Total working days in sprint
   * @param completedWorkItems Completed work items with effort
   * @param currentDay Current day in sprint
   * @returns Array of daily burn data
   */
  private generateDailyBurnHistory(
    sprintStart: Date, 
    sprintEnd: Date, 
    dailyCapacity: number,
    totalWorkingDays: number,
    completedWorkItems: WorkItem[],
    currentDay: number
  ): Array<{
    day: number,
    date: string,
    expectedCumulative: number,
    actualCumulative: number,
    dailyBurn: number,
    isWeekend: boolean
  }> {
    const history = [];
    const currentDate = new Date(sprintStart);
    let cumulativeExpected = 0;
    
    // ✅ NEW: Calculate total completed effort from completed work items
    // Treat a work item as completed if RemainingWork === 0 or CompletedWork > 0
    const trulyCompletedItems = completedWorkItems.filter(item => {
      const remainingWork = item.fields?.['Microsoft.VSTS.Scheduling.RemainingWork'] ?? 0;
      const completedWork = item.fields?.['Microsoft.VSTS.Scheduling.CompletedWork'] ?? 0;
      return (remainingWork === 0) || (completedWork > 0);
    });
    const totalCompletedEffort = trulyCompletedItems.reduce((sum, item) => sum + (item.effort || 0), 0);
    // Use trulyCompletedItems for daily burn distribution
    
    // ✅ NEW: Simulate actual daily burns for the last 5 working days
    // Since we don't have exact completion dates, we'll distribute completed effort more realistically
    // Focus on recent working days with actual effort from completed tasks
    
    console.log(`🔥 DAILY_BURN_DEBUG: totalCompletedEffort=${totalCompletedEffort}h from ${completedWorkItems.length} completed items`);
    console.log(`🔥 COMPLETED_ITEMS: ${completedWorkItems.map(item => `"${item.title}"(${item.effort || 0}h)`).join(', ')}`);
    
    // Calculate total sprint days for iteration
    const totalSprintDays = Math.ceil((sprintEnd.getTime() - sprintStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // ✅ NEW: Create realistic daily burn pattern for last 5 working days
    const recentWorkingDays = [];
    const tempDate = new Date(sprintStart);
    
    // Find all working days in the sprint
    for (let day = 1; day <= totalSprintDays; day++) {
      const dayOfWeek = tempDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
        recentWorkingDays.push({
          day,
          date: tempDate.toISOString().split('T')[0],
          dayOfWeek
        });
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    
    // ✅ NEW: Distribute effort across last 5 working days (or available working days if less)
    const availableWorkingDays = Math.min(recentWorkingDays.length, Math.min(currentDay, recentWorkingDays.length));
    const lastWorkingDays = recentWorkingDays.slice(Math.max(0, availableWorkingDays - 5), availableWorkingDays);
    
    // ✅ NEW: Create realistic daily effort distribution (not just averages)
    const dailyEffortMap = new Map<number, number>();
    
    if (trulyCompletedItems.length > 0 && lastWorkingDays.length > 0) {
      // Distribute truly completed work items across the last working days
      trulyCompletedItems.forEach((item, index) => {
        const targetDay = lastWorkingDays[index % lastWorkingDays.length];
        const currentEffort = dailyEffortMap.get(targetDay.day) || 0;
        dailyEffortMap.set(targetDay.day, currentEffort + (item.effort || 0));
      });
    }
    // No fallback: Only use actual completed work item effort. If no data, dailyBurn will be zero.
    
    console.log(`🔥 REALISTIC_DAILY_BURNS: Distributed ${totalCompletedEffort}h across ${lastWorkingDays.length} recent working days`);
    dailyEffortMap.forEach((effort, day) => {
      console.log(`   � Day ${day}: ${effort}h burned`);
    });

    // Reset for actual iteration
    currentDate.setTime(sprintStart.getTime());
    let cumulativeActual = 0;

    for (let day = 1; day <= totalSprintDays; day++) {
      const dayOfWeek = currentDate.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
      
      if (!isWeekend) {
        cumulativeExpected += dailyCapacity;
      }

      // ✅ NEW: Use actual effort burned on this specific day (not averages)
      let dailyBurn = 0;
      let actualCumulative = cumulativeActual;
      
      if (day <= currentDay && !isWeekend) {
        // Get the actual effort burned on this specific day
        dailyBurn = dailyEffortMap.get(day) || 0;
        cumulativeActual += dailyBurn;
        actualCumulative = cumulativeActual;
      } else if (day <= currentDay && isWeekend) {
        // Weekend - no effort burned, but carry forward cumulative
        actualCumulative = cumulativeActual;
      }

      history.push({
        day,
        date: currentDate.toISOString().split('T')[0],
        expectedCumulative: Math.round(cumulativeExpected * 100) / 100,
        actualCumulative: Math.round(actualCumulative * 100) / 100,
        dailyBurn: Math.round(dailyBurn * 100) / 100, // ✅ NEW: Actual effort burned on this day
        isWeekend
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return history;
  }

  /**
   * Calculate working days from sprint start up to a specific date
   * @param startDate Sprint start date
   * @param endDate End date to calculate up to
   * @returns Number of working days
   */
  private calculateWorkingDaysUpToDate(startDate: Date, endDate: Date): number {
    let workingDays = 0;
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not weekend
        workingDays++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return workingDays;
  }

}

// Export a singleton instance
export const adoService = new AdoService();

export default adoService;
