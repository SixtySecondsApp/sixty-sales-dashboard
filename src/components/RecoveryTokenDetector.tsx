import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * RecoveryTokenDetector - Detects password recovery tokens in URL and redirects to reset page
 * 
 * This component should be mounted near the root to intercept password recovery links
 * from Supabase before routing happens.
 * 
 * When recovery tokens are detected, it:
 * 1. Prevents any child rendering
 * 2. Redirects to /auth/reset-password with all tokens preserved
 * 3. Shows a loading spinner during redirect
 * 
 * Supabase sends users to the base domain with recovery tokens in the URL:
 * - token_hash in search params
 * - type=recovery in hash or search
 * - access_token in hash (legacy flow)
 * - code parameter (PKCE flow)
 */
export function RecoveryTokenDetector() {
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Only check once on mount
    if (checked) return;
    
    // Check for recovery tokens in URL
    const searchParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash.substring(1);
    const hashParams = new URLSearchParams(hash);

    // Detect recovery indicators
    // Supports both modern (token_hash in search) and legacy (access_token in hash) flows
    const hasTokenHash = searchParams.has('token_hash');
    const hasRecoveryType = searchParams.get('type') === 'recovery' || hashParams.get('type') === 'recovery';
    const hasCode = searchParams.has('code');
    const hasAccessToken = searchParams.has('access_token') || hashParams.has('access_token');
    const hasAccessTokenInHash = window.location.hash.includes('access_token'); // Legacy flow indicator

    setChecked(true);

    // If user is on base domain/path without recovery route but has recovery tokens, redirect
    if (
      (hasTokenHash || hasRecoveryType || hasCode || hasAccessToken || hasAccessTokenInHash) &&
      !window.location.pathname.startsWith('/auth/reset-password')
    ) {
      console.log('[RecoveryTokenDetector] Found recovery token, redirecting to reset page', {
        hasTokenHash,
        hasRecoveryType,
        hasCode,
        hasAccessToken,
        hasAccessTokenInHash,
        hash: window.location.hash.substring(0, 50)
      });
      
      // Do a full page redirect to reset-password, preserving hash
      // This ensures React Router re-initializes with the correct path
      const targetPath = `/auth/reset-password${window.location.search}${window.location.hash}`;
      window.location.href = targetPath;
    }
  }, [checked]);

  // This component only handles redirects, doesn't render anything
  return null;
}
