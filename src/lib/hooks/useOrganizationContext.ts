/**
 * useOrganizationContext - React Query hooks for organization context management
 *
 * Provides hooks for fetching and updating organization context variables
 * used in platform skill interpolation.
 *
 * Usage:
 * ```ts
 * // Fetch context for an organization
 * const { data: context, isLoading } = useOrganizationContext(orgId);
 *
 * // Update a single context value
 * const updateMutation = useUpdateContext();
 * updateMutation.mutate({ orgId, key: 'company_name', value: 'Acme Corp' });
 *
 * // Bulk update multiple context values
 * const bulkMutation = useBulkUpdateContext();
 * bulkMutation.mutate({
 *   orgId,
 *   updates: [
 *     { key: 'company_name', value: 'Acme Corp' },
 *     { key: 'industry', value: 'Technology' },
 *   ],
 * });
 * ```
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

// ============================================================================
// Types
// ============================================================================

export interface OrganizationContextItem {
  id: string;
  organization_id: string;
  context_key: string;
  value: unknown;
  value_type: 'string' | 'array' | 'object';
  source: 'scrape' | 'manual' | 'user' | 'enrichment' | 'migration';
  confidence: number;
  created_at: string;
  updated_at: string;
}

export interface OrganizationContextObject {
  [key: string]: unknown;
}

export interface UpdateContextParams {
  orgId: string;
  key: string;
  value: unknown;
  source?: 'manual' | 'user';
}

export interface BulkUpdateContextParams {
  orgId: string;
  updates: Array<{
    key: string;
    value: unknown;
    source?: 'manual' | 'user';
  }>;
}

// ============================================================================
// Query Keys
// ============================================================================

const contextKeys = {
  all: ['organization-context'] as const,
  list: (orgId: string) => [...contextKeys.all, 'list', orgId] as const,
  object: (orgId: string) => [...contextKeys.all, 'object', orgId] as const,
  detail: (orgId: string, key: string) =>
    [...contextKeys.all, 'detail', orgId, key] as const,
};

// ============================================================================
// Fetch Functions
// ============================================================================

async function fetchOrganizationContextList(
  orgId: string
): Promise<OrganizationContextItem[]> {
  const { data, error } = await supabase
    .from('organization_context')
    .select('*')
    .eq('organization_id', orgId)
    .order('context_key', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch organization context: ${error.message}`);
  }

  return data || [];
}

async function fetchOrganizationContextObject(
  orgId: string
): Promise<OrganizationContextObject> {
  const { data, error } = await supabase.rpc('get_organization_context_object', {
    p_org_id: orgId,
  });

  if (error) {
    throw new Error(`Failed to fetch organization context: ${error.message}`);
  }

  return data || {};
}

async function fetchContextValue(
  orgId: string,
  key: string
): Promise<OrganizationContextItem | null> {
  const { data, error } = await supabase
    .from('organization_context')
    .select('*')
    .eq('organization_id', orgId)
    .eq('context_key', key)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch context value: ${error.message}`);
  }

  return data;
}

// ============================================================================
// Mutation Functions
// ============================================================================

async function upsertContextValue(params: UpdateContextParams): Promise<string> {
  const { orgId, key, value, source = 'manual' } = params;

  const { data, error } = await supabase.rpc('upsert_organization_context', {
    p_org_id: orgId,
    p_key: key,
    p_value: JSON.stringify(value),
    p_source: source,
    p_confidence: 1.0,
  });

  if (error) {
    throw new Error(`Failed to update context: ${error.message}`);
  }

  return data;
}

async function bulkUpsertContext(params: BulkUpdateContextParams): Promise<{
  success: number;
  errors: string[];
}> {
  const { orgId, updates } = params;

  const errors: string[] = [];
  let success = 0;

  for (const update of updates) {
    try {
      await supabase.rpc('upsert_organization_context', {
        p_org_id: orgId,
        p_key: update.key,
        p_value: JSON.stringify(update.value),
        p_source: update.source || 'manual',
        p_confidence: 1.0,
      });
      success++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${update.key}: ${message}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Some updates failed: ${errors.join(', ')}`);
  }

  return { success, errors };
}

async function deleteContextValue(orgId: string, key: string): Promise<void> {
  const { error } = await supabase
    .from('organization_context')
    .delete()
    .eq('organization_id', orgId)
    .eq('context_key', key);

  if (error) {
    throw new Error(`Failed to delete context: ${error.message}`);
  }
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to fetch all organization context as a list of items
 * Use when you need full metadata (source, confidence, timestamps)
 */
