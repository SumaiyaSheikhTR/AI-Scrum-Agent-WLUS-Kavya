import { WorkItem, TeamMember, TeamCapacity } from './adoService';
import { ThomsonReutersOpenAIService } from './thomsonReutersOpenAiService';

export interface AdhocAssignmentRequest {
  bugTitle?: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  estimatedEffort?: number;
  description?: string;
  tags?: string[];
}

export interface TeamMemberAnalysis {
  member: TeamMember;
  currentCapacity: number;
  remainingCapacity: number;
  utilizationPercent: number;
  activeTasks: WorkItem[];
  completedTasks: WorkItem[];
  skillMatch: number; // 0-100
  availabilityScore: number; // 0-100
  pastPerformance: {
    completionRate: number;
    avgTaskTime: number;
    bugFixExperience: number;
  };
  recommendation: string;
  confidence: number; // 0-100
}

export interface AdhocAssignmentResponse {
  unassignedItems: WorkItem[];
  recommendedAssignees: TeamMemberAnalysis[];
  selectedAdhocItem?: WorkItem;
  visualizationData: {
    teamCapacityChart: any[];
    workloadDistribution: any[];
    priorityMatrix: any[];
  };
  conversationalResponse: string;
}

export class EnhancedAdhocAssignmentService {
  constructor(
    private thomsonReutersOpenAIService: ThomsonReutersOpenAIService
  ) {}

  async processAdhocAssignmentRequest(
    message: string,
    teamMembers: TeamMember[],
    teamCapacity: TeamCapacity[],
    sprintWorkItems: WorkItem[],
    sprint: any
  ): Promise<AdhocAssignmentResponse> {
    
    // Step 1: Identify unassigned items
    const unassignedItems = this.getUnassignedItems(sprintWorkItems);
    
    // Step 2: Analyze team capacity and availability
    const teamAnalysis = await this.analyzeTeamCapacity(
      teamMembers, 
      teamCapacity, 
      sprintWorkItems, 
      sprint
    );
    
    // Step 3: Generate AI-powered recommendations
    const aiRecommendations = await this.generateAIRecommendations(
      message,
      teamAnalysis,
      unassignedItems,
      sprint
    );
    
    // Step 4: Create visualization data
    const visualizationData = this.createVisualizationData(teamAnalysis, unassignedItems);
    
    // Step 5: Generate conversational response
    const conversationalResponse = await this.generateConversationalResponse(
      message,
      aiRecommendations,
      unassignedItems,
      teamAnalysis
    );
    
    return {
      unassignedItems,
      recommendedAssignees: aiRecommendations,
      visualizationData,
      conversationalResponse
    };
  }

  private getUnassignedItems(workItems: WorkItem[]): WorkItem[] {
    return workItems.filter(item => 
      !item.assignedTo || 
      item.assignedTo === '' || 
      item.assignedTo === null
    ).sort((a, b) => {
      // Sort by priority - handle the fact that priority is number | null in WorkItem
      const aPriority = a.priority || 0;
      const bPriority = b.priority || 0;
      return bPriority - aPriority; // Higher numbers = higher priority
    });
  }

  private async analyzeTeamCapacity(
    teamMembers: TeamMember[],
    teamCapacity: TeamCapacity[],
    workItems: WorkItem[],
    sprint: any
  ): Promise<TeamMemberAnalysis[]> {
    
    return await Promise.all(teamMembers.map(async (member) => {
      const capacity = teamCapacity.find(tc => tc.teamMember.id === member.id);
      const memberItems = workItems.filter(item => this.isAssignedToMember(item, member));
      
      const currentCapacity = capacity?.totalCapacityForSprint || 0;
      const assignedEffort = memberItems.reduce((sum, item) => sum + (item.effort || 0), 0);
      const remainingCapacity = Math.max(0, currentCapacity - assignedEffort);
      const utilizationPercent = currentCapacity > 0 ? Math.min(100, (assignedEffort / currentCapacity) * 100) : 0;
      
      const activeTasks = memberItems.filter(item => 
        item.state === 'Active' || item.state === 'In Progress'
      );
      const completedTasks = memberItems.filter(item => 
        item.state === 'Closed' || item.state === 'Completed' || item.state === 'Done'
      );
      
      const skillMatch = await this.calculateSkillMatch(member, memberItems);
      const availabilityScore = this.calculateAvailabilityScore(utilizationPercent, activeTasks.length);
      const pastPerformance = this.calculatePastPerformance(memberItems, completedTasks);
      
      const recommendation = await this.generateMemberRecommendation(
        member, utilizationPercent, remainingCapacity, activeTasks, pastPerformance
      );
      
      const confidence = this.calculateConfidence(skillMatch, availabilityScore, pastPerformance);
      
      return {
        member,
        currentCapacity,
        remainingCapacity,
        utilizationPercent,
        activeTasks,
        completedTasks,
        skillMatch,
        availabilityScore,
        pastPerformance,
        recommendation,
        confidence
      };
    }));
  }

