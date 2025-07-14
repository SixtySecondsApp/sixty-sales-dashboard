import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from './useUser';

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  user_id: string;
  changed_at: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  changed_fields: string[];
  ip_address?: string;
  user_agent?: string;
}

export interface AuditHistoryEntry {
  audit_id: string;
  action: string;
  changed_by: string;
  changed_at: string;
  changed_fields: string[];
  old_value: Record<string, any> | null;
  new_value: Record<string, any> | null;
}

export interface FieldHistoryEntry {
  changed_at: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
}

export function useAuditLogs() {
  const { userData } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = userData?.is_admin || false;

  // Get audit history for a specific record
  const getAuditHistory = async (
    tableName: string, 
    recordId: string, 
    limit: number = 50
  ): Promise<AuditHistoryEntry[]> => {
    if (!isAdmin) {
      throw new Error('Only administrators can view audit logs');
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .rpc('get_audit_history', {
          p_table_name: tableName,
          p_record_id: recordId,
          p_limit: limit
        });

      if (error) throw error;

      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch audit history';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get field-specific history
  const getFieldHistory = async (
    tableName: string,
    recordId: string,
    fieldName: string,
    limit: number = 50
  ): Promise<FieldHistoryEntry[]> => {
    if (!isAdmin) {
      throw new Error('Only administrators can view audit logs');
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase
        .rpc('get_field_history', {
          p_table_name: tableName,
          p_record_id: recordId,
          p_field_name: fieldName,
          p_limit: limit
        });

      if (error) throw error;

      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch field history';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Get recent audit logs
  const getRecentAuditLogs = async (
    limit: number = 100,
    tableName?: string
  ): Promise<AuditLog[]> => {
    if (!isAdmin) {
      throw new Error('Only administrators can view audit logs');
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (tableName) {
        query = query.eq('table_name', tableName);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch audit logs';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Search audit logs
  const searchAuditLogs = async (
    searchParams: {
      tableName?: string;
      recordId?: string;
      userId?: string;
      action?: 'INSERT' | 'UPDATE' | 'DELETE';
      startDate?: Date;
      endDate?: Date;
      changedField?: string;
    }
  ): Promise<AuditLog[]> => {
    if (!isAdmin) {
      throw new Error('Only administrators can view audit logs');
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('changed_at', { ascending: false });

      if (searchParams.tableName) {
        query = query.eq('table_name', searchParams.tableName);
      }
      
      if (searchParams.recordId) {
        query = query.eq('record_id', searchParams.recordId);
      }
      
      if (searchParams.userId) {
        query = query.eq('user_id', searchParams.userId);
      }
      
      if (searchParams.action) {
        query = query.eq('action', searchParams.action);
      }
      
      if (searchParams.startDate) {
        query = query.gte('changed_at', searchParams.startDate.toISOString());
      }
      
      if (searchParams.endDate) {
        query = query.lte('changed_at', searchParams.endDate.toISOString());
      }
      
      if (searchParams.changedField) {
        query = query.contains('changed_fields', [searchParams.changedField]);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data || [];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to search audit logs';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    isAdmin,
    loading,
    error,
    getAuditHistory,
    getFieldHistory,
    getRecentAuditLogs,
    searchAuditLogs
  };
}

// Helper function to format audit log changes for display
export function formatAuditChanges(
  oldData: Record<string, any> | null,
  newData: Record<string, any> | null,
  changedFields: string[]
): Array<{ field: string; oldValue: any; newValue: any }> {
  return changedFields.map(field => ({
    field,
    oldValue: oldData?.[field] ?? null,
    newValue: newData?.[field] ?? null
  }));
}

// Helper to get a human-readable description of the change
export function getChangeDescription(
  action: string,
  tableName: string,
  changedFields?: string[]
): string {
  const tableNameSingular = tableName.replace(/s$/, '');
  
  switch (action) {
    case 'INSERT':
      return `Created new ${tableNameSingular}`;
    case 'DELETE':
      return `Deleted ${tableNameSingular}`;
    case 'UPDATE':
      if (changedFields && changedFields.length > 0) {
        return `Updated ${changedFields.join(', ')} on ${tableNameSingular}`;
      }
      return `Updated ${tableNameSingular}`;
    default:
      return `${action} on ${tableNameSingular}`;
  }
}