import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Alert,
  Grid,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import developerEngagementService from '../../services/developerEngagementService';
import teamsNotificationService from '../../services/teamsNotificationService';

const TeamsNotificationConfigForm: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Developer Engagement Config
  const [engagementConfig, setEngagementConfig] = useState(developerEngagementService.getConfig());
  
  // Teams Notification Config
  const [teamsConfig, setTeamsConfig] = useState(teamsNotificationService.getConfig());
  
  // Load configs
  useEffect(() => {
    try {
      setEngagementConfig(developerEngagementService.getConfig());
      setTeamsConfig(teamsNotificationService.getConfig());
      setLoading(false);
    } catch (err) {
      setError('Error loading configuration');
      setLoading(false);
    }
  }, []);
  
  // Handle Teams notification toggle
  const handleTeamsEnabledChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    setEngagementConfig(prev => ({
      ...prev,
      teamsNotifications: {
        ...prev.teamsNotifications,
        enabled
      }
    }));
  };
  
  // Handle send to Teams toggle
  const handleSendToTeamsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sendToTeams = event.target.checked;
    setEngagementConfig(prev => ({
      ...prev,
      teamsNotifications: {
        ...prev.teamsNotifications,
        sendToTeams
      }
    }));
  };
  
  // Handle send to ADO toggle
  const handleSendToAdoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sendToAdo = event.target.checked;
    setEngagementConfig(prev => ({
      ...prev,
      teamsNotifications: {
        ...prev.teamsNotifications,
        sendToAdo
      }
    }));
  };
  
  // Handle webhook URL change
  const handleWebhookUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const webhookUrl = event.target.value;
    setTeamsConfig(prev => ({
      ...prev,
      webhookUrl
    }));
  };
  
  // Handle default channel change
  const handleDefaultChannelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const defaultChannel = event.target.value;
    setTeamsConfig(prev => ({
      ...prev,
      defaultChannel
    }));
  };
  
  // Handle save
  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Update Teams notification config
      teamsNotificationService.updateConfig({
        ...teamsConfig,
        enabled: engagementConfig.teamsNotifications.enabled
      });
      
      // Update developer engagement config
      developerEngagementService.updateConfig({
        teamsNotifications: engagementConfig.teamsNotifications
      });
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError('Error saving configuration');
    } finally {
      setSaving(false);
    }
  };
  
  // Handle test notification
  const handleTestNotification = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Send a test notification
      const success = await teamsNotificationService.sendChannelMessage(
        teamsConfig.defaultChannel,
        'Test Notification',
        'This is a test notification from the AI Scrum Agent.'
      );
      
      if (success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        setError('Failed to send test notification. Check your Teams configuration.');
      }
    } catch (err) {
      setError('Error sending test notification');
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Microsoft Teams Notification Settings
        </Typography>
        
        <Typography variant="body2" color="text.secondary" paragraph>
          Configure how work item reminders are sent to Microsoft Teams.
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {saveSuccess && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Configuration saved successfully!
          </Alert>
        )}
        
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={engagementConfig.teamsNotifications.enabled}
                  onChange={handleTeamsEnabledChange}
                  color="primary"
                />
              }
              label="Enable Teams Notifications"
            />
            <Tooltip title="Enable or disable Microsoft Teams notifications for work item reminders">
              <IconButton size="small">
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Grid>
          
          <Grid item xs={12}>
            <Divider />
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Notification Destinations
            </Typography>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={engagementConfig.teamsNotifications.sendToTeams}
                  onChange={handleSendToTeamsChange}
                  color="primary"
                  disabled={!engagementConfig.teamsNotifications.enabled}
                />
              }
              label="Send to Microsoft Teams"
            />
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <FormControlLabel
              control={
                <Switch
                  checked={engagementConfig.teamsNotifications.sendToAdo}
                  onChange={handleSendToAdoChange}
                  color="primary"
                />
              }
              label="Send to Azure DevOps (as comments)"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Divider />
            <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>
              Teams Configuration
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Teams Webhook URL"
              variant="outlined"
              fullWidth
              value={teamsConfig.webhookUrl || ''}
              onChange={handleWebhookUrlChange}
              disabled={!engagementConfig.teamsNotifications.enabled}
              helperText="The webhook URL for your Microsoft Teams channel"
              placeholder="https://outlook.office.com/webhook/..."
            />
          </Grid>
          
          <Grid item xs={12}>
            <TextField
              label="Default Channel"
              variant="outlined"
              fullWidth
              value={teamsConfig.defaultChannel || ''}
              onChange={handleDefaultChannelChange}
              disabled={!engagementConfig.teamsNotifications.enabled}
              helperText="The default channel to send notifications to when a user mapping is not found"
              placeholder="General"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>
              Note: User mappings can be configured in the Teams Notification Service settings.
            </Typography>
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              <Button
                variant="outlined"
                onClick={handleTestNotification}
                disabled={saving || !engagementConfig.teamsNotifications.enabled || !teamsConfig.webhookUrl}
              >
                Test Notification
              </Button>
              
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

export default TeamsNotificationConfigForm;
