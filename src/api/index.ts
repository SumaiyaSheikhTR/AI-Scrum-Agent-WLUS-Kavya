import axios from 'axios';

// Define the base URL for the API
const API_BASE_URL = 'http://localhost:8000';

// Create an axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define interfaces for API responses
export interface WorkItem {
  id: number;
  title: string;
  state: string;
  assigned_to: string | null;
  effort: number | null;
  last_updated: string;
  tags: string[];
  fields?: { [key: string]: any };
}

export interface SprintSummary {
  sprint_name: string;
  start_date: string;
  end_date: string;
  total_items: number;
  completed_items: number;
  in_progress_items: number;
  blocked_items: number;
  progress_percentage: number;
}

export interface SprintMetrics {
  burndown: {
    remaining_effort: number;
    ideal_effort: number;
    dates: string[];
    actual_values: number[];
    ideal_values: number[];
  };
  velocity: {
    current: number;
    average: number;
    history: number[];
  };
  capacity: {
    total_hours: number;
    used_hours: number;
    percentage: number;
  };
}

// API functions
export const api = {
  // Work Items
  getTasks: async (): Promise<WorkItem[]> => {
    const response = await apiClient.get('/tasks');
    return response.data;
  },

  // Sprint Summary
  getSummary: async (): Promise<SprintSummary> => {
    const response = await apiClient.get('/summary');
    return response.data;
  },

  // Sprint Summary as text
  getSummaryText: async (): Promise<string> => {
    const response = await apiClient.get('/summary/text');
    return response.data.summary;
  },

  // Stale Items
  getStaleItems: async (): Promise<WorkItem[]> => {
    const response = await apiClient.get('/stale');
    return response.data;
  },

  // Sprint Metrics
  getMetrics: async (): Promise<SprintMetrics> => {
    const response = await apiClient.get('/metrics');
    return response.data;
  },

  // Process Rules for Work Item
  processRules: async (workItemId: number): Promise<any> => {
    const response = await apiClient.post(`/process-rules/workitem/${workItemId}`);
    return response.data;
  },

  // Send Chat Message to AI Assistant
  sendChatMessage: async (message: string): Promise<{ answer: string; cost_tracker: any }> => {
    const response = await apiClient.post('/chat', { message });
    return response.data;
  },

  // Update Work Item
  updateWorkItem: async (workItemId: number, updates: any): Promise<WorkItem> => {
    const response = await apiClient.patch(`/work-items/${workItemId}`, updates);
    return response.data;
  },

  // Add Comment to Work Item
  addComment: async (workItemId: number, comment: string): Promise<any> => {
    const response = await apiClient.post(`/work-items/${workItemId}/comments`, { comment });
    return response.data;
  },
};

export default api;
