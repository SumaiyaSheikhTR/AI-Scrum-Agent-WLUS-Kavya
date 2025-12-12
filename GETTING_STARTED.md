# Getting Started with AI Scrum Agent

This guide will help you set up and run the AI Scrum Agent application from scratch.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Troubleshooting](#troubleshooting)
- [Architecture Overview](#architecture-overview)

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:

### Required Software
- **Node.js** (v16.x or higher) - [Download](https://nodejs.org/)
- **npm** (v8.x or higher) - Comes with Node.js
- **Git** - For cloning the repository

### Required Accounts & Access
1. **Azure DevOps (ADO) Account**
   - Active organization and project
   - Personal Access Token (PAT) with at least "Work Items (Read)" permissions
   - Get your PAT from: `https://dev.azure.com/{your-org}/_usersSettings/tokens`

2. **Optional - AI Services** (for advanced features)
   - **Hugging Face API Key** - For sentiment analysis ([Get free API key](https://huggingface.co/settings/tokens))
   - **OpenAI API Key** - For standard OpenAI integration ([Get API key](https://platform.openai.com/api-keys))
   - **Thomson Reuters Network Access** - For internal TR OpenAI service (requires VPN)

### System Requirements
- **RAM**: 4GB minimum, 8GB recommended
- **Disk Space**: 500MB for node_modules and build artifacts
- **Network**: Internet connection for API calls
- **VPN**: Required for Thomson Reuters OpenAI service

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/ai-scrum-agent-ui.git
cd ai-scrum-agent-ui
```

### Step 2: Install Dependencies

```bash
npm install
```

This will install all required packages including:
- React 18 with TypeScript
- Material-UI v5
- Express.js server
- AI/ML libraries (TensorFlow.js, ml5)
- Chart.js and Recharts for visualizations
- And more...

**Note**: Installation may take 3-5 minutes depending on your internet speed.

---

## Configuration

### Step 1: Create Environment File

Copy the example environment file:

```bash
# Windows (PowerShell)
Copy-Item .env.example .env.local

# Linux/Mac
cp .env.example .env.local
```

### Step 2: Configure Azure DevOps Connection

Edit `.env.local` and update the following **required** settings:

```env
# Azure DevOps Configuration
REACT_APP_ADO_ORG=your-organization-name
REACT_APP_ADO_PROJECT=your-project-name
REACT_APP_ADO_PAT=your-personal-access-token
```

**How to find your ADO organization and project:**
- Your ADO URL looks like: `https://dev.azure.com/{ORG}/{PROJECT}/_workitems`
- Example: If URL is `https://dev.azure.com/microsoft/vscode/_workitems`
  - `REACT_APP_ADO_ORG=microsoft`
  - `REACT_APP_ADO_PROJECT=vscode`

### Step 3: Configure AI Services (Optional)

#### Option A: Hugging Face Sentiment Analysis
```env
HUGGINGFACE_API_KEY=hf_your_api_key_here
REACT_APP_SENTIMENT_ANALYSIS_API_URL=http://localhost:3001/api/sentiment-analysis
```

#### Option B: OpenAI Integration
```env
REACT_APP_OPENAI_API_KEY=sk-proj-your-api-key-here
REACT_APP_OPENAI_MODEL=gpt-3.5-turbo
REACT_APP_OPENAI_BASE_URL=https://api.openai.com/v1
```

#### Option C: Thomson Reuters OpenAI (Internal Only)
```env
# Requires TR network access via VPN
REACT_APP_AZURE_OPENAI_WORKSPACE_ID=your-workspace-id
REACT_APP_AZURE_OPENAI_ASSET_ID=your-asset-id
REACT_APP_AZURE_OPENAI_MODEL_NAME=gpt-4o
```

### Step 4: Verify Configuration

Your `.env.local` file should now look similar to:

```env
# Server Configuration
PORT=3001

# Azure DevOps (REQUIRED)
REACT_APP_ADO_API_URL=https://dev.azure.com
REACT_APP_ADO_API_VERSION=7.0
REACT_APP_ADO_ORG=my-company
REACT_APP_ADO_PROJECT=My Project
REACT_APP_ADO_PAT=abc123yourpattoken456

# AI Services (Optional)
HUGGINGFACE_API_KEY=hf_yourkey
REACT_APP_OPENAI_API_KEY=sk-proj-yourkey
```

---

## Running the Application

The application consists of three components that can run separately or together:

### Quick Start Options

#### Option 1: React Frontend Only (Simplest)
Best for development without AI features:

```bash
npm start
```

- Opens browser at: `http://localhost:3000`
- Hot-reload enabled
- No backend AI services

#### Option 2: Frontend + Backend Server (Recommended)
Includes sentiment analysis and email services:

```bash
npm run dev
```

This runs:
- React frontend on port `3000`
- Express backend on port `3001`
- Opens browser automatically

#### Option 3: Full Stack with TR OpenAI (Complete)
For full AI capabilities including Thomson Reuters OpenAI:

```bash
npm run dev-with-tr
```

This runs:
- React frontend on port `3000`
- Express backend on port `3001`
- TR OpenAI backend on port `3002`
- **Requires**: TR VPN connection

### Manual Component Startup

Run each component in a separate terminal:

**Terminal 1 - React Frontend:**
```bash
npm start
```

**Terminal 2 - Express Backend Server:**
```bash
npm run server
```

**Terminal 3 - Thomson Reuters OpenAI Backend:**
```bash
npm run tr-backend
```

### Production Build

To create an optimized production build:

```bash
npm run build
```

The build will be created in the `build/` folder. To serve it:

```bash
# Install serve globally (one-time)
npm install -g serve

# Serve the production build
serve -s build -l 3000
```

---

## Troubleshooting

### Common Issues

#### 1. CORS Errors

**Symptom:**
```
Access to fetch at 'http://localhost:3002/api/tr-openai/token' from origin 
'http://localhost:3000' has been blocked by CORS policy
```

**Solutions:**
- Ensure all backend servers are running
- Check that CORS is properly configured in backend files
- Verify ports match between frontend and backend configs
- Try running with `npm run dev-with-tr` instead of separately

#### 2. Module Not Found Errors

**Symptom:**
```
Module not found: Can't resolve 'xyz'
```

**Solutions:**
```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and reinstall
rm -rf node_modules
npm install

# Or on Windows PowerShell
Remove-Item -Recurse -Force node_modules
npm install
```

#### 3. Port Already in Use

**Symptom:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solutions:**

**Windows PowerShell:**
```powershell
# Find process using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
# Find and kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

#### 4. Azure DevOps Connection Failed

**Symptom:**
- "Unable to fetch work items"
- "Authentication failed"

**Solutions:**
1. Verify your PAT token is valid and not expired
2. Ensure PAT has "Work Items (Read)" permissions
3. Check organization and project names match your ADO URL exactly
4. Test your connection in Azure DevOps web interface first

#### 5. Thomson Reuters Backend Not Connecting

**Symptom:**
```
Failed to initialize Thomson Reuters OpenAI client
Network Error: Cannot reach Thomson Reuters backend
```

**Solutions:**
1. **Check VPN Connection**: Ensure you're connected to TR VPN
2. **Verify Backend is Running**: 
   ```bash
   # Check if port 3002 is listening
   netstat -an | findstr :3002
   ```
3. **Test Backend Directly**:
   ```powershell
   Invoke-WebRequest -Uri http://localhost:3002/api/tr-openai/health -Method GET
   ```
4. **Check Backend Logs**: Look for errors in the TR backend terminal
5. **Restart Backend**:
   ```bash
   # Stop the backend (Ctrl+C) then restart
   npm run tr-backend
   ```

#### 6. TypeScript Errors

**Symptom:**
```
TypeScript error: Property 'xyz' does not exist on type 'ABC'
```

**Solutions:**
```bash
# Type check without building
npm run type-check

# If issues persist, regenerate types
rm -rf node_modules/@types
npm install
```

### Debugging Tools

The application includes built-in debugging tools:

1. **Debug Comments Panel**: Access via sidebar → "Debug Comments"
   - Analyzes User Story comment detection
   - Shows detailed matching logic
   - Helps troubleshoot activity monitoring

2. **Browser Console**: Press F12 to view detailed logs
   - API request/response details
   - Error stack traces
   - Service initialization logs

3. **Network Tab**: Monitor API calls in browser DevTools
   - Check ADO API responses
   - Verify backend connectivity
   - Inspect CORS headers

### Getting Help

If you encounter issues not covered here:

1. Check the [README.md](README.md) for feature documentation
2. Review [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) for architecture details
3. Check browser console (F12) for detailed error messages
4. Review backend server logs in terminal windows
5. Open an issue on the GitHub repository with:
   - Error message and stack trace
   - Steps to reproduce
   - Environment details (OS, Node version, etc.)

---

## Architecture Overview

### Application Structure

```
ai-scrum-agent-ui/
├── src/                          # React frontend source code
│   ├── components/               # React components
│   │   ├── chat/                 # AI chat components
│   │   ├── dashboard/            # Dashboard components
│   │   ├── config/               # Configuration components
│   │   └── debug/                # Debug tools
│   ├── services/                 # Business logic and API services
│   │   ├── adoService.ts         # Azure DevOps integration
│   │   ├── openAiService.ts      # OpenAI integration
│   │   ├── sentimentAnalysisService.ts  # Sentiment analysis
│   │   └── thomsonReutersOpenAiService.ts  # TR OpenAI service
│   ├── pages/                    # Route pages
│   └── contexts/                 # React contexts
├── server.js                     # Express backend (port 3001)
├── tr-openai-backend.js          # TR OpenAI proxy (port 3002)
├── public/                       # Static assets
├── build/                        # Production build output
└── docs/                         # Additional documentation
```

### Port Usage

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | React Frontend | Main UI application |
| 3001 | Express Backend | API proxy, sentiment analysis, email services |
| 3002 | TR OpenAI Backend | Thomson Reuters OpenAI token/proxy service |

### Data Flow

```
User Browser (Port 3000)
    ↓
    ├─→ Azure DevOps API (External)
    │   └─→ Work items, sprints, team data
    │
    ├─→ Express Backend (Port 3001)
    │   ├─→ Sentiment analysis (Hugging Face)
    │   ├─→ Email notifications
    │   └─→ OpenAI standard API
    │
    └─→ TR OpenAI Backend (Port 3002)
        └─→ TR Azure OpenAI (Internal, requires VPN)
            └─→ Advanced AI features
```

### Key Technologies

- **Frontend**: React 18 + TypeScript + Material-UI
- **Backend**: Node.js + Express + CORS
- **AI/ML**: OpenAI, Hugging Face, TensorFlow.js
- **Data Visualization**: Chart.js, Recharts
- **State Management**: React Context API
- **Build Tool**: Create React App (webpack)

---

## Next Steps

Once the application is running:

1. **Initial Setup**:
   - Navigate to Settings page
   - Configure Azure DevOps connection
   - Set up AI service credentials (optional)
   - Configure team members and sprint settings

2. **Explore Features**:
   - **Dashboard**: View sprint progress and team activity
   - **Activity Monitoring**: Track User Story comments and compliance
   - **Analytics**: Review sprint metrics and sentiment analysis
   - **AI Assistant**: Chat with AI about project status
   - **Debug Panel**: Troubleshoot comment detection issues

3. **Learn More**:
   - Read [README.md](README.md) for feature details
   - Review [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md)
   - Check [AI_FEATURES_PRESENTATION.md](AI_FEATURES_PRESENTATION.md)

---

## Quick Reference Commands

```bash
# Install dependencies
npm install

# Start React frontend only
npm start

# Start frontend + backend
npm run dev

# Start full stack (frontend + backend + TR OpenAI)
npm run dev-with-tr

# Production build
npm run build

# Run tests
npm test

# Type checking
npm run type-check

# Lint code
npm run lint
```

---

## Support

For additional help or questions:
- Review documentation in the `docs/` folder
- Check the project README files
- Open an issue on GitHub
- Contact the AI Scrum Agent Team

---

**Last Updated**: December 12, 2025
