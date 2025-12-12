import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  Grid,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
} from '@mui/material';
import {
  Save as SaveIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import developerEngagementService, {
  DeveloperEngagementConfig,
  ReminderTemplate,
} from '../../services/developerEngagementService';

const DeveloperEngagementConfigForm: React.FC = () => {
  const [config, setConfig] = useState<DeveloperEngagementConfig>(
    developerEngagementService.getConfig()
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ReminderTemplate | null>(null);
  const [newTemplate, setNewTemplate] = useState<Omit<ReminderTemplate, 'id'>>({
    name: '',
    condition: 'stale',
    messageTemplate: '',
    enabled: true,
  });

  useEffect(() => {
    // Load the current configuration
    setConfig(developerEngagementService.getConfig());
  }, []);

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    setConfig((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleNumberChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const numValue = parseInt(value, 10);
    
    if (!isNaN(numValue) && numValue >= 0) {
      setConfig((prev) => ({
        ...prev,
        [name]: numValue,
      }));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    
    try {
      developerEngagementService.updateConfig(config);
      setSaveSuccess(true);
      
      // Reset success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error saving developer engagement config:', error);
      setSaveError('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunManually = async () => {
    setIsSaving(true);
    try {
      await developerEngagementService.runManually();
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error running developer engagement tracking:', error);
      setSaveError('Failed to run tracking. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateEnabledToggle = (templateId: string, enabled: boolean) => {
    const updatedTemplates = config.reminderTemplates.map(template => 
      template.id === templateId ? { ...template, enabled } : template
    );
    
    setConfig(prev => ({
      ...prev,
      reminderTemplates: updatedTemplates,
    }));
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = config.reminderTemplates.filter(
      template => template.id !== templateId
    );
    
    setConfig(prev => ({
      ...prev,
      reminderTemplates: updatedTemplates,
    }));
  };

  const handleEditTemplate = (template: ReminderTemplate) => {
    setEditingTemplate(template);
    setNewTemplate({
      name: template.name,
      condition: template.condition,
      messageTemplate: template.messageTemplate,
      enabled: template.enabled,
    });
    setIsDialogOpen(true);
  };

  const handleAddNewTemplate = () => {
    setEditingTemplate(null);
    setNewTemplate({
      name: '',
      condition: 'stale',
      messageTemplate: '',
      enabled: true,
    });
    setIsDialogOpen(true);
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };

  const handleNewTemplateChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
  ) => {
    const { name, value } = event.target;
    setNewTemplate(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveTemplate = () => {
    // Validate template
    if (!newTemplate.name || !newTemplate.messageTemplate) {
      setSaveError('Template name and message are required.');
      return;
    }
    
    if (editingTemplate) {
      // Update existing template
      const updatedTemplates = config.reminderTemplates.map(template => 
        template.id === editingTemplate.id 
          ? { ...template, ...newTemplate } 
          : template
      );
      
      setConfig(prev => ({
        ...prev,
        reminderTemplates: updatedTemplates,
      }));
    } else {
      // Add new template
      const newTemplateWithId: ReminderTemplate = {
        ...newTemplate,
        id: `custom_${Date.now()}`,
      };
      
      setConfig(prev => ({
        ...prev,
        reminderTemplates: [...prev.reminderTemplates, newTemplateWithId],
      }));
    }
    
    setIsDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader 
        title="Developer Engagement & Follow-ups Configuration" 
        subheader="Configure automated reminders and developer engagement tracking"
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Alert severity="info">
              This feature tracks developer engagement with work items, sends reminders for stale tickets,
              and analyzes comment sentiment to improve team productivity.
            </Alert>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              General Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.trackingEnabled}
                  onChange={handleSwitchChange}
                  name="trackingEnabled"
                  color="primary"
                />
              }
              label="Enable Developer Engagement Tracking"
            />
            
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Update Interval (minutes)"
                name="updateInterval"
                type="number"
                value={config.updateInterval}
                onChange={handleNumberChange}
                InputProps={{ inputProps: { min: 5 } }}
                helperText="How often to check for updates (minimum 5 minutes)"
                margin="normal"
              />
            </Box>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>
              Reminder Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableReminders}
                  onChange={handleSwitchChange}
                  name="enableReminders"
                  color="primary"
                />
              }
              label="Enable Automated Reminders"
            />
            
            <Box sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Reminder Threshold (days)"
                name="reminderThresholdDays"
                type="number"
                value={config.reminderThresholdDays}
                onChange={handleNumberChange}
                InputProps={{ inputProps: { min: 1 } }}
                helperText="Days without updates before sending a reminder"
                margin="normal"
              />
              
              <TextField
                fullWidth
                label="Reminder Cooldown (days)"
                name="reminderCooldownDays"
                type="number"
                value={config.reminderCooldownDays}
                onChange={handleNumberChange}
                InputProps={{ inputProps: { min: 1 } }}
                helperText="Minimum days between reminders for the same work item"
                margin="normal"
              />
            </Box>
            
            <FormControlLabel
              control={
                <Switch
                  checked={config.enableSentimentAnalysis}
                  onChange={handleSwitchChange}
                  name="enableSentimentAnalysis"
                  color="primary"
                />
              }
              label="Enable Comment Sentiment Analysis"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Reminder Templates
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddNewTemplate}
              >
                Add Template
              </Button>
            </Box>
            
            {config.reminderTemplates.map((template) => (
              <Accordion key={template.id} sx={{ mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                    <Typography>{template.name}</Typography>
                    <Box>
                      <Chip 
                        label={template.condition} 
                        size="small" 
                        color="primary" 
                        variant="outlined" 
                        sx={{ mr: 1 }} 
                      />
                      <Switch
                        size="small"
                        checked={template.enabled}
                        onChange={(e) => handleTemplateEnabledToggle(template.id, e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    {template.messageTemplate}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Tooltip title="Edit Template">
                      <IconButton onClick={() => handleEditTemplate(template)} size="small">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Template">
                      <IconButton 
                        onClick={() => handleDeleteTemplate(template.id)} 
                        size="small" 
                        color="error"
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Grid>
          
          <Grid item xs={12}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleRunManually}
                disabled={isSaving || !config.trackingEnabled}
              >
                Run Tracking Now
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<SaveIcon />}
                onClick={handleSave}
                disabled={isSaving}
              >
                Save Configuration
              </Button>
            </Box>
            
            {saveSuccess && (
              <Alert severity="success" sx={{ mt: 2 }}>
                Configuration saved successfully!
              </Alert>
            )}
            
            {saveError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {saveError}
              </Alert>
            )}
          </Grid>
        </Grid>
      </CardContent>
      
      {/* Template Edit Dialog */}
      <Dialog open={isDialogOpen} onClose={handleDialogClose} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingTemplate ? 'Edit Reminder Template' : 'Add New Reminder Template'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Template Name"
                name="name"
                value={newTemplate.name}
                onChange={handleNewTemplateChange}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel id="condition-label">Condition</InputLabel>
                <Select
                  labelId="condition-label"
                  name="condition"
                  value={newTemplate.condition}
                  label="Condition"
                  onChange={handleNewTemplateChange}
                >
                  <MenuItem value="stale">Stale Item</MenuItem>
                  <MenuItem value="blocked">Blocked Item</MenuItem>
                  <MenuItem value="high_effort">High Effort Item</MenuItem>
                  <MenuItem value="missing_info">Missing Information</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Message Template"
                name="messageTemplate"
                value={newTemplate.messageTemplate}
                onChange={handleNewTemplateChange}
                multiline
                rows={4}
                required
                helperText="Use placeholders like {assignee}, {id}, {title}, {state}, {effort}, {daysSinceUpdate}"
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  <strong>Available placeholders:</strong>
                  <br />
                  {'{assignee}'} - The assigned developer's name
                  <br />
                  {'{id}'} - Work item ID
                  <br />
                  {'{title}'} - Work item title
                  <br />
                  {'{state}'} - Current state
                  <br />
                  {'{effort}'} - Effort points
                  <br />
                  {'{daysSinceUpdate}'} - Days since last update
                  <br />
                  {'{daysSinceBlocked}'} - Days since item was blocked
                  <br />
                  {'{daysInProgress}'} - Days in current state
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleSaveTemplate} variant="contained" color="primary">
            Save Template
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default DeveloperEngagementConfigForm;
