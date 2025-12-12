import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  TextField,
  Typography,
  Switch,
  FormControlLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ticketManagementService, { 
  TicketManagementConfig, 
  StatusUpdateRule, 
  CommentRule 
} from '../../services/ticketManagementService';

interface TicketManagementConfigFormProps {
  onSave?: (config: TicketManagementConfig) => void;
}

const TicketManagementConfigForm: React.FC<TicketManagementConfigFormProps> = ({
  onSave,
}) => {
  const [config, setConfig] = useState<TicketManagementConfig>(ticketManagementService.getConfig());
  const [isRunning, setIsRunning] = useState(false);
  const [processSummary, setProcessSummary] = useState<{
    lastRun: string | null;
    statusUpdatesApplied: number;
    commentsAdded: number;
    pendingUpdates: number;
  } | null>(null);
  
  // Dialog states
  const [statusRuleDialogOpen, setStatusRuleDialogOpen] = useState(false);
  const [commentRuleDialogOpen, setCommentRuleDialogOpen] = useState(false);
  const [editingStatusRule, setEditingStatusRule] = useState<StatusUpdateRule | null>(null);
  const [editingCommentRule, setEditingCommentRule] = useState<CommentRule | null>(null);
  
  // New rule form states
  const [newStatusRule, setNewStatusRule] = useState<Partial<StatusUpdateRule>>({
    name: '',
    description: '',
    targetState: '',
    enabled: true,
  });
  
  const [newCommentRule, setNewCommentRule] = useState<Partial<CommentRule>>({
    name: '',
    description: '',
    commentTemplate: '',
    cooldownDays: 3,
    enabled: true,
  });

  useEffect(() => {
    // Load process summary
    loadProcessSummary();
  }, []);

  const loadProcessSummary = async () => {
    const summary = await ticketManagementService.getProcessingSummary();
    setProcessSummary(summary);
  };

  const handleSave = () => {
    ticketManagementService.updateConfig(config);
    if (onSave) {
      onSave(config);
    }
  };

  const handleRunManually = async () => {
    setIsRunning(true);
    try {
      await ticketManagementService.runManually();
      // Reload the config to get the updated lastRunTimestamp
      setConfig(ticketManagementService.getConfig());
      // Reload process summary
      await loadProcessSummary();
    } catch (error) {
      console.error('Error running ticket management process:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleAutoUpdates = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConfig({
      ...config,
      enableAutoUpdates: event.target.checked,
    });
  };

  const handleUpdateIntervalChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    if (!isNaN(value) && value > 0) {
      setConfig({
        ...config,
        updateInterval: value,
      });
    }
  };

  // Status rule dialog handlers
  const handleOpenStatusRuleDialog = (rule?: StatusUpdateRule) => {
    if (rule) {
      setEditingStatusRule(rule);
      setNewStatusRule({
        name: rule.name,
        description: rule.description,
        targetState: rule.targetState,
        enabled: rule.enabled,
      });
    } else {
      setEditingStatusRule(null);
      setNewStatusRule({
        name: '',
        description: '',
        targetState: '',
        enabled: true,
      });
    }
    setStatusRuleDialogOpen(true);
  };

  const handleCloseStatusRuleDialog = () => {
    setStatusRuleDialogOpen(false);
  };

  const handleSaveStatusRule = () => {
    if (editingStatusRule) {
      // Update existing rule
      const updatedRules = config.statusUpdateRules.map(rule => 
        rule.id === editingStatusRule.id 
          ? { ...rule, ...newStatusRule }
          : rule
      );
      
      setConfig({
        ...config,
        statusUpdateRules: updatedRules,
      });
    } else {
      // Add new rule (with a dummy condition for UI purposes)
      const dummyCondition = (workItem: any) => false;
      
      const newRule: StatusUpdateRule = {
        id: `custom_${Date.now()}`,
        name: newStatusRule.name || 'New Rule',
        description: newStatusRule.description || '',
        targetState: newStatusRule.targetState || 'Ready for QA',
        enabled: newStatusRule.enabled !== undefined ? newStatusRule.enabled : true,
        condition: dummyCondition,
      };
      
      setConfig({
        ...config,
        statusUpdateRules: [...config.statusUpdateRules, newRule],
      });
    }
    
    handleCloseStatusRuleDialog();
  };

  const handleDeleteStatusRule = (id: string) => {
    setConfig({
      ...config,
      statusUpdateRules: config.statusUpdateRules.filter(rule => rule.id !== id),
    });
  };

  const handleToggleStatusRule = (id: string, enabled: boolean) => {
    setConfig({
      ...config,
      statusUpdateRules: config.statusUpdateRules.map(rule => 
        rule.id === id ? { ...rule, enabled } : rule
      ),
    });
  };

  // Comment rule dialog handlers
  const handleOpenCommentRuleDialog = (rule?: CommentRule) => {
    if (rule) {
      setEditingCommentRule(rule);
      setNewCommentRule({
        name: rule.name,
        description: rule.description,
        commentTemplate: rule.commentTemplate,
        cooldownDays: rule.cooldownDays,
        enabled: rule.enabled,
      });
    } else {
      setEditingCommentRule(null);
      setNewCommentRule({
        name: '',
        description: '',
        commentTemplate: '',
        cooldownDays: 3,
        enabled: true,
      });
    }
    setCommentRuleDialogOpen(true);
  };

  const handleCloseCommentRuleDialog = () => {
    setCommentRuleDialogOpen(false);
  };

  const handleSaveCommentRule = () => {
    if (editingCommentRule) {
      // Update existing rule
      const updatedRules = config.commentRules.map(rule => 
        rule.id === editingCommentRule.id 
          ? { ...rule, ...newCommentRule }
          : rule
      );
      
      setConfig({
        ...config,
        commentRules: updatedRules,
      });
    } else {
      // Add new rule (with a dummy condition for UI purposes)
      const dummyCondition = (workItem: any) => false;
      
      const newRule: CommentRule = {
        id: `custom_${Date.now()}`,
        name: newCommentRule.name || 'New Rule',
        description: newCommentRule.description || '',
        commentTemplate: newCommentRule.commentTemplate || 'Please update this work item.',
        cooldownDays: newCommentRule.cooldownDays || 3,
        enabled: newCommentRule.enabled !== undefined ? newCommentRule.enabled : true,
        condition: dummyCondition,
      };
      
      setConfig({
        ...config,
        commentRules: [...config.commentRules, newRule],
      });
    }
    
    handleCloseCommentRuleDialog();
  };

  const handleDeleteCommentRule = (id: string) => {
    setConfig({
      ...config,
      commentRules: config.commentRules.filter(rule => rule.id !== id),
    });
  };

  const handleToggleCommentRule = (id: string, enabled: boolean) => {
    setConfig({
      ...config,
      commentRules: config.commentRules.map(rule => 
        rule.id === id ? { ...rule, enabled } : rule
      ),
    });
  };

  return (
    <Card>
      <CardHeader
        title="Smart Ticket Management"
        subheader="Configure automatic ticket updates and developer prompts"
      />
      <Divider />
      <CardContent>
        <Grid container spacing={3}>
          {/* General Settings */}
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
              <Typography variant="subtitle1" gutterBottom>
                General Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enableAutoUpdates}
                        onChange={handleToggleAutoUpdates}
                        color="primary"
                      />
                    }
                    label="Enable Automatic Updates"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Update Interval (minutes)"
                    type="number"
                    value={config.updateInterval}
                    onChange={handleUpdateIntervalChange}
                    disabled={!config.enableAutoUpdates}
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Grid>
              </Grid>
              
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Last run: {processSummary?.lastRun || 'Never'}
                  </Typography>
                  {processSummary && (
                    <Typography variant="body2" color="text.secondary">
                      Status updates: {processSummary.statusUpdatesApplied}, 
                      Comments added: {processSummary.commentsAdded}
                    </Typography>
                  )}
                </Box>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleRunManually}
                  disabled={isRunning}
                >
                  {isRunning ? 'Running...' : 'Run Now'}
                </Button>
              </Box>
            </Paper>
          </Grid>

          {/* Status Update Rules */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Status Update Rules</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    These rules automatically update work item statuses based on predefined conditions.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenStatusRuleDialog()}
                    size="small"
                  >
                    Add Rule
                  </Button>
                </Box>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Target State</TableCell>
                        <TableCell align="center">Enabled</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {config.statusUpdateRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>{rule.name}</TableCell>
                          <TableCell>{rule.description}</TableCell>
                          <TableCell>
                            <Chip 
                              label={rule.targetState} 
                              size="small" 
                              color="primary" 
                              variant="outlined" 
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={rule.enabled}
                              onChange={(e) => handleToggleStatusRule(rule.id, e.target.checked)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton 
                                size="small" 
                                onClick={() => handleOpenStatusRuleDialog(rule)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteStatusRule(rule.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {config.statusUpdateRules.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No status update rules defined
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </Grid>

          {/* Comment Rules */}
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Comment Rules</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    These rules automatically add comments to work items to prompt developers for updates.
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenCommentRuleDialog()}
                    size="small"
                  >
                    Add Rule
                  </Button>
                </Box>
                
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Description</TableCell>
                        <TableCell>Cooldown (days)</TableCell>
                        <TableCell align="center">Enabled</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {config.commentRules.map((rule) => (
                        <TableRow key={rule.id}>
                          <TableCell>{rule.name}</TableCell>
                          <TableCell>{rule.description}</TableCell>
                          <TableCell>{rule.cooldownDays}</TableCell>
                          <TableCell align="center">
                            <Switch
                              checked={rule.enabled}
                              onChange={(e) => handleToggleCommentRule(rule.id, e.target.checked)}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit">
                              <IconButton 
                                size="small" 
                                onClick={() => handleOpenCommentRuleDialog(rule)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton 
                                size="small" 
                                onClick={() => handleDeleteCommentRule(rule.id)}
                                color="error"
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                      {config.commentRules.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography variant="body2" color="text.secondary">
                              No comment rules defined
                            </Typography>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SaveIcon />}
            onClick={handleSave}
          >
            Save Configuration
          </Button>
        </Box>
      </CardContent>

      {/* Status Rule Dialog */}
      <Dialog open={statusRuleDialogOpen} onClose={handleCloseStatusRuleDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingStatusRule ? 'Edit Status Update Rule' : 'Add Status Update Rule'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rule Name"
                value={newStatusRule.name}
                onChange={(e) => setNewStatusRule({ ...newStatusRule, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newStatusRule.description}
                onChange={(e) => setNewStatusRule({ ...newStatusRule, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Target State"
                value={newStatusRule.targetState}
                onChange={(e) => setNewStatusRule({ ...newStatusRule, targetState: e.target.value })}
                required
                helperText="The state to move work items to when the condition is met"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newStatusRule.enabled !== undefined ? newStatusRule.enabled : true}
                    onChange={(e) => setNewStatusRule({ ...newStatusRule, enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label="Enabled"
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  Note: Rule conditions are defined in code. This UI allows you to enable/disable rules and configure their basic properties.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseStatusRuleDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveStatusRule} 
            color="primary" 
            variant="contained"
            disabled={!newStatusRule.name || !newStatusRule.targetState}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comment Rule Dialog */}
      <Dialog open={commentRuleDialogOpen} onClose={handleCloseCommentRuleDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingCommentRule ? 'Edit Comment Rule' : 'Add Comment Rule'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Rule Name"
                value={newCommentRule.name}
                onChange={(e) => setNewCommentRule({ ...newCommentRule, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={newCommentRule.description}
                onChange={(e) => setNewCommentRule({ ...newCommentRule, description: e.target.value })}
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Comment Template"
                value={newCommentRule.commentTemplate}
                onChange={(e) => setNewCommentRule({ ...newCommentRule, commentTemplate: e.target.value })}
                multiline
                rows={3}
                required
                helperText="You can use placeholders like {id}, {title}, {state}, {assignedTo}, {effort}, {daysSinceUpdate}"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Cooldown (days)"
                type="number"
                value={newCommentRule.cooldownDays}
                onChange={(e) => setNewCommentRule({ 
                  ...newCommentRule, 
                  cooldownDays: parseInt(e.target.value, 10) || 3 
                })}
                InputProps={{ inputProps: { min: 1 } }}
                helperText="Minimum days between comments to avoid spamming"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newCommentRule.enabled !== undefined ? newCommentRule.enabled : true}
                    onChange={(e) => setNewCommentRule({ ...newCommentRule, enabled: e.target.checked })}
                    color="primary"
                  />
                }
                label="Enabled"
              />
            </Grid>
            <Grid item xs={12}>
              <Alert severity="info">
                <Typography variant="body2">
                  Note: Rule conditions are defined in code. This UI allows you to enable/disable rules and configure their basic properties.
                </Typography>
              </Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCommentRuleDialog}>Cancel</Button>
          <Button 
            onClick={handleSaveCommentRule} 
            color="primary" 
            variant="contained"
            disabled={!newCommentRule.name || !newCommentRule.commentTemplate}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
};

export default TicketManagementConfigForm;
