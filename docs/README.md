# AI Scrum Agent - Developer Documentation

This document provides detailed information for developers working on the AI Scrum Agent project.

## Project Structure

```
ai-scrum-agent/
├── docs/                  # Documentation files
├── public/                # Static assets
├── server.js              # Express backend server
├── src/
│   ├── api/               # API client utilities
│   ├── components/        # React components
│   │   ├── chat/          # Chat-related components
│   │   ├── config/        # Configuration forms
│   │   ├── dashboard/     # Dashboard components
│   │   └── layout/        # Layout components
│   ├── pages/             # Page components
│   │   ├── Analytics/     # Analytics page
│   │   ├── Dashboard/     # Dashboard page
│   │   ├── Settings/      # Settings page
│   │   └── Setup/         # Setup page
│   ├── services/          # Service modules
│   ├── App.tsx            # Main App component
│   └── index.tsx          # Application entry point
└── package.json           # Project dependencies and scripts
```

## Key Components

### Services

- **adoService.ts**: Handles communication with Azure DevOps API
- **openArenaService.ts**: Manages interactions with the OpenArena AI service
- **workItemSuggestionService.ts**: Generates work item suggestions based on sprint data
- **developerEngagementService.ts**: Analyzes developer engagement and activity
- **ticketManagementService.ts**: Manages ticket status updates and notifications

### Components

- **AiScrumAssistant.tsx**: Main AI assistant component with chat, sprint review, and suggestions
- **ChatPanel.tsx**: Interactive chat interface for communicating with the AI
- **WorkItemsBoard.tsx**: Kanban-style board for visualizing work items
- **AiAssistantPanel.tsx**: Displays AI-generated sprint analysis and insights
- **WorkItemSuggestions.tsx**: Shows AI-generated suggestions for work items
- **DeveloperEngagementPanel.tsx**: Visualizes developer engagement metrics
- **SprintMetricsPanel.tsx**: Displays sprint performance metrics

### Configuration Forms

- **AdoConfigForm.tsx**: Form for configuring Azure DevOps connection
- **OpenArenaConfigForm.tsx**: Form for configuring OpenArena AI service
- **TicketManagementConfigForm.tsx**: Form for configuring ticket management rules
- **DeveloperEngagementConfigForm.tsx**: Form for configuring developer engagement settings

## Backend Server

The Express backend server (`server.js`) provides the following endpoints:

- **POST /api/openarena**: Proxies requests to the OpenArena AI service
- **GET /api/health**: Health check endpoint

## Development Workflow

1. **Setup Environment**:
   - Clone the repository
   - Install dependencies with `npm install`
   - Create `.env.development` file with required environment variables

2. **Start Development Server**:
   - Run `npm run dev` to start both frontend and backend servers
   - Frontend will be available at http://localhost:3000
   - Backend will be available at http://localhost:3001

3. **Development Guidelines**:
   - Follow TypeScript best practices
   - Use functional components with hooks
   - Implement proper error handling
   - Write meaningful comments
   - Follow Material-UI design patterns

4. **Testing**:
   - Run tests with `npm test`
   - Ensure all components have appropriate test coverage

## OpenArena AI Integration

The OpenArena AI service is integrated through the `openArenaService.ts` module. This service provides:

1. **Chat Functionality**: Allows users to interact with the AI assistant
2. **Work Item Analysis**: Analyzes work items to generate insights
3. **Sprint Summary Generation**: Creates summaries of sprint progress
4. **Developer Engagement Analysis**: Analyzes developer activity and sentiment

The backend server proxies requests to the OpenArena service to handle authentication and WebSocket communication.

## Azure DevOps Integration

The Azure DevOps integration is handled through the `adoService.ts` module. This service provides:

1. **Work Item Fetching**: Retrieves work items from Azure DevOps
2. **Sprint Information**: Gets sprint details and statistics
3. **Work Item Updates**: Updates work items in Azure DevOps
4. **Comment Management**: Adds comments to work items

## Extending the Application

### Adding New Features

1. Create necessary service modules in `src/services/`
2. Implement UI components in `src/components/`
3. Update relevant pages to include new components
4. Add configuration options if needed

### Adding New AI Capabilities

1. Update `openArenaService.ts` with new methods
2. Create UI components to utilize the new capabilities
3. Update the backend server if needed to support new endpoints

## Troubleshooting

### Common Issues

1. **Connection Issues with OpenArena**:
   - Check ESSO token validity
   - Verify WebSocket connection in browser developer tools

2. **Azure DevOps API Errors**:
   - Verify personal access token permissions
   - Check API version compatibility

3. **UI Rendering Issues**:
   - Check browser console for errors
   - Verify component props and state management

## Performance Considerations

1. **Minimize API Calls**:
   - Cache responses when appropriate
   - Implement debouncing for user input

2. **Optimize Rendering**:
   - Use React.memo for expensive components
   - Implement virtualization for long lists

3. **Backend Efficiency**:
   - Implement request batching
   - Use appropriate caching strategies
