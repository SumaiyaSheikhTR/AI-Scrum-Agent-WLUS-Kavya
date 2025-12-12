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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Switch,
  FormControlLabel
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import improvedOpenAIService from '../../services/improvedOpenAiService';

const OpenAiConfigForm: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-3.5-turbo');
  const [baseURL, setBaseURL] = useState('https://api.openai.com/v1');
  const [useCustomEndpoint, setUseCustomEndpoint] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResponse, setTestResponse] = useState<string | null>(null);

  useEffect(() => {
    // Load saved configuration if available
    const savedConfig = localStorage.getItem('openai_config');
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig);
        setApiKey(config.apiKey || '');
        setModel(config.model || 'gpt-3.5-turbo');
        setBaseURL(config.baseURL || 'https://api.openai.com/v1');
        setUseCustomEndpoint(config.baseURL !== 'https://api.openai.com/v1');
      } catch (err) {
        console.error('Error loading config:', err);
      }
    }
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);
    setIsSaved(false);

    try {
      // Validate inputs
      if (!apiKey.trim()) {
        throw new Error('API Key is required');
      }

      // Save configuration
      const config = {
        apiKey,
        model,
        baseURL: useCustomEndpoint ? baseURL : 'https://api.openai.com/v1'
      };

      // Update the service configuration
      improvedOpenAIService.updateConfig(config);

      setIsSaved(true);
      // Reset the saved status after 3 seconds
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error('Error saving OpenAI configuration:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsLoading(true);
    setError(null);
    setTestResponse(null);

    try {
      // Temporarily update config for testing
      const config = {
        apiKey,
        model,
        baseURL: useCustomEndpoint ? baseURL : 'https://api.openai.com/v1'
      };
      
      improvedOpenAIService.updateConfig(config);
      
      // Send a test message
      await improvedOpenAIService.chat("Hello! This is a test message to verify the connection is working.");
      setTestResponse("✅ Connection successful! AI responded properly.");
    } catch (err) {
      console.error('Error testing OpenAI connection:', err);
      setError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        OpenAI Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Configure the OpenAI integration for AI-powered features. This uses the standard OpenAI API for better performance and reliability.
      </Typography>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <TextField
            fullWidth
            label="OpenAI API Key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            helperText="Your OpenAI API key (starts with 'sk-')"
          />
        </Grid>

        <Grid item xs={12}>
          <FormControl fullWidth>
            <InputLabel id="model-select-label">Model</InputLabel>
            <Select
              labelId="model-select-label"
              value={model}
              label="Model"
              onChange={(e) => setModel(e.target.value)}
            >
              <MenuItem value="gpt-4">GPT-4 (Recommended)</MenuItem>
              <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster)</MenuItem>
              <MenuItem value="gpt-4-turbo">GPT-4 Turbo</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12}>
          <FormControlLabel
            control={
              <Switch
                checked={useCustomEndpoint}
                onChange={(e) => setUseCustomEndpoint(e.target.checked)}
              />
            }
            label="Use Custom Endpoint"
          />
        </Grid>

        {useCustomEndpoint && (
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Custom Base URL"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              helperText="Custom OpenAI-compatible endpoint (e.g., for Azure OpenAI)"
            />
          </Grid>
        )}

        {error && (
          <Grid item xs={12}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}

        {testResponse && (
          <Grid item xs={12}>
            <Alert severity="success">{testResponse}</Alert>
          </Grid>
        )}

        {isSaved && (
          <Grid item xs={12}>
            <Alert 
              icon={<CheckCircleIcon fontSize="inherit" />} 
              severity="success"
            >
              Configuration saved successfully!
            </Alert>
          </Grid>
        )}

        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={handleTestConnection}
              disabled={isLoading || !apiKey.trim()}
            >
              {isLoading ? 'Testing...' : 'Test Connection'}
            </Button>
            <Button
              variant="contained"
              startIcon={isLoading ? <CircularProgress size={20} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : 'Save Configuration'}
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default OpenAiConfigForm;
