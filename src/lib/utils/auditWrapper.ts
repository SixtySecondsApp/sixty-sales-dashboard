import { supabase } from '@/lib/supabase/clientV2';
import { getSessionId } from './sessionContext';

/**
 * Wrapper function to set session context before database operations
 * This ensures that audit logs capture the correct session ID
 */
export async function withAuditContext<T>(
  operation: () => Promise<T>
): Promise<T> {
  const sessionId = getSessionId();
  
  if (sessionId) {
    try {
      // Set the session context in the database
      await supabase.rpc('set_config', {
        setting_name: 'app.session_id',
        setting_value: sessionId,
        is_local: true
      });
    } catch (error) {
      console.warn('Failed to set session context:', error);
      // Continue with operation even if setting context fails
    }
  }
  
  return await operation();
}

/**
 * Enhanced supabase client that automatically sets session context
 * Use this wrapper for operations that should be tracked in audit logs
 */
export const auditSupabase = {
  from: (table: string) => {
    return {
      ...supabase.from(table),
      insert: async (data: any) => {
        return withAuditContext(() => supabase.from(table).insert(data));
      },
      update: async (data: any) => {
        return withAuditContext(() => supabase.from(table).update(data));
      },
      delete: async () => {
        return withAuditContext(() => supabase.from(table).delete());
      },
      upsert: async (data: any) => {
        return withAuditContext(() => supabase.from(table).upsert(data));
      }
    };
  },
  
  rpc: async (fn: string, params?: any) => {
    return withAuditContext(() => supabase.rpc(fn, params));
  }
};

/**
 * Helper function to manually set session context for a single operation
 * Useful for operations that don't use the auditSupabase wrapper
 */
export async function setAuditSessionContext(): Promise<void> {
  const sessionId = getSessionId();
  
  if (sessionId) {
    try {
      await supabase.rpc('set_config', {
        setting_name: 'app.session_id',
        setting_value: sessionId,
        is_local: true
      });
    } catch (error) {
      console.warn('Failed to set session context:', error);
    }
  }
}