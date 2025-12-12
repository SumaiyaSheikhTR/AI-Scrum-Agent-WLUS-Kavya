# AI Scrum Agent - Technical Architecture

## Overview

The AI Scrum Agent is a sophisticated React-based application that integrates multiple AI services with Azure DevOps to provide intelligent project management capabilities. This document outlines the technical architecture, key components, and integration patterns.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend Layer                           │
├─────────────────────────────────────────────────────────────────┤
│  React 18 + TypeScript + Material-UI                           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │  Dashboard   │ │  Analytics   │ │   Debug      │           │
│  │  Components  │ │  Components  │ │   Tools      │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │   Activity   │ │  Sentiment   │ │   AI Chat    │           │
│  │  Monitoring  │ │   Analysis   │ │  Interface   │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST APIs
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Service Integration Layer                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │     ADO      │ │     AI       │ │    Email     │           │
│  │   Service    │ │   Services   │ │   Service    │           │
│  │              │ │              │ │              │           │
│  │ • Work Items │ │ • OpenAI     │ │ • SMTP       │           │
│  │ • Comments   │ │ • Azure AI   │ │ • Templates  │           │
│  │ • Sprints    │ │ • Hugging    │ │ • Scheduling │           │
│  │ • Capacity   │ │   Face       │ │              │           │
│  └──────────────┘ │ • Thomson    │ └──────────────┘           │
│                    │   Reuters    │                            │
│                    └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ External APIs
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    External Services                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Azure DevOps │ │   OpenAI     │ │ Hugging Face │           │
│  │   REST API   │ │     API      │ │     API      │           │
│  │              │ │              │ │              │           │
│  │ • v7.1       │ │ • GPT Models │ │ • Sentiment  │           │
│  │ • Comments   │ │ • Embeddings │ │   Models     │           │
│  │ • Work Items │ │ • Chat       │ │ • NLP        │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
│                                                                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Thomson      │ │    SMTP      │ │ MS Teams     │           │
│  │ Reuters AI   │ │   Servers    │ │     API      │           │
│  │ (Port 3002)  │ │              │ │              │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### Frontend Architecture

#### 1. Component Structure
```
src/
├── components/
│   ├── dashboard/
│   │   ├── ActivityMonitoringPanel.tsx    (1588 lines - Core monitoring)
│   │   └── DashboardOverview.tsx
│   ├── chat/
│   │   ├── CentralizedAgenticChat.tsx     (Advanced AI chat)
│   │   └── ChatPanel.tsx
│   ├── debug/
│   │   └── CommentDebugPanel.tsx          (New debugging tool)
│   ├── common/
│   │   ├── FilterComponent.tsx
│   │   └── CollapsibleSection.tsx
│   └── config/
│       ├── AdoConfigForm.tsx
│       ├── OpenAiConfigForm.tsx
│       └── AzureOpenAiConfigForm.tsx
```

#### 2. Service Layer
```
src/services/
├── adoService.ts                    (2433 lines - Core ADO integration)
├── openAiService.ts                 (OpenAI GPT integration)
├── azureOpenAiService.ts           (Azure OpenAI service)
├── thomsonReutersOpenAiService.ts  (TR backend integration)
├── sentimentAnalysisService.ts     (Hugging Face sentiment)
├── emailService.ts                 (Email automation)
├── enhancedTeamChatProcessor.ts    (Team communication analysis)
└── rulesEngine.ts                  (Business logic automation)
```

### Key Technical Features

#### 1. Activity Monitoring System
- **Real-time Comment Detection**: Monitors User Story comments against task assignees
- **Sophisticated Name Matching**: Handles multiple name formats and corporate conventions
- **Violation Tracking**: Identifies compliance issues with configurable thresholds
- **Debug Capabilities**: Comprehensive debugging panel for troubleshooting

**Key Algorithm**: `analyzeTask()` in ActivityMonitoringPanel.tsx
- Fetches comments from ADO API v7.1-preview.3
- Applies automated comment filtering
- Matches comment authors to task assignees using multiple strategies
- Calculates compliance scores and violation reports

#### 2. AI Integration Layer
```typescript
// Multiple AI service support
interface AIService {
  generateResponse(prompt: string): Promise<string>;
  analyzeContent(content: string): Promise<AnalysisResult>;
}

// Implementations:
- OpenAI GPT-3.5/4 integration
- Azure OpenAI service
- Thomson Reuters OpenAI backend (port 3002)
- Hugging Face transformer models
```

#### 3. Data Visualization
- **Chart.js v4.3.0**: Primary charting library
- **Recharts v2.15.3**: Alternative charts for specific use cases
- **Real-time Updates**: Live data refresh capabilities
- **Export Features**: PDF and image export functionality

## Integration Patterns

### Azure DevOps Integration
```typescript
class AdoService {
  // Core work item management
  async getSprintWorkItems(sprintId: string): Promise<WorkItem[]>
  async getWorkItemComments(workItemId: number): Promise<WorkItemComment[]>
  async updateWorkItem(workItemId: number, updates: WorkItemUpdate): Promise<void>
  
  // Advanced features
  async getSprintCapacity(sprintId: string): Promise<SprintCapacityData>
  async getTeamMemberCapacity(teamMemberId: string): Promise<MemberCapacity>
  async analyzeSprintBurndown(sprintId: string): Promise<BurndownData>
}
```

