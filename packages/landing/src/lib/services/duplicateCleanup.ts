/**
 * Utility functions for cleaning up duplicate Google Tasks
 */

import { supabase } from '../supabase/clientV2';

interface DuplicateTask {
  google_task_id: string;
  assigned_to: string;
  duplicate_count: number;
  task_ids: string[];
}

interface DuplicateMapping {
  google_task_id: string;
  user_id: string;
  duplicate_count: number;
  mapping_ids: string[];
}

export class GoogleTasksDuplicateCleanup {
  /**
   * Find all duplicate tasks (same Google task ID for same user)
   */
  static async findDuplicateTasks(userId?: string): Promise<DuplicateTask[]> {
    let query = supabase
      .from('tasks')
      .select('google_task_id, assigned_to, id, created_at')
      .not('google_task_id', 'is', null);

    if (userId) {
      query = query.eq('assigned_to', userId);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    // Group by google_task_id and assigned_to
    const groups = new Map<string, any[]>();
    
    tasks?.forEach(task => {
      const key = `${task.google_task_id}|${task.assigned_to}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(task);
    });

    // Find duplicates
    const duplicates: DuplicateTask[] = [];
    for (const [key, taskGroup] of groups) {
      if (taskGroup.length > 1) {
        const [google_task_id, assigned_to] = key.split('|');
        duplicates.push({
          google_task_id,
          assigned_to,
          duplicate_count: taskGroup.length,
          task_ids: taskGroup.map(t => t.id)
        });
      }
    }

    return duplicates;
  }

  /**
   * Find all duplicate mappings (same Google task ID for same user)
   */
  static async findDuplicateMappings(userId?: string): Promise<DuplicateMapping[]> {
    let query = supabase
      .from('google_task_mappings')
      .select('google_task_id, user_id, id, created_at')
      .not('google_task_id', 'is', null);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: mappings, error } = await query;
    if (error) throw error;

    // Group by google_task_id and user_id
    const groups = new Map<string, any[]>();
    
    mappings?.forEach(mapping => {
      const key = `${mapping.google_task_id}|${mapping.user_id}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(mapping);
    });

    // Find duplicates
    const duplicates: DuplicateMapping[] = [];
    for (const [key, mappingGroup] of groups) {
      if (mappingGroup.length > 1) {
        const [google_task_id, user_id] = key.split('|');
        duplicates.push({
          google_task_id,
          user_id,
          duplicate_count: mappingGroup.length,
          mapping_ids: mappingGroup.map(m => m.id)
        });
      }
    }

    return duplicates;
  }

  /**
   * Clean up duplicate tasks (keep the most recent)
   */
  static async cleanupDuplicateTasks(userId?: string): Promise<{
    duplicatesFound: number;
    tasksDeleted: number;
    mappingsDeleted: number;
  }> {
    const duplicates = await this.findDuplicateTasks(userId);
    let tasksDeleted = 0;
    let mappingsDeleted = 0;
    for (const duplicate of duplicates) {
      // Get all tasks for this duplicate set
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('id, created_at')
        .in('id', duplicate.task_ids)
        .order('created_at', { ascending: false });

      if (error) {
        continue;
      }

      if (!tasks || tasks.length <= 1) continue;

      // Keep the most recent, delete the rest
      const taskIdsToDelete = tasks.slice(1).map(t => t.id);
      // Delete related mappings first
      const { error: mappingError } = await supabase
        .from('google_task_mappings')
        .delete()
        .in('task_id', taskIdsToDelete);

      if (mappingError) {
      } else {
        mappingsDeleted += taskIdsToDelete.length;
      }

      // Delete duplicate tasks
      const { error: taskError } = await supabase
        .from('tasks')
        .delete()
        .in('id', taskIdsToDelete);

      if (taskError) {
      } else {
        tasksDeleted += taskIdsToDelete.length;
      }
    }

    return {
      duplicatesFound: duplicates.length,
      tasksDeleted,
      mappingsDeleted
    };
  }

  /**
   * Clean up duplicate mappings (keep the most recent)
   */
  static async cleanupDuplicateMappings(userId?: string): Promise<{
    duplicatesFound: number;
    mappingsDeleted: number;
  }> {
    const duplicates = await this.findDuplicateMappings(userId);
    let mappingsDeleted = 0;
    for (const duplicate of duplicates) {
      // Get all mappings for this duplicate set
      const { data: mappings, error } = await supabase
        .from('google_task_mappings')
        .select('id, created_at')
        .in('id', duplicate.mapping_ids)
        .order('created_at', { ascending: false });

      if (error) {
        continue;
      }

      if (!mappings || mappings.length <= 1) continue;

      // Keep the most recent, delete the rest
      const mappingIdsToDelete = mappings.slice(1).map(m => m.id);
      // Delete duplicate mappings
      const { error: mappingError } = await supabase
        .from('google_task_mappings')
        .delete()
        .in('id', mappingIdsToDelete);

      if (mappingError) {
      } else {
        mappingsDeleted += mappingIdsToDelete.length;
      }
    }

    return {
      duplicatesFound: duplicates.length,
      mappingsDeleted
    };
  }

  /**
   * Comprehensive cleanup of all duplicates
   */
  static async performFullCleanup(userId?: string): Promise<{
    taskDuplicatesFound: number;
    mappingDuplicatesFound: number;
    tasksDeleted: number;
    mappingsDeleted: number;
  }> {
    const taskCleanup = await this.cleanupDuplicateTasks(userId);
    const mappingCleanup = await this.cleanupDuplicateMappings(userId);

    const result = {
      taskDuplicatesFound: taskCleanup.duplicatesFound,
      mappingDuplicatesFound: mappingCleanup.duplicatesFound,
      tasksDeleted: taskCleanup.tasksDeleted,
      mappingsDeleted: taskCleanup.mappingsDeleted + mappingCleanup.mappingsDeleted
    };
    return result;
  }

  /**
   * Find orphaned mappings (mappings without corresponding tasks)
   */
  static async findOrphanedMappings(userId?: string): Promise<string[]> {
    let query = supabase
      .from('google_task_mappings')
      .select(`
        id,
        task_id,
        tasks!left(id)
      `);

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data: mappings, error } = await query;
    if (error) throw error;

    return mappings?.filter(m => !m.tasks).map(m => m.id) || [];
  }

  /**
   * Clean up orphaned mappings
   */
  static async cleanupOrphanedMappings(userId?: string): Promise<number> {
    const orphanedIds = await this.findOrphanedMappings(userId);
    
    if (orphanedIds.length === 0) {
      return 0;
    }
    const { error } = await supabase
      .from('google_task_mappings')
      .delete()
      .in('id', orphanedIds);

    if (error) {
      return 0;
    }

    return orphanedIds.length;
  }
}