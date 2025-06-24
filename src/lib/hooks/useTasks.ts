import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useUser } from './useUser';
import { Task } from '@/lib/database/models';

interface TaskFilters {
  assigned_to?: string;
  created_by?: string;
  status?: Task['status'][];
  priority?: Task['priority'][];
  task_type?: Task['task_type'][];
  due_date_range?: {
    start?: Date;
    end?: Date;
  };
  search?: string;
  overdue_only?: boolean;
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  completed?: boolean;
}

interface CreateTaskData {
  title: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: Task['priority'];
  task_type?: Task['task_type'];
  assigned_to: string;
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  contact_email?: string;
  contact_name?: string;
  company?: string;
}

interface UpdateTaskData {
  title?: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: Task['priority'];
  status?: Task['status'];
  task_type?: Task['task_type'];
  assigned_to?: string;
  completed?: boolean;
  completed_at?: string;
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  contact_email?: string;
  contact_name?: string;
  company?: string;
}

export function useTasks(filters?: TaskFilters) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { userData } = useUser();

  // Memoize filters to prevent infinite loops in useEffect.
  const filtersString = JSON.stringify(filters);

  const fetchTasks = useCallback(async () => {
    // Ensure we have user data before proceeding
    if (!userData?.id) {
      console.log('fetchTasks: No userData.id available, skipping fetch');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const parsedFilters = filtersString ? JSON.parse(filtersString) : {};

      // Get the user ID with fallback for mock scenarios
      const currentUserId = userData.id || 'mock-user-id';

      // Build the query without contact relations for now
      let query = supabase
        .from('tasks')
        .select(
          `
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `
        )
        .order('due_date', { ascending: true, nullsFirst: false });

      // Apply filters
      if (parsedFilters?.assigned_to) {
        query = query.eq('assigned_to', parsedFilters.assigned_to);
      } else if (parsedFilters?.contact_id) {
        // If filtering by contact, don't default to current user
      } else {
        // Default to current user's tasks if no specific assignee filter
        query = query.eq('assigned_to', currentUserId);
      }

      if (parsedFilters?.created_by) {
        query = query.eq('created_by', parsedFilters.created_by);
      }

      if (parsedFilters?.status && parsedFilters.status.length > 0) {
        query = query.in('status', parsedFilters.status);
      }

      if (parsedFilters?.priority && parsedFilters.priority.length > 0) {
        query = query.in('priority', parsedFilters.priority);
      }

      if (parsedFilters?.task_type && parsedFilters.task_type.length > 0) {
        query = query.in('task_type', parsedFilters.task_type);
      }

      if (parsedFilters?.deal_id) {
        query = query.eq('deal_id', parsedFilters.deal_id);
      }

      if (parsedFilters?.company_id) {
        query = query.eq('company_id', parsedFilters.company_id);
      }

      if (parsedFilters?.contact_id) {
        query = query.eq('contact_id', parsedFilters.contact_id);
      }

      if (parsedFilters?.completed !== undefined) {
        query = query.eq('completed', parsedFilters.completed);
      }

      if (parsedFilters?.due_date_range?.start) {
        query = query.gte('due_date', new Date(parsedFilters.due_date_range.start).toISOString());
      }

      if (parsedFilters?.due_date_range?.end) {
        query = query.lte('due_date', new Date(parsedFilters.due_date_range.end).toISOString());
      }

      if (parsedFilters?.overdue_only) {
        query = query
          .lt('due_date', new Date().toISOString())
          .not('status', 'in', '(completed,cancelled)')
          .eq('completed', false);
      }

      if (parsedFilters?.search) {
        query = query.or(
          `
          title.ilike.%${parsedFilters.search}%,
          description.ilike.%${parsedFilters.search}%,
          contact_name.ilike.%${parsedFilters.search}%,
          company.ilike.%${parsedFilters.search}%,
          notes.ilike.%${parsedFilters.search}%
        `
        );
      }

      const { data, error } = await query;

      if (error) {
        // Handle specific errors
        if (error.message?.includes('relation "tasks" does not exist')) {
          console.warn('Tasks table does not exist. Please run the migration.');
          setTasks([]);
          return;
        }
        throw error;
      }

      setTasks(data || []);
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      setError(err);
      // Set empty array if table doesn't exist
      if (err.message?.includes('relation "tasks" does not exist')) {
        setTasks([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [userData?.id, filtersString]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (taskData: CreateTaskData) => {
    // Debug logging
    console.log('createTask called with:', { taskData, userData });
    
    // Wait for userData to be loaded or use fallback
    let userId = userData?.id;
    
    if (!userId) {
      console.log('No userId found, userData:', userData);
      // If userData is still loading, wait a bit or use fallback
      if (!userData) {
        console.error('userData is null/undefined');
        throw new Error('🔄 User authentication data is still loading. Please try again in a moment.');
      }
      // Use fallback ID for development/mock scenarios
      console.log('Using fallback mock-user-id');
      userId = 'mock-user-id';
    }
    
    // Double-check we have a valid userId
    if (!userId || userId === '') {
      console.error('Invalid userId after processing:', userId);
      throw new Error('❌ Invalid user ID. Please refresh the page and try again.');
    }

    console.log('Using userId:', userId);

    try {
      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...taskData,
          created_by: userId,
        })
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      setTasks((prev: Task[]) => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error creating task:', err);
      throw err;
    }
  }, [userData]);

  const updateTask = useCallback(async (taskId: string, updates: UpdateTaskData) => {
    try {
      // Handle completion logic
      if (updates.completed === true && !updates.completed_at) {
        updates.completed_at = new Date().toISOString();
        updates.status = 'completed';
      } else if (updates.completed === false) {
        updates.completed_at = undefined;
        if (updates.status === 'completed') {
          updates.status = 'pending';
        }
      }

      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId)
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `)
        .single();

      if (error) throw error;

      setTasks((prev: Task[]) => prev.map((task: Task) => 
        task.id === taskId ? data : task
      ));
      return data;
    } catch (err) {
      console.error('Error updating task:', err);
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      setTasks((prev: Task[]) => prev.filter((task: Task) => task.id !== taskId));
    } catch (err) {
      console.error('Error deleting task:', err);
      throw err;
    }
  }, []);

  const completeTask = useCallback(async (taskId: string) => {
    return updateTask(taskId, { 
      completed: true, 
      status: 'completed',
      completed_at: new Date().toISOString() 
    });
  }, [updateTask]);

  const uncompleteTask = useCallback(async (taskId: string) => {
    return updateTask(taskId, { 
      completed: false, 
      status: 'pending',
      completed_at: undefined 
    });
  }, [updateTask]);

  const bulkUpdateTasks = useCallback(async (taskIds: string[], updates: UpdateTaskData) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .in('id', taskIds)
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `);

      if (error) throw error;

      setTasks((prev: Task[]) => 
        prev.map((task: Task) => {
          const updatedTask = data.find((updated: Task) => updated.id === task.id);
          return updatedTask || task;
        })
      );
      return data;
    } catch (err) {
      console.error('Error bulk updating tasks:', err);
      throw err;
    }
  }, []);

  const getTasksByDeal = useCallback(async (dealId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `)
        .eq('deal_id', dealId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching tasks by deal:', err);
      throw err;
    }
  }, []);

  const getTasksByContact = useCallback(async (contactId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `)
        .eq('contact_id', contactId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching tasks by contact:', err);
      throw err;
    }
  }, []);

  const getTasksByCompany = useCallback(async (companyId: string) => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `)
        .eq('company_id', companyId)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching tasks by company:', err);
      throw err;
    }
  }, []);

  // Enhanced contact-focused functions
  const createContactTask = useCallback(async (contactId: string, taskData: Omit<CreateTaskData, 'contact_id'>) => {
    return createTask({
      ...taskData,
      contact_id: contactId
    });
  }, [createTask]);

  const getTasksGroupedByContact = useCallback(async (contactIds?: string[]) => {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url)
        `)
        .not('contact_id', 'is', null)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (contactIds && contactIds.length > 0) {
        query = query.in('contact_id', contactIds);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Group tasks by contact
      const groupedTasks = (data || []).reduce((acc: Record<string, Task[]>, task: Task) => {
        const contactId = task.contact_id;
        if (contactId) {
          if (!acc[contactId]) {
            acc[contactId] = [];
          }
          acc[contactId].push(task);
        }
        return acc;
      }, {});

      return groupedTasks;
    } catch (err) {
      console.error('Error fetching tasks grouped by contact:', err);
      throw err;
    }
  }, []);

  return {
    tasks,
    isLoading,
    error,
    fetchTasks,
    createTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    bulkUpdateTasks,
    getTasksByDeal,
    getTasksByContact,
    getTasksByCompany,
    createContactTask,
    getTasksGroupedByContact,
  };
}