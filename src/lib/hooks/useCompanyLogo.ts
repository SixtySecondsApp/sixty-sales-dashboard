import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/clientV2';

interface LogoResponse {
  logo_url: string | null;
  cached: boolean;
  error?: string;
}

/**
 * Hook to fetch company logo from S3 or logo.dev API
 * @param domain - Company domain (will be normalized)
 * @returns Logo URL or null if not available
 */
export function useCompanyLogo(domain: string | null | undefined) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.warn('🟡 [useCompanyLogo] Hook called with domain:', domain);
    if (!domain) {
      console.warn('🟡 [useCompanyLogo] No domain provided, returning null');
      setLogoUrl(null);
      return;
    }

    // Normalize domain
    const normalizedDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .toLowerCase();

    if (!normalizedDomain) {
      setLogoUrl(null);
      return;
    }

    setIsLoading(true);
    setLogoUrl(null); // Reset logo URL when domain changes

    // Fetch logo via edge function
    console.log(`[useCompanyLogo] Fetching logo for domain: ${normalizedDomain}`);
    supabase.functions
      .invoke<LogoResponse>('fetch-company-logo', {
        method: 'POST',
        body: { domain: normalizedDomain },
      })
      .then(({ data, error }) => {
        if (error) {
          console.error('[useCompanyLogo] Error fetching logo:', error);
          setLogoUrl(null);
        } else if (data?.logo_url) {
          console.log(`[useCompanyLogo] Logo fetched successfully: ${data.logo_url}`);
          setLogoUrl(data.logo_url);
        } else {
          console.warn('[useCompanyLogo] No logo URL in response:', data);
          setLogoUrl(null);
        }
      })
      .catch((error) => {
        console.error('[useCompanyLogo] Exception fetching logo:', error);
        setLogoUrl(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [domain]);

  return { logoUrl, isLoading };
}

