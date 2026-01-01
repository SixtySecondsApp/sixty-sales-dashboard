/**
 * useQuickAddVersion
 *
 * Hook for managing the Quick Add version feature flags.
 * Reads from and writes to the app_settings table.
 *
 * Keys:
 * - 'quickadd_version_internal'
 * - 'quickadd_version_external'
 *
 * Values: 'v1' | 'v2'
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

export type QuickAddVersion = 'v1' | 'v2';

const DEFAULT_VERSION: QuickAddVersion = 'v1';
const INTERNAL_KEY = 'quickadd_version_internal';
const EXTERNAL_KEY = 'quickadd_version_external';

function parseVersion(value: unknown): QuickAddVersion {
  return value === 'v2' ? 'v2' : 'v1';
}

export function useQuickAddVersion() {
  const [internalVersion, setInternalVersion] = useState<QuickAddVersion>(DEFAULT_VERSION);
  const [externalVersion, setExternalVersion] = useState<QuickAddVersion>(DEFAULT_VERSION);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [{ data: internal, error: internalError }, { data: external, error: externalError }] =
        await Promise.all([
          supabase.from('app_settings').select('value').eq('key', INTERNAL_KEY).maybeSingle(),
          supabase.from('app_settings').select('value').eq('key', EXTERNAL_KEY).maybeSingle(),
        ]);

      if (internalError) throw internalError;
      if (externalError) throw externalError;

      setInternalVersion(parseVersion(internal?.value));
      setExternalVersion(parseVersion(external?.value));
    } catch (err) {
      console.error('Error fetching quick add versions:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch Quick Add versions'));
      setInternalVersion(DEFAULT_VERSION);
      setExternalVersion(DEFAULT_VERSION);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInternalVersion = useCallback(
    async (newVersion: QuickAddVersion): Promise<boolean> => {
      try {
        const previous = internalVersion;
        setInternalVersion(newVersion);

        const { error: upsertError } = await supabase
          .from('app_settings')
          .upsert({ key: INTERNAL_KEY, value: newVersion }, { onConflict: 'key' });

        if (upsertError) {
          setInternalVersion(previous);
          throw upsertError;
        }

        toast.success(`Internal Quick Add set to ${newVersion.toUpperCase()}`);
        return true;
      } catch (err) {
        console.error('Error updating internal quick add version:', err);
        toast.error('Failed to update internal Quick Add version');
        return false;
      }
    },
    [internalVersion]
  );

  const updateExternalVersion = useCallback(
    async (newVersion: QuickAddVersion): Promise<boolean> => {
      try {
        const previous = externalVersion;
        setExternalVersion(newVersion);

        const { error: upsertError } = await supabase
          .from('app_settings')
          .upsert({ key: EXTERNAL_KEY, value: newVersion }, { onConflict: 'key' });

        if (upsertError) {
          setExternalVersion(previous);
          throw upsertError;
        }

        toast.success(`External Quick Add set to ${newVersion.toUpperCase()}`);
        return true;
      } catch (err) {
        console.error('Error updating external quick add version:', err);
        toast.error('Failed to update external Quick Add version');
        return false;
      }
    },
    [externalVersion]
  );

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  return {
    internalVersion,
    externalVersion,
    loading,
    error,
    updateInternalVersion,
    updateExternalVersion,
    refetch: fetchVersions,
  };
}

export function useQuickAddVersionReadOnly(): {
  internalVersion: QuickAddVersion;
  externalVersion: QuickAddVersion;
  loading: boolean;
} {
  const [internalVersion, setInternalVersion] = useState<QuickAddVersion>(DEFAULT_VERSION);
  const [externalVersion, setExternalVersion] = useState<QuickAddVersion>(DEFAULT_VERSION);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVersions() {
      try {
        const [{ data: internal }, { data: external }] = await Promise.all([
          supabase.from('app_settings').select('value').eq('key', INTERNAL_KEY).maybeSingle(),
          supabase.from('app_settings').select('value').eq('key', EXTERNAL_KEY).maybeSingle(),
        ]);

        setInternalVersion(parseVersion(internal?.value));
        setExternalVersion(parseVersion(external?.value));
      } catch (err) {
        console.error('Error fetching quick add versions (read-only):', err);
      } finally {
        setLoading(false);
      }
    }

    fetchVersions();
  }, []);

  return { internalVersion, externalVersion, loading };
}

