import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';

interface CollapsibleSectionProps {
  title: string;
  color: string;
  backgroundColor: string;
  isExpanded: boolean;
  toggleExpanded: () => void;
  children: React.ReactNode;
  hoverBackgroundColor?: string;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  color,
  backgroundColor,
  isExpanded,
  toggleExpanded,
  children,
  hoverBackgroundColor
}) => {
  return (
    <Paper elevation={1} sx={{ mb: 2, overflow: 'hidden', borderRadius: 2 }}>
      <Box 
        onClick={toggleExpanded} 
        sx={{ 
          p: 2, 
          background: backgroundColor, 
          display: 'flex', 
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          '&:hover': { background: hoverBackgroundColor || backgroundColor }
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 600, color }}>
          {title}
        </Typography>
        <Button 
          size="small" 
          variant="text" 
          sx={{ color }}
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </Box>
      
      {isExpanded && (
        <Box sx={{ p: 2 }}>
          {children}
        </Box>
      )}
    </Paper>
  );
};

export default CollapsibleSection;
