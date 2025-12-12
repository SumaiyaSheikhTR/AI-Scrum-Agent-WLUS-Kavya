import React, { useState, useEffect } from 'react';
import { 
  Box, 
  TextField, 
  Button, 
  Typography, 
  Paper, 
  Switch, 
  FormControlLabel,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

interface OpenArenaConfig {
  apiUrl: string;
  workflowId: string;
  essoToken: string;
  isPersistenceAllowed: boolean;
}

interface OpenArenaConfigFormProps {
  initialConfig?: OpenArenaConfig | null;
  onSave?: (config: OpenArenaConfig) => void;
}

const OpenArenaConfigForm: React.FC<OpenArenaConfigFormProps> = ({ initialConfig, onSave }) => {
  const [config, setConfig] = useState<OpenArenaConfig>({
    apiUrl: '',
    workflowId: '',
    essoToken: '',
    isPersistenceAllowed: false
  });
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isTokenMasked, setIsTokenMasked] = useState(true);

  useEffect(() => {
    // If initialConfig is provided, use it
    if (initialConfig) {
      setConfig(initialConfig);
    } else {
      // Otherwise load from localStorage or environment variables
      loadConfig();
    }
  }, [initialConfig]);

  const loadConfig = () => {
    try {
      // Try to load from localStorage first
      const savedConfig = localStorage.getItem('openArenaConfig');
      
      if (savedConfig) {
        const parsedConfig = JSON.parse(savedConfig);
        setConfig(parsedConfig);
        return;
      }
      
      // Fall back to environment variables
      setConfig({
        apiUrl: process.env.REACT_APP_OPENARENA_API_URL || 'http://localhost:3001/api/openarena',
        workflowId: process.env.REACT_APP_OPENARENA_WORKFLOW_ID || '2db16fb7-64d1-4d44-b250-8cb95fced357',
        essoToken: process.env.REACT_APP_OPENARENA_ESSO_TOKEN || '',
        isPersistenceAllowed: process.env.REACT_APP_OPENARENA_PERSISTENCE_ALLOWED === 'true'
      });
    } catch (error) {
      console.error('Error loading OpenArena config:', error);
      setSaveError('Failed to load configuration');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setConfig(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Reset status messages when form is changed
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      // Save to localStorage
      localStorage.setItem('openArenaConfig', JSON.stringify(config));
      
      // Call the onSave prop if provided
      if (onSave) {
        onSave(config);
      } else {
        // If no onSave prop, simulate a delay
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setSaveSuccess(true);
    } catch (error) {
      console.error('Error saving OpenArena config:', error);
      setSaveError('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTokenVisibility = () => {
    setIsTokenMasked(!isTokenMasked);
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        OpenArena Configuration
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Configure the connection to the OpenArena AI service. This integration enables the AI assistant features.
      </Typography>
      
      <Divider sx={{ my: 2 }} />
      
      {saveSuccess && (
        <Alert 
          severity="success" 
          icon={<CheckCircleIcon fontSize="inherit" />}
          sx={{ mb: 2 }}
        >
          Configuration saved successfully
        </Alert>
      )}
      
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {saveError}
        </Alert>
      )}
      
      <Box component="form" onSubmit={handleSubmit} noValidate>
        <TextField
          margin="normal"
          required
          fullWidth
          id="apiUrl"
          label="API URL"
          name="apiUrl"
          value={config.apiUrl}
          onChange={handleChange}
          helperText="The URL of the OpenArena API endpoint"
        />
        
        <TextField
          margin="normal"
          required
          fullWidth
          id="workflowId"
          label="Workflow ID"
          name="workflowId"
          value={config.workflowId}
          onChange={handleChange}
          helperText="The ID of the OpenArena workflow to use"
        />
        
        <TextField
          margin="normal"
          required
          fullWidth
          id="essoToken"
          label="ESSO Token"
          name="essoToken"
          type={isTokenMasked ? 'password' : 'text'}
          value={config.essoToken}
          onChange={handleChange}
          helperText={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Authentication token for OpenArena</span>
              <Button 
                size="small" 
                onClick={toggleTokenVisibility}
                sx={{ ml: 2, minWidth: 100 }}
              >
                {isTokenMasked ? 'Show' : 'Hide'}
              </Button>
            </Box>
          }
        />
        
        <FormControlLabel
          control={
            <Switch
              checked={config.isPersistenceAllowed}
              onChange={handleChange}
              name="isPersistenceAllowed"
              color="primary"
            />
          }
          label="Allow conversation persistence"
          sx={{ mt: 2 }}
        />
        <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 3, mt: -1 }}>
          When enabled, OpenArena will remember conversation context between sessions
        </Typography>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            startIcon={isSaving ? <CircularProgress size={20} /> : <SaveIcon />}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
};

export default OpenArenaConfigForm;
