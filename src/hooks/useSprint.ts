import { useState, useEffect, useCallback } from 'react';
import { useAdoContext } from '../contexts/AdoContext';
import adoService from '../services/adoService';
import { Sprint, WorkItem } from '../types';

interface UseSprintResult {
  sprints: Sprint[];
  currentSprint: Sprint | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getSprintWorkItems: (sprintId: string) => Promise<WorkItem[]>;
}

export const useSprint = (): UseSprintResult => {
  const { isConfigured } = useAdoContext();
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [currentSprint, setCurrentSprint] = useState<Sprint | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSprints = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all sprints
      const fetchedSprints = await adoService.getSprints();
      setSprints(fetchedSprints);

      // Find the current sprint
      const current = fetchedSprints.find(sprint => sprint.state === 'current') || null;
      setCurrentSprint(current);
    } catch (err) {
      console.error('Error fetching sprints:', err);
      setError('Failed to fetch sprints');
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  // Fetch sprints on initial render and when configuration changes
  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      fetchSprints();
    };

    window.addEventListener('ado-data-refresh', handleRefresh);

    return () => {
      window.removeEventListener('ado-data-refresh', handleRefresh);
    };
  }, [fetchSprints]);

  // Function to get work items for a specific sprint
  const getSprintWorkItems = async (sprintId: string): Promise<WorkItem[]> => {
    try {
      const workItems = await adoService.getSprintWorkItems(sprintId);
      // Map from AdoService WorkItem type to our WorkItem type
      return workItems.map(item => ({
        id: item.id.toString(),
        title: item.title,
        state: item.state,
        type: item.type,
        assignedTo: item.assignedTo,
        effort: item.effort,
        priority: item.priority,
        tags: item.tags || [],
        createdDate: item.createdDate,
        updatedDate: item.updatedDate,
        description: item.description || undefined,
        url: item.url,
        parentId: item.parentId,
        gitCommits: item.gitCommits,
        pullRequests: item.pullRequests,
        relations: item.relations,
        fields: item.fields
      }));
    } catch (err) {
      console.error(`Error fetching work items for sprint ${sprintId}:`, err);
      setError('Failed to fetch sprint work items');
      return [];
    }
  };

  return {
    sprints,
    currentSprint,
    loading,
    error,
    refresh: fetchSprints,
    getSprintWorkItems
  };
};

export default useSprint;