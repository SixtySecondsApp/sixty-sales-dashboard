import { supabase } from '@/lib/supabase/clientV2';
import { Task } from '@/lib/database/models';
import logger from '@/lib/utils/logger';

export interface CreateSubtaskData {
  title: string;
  description?: string;
  notes?: string;
  due_date?: string;
  priority?: Task['priority'];
  task_type?: Task['task_type'];
  assigned_to: string;
  parent_task_id: string;
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  contact_email?: string;
  contact_name?: string;
  company?: string;
  sync_status?: 'pending_sync' | 'local_only' | 'synced';
}

export interface UpdateSubtaskData {
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
  parent_task_id?: string;
  deal_id?: string;
  company_id?: string;
  contact_id?: string;
  contact_email?: string;
  contact_name?: string;
  company?: string;
}

export class SubtaskService {
  
  /**
   * Get all subtasks for a parent task with full join relations
   */
  static async fetchSubtasks(parentTaskId: string): Promise<Task[]> {
    try {
      logger.log('Fetching subtasks for parent task:', parentTaskId);

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url),
          parent_task:tasks!parent_task_id(id, title, status, completed)
        `)
        .eq('parent_task_id', parentTaskId)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Error fetching subtasks:', error);
        throw error;
      }

      logger.log(`Found ${data?.length || 0} subtasks for parent task:`, parentTaskId);
      return data || [];
    } catch (err: any) {
      logger.error('SubtaskService.fetchSubtasks error:', err);
      throw err;
    }
  }

  /**
   * Create a new subtask
   */
  static async createSubtask(subtaskData: CreateSubtaskData, createdBy: string): Promise<Task> {
    try {
      logger.log('Creating subtask:', { 
        title: subtaskData.title, 
        parentTaskId: subtaskData.parent_task_id 
      });

      // Validate parent task exists
      const { data: parentTask, error: parentError } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('id', subtaskData.parent_task_id)
        .single();

      if (parentError || !parentTask) {
        throw new Error(`Parent task not found: ${subtaskData.parent_task_id}`);
      }

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          ...subtaskData,
          created_by: createdBy,
          sync_status: subtaskData.sync_status || 'pending_sync',
        })
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url),
          parent_task:tasks!parent_task_id(id, title, status, completed)
        `)
        .single();

      if (error) {
        logger.error('Error creating subtask:', error);
        throw error;
      }