export function useOrganizationContextList(orgId: string | null | undefined) {
  return useQuery({
    queryKey: contextKeys.list(orgId || ''),
    queryFn: () => fetchOrganizationContextList(orgId!),
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch organization context as a flat object
 * Use when you need the context for skill interpolation
 */
export function useOrganizationContext(orgId: string | null | undefined) {
  return useQuery({
    queryKey: contextKeys.object(orgId || ''),
    queryFn: () => fetchOrganizationContextObject(orgId!),
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a specific context value
 */
export function useContextValue(
  orgId: string | null | undefined,
  key: string | null | undefined
) {
  return useQuery({
    queryKey: contextKeys.detail(orgId || '', key || ''),
    queryFn: () => fetchContextValue(orgId!, key!),
    enabled: Boolean(orgId) && Boolean(key),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to update a single context value
 */
export function useUpdateContext(options?: {
  showToast?: boolean;
  onSuccess?: (id: string) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  const { showToast = true, onSuccess, onError } = options || {};

  return useMutation({
    mutationFn: upsertContextValue,
    onSuccess: (id, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: contextKeys.list(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: contextKeys.object(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: contextKeys.detail(variables.orgId, variables.key),
      });

      if (showToast) {
        toast.success('Context updated', {
          description: `Updated ${variables.key}`,
        });
      }

      onSuccess?.(id);
    },
    onError: (error) => {
      if (showToast) {
        toast.error('Failed to update context', {
          description: error.message,
        });
      }
      onError?.(error);
    },
  });
}

/**
 * Hook to update multiple context values at once
 */
export function useBulkUpdateContext(options?: {
  showToast?: boolean;
  onSuccess?: (result: { success: number; errors: string[] }) => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  const { showToast = true, onSuccess, onError } = options || {};

  return useMutation({
    mutationFn: bulkUpsertContext,
    onSuccess: (result, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: contextKeys.list(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: contextKeys.object(variables.orgId),
      });

      if (showToast) {
        toast.success('Context updated', {
          description: `Updated ${result.success} values`,
        });
      }

      onSuccess?.(result);
    },
    onError: (error) => {
      if (showToast) {
        toast.error('Failed to update context', {
          description: error.message,
        });
      }
      onError?.(error);
    },
  });
}

/**
 * Hook to delete a context value
 */
export function useDeleteContext(options?: {
  showToast?: boolean;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}) {
  const queryClient = useQueryClient();
  const { showToast = true, onSuccess, onError } = options || {};

  return useMutation({
    mutationFn: ({ orgId, key }: { orgId: string; key: string }) =>
      deleteContextValue(orgId, key),
    onSuccess: (_, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({
        queryKey: contextKeys.list(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: contextKeys.object(variables.orgId),
      });
      queryClient.invalidateQueries({
        queryKey: contextKeys.detail(variables.orgId, variables.key),
      });

      if (showToast) {
        toast.success('Context deleted', {
          description: `Removed ${variables.key}`,
        });
      }

      onSuccess?.();
    },
    onError: (error) => {
      if (showToast) {
        toast.error('Failed to delete context', {
          description: error.message,
        });
      }
      onError?.(error);
    },
  });
}

/**
 * Hook to trigger skill recompilation for an organization
 */
export function useRecompileOrgSkills(options?: {
  showToast?: boolean;
  onSuccess?: (result: { success: boolean; compiled: number }) => void;
  onError?: (error: Error) => void;
}) {
  const { showToast = true, onSuccess, onError } = options || {};

  return useMutation({
    mutationFn: async (orgId: string) => {
      const { data, error } = await supabase.functions.invoke(
        'compile-organization-skills',
        {
          body: {
            action: 'compile_all',
            organization_id: orgId,
          },
        }
      );

      if (error) {
        throw new Error(`Failed to recompile skills: ${error.message}`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Recompilation failed');
      }

      return data;
    },
    onSuccess: (result) => {
      if (showToast) {
        toast.success('Skills recompiled', {
          description: `Compiled ${result.compiled} skills`,
        });
      }
      onSuccess?.(result);
    },
    onError: (error) => {
      if (showToast) {
        toast.error('Failed to recompile skills', {
          description: error.message,
        });
      }
      onError?.(error);
    },
  });
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook that provides the context keys for external use
 */
export function useContextQueryKeys() {
  return contextKeys;
}

/**
 * Hook to prefetch organization context
 */
export function usePrefetchOrganizationContext() {
  const queryClient = useQueryClient();

  return (orgId: string) => {
    queryClient.prefetchQuery({
      queryKey: contextKeys.object(orgId),
      queryFn: () => fetchOrganizationContextObject(orgId),
      staleTime: 5 * 60 * 1000,
    });
  };
}

export default useOrganizationContext;
