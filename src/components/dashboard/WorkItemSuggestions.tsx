import React from 'react';
import { 
  Box, 
  Card, 
  CardContent, 
  CardActions, 
  Typography, 
  Button, 
  Chip, 
  Grid, 
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CommentIcon from '@mui/icons-material/Comment';
import { WorkItemSuggestion } from '../../services/workItemSuggestionService';

interface WorkItemSuggestionsProps {
  suggestions: WorkItemSuggestion[];
  onSuggestionApplied: (suggestionId: number) => void;
  onSuggestionDismissed: (suggestionId: number) => void;
}

const WorkItemSuggestions: React.FC<WorkItemSuggestionsProps> = ({ 
  suggestions, 
  onSuggestionApplied, 
  onSuggestionDismissed 
}) => {
  // Get icon based on suggestion type
  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'status_update':
        return <CheckCircleIcon />;
      case 'assignment_change':
        return <PersonIcon />;
      case 'effort_update':
        return <AccessTimeIcon />;
      case 'comment_suggestion':
        return <CommentIcon />;
      default:
        return <CheckCircleIcon />;
    }
  };

  // Get color based on suggestion type
  const getSuggestionColor = (type: string) => {
    switch (type) {
      case 'status_update':
        return 'primary';
      case 'assignment_change':
        return 'secondary';
      case 'effort_update':
        return 'warning';
      case 'comment_suggestion':
        return 'info';
      default:
        return 'default';
    }
  };

  // Get action button text based on suggestion type
  const getActionText = (type: string) => {
    switch (type) {
      case 'status_update':
        return 'Update Status';
      case 'assignment_change':
        return 'Reassign';
      case 'effort_update':
        return 'Update Effort';
      case 'comment_suggestion':
        return 'Add Comment';
      default:
        return 'Apply';
    }
  };

  return (
    <Box>
      {suggestions.map((suggestion, index) => (
        <Card key={index} variant="outlined" sx={{ mb: 2 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Chip 
                  icon={getSuggestionIcon(suggestion.type)} 
                  label={suggestion.type.replace('_', ' ')} 
                  color={getSuggestionColor(suggestion.type) as any}
                  size="small"
                  sx={{ mr: 1, textTransform: 'capitalize' }}
                />
                <Typography variant="h6" component="div">
                  {suggestion.title}
                </Typography>
              </Box>
              <Tooltip title="Dismiss">
                <IconButton 
                  size="small" 
                  onClick={() => onSuggestionDismissed(index)}
                  aria-label="dismiss suggestion"
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
            
            <Divider sx={{ my: 1.5 }} />
            
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {suggestion.reason}
            </Typography>
            
            {suggestion.type === 'status_update' && (
              <Grid container spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Grid item>
                  <Chip 
                    label={suggestion.currentState} 
                    size="small" 
                    color="default"
                    variant="outlined"
                  />
                </Grid>
                <Grid item>
                  <Typography variant="body2">→</Typography>
                </Grid>
                <Grid item>
                  <Chip 
                    label={suggestion.suggestedState} 
                    size="small" 
                    color="primary"
                  />
                </Grid>
              </Grid>
            )}
            
            {suggestion.type === 'assignment_change' && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" component="span">
                  Currently assigned to: 
                </Typography>
                <Chip 
                  label={suggestion.assignedTo || 'Unassigned'} 
                  size="small" 
                  sx={{ ml: 1 }}
                  variant="outlined"
                />
                <Typography variant="body2" component="span" sx={{ ml: 1 }}>
                  →
                </Typography>
                <Chip 
                  label={suggestion.suggestedValue} 
                  size="small" 
                  color="secondary"
                  sx={{ ml: 1 }}
                />
              </Box>
            )}
            
            {suggestion.type === 'effort_update' && (
              <Box sx={{ mt: 1 }}>
                <Typography variant="body2" component="span">
                  Suggested effort: 
                </Typography>
                <Chip 
                  label={suggestion.suggestedValue} 
                  size="small" 
                  color="warning"
                  sx={{ ml: 1 }}
                />
              </Box>
            )}
          </CardContent>
          <CardActions>
            <Button 
              size="small" 
              variant="contained" 
              color={getSuggestionColor(suggestion.type) as any}
              onClick={() => onSuggestionApplied(index)}
              startIcon={getSuggestionIcon(suggestion.type)}
            >
              {getActionText(suggestion.type)}
            </Button>
            <Button 
              size="small"
              onClick={() => onSuggestionDismissed(index)}
            >
              Dismiss
            </Button>
          </CardActions>
        </Card>
      ))}
    </Box>
  );
};

export default WorkItemSuggestions;
