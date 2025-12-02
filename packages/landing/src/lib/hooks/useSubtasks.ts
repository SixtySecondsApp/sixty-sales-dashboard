import { useState, useEffect, useCallback, useMemo } from 'react';
import { Task } from '@/lib/database/models';
import { useUser } from './useUser';
import logger from '@/lib/utils/logger';
import { 
  SubtaskService, 
  CreateSubtaskData, 
  UpdateSubtaskData 
} from '@/lib/services/subtaskService';

interface SubtaskFilters {
  assigned_to?: string;
  status?: Task['status'][];
  priority?: Task['priority'][];
  completed?: boolean;
  overdue_only?: boolean;
  due_today?: boolean;
}

interface UseSubtasksOptions {
  parentTaskId: string;
  filters?: SubtaskFilters;
  enabled?: boolean;
}

export function useSubtasks(options: UseSubtasksOptions) {
  const { parentTaskId, filters, enabled = true } = options;
  const { userData, isLoading: userLoading } = useUser();
  
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Memoize filters to prevent infinite loops in useEffect
  const filtersString = JSON.stringify(filters);

  const fetchSubtasks = useCallback(async () => {
    // Don't fetch if user is still loading or not enabled
    if (userLoading || !enabled) {
      logger.log('fetchSubtasks: User still loading or disabled, waiting...');
      return;
    }

    // Ensure we have parentTaskId
    if (!parentTaskId) {
      logger.log('fetchSubtasks: No parentTaskId provided');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const parsedFilters = filtersString ? JSON.parse(filtersString) : {};
      
      logger.log('Fetching subtasks for parent:', parentTaskId);
      const data = await SubtaskService.fetchSubtasks(parentTaskId);
      
      // Apply client-side filters if provided
      let filteredData = data;
      if (parsedFilters) {
        filteredData = data.filter(subtask => {
          if (parsedFilters.assigned_to && subtask.assigned_to !== parsedFilters.assigned_to) {
            return false;
          }
          
          if (parsedFilters.status && !parsedFilters.status.includes(subtask.status)) {
            return false;
          }
          
          if (parsedFilters.priority && !parsedFilters.priority.includes(subtask.priority)) {
            return false;
          }
          
          if (parsedFilters.completed !== undefined && subtask.completed !== parsedFilters.completed) {
            return false;
          }
          
          if (parsedFilters.overdue_only) {
            const now = new Date();
            const isOverdue = subtask.due_date && 
              new Date(subtask.due_date) < now && 
              !subtask.completed && 
              subtask.status !== 'cancelled';
            if (!isOverdue) return false;
          }
          
          if (parsedFilters.due_today) {
            if (!subtask.due_date || subtask.completed) return false;
            const now = new Date();
            const dueDate = new Date(subtask.due_date);
            if (dueDate.toDateString() !== now.toDateString()) return false;
          }
          
          return true;
        });
      }

      setSubtasks(filteredData);
      logger.log(`Found ${filteredData.length} subtasks for parent task:`, parentTaskId);
    } catch (err: any) {
      logger.error('Error fetching subtasks:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [parentTaskId, filtersString, userLoading, enabled]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  const createSubtask = useCallback(async (subtaskData: Omit<CreateSubtaskData, 'parent_task_id'>) => {
    if (!userData?.id) {
      throw new Error('User authentication required to create subtask');
    }

    try {
      const newSubtask = await SubtaskService.createSubtask({
        ...subtaskData,
        parent_task_id: parentTaskId
      }, userData.id);
      
      setSubtasks((prev: Task[]) => [...prev, newSubtask]);
      return newSubtask;
    } catch (err) {
      logger.error('Error creating subtask:', err);
      throw err;
    }
  }, [userData?.id, parentTaskId]);

  const updateSubtask = useCallback(async (subtaskId: string, updates: UpdateSubtaskData) => {
    try {
      const updatedSubtask = await SubtaskService.updateSubtask(subtaskId, updates);
      
      setSubtasks((prev: Task[]) => 
        prev.map((subtask: Task) => 
          subtask.id === subtaskId ? updatedSubtask : subtask
        )
      );
      
      return updatedSubtask;
    } catch (err) {
      logger.error('Error updating subtask:', err);
      throw err;
    }
  }, []);

  const deleteSubtask = useCallback(async (subtaskId: string) => {
    try {
      await SubtaskService.deleteSubtask(subtaskId);
      
      setSubtasks((prev: Task[]) => 
        prev.filter((subtask: Task) => subtask.id !== subtaskId)
      );
    } catch (err) {
      logger.error('Error deleting subtask:', err);
      throw err;
    }
  }, []);

  const moveSubtask = useCallback(async (subtaskId: string, newParentId: string) => {
    try {
      const movedSubtask = await SubtaskService.moveSubtask(subtaskId, newParentId);
      
      // Remove from current parent's subtasks if it's the current parent
      if (newParentId !== parentTaskId) {
        setSubtasks((prev: Task[]) => 
          prev.filter((subtask: Task) => subtask.id !== subtaskId)
        );
      } else {
        // Update if moving to the current parent
        setSubtasks((prev: Task[]) => 
          prev.map((subtask: Task) => 
            subtask.id === subtaskId ? movedSubtask : subtask
          )
        );
      }
      
      return movedSubtask;
    } catch (err) {
      logger.error('Error moving subtask:', err);
      throw err;
    }
  }, [parentTaskId]);

  const completeSubtask = useCallback(async (subtaskId: string) => {
    return updateSubtask(subtaskId, { 
      completed: true, 
      status: 'completed',
      completed_at: new Date().toISOString() 
    });
  }, [updateSubtask]);

  const uncompleteSubtask = useCallback(async (subtaskId: string) => {
    return updateSubtask(subtaskId, { 
      completed: false, 
      status: 'pending',
      completed_at: undefined 
    });
  }, [updateSubtask]);

  const bulkUpdateSubtasks = useCallback(async (subtaskIds: string[], updates: UpdateSubtaskData) => {
    try {
      const updatedSubtasks = await SubtaskService.bulkUpdateSubtasks(subtaskIds, updates);
      
      setSubtasks((prev: Task[]) => {
        const updatedMap = new Map(updatedSubtasks.map(task => [task.id, task]));
        return prev.map(subtask => 
          updatedMap.get(subtask.id) || subtask
        );
      });
      
      return updatedSubtasks;
    } catch (err) {
      logger.error('Error bulk updating subtasks:', err);
      throw err;
    }
  }, []);

  // Derived state and computations
  const subtaskStats = useMemo(() => {
    if (!subtasks.length) return null;

    const now = new Date();
    
    return {
      total: subtasks.length,
      completed: subtasks.filter(s => s.completed).length,
      pending: subtasks.filter(s => s.status === 'pending').length,
      in_progress: subtasks.filter(s => s.status === 'in_progress').length,
      overdue: subtasks.filter(s => 
        s.due_date && 
        new Date(s.due_date) < now && 
        !s.completed &&
        s.status !== 'cancelled'
      ).length,
      due_today: subtasks.filter(s => {
        if (!s.due_date || s.completed) return false;
        const dueDate = new Date(s.due_date);
        return dueDate.toDateString() === now.toDateString();
      }).length,
      high_priority: subtasks.filter(s => 
        s.priority === 'high' || s.priority === 'urgent'
      ).length,
      completion_percentage: Math.round(
        (subtasks.filter(s => s.completed).length / subtasks.length) * 100
      )
    };
  }, [subtasks]);

  return {
    // Data
    subtasks,
    subtaskStats,
    
    // Loading states
    isLoading,
    
    // Error states
    error,
    
    // Actions
    fetchSubtasks,
    createSubtask,
    updateSubtask,
    deleteSubtask,
    moveSubtask,
    completeSubtask,
    uncompleteSubtask,
    bulkUpdateSubtasks,
  };
}

/**
 * Hook for managing all user subtasks across different parent tasks
 */
export function useAllSubtasks(assignedTo?: string, enabled = true) {
  const { userData, isLoading: userLoading } = useUser();
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSubtasks = useCallback(async () => {
    // Don't fetch if user is still loading or not enabled
    if (userLoading || !enabled) {
      logger.log('fetchAllSubtasks: User still loading or disabled, waiting...');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      logger.log('Fetching all subtasks with parent information');
      const data = await SubtaskService.getSubtasksWithParent(assignedTo);
      setSubtasks(data);
    } catch (err: any) {
      logger.error('Error fetching all subtasks:', err);
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [assignedTo, userLoading, enabled]);

  useEffect(() => {
    fetchSubtasks();
  }, [fetchSubtasks]);

  // Group subtasks by parent task for easier display
  const subtasksByParent = useMemo(() => {
    return subtasks.reduce((acc: Record<string, Task[]>, subtask) => {
      const parentId = subtask.parent_task_id;
      if (parentId) {
        if (!acc[parentId]) {
          acc[parentId] = [];
        }
        acc[parentId].push(subtask);
      }
      return acc;
    }, {});
  }, [subtasks]);

  return {
    subtasks,
    subtasksByParent,
    isLoading,
    error,
    refetch: fetchSubtasks
  };
}