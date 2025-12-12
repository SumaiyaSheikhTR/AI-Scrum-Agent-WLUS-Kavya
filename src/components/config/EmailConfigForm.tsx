import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  Paper,
  Grid,
  Alert,
  Divider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Snackbar
} from '@mui/material';
import {
  Email as EmailIcon,
  Schedule as ScheduleIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Science as TestIcon
} from '@mui/icons-material';
import emailService, { EmailConfig, ScheduleConfig } from '../../services/emailService';

interface EmailConfigFormProps {
  onConfigChange?: () => void;
}

const EmailConfigForm: React.FC<EmailConfigFormProps> = ({ onConfigChange }) => {
  const [emailConfig, setEmailConfig] = useState<EmailConfig>({
    enabled: false,
    smtpServer: '',
    smtpPort: 587,
    username: '',
    password: '',
    fromEmail: '',
    fromName: 'AI Scrum Agent',
    useSecure: true
  });

  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({
    enabled: false,
    frequency: 'weekly',
    time: '09:00',
    dayOfWeek: 1,
    dayOfMonth: 1,
    timezone: 'UTC',
    recipients: []
  });

  const [newRecipient, setNewRecipient] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    // Load existing configurations
    setEmailConfig(emailService.getEmailConfig());
    setScheduleConfig(emailService.getScheduleConfig());
  }, []);

  const handleEmailConfigChange = (field: keyof EmailConfig, value: any) => {
    const newConfig = { ...emailConfig, [field]: value };
    setEmailConfig(newConfig);
  };

  const handleScheduleConfigChange = (field: keyof ScheduleConfig, value: any) => {
    const newConfig = { ...scheduleConfig, [field]: value };
    setScheduleConfig(newConfig);
  };

  const handleSaveEmailConfig = () => {
    try {
      emailService.saveEmailConfig(emailConfig);
      setSnackbar({ open: true, message: 'Email configuration saved successfully!', severity: 'success' });
      onConfigChange?.();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save email configuration', severity: 'error' });
    }
  };

  const handleSaveScheduleConfig = () => {
    try {
      emailService.saveScheduleConfig(scheduleConfig);
      setSnackbar({ open: true, message: 'Schedule configuration saved successfully!', severity: 'success' });
      onConfigChange?.();
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to save schedule configuration', severity: 'error' });
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    try {
      // First save the current config
      emailService.saveEmailConfig(emailConfig);
      
      // Then test it
      await emailService.testEmailConfig();
      setSnackbar({ open: true, message: 'Email test successful!', severity: 'success' });
    } catch (error) {
      setSnackbar({ open: true, message: `Email test failed: ${error}`, severity: 'error' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddRecipient = () => {
    if (newRecipient && !scheduleConfig.recipients.includes(newRecipient)) {
      const newRecipients = [...scheduleConfig.recipients, newRecipient];
      setScheduleConfig({ ...scheduleConfig, recipients: newRecipients });
      setNewRecipient('');
    }
  };

  const handleRemoveRecipient = (email: string) => {
    const newRecipients = scheduleConfig.recipients.filter(r => r !== email);
    setScheduleConfig({ ...scheduleConfig, recipients: newRecipients });
  };

  const getTimezoneOptions = () => {
    return [
      'UTC',
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Asia/Kolkata',
      'Australia/Sydney'
    ];
  };

  const getDayOptions = () => {
    return [
      { value: 0, label: 'Sunday' },
      { value: 1, label: 'Monday' },
      { value: 2, label: 'Tuesday' },
      { value: 3, label: 'Wednesday' },
      { value: 4, label: 'Thursday' },
      { value: 5, label: 'Friday' },
      { value: 6, label: 'Saturday' }
    ];
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <EmailIcon />
        Email Configuration
      </Typography>

      {/* Email Server Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EmailIcon fontSize="small" />
          SMTP Server Settings
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={emailConfig.enabled}
                  onChange={(e) => handleEmailConfigChange('enabled', e.target.checked)}
                />
              }
              label="Enable Email Service"
            />
          </Grid>

          {emailConfig.enabled && (
            <>
              <Grid item xs={12} md={8}>
                <TextField
                  fullWidth
                  label="SMTP Server"
                  value={emailConfig.smtpServer}
                  onChange={(e) => handleEmailConfigChange('smtpServer', e.target.value)}
                  placeholder="smtp.gmail.com"
                  helperText="SMTP server hostname"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Port"
                  type="number"
                  value={emailConfig.smtpPort}
                  onChange={(e) => handleEmailConfigChange('smtpPort', parseInt(e.target.value))}
                  helperText="Usually 587 or 465"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Username"
                  value={emailConfig.username}
                  onChange={(e) => handleEmailConfigChange('username', e.target.value)}
                  helperText="SMTP username (usually email address)"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Password"
                  type="password"
                  value={emailConfig.password}
                  onChange={(e) => handleEmailConfigChange('password', e.target.value)}
                  helperText="SMTP password or app-specific password"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="From Email"
                  value={emailConfig.fromEmail}
                  onChange={(e) => handleEmailConfigChange('fromEmail', e.target.value)}
                  placeholder="noreply@company.com"
                  helperText="Email address that reports will be sent from"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="From Name"
                  value={emailConfig.fromName}
                  onChange={(e) => handleEmailConfigChange('fromName', e.target.value)}
                  helperText="Display name for outgoing emails"
                />
              </Grid>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={emailConfig.useSecure}
                      onChange={(e) => handleEmailConfigChange('useSecure', e.target.checked)}
                    />
                  }
                  label="Use Secure Connection (TLS/SSL)"
                />
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                onClick={handleSaveEmailConfig}
                disabled={!emailConfig.enabled}
              >
                Save Email Settings
              </Button>
              <Button
                variant="outlined"
                onClick={handleTestEmail}
                disabled={!emailConfig.enabled || isTesting}
                startIcon={<TestIcon />}
              >
                {isTesting ? 'Testing...' : 'Test Email'}
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Schedule Configuration */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon fontSize="small" />
          Automated Report Scheduling
        </Typography>

        <Grid container spacing={3}>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={scheduleConfig.enabled}
                  onChange={(e) => handleScheduleConfigChange('enabled', e.target.checked)}
                />
              }
              label="Enable Automated Reports"
            />
          </Grid>

          {scheduleConfig.enabled && (
            <>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Frequency</InputLabel>
                  <Select
                    value={scheduleConfig.frequency}
                    onChange={(e) => handleScheduleConfigChange('frequency', e.target.value)}
                    label="Frequency"
                  >
                    <MenuItem value="daily">Daily</MenuItem>
                    <MenuItem value="weekly">Weekly</MenuItem>
                    <MenuItem value="bi-weekly">Bi-weekly</MenuItem>
                    <MenuItem value="monthly">Monthly</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Time"
                  type="time"
                  value={scheduleConfig.time}
                  onChange={(e) => handleScheduleConfigChange('time', e.target.value)}
                  helperText="24-hour format"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl fullWidth>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={scheduleConfig.timezone}
                    onChange={(e) => handleScheduleConfigChange('timezone', e.target.value)}
                    label="Timezone"
                  >
                    {getTimezoneOptions().map(tz => (
                      <MenuItem key={tz} value={tz}>{tz}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {(scheduleConfig.frequency === 'weekly' || scheduleConfig.frequency === 'bi-weekly') && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Day of Week</InputLabel>
                    <Select
                      value={scheduleConfig.dayOfWeek}
                      onChange={(e) => handleScheduleConfigChange('dayOfWeek', e.target.value)}
                      label="Day of Week"
                    >
                      {getDayOptions().map(day => (
                        <MenuItem key={day.value} value={day.value}>{day.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}

              {scheduleConfig.frequency === 'monthly' && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Day of Month"
                    type="number"
                    value={scheduleConfig.dayOfMonth}
                    onChange={(e) => handleScheduleConfigChange('dayOfMonth', parseInt(e.target.value))}
                    inputProps={{ min: 1, max: 31 }}
                    helperText="1-31"
                  />
                </Grid>
              )}

              {/* Recipients Management */}
              <Grid item xs={12}>
                <Divider sx={{ my: 2 }} />
                <Typography variant="subtitle1" gutterBottom>
                  Email Recipients (Manager Emails)
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <TextField
                    label="Add Manager Email"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    placeholder="manager@company.com"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddRecipient()}
                    sx={{ flexGrow: 1 }}
                  />
                  <IconButton
                    onClick={handleAddRecipient}
                    disabled={!newRecipient}
                    color="primary"
                  >
                    <AddIcon />
                  </IconButton>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {scheduleConfig.recipients.map((email, index) => (
                    <Chip
                      key={index}
                      label={email}
                      onDelete={() => handleRemoveRecipient(email)}
                      deleteIcon={<DeleteIcon />}
                      variant="outlined"
                    />
                  ))}
                </Box>

                {scheduleConfig.recipients.length === 0 && (
                  <Alert severity="warning" sx={{ mt: 2 }}>
                    No recipients configured. Add manager email addresses to receive automated reports.
                  </Alert>
                )}
              </Grid>
            </>
          )}

          <Grid item xs={12}>
            <Button
              variant="contained"
              onClick={handleSaveScheduleConfig}
              disabled={!scheduleConfig.enabled}
            >
              Save Schedule Settings
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Information Panel */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          ℹ️ Information
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Email Service:</strong> Configure your SMTP server settings to enable email notifications. 
            Most email providers (Gmail, Outlook, etc.) require app-specific passwords for SMTP access.
          </Typography>
        </Alert>
        <Alert severity="info">
          <Typography variant="body2">
            <strong>Automated Reports:</strong> When enabled, capacity utilization reports will be automatically 
            sent to the specified manager emails according to your schedule. Reports include team utilization 
            metrics, individual performance data, and sprint progress insights.
          </Typography>
        </Alert>
      </Paper>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default EmailConfigForm;
