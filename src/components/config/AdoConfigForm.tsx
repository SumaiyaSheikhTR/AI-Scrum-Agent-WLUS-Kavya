import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Divider,
  FormControlLabel,
  Grid,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TestIcon from '@mui/icons-material/CheckCircle';

interface AdoConfig {
  organization: string;
  project: string;
  personalAccessToken: string;
  apiVersion: string;
  teamName: string;
  refreshInterval: number;
  enableAutoRefresh: boolean;
}

const defaultConfig: AdoConfig = {
  organization: '',
  project: '',
  personalAccessToken: '',
  apiVersion: '7.0',
  teamName: '',
  refreshInterval: 15,
  enableAutoRefresh: true,
};

interface AdoConfigFormProps {
  onSave: (config: AdoConfig) => void;
  onTest: (config: AdoConfig) => Promise<boolean>;
  initialConfig?: Partial<AdoConfig>;
  isFirstTimeSetup?: boolean;
}

const AdoConfigForm: React.FC<AdoConfigFormProps> = ({
  onSave,
  onTest,
  initialConfig = {},
  isFirstTimeSetup = false,
}) => {
  const [config, setConfig] = useState<AdoConfig>({ ...defaultConfig, ...initialConfig });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps = ['Azure DevOps Connection', 'Project Settings', 'Refresh Settings'];

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = event.target;
    setConfig((prevConfig) => ({
      ...prevConfig,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear previous test results when configuration changes
    setTestResult(null);
  };

  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue > 0) {
      setConfig((prevConfig) => ({
        ...prevConfig,
        [name]: numValue,
      }));
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const success = await onTest(config);
      setTestResult({
        success,
        message: success
          ? 'Connection successful! Your Azure DevOps configuration is working correctly.'
          : 'Connection failed. Please check your credentials and try again.',
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: `Error testing connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    
    // Simulate saving delay
    setTimeout(() => {
      onSave(config);
      setIsSubmitting(false);
    }, 1000);
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const getStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Organization"
                name="organization"
                value={config.organization}
                onChange={handleChange}
                helperText="Your Azure DevOps organization name"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Personal Access Token"
                name="personalAccessToken"
                type="password"
                value={config.personalAccessToken}
                onChange={handleChange}
                helperText="Your Azure DevOps personal access token with read access to work items"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="API Version"
                name="apiVersion"
                value={config.apiVersion}
                onChange={handleChange}
                helperText="Azure DevOps API version (default: 7.0)"
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="outlined"
                color="primary"
                onClick={handleTest}
                startIcon={isTesting ? <CircularProgress size={20} /> : <TestIcon />}
                disabled={isTesting || !config.organization || !config.personalAccessToken}
              >
                Test Connection
              </Button>
            </Grid>
            {testResult && (
              <Grid item xs={12}>
                <Alert severity={testResult.success ? 'success' : 'error'}>
                  {testResult.message}
                </Alert>
              </Grid>
            )}
          </Grid>
        );
      case 1:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Project"
                name="project"
                value={config.project}
                onChange={handleChange}
                helperText="Your Azure DevOps project name"
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Team Name"
                name="teamName"
                value={config.teamName}
                onChange={handleChange}
                helperText="Your exact team name in Azure DevOps (required for capacity data access)"
              />
            </Grid>
          </Grid>
        );
      case 2:
        return (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={config.enableAutoRefresh}
                    onChange={handleChange}
                    name="enableAutoRefresh"
                    color="primary"
                  />
                }
                label="Enable automatic refresh"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Refresh Interval (minutes)"
                name="refreshInterval"
                type="number"
                value={config.refreshInterval}
                onChange={handleNumberChange}
                disabled={!config.enableAutoRefresh}
                helperText="How often to refresh data from Azure DevOps"
                InputProps={{ inputProps: { min: 1 } }}
              />
            </Grid>
          </Grid>
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Card>
      <CardHeader
        title={isFirstTimeSetup ? "Welcome to AI Scrum Agent" : "Azure DevOps Configuration"}
        subheader={
          isFirstTimeSetup
            ? "Let's set up your Azure DevOps connection to get started"
            : "Configure your Azure DevOps connection settings"
        }
      />
      <Divider />
      <CardContent>
        {isFirstTimeSetup && (
          <Box mb={4}>
            <Typography variant="body1" color="textSecondary" paragraph>
              AI Scrum Agent needs to connect to your Azure DevOps organization to monitor your work items and sprints.
              Please provide your Azure DevOps credentials and settings below.
            </Typography>
          </Box>
        )}

        <form onSubmit={handleSubmit}>
          <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {getStepContent(activeStep)}

          <Box mt={3} display="flex" justifyContent="space-between">
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            <Box>
              {activeStep === steps.length - 1 ? (
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  startIcon={isSubmitting ? <CircularProgress size={20} /> : <SaveIcon />}
                  disabled={isSubmitting || !config.organization || !config.project || !config.personalAccessToken}
                >
                  {isFirstTimeSetup ? 'Complete Setup' : 'Save Configuration'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  disabled={activeStep === 0 && (!config.organization || !config.personalAccessToken)}
                >
                  Next
                </Button>
              )}
            </Box>
          </Box>
        </form>
      </CardContent>
    </Card>
  );
};

export default AdoConfigForm;
