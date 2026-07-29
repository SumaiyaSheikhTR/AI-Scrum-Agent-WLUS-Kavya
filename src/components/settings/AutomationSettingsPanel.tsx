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
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  CircularProgress,
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
  Code as CodeIcon,
  PlayArrow as PlayIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

import rulesEngine, { Rule, RuleAction, RuleCondition } from '../../services/rulesEngine';
import dailySummaryScheduler, { SchedulerConfig } from '../../services/dailySummaryScheduler';
import gitPRMonitoringService from '../../services/gitPRMonitoringService';
import notificationAlertingSystem, {
  AlertingConfig,
  AlertRule,
  AlertSeverity,
  AlertType,
  NotificationChannel,
} from '../../services/notificationAlertingSystem';
import sentimentAnalysisBackgroundService from '../../services/sentimentAnalysisBackgroundService';
import automationOrchestrator from '../../services/automationOrchestrator';
import {
  AUTOMATION_EVENT,
  AutomationExecutionLogEntry,
  AutomationOrchestratorConfig,
  AutomationPlatformStatus,
  AutomationServiceId,
} from '../../services/automationTypes';

interface AutomationSettingsPanelProps {}

const emptyCondition = (): RuleCondition => ({
  field: 'state',
  operator: 'equals',
  value: 'In Progress',
  logicalOperator: 'AND',
});

const emptyAction = (): RuleAction => ({
  type: 'add_comment',
  parameters: { comment: 'Automated comment from AI Scrum Agent.', useAI: false },
});

const FIELD_OPTIONS = [
  'state',
  'type',
  'priority',
  'assignedTo',
  'effort',
  'updatedDate',
  'createdDate',
  'tags',
  'title',
  'description',
];

const OPERATOR_OPTIONS: RuleCondition['operator'][] = [
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'greater_than',
  'less_than',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
  'days_since',
  'regex',
];

const ACTION_TYPES: RuleAction['type'][] = [
  'update_status',
  'add_comment',
  'assign_user',
  'add_tag',
  'update_field',
  'send_notification',
];

const ALERT_TYPES: AlertType[] = [
  'stale_work_item',
  'blocked_item_timeout',
  'sprint_at_risk',
  'velocity_drop',
  'sentiment_decline',
  'no_activity',
  'missing_estimation',
];

const SEVERITIES: AlertSeverity[] = ['low', 'medium', 'high', 'critical'];
const CHANNELS: NotificationChannel[] = ['console', 'teams', 'email', 'dashboard'];

