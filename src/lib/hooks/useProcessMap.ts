import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrgId } from '@/lib/contexts/OrgContext';
import type { ProcessType, ProcessName } from '@/components/process-maps/ProcessMapButton';

export interface ProcessMapData {
  id: string;
  org_id: string;
  process_type: ProcessType;
  process_name: ProcessName;
  title: string;
  description: string | null;
  mermaid_code: string | null;
  mermaid_code_horizontal: string | null;
  mermaid_code_vertical: string | null;
  process_structure: Record<string, unknown> | null;
  generation_status: 'pending' | 'structure_ready' | 'partial' | 'complete';
  version: number;
  created_at: string;
  updated_at: string;
}

interface UseProcessMapOptions {
  processType: ProcessType;
  processName: ProcessName;
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean;
}

interface UseProcessMapResult {
  processMap: ProcessMapData | null;
  loading: boolean;
  error: string | null;
  /** Refetch the process map from database */
  refetch: () => Promise<void>;
  /** Check if a process map exists without full data */
  exists: boolean;
  /** Whether the map is fully generated (both views) */
  isComplete: boolean;
  /** Get mermaid code for a specific direction */
  getMermaidCode: (direction: 'horizontal' | 'vertical') => string | null;
}

/**
 * Hook to fetch and manage a process map by type and name.
 * Retrieves the most up-to-date process map from the database for the current org.
 */
export function useProcessMap({
  processType,
  processName,
  autoFetch = true,
}: UseProcessMapOptions): UseProcessMapResult {
  const orgId = useOrgId();
  const [processMap, setProcessMap] = useState<ProcessMapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProcessMap = useCallback(async () => {
    if (!orgId) {
      setProcessMap(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('process_maps')
        .select('*')
        .eq('org_id', orgId)
        .eq('process_type', processType)
        .eq('process_name', processName)
        .order('version', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      setProcessMap(data as ProcessMapData | null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch process map';
      setError(message);
      setProcessMap(null);
    } finally {
      setLoading(false);
    }
  }, [orgId, processType, processName]);

  useEffect(() => {
    if (autoFetch) {
      fetchProcessMap();
    }
  }, [autoFetch, fetchProcessMap]);

  const getMermaidCode = useCallback(
    (direction: 'horizontal' | 'vertical'): string | null => {
      if (!processMap) return null;
      if (direction === 'vertical') {
        return processMap.mermaid_code_vertical || processMap.mermaid_code;
      }
      return processMap.mermaid_code_horizontal || processMap.mermaid_code;
    },
    [processMap]
  );

  return {
    processMap,
    loading,
    error,
    refetch: fetchProcessMap,
    exists: processMap !== null,
    isComplete: processMap?.generation_status === 'complete',
    getMermaidCode,
  };
}

export default useProcessMap;
