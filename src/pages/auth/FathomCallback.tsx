import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';

/**
 * Fathom OAuth Callback Page
 *
 * Handles the OAuth callback from Fathom and forwards to Edge Function
 * Flow: Fathom → This page → Edge Function → Integrations page
 * 
 * Note: This page must be public (no auth required) as Fathom redirects here
 * without an authenticated session. The edge function handles authentication.
 */
export default function FathomCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors from Fathom
        if (errorParam) {
          setError(`OAuth error: ${errorParam} - ${errorDescription || 'Unknown error'}`);
          setStatus('error');

          // Redirect back to integrations after 5 seconds
          setTimeout(() => {
            navigate('/integrations?error=fathom-oauth-failed');
          }, 5000);
          return;
        }

        if (!code || !state) {
          console.error('Fathom OAuth callback missing parameters:', { code: !!code, state: !!state });
          throw new Error('Missing authorization code or state parameter');
        }

        console.log('Fathom OAuth callback received, calling edge function...', { code: code.substring(0, 10) + '...', state });
        
        // Call the Edge Function to handle token exchange
        // Edge function validates state parameter (contains user_id) - doesn't require client auth
        const { data, error: functionError } = await supabase.functions.invoke(
          'fathom-oauth-callback',
          {
            body: { code, state }
          }
        );
        
        if (functionError) {
          console.error('Fathom OAuth edge function error:', functionError);
          throw new Error(functionError.message || `Failed to complete OAuth flow: ${JSON.stringify(functionError)}`);
        }
        
        console.log('Fathom OAuth callback successful:', data);
        setStatus('success');

        // Check if we're in a popup window (multiple detection methods)
        const isPopup = !!(window.opener || window.name === 'Fathom OAuth' || window.outerWidth < 700);
        if (isPopup && window.opener) {
          window.opener.postMessage({
            type: 'fathom-oauth-success',
            integrationId: data.integration_id,
            userId: data.user_id
          }, '*');

          // Close popup after 1 second
          setTimeout(() => {
            window.close();
          }, 1000);
        } else if (isPopup && !window.opener) {
          // Popup but no opener (security restriction) - try to close anyway
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // If not in popup, check session and redirect
          setTimeout(async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
              navigate('/auth/login?message=fathom-connected&redirect=/integrations');
            } else {
              navigate('/integrations?fathom=connected');
            }
          }, 2000);
        }

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
        console.error('Fathom OAuth callback error:', err);
        setError(errorMessage);
        setStatus('error');

        // Redirect back to integrations after 5 seconds
        setTimeout(() => {
          navigate(`/integrations?error=fathom-connection-failed&message=${encodeURIComponent(errorMessage)}`);
        }, 5000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a1a]">
      <div className="bg-[#2a2a2a] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border border-[#00BEFF]/20">
        {status === 'processing' && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-[#1a1a1a] px-4 py-3 rounded-lg mb-6">
              <span className="text-white font-bold text-2xl tracking-wide">FATHOM</span>
              <svg className="w-8 h-8 animate-pulse" viewBox="0 0 24 24" fill="none">
                <path d="M4 16C4 14 4 12 6 10C8 8 10 8 12 6C14 4 16 4 18 6C20 8 20 10 20 12" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 20C4 18 4 16 6 14C8 12 10 12 12 10C14 8 16 8 18 10C20 12 20 14 20 16" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Connecting to Fathom</h1>
            <p className="text-gray-400">Please wait while we complete the connection.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-[#1a1a1a] px-4 py-3 rounded-lg mb-6">
              <span className="text-white font-bold text-2xl tracking-wide">FATHOM</span>
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                <path d="M4 16C4 14 4 12 6 10C8 8 10 8 12 6C14 4 16 4 18 6C20 8 20 10 20 12" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 20C4 18 4 16 6 14C8 12 10 12 12 10C14 8 16 8 18 10C20 12 20 14 20 16" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-500 rounded-full mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Successfully Connected!</h1>
            <p className="text-gray-400">Your Fathom account has been successfully connected.</p>
            <p className="text-[#00BEFF] text-sm mt-2">Redirecting...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="inline-flex items-center space-x-2 bg-[#1a1a1a] px-4 py-3 rounded-lg mb-6">
              <span className="text-white font-bold text-2xl tracking-wide">FATHOM</span>
              <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none">
                <path d="M4 16C4 14 4 12 6 10C8 8 10 8 12 6C14 4 16 4 18 6C20 8 20 10 20 12" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M4 20C4 18 4 16 6 14C8 12 10 12 12 10C14 8 16 8 18 10C20 12 20 14 20 16" stroke="#00BEFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 border-2 border-red-500 rounded-lg mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Connection Failed</h1>
            <p className="text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => navigate('/integrations')}
              className="bg-[#00BEFF] hover:bg-[#00BEFF]/80 text-white px-6 py-2 rounded-lg transition-colors font-medium"
            >
              Return to Integrations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