export const AutomationSettingsPanel: React.FC<AutomationSettingsPanelProps> = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  const [platformStatus, setPlatformStatus] = useState<AutomationPlatformStatus | null>(null);
  const [orchestratorConfig, setOrchestratorConfig] =
    useState<AutomationOrchestratorConfig | null>(null);
  const [executionLog, setExecutionLog] = useState<AutomationExecutionLogEntry[]>([]);

  const [rulesEngineRules, setRulesEngineRules] = useState<Rule[]>([]);
  const [summaryConfig, setSummaryConfig] = useState<SchedulerConfig | null>(null);
  const [gitStats, setGitStats] = useState<any>(null);
  const [alertingConfig, setAlertingConfig] = useState<AlertingConfig | null>(null);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [sentimentStats, setSentimentStats] = useState<any>(null);

  // Dialogs
  const [summaryDialogOpen, setSummaryDialogOpen] = useState(false);
  const [alertingDialogOpen, setAlertingDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [draftRule, setDraftRule] = useState<Partial<Rule>>({});
  const [alertDialogOpen, setAlertDialogOpen] = useState(false);
  const [editingAlertRule, setEditingAlertRule] = useState<AlertRule | null>(null);
  const [draftAlertRule, setDraftAlertRule] = useState<Partial<AlertRule>>({});

  const showMessage = (type: 'success' | 'error' | 'info', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const loadServiceStates = useCallback(async () => {
    try {
      setPlatformStatus(automationOrchestrator.getStatus());
      setOrchestratorConfig(automationOrchestrator.getConfig());
      setExecutionLog(automationOrchestrator.getRecentExecutions(25));

      setRulesEngineRules(rulesEngine.getRules());
      setSummaryConfig(dailySummaryScheduler.getConfig());

      const stats = await gitPRMonitoringService.getStatistics();
      setGitStats(stats);

      setAlertingConfig(notificationAlertingSystem.getConfig());
      setAlertRules(notificationAlertingSystem.getAlertRules());
      setSentimentStats(sentimentAnalysisBackgroundService.getCacheStats());
    } catch (error) {
      console.error('Error loading service states:', error);
      showMessage('error', 'Failed to load automation settings');
    }
  }, []);

  useEffect(() => {
    loadServiceStates();

    const onStatus = () => {
      setPlatformStatus(automationOrchestrator.getStatus());
      setExecutionLog(automationOrchestrator.getRecentExecutions(25));
    };
    const onConfig = () => setOrchestratorConfig(automationOrchestrator.getConfig());
    const onExecution = () => {
      setExecutionLog(automationOrchestrator.getRecentExecutions(25));
      setPlatformStatus(automationOrchestrator.getStatus());
    };

    window.addEventListener(AUTOMATION_EVENT.STATUS, onStatus);
    window.addEventListener(AUTOMATION_EVENT.CONFIG, onConfig);
    window.addEventListener(AUTOMATION_EVENT.EXECUTION, onExecution);

    return () => {
      window.removeEventListener(AUTOMATION_EVENT.STATUS, onStatus);
      window.removeEventListener(AUTOMATION_EVENT.CONFIG, onConfig);
      window.removeEventListener(AUTOMATION_EVENT.EXECUTION, onExecution);
    };
  }, [loadServiceStates]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const updateOrchestrator = (partial: Partial<AutomationOrchestratorConfig>) => {
    const next = automationOrchestrator.updateConfig(partial);
    setOrchestratorConfig(next);
    setPlatformStatus(automationOrchestrator.getStatus());
    showMessage('success', 'Automation platform updated');
  };

  const toggleService = async (service: 'summary' | 'alerting', enabled: boolean) => {
    setLoading(true);
    try {
      if (service === 'summary' && summaryConfig) {
        dailySummaryScheduler.updateConfig({ enabled });
        setSummaryConfig({ ...summaryConfig, enabled });
        automationOrchestrator.setServiceEnabled('dailySummary', enabled);
      }
      if (service === 'alerting' && alertingConfig) {
        notificationAlertingSystem.updateConfig({ enabled });
        setAlertingConfig({ ...alertingConfig, enabled });
        automationOrchestrator.setServiceEnabled('alerting', enabled);
      }
      showMessage('success', `${service} ${enabled ? 'enabled' : 'disabled'}`);
      await loadServiceStates();
    } catch {
      showMessage('error', `Failed to update ${service}`);
    } finally {
      setLoading(false);
    }
  };

  const runService = async (serviceId: AutomationServiceId) => {
    setLoading(true);
    try {
      const result = await automationOrchestrator.runServiceNow(serviceId, { force: true });
      showMessage(
        result.status === 'error' ? 'error' : 'success',
        result.summary || `${serviceId} finished with status ${result.status}`
      );
      await loadServiceStates();
    } catch (error) {
      showMessage('error', error instanceof Error ? error.message : 'Run failed');
    } finally {
      setLoading(false);
    }
  };

  const openRuleDialog = (rule?: Rule) => {
    if (rule) {
      setEditingRule(rule);
      setDraftRule({
        ...rule,
        conditions: rule.conditions.map((c) => ({ ...c })),
        actions: rule.actions.map((a) => ({ ...a, parameters: { ...a.parameters } })),
      });
    } else {
      setEditingRule(null);
      setDraftRule({
        name: '',
        description: '',
        priority: 5,
        enabled: true,
        conditions: [emptyCondition()],
        actions: [emptyAction()],
      });
    }
    setRuleDialogOpen(true);
  };

  const saveRuleDialog = () => {
    if (!draftRule.name || !draftRule.conditions?.length || !draftRule.actions?.length) {
      showMessage('error', 'Rule requires a name, at least one condition, and one action');
      return;
    }

    if (editingRule) {
      rulesEngine.updateRule(editingRule.id, {
        name: draftRule.name,
        description: draftRule.description || '',
        priority: draftRule.priority || 5,
        enabled: draftRule.enabled !== false,
        conditions: draftRule.conditions,
        actions: draftRule.actions,
      });
      showMessage('success', 'Rule updated');
    } else {
      rulesEngine.addRule({
        name: draftRule.name!,
        description: draftRule.description || '',
        priority: draftRule.priority || 5,
        enabled: draftRule.enabled !== false,
        conditions: draftRule.conditions!,
        actions: draftRule.actions!,
      });
      showMessage('success', 'Rule created');
    }

    setRuleDialogOpen(false);
    loadServiceStates();
  };

  const openAlertDialog = (rule?: AlertRule) => {
    if (rule) {
      setEditingAlertRule(rule);
      setDraftAlertRule({ ...rule, recipients: [...(rule.recipients || [])] });
    } else {
      setEditingAlertRule(null);
      setDraftAlertRule({
        name: '',
        description: '',
        type: 'stale_work_item',
        severity: 'medium',
        enabled: true,
        throttleMinutes: 240,
        notificationChannels: ['console', 'dashboard'],
        recipients: [],
        conditions: [],
      });
    }
    setAlertDialogOpen(true);
  };

  const saveAlertDialog = () => {
    if (!draftAlertRule.name || !draftAlertRule.type) {
      showMessage('error', 'Alert rule requires a name and type');
      return;
    }

    if (editingAlertRule) {
      notificationAlertingSystem.updateAlertRule(editingAlertRule.id, {
        name: draftAlertRule.name,
        description: draftAlertRule.description || '',
        type: draftAlertRule.type as AlertType,
        severity: (draftAlertRule.severity || 'medium') as AlertSeverity,
        enabled: draftAlertRule.enabled !== false,
        throttleMinutes: draftAlertRule.throttleMinutes || 60,
        notificationChannels: (draftAlertRule.notificationChannels || ['console']) as NotificationChannel[],
        recipients: draftAlertRule.recipients || [],
        customMessage: draftAlertRule.customMessage,
      });
      showMessage('success', 'Alert rule updated');
    } else {
      notificationAlertingSystem.addAlertRule({
        name: draftAlertRule.name!,
        description: draftAlertRule.description || '',
        type: draftAlertRule.type as AlertType,
        severity: (draftAlertRule.severity || 'medium') as AlertSeverity,
        enabled: draftAlertRule.enabled !== false,
        throttleMinutes: draftAlertRule.throttleMinutes || 60,
        notificationChannels: (draftAlertRule.notificationChannels || ['console']) as NotificationChannel[],
        recipients: draftAlertRule.recipients || [],
        conditions: [],
        customMessage: draftAlertRule.customMessage,
      });
      showMessage('success', 'Alert rule created');
    }

    setAlertDialogOpen(false);
    loadServiceStates();
  };

  const TabPanel = ({
    children,
    value,
    index,
  }: {
    children: React.ReactNode;
    value: number;
    index: number;
  }) => (
    <div hidden={value !== index}>{value === index && <Box sx={{ p: 3 }}>{children}</Box>}</div>
  );

  const ServiceStatusCard = ({
    title,
    description,
    enabled,
    onToggle,
    onConfigure,
    onRun,
    icon,
    stats,
  }: {
    title: string;
    description: string;
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    onConfigure?: () => void;
    onRun?: () => void;
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
      <CardActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
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
        <Box sx={{ display: 'flex', gap: 1 }}>
          {onRun && (
            <Button startIcon={<PlayIcon />} onClick={onRun} disabled={loading} size="small">
              Run
            </Button>
          )}
          {onConfigure && (
            <Button startIcon={<SettingsIcon />} onClick={onConfigure} disabled={loading} size="small">
              Configure
            </Button>
          )}
        </Box>
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

      {/* Platform controls */}
      {orchestratorConfig && platformStatus && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
            <SecurityIcon color="primary" />
            <Typography variant="h6">Automation Platform</Typography>
            <Chip
              label={platformStatus.running ? 'Orchestrator Running' : 'Stopped'}
              color={platformStatus.running ? 'success' : 'default'}
              size="small"
              sx={{ ml: 1 }}
            />
            <Chip
              label={orchestratorConfig.dryRun ? 'Dry-run (safe)' : 'Live writes'}
              color={orchestratorConfig.dryRun ? 'info' : 'warning'}
              size="small"
            />
          </Box>

          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={orchestratorConfig.enabled}
                    onChange={(e) => updateOrchestrator({ enabled: e.target.checked })}
                  />
                }
                label="Master enable"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={orchestratorConfig.dryRun}
                    onChange={(e) => updateOrchestrator({ dryRun: e.target.checked })}
                  />
                }
                label="Dry-run (no ADO writes)"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControlLabel
                control={
                  <Switch
                    checked={orchestratorConfig.pauseWhenHidden}
                    onChange={(e) => updateOrchestrator({ pauseWhenHidden: e.target.checked })}
                  />
                }
                label="Pause when tab hidden"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                size="small"
                type="number"
                label="Max writes / hour"
                value={orchestratorConfig.maxWritesPerHour}
                onChange={(e) =>
                  updateOrchestrator({ maxWritesPerHour: Math.max(1, parseInt(e.target.value) || 1) })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" color="text.secondary">
                Writes this hour: {platformStatus.writesThisHour} / {platformStatus.maxWritesPerHour}.
                Enable the master switch to schedule jobs. Keep dry-run on until you trust the rules.
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />}
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    await automationOrchestrator.runAllNow();
                    showMessage('success', 'Ran all enabled automation services');
                    await loadServiceStates();
                  } catch (error) {
                    showMessage('error', error instanceof Error ? error.message : 'Run-all failed');
                  } finally {
                    setLoading(false);
                  }
                }}
              >
                Run All Enabled Now
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
          <Tab label="Overview" />
          <Tab label="Rules Engine" />
          <Tab label="Daily Summaries" />
          <Tab label="Git/PR Monitoring" />
          <Tab label="Alerts & Notifications" />
          <Tab label="Sentiment Analysis" />
          <Tab label="Execution Log" />
        </Tabs>
      </Box>

      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Rules Engine"
              description="Automated work item management and status updates"
              enabled={!!orchestratorConfig?.services.rulesEngine}
              onToggle={(enabled) => automationOrchestrator.setServiceEnabled('rulesEngine', enabled)}
              onConfigure={() => setActiveTab(1)}
              onRun={() => runService('rulesEngine')}
              icon={<RuleIcon color="primary" />}
              stats={
                <Typography variant="caption" color="text.secondary">
                  {rulesEngineRules.filter((r) => r.enabled).length} active rules
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
              onConfigure={() => setSummaryDialogOpen(true)}
              onRun={() => runService('dailySummary')}
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
              onConfigure={() => setAlertingDialogOpen(true)}
              onRun={() => runService('alerting')}
              icon={<NotificationsIcon color="primary" />}
              stats={
                <Typography variant="caption" color="text.secondary">
                  {alertRules.filter((r) => r.enabled).length} active alert rules
                </Typography>
              }
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Ticket Management"
              description="Status transitions and contextual comment prompts"
              enabled={!!orchestratorConfig?.services.ticketManagement}
              onToggle={(enabled) =>
                automationOrchestrator.setServiceEnabled('ticketManagement', enabled)
              }
              onRun={() => runService('ticketManagement')}
              icon={<RuleIcon color="secondary" />}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Sentiment Analysis"
              description="Background sentiment monitoring and caching"
              enabled={!!orchestratorConfig?.services.sentiment}
              onToggle={(enabled) => automationOrchestrator.setServiceEnabled('sentiment', enabled)}
              onRun={() => runService('sentiment')}
              icon={<NotificationsIcon color="secondary" />}
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

          <Grid item xs={12} md={6}>
            <ServiceStatusCard
              title="Developer Engagement"
              description="Inactive item reminders for assignees"
              enabled={!!orchestratorConfig?.services.developerEngagement}
              onToggle={(enabled) =>
                automationOrchestrator.setServiceEnabled('developerEngagement', enabled)
              }
              onRun={() => runService('developerEngagement')}
              icon={<ScheduleIcon color="secondary" />}
            />
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={activeTab} index={1}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">Rules Engine Configuration</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<PlayIcon />}
              variant="outlined"
              onClick={() => runService('rulesEngine')}
              disabled={loading}
            >
              Run Rules Now
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => openRuleDialog()}>
              Add Rule
            </Button>
          </Box>
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

                  <Typography variant="subtitle2" gutterBottom>
                    Conditions:
                  </Typography>
                  <List dense>
                    {rule.conditions.map((condition, index) => (
                      <ListItem key={index}>
                        <ListItemText
                          primary={`${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}`}
                          secondary={condition.logicalOperator}
                        />
                      </ListItem>
                    ))}
                  </List>

                  <Typography variant="subtitle2" gutterBottom>
                    Actions:
                  </Typography>
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
                    <Button size="small" startIcon={<EditIcon />} onClick={() => openRuleDialog(rule)}>
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

      <TabPanel value={activeTab} index={2}>
        <Typography variant="h5" gutterBottom>
          Daily Summary Configuration
        </Typography>

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
                        const newConfig = {
                          ...summaryConfig,
                          includeWeekends: e.target.checked,
                        };
                        setSummaryConfig(newConfig);
                        dailySummaryScheduler.updateConfig({ includeWeekends: e.target.checked });
                      }}
                    />
                  }
                  label="Include Weekends"
                />
              </Grid>

              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Email recipients (comma-separated)"
                  value={(summaryConfig.recipients || []).join(', ')}
                  onChange={(e) => {
                    const recipients = e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean);
                    const newConfig = { ...summaryConfig, recipients };
                    setSummaryConfig(newConfig);
                    dailySummaryScheduler.updateConfig({ recipients });
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Delivery channels</InputLabel>
                  <Select
                    multiple
                    label="Delivery channels"
                    value={summaryConfig.channels}
                    onChange={(e) => {
                      const channels = e.target.value as SchedulerConfig['channels'];
                      const newConfig = { ...summaryConfig, channels };
                      setSummaryConfig(newConfig);
                      dailySummaryScheduler.updateConfig({ channels });
                    }}
                    renderValue={(selected) => (selected as string[]).join(', ')}
                  >
                    {(['console', 'teams', 'email'] as const).map((ch) => (
                      <MenuItem key={ch} value={ch}>
                        {ch}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Button
                  variant="contained"
                  onClick={async () => {
                    try {
                      setLoading(true);
                      await runService('dailySummary');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                >
                  Generate Summary Now
                </Button>
                <Button sx={{ ml: 1 }} onClick={() => setSummaryDialogOpen(true)}>
                  Open Config Dialog
                </Button>
              </Grid>
            </Grid>
          </Paper>
        )}
      </TabPanel>

      <TabPanel value={activeTab} index={3}>
        <Typography variant="h5" gutterBottom>
          Git/PR Monitoring
        </Typography>

        <Paper sx={{ p: 3 }}>
          <Typography variant="body1" paragraph>
            Tracks work items that have linked pull requests by scanning work item links and
            attachments for PR references.
          </Typography>

          {gitStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {gitStats.totalWorkItemsWithPRs}
                  </Typography>
                  <Typography variant="caption">Work Items with PRs</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="info.main">
                    {gitStats.totalPRs}
                  </Typography>
                  <Typography variant="caption">Total PRs</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    {gitStats.activePRs}
                  </Typography>
                  <Typography variant="caption">Active PRs</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {gitStats.completedPRs}
                  </Typography>
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

      <TabPanel value={activeTab} index={4}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h5">Alerts & Notifications</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              startIcon={<PlayIcon />}
              variant="outlined"
              onClick={() => runService('alerting')}
              disabled={loading}
            >
              Check Alerts Now
            </Button>
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => openAlertDialog()}>
              Add Alert Rule
            </Button>
          </Box>
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
                    const checkInterval = parseInt(e.target.value) || 15;
                    const newConfig = { ...alertingConfig, checkInterval };
                    setAlertingConfig(newConfig);
                    notificationAlertingSystem.updateConfig({ checkInterval });
                    automationOrchestrator.updateConfig({
                      intervalsMinutes: {
                        ...automationOrchestrator.getConfig().intervalsMinutes,
                        alerting: checkInterval,
                      },
                    });
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
                    const maxAlertsPerHour = parseInt(e.target.value) || 10;
                    const newConfig = { ...alertingConfig, maxAlertsPerHour };
                    setAlertingConfig(newConfig);
                    notificationAlertingSystem.updateConfig({ maxAlertsPerHour });
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
                        rule.severity === 'critical'
                          ? 'error'
                          : rule.severity === 'high'
                            ? 'warning'
                            : rule.severity === 'medium'
                              ? 'primary'
                              : 'default'
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
                    Type: {rule.type} | Throttle: {rule.throttleMinutes} minutes | Channels:{' '}
                    {rule.notificationChannels.join(', ')}
                  </Typography>
                  <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => openAlertDialog(rule)}
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
                        notificationAlertingSystem.updateAlertRule(rule.id, {
                          enabled: !rule.enabled,
                        });
                        loadServiceStates();
                        showMessage(
                          'success',
                          `Alert rule ${rule.enabled ? 'disabled' : 'enabled'}`
                        );
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

      <TabPanel value={activeTab} index={5}>
        <Typography variant="h5" gutterBottom>
          Sentiment Analysis
        </Typography>
        <Paper sx={{ p: 3 }}>
          {sentimentStats && (
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {sentimentStats.totalEntries}
                  </Typography>
                  <Typography variant="caption">Total Entries</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {sentimentStats.validEntries}
                  </Typography>
                  <Typography variant="caption">Valid Entries</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center">
                  <Typography variant="h4" color="warning.main">
                    {sentimentStats.staleEntries}
                  </Typography>
                  <Typography variant="caption">Stale Entries</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box textAlign="center" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={() => runService('sentiment')}
                    disabled={loading}
                  >
                    Refresh Now
                  </Button>
                  <Button
                    variant="outlined"
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
            </Grid>
          )}
        </Paper>
      </TabPanel>

      <TabPanel value={activeTab} index={6}>
        <Typography variant="h5" gutterBottom>
          Execution Log
        </Typography>
        <Paper sx={{ p: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Service</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Summary</TableCell>
                <TableCell>Dry-run</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {executionLog.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" color="text.secondary">
                      No executions yet. Enable the platform or use Run Now.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {executionLog.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>{new Date(entry.finishedAt).toLocaleString()}</TableCell>
                  <TableCell>{entry.serviceId}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={entry.status}
                      color={
                        entry.status === 'success'
                          ? 'success'
                          : entry.status === 'error'
                            ? 'error'
                            : 'default'
                      }
                    />
                  </TableCell>
                  <TableCell>{entry.summary}</TableCell>
                  <TableCell>{entry.dryRun ? 'yes' : 'no'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      </TabPanel>

      {/* Summary config dialog */}
      <Dialog open={summaryDialogOpen} onClose={() => setSummaryDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Daily Summary Configuration</DialogTitle>
        <DialogContent>
          {summaryConfig && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                label="Daily Time (HH:MM)"
                value={summaryConfig.dailyTime}
                onChange={(e) => {
                  const dailyTime = e.target.value;
                  setSummaryConfig({ ...summaryConfig, dailyTime });
                  dailySummaryScheduler.updateConfig({ dailyTime });
                }}
              />
              <TextField
                label="Timezone"
                value={summaryConfig.timezone}
                onChange={(e) => {
                  const timezone = e.target.value;
                  setSummaryConfig({ ...summaryConfig, timezone });
                  dailySummaryScheduler.updateConfig({ timezone });
                }}
              />
              <TextField
                label="Recipients (comma-separated)"
                value={(summaryConfig.recipients || []).join(', ')}
                onChange={(e) => {
                  const recipients = e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setSummaryConfig({ ...summaryConfig, recipients });
                  dailySummaryScheduler.updateConfig({ recipients });
                }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={summaryConfig.includeWeekends}
                    onChange={(e) => {
                      setSummaryConfig({ ...summaryConfig, includeWeekends: e.target.checked });
                      dailySummaryScheduler.updateConfig({ includeWeekends: e.target.checked });
                    }}
                  />
                }
                label="Include weekends"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSummaryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Alerting config dialog */}
      <Dialog open={alertingDialogOpen} onClose={() => setAlertingDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Alerting Configuration</DialogTitle>
        <DialogContent>
          {alertingConfig && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              <TextField
                type="number"
                label="Check interval (minutes)"
                value={alertingConfig.checkInterval}
                onChange={(e) => {
                  const checkInterval = parseInt(e.target.value) || 15;
                  setAlertingConfig({ ...alertingConfig, checkInterval });
                  notificationAlertingSystem.updateConfig({ checkInterval });
                }}
              />
              <TextField
                type="number"
                label="Max alerts per hour"
                value={alertingConfig.maxAlertsPerHour}
                onChange={(e) => {
                  const maxAlertsPerHour = parseInt(e.target.value) || 10;
                  setAlertingConfig({ ...alertingConfig, maxAlertsPerHour });
                  notificationAlertingSystem.updateConfig({ maxAlertsPerHour });
                }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={alertingConfig.autoResolveStaleAlerts}
                    onChange={(e) => {
                      setAlertingConfig({
                        ...alertingConfig,
                        autoResolveStaleAlerts: e.target.checked,
                      });
                      notificationAlertingSystem.updateConfig({
                        autoResolveStaleAlerts: e.target.checked,
                      });
                    }}
                  />
                }
                label="Auto-resolve stale alerts"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertingDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Rule editor dialog */}
      <Dialog open={ruleDialogOpen} onClose={() => setRuleDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{editingRule ? 'Edit Rule' : 'Add Rule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={draftRule.name || ''}
              onChange={(e) => setDraftRule({ ...draftRule, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={draftRule.description || ''}
              onChange={(e) => setDraftRule({ ...draftRule, description: e.target.value })}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Priority"
              type="number"
              value={draftRule.priority ?? 5}
              onChange={(e) =>
                setDraftRule({ ...draftRule, priority: parseInt(e.target.value) || 5 })
              }
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draftRule.enabled !== false}
                  onChange={(e) => setDraftRule({ ...draftRule, enabled: e.target.checked })}
                />
              }
              label="Enabled"
            />

            <Divider />
            <Typography variant="subtitle1">Conditions</Typography>
            {(draftRule.conditions || []).map((condition, index) => (
              <Grid container spacing={1} key={index} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Field</InputLabel>
                    <Select
                      label="Field"
                      value={condition.field}
                      onChange={(e) => {
                        const conditions = [...(draftRule.conditions || [])];
                        conditions[index] = { ...condition, field: e.target.value };
                        setDraftRule({ ...draftRule, conditions });
                      }}
                    >
                      {FIELD_OPTIONS.map((f) => (
                        <MenuItem key={f} value={f}>
                          {f}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Operator</InputLabel>
                    <Select
                      label="Operator"
                      value={condition.operator}
                      onChange={(e) => {
                        const conditions = [...(draftRule.conditions || [])];
                        conditions[index] = {
                          ...condition,
                          operator: e.target.value as RuleCondition['operator'],
                        };
                        setDraftRule({ ...draftRule, conditions });
                      }}
                    >
                      {OPERATOR_OPTIONS.map((op) => (
                        <MenuItem key={op} value={op}>
                          {op}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Value"
                    value={
                      Array.isArray(condition.value)
                        ? condition.value.join(', ')
                        : condition.value ?? ''
                    }
                    onChange={(e) => {
                      const raw = e.target.value;
                      let value: any = raw;
                      if (condition.operator === 'in' || condition.operator === 'not_in') {
                        value = raw.split(',').map((s) => s.trim()).filter(Boolean);
                      } else if (condition.operator === 'days_since' || condition.operator === 'greater_than' || condition.operator === 'less_than') {
                        value = Number(raw);
                      }
                      const conditions = [...(draftRule.conditions || [])];
                      conditions[index] = { ...condition, value };
                      setDraftRule({ ...draftRule, conditions });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={2}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Logic</InputLabel>
                    <Select
                      label="Logic"
                      value={condition.logicalOperator || 'AND'}
                      onChange={(e) => {
                        const conditions = [...(draftRule.conditions || [])];
                        conditions[index] = {
                          ...condition,
                          logicalOperator: e.target.value as 'AND' | 'OR',
                        };
                        setDraftRule({ ...draftRule, conditions });
                      }}
                    >
                      <MenuItem value="AND">AND</MenuItem>
                      <MenuItem value="OR">OR</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={1}>
                  <Button
                    color="error"
                    onClick={() => {
                      const conditions = (draftRule.conditions || []).filter((_, i) => i !== index);
                      setDraftRule({ ...draftRule, conditions });
                    }}
                  >
                    X
                  </Button>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<AddIcon />} onClick={() =>
              setDraftRule({
                ...draftRule,
                conditions: [...(draftRule.conditions || []), emptyCondition()],
              })
            }>
              Add Condition
            </Button>

            <Divider />
            <Typography variant="subtitle1">Actions</Typography>
            {(draftRule.actions || []).map((action, index) => (
              <Grid container spacing={1} key={index} alignItems="center">
                <Grid item xs={12} sm={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Type</InputLabel>
                    <Select
                      label="Type"
                      value={action.type}
                      onChange={(e) => {
                        const actions = [...(draftRule.actions || [])];
                        const type = e.target.value as RuleAction['type'];
                        let parameters: Record<string, any> = {};
                        if (type === 'update_status') parameters = { status: 'New' };
                        if (type === 'add_comment')
                          parameters = { comment: 'Automated comment', useAI: false };
                        if (type === 'add_tag') parameters = { tag: 'needs-update' };
                        if (type === 'assign_user') parameters = { userId: '' };
                        if (type === 'update_field') parameters = { field: 'state', value: '' };
                        if (type === 'send_notification')
                          parameters = { message: 'Rules engine notification' };
                        actions[index] = { type, parameters };
                        setDraftRule({ ...draftRule, actions });
                      }}
                    >
                      {ACTION_TYPES.map((t) => (
                        <MenuItem key={t} value={t}>
                          {t}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField
                    size="small"
                    fullWidth
                    label="Parameters (JSON)"
                    value={JSON.stringify(action.parameters)}
                    onChange={(e) => {
                      try {
                        const parameters = JSON.parse(e.target.value);
                        const actions = [...(draftRule.actions || [])];
                        actions[index] = { ...action, parameters };
                        setDraftRule({ ...draftRule, actions });
                      } catch {
                        /* ignore invalid JSON while typing */
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={1}>
                  <Button
                    color="error"
                    onClick={() => {
                      const actions = (draftRule.actions || []).filter((_, i) => i !== index);
                      setDraftRule({ ...draftRule, actions });
                    }}
                  >
                    X
                  </Button>
                </Grid>
              </Grid>
            ))}
            <Button
              startIcon={<AddIcon />}
              onClick={() =>
                setDraftRule({
                  ...draftRule,
                  actions: [...(draftRule.actions || []), emptyAction()],
                })
              }
            >
              Add Action
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRuleDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveRuleDialog}>
            Save Rule
          </Button>
        </DialogActions>
      </Dialog>

      {/* Alert rule editor dialog */}
      <Dialog open={alertDialogOpen} onClose={() => setAlertDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editingAlertRule ? 'Edit Alert Rule' : 'Add Alert Rule'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Name"
              value={draftAlertRule.name || ''}
              onChange={(e) => setDraftAlertRule({ ...draftAlertRule, name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Description"
              value={draftAlertRule.description || ''}
              onChange={(e) =>
                setDraftAlertRule({ ...draftAlertRule, description: e.target.value })
              }
              fullWidth
              multiline
              minRows={2}
            />
            <FormControl fullWidth>
              <InputLabel>Type</InputLabel>
              <Select
                label="Type"
                value={draftAlertRule.type || 'stale_work_item'}
                onChange={(e) =>
                  setDraftAlertRule({ ...draftAlertRule, type: e.target.value as AlertType })
                }
              >
                {ALERT_TYPES.map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Severity</InputLabel>
              <Select
                label="Severity"
                value={draftAlertRule.severity || 'medium'}
                onChange={(e) =>
                  setDraftAlertRule({
                    ...draftAlertRule,
                    severity: e.target.value as AlertSeverity,
                  })
                }
              >
                {SEVERITIES.map((s) => (
                  <MenuItem key={s} value={s}>
                    {s}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              type="number"
              label="Throttle (minutes)"
              value={draftAlertRule.throttleMinutes ?? 240}
              onChange={(e) =>
                setDraftAlertRule({
                  ...draftAlertRule,
                  throttleMinutes: parseInt(e.target.value) || 60,
                })
              }
            />
            <FormControl fullWidth>
              <InputLabel>Channels</InputLabel>
              <Select
                multiple
                label="Channels"
                value={draftAlertRule.notificationChannels || ['console']}
                onChange={(e) =>
                  setDraftAlertRule({
                    ...draftAlertRule,
                    notificationChannels: e.target.value as NotificationChannel[],
                  })
                }
                renderValue={(selected) => (selected as string[]).join(', ')}
              >
                {CHANNELS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Recipients (comma-separated emails)"
              value={(draftAlertRule.recipients || []).join(', ')}
              onChange={(e) =>
                setDraftAlertRule({
                  ...draftAlertRule,
                  recipients: e.target.value
                    .split(',')
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
            <TextField
              label="Custom message (optional)"
              value={draftAlertRule.customMessage || ''}
              onChange={(e) =>
                setDraftAlertRule({ ...draftAlertRule, customMessage: e.target.value })
              }
              fullWidth
              multiline
              minRows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={draftAlertRule.enabled !== false}
                  onChange={(e) =>
                    setDraftAlertRule({ ...draftAlertRule, enabled: e.target.checked })
                  }
                />
              }
              label="Enabled"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveAlertDialog}>
            Save Alert Rule
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AutomationSettingsPanel;
