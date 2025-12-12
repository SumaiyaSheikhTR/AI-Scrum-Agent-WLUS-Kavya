import React from 'react';
import { Box, Typography, Paper } from '@mui/material';
import GitPRMonitoringPanel from '../../components/dashboard/GitPRMonitoringPanel';

const GitPRPage: React.FC = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Git & Pull Request Monitoring
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Monitor pull requests, commits, and Git activity across your Azure DevOps repositories. 
        Track code reviews, work item links, and automated workflow actions.
      </Typography>
      
      <Paper sx={{ p: 3, mt: 3 }}>
        <GitPRMonitoringPanel />
      </Paper>
    </Box>
  );
};

export default GitPRPage;
