import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useOrgId } from '@/lib/contexts/OrgContext';
import logger from '@/lib/utils/logger';

export interface BrandingSettings {
  id: string;
  org_id: string | null;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  icon_url: string | null;
}

// Fallback logo URL
const FALLBACK_LOGO = 'https://www.sixtyseconds.ai/images/logo.png';

/**
 * Hook to fetch global branding settings for public pages (no auth required)
 * Only fetches global settings (org_id IS NULL)
 */
export function usePublicBrandingSettings() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    try {
      // Fetch global settings (org_id IS NULL)
      const { data: globalSettings, error: globalError } = await (supabase as any)
        .from('branding_settings')
        .select('*')
        .is('org_id', null)
        .maybeSingle();

      if (globalError && globalError.code !== 'PGRST116') {
        console.error('[usePublicBrandingSettings] Load error:', globalError);
      }

      setSettings(globalSettings || null);
    } catch (error) {
      console.error('[usePublicBrandingSettings] Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // Return logo URLs with fallbacks
  const logoLight = settings?.logo_light_url || FALLBACK_LOGO;
  const logoDark = settings?.logo_dark_url || FALLBACK_LOGO;
  const icon = settings?.icon_url || FALLBACK_LOGO;

  return {
    settings,
    loading,
    refetch: loadSettings,
    logoLight,
    logoDark,
    icon,
    fallbackLogo: FALLBACK_LOGO
  };
}

/**
 * Hook to fetch branding settings with org-awareness
 * Priority: org-specific settings > global fallback
 */
export function useBrandingSettings() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const orgId = useOrgId();

  const loadSettings = useCallback(async () => {
    try {
      // First try to get org-specific settings if we have an org
      if (orgId) {
        const { data: orgSettings, error: orgError } = await (supabase as any)
          .from('branding_settings')
          .select('*')
          .eq('org_id', orgId)
          .maybeSingle();

        if (orgError && orgError.code !== 'PGRST116') {
          logger.error('[useBrandingSettings] Org settings load error:', orgError);
        }

        // If org has settings, use them
        if (orgSettings) {
          setSettings(orgSettings);
          setLoading(false);
          return;
        }
      }

      // Fallback to global settings (org_id IS NULL)
      const { data: globalSettings, error: globalError } = await (supabase as any)
        .from('branding_settings')
        .select('*')
        .is('org_id', null)
        .maybeSingle();

      if (globalError && globalError.code !== 'PGRST116') {
        logger.error('[useBrandingSettings] Global settings load error:', globalError);
      }

      setSettings(globalSettings || null);
    } catch (error) {
      logger.error('[useBrandingSettings] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadSettings();

    // Subscribe to database changes
    const channel = supabase
      .channel('branding_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branding_settings',
        },
        () => {
          loadSettings();
        }
      )
      .subscribe();

    // Listen for manual branding update events (from LogoSettings)
    const handleBrandingUpdate = () => {
      loadSettings();
    };
    window.addEventListener('branding-updated', handleBrandingUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('branding-updated', handleBrandingUpdate);
    };
  }, [loadSettings]);

  return { settings, loading, refetch: loadSettings };
}

/**
 * Hook to manage org-specific branding settings (for Settings page)
 * Returns the org's settings specifically, not the fallback
 */
export function useOrgBrandingSettings() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const orgId = useOrgId();

  const loadSettings = useCallback(async () => {
    if (!orgId) {
      setSettings(null);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await (supabase as any)
        .from('branding_settings')
        .select('*')
        .eq('org_id', orgId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        logger.error('[useOrgBrandingSettings] Load error:', error);
      }

      setSettings(data || null);
    } catch (error) {
      logger.error('[useOrgBrandingSettings] Error:', error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadSettings();

    // Subscribe to changes for this org
    const channel = supabase
      .channel(`org_branding_settings_${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'branding_settings',
          filter: orgId ? `org_id=eq.${orgId}` : undefined,
        },
        () => {
          loadSettings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadSettings, orgId]);

  return { settings, loading, refetch: loadSettings, orgId };
}



