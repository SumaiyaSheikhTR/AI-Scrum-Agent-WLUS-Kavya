import React, { useState, useEffect } from 'react';
import { Container, Box, Paper, Typography, Snackbar, Alert, Tabs, Tab } from '@mui/material';
import AdoConfigForm from '../../components/config/AdoConfigForm';
import AzureOpenAiConfigForm from '../../components/config/AzureOpenAiConfigForm';
import ThomsonReutersOpenAiConfigForm from '../../components/config/ThomsonReutersOpenAiConfigForm';
import SentimentAnalysisConfigForm from '../../components/config/SentimentAnalysisConfigForm';
import TeamsNotificationConfigForm from '../../components/config/TeamsNotificationConfigForm';
import WorkItemCategoriesConfigForm, { WorkItemCategoriesConfig } from '../../components/config/WorkItemCategoriesConfigForm';
import UISettingsForm from '../../components/config/UISettingsForm';
import EmailConfigForm from '../../components/config/EmailConfigForm';
import AutomationSettingsPanel from '../../components/settings/AutomationSettingsPanel';
import adoService, { AdoConfig } from '../../services/adoService';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

const SettingsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [adoConfig, setAdoConfig] = useState<AdoConfig | null>(null);
  const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    // Load ADO config from localStorage
    const adoConfigStr = localStorage.getItem('adoConfig');
    if (adoConfigStr) {
      try {
        setAdoConfig(JSON.parse(adoConfigStr));
      } catch (error) {
        console.error('Error parsing ADO config:', error);
      }
    }
  }, []);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleSaveAdoConfig = (config: AdoConfig) => {
    try {
      // Update the ADO service with the new config
      adoService.updateConfig(config);
      setAdoConfig(config);

      // Show success notification
      setNotification({
        open: true,
        message: 'Azure DevOps configuration saved successfully!',
        severity: 'success',
      });
    } catch (error) {
      // Show error notification
      setNotification({
        open: true,
        message: `Error saving configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
    }
  };

  const handleTestAdoConnection = async (config: AdoConfig): Promise<boolean> => {
    return await adoService.testConnection(config);
  };

  const handleCloseNotification = () => {
    setNotification((prev) => ({ ...prev, open: false }));
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Settings
        </Typography>

        <Paper elevation={3} sx={{ mt: 3 }}>
          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
              <Tab label="Azure DevOps" {...a11yProps(0)} />
              <Tab label="Azure OpenAI" {...a11yProps(1)} />
              <Tab label="Thomson Reuters AI" {...a11yProps(2)} />
              <Tab label="Work Item Categories" {...a11yProps(3)} />
              <Tab label="Sentiment Analysis" {...a11yProps(4)} />
              <Tab label="Notifications" {...a11yProps(5)} />
              <Tab label="Automation & AI" {...a11yProps(6)} />
              <Tab label="UI Settings" {...a11yProps(7)} />
              <Tab label="Email Settings" {...a11yProps(8)} />
            </Tabs>
          </Box>

          <TabPanel value={tabValue} index={0}>
            <Typography variant="h6" gutterBottom>
              Azure DevOps Configuration
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Configure your Azure DevOps connection to enable work item tracking and sprint management.
            </Typography>

            <AdoConfigForm
              onSave={handleSaveAdoConfig}
              onTest={handleTestAdoConnection}
              initialConfig={adoConfig || undefined}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Typography variant="h6" gutterBottom>
              Azure OpenAI Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure your Azure OpenAI connection to enable AI-powered assistance and insights.
            </Typography>
            
            <AzureOpenAiConfigForm />
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="h6" gutterBottom>
              Thomson Reuters OpenAI Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure Thomson Reuters Azure OpenAI integration for intelligent capacity utilization recommendations.
            </Typography>
            
            <ThomsonReutersOpenAiConfigForm />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Typography variant="h6" gutterBottom>
              Work Item Categories
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure custom categories to automatically group work items based on tags and keywords in titles and descriptions.
            </Typography>
            
            <WorkItemCategoriesConfigForm
              onSave={(config: WorkItemCategoriesConfig) => {
                setNotification({
                  open: true,
                  message: 'Work item categories configuration saved successfully!',
                  severity: 'success',
                });
              }}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={4}>
            <Typography variant="h6" gutterBottom>
              Sentiment Analysis Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure how the AI analyzes sentiment in comments and work items to detect team morale and potential issues.
            </Typography>
            
            <SentimentAnalysisConfigForm 
              onConfigSaved={() => {
                setNotification({
                  open: true,
                  message: 'Sentiment analysis configuration saved successfully!',
                  severity: 'success',
                });
              }}
            />
          </TabPanel>

          <TabPanel value={tabValue} index={5}>
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure how and when you receive notifications about work items and sprint events.
            </Typography>
            
            <TeamsNotificationConfigForm />
          </TabPanel>

          <TabPanel value={tabValue} index={6}>
            <Typography variant="h6" gutterBottom>
              Automation & AI Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Configure automated features and AI-powered assistance.
            </Typography>
            
            <AutomationSettingsPanel />
          </TabPanel>

          <TabPanel value={tabValue} index={7}>
            <Typography variant="h6" gutterBottom>
              UI Settings
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Configure the visibility of the Work Items tab and other UI preferences.
            </Typography>
            
            <UISettingsForm />
          </TabPanel>

          <TabPanel value={tabValue} index={8}>
            <Typography variant="h6" gutterBottom>
              Email Configuration
            </Typography>
            <Typography variant="body2" color="textSecondary" paragraph>
              Configure email settings for automated capacity utilization reports and notifications.
            </Typography>
            
            <EmailConfigForm 
              onConfigChange={() => {
                setNotification({
                  open: true,
                  message: 'Email configuration updated successfully!',
                  severity: 'success',
                });
              }}
            />
          </TabPanel>
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

export default SettingsPage;
