import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';

// Import pages
import Dashboard from './pages/Dashboard';
import Layout from './components/layout/Layout';
import SetupPage from './pages/Setup';
import SettingsPage from './pages/Settings';
import AnalyticsPage from './pages/Analytics';
import WorkItemsPage from './pages/WorkItems';
import TeamPage from './pages/Team';
import AiAssistantPage from './pages/AiAssistant';
import GitPRPage from './pages/GitPR';
import SentimentAnalysisPage from './pages/SentimentAnalysis';
import SentimentAnalysisDemoPage from './pages/SentimentAnalysisDemo';
import CommentDebugPanel from './components/debug/CommentDebugPanel';
import automationOrchestrator from './services/automationOrchestrator';

// Create a theme instance
const theme = createTheme({
  palette: {
    primary: {
      main: '#0078d4', // Azure blue
    },
    secondary: {
      main: '#2b88d8', // Lighter blue
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h5: {
      fontSize: '1.1rem',
      fontWeight: 600,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

function App() {
  // Use a ref to track if the effect has run to prevent double initialization in StrictMode
  const effectRan = React.useRef(false);
  const [setupCompleted, setSetupCompleted] = useState<boolean>(() => {
    // Initialize state from localStorage during initial render
    return localStorage.getItem('setupCompleted') === 'true';
  });

  useEffect(() => {
    // Skip effect on first render in StrictMode's second render
    if (effectRan.current === true && process.env.NODE_ENV === 'development') {
      return;
    }
    
    // Mark effect as having run
    effectRan.current = true;

    // Central automation platform:
    // - single staggered scheduler (no refresh storms)
    // - dry-run by default until enabled in Settings → Automation
    // - pauses when the tab is hidden
    console.log('Initializing Automation Orchestrator...');
    automationOrchestrator.start();
    
    // Listen for storage events to update the setupCompleted state
    const handleStorageChange = () => {
      const updatedSetupCompleted = localStorage.getItem('setupCompleted') === 'true';
      setSetupCompleted(updatedSetupCompleted);
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    // Custom event for setup completion
    const handleSetupComplete = () => {
      setSetupCompleted(true);
    };
    
    window.addEventListener('setup-completed', handleSetupComplete);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('setup-completed', handleSetupComplete);
      automationOrchestrator.stop();
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Routes>
            {/* Setup route */}
            <Route path="/setup" element={<SetupPage />} />
            
            {/* Protected routes that require setup to be completed */}
            <Route path="/" element={
              setupCompleted ? <Layout /> : <Navigate to="/setup" replace />
            }>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="work-items" element={<WorkItemsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="sentiment-analysis" element={<SentimentAnalysisPage />} />
              <Route path="sentiment-demo" element={<SentimentAnalysisDemoPage />} />
              <Route path="git-pr" element={<GitPRPage />} />
              <Route path="ai-assistant" element={<AiAssistantPage />} />
              <Route path="debug-comments" element={<CommentDebugPanel />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
      </Box>
    </ThemeProvider>
  );
}

export default App;
