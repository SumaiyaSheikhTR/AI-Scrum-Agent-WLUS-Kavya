import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  Switch,
  Typography,
  Button,
  Alert,
  Snackbar
} from '@mui/material';

export interface UISettings {
  showWorkItemsTab: boolean;
}

const defaultUISettings: UISettings = {
  showWorkItemsTab: false // Default to hidden as requested
};

const UISettingsForm: React.FC = () => {
  const [settings, setSettings] = useState<UISettings>(defaultUISettings);
  const [notification, setNotification] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error' | 'warning' | 'info'
  });

  const loadSettings = () => {
    try {
      const savedSettings = localStorage.getItem('ui-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultUISettings, ...parsed });
      }
    } catch (error) {
      console.error('Error loading UI settings:', error);
      showNotification('Error loading UI settings', 'error');
    }
  };

  useEffect(() => {
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveSettings = () => {
    try {
      localStorage.setItem('ui-settings', JSON.stringify(settings));
      
      // Dispatch event to notify other components of UI settings change
      window.dispatchEvent(new CustomEvent('ui-settings-changed', { 
        detail: settings 
      }));
      
      showNotification('UI settings saved successfully', 'success');
    } catch (error) {
      console.error('Error saving UI settings:', error);
      showNotification('Error saving UI settings', 'error');
    }
  };

  const showNotification = (message: string, severity: 'success' | 'error' | 'warning' | 'info') => {
    setNotification({
      open: true,
      message,
      severity
    });
  };

  const handleCloseNotification = () => {
    setNotification(prev => ({ ...prev, open: false }));
  };

  const handleSettingChange = (setting: keyof UISettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({
      ...prev,
      [setting]: event.target.checked
    }));
  };

  return (
    <Box>
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Navigation Settings
          </Typography>
          <Typography variant="body2" color="textSecondary" paragraph>
            Configure which navigation tabs are visible in the sidebar.
          </Typography>

          <FormControl component="fieldset" sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={settings.showWorkItemsTab}
                  onChange={handleSettingChange('showWorkItemsTab')}
                  color="primary"
                />
              }
              label={
                <Box>
                  <Typography variant="body1">Show Work Items Tab</Typography>
                  <Typography variant="body2" color="textSecondary">
                    Display the Work Items tab in the navigation sidebar
                  </Typography>
                </Box>
              }
            />
          </FormControl>

          <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={saveSettings}
            >
              Save Settings
            </Button>
            <Button
              variant="outlined"
              onClick={loadSettings}
            >
              Reset
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Snackbar
        open={notification.open}
        autoHideDuration={6000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default UISettingsForm;
