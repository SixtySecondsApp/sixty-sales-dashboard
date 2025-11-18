import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';

export interface BrandingSettings {
  id: string;
  logo_light_url: string | null;
  logo_dark_url: string | null;
  icon_url: string | null;
}

export function useBrandingSettings() {
  const [settings, setSettings] = useState<BrandingSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();

    // Subscribe to changes
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

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is fine
        logger.error('[useBrandingSettings] Load error:', error);
      }

      setSettings(data || null);
    } catch (error) {
      logger.error('[useBrandingSettings] Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading };
}

