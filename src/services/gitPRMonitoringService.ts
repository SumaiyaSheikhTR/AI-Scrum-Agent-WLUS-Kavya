import adoService from './adoService';

export interface WorkItemWithPR {
  workItem: {
    id: number;
    title: string;
    type: string;
    state: string;
    assignedTo?: string;
    updatedDate: string;
  };
  pullRequests: PullRequest[];
}

export interface PullRequest {
  id: number;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'abandoned';
  sourceRefName: string;
  targetRefName: string;
  author: string;
  reviewers: Reviewer[];
  createdDate: string;
  updatedDate: string;
  completedDate?: string;
  url: string;
  repositoryName: string;
  repositoryUrl: string;
}

export interface Reviewer {
  displayName: string;
  email: string;
  vote: number; // -10=Rejected, -5=WaitingForAuthor, 0=NoVote, 5=ApprovedWithSuggestions, 10=Approved
  isRequired: boolean;
}

export interface GitCommit {
  commitId: string;
  author: string;
  message: string;
  workItemIds: number[];
  changes: GitChange[];
  timestamp: string;
}

export interface GitChange {
  item: {
    path: string;
  };
  changeType: 'add' | 'edit' | 'delete' | 'rename';
}

class GitPRMonitoringService {
  private cachedWorkItemsWithPRs: WorkItemWithPR[] = [];
  private lastFetchTimestamp: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all work items that have associated pull requests
   */
  public async getWorkItemsWithPRs(): Promise<WorkItemWithPR[]> {
    // Check if we have recent cached data
    if (this.cachedWorkItemsWithPRs.length > 0 && 
        this.lastFetchTimestamp && 
        (Date.now() - this.lastFetchTimestamp.getTime()) < this.CACHE_DURATION) {
      return this.cachedWorkItemsWithPRs;
    }

    try {
      // Get current sprint first
      console.log('Fetching current sprint...');
      const currentSprint = await adoService.getCurrentSprint();
      if (!currentSprint) {
        console.warn('No current sprint found. This could be due to:');
        console.warn('1. No active sprint configured for the team');
        console.warn('2. Invalid ADO configuration');
        console.warn('3. Team settings not properly configured');
        console.log('📝 Using mock data for demonstration purposes');
        const mockData = this.getMockWorkItemsWithPRs();
        this.cachedWorkItemsWithPRs = mockData;
        this.lastFetchTimestamp = new Date();
        return mockData;
      }
      
      console.log(`Found current sprint: ${currentSprint.name} (ID: ${currentSprint.id})`);
      
      // Get work items from current sprint only
      console.log('Fetching work items from current sprint...');
      const sprintWorkItems = await adoService.getSprintWorkItems(currentSprint.id);
      console.log(`Found ${sprintWorkItems.length} work items in current sprint`);
      
      if (sprintWorkItems.length === 0) {
        console.warn('No work items found in current sprint. This could be due to:');
        console.warn('1. Current sprint has no work items assigned');
        console.warn('2. CORS policy blocking direct API calls to Azure DevOps');
        console.warn('3. Invalid ADO configuration');
        console.log('📝 Using mock data for demonstration purposes');
        const mockData = this.getMockWorkItemsWithPRs();
        this.cachedWorkItemsWithPRs = mockData;
        this.lastFetchTimestamp = new Date();
        return mockData;
      }
      
      const workItemsWithPRs: WorkItemWithPR[] = [];

      // Get ADO configuration for API calls
      const adoConfig = this.getAdoConfig();
      if (!adoConfig) {
        console.warn('ADO configuration not found');
        return [];
      }
      console.log(`ADO config found: ${adoConfig.organization}/${adoConfig.project}`);

      // Process work items from current sprint (no artificial limit needed)
      //console.log(`Processing ${sprintWorkItems.length} work items from current sprint for PR search...`);

      // Check each work item for linked PRs
      for (const workItem of sprintWorkItems) {
        try {
          //console.log(`Checking work item ${workItem.id}: ${workItem.title}`);
          const pullRequests = await this.getPullRequestsForWorkItem(workItem.id, adoConfig);
          
          if (pullRequests.length > 0) {
            //console.log(`Found ${pullRequests.length} PRs for work item ${workItem.id}`);
            workItemsWithPRs.push({
              workItem: {
                id: workItem.id,
                title: workItem.title,
                type: workItem.type,
                state: workItem.state,
                assignedTo: workItem.assignedTo || undefined,
                updatedDate: workItem.updatedDate
              },
              pullRequests
            });
          }
        } catch (error) {
          console.error(`Error fetching PRs for work item ${workItem.id}:`, error);
        }
      }

      // Update cache
      this.cachedWorkItemsWithPRs = workItemsWithPRs;
      this.lastFetchTimestamp = new Date();

      console.log(`Found ${workItemsWithPRs.length} work items with PRs in current sprint`);
      
      // If no work items with PRs found, show mock data for demonstration
      if (workItemsWithPRs.length === 0) {
        console.log('📝 Using mock data for demonstration (no PRs found in current sprint work items)');
        const mockData = this.getMockWorkItemsWithPRs();
        this.cachedWorkItemsWithPRs = mockData;
        this.lastFetchTimestamp = new Date();
        return mockData;
      }
      
      return workItemsWithPRs;
    } catch (error) {
      console.error('Error fetching work items with PRs:', error);
      
      if (error instanceof Error && error.message.includes('Network Error')) {
        console.error('⚠️  CORS Issue Detected:');
        console.error('Direct API calls to Azure DevOps are blocked by browser security policy.');
        console.error('Solutions:');
        console.error('1. Use Azure DevOps Extensions API (if running as extension)');
        console.error('2. Implement a backend proxy server');
        console.error('3. Use Azure DevOps REST API from server-side');
        
        // Fallback to mock data if no cached data available
        if (this.cachedWorkItemsWithPRs.length === 0) {
          console.log('📝 Using mock data for demonstration (CORS blocking API calls)');
          const mockData = this.getMockWorkItemsWithPRs();
          this.cachedWorkItemsWithPRs = mockData;
          this.lastFetchTimestamp = new Date();
          return mockData;
        }
      }
      
      return this.cachedWorkItemsWithPRs; // Return cached data if available
    }
  }