      logger.log('Subtask created successfully:', data.title);
      return data;
    } catch (err: any) {
      logger.error('SubtaskService.createSubtask error:', err);
      throw err;
    }
  }

  /**
   * Update an existing subtask
   */
  static async updateSubtask(subtaskId: string, updates: UpdateSubtaskData): Promise<Task> {
    try {
      logger.log('Updating subtask:', { id: subtaskId, updates });

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
        .eq('id', subtaskId)
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url),
          parent_task:tasks!parent_task_id(id, title, status, completed)
        `)
        .single();

      if (error) {
        logger.error('Error updating subtask:', error);
        throw error;
      }

      logger.log('Subtask updated successfully:', data.title);
      return data;
    } catch (err: any) {
      logger.error('SubtaskService.updateSubtask error:', err);
      throw err;
    }
  }

  /**
   * Delete a subtask
   */
  static async deleteSubtask(subtaskId: string): Promise<void> {
    try {
      logger.log('Deleting subtask:', subtaskId);

      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', subtaskId);

      if (error) {
        logger.error('Error deleting subtask:', error);
        throw error;
      }

      logger.log('Subtask deleted successfully:', subtaskId);
    } catch (err: any) {
      logger.error('SubtaskService.deleteSubtask error:', err);
      throw err;
    }
  }

  /**
   * Move a subtask to a different parent task
   */
  static async moveSubtask(subtaskId: string, newParentId: string): Promise<Task> {
    try {
      logger.log('Moving subtask:', { subtaskId, newParentId });

      // Validate new parent task exists
      const { data: newParentTask, error: parentError } = await supabase
        .from('tasks')
        .select('id, title')
        .eq('id', newParentId)
        .single();

      if (parentError || !newParentTask) {
        throw new Error(`New parent task not found: ${newParentId}`);
      }

      // Validate subtask exists and is actually a subtask
      const { data: subtask, error: subtaskError } = await supabase
        .from('tasks')
        .select('id, parent_task_id, title')
        .eq('id', subtaskId)
        .single();

      if (subtaskError || !subtask) {
        throw new Error(`Subtask not found: ${subtaskId}`);
      }

      if (!subtask.parent_task_id) {
        throw new Error(`Task ${subtaskId} is not a subtask - it has no parent`);
      }

      // Prevent moving a task to be its own subtask (circular reference)
      if (subtaskId === newParentId) {
        throw new Error('Cannot move a task to be its own subtask');
      }

      // Update parent_task_id
      const { data, error } = await supabase
        .from('tasks')
        .update({ parent_task_id: newParentId })
        .eq('id', subtaskId)
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url),
          parent_task:tasks!parent_task_id(id, title, status, completed)
        `)
        .single();

      if (error) {
        logger.error('Error moving subtask:', error);
        throw error;
      }

      logger.log(`Subtask moved successfully: ${subtask.title} → ${newParentTask.title}`);
      return data;
    } catch (err: any) {
      logger.error('SubtaskService.moveSubtask error:', err);
      throw err;
    }
  }

  /**
   * Complete a subtask
   */
  static async completeSubtask(subtaskId: string): Promise<Task> {
    return this.updateSubtask(subtaskId, {
      completed: true,
      status: 'completed',
      completed_at: new Date().toISOString()
    });
  }

  /**
   * Mark a subtask as incomplete
   */
  static async uncompleteSubtask(subtaskId: string): Promise<Task> {
    return this.updateSubtask(subtaskId, {
      completed: false,
      status: 'pending',
      completed_at: undefined
    });
  }

  /**
   * Get subtask statistics for a parent task
   */
  static async getSubtaskStats(parentTaskId: string) {
    try {
      logger.log('Getting subtask stats for parent task:', parentTaskId);

      const { data, error } = await supabase
        .from('tasks')
        .select('id, status, priority, due_date, completed')
        .eq('parent_task_id', parentTaskId);

      if (error) {
        logger.error('Error fetching subtask stats:', error);
        throw error;
      }

      const subtasks = data || [];
      const now = new Date();

      const stats = {
        total: subtasks.length,
        pending: subtasks.filter(t => t.status === 'pending').length,
        in_progress: subtasks.filter(t => t.status === 'in_progress').length,
        completed: subtasks.filter(t => t.completed).length,
        overdue: subtasks.filter(t => 
          t.due_date && 
          new Date(t.due_date) < now && 
          !t.completed &&
          t.status !== 'cancelled'
        ).length,
        due_today: subtasks.filter(t => {
          if (!t.due_date || t.completed) return false;
          const dueDate = new Date(t.due_date);
          return dueDate.toDateString() === now.toDateString();
        }).length,
        high_priority: subtasks.filter(t => 
          t.priority === 'high' || t.priority === 'urgent'
        ).length,
        completion_percentage: subtasks.length > 0 ? 
          Math.round((subtasks.filter(t => t.completed).length / subtasks.length) * 100) : 0
      };

      logger.log('Subtask stats calculated:', stats);
      return stats;
    } catch (err: any) {
      logger.error('SubtaskService.getSubtaskStats error:', err);
      throw err;
    }
  }

  /**
   * Bulk update multiple subtasks
   */
  static async bulkUpdateSubtasks(subtaskIds: string[], updates: UpdateSubtaskData): Promise<Task[]> {
    try {
      logger.log('Bulk updating subtasks:', { count: subtaskIds.length, updates });

      // Handle completion logic for bulk updates
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
        .in('id', subtaskIds)
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url),
          parent_task:tasks!parent_task_id(id, title, status, completed)
        `);

      if (error) {
        logger.error('Error bulk updating subtasks:', error);
        throw error;
      }

      logger.log(`Bulk updated ${data?.length || 0} subtasks successfully`);
      return data || [];
    } catch (err: any) {
      logger.error('SubtaskService.bulkUpdateSubtasks error:', err);
      throw err;
    }
  }

  /**
   * Get all subtasks with their parent task information (useful for overview pages)
   */
  static async getSubtasksWithParent(assignedTo?: string): Promise<Task[]> {
    try {
      logger.log('Getting subtasks with parent information');

      let query = supabase
        .from('tasks')
        .select(`
          *,
          assignee:profiles!assigned_to(id, first_name, last_name, email, avatar_url),
          creator:profiles!created_by(id, first_name, last_name, email, avatar_url),
          parent_task:tasks!parent_task_id(id, title, status, completed, due_date)
        `)
        .not('parent_task_id', 'is', null)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Error fetching subtasks with parent:', error);
        throw error;
      }

      logger.log(`Found ${data?.length || 0} subtasks with parent information`);
      return data || [];
    } catch (err: any) {
      logger.error('SubtaskService.getSubtasksWithParent error:', err);
      throw err;
    }
  }
}