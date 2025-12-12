import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Paper,
  Grid,
  Alert,
  CircularProgress,
  FormHelperText,
  Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TestIcon from '@mui/icons-material/Psychology';
import azureOpenAIService from '../../services/azureOpenAiService';

const AzureOpenAiConfigForm: React.FC = () => {
  const [tokenUrl, setTokenUrl] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [assetId, setAssetId] = useState('');
  const [modelName, setModelName] = useState('gpt-4o');
  const [apiVersion, setApiVersion] = useState('2024-02-15-preview');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load saved configuration if available
    const config = azureOpenAIService.getConfig();
    if (config) {
      setTokenUrl(config.tokenUrl || '');
      setEndpoint(config.endpoint || '');
      setWorkspaceId(config.workspaceId || '');
      setAssetId(config.assetId || '');
      setModelName(config.modelName || 'gpt-4o');
      setApiVersion(config.apiVersion || '2024-02-15-preview');
    }
    
    // Try to load config from localStorage (if user previously saved it)
    const savedConfig = localStorage.getItem('tr_openai_config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setTokenUrl(parsed.tokenUrl || '');
        setEndpoint(parsed.endpoint || '');
        setWorkspaceId(parsed.workspaceId || '');
        setAssetId(parsed.assetId || '');
        setModelName(parsed.modelName || 'gpt-4o');
        setApiVersion(parsed.apiVersion || '2024-02-15-preview');
      } catch (e) {
        console.error('Error parsing saved config:', e);
      }
    }
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setIsSaved(false);
    setTestResult(null);

    try {
      // Validate required fields
      if (!tokenUrl.trim()) {
        throw new Error('Token URL is required');
      }
      if (!endpoint.trim()) {
        throw new Error('Endpoint is required');
      }
      if (!workspaceId.trim()) {
        throw new Error('Workspace ID is required');
      }
      if (!assetId.trim()) {
        throw new Error('Asset ID is required');
      }

      // Update the service configuration
      azureOpenAIService.updateConfig({
        tokenUrl: tokenUrl.trim(),
        endpoint: endpoint.trim(),
        workspaceId: workspaceId.trim(),
        assetId: assetId.trim(),
        modelName: modelName.trim(),
        apiVersion: apiVersion.trim()
      });

      setIsSaved(true);
      
      // Auto-hide the success message after 3 seconds
      setTimeout(() => {
        setIsSaved(false);
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the configuration');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!tokenUrl || !endpoint || !workspaceId || !assetId) {
      setError('Please fill in all required fields before testing the connection');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      // Update configuration first
      azureOpenAIService.updateConfig({
        tokenUrl: tokenUrl.trim(),
        endpoint: endpoint.trim(),
        workspaceId: workspaceId.trim(),
        assetId: assetId.trim(),
        modelName: modelName.trim(),
        apiVersion: apiVersion.trim()
      });

      // Test the connection
      const result = await azureOpenAIService.testConnection();
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Connection test failed with an unknown error'
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    setTokenUrl('');
    setEndpoint('');
    setWorkspaceId('');
    setAssetId('');
    setModelName('gpt-4o');
    setApiVersion('2024-02-15-preview');
    setError(null);
    setIsSaved(false);
    setTestResult(null);
    localStorage.removeItem('tr_openai_config');
  };

  return (
    <Paper elevation={3} sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Thomson Reuters Azure OpenAI Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure your Thomson Reuters Azure OpenAI service connection to enable AI-powered features in your Scrum assistant.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {isSaved && (
        <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
          Configuration saved successfully!
        </Alert>
      )}

      {testResult && (
        <Alert severity={testResult.success ? "success" : "error"} sx={{ mb: 2 }}>
          {testResult.message}
        </Alert>
      )}

      <Box component="form" noValidate>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Token URL"
              value={tokenUrl}
              onChange={(e) => setTokenUrl(e.target.value)}
              placeholder="https://aiplatform.gcs.int.thomsonreuters.com/v1/openai/token"
              required
              helperText="Thomson Reuters OpenAI token endpoint URL"
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://eais2-use.int.thomsonreuters.com"
              required
              helperText="Thomson Reuters Azure OpenAI service endpoint URL"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Workspace ID"
              value={workspaceId}
              onChange={(e) => setWorkspaceId(e.target.value)}
              placeholder="SumaiyaSheikEgRr"
              required
              helperText="Your Thomson Reuters workspace ID"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Asset ID"
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="208469"
              required
              helperText="Your Thomson Reuters asset ID"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="Model Name"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="gpt-4o"
              required
              helperText="The AI model to use (e.g., gpt-4o, gpt-3.5-turbo)"
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              label="API Version"
              value={apiVersion}
              onChange={(e) => setApiVersion(e.target.value)}
              placeholder="2024-02-15-preview"
              required
              helperText="Azure OpenAI API version"
            />
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 2 }} />
            <FormHelperText>
              <Typography variant="body2" color="text.secondary">
                <strong>How to get your Thomson Reuters OpenAI credentials:</strong>
                <br />
                1. Contact your Thomson Reuters administrator for workspace access
                <br />
                2. Obtain your workspace ID (e.g., "SumaiyaSheikEgRr")
                <br />
                3. Get your asset ID from the workspace console (e.g., "208469")
                <br />
                4. Use the standard TR OpenAI token URL and endpoint provided above
              </Typography>
            </FormHelperText>
          </Grid>

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
                onClick={handleSave}
                disabled={isLoading || isTesting}
                sx={{ minWidth: 120 }}
              >
                {isLoading ? 'Saving...' : 'Save Config'}
              </Button>

              <Button
                variant="outlined"
                startIcon={isTesting ? <CircularProgress size={20} /> : <TestIcon />}
                onClick={handleTestConnection}
                disabled={isLoading || isTesting || !tokenUrl || !endpoint || !workspaceId || !assetId}
                sx={{ minWidth: 140 }}
              >
                {isTesting ? 'Testing...' : 'Test Connection'}
              </Button>

              <Button
                variant="text"
                color="secondary"
                onClick={handleReset}
                disabled={isLoading || isTesting}
              >
                Reset
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Box>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          Configuration Tips
        </Typography>
        <Typography variant="body2" color="text.secondary">
          • Make sure you have valid Thomson Reuters workspace access
          <br />
          • Ensure your workspace ID and asset ID are correct
          <br />
          • Verify your Thomson Reuters AI platform permissions
          <br />
          • Test the connection after saving to verify everything works
          <br />
          • Contact TR support if you encounter authentication issues
        </Typography>
      </Box>
    </Paper>
  );
};

export default AzureOpenAiConfigForm;
