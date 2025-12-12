import React, { useState } from 'react';
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Alert,
  Divider,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Info as InfoIcon
} from '@mui/icons-material';

export interface WorkItemCategory {
  id: string;
  name: string;
  description: string;
  color: string;
  tags: string[];
  keywords: string[];
  enabled: boolean;
  isDefault?: boolean;
}

export interface WorkItemCategoriesConfig {
  categories: WorkItemCategory[];
  defaultCategory: string;
}

interface WorkItemCategoriesConfigFormProps {
  onSave?: (config: WorkItemCategoriesConfig) => void;
  initialConfig?: WorkItemCategoriesConfig;
}

const defaultCategories: WorkItemCategory[] = [
  {
    id: 'training',
    name: 'Training',
    description: 'Training and educational work items',
    color: '#6f42c1',
    tags: ['Training', 'CPCC', 'Education'],
    keywords: ['training', 'cpcc', 'education', 'learning'],
    enabled: true,
    isDefault: true
  },
  {
    id: 'delivery',
    name: 'Delivery',
    description: 'Product delivery and feature development',
    color: '#28a745',
    tags: ['Delivery', 'Feature', 'Development'],
    keywords: ['delivery', 'feature', 'development', 'product'],
    enabled: true,
    isDefault: true
  }
];

