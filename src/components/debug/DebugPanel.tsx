import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import improvedOpenAIService from '../../services/improvedOpenAiService';
import adoService from '../../services/adoService';

const DebugPanel: React.FC = () => {
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [isTestingADO, setIsTestingADO] = useState(false);
  const [aiResult, setAiResult] = useState<string>('');
  const [adoResult, setAdoResult] = useState<string>('');
  const [testWorkItemId, setTestWorkItemId] = useState<string>('');
  const [testEffort, setTestEffort] = useState<string>('5');

  const testAIService = async () => {
    setIsTestingAI(true);
    setAiResult('');
    
    try {
      console.log('=== AI SERVICE DIAGNOSTIC ===');
      
      // Check configuration
      const configStatus = improvedOpenAIService.getConfigStatus();
      console.log('Config Status:', configStatus);
      
      // Test basic message
      const response = await improvedOpenAIService.chat('Hello! Can you help me with sprint planning?');
      
      setAiResult(`✅ AI Service Working!\n\nConfig Status: ${JSON.stringify(configStatus, null, 2)}\n\nResponse: ${response}`);
      
    } catch (error: any) {
      console.error('AI Service Test Failed:', error);
      setAiResult(`❌ AI Service Failed!\n\nError: ${error.message}\n\nStack: ${error.stack}`);
    } finally {
      setIsTestingAI(false);
    }
  };

  const testADOService = async () => {
    if (!testWorkItemId) {
      setAdoResult('❌ Please enter a work item ID to test');
      return;
    }

    setIsTestingADO(true);
    setAdoResult('');
    
    try {
      console.log('=== ADO SERVICE DIAGNOSTIC ===');
      
      // Check if ADO is configured
      const isConfigured = adoService.loadConfig();
      console.log('ADO Configured:', isConfigured);
      
      if (!isConfigured) {
        setAdoResult('❌ ADO Service not configured. Please configure in Settings.');
        return;
      }

      // Test fetching work item
      const workItem = await adoService.getWorkItem(parseInt(testWorkItemId));
      console.log('Fetched Work Item:', workItem);
      
      if (!workItem) {
        setAdoResult(`❌ Could not fetch work item ${testWorkItemId}`);
        return;
      }

      // Test updating effort
      const updates = {
        'Microsoft.VSTS.Scheduling.Effort': parseInt(testEffort)
      };
      
      console.log('Attempting to update work item with:', updates);
      const updatedWorkItem = await adoService.updateWorkItem(parseInt(testWorkItemId), updates);
      
      if (updatedWorkItem) {
        setAdoResult(`✅ ADO Service Working!\n\nOriginal Effort: ${workItem.effort}\nNew Effort: ${updatedWorkItem.effort}\n\nUpdate successful!`);
      } else {
        setAdoResult(`❌ Failed to update work item ${testWorkItemId}`);
      }
      
    } catch (error: any) {
      console.error('ADO Service Test Failed:', error);
      setAdoResult(`❌ ADO Service Failed!\n\nError: ${error.message}\n\nResponse: ${error.response?.data ? JSON.stringify(error.response.data, null, 2) : 'No response data'}`);
    } finally {
      setIsTestingADO(false);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" gutterBottom>
        🔧 Debug Panel
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Use this panel to diagnose AI Assistant and Work Item update issues. Check the browser console for detailed logs.
      </Alert>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">🤖 AI Assistant Diagnostic</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <Button 
              variant="contained" 
              onClick={testAIService}
              disabled={isTestingAI}
              sx={{ mb: 2 }}
            >
              {isTestingAI ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Test AI Service
            </Button>
            
            {aiResult && (
              <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {aiResult}
                </Typography>
              </Paper>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">📋 Work Item Update Diagnostic</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            <TextField
              label="Work Item ID"
              value={testWorkItemId}
              onChange={(e) => setTestWorkItemId(e.target.value)}
              type="number"
              fullWidth
              sx={{ mb: 2 }}
              helperText="Enter a valid work item ID from your ADO project"
            />
            
            <TextField
              label="Test Effort Value"
              value={testEffort}
              onChange={(e) => setTestEffort(e.target.value)}
              type="number"
              fullWidth
              sx={{ mb: 2 }}
              helperText="New effort value to test with"
            />
            
            <Button 
              variant="contained" 
              onClick={testADOService}
              disabled={isTestingADO || !testWorkItemId}
              sx={{ mb: 2 }}
            >
              {isTestingADO ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              Test ADO Service
            </Button>
            
            {adoResult && (
              <Paper sx={{ p: 2, backgroundColor: '#f5f5f5' }}>
                <Typography variant="body2" component="pre" sx={{ whiteSpace: 'pre-wrap' }}>
                  {adoResult}
                </Typography>
              </Paper>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default DebugPanel;