  private isAssignedToMember(item: WorkItem, member: TeamMember): boolean {
    if (!item.assignedTo) return false;
    
    if (typeof item.assignedTo === 'string') {
      return item.assignedTo === member.id || 
             item.assignedTo.includes(member.displayName) ||
             item.assignedTo.includes(member.uniqueName);
    }
    
    const assignedToObj = item.assignedTo as any;
    return assignedToObj.id === member.id || 
           assignedToObj.displayName === member.displayName;
  }

  private async calculateSkillMatch(member: TeamMember, memberItems: WorkItem[]): Promise<number> {
    // Analyze member's work history to determine skill areas
    const workItemTypes = memberItems.map(item => item.type).filter(Boolean);
    
    // Simple heuristic - members who have worked on bugs before are more likely to be good at bugs
    const bugExperience = workItemTypes.filter(type => type?.toLowerCase().includes('bug')).length;
    const totalItems = memberItems.length;
    
    if (totalItems === 0) return 50; // Default middle score for new members
    
    return Math.min(100, Math.max(0, (bugExperience / totalItems) * 100 + 30)); // Base score + experience
  }

  private calculateAvailabilityScore(utilizationPercent: number, activeTasks: number): number {
    // Higher availability score for less utilized members with fewer active tasks
    const utilizationScore = Math.max(0, 100 - utilizationPercent);
    const taskLoadScore = Math.max(0, 100 - (activeTasks * 10)); // Penalty for each active task
    
    return (utilizationScore * 0.7 + taskLoadScore * 0.3);
  }

  private calculatePastPerformance(memberItems: WorkItem[], completedTasks: WorkItem[]): {
    completionRate: number;
    avgTaskTime: number;
    bugFixExperience: number;
  } {
    const completionRate = memberItems.length > 0 ? (completedTasks.length / memberItems.length) * 100 : 0;
    
    const bugTasks = completedTasks.filter(item => 
      item.type?.toLowerCase().includes('bug')
    );
    const bugFixExperience = bugTasks.length;
    
    // Simplified avg task time calculation (could be enhanced with actual completion dates)
    const avgTaskTime = completedTasks.length > 0 ? 
      completedTasks.reduce((sum, item) => sum + (item.effort || 2), 0) / completedTasks.length : 2;
    
    return {
      completionRate,
      avgTaskTime,
      bugFixExperience
    };
  }

  private async generateMemberRecommendation(
    member: TeamMember,
    utilizationPercent: number,
    remainingCapacity: number,
    activeTasks: WorkItem[],
    pastPerformance: any
  ): Promise<string> {
    if (utilizationPercent > 90) {
      return `${member.displayName} is at high capacity (${utilizationPercent.toFixed(1)}%). Consider only for critical issues.`;
    } else if (utilizationPercent < 50) {
      return `${member.displayName} has excellent availability (${utilizationPercent.toFixed(1)}% utilized, ${remainingCapacity} hours free). Good candidate for new assignments.`;
    } else {
      return `${member.displayName} has moderate availability (${utilizationPercent.toFixed(1)}% utilized, ${remainingCapacity} hours free). Can take on medium priority items.`;
    }
  }

  private calculateConfidence(skillMatch: number, availabilityScore: number, pastPerformance: any): number {
    const skillWeight = 0.3;
    const availabilityWeight = 0.4;
    const performanceWeight = 0.3;
    
    const performanceScore = (pastPerformance.completionRate + (pastPerformance.bugFixExperience * 10)) / 2;
    
    return Math.min(100, Math.max(0, 
      skillMatch * skillWeight + 
      availabilityScore * availabilityWeight + 
      performanceScore * performanceWeight
    ));
  }

