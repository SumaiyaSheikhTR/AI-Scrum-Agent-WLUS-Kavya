import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Switch,
  FormControlLabel,
  Button,
  Chip,
  TextField,
  List,
  ListItem,
  ListItemText,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  Schedule as ScheduleIcon,
  Rule as RuleIcon,
  Code as CodeIcon
} from '@mui/icons-material';

// Import services
import rulesEngine, { Rule } from '../../services/rulesEngine';
import dailySummaryScheduler, { SchedulerConfig } from '../../services/dailySummaryScheduler';
import gitPRMonitoringService from '../../services/gitPRMonitoringService';
import notificationAlertingSystem, { AlertingConfig, AlertRule } from '../../services/notificationAlertingSystem';
import sentimentAnalysisBackgroundService from '../../services/sentimentAnalysisBackgroundService';

interface AutomationSettingsPanelProps {}

export const AutomationSettingsPanel: React.FC<AutomationSettingsPanelProps> = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Rules Engine State
  const [rulesEngineRules, setRulesEngineRules] = useState<Rule[]>([]);

  // Daily Summary State
  const [summaryConfig, setSummaryConfig] = useState<SchedulerConfig | null>(null);

  // Git Monitoring State - simplified for work item PR tracking
  const [gitStats, setGitStats] = useState<any>(null);

  // Alerting System State
  const [alertingConfig, setAlertingConfig] = useState<AlertingConfig | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);

  // Sentiment Analysis State
  const [sentimentStats, setSentimentStats] = useState<any>(null);

  const loadServiceStates = useCallback(async () => {
    try {
      // Load Rules Engine
      const rules = rulesEngine.getRules();
      setRulesEngineRules(rules);

      // Load Daily Summary Config
      const summaryConf = dailySummaryScheduler.getConfig();
      setSummaryConfig(summaryConf);

      // Load Git Monitoring Stats
      const stats = await gitPRMonitoringService.getStatistics();
      setGitStats(stats);

      // Load Alerting Config
      const alertConf = notificationAlertingSystem.getConfig();
      setAlertingConfig(alertConf);
      const alertRulesData = notificationAlertingSystem.getAlertRules();
      setAlertRules(alertRulesData);

      // Load Sentiment Stats
      const sentimentStatsData = sentimentAnalysisBackgroundService.getCacheStats();
      setSentimentStats(sentimentStatsData);
    } catch (error) {
      console.error('Error loading service states:', error);
      showMessage('error', 'Failed to load automation settings');
    }
  }, []);

  useEffect(() => {
    loadServiceStates();
  }, [loadServiceStates]);

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const toggleService = async (service: 'rules' | 'summary' | 'alerting', enabled: boolean) => {
    setLoading(true);
    try {
      switch (service) {
        case 'summary':
          if (summaryConfig) {
            dailySummaryScheduler.updateConfig({ enabled });
            setSummaryConfig({ ...summaryConfig, enabled });
          }
          break;
        case 'alerting':
          if (alertingConfig) {
            notificationAlertingSystem.updateConfig({ enabled });
            setAlertingConfig({ ...alertingConfig, enabled });
          }
          break;
      }
      showMessage('success', `${service} service ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      showMessage('error', `Failed to ${enabled ? 'enable' : 'disable'} ${service} service`);
    } finally {
      setLoading(false);
    }
  };

  const openConfigDialog = (type: 'summary' | 'git' | 'alerting') => {
    // TODO: Implement configuration dialogs
    console.log(`Opening config dialog for ${type}`);
  };

  const TabPanel = ({ children, value, index }: { children: React.ReactNode; value: number; index: number }) => (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  const ServiceStatusCard = ({ 
    title, 
    description, 
    enabled, 
    onToggle, 
    onConfigure,
    icon,
    stats 
  }: {
    title: string;
    description: string;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    onConfigure?: () => void;
    icon: React.ReactNode;
    stats?: React.ReactNode;
  }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          {icon}
          <Typography variant="h6" sx={{ ml: 1 }}>
            {title}
          </Typography>
          <Chip 
            label={enabled ? 'Active' : 'Inactive'} 
            color={enabled ? 'success' : 'default'}
            size="small"
            sx={{ ml: 'auto' }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {description}
        </Typography>
        {stats}
      </CardContent>
      <CardActions sx={{ justifyContent: 'space-between' }}>
        <FormControlLabel
          control={
            <Switch 
              checked={enabled} 
              onChange={(e) => onToggle(e.target.checked)}
              disabled={loading}
            />
          }
          label={enabled ? 'Enabled' : 'Disabled'}
        />
        {onConfigure && (
          <Button
            startIcon={<SettingsIcon />}
            onClick={onConfigure}
            disabled={loading}
          >
            Configure
          </Button>
        )}
      </CardActions>
    </Card>
  );

  return (
    <Box sx={{ width: '100%' }}>
      <Typography variant="h4" gutterBottom>
        Automation & AI Settings
      </Typography>
      
      {message && (
        <Alert severity={message.type} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Rules Engine" />
          <Tab label="Daily Summaries" />
          <Tab label="Git/PR Monitoring" />
          <Tab label="Alerts & Notifications" />
          <Tab label="Sentiment Analysis" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Rules Engine"
              description="Automated work item management and status updates"
              enabled={rulesEngineRules.some(r => r.enabled)}
              onToggle={(enabled) => {
                rulesEngineRules.forEach(rule => {
                  rulesEngine.updateRule(rule.id, { enabled });
                });
                loadServiceStates();
              }}
              onConfigure={() => setActiveTab(1)}
              icon={<RuleIcon color="primary" />}
              stats={
                <Typography variant="caption" color="text.secondary">
                  {rulesEngineRules.filter(r => r.enabled).length} active rules
                </Typography>
              }
            />
          </Grid>
          
          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Daily Summaries"
              description="Automated daily sprint progress reports"
              enabled={summaryConfig?.enabled || false}
              onToggle={(enabled) => toggleService('summary', enabled)}
              onConfigure={() => openConfigDialog('summary')}
              icon={<ScheduleIcon color="primary" />}
              stats={
                summaryConfig && (
                  <Typography variant="caption" color="text.secondary">
                    Scheduled for {summaryConfig.dailyTime} daily
                  </Typography>
                )
              }
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Git/PR Monitoring"
              description="Monitors work items with linked pull requests"
              enabled={true}
              onToggle={() => {}}
              icon={<CodeIcon color="primary" />}
              stats={
                gitStats && (
                  <Typography variant="caption" color="text.secondary">
                    {gitStats.totalWorkItemsWithPRs} work items with PRs
                  </Typography>
                )
              }
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Alerts & Notifications"
              description="Smart alerting for anomalies and issues"
              enabled={alertingConfig?.enabled || false}
              onToggle={(enabled) => toggleService('alerting', enabled)}
              onConfigure={() => openConfigDialog('alerting')}
              icon={<NotificationsIcon color="primary" />}
              stats={
                <Typography variant="caption" color="text.secondary">
                  {alertRules.filter(r => r.enabled).length} active alert rules
                </Typography>
              }
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Sentiment Analysis"
              description="Background sentiment monitoring and caching"
              enabled={true}
              onToggle={() => {}}
              icon={<NotificationsIcon color="primary" />}
              stats={
                sentimentStats && (
                  <Box>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {sentimentStats.validEntries} cached entries
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {sentimentStats.staleEntries} stale entries
                    </Typography>
                  </Box>
                )
              }
            />
          </Grid>
        </Grid>
      </TabPanel>

      {/* Rules Engine Tab */}
      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">Rules Engine Configuration</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              // TODO: Implement add rule dialog
              console.log('Add rule dialog');
            }}
          >
            Add Rule
          </Button>
        </Box>

        <Grid container spacing={2}>
          {rulesEngineRules.map((rule) => (
            <Grid item xs={12} key={rule.id}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {rule.name}
                    </Typography>
                    <Chip 
                      label={rule.enabled ? 'Enabled' : 'Disabled'} 
                      color={rule.enabled ? 'success' : 'default'}
                      size="small"
                      sx={{ mr: 2 }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      Priority: {rule.priority} | Executed: {rule.executionCount} times
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {rule.description}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>Conditions:</Typography>
                  <List dense>
                    {rule.conditions.map((condition, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${condition.field} ${condition.operator} ${condition.value}`}
                          secondary={condition.logicalOperator}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Typography variant="subtitle2" gutterBottom>Actions:</Typography>
                  <List dense>
                    {rule.actions.map((action, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={action.type}
                          secondary={JSON.stringify(action.parameters)}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => {
                        // TODO: Implement edit rule dialog
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      color="error"
                      onClick={() => {
                        rulesEngine.deleteRule(rule.id);
                        loadServiceStates();
                        showMessage('success', 'Rule deleted');
                      }}
                    >
                      Delete
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        rulesEngine.updateRule(rule.id, { enabled: !rule.enabled });
                        loadServiceStates();
                        showMessage('success', `Rule ${rule.enabled ? 'disabled' : 'enabled'}`);
                      }}
                    >
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Daily Summaries Tab */}
      <TabPanel value={activeTab} index={2}>
        <Typography variant="h5" gutterBottom>Daily Summary Configuration</Typography>
        
        {summaryConfig && (
          <Paper sx={{ p: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={summaryConfig.enabled} 
                      onChange={(e) => toggleService('summary', e.target.checked)}
                    />
                  }
                  label="Enable Daily Summaries"
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Daily Time (HH:MM)"
                  value={summaryConfig.dailyTime}
                  onChange={(e) => {
                    const newConfig = { ...summaryConfig, dailyTime: e.target.value };
                    setSummaryConfig(newConfig);
                    dailySummaryScheduler.updateConfig({ dailyTime: e.target.value });
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={summaryConfig.includeWeekends} 
                      onChange={(e) => {
                        const newConfig = { ...summaryConfig, includeWeekends: e.target.checked };
                        setSummaryConfig(newConfig);
                        dailySummaryScheduler.updateConfig({ includeWeekends: e.target.checked });
                      }}
                    />
                  }
                  label="Include Weekends"
                />
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await dailySummaryScheduler.generateSummaryNow();
                      showMessage('success', 'Daily summary generated successfully');
                    } catch (error) {
                      showMessage('error', 'Failed to generate summary');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  Generate Summary Now
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}
      </TabPanel>

      {/* Git/PR Monitoring Tab */}
      <TabPanel value={activeTab} index={3}>
        <Typography variant="h5" gutterBottom>Git/PR Monitoring</Typography>
        
        <Paper sx={{ p: 3 }}>
          <Typography variant="body1" paragraph>
            The Git/PR monitoring service automatically tracks work items that have linked pull requests.
            No configuration is needed - it works by scanning work item links and attachments for PR references.
          </Typography>

          {gitStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">{gitStats.totalWorkItemsWithPRs}</Typography>
                  <Typography variant="caption">Work Items with PRs</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="info.main">{gitStats.totalPRs}</Typography>
                  <Typography variant="caption">Total PRs</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">{gitStats.activePRs}</Typography>
                  <Typography variant="caption">Active PRs</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">{gitStats.completedPRs}</Typography>
                  <Typography variant="caption">Completed PRs</Typography>
                </Box>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={() => {
                    gitPRMonitoringService.clearCache();
                    loadServiceStates();
                    showMessage('success', 'Git/PR cache cleared');
                  }}
                >
                  Refresh Data
                </Button>
              </Grid>
            </Grid>
          )}
        </Paper>
      </TabPanel>

      {/* Alerts Tab */}
      <TabPanel value={activeTab} index={4}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">Alerts & Notifications</Typography>
          <Button
            startIcon={<AddIcon />}
            variant="contained"
            onClick={() => {
              // TODO: Implement add alert rule dialog
              console.log('Add alert rule dialog');
            }}
          >
            Add Alert Rule
          </Button>
        </Box>

        {alertingConfig && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={alertingConfig.enabled} 
                      onChange={(e) => toggleService('alerting', e.target.checked)}
                    />
                  }
                  label="Enable Alerting System"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Check Interval (minutes)"
                  type="number"
                  value={alertingConfig.checkInterval}
                  onChange={(e) => {
                    const newConfig = { ...alertingConfig, checkInterval: parseInt(e.target.value) };
                    setAlertingConfig(newConfig);
                    notificationAlertingSystem.updateConfig({ checkInterval: parseInt(e.target.value) });
                  }}
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Max Alerts Per Hour"
                  type="number"
                  value={alertingConfig.maxAlertsPerHour}
                  onChange={(e) => {
                    const newConfig = { ...alertingConfig, maxAlertsPerHour: parseInt(e.target.value) };
                    setAlertingConfig(newConfig);
                    notificationAlertingSystem.updateConfig({ maxAlertsPerHour: parseInt(e.target.value) });
                  }}
                />
              </Grid>
            </Grid>
          </Paper>
        )}

        <Grid container spacing={2}>
          {alertRules.map((rule) => (
            <Grid item xs={12} key={rule.id}>
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                    <Typography variant="h6" sx={{ flexGrow: 1 }}>
                      {rule.name}
                    </Typography>
                    <Chip 
                      label={rule.severity} 
                      color={
                        rule.severity === 'critical' ? 'error' :
                        rule.severity === 'high' ? 'warning' :
                        rule.severity === 'medium' ? 'primary' : 'default'
                      }
      size="small"
                      sx={{ mr: 2 }}
                    />
                    <Chip 
                      label={rule.enabled ? 'Enabled' : 'Disabled'} 
                      color={rule.enabled ? 'success' : 'default'}
                      size="small"
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {rule.description}
                  </Typography>
                  
                  <Typography variant="caption" color="text.secondary">
                    Throttle: {rule.throttleMinutes} minutes | Channels: {rule.notificationChannels.join(', ')}
                  </Typography>

                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => {
                        // TODO: Implement edit alert rule dialog
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      startIcon={<DeleteIcon />}
                      color="error"
                      onClick={() => {
                        notificationAlertingSystem.deleteAlertRule(rule.id);
                        loadServiceStates();
                        showMessage('success', 'Alert rule deleted');
                      }}
                    >
                      Delete
                    </Button>
                    <Button
                      size="small"
                      onClick={() => {
                        notificationAlertingSystem.updateAlertRule(rule.id, { enabled: !rule.enabled });
                        loadServiceStates();
                        showMessage('success', `Alert rule ${rule.enabled ? 'disabled' : 'enabled'}`);
                      }}
                    >
                      {rule.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Sentiment Analysis Tab */}
      <TabPanel value={activeTab} index={5}>
        <Typography variant="h5" gutterBottom>Sentiment Analysis</Typography>
        
        <Paper sx={{ p: 3 }}>
          {sentimentStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">{sentimentStats.totalEntries}</Typography>
                  <Typography variant="caption">Total Entries</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">{sentimentStats.validEntries}</Typography>
                  <Typography variant="caption">Valid Entries</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">{sentimentStats.staleEntries}</Typography>
                  <Typography variant="caption">Stale Entries</Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Button
                    variant="contained"
                    onClick={() => {
                      sentimentAnalysisBackgroundService.clearCache();
                      loadServiceStates();
                      showMessage('success', 'Sentiment cache cleared');
                    }}
                  >
                    Clear Cache
                  </Button>
                </Box>
              </Grid>

              {sentimentStats.newestEntry && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Last Updated: {sentimentStats.newestEntry.toLocaleString()}
                  </Typography>
                </Grid>
              )}
            </Grid>
          )}
        </Paper>
      </TabPanel>
    </Box>
  );
};

export default AutomationSettingsPanel;
