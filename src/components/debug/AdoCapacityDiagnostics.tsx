import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  CircularProgress,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugIcon
} from '@mui/icons-material';
import adoService from '../../services/adoService';

interface DiagnosticResult {
  canAccessProject: boolean;
  canAccessSprints: boolean;
  canAccessCapacity: boolean;
  hasValidConfig: boolean;
  errors: string[];
  teamName?: string;
  effectiveTeamName?: string;
  organization?: string;
  project?: string;
}

const AdoCapacityDiagnostics: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult | null>(null);
  const [currentSprint, setCurrentSprint] = useState<any>(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults(null);

    try {
      // Get current sprint for testing
      const sprint = await adoService.getCurrentSprint();
      setCurrentSprint(sprint);

      // Run connection test
      const testResults = await adoService.testAdoConnection(sprint?.id);
      
      // Get current configuration
      const config = localStorage.getItem('adoConfig');
      let parsedConfig = null;
      if (config) {
        parsedConfig = JSON.parse(config);
      }

      const diagnosticResults: DiagnosticResult = {
        ...testResults,
        teamName: parsedConfig?.teamName,
        effectiveTeamName: parsedConfig?.teamName || parsedConfig?.project,
        organization: parsedConfig?.organization,
        project: parsedConfig?.project
      };

      setResults(diagnosticResults);
    } catch (error) {
      console.error('Error running diagnostics:', error);
      setResults({
        canAccessProject: false,
        canAccessSprints: false,
        canAccessCapacity: false,
        hasValidConfig: false,
        errors: [`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      });
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (status: boolean) => {
    return status ? (
      <CheckIcon sx={{ color: 'success.main' }} />
    ) : (
      <ErrorIcon sx={{ color: 'error.main' }} />
    );
  };

  const getSeverityForErrors = (hasErrors: boolean) => {
    return hasErrors ? 'error' : 'success';
  };

  return (
    <Card>
      <CardContent>
        <Box display="flex" alignItems="center" mb={2}>
          <BugIcon sx={{ mr: 1 }} />
          <Typography variant="h6">
            Azure DevOps Capacity Diagnostics
          </Typography>
        </Box>
        
        <Typography variant="body2" color="textSecondary" paragraph>
          This tool diagnoses issues with Azure DevOps capacity data access. 
          Run the diagnostic to identify configuration problems or permission issues.
        </Typography>

        <Button
          variant="contained"
          onClick={runDiagnostics}
          disabled={isRunning}
          startIcon={isRunning ? <CircularProgress size={20} /> : <BugIcon />}
          sx={{ mb: 3 }}
        >
          {isRunning ? 'Running Diagnostics...' : 'Run Diagnostics'}
        </Button>

        {results && (
          <Box>
            <Alert 
              severity={getSeverityForErrors(results.errors.length > 0)} 
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2">
                Diagnostic Summary
              </Typography>
              <Typography variant="body2">
                {results.errors.length === 0 
                  ? '✅ All tests passed! Azure DevOps is properly configured.' 
                  : `❌ Found ${results.errors.length} issue(s) that need to be resolved.`
                }
              </Typography>
            </Alert>

            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">Configuration Status</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(results.hasValidConfig)}
                    </ListItemIcon>
                    <ListItemText
                      primary="Configuration Valid"
                      secondary={results.hasValidConfig ? 'ADO configuration is loaded' : 'No valid ADO configuration found'}
                    />
                  </ListItem>
                  
                  {results.organization && (
                    <ListItem>
                      <ListItemText
                        primary="Organization"
                        secondary={results.organization}
                        sx={{ pl: 4 }}
                      />
                    </ListItem>
                  )}
                  
                  {results.project && (
                    <ListItem>
                      <ListItemText
                        primary="Project"
                        secondary={results.project}
                        sx={{ pl: 4 }}
                      />
                    </ListItem>
                  )}
                  
                  <ListItem>
                    <ListItemText
                      primary="Team Name"
                      secondary={results.teamName || 'Not configured (using project name as fallback)'}
                      sx={{ pl: 4 }}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemText
                      primary="Effective Team Name"
                      secondary={results.effectiveTeamName || 'Unknown'}
                      sx={{ pl: 4 }}
                    />
                  </ListItem>
                </List>
              </AccordionDetails>
            </Accordion>

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle1">API Access Tests</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(results.canAccessProject)}
                    </ListItemIcon>
                    <ListItemText
                      primary="Project Access"
                      secondary={results.canAccessProject ? 'Can access Azure DevOps project' : 'Cannot access project - check PAT and permissions'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(results.canAccessSprints)}
                    </ListItemIcon>
                    <ListItemText
                      primary="Sprint Access"
                      secondary={results.canAccessSprints ? 'Can access sprint data' : 'Cannot access sprints - check team name and permissions'}
                    />
                  </ListItem>
                  
                  <ListItem>
                    <ListItemIcon>
                      {getStatusIcon(results.canAccessCapacity)}
                    </ListItemIcon>
                    <ListItemText
                      primary="Capacity Access"
                      secondary={results.canAccessCapacity ? 'Can access capacity data' : 'Cannot access capacity data - this is the main issue'}
                    />
                  </ListItem>
                </List>
              </AccordionDetails>
            </Accordion>

            {currentSprint && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1">Current Sprint</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">
                    <strong>Name:</strong> {currentSprint.name}<br />
                    <strong>ID:</strong> {currentSprint.id}<br />
                    <strong>State:</strong> {currentSprint.state}<br />
                    <strong>Start:</strong> {new Date(currentSprint.startDate).toLocaleDateString()}<br />
                    <strong>End:</strong> {new Date(currentSprint.endDate).toLocaleDateString()}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            )}

            {results.errors.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle1" color="error">
                    Errors ({results.errors.length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {results.errors.map((error, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <ErrorIcon color="error" />
                        </ListItemIcon>
                        <ListItemText
                          primary={error}
                          sx={{ wordBreak: 'break-word' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            <Divider sx={{ my: 2 }} />
            
            <Alert severity="info">
              <Typography variant="subtitle2">Common Solutions:</Typography>
              <List dense sx={{ mt: 1 }}>
                <ListItem sx={{ py: 0 }}>
                  <Typography variant="body2">
                    • Ensure your PAT token has "Work Items (Read)" permissions
                  </Typography>
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <Typography variant="body2">
                    • Verify the team name matches exactly in Azure DevOps
                  </Typography>
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <Typography variant="body2">
                    • Check if capacity is set up for team members in Azure DevOps
                  </Typography>
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <Typography variant="body2">
                    • Ensure the server environment variable REACT_APP_ADO_PAT is set
                  </Typography>
                </ListItem>
                <ListItem sx={{ py: 0 }}>
                  <Typography variant="body2">
                    • Project names with spaces are automatically URL-encoded
                  </Typography>
                </ListItem>
              </List>
            </Alert>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default AdoCapacityDiagnostics;
