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
 * Uses the edge function to bypass RLS and retrieve the most up-to-date
 * process map for the current org.
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
      // Use edge function with 'list' action to bypass RLS (same as ProcessMaps page)
      const response = await supabase.functions.invoke('generate-process-map', {
        body: { action: 'list' },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to fetch process maps');
      }

      const allMaps: ProcessMapData[] = response.data?.processMaps || [];

      // Find the specific map matching processType and processName
      // Sort by version descending to get the latest
      const matchingMap = allMaps
        .filter(m => m.process_type === processType && m.process_name === processName)
        .sort((a, b) => b.version - a.version)[0] || null;

      setProcessMap(matchingMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch process map';
      console.error('[useProcessMap] Error:', message);
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