  private async generateAIRecommendations(
    message: string,
    teamAnalysis: TeamMemberAnalysis[],
    unassignedItems: WorkItem[],
    sprint: any
  ): Promise<TeamMemberAnalysis[]> {
    
    const systemPrompt = `You are an expert AI Scrum Assistant specializing in optimal task assignment. 
    
Analyze the team capacity and provide intelligent recommendations for adhoc task assignments.

CURRENT CONTEXT:
- User Request: "${message}"
- Sprint: ${sprint?.name || 'No active sprint'}
- Team Size: ${teamAnalysis.length} members
- Unassigned Items: ${unassignedItems.length} items

TEAM ANALYSIS:
${teamAnalysis.map(analysis => `
- ${analysis.member.displayName}:
  * Capacity: ${analysis.currentCapacity}h (${analysis.utilizationPercent.toFixed(1)}% utilized)
  * Remaining: ${analysis.remainingCapacity}h available
  * Active Tasks: ${analysis.activeTasks.length}
  * Completed: ${analysis.completedTasks.length}
  * Bug Experience: ${analysis.pastPerformance.bugFixExperience} bugs completed
  * Completion Rate: ${analysis.pastPerformance.completionRate.toFixed(1)}%
`).join('')}

UNASSIGNED ITEMS:
${unassignedItems.slice(0, 10).map(item => `
- #${item.id}: ${item.title} (${item.type}, Priority: ${item.priority || 'Medium'}, Effort: ${item.effort || 'Unknown'}h)
`).join('')}

INSTRUCTIONS:
1. Consider capacity, workload, and past performance
2. Match skills and experience to task types
3. Balance team workload fairly
4. Prioritize based on urgency and member availability
5. Provide specific reasoning for each recommendation

Enhance the analysis with deeper insights about optimal assignments.`;

    try {
      // Use the new generic chat method for AI analysis
      const aiResponse = await this.thomsonReutersOpenAIService.processGenericChat(
        systemPrompt,
        message,
        800
      );
      
      console.log('AI Analysis Response:', aiResponse);
      
      // Sort by confidence and availability
      return teamAnalysis.sort((a, b) => {
        // Prioritize by availability (less utilized = better) and confidence
        const aScore = (100 - a.utilizationPercent) * 0.6 + a.confidence * 0.4;
        const bScore = (100 - b.utilizationPercent) * 0.6 + b.confidence * 0.4;
        return bScore - aScore;
      }).slice(0, 5); // Return top 5 recommendations
      
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return teamAnalysis.slice(0, 5);
    }
  }

  private createVisualizationData(teamAnalysis: TeamMemberAnalysis[], unassignedItems: WorkItem[]) {
    const teamCapacityChart = teamAnalysis.map(analysis => ({
      name: analysis.member.displayName,
      capacity: analysis.currentCapacity,
      utilized: analysis.currentCapacity - analysis.remainingCapacity,
      remaining: analysis.remainingCapacity,
      utilizationPercent: analysis.utilizationPercent,
      confidence: analysis.confidence
    }));

    const workloadDistribution = teamAnalysis.map(analysis => ({
      member: analysis.member.displayName,
      active: analysis.activeTasks.length,
      completed: analysis.completedTasks.length,
      total: analysis.activeTasks.length + analysis.completedTasks.length
    }));

    const priorityMatrix = unassignedItems.reduce((acc, item) => {
      const priority = item.priority || 'Medium';
      const type = item.type || 'Task';
      const key = `${priority}-${type}`;
      
      if (!acc[key]) {
        acc[key] = { priority, type, count: 0, totalEffort: 0 };
      }
      acc[key].count++;
      acc[key].totalEffort += item.effort || 2;
      
      return acc;
    }, {} as any);

    return {
      teamCapacityChart,
      workloadDistribution,
      priorityMatrix: Object.values(priorityMatrix)
    };
  }

  private async generateConversationalResponse(
    message: string,
    recommendations: TeamMemberAnalysis[],
    unassignedItems: WorkItem[],
    teamAnalysis: TeamMemberAnalysis[]
  ): Promise<string> {
    
    const systemPrompt = `You are an AI Scrum Assistant providing conversational responses about task assignments.

USER QUERY: "${message}"

Generate a natural, helpful response that:
1. Acknowledges the adhoc priority request
2. Shows understanding of team capacity
3. Presents top recommendations with clear reasoning
4. Offers to show unassigned items for selection
5. Mentions visual analysis available

Keep it conversational but professional, like talking to a project manager.`;

    try {
      const userMessage = `
Based on current team analysis:
- Top recommendations: ${recommendations.slice(0, 3).map(r => r.member.displayName).join(', ')}
- ${unassignedItems.length} unassigned items available
- Team average utilization: ${Math.round(teamAnalysis.reduce((sum, t) => sum + t.utilizationPercent, 0) / teamAnalysis.length)}%

Generate a response that offers to show the unassigned items and explain the recommendations.`;
      
      const aiResponse = await this.thomsonReutersOpenAIService.processGenericChat(
        systemPrompt,
        userMessage,
        600
      );
      return aiResponse;
      
    } catch (error) {
      console.error('Error generating conversational response:', error);
      return `I understand you have an adhoc priority task that needs assignment. Based on team capacity analysis, I recommend considering ${recommendations[0]?.member.displayName || 'available team members'} who has the best availability and relevant experience. 

I can show you all ${unassignedItems.length} unassigned items to help you select the specific task, and provide detailed capacity analysis with visual insights. Would you like me to display the unassigned items for selection?`;
    }
  }
}
