# AI Scrum Agent 🤖

> An enterprise-grade AI-powered virtual scrum master that automates Agile project management workflows

[![TypeScript](https://img.shields.io/badge/TypeScript-4.9-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.2-61dafb)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

AI Scrum Agent intelligently monitors sprint progress, analyzes team sentiment, and provides data-driven insights through seamless Azure DevOps integration and multiple AI services.

## ✨ Key Features

- **🎯 Activity Monitoring** - Real-time tracking of work item comments and team compliance
- **🤖 AI Chat Assistant** - Context-aware sprint insights powered by OpenAI/Azure OpenAI
- **😊 Sentiment Analysis** - Team morale tracking using Hugging Face transformer models
- **📊 Sprint Analytics** - Burndown charts, velocity tracking, and capacity planning
- **🎫 Smart Work Items** - Duplicate detection and intelligent task assignment
- **📧 Automated Notifications** - Daily summaries and alerts via email/Teams
- **🔍 Debug Tools** - Comprehensive troubleshooting panels

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Configure Azure DevOps (edit .env.local)
REACT_APP_ADO_ORG=your-org
REACT_APP_ADO_PROJECT=your-project
REACT_APP_ADO_PAT=your-pat-token

# Run application
npm run dev              # Frontend + Backend
npm run dev-with-tr      # Full stack with TR OpenAI
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## 📦 Tech Stack

**Frontend:** React 18 • TypeScript • Material-UI • Chart.js • Recharts  
**Backend:** Node.js • Express • CORS Proxy  
**AI/ML:** OpenAI GPT • Azure OpenAI • Hugging Face • TensorFlow.js  
**Integrations:** Azure DevOps API v7.1 • MS Teams • SMTP Email

## 📖 Documentation

- **[GETTING_STARTED.md](GETTING_STARTED.md)** - Detailed setup guide with prerequisites and troubleshooting
- **[PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md)** - Complete architecture, features, and data flow
- **[TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)** - Technical implementation details
- **[DEBUG_GUIDE.md](DEBUG_GUIDE.md)** - Debugging and troubleshooting guide

## 🔧 Prerequisites

- Node.js 16+ and npm 8+
- Azure DevOps account with Personal Access Token (PAT)
- Optional: OpenAI/Hugging Face API keys for AI features
- Optional: TR VPN access for Thomson Reuters OpenAI backend

## 📊 Architecture

```
React Frontend (3000) → Express Backend (3001) → Azure DevOps API
                     ↓                        ↓
                AI Services              TR OpenAI (3002)
              (OpenAI, HF, Azure)
```

## 🎯 Key Use Cases

- **Sprint Planning** - AI-powered capacity recommendations prevent overcommitment
- **Team Health** - Early detection of burnout through sentiment analysis
- **Blocker Detection** - Identify hidden blockers from comment patterns
- **Automated Standups** - Generate daily summaries from ADO activity

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines first.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

## 🔗 Related Projects

- [Azure DevOps REST API](https://docs.microsoft.com/en-us/rest/api/azure/devops/)
- [OpenAI API](https://platform.openai.com/docs)
- [Hugging Face Models](https://huggingface.co/models)

---

**Version:** 2.1.0 | **Last Updated:** December 12, 2025

# AI Service configurations
REACT_APP_OPENAI_API_URL=https://api.openai.com/v1
REACT_APP_AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
REACT_APP_HUGGINGFACE_API_URL=https://api-inference.huggingface.co

# Thomson Reuters OpenAI Backend
REACT_APP_TR_OPENAI_URL=http://localhost:3002

# Email service configuration
REACT_APP_EMAIL_SERVICE_URL=http://localhost:3001/api/email
```

4. Start the development server:
```bash
npm start
```

5. For production deployment:
```bash
npm run build
npm run preview
```

## Usage

### Initial Setup
1. **Configuration**: Navigate to Settings to configure:
   - Azure DevOps connection (organization, project, PAT token)
   - OpenAI/Azure OpenAI API keys for AI features
   - Email service settings for notifications
   - Developer engagement rules and thresholds

### Core Features
2. **Dashboard**: 
   - View sprint progress with real-time activity monitoring
   - Monitor team compliance with User Story comment requirements
   - Access AI-powered insights and recommendations

3. **Activity Monitoring**:
   - Track which team members are commenting on User Stories
   - View violation reports and compliance scores
   - Use the Debug Comments panel to troubleshoot detection issues

4. **Analytics**: 
   - Detailed sprint performance metrics with ML insights
   - Sentiment analysis of team communications
   - Capacity planning and workload distribution analysis

5. **AI Assistant**: 
   - Centralized chat interface with multiple AI service support
   - Context-aware responses based on current sprint data
   - Natural language queries about project status

### Troubleshooting
6. **Debug Panel**: Access via "Debug Comments" in the sidebar to:
   - Analyze User Story comment detection issues
   - View exact comment matching logic
   - Identify API or configuration problems

## Application Architecture

The application is built with a modern, scalable architecture:

### Frontend (React + TypeScript)
- **Components**: Modular React components with Material-UI styling
- **State Management**: React hooks and context for state management
- **Routing**: React Router v6 for SPA navigation
- **API Integration**: Axios for HTTP requests with proper error handling

### Backend Services
- **ADO Service**: Azure DevOps API integration with comprehensive work item management
- **AI Services**: Multiple AI provider integrations (OpenAI, Azure OpenAI, Hugging Face)
- **Email Service**: Automated notification system with template support
- **Background Services**: Scheduled tasks for monitoring and analysis

### Key Service Files
- `adoService.ts`: Core Azure DevOps integration with 2400+ lines of functionality
- `sentimentAnalysisService.ts`: Hugging Face sentiment analysis integration
- `openAiService.ts`: OpenAI GPT integration for intelligent assistance
- `emailService.ts`: Email automation and notification system

## Recent Updates & Features

### 🐛 Debug Tools (Latest)
- **Comment Debug Panel**: New comprehensive debugging interface for User Story comment detection
- **Advanced Logging**: Detailed console logging for troubleshooting activity monitoring issues
- **API Diagnostics**: Real-time analysis of Azure DevOps API responses

### 🤖 AI & ML Enhancements
- **Multiple AI Providers**: Support for OpenAI, Azure OpenAI, and Thomson Reuters OpenAI backend
- **Sentiment Analysis**: Hugging Face transformer models for team mood analysis
- **TensorFlow.js Integration**: Client-side machine learning capabilities
- **Centralized Agentic Chat**: Advanced AI chat interface with context awareness

### 📊 Enhanced Analytics
- **Activity Monitoring**: Real-time compliance tracking for User Story comments
- **Advanced Visualization**: Chart.js v4 and Recharts v2 for rich data presentation
- **Sprint Analytics**: Comprehensive sprint performance metrics and insights

## Contributing

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with proper TypeScript typing
4. Add tests for new functionality
5. Update documentation as needed
6. Commit your changes (`git commit -m 'Add some amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

### Code Standards
- **TypeScript**: All new code should be written in TypeScript with proper typing
- **ESLint**: Follow the established ESLint configuration
- **Material-UI**: Use Material-UI components for consistent styling
- **Testing**: Add unit tests for new functionality
- **Documentation**: Update README and inline documentation for new features

## Deployment

### Production Build
```bash
npm run build
```

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY build ./build
EXPOSE 3003
CMD ["npx", "serve", "-s", "build", "-l", "3003"]
```

## Support & Troubleshooting

### Common Issues
1. **Azure DevOps Connection**: Ensure PAT token has proper permissions
2. **Comment Detection**: Use Debug Comments panel for detailed analysis
3. **API Limits**: Monitor console for rate limiting messages
4. **Performance**: Check browser dev tools for network and rendering issues

### Getting Help
- Check the `DEBUG_GUIDE.md` for detailed troubleshooting steps
- Review browser console logs for detailed error information
- Use the Debug Comments panel for activity monitoring issues

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- **Azure DevOps** for the comprehensive project management platform
- **OpenAI** for AI-powered assistance capabilities
- **Hugging Face** for sentiment analysis transformer models
- **Material-UI** for the excellent React component library
- **Thomson Reuters** for OpenAI backend integration support
