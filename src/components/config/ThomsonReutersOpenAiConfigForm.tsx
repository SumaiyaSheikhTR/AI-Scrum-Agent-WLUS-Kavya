import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Grid,
  Chip,
  Link,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import {
  Save as SaveIcon,
  BugReport as TestIcon,
  ExpandMore as ExpandMoreIcon,
  CheckCircle as CheckCircleIcon,
  Info as InfoIcon,
  Warning as WarningIcon
} from '@mui/icons-material';
import { thomsonReutersOpenAIService } from '../../services/thomsonReutersOpenAiService';

interface ThomsonReutersOpenAIConfig {
  workspace_id: string;
  model_name: string;
  asset_id: string;
  base_url: string;
  token_url: string;
}

const ThomsonReutersOpenAiConfigForm: React.FC = () => {
  const [config, setConfig] = useState<ThomsonReutersOpenAIConfig>({
    workspace_id: 'RittikaPlaygneUd',
    model_name: 'gpt-4o',
    asset_id: '204383',
    base_url: 'https://eais2-use.int.thomsonreuters.com',
    token_url: 'https://aiplatform.gcs.int.thomsonreuters.com/v1/openai/token'
  });

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info' | 'warning', text: string } | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'failed'>('unknown');

  useEffect(() => {
    // Load saved configuration
    const savedConfig = thomsonReutersOpenAIService.getConfig();
    setConfig(savedConfig);
  }, []);

  const handleConfigChange = (field: keyof ThomsonReutersOpenAIConfig) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setConfig(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // Update the service configuration
      thomsonReutersOpenAIService.updateConfig(config);
      
      setMessage({
        type: 'success',
        text: 'Thomson Reuters OpenAI configuration saved successfully!'
      });
      
      setConnectionStatus('unknown');
    } catch (error) {
      console.error('Failed to save configuration:', error);
      setMessage({
        type: 'error',
        text: 'Failed to save configuration. Please check your inputs and try again.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setMessage(null);

    try {
      // Save current config first
      thomsonReutersOpenAIService.updateConfig(config);
      
      // Always test the real Thomson Reuters OpenAI connection
      const isConnected = await thomsonReutersOpenAIService.testConnection();
      
      if (isConnected) {
        setConnectionStatus('connected');
        setMessage({
          type: 'success',
          text: 'Thomson Reuters OpenAI connection test successful! The service is ready to generate capacity recommendations.'
        });
      } else {
        setConnectionStatus('failed');
        setMessage({
          type: 'error',
          text: 'Connection test failed. Please verify your workspace ID, asset ID, and network connectivity. Note: CORS errors are expected when running from localhost - the service will work properly when deployed.'
        });
      }
    } catch (error) {
      console.error('Connection test failed:', error);
      setConnectionStatus('failed');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      let friendlyMessage = `Connection test failed: ${errorMessage}`;
      
      // Provide helpful message for CORS errors
      if (errorMessage.includes('CORS') || errorMessage.includes('Failed to fetch')) {
        friendlyMessage = '🔧 CORS Error: This is expected when running from localhost. The Thomson Reuters OpenAI service will work properly when deployed to a Thomson Reuters environment with proper network access.';
        setMessage({
          type: 'warning',
          text: friendlyMessage
        });
      } else {
        setMessage({
          type: 'error',
          text: friendlyMessage
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const getStatusChip = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Chip icon={<CheckCircleIcon />} label="Connected" color="success" size="small" />;
      case 'failed':
        return <Chip icon={<WarningIcon />} label="Connection Failed" color="error" size="small" />;
      default:
        return <Chip icon={<InfoIcon />} label="Not Tested" color="default" size="small" />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" component="h2" gutterBottom>
            Thomson Reuters OpenAI Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Configure Thomson Reuters Azure OpenAI for real AI recommendations. Localhost uses the TR OpenAI backend proxy (port 3002).
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="body2">
              Connection Status:
            </Typography>
            {getStatusChip()}
          </Box>
        </Box>

        {message && (
          <Alert severity={message.type} sx={{ mb: 3 }}>
            {message.text}
          </Alert>
        )}

        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Workspace ID"
              value={config.workspace_id}
              onChange={handleConfigChange('workspace_id')}
              placeholder="RittikaPlaygneUd"
              helperText="Your Thomson Reuters workspace identifier"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Asset ID"
              value={config.asset_id}
              onChange={handleConfigChange('asset_id')}
              placeholder="204383"
              helperText="Your Thomson Reuters asset identifier"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Model Name"
              value={config.model_name}
              onChange={handleConfigChange('model_name')}
              placeholder="gpt-4o"
              helperText="OpenAI model to use for recommendations"
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Base URL"
              value={config.base_url}
              onChange={handleConfigChange('base_url')}
              placeholder="https://eais2-use.int.thomsonreuters.com"
              helperText="Thomson Reuters OpenAI base URL"
              required
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Token URL"
              value={config.token_url}
              onChange={handleConfigChange('token_url')}
              placeholder="https://aiplatform.gcs.int.thomsonreuters.com/v1/openai/token"
              helperText="Thomson Reuters token endpoint URL"
              required
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
            onClick={handleSave}
            disabled={loading || testing}
          >
            Save Configuration
          </Button>

          <Button
            variant="outlined"
            startIcon={testing ? <CircularProgress size={20} /> : <TestIcon />}
            onClick={handleTestConnection}
            disabled={loading || testing}
          >
            Test Connection
          </Button>
        </Box>

        <Accordion sx={{ mt: 3 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle1">
              How Capacity Recommendations Work
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Typography variant="body2" paragraph>
              The AI-powered capacity utilization system provides intelligent recommendations based on team member workload:
            </Typography>
            
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Optimal Capacity (95-105%)"
                  secondary="Provides encouraging messages and maintenance tips for well-balanced workloads"
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <WarningIcon color="warning" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Over Capacity (>105%)"
                  secondary="Analyzes assigned tasks and suggests which items to deprioritize or reassign based on priority and dependencies"
                />
              </ListItem>
              
              <ListItem>
                <ListItemIcon>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Under Capacity (<95%)"
                  secondary="Reviews unassigned tasks and recommends suitable assignments based on member skills and task requirements"
                />
              </ListItem>
            </List>

            <Typography variant="body2" sx={{ mt: 2 }}>
              <strong>Setup Requirements:</strong>
            </Typography>
            <Typography variant="body2" component="div">
              1. Obtain your workspace ID from the Thomson Reuters workspace console<br />
              2. Get your asset ID from the same console<br />
              3. Ensure network access to Thomson Reuters AI Platform endpoints<br />
              4. Test the connection before using capacity recommendations
            </Typography>

            <Typography variant="body2" sx={{ mt: 2 }}>
              <strong>Data Privacy:</strong> All recommendations are generated using Thomson Reuters' secure AI platform with proper authentication and data handling protocols.
            </Typography>

            <Typography variant="body2" sx={{ mt: 1 }}>
              For more information, visit: {' '}
              <Link href="https://aiplatform.gcs.int.thomsonreuters.com" target="_blank" rel="noopener">
                Thomson Reuters AI Platform
              </Link>
            </Typography>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default ThomsonReutersOpenAiConfigForm;