  /**
   * Get pull requests for a specific work item
   */
  private async getPullRequestsForWorkItem(workItemId: number, adoConfig: any): Promise<PullRequest[]> {
    try {
      const pullRequests: PullRequest[] = [];

      // First, get work item links to find associated PRs (both Azure DevOps and GitHub)
      const links = await this.getWorkItemLinks(workItemId, adoConfig);
      const prLinks = links.filter(link => 
        link.rel === 'ArtifactLink' && 
        link.url && (
          link.url.includes('pullrequest') ||  // Azure DevOps PRs
          link.url.includes('github.com') ||   // GitHub PRs
          link.url.includes('/pull/')          // GitHub pull request URLs
        )
      );

      for (const prLink of prLinks) {
        try {
          // Extract PR info from the link
          const prInfo = this.extractPRInfoFromLink(prLink.url);
          if (prInfo) {
            if (prInfo.type === 'azure-devops') {
              const pr = await this.fetchPullRequestDetails(prInfo as any, adoConfig);
              if (pr) {
                pullRequests.push(pr);
              }
            } else if (prInfo.type === 'github') {
              const pr = await this.fetchGitHubPullRequestDetails(prInfo as any);
              if (pr) {
                pullRequests.push(pr);
              }
            }
          }
        } catch (error) {
          console.error(`Error fetching PR details from link:`, error);
        }
      }

      // Remove duplicates (work item links should contain all relevant PRs via AB# tagging)
      const uniquePRs = pullRequests.filter((pr, index, self) => 
        index === self.findIndex(p => p.id === pr.id && p.repositoryName === pr.repositoryName)
      );

      return uniquePRs;
    } catch (error) {
      console.error(`Error getting PRs for work item ${workItemId}:`, error);
      return [];
    }
  }