const WorkItemCategoriesConfigForm: React.FC<WorkItemCategoriesConfigFormProps> = ({
  onSave,
  initialConfig
}) => {
  const [config, setConfig] = useState<WorkItemCategoriesConfig>(() => {
    if (initialConfig) {
      return initialConfig;
    }
    
    // Try to load from localStorage
    const savedConfig = localStorage.getItem('workItemCategoriesConfig');
    if (savedConfig) {
      try {
        return JSON.parse(savedConfig);
      } catch (error) {
        console.error('Error parsing saved config:', error);
      }
    }
    
    // Return default config
    return {
      categories: defaultCategories,
      defaultCategory: 'delivery'
    };
  });

  const [editingCategory, setEditingCategory] = useState<WorkItemCategory | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const handleSaveConfig = () => {
    // Save to localStorage
    localStorage.setItem('workItemCategoriesConfig', JSON.stringify(config));
    
    // Trigger data refresh
    window.dispatchEvent(new Event('ado-data-refresh'));
    
    // Call onSave callback if provided
    if (onSave) {
      onSave(config);
    }
  };

  const handleAddCategory = () => {
    const newCategory: WorkItemCategory = {
      id: `category_${Date.now()}`,
      name: '',
      description: '',
      color: '#2196f3',
      tags: [],
      keywords: [],
      enabled: true
    };
    setEditingCategory(newCategory);
    setIsDialogOpen(true);
  };

  const handleEditCategory = (category: WorkItemCategory) => {
    setEditingCategory({ ...category });
    setIsDialogOpen(true);
  };

  const handleDeleteCategory = (categoryId: string) => {
    const categoryToDelete = config.categories.find(cat => cat.id === categoryId);
    if (categoryToDelete?.isDefault) {
      alert('Cannot delete default categories');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this category?')) {
      setConfig(prev => ({
        ...prev,
        categories: prev.categories.filter(cat => cat.id !== categoryId)
      }));
    }
  };

  const handleSaveCategory = () => {
    if (!editingCategory || !editingCategory.name.trim()) {
      window.alert('Category name is required');
      return;
    }

    const isNew = !config.categories.find(cat => cat.id === editingCategory.id);
    
    if (isNew) {
      setConfig(prev => ({
        ...prev,
        categories: [...prev.categories, editingCategory]
      }));
    } else {
      setConfig(prev => ({
        ...prev,
        categories: prev.categories.map(cat => 
          cat.id === editingCategory.id ? editingCategory : cat
        )
      }));
    }
    
    setIsDialogOpen(false);
    setEditingCategory(null);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCategory(null);
    setNewTag('');
    setNewKeyword('');
  };

  const handleAddTag = () => {
    if (newTag.trim() && editingCategory) {
      setEditingCategory(prev => prev ? {
        ...prev,
        tags: [...prev.tags, newTag.trim()]
      } : null);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    if (editingCategory) {
      setEditingCategory(prev => prev ? {
        ...prev,
        tags: prev.tags.filter(tag => tag !== tagToRemove)
      } : null);
    }
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && editingCategory) {
      setEditingCategory(prev => prev ? {
        ...prev,
        keywords: [...prev.keywords, newKeyword.trim().toLowerCase()]
      } : null);
      setNewKeyword('');
    }
  };

  const handleRemoveKeyword = (keywordToRemove: string) => {
    if (editingCategory) {
      setEditingCategory(prev => prev ? {
        ...prev,
        keywords: prev.keywords.filter(keyword => keyword !== keywordToRemove)
      } : null);
    }
  };

  const handleToggleCategory = (categoryId: string) => {
    setConfig(prev => ({
      ...prev,
      categories: prev.categories.map(cat => 
        cat.id === categoryId ? { ...cat, enabled: !cat.enabled } : cat
      )
    }));
  };

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          Configure custom categories to automatically group work items based on tags and keywords. 
          Work items will be categorized by checking their tags and descriptions for matching keywords.
        </Typography>
      </Alert>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6">Work Item Categories</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleAddCategory}
        >
          Add Category
        </Button>
      </Box>

      <Grid container spacing={3}>
        {config.categories.map((category) => (
          <Grid item xs={12} md={6} key={category.id}>
            <Paper 
              elevation={1} 
              sx={{ 
                p: 2, 
                borderLeft: `4px solid ${category.color}`,
                opacity: category.enabled ? 1 : 0.6
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <Typography variant="h6" sx={{ color: category.color }}>
                      {category.name}
                    </Typography>
                    {category.isDefault && (
                      <Chip size="small" label="Default" color="primary" />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {category.description}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={category.enabled}
                        onChange={() => handleToggleCategory(category.id)}
                        size="small"
                      />
                    }
                    label=""
                    sx={{ m: 0 }}
                  />
                  <IconButton 
                    size="small" 
                    onClick={() => handleEditCategory(category)}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  {!category.isDefault && (
                    <IconButton 
                      size="small" 
                      onClick={() => handleDeleteCategory(category.id)}
                      color="error"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Tags:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {category.tags.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">No tags</Typography>
                  ) : (
                    category.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))
                  )}
                </Box>
              </Box>

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                  Keywords:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {category.keywords.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">No keywords</Typography>
                  ) : (
                    category.keywords.map((keyword) => (
                      <Chip key={keyword} label={keyword} size="small" color="secondary" variant="outlined" />
                    ))
                  )}
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoIcon color="info" fontSize="small" />
          <Typography variant="body2" color="text.secondary">
            Categories are checked in order. First match determines the category.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveConfig}
        >
          Save Configuration
        </Button>
      </Box>

      {/* Edit Category Dialog */}
      <Dialog open={isDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingCategory?.id.startsWith('category_') ? 'Add New Category' : 'Edit Category'}
        </DialogTitle>
        <DialogContent>
          {editingCategory && (
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    label="Category Name"
                    value={editingCategory.name}
                    onChange={(e) => setEditingCategory(prev => prev ? {
                      ...prev,
                      name: e.target.value
                    } : null)}
                    disabled={editingCategory.isDefault}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Color"
                    type="color"
                    value={editingCategory.color}
                    onChange={(e) => setEditingCategory(prev => prev ? {
                      ...prev,
                      color: e.target.value
                    } : null)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Description"
                    multiline
                    rows={2}
                    value={editingCategory.description}
                    onChange={(e) => setEditingCategory(prev => prev ? {
                      ...prev,
                      description: e.target.value
                    } : null)}
                  />
                </Grid>
                
                {/* Tags Section */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Tags (exact matches in work item tags)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {editingCategory.tags.map((tag) => (
                      <Chip 
                        key={tag} 
                        label={tag} 
                        onDelete={() => handleRemoveTag(tag)}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      label="Add Tag"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                    />
                    <Button onClick={handleAddTag} variant="outlined" size="small">
                      Add
                    </Button>
                  </Box>
                </Grid>

                {/* Keywords Section */}
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Keywords (searched in title and description)
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                    {editingCategory.keywords.map((keyword) => (
                      <Chip 
                        key={keyword} 
                        label={keyword} 
                        onDelete={() => handleRemoveKeyword(keyword)}
                        color="secondary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      label="Add Keyword"
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()}
                    />
                    <Button onClick={handleAddKeyword} variant="outlined" size="small">
                      Add
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSaveCategory} variant="contained">
            Save Category
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkItemCategoriesConfigForm;
