import React, { useState } from 'react';
import { Container, Box, Paper, Typography, Snackbar, Alert, CircularProgress, Stepper, Step, StepLabel, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import AdoConfigForm from '../../components/config/AdoConfigForm';
import OpenArenaConfigForm from '../../components/config/OpenArenaConfigForm';
import adoService from '../../services/adoService';
import openArenaService from '../../services/openArenaService';

interface AdoConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
  apiVersion: string;
  teamName: string;
  refreshInterval: number;
  enableAutoRefresh: boolean;
}

interface OpenArenaConfig {
  apiUrl: string;
  workflowId: string;
  essoToken: string;
  isPersistenceAllowed: boolean;
}

const SetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [adoConfig, setAdoConfig] = useState<AdoConfig | null>(null);
  const [openArenaConfig, setOpenArenaConfig] = useState<OpenArenaConfig | null>(null);
  
  const steps = ['Azure DevOps Configuration', 'OpenArena Configuration', 'Complete Setup'];

  const handleSaveAdoConfig = (config: AdoConfig) => {
    setAdoConfig(config);
    setActiveStep(1);
  };
  
  const handleSaveOpenArenaConfig = (config: OpenArenaConfig) => {
    setOpenArenaConfig(config);
    setActiveStep(2);
  };
  
  const handleCompleteSetup = async () => {
    try {
      setIsLoading(true);
      
      // Save the ADO configuration to localStorage and update the service
      if (adoConfig) {
        localStorage.setItem('adoConfig', JSON.stringify(adoConfig));
        adoService.updateConfig(adoConfig);
      }
      
      // Save the OpenArena configuration to localStorage and update the service
      if (openArenaConfig) {
        localStorage.setItem('openArenaConfig', JSON.stringify(openArenaConfig));
        openArenaService.updateConfig(openArenaConfig);
      }
      
      // Mark setup as completed immediately to prevent repeated setup prompts
      localStorage.setItem('setupCompleted', 'true');
      
      // Dispatch custom event to notify App component
      window.dispatchEvent(new Event('setup-completed'));
      
      // Show info notification
      setNotification({
        open: true,
        message: 'Configuration saved successfully! Fetching initial data...',
        severity: 'info',
      });

      try {
        // Fetch initial data
        const currentSprint = await adoService.getCurrentSprint();
        
        if (currentSprint) {
          // Fetch work items for the current sprint
          await adoService.getSprintWorkItems(currentSprint.id);
          
          // Fetch sprint statistics
          await adoService.getSprintStatistics(currentSprint.id);
        }
        
        // Show success notification
        setNotification({
          open: true,
          message: 'Initial data fetched successfully! Redirecting to dashboard...',
          severity: 'success',
        });
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } catch (fetchError) {
        console.error('Error fetching initial data:', fetchError);
        
        // Show warning but still redirect
        setNotification({
          open: true,
          message: 'Configuration saved, but there was an issue fetching initial data. Redirecting to dashboard...',
          severity: 'error',
        });
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 3000);
      }
    } catch (error) {
      // Show error notification
      setNotification({
        open: true,
        message: `Error saving configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAdoConnection = async (config: AdoConfig): Promise<boolean> => {
    try {
      // In a real application, we would make an API call to test the connection
      // For now, we'll simulate a successful connection after a short delay
      await new Promise((resolve) => setTimeout(resolve, 1500));
      
      // Simulate a successful connection if the organization and PAT are provided
      return !!(config.organization && config.personalAccessToken);
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  };
  
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ my: 4 }}>
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
            <CircularProgress />
          </Box>
        )}
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            AI Scrum Agent Setup
          </Typography>
          <Typography variant="body1" color="textSecondary" paragraph align="center">
            Configure your connections to get started with AI Scrum Agent
          </Typography>

          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4, mt: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {activeStep === 0 && (
            <Box mt={4}>
              <AdoConfigForm
                onSave={handleSaveAdoConfig}
                onTest={handleTestAdoConnection}
                isFirstTimeSetup={true}
              />
            </Box>
          )}
          
          {activeStep === 1 && (
            <Box mt={4}>
              <OpenArenaConfigForm
                onSave={handleSaveOpenArenaConfig}
                initialConfig={{
                  apiUrl: '',
                  workflowId: '',
                  essoToken: '',
                  isPersistenceAllowed: false
                }}
              />
            </Box>
          )}
          
          {activeStep === 2 && (
            <Box mt={4} sx={{ textAlign: 'center' }}>
              <Typography variant="h5" gutterBottom>
                Ready to Complete Setup
              </Typography>
              <Typography variant="body1" paragraph>
                Your configuration is ready to be saved. Click the button below to complete the setup and start using AI Scrum Agent.
              </Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                <Button 
                  variant="outlined" 
                  onClick={handleBack}
                >
                  Back
                </Button>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleCompleteSetup}
                  disabled={isLoading}
                >
                  {isLoading ? 'Completing Setup...' : 'Complete Setup'}
                </Button>
              </Box>
            </Box>
          )}
        </Paper>
      </Box>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default SetupPage;