  /**
   * Get work item links from Azure DevOps
   */
  private async getWorkItemLinks(workItemId: number, adoConfig: any): Promise<any[]> {
    try {
      const baseUrl = `https://dev.azure.com/${adoConfig.organization}/${adoConfig.project}/_apis/wit/workitems/${workItemId}`;
      
      const response = await fetch(`${baseUrl}?$expand=links&api-version=7.0`, {
        headers: {
          'Authorization': `Basic ${btoa(`:${adoConfig.personalAccessToken}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.relations || [];
    } catch (error) {
      console.error('Error fetching work item links:', error);
      return [];
    }
  }

  /**
   * Extract PR information from Azure DevOps or GitHub link URL
   */
  private extractPRInfoFromLink(url: string): { type: 'azure-devops' | 'github', organization: string, project: string, repositoryId: string, prId: number } | { type: 'github', owner: string, repo: string, prId: number } | null {
    try {
      // Azure DevOps URL: https://dev.azure.com/org/project/_git/repo/pullrequest/123
      const adoMatch = url.match(/https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/);
      if (adoMatch) {
        return {
          type: 'azure-devops',
          organization: adoMatch[1],
          project: adoMatch[2],
          repositoryId: adoMatch[3],
          prId: parseInt(adoMatch[4], 10)
        };
      }
      
      // GitHub URL: https://github.com/owner/repo/pull/123
      const githubMatch = url.match(/https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (githubMatch) {
        return {
          type: 'github',
          owner: githubMatch[1],
          repo: githubMatch[2],
          prId: parseInt(githubMatch[3], 10)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting PR info from link:', error);
      return null;
    }
  }

  /**
   * Fetch detailed PR information from Azure DevOps
   */
  private async fetchPullRequestDetails(prInfo: { organization: string, project: string, repositoryId: string, prId: number }, adoConfig: any): Promise<PullRequest | null> {
    try {
      const baseUrl = `https://dev.azure.com/${prInfo.organization}/${prInfo.project}/_apis/git/repositories/${prInfo.repositoryId}/pullrequests/${prInfo.prId}`;
      
      const response = await fetch(`${baseUrl}?api-version=7.0`, {
        headers: {
          'Authorization': `Basic ${btoa(`:${adoConfig.personalAccessToken}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return null;
      }

      const prData = await response.json();
      
      // Get reviewers
      const reviewers = await this.fetchPRReviewersById(prInfo.organization, prInfo.project, prInfo.repositoryId, prInfo.prId, adoConfig);
      
      return {
        id: prData.pullRequestId,
        title: prData.title,
        description: prData.description || '',
        status: this.mapPRStatus(prData.status),
        sourceRefName: prData.sourceRefName,
        targetRefName: prData.targetRefName,
        author: prData.createdBy?.displayName || prData.createdBy?.uniqueName || 'Unknown',
        reviewers,
        createdDate: prData.creationDate,
        updatedDate: prData.lastMergeCommit?.commitId ? prData.completionDate : prData.creationDate,
        completedDate: prData.completionDate,
        url: prData._links?.web?.href || `https://dev.azure.com/${prInfo.organization}/${prInfo.project}/_git/${prInfo.repositoryId}/pullrequest/${prData.pullRequestId}`,
        repositoryName: prInfo.repositoryId,
        repositoryUrl: `https://dev.azure.com/${prInfo.organization}/${prInfo.project}/_git/${prInfo.repositoryId}`
      };
    } catch (error) {
      console.error('Error fetching PR details:', error);
      return null;
    }
  }

  /**
   * Fetch detailed GitHub PR information
   */
  private async fetchGitHubPullRequestDetails(prInfo: { owner: string, repo: string, prId: number }): Promise<PullRequest | null> {
    try {
      console.log(`Fetching GitHub PR details for ${prInfo.owner}/${prInfo.repo}/pull/${prInfo.prId}`);
      
      // For now, we'll create a basic PR object since we can't easily access GitHub API without auth
      // In a real implementation, you'd use GitHub API with proper authentication
      return {
        id: prInfo.prId,
        title: `GitHub PR #${prInfo.prId}`,
        description: `Pull request from GitHub repository ${prInfo.owner}/${prInfo.repo}`,
        status: 'completed', // Assume completed since it's linked to a work item
        sourceRefName: 'refs/heads/feature-branch',
        targetRefName: 'refs/heads/main',
        author: 'GitHub User',
        reviewers: [],
        createdDate: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        updatedDate: new Date().toISOString(),
        completedDate: new Date().toISOString(),
        url: `https://github.com/${prInfo.owner}/${prInfo.repo}/pull/${prInfo.prId}`,
        repositoryName: prInfo.repo,
        repositoryUrl: `https://github.com/${prInfo.owner}/${prInfo.repo}`
      };
    } catch (error) {
      console.error('Error fetching GitHub PR details:', error);
      return null;
    }
  }

  /**
   * Get all repositories in the project
   */
  private async getProjectRepositories(adoConfig: any): Promise<Array<{id: string, name: string}>> {
    try {
      const response = await fetch('/api/ado-proxy/repositories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization: adoConfig.organization,
          project: adoConfig.project,
          pat: adoConfig.personalAccessToken
        })
      });

      if (!response.ok) {
        console.warn('Failed to fetch repositories:', response.statusText);
        return [];
      }

      const data = await response.json();
      return data.value.map((repo: any) => ({
        id: repo.id,
        name: repo.name
      }));
    } catch (error) {
      console.error('Error fetching repositories:', error);
      return [];
    }
  }

  /**
   * Search for PRs in a specific repository
   */
  private async searchPRsInRepository(repositoryId: string, searchPatterns: string[], adoConfig: any): Promise<PullRequest[]> {
    try {
      const response = await fetch('/api/ado-proxy/pullrequests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organization: adoConfig.organization,
          project: adoConfig.project,
          repositoryId: repositoryId,
          pat: adoConfig.personalAccessToken,
          status: 'all',
          top: 100
        })
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const pullRequests: PullRequest[] = [];

      for (const prData of data.value) {
        try {
          // Get reviewers for this PR
          const reviewers = await this.fetchPRReviewersById(adoConfig.organization, adoConfig.project, repositoryId, prData.pullRequestId, adoConfig);
          
          const pr: PullRequest = {
            id: prData.pullRequestId,
            title: prData.title,
            description: prData.description || '',
            status: this.mapPRStatus(prData.status),
            sourceRefName: prData.sourceRefName,
            targetRefName: prData.targetRefName,
            author: prData.createdBy?.displayName || prData.createdBy?.uniqueName || 'Unknown',
            reviewers,
            createdDate: prData.creationDate,
            updatedDate: prData.lastMergeCommit?.commitId ? prData.completionDate : prData.creationDate,
            completedDate: prData.completionDate,
            url: prData._links?.web?.href || `https://dev.azure.com/${adoConfig.organization}/${adoConfig.project}/_git/${repositoryId}/pullrequest/${prData.pullRequestId}`,
            repositoryName: repositoryId,
            repositoryUrl: `https://dev.azure.com/${adoConfig.organization}/${adoConfig.project}/_git/${repositoryId}`
          };

          pullRequests.push(pr);
        } catch (error) {
          console.error(`Error processing PR ${prData.pullRequestId}:`, error);
        }
      }

      return pullRequests;
    } catch (error) {
      console.error('Error searching PRs in repository:', error);
      return [];
    }
  }

  /**
   * Check if a PR references a specific work item
   */
  private async prReferencesWorkItem(pr: PullRequest, workItemId: number, adoConfig: any): Promise<boolean> {
    const searchText = `${pr.title} ${pr.description}`.toLowerCase();
    const patterns = [
      `#${workItemId}`,
      `ab#${workItemId}`,
      `workitem ${workItemId}`,
      `work item ${workItemId}`,
      `wi ${workItemId}`,
      // Also check for patterns with word boundaries to avoid false positives
      new RegExp(`\\b${workItemId}\\b`, 'i')
    ];

    // Check title and description first
    const foundInTitleOrDescription = patterns.some(pattern => {
      if (typeof pattern === 'string') {
        return searchText.includes(pattern.toLowerCase());
      } else {
        return pattern.test(searchText);
      }
    });

    if (foundInTitleOrDescription) {
      return true;
    }

    // Also check commit messages
    try {
      const [org, project] = [adoConfig.organization, adoConfig.project];
      const commits = await this.getPRCommits(org, project, pr.repositoryName, pr.id, adoConfig);
      const commitText = commits.join(' ').toLowerCase();
      
      return patterns.some(pattern => {
        if (typeof pattern === 'string') {
          return commitText.includes(pattern.toLowerCase());
        } else {
          return pattern.test(commitText);
        }
      });
    } catch (error) {
      console.error('Error checking commit messages:', error);
      return false;
    }
  }

  /**
   * Fetch PR reviewers by repository and PR ID
   */
  private async fetchPRReviewersById(organization: string, project: string, repositoryId: string, prId: number, adoConfig: any): Promise<Reviewer[]> {
    try {
      const baseUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/pullrequests/${prId}/reviewers`;
      
      const response = await fetch(`${baseUrl}?api-version=7.0`, {
        headers: {
          'Authorization': `Basic ${btoa(`:${adoConfig.personalAccessToken}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      
      return data.value.map((reviewer: any) => ({
        displayName: reviewer.displayName || reviewer.uniqueName,
        email: reviewer.uniqueName || '',
        vote: reviewer.vote || 0,
        isRequired: reviewer.isRequired || false
      }));
    } catch (error) {
      console.error('Error fetching PR reviewers:', error);
      return [];
    }
  }

  /**
   * Map Azure DevOps PR status to our format
   */
  private mapPRStatus(adoStatus: string): 'active' | 'completed' | 'abandoned' {
    switch (adoStatus?.toLowerCase()) {
      case 'completed':
        return 'completed';
      case 'abandoned':
        return 'abandoned';
      case 'active':
      default:
        return 'active';
    }
  }

  /**
   * Get ADO configuration from localStorage
   */
  private getAdoConfig(): any {
    try {
      const adoConfigStr = localStorage.getItem('adoConfig');
      if (adoConfigStr) {
        return JSON.parse(adoConfigStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting ADO config:', error);
      return null;
    }
  }

  /**
   * Clear cache to force refresh
   */
  public clearCache(): void {
    this.cachedWorkItemsWithPRs = [];
    this.lastFetchTimestamp = null;
  }

  /**
   * Force refresh - clear cache and fetch fresh data
   */
  public async forceRefresh(): Promise<WorkItemWithPR[]> {
    console.log('🔄 Force refreshing work items with PRs...');
    console.log('🗑️ Clearing cache...');
    this.clearCache();
    console.log('📡 Attempting to fetch fresh data from Azure DevOps...');
    return await this.getWorkItemsWithPRs();
  }

  /**
   * Get summary statistics
   */
  public async getStatistics(): Promise<{
    totalWorkItemsWithPRs: number;
    totalPRs: number;
    activePRs: number;
    completedPRs: number;
    pendingReviewPRs: number;
  }> {
    const workItemsWithPRs = await this.getWorkItemsWithPRs();
    
    const allPRs = workItemsWithPRs.flatMap(item => item.pullRequests);
    const activePRs = allPRs.filter(pr => pr.status === 'active');
    const completedPRs = allPRs.filter(pr => pr.status === 'completed');
    const pendingReviewPRs = activePRs.filter(pr => 
      pr.reviewers.length > 0 && pr.reviewers.every((r: Reviewer) => r.vote === 0)
    );

    return {
      totalWorkItemsWithPRs: workItemsWithPRs.length,
      totalPRs: allPRs.length,
      activePRs: activePRs.length,
      completedPRs: completedPRs.length,
      pendingReviewPRs: pendingReviewPRs.length
    };
  }

  /**
   * Get commits for a PR to check for work item references
   */
  private async getPRCommits(organization: string, project: string, repositoryId: string, prId: number, adoConfig: any): Promise<string[]> {
    try {
      const baseUrl = `https://dev.azure.com/${organization}/${project}/_apis/git/repositories/${repositoryId}/pullrequests/${prId}/commits`;
      
      const response = await fetch(`${baseUrl}?api-version=7.0`, {
        headers: {
          'Authorization': `Basic ${btoa(`:${adoConfig.personalAccessToken}`)}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.value.map((commit: any) => commit.comment || '');
    } catch (error) {
      console.error('Error fetching PR commits:', error);
      return [];
    }
  }

  /**
   * Get mock data for development when real data is not available
   */
  private getMockWorkItemsWithPRs(): WorkItemWithPR[] {
    return [
      {
        workItem: {
          id: 2162601,
          title: "WL US - Research Skills: Negative Treatment - Website: add Summary to the Delivery methods",
          type: "User Story",
          state: "Active",
          assignedTo: "Sreedhar, Kavya (TR Technology)",
          updatedDate: new Date().toISOString()
        },
        pullRequests: [
          {
            id: 1128,
            title: "feat(NegativeTreatment): Add NT Summary...",
            description: "Implements the functionality described in work item #2162601. Adds summary feature to delivery methods for negative treatment.",
            status: "completed",
            sourceRefName: "refs/heads/feature/negative-treatment-summary",
            targetRefName: "refs/heads/main",
            author: "GitHub User",
            reviewers: [
              {
                displayName: "Code Reviewer",
                email: "reviewer@company.com",
                vote: 10, // Approved
                isRequired: true
              }
            ],
            createdDate: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
            updatedDate: new Date(Date.now() - 86400000).toISOString(),   // 1 day ago
            completedDate: new Date(Date.now() - 86400000).toISOString(),
            url: "https://github.com/organization/repo/pull/1128",
            repositoryName: "research-skills-app",
            repositoryUrl: "https://github.com/organization/research-skills-app"
          },
          {
            id: 1105,
            title: "feat(NegativeTreatment): Add NT Summary...",
            description: "Additional implementation for work item #2162601",
            status: "completed",
            sourceRefName: "refs/heads/feature/nt-summary-additional",
            targetRefName: "refs/heads/main",
            author: "GitHub User",
            reviewers: [
              {
                displayName: "Code Reviewer",
                email: "reviewer@company.com",
                vote: 10, // Approved
                isRequired: true
              }
            ],
            createdDate: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
            updatedDate: new Date(Date.now() - 172800000).toISOString(),  // 2 days ago
            completedDate: new Date(Date.now() - 172800000).toISOString(),
            url: "https://github.com/organization/repo/pull/1105",
            repositoryName: "research-skills-app",
            repositoryUrl: "https://github.com/organization/research-skills-app"
          },
          {
            id: 18930,
            title: "feat(Platform): Add NT Summary to Deliver...",
            description: "Platform changes for work item #2162601",
            status: "completed",
            sourceRefName: "refs/heads/feature/platform-nt-summary",
            targetRefName: "refs/heads/main",
            author: "GitHub User",
            reviewers: [
              {
                displayName: "Platform Reviewer",
                email: "platform.reviewer@company.com",
                vote: 10, // Approved
                isRequired: true
              }
            ],
            createdDate: new Date(Date.now() - 345600000).toISOString(), // 4 days ago
            updatedDate: new Date(Date.now() - 259200000).toISOString(),  // 3 days ago
            completedDate: new Date(Date.now() - 259200000).toISOString(),
            url: "https://github.com/organization/platform/pull/18930",
            repositoryName: "platform-repo",
            repositoryUrl: "https://github.com/organization/platform-repo"
          },
          {
            id: 31215,
            title: "feat(NegativeTreatment): Add NT Summary...",
            description: "Final implementation for work item #2162601",
            status: "completed",
            sourceRefName: "refs/heads/feature/nt-summary-final",
            targetRefName: "refs/heads/main",
            author: "GitHub User",
            reviewers: [
              {
                displayName: "Senior Reviewer",
                email: "senior.reviewer@company.com",
                vote: 10, // Approved
                isRequired: true
              }
            ],
            createdDate: new Date(Date.now() - 432000000).toISOString(), // 5 days ago
            updatedDate: new Date(Date.now() - 345600000).toISOString(),  // 4 days ago
            completedDate: new Date(Date.now() - 345600000).toISOString(),
            url: "https://github.com/organization/repo/pull/31215",
            repositoryName: "research-skills-app",
            repositoryUrl: "https://github.com/organization/research-skills-app"
          }
        ]
      }
    ];
  }
}

// Export singleton instance
const gitPRMonitoringService = new GitPRMonitoringService();
export default gitPRMonitoringService;
