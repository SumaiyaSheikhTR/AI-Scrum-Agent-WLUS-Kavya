import { WorkItemCategory, WorkItemCategoriesConfig } from '../components/config/WorkItemCategoriesConfigForm';
import type { WorkItem } from '../services/adoService';

// Default categories configuration
const defaultCategoriesConfig: WorkItemCategoriesConfig = {
  categories: [
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
  ],
  defaultCategory: 'delivery'
};

/**
 * Get the current work item categories configuration
 */
export const getWorkItemCategoriesConfig = (): WorkItemCategoriesConfig => {
  try {
    const savedConfig = localStorage.getItem('workItemCategoriesConfig');
    if (savedConfig) {
      return JSON.parse(savedConfig);
    }
  } catch (error) {
    console.error('Error loading work item categories config:', error);
  }
  
  return defaultCategoriesConfig;
};

/**
 * Categorize a work item based on the current configuration
 */
export const categorizeWorkItem = (workItem: WorkItem): WorkItemCategory | null => {
  const config = getWorkItemCategoriesConfig();
  
  // Check each category in order (first match wins)
  for (const category of config.categories) {
    if (!category.enabled) continue;
    
    // Check tags for exact matches
    if (workItem.tags) {
      for (const tag of workItem.tags) {
        if (category.tags.some(catTag => 
          catTag.toLowerCase() === tag.toLowerCase()
        )) {
          return category;
        }
      }
    }
    
    // Check keywords in title and description
    const title = workItem.title?.toLowerCase() || '';
    const description = (workItem.description || '')?.toLowerCase();
    
    for (const keyword of category.keywords) {
      const keywordLower = keyword.toLowerCase();
      if (title.includes(keywordLower) || description.includes(keywordLower)) {
        return category;
      }
    }
  }
  
  // Return default category if no match found
  const defaultCategory = config.categories.find(cat => 
    cat.id === config.defaultCategory && cat.enabled
  );
  
  return defaultCategory || null;
};

/**
 * Filter work items by category
 */
export const filterWorkItemsByCategory = (
  workItems: WorkItem[], 
  categoryId: string
): WorkItem[] => {
  return workItems.filter(item => {
    const category = categorizeWorkItem(item);
    return category?.id === categoryId;
  });
};

/**
 * Group work items by their categories
 */
export const groupWorkItemsByCategory = (workItems: WorkItem[]): Record<string, WorkItem[]> => {
  const config = getWorkItemCategoriesConfig();
  const result: Record<string, WorkItem[]> = {};
  
  // Initialize all enabled categories with empty arrays
  config.categories
    .filter(cat => cat.enabled)
    .forEach(cat => {
      result[cat.id] = [];
    });
  
  // Categorize each work item
  workItems.forEach(item => {
    const category = categorizeWorkItem(item);
    if (category && result[category.id]) {
      result[category.id].push(item);
    }
  });
  
  return result;
};

/**
 * Get all enabled categories
 */
export const getEnabledCategories = (): WorkItemCategory[] => {
  const config = getWorkItemCategoriesConfig();
  return config.categories.filter(cat => cat.enabled);
};