**API Endpoints Used**:
- Work Items: `/{project}/_apis/wit/workitems/{id}?api-version=7.1-preview.3`
- Comments: `/{project}/_apis/wit/workitems/{id}/comments?api-version=7.1-preview.3`
- Sprints: `/{project}/{team}/_apis/work/teamsettings/iterations?api-version=7.1-preview.1`
- Capacity: `/{project}/{team}/_apis/work/teamsettings/iterations/{id}/capacities?api-version=7.1-preview.1`

### AI Services Integration

#### OpenAI Integration
```typescript
interface OpenAIConfig {
  apiKey: string;
  model: 'gpt-3.5-turbo' | 'gpt-4' | 'gpt-4-turbo';
  maxTokens: number;
  temperature: number;
}
```

#### Hugging Face Sentiment Analysis
```typescript
interface SentimentAnalysis {
  model: 'cardiffnlp/twitter-roberta-base-sentiment';
  endpoint: 'https://api-inference.huggingface.co';
  confidence: number;
  label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}
```

## Performance Optimizations

### 1. Data Caching
- **Local Storage**: Configuration and user preferences
- **Memory Caching**: API responses with TTL
- **Background Updates**: Scheduled data refresh without blocking UI

### 2. API Optimization
- **Batch Requests**: Group multiple work item requests
- **Pagination**: Handle large datasets efficiently
- **Rate Limiting**: Respect API limits with exponential backoff

### 3. UI Performance
- **React.memo**: Prevent unnecessary re-renders
- **Virtual Scrolling**: Handle large data sets in tables
- **Code Splitting**: Lazy load components and routes

## Security Considerations

### 1. Authentication
- **Azure DevOps PAT**: Personal Access Token with minimal required permissions
- **API Key Management**: Secure storage of AI service API keys
- **Token Refresh**: Automatic handling of token expiration

### 2. Data Protection
- **Client-side Only**: No sensitive data stored on servers
- **HTTPS Enforcement**: All API communications encrypted
- **Input Sanitization**: XSS protection on user inputs

### 3. Access Control
- **Permission Validation**: Check ADO permissions before operations
- **Role-based Features**: Conditional UI based on user capabilities
- **Audit Logging**: Track user actions and API calls

## Deployment Architecture

### Development Environment
```bash
npm start                    # React dev server (port 3003)
npm run build               # Production build
npm run analyze             # Bundle analysis
```

### Production Deployment
```dockerfile
# Multi-stage Docker build
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### Environment Configuration
```env
# Core application
REACT_APP_VERSION=2.1.0
REACT_APP_BUILD_DATE=2025-08-29

# Azure DevOps
REACT_APP_ADO_API_URL=https://dev.azure.com
REACT_APP_ADO_API_VERSION=7.1-preview.3

# AI Services
REACT_APP_OPENAI_API_URL=https://api.openai.com/v1
REACT_APP_AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com
REACT_APP_HUGGINGFACE_API_URL=https://api-inference.huggingface.co
REACT_APP_TR_OPENAI_URL=http://localhost:3002
```

## Monitoring and Observability

### 1. Application Logging
- **Console Logging**: Comprehensive debug information with emojis for categorization
- **Error Tracking**: Structured error reporting with stack traces
- **Performance Metrics**: Component render times and API response times

### 2. User Analytics
- **Feature Usage**: Track which features are most used
- **Error Patterns**: Identify common user errors
- **Performance Monitoring**: Track application performance metrics

### 3. API Monitoring
- **Response Times**: Track ADO and AI service response times
- **Error Rates**: Monitor API failure rates
- **Rate Limiting**: Track API quota usage

## Troubleshooting and Debugging

### Debug Tools
1. **Comment Debug Panel**: Visual debugging for comment detection issues
2. **Console Logging**: Extensive logging with categorized messages
3. **Network Inspection**: API call monitoring in browser dev tools
4. **State Inspection**: React DevTools for component state analysis

### Common Issues
1. **ADO Connection**: Token permissions and configuration
2. **Comment Matching**: Name format and matching algorithm issues
3. **AI Service Limits**: Rate limiting and quota management
4. **Performance**: Large dataset handling and optimization

## Future Enhancements

### 1. Machine Learning
- **TensorFlow.js Integration**: Client-side ML models for prediction
- **Custom Models**: Train organization-specific models
- **Predictive Analytics**: Sprint success prediction and risk assessment

### 2. Advanced Features
- **Real-time Collaboration**: WebSocket integration for live updates
- **Mobile Application**: React Native companion app
- **Offline Capability**: PWA features with offline data sync

### 3. Integration Expansion
- **Jira Integration**: Support for Atlassian Jira
- **GitHub Integration**: Enhanced Git and PR monitoring
- **Slack Integration**: Direct Slack bot capabilities
