import React, { useState, useEffect } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  Paper,
  Typography,
  Button,
  Grid
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import ClearIcon from '@mui/icons-material/Clear';
import adoService, { Sprint } from '../../services/adoService';

export interface FilterOptions {
  sprints: string[];
  users: string[];
}

export interface FilterState {
  selectedSprints: string[];
  selectedUsers: string[];
}

interface FilterComponentProps {
  onFilterChange: (filters: FilterState) => void;
  initialFilters?: FilterState;
  showUserFilter?: boolean;
  showSprintFilter?: boolean;
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const FilterComponent: React.FC<FilterComponentProps> = ({
  onFilterChange,
  initialFilters = { selectedSprints: [], selectedUsers: [] },
  showUserFilter = true,
  showSprintFilter = true
}) => {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [users, setUsers] = useState<string[]>([]);
  const [selectedSprints, setSelectedSprints] = useState<string[]>(initialFilters.selectedSprints);
  const [selectedUsers, setSelectedUsers] = useState<string[]>(initialFilters.selectedUsers);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Load sprints
        if (showSprintFilter) {
          const sprintList = await adoService.getSprints();
          setSprints(sprintList || []);
        }

        // Load users from work items
        if (showUserFilter) {
          const currentSprint = await adoService.getCurrentSprint();
          if (currentSprint) {
            const workItems = await adoService.getSprintWorkItems(currentSprint.id);
            const uniqueUsers = Array.from(new Set(
              workItems
                .map(item => item.assignedTo)
                .filter(user => user && user.trim() !== '')
                .map(user => user!.split('<')[0].trim()) // Extract name from "Name <email>" format
            )).sort();
            setUsers(uniqueUsers);
          }
        }
      } catch (error) {
        console.error('Error loading filter options:', error);
        // Keep empty lists on failure — no dummy users
        if (showUserFilter) {
          setUsers([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [showSprintFilter, showUserFilter]); // Remove users.length dependency to avoid infinite loops

  // Method to refresh filters (can be called externally)
  const refreshFilters = async () => {
    setIsLoading(true);
    try {
      // Load sprints
      if (showSprintFilter) {
        const sprintList = await adoService.getSprints();
        setSprints(sprintList || []);
      }

      // Load users from work items
      if (showUserFilter) {
        const currentSprint = await adoService.getCurrentSprint();
        if (currentSprint) {
          const workItems = await adoService.getSprintWorkItems(currentSprint.id);
          const uniqueUsers = Array.from(new Set(
            workItems
              .map(item => item.assignedTo)
              .filter(user => user && user.trim() !== '')
              .map(user => user!.split('<')[0].trim()) // Extract name from "Name <email>" format
          )).sort();
          setUsers(uniqueUsers);
        }
      }
    } catch (error) {
      console.error('Error loading filter options:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSprintChange = (event: SelectChangeEvent<typeof selectedSprints>) => {
    const value = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
    setSelectedSprints(value);
    onFilterChange({ selectedSprints: value, selectedUsers });
  };

  const handleUserChange = (event: SelectChangeEvent<typeof selectedUsers>) => {
    const value = typeof event.target.value === 'string' ? event.target.value.split(',') : event.target.value;
    setSelectedUsers(value);
    onFilterChange({ selectedSprints, selectedUsers: value });
  };

  const clearAllFilters = () => {
    setSelectedSprints([]);
    setSelectedUsers([]);
    onFilterChange({ selectedSprints: [], selectedUsers: [] });
  };

  const hasActiveFilters = selectedSprints.length > 0 || selectedUsers.length > 0;

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <FilterListIcon sx={{ mr: 1 }} />
        <Typography variant="h6">Filters</Typography>
        {hasActiveFilters && (
          <Button
            startIcon={<ClearIcon />}
            onClick={clearAllFilters}
            size="small"
            sx={{ ml: 'auto' }}
          >
            Clear All
          </Button>
        )}
      </Box>

      <Grid container spacing={2}>
        {showSprintFilter && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="sprint-filter-label">Filter by Sprint</InputLabel>
              <Select
                labelId="sprint-filter-label"
                multiple
                value={selectedSprints}
                onChange={handleSprintChange}
                input={<OutlinedInput label="Filter by Sprint" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => {
                      const sprint = sprints.find(s => s.id.toString() === value);
                      return (
                        <Chip 
                          key={value} 
                          label={sprint?.name || value} 
                          size="small" 
                        />
                      );
                    })}
                  </Box>
                )}
                MenuProps={MenuProps}
                disabled={isLoading}
              >
                {sprints.map((sprint) => (
                  <MenuItem key={sprint.id} value={sprint.id.toString()}>
                    {sprint.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}

        {showUserFilter && (
          <Grid item xs={12} sm={6}>
            <FormControl fullWidth>
              <InputLabel id="user-filter-label">Filter by User</InputLabel>
              <Select
                labelId="user-filter-label"
                multiple
                value={selectedUsers}
                onChange={handleUserChange}
                input={<OutlinedInput label="Filter by User" />}
                renderValue={(selected) => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map((value) => (
                      <Chip key={value} label={value} size="small" />
                    ))}
                  </Box>
                )}
                MenuProps={MenuProps}
                disabled={isLoading}
              >
                {users.map((user) => (
                  <MenuItem key={user} value={user}>
                    {user}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        )}
      </Grid>

      {hasActiveFilters && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Active filters: {selectedSprints.length + selectedUsers.length} selected
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default FilterComponent;
