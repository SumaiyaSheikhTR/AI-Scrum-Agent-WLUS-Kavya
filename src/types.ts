// Common types used throughout the application

export interface TeamMember {
  id: string;
  displayName: string;
  uniqueName: string;
  email?: string;
  imageUrl?: string;
  role?: string;
  skills?: string[];
}

export interface TeamCapacity {
  teamMember: TeamMember;
  totalCapacityForSprint: number;
  totalAvailableCapacity: number;
  allocatedCapacity: number;
  activities?: {
    name: string;
    capacityPerDay: number;
  }[];
  daysOff?: {
    start: string;
    end: string;
  }[];
  workingDays?: number;
}

export interface WorkItem {
  id: string | number;
  title: string;
  state: string;
  assignedTo?: string | TeamMember;
  storyPoints?: number;
  effort?: number | null;
  priority?: number | null;
  type?: string;
  description?: string | null; // Changed to match adoService
  tags?: string[];
  url?: string;
  createdDate?: string;
  updatedDate?: string;
  parentId?: number | null;
  gitCommits?: string[];
  pullRequests?: string[];
  relations?: any[];
  fields?: { [key: string]: any };
  // Additional fields for ActivityMonitoringPanel
  activatedDate?: string;
  completedDate?: string;
  closedDate?: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string | Date;
  endDate: string | Date;
  path?: string;
  state?: 'future' | 'current' | 'past';
  workItems?: WorkItem[];
  goal?: string;
}

export interface WorkItemComment {
  id: string;
  text: string;
  author: string;
  timestamp: string;
  workItemId: number;
  workItemTitle: string;
}