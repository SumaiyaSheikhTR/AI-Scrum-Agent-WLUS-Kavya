import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Alert,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import {
  Settings as SettingsIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Close as CloseIcon
} from '@mui/icons-material';

interface TeamMemberCapacity {
  name: string;
  dailyCapacity: number;
}

interface TeamCapacityConfigFormProps {
  open: boolean;
  onClose: () => void;
  onSave?: (capacities: Record<string, number>) => void;
}

const TeamCapacityConfigForm: React.FC<TeamCapacityConfigFormProps> = ({ 
  open, 
  onClose, 
  onSave 
}) => {
  const [teamMembers, setTeamMembers] = useState<TeamMemberCapacity[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberCapacity, setNewMemberCapacity] = useState(6);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Load existing configuration on component mount
  useEffect(() => {
    if (open) {
      loadExistingConfig();
    }
  }, [open]);

  const loadExistingConfig = () => {
    try {
      const storedConfig = localStorage.getItem('teamCapacityConfig');
      if (storedConfig) {
        const config = JSON.parse(storedConfig);
        const members = Object.entries(config).map(([name, capacity]) => ({
          name,
          dailyCapacity: capacity as number
        }));
        setTeamMembers(members);
      }
    } catch (error) {
      console.error('Failed to load team capacity config:', error);
    }
  };

  const addTeamMember = () => {
    if (!newMemberName.trim()) {
      setErrorMessage('Please enter a team member name');
      return;
    }

    if (teamMembers.some(member => member.name === newMemberName.trim())) {
      setErrorMessage('Team member already exists');
      return;
    }

    if (newMemberCapacity < 1 || newMemberCapacity > 12) {
      setErrorMessage('Daily capacity must be between 1 and 12 hours');
      return;
    }

    setTeamMembers([...teamMembers, {
      name: newMemberName.trim(),
      dailyCapacity: newMemberCapacity
    }]);

    setNewMemberName('');
    setNewMemberCapacity(6);
    setErrorMessage('');
  };

  const removeTeamMember = (index: number) => {
    setTeamMembers(teamMembers.filter((_, i) => i !== index));
  };

  const updateMemberCapacity = (index: number, capacity: number) => {
    if (capacity < 1 || capacity > 12) return;
    
    const updated = [...teamMembers];
    updated[index].dailyCapacity = capacity;
    setTeamMembers(updated);
  };

  const saveConfiguration = () => {
    try {
      const config = teamMembers.reduce((acc, member) => {
        acc[member.name] = member.dailyCapacity;
        return acc;
      }, {} as Record<string, number>);

      localStorage.setItem('teamCapacityConfig', JSON.stringify(config));
      
      if (onSave) {
        onSave(config);
      }

      setSuccessMessage('Team capacity configuration saved successfully!');
      setErrorMessage('');
      
      // Auto-close after 2 seconds
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 2000);
    } catch (error) {
      setErrorMessage('Failed to save configuration');
      console.error('Error saving team capacity config:', error);
    }
  };

  const clearConfiguration = () => {
    localStorage.removeItem('teamCapacityConfig');
    setTeamMembers([]);
    setSuccessMessage('Configuration cleared');
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 3 }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SettingsIcon sx={{ mr: 2, color: '#2c3e50' }} />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Team Capacity Configuration
            </Typography>
          </Box>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="info" sx={{ mb: 3 }}>
          Configure individual team member daily capacities. This is used as a fallback when Azure DevOps capacity data is not available.
        </Alert>

        {successMessage && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {successMessage}
          </Alert>
        )}

        {errorMessage && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {/* Add New Member */}
        <Card sx={{ mb: 3, backgroundColor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Add Team Member
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={5}>
                <TextField
                  fullWidth
                  label="Team Member Name"
                  value={newMemberName}
                  onChange={(e) => setNewMemberName(e.target.value)}
                  placeholder="e.g., John Doe"
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="number"
                  label="Daily Capacity (hours)"
                  value={newMemberCapacity}
                  onChange={(e) => setNewMemberCapacity(Number(e.target.value))}
                  inputProps={{ min: 1, max: 12, step: 0.5 }}
                  size="small"
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={addTeamMember}
                  sx={{
                    background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
                    fontWeight: 600
                  }}
                >
                  Add
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Existing Team Members */}
        {teamMembers.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Current Team Configuration ({teamMembers.length} members)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              
              {teamMembers.map((member, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={5}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>
                          {member.name}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        type="number"
                        label="Hours/Day"
                        value={member.dailyCapacity}
                        onChange={(e) => updateMemberCapacity(index, Number(e.target.value))}
                        inputProps={{ min: 1, max: 12, step: 0.5 }}
                        size="small"
                        fullWidth
                      />
                    </Grid>
                    <Grid item xs={12} md={2}>
                      <Chip 
                        label={`${member.dailyCapacity}h/day`}
                        color="primary"
                        size="small"
                        sx={{ fontWeight: 600 }}
                      />
                    </Grid>
                    <Grid item xs={12} md={1}>
                      <IconButton
                        color="error"
                        onClick={() => removeTeamMember(index)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Grid>
                  </Grid>
                  {index < teamMembers.length - 1 && <Divider sx={{ mt: 1 }} />}
                </Box>
              ))}
            </CardContent>
          </Card>
        )}
      </DialogContent>

      <DialogActions sx={{ p: 3 }}>
        <Button
          variant="outlined"
          onClick={clearConfiguration}
          disabled={teamMembers.length === 0}
          sx={{ mr: 1 }}
        >
          Clear All
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={saveConfiguration}
          disabled={teamMembers.length === 0}
          sx={{
            background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
            fontWeight: 600
          }}
        >
          Save Configuration
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TeamCapacityConfigForm;
