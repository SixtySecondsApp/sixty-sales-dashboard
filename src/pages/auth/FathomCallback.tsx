import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';

/**
 * Fathom OAuth Callback Page
 *
 * Handles the OAuth callback from Fathom and forwards to Edge Function
 * Flow: Fathom → This page → Edge Function → Integrations page
 */
export default function FathomCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('🚀 FathomCallback component mounted!');
    console.log('📍 Current URL:', window.location.href);
    console.log('🔑 Search params:', Object.fromEntries(searchParams));

    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors from Fathom
        if (errorParam) {
          console.error('❌ OAuth error from Fathom:', errorParam, errorDescription);
          setError(`OAuth error: ${errorParam} - ${errorDescription || 'Unknown error'}`);
          setStatus('error');

          // Redirect back to integrations after 5 seconds
          setTimeout(() => {
            navigate('/integrations?error=fathom-oauth-failed');
          }, 5000);
          return;
        }

        if (!code || !state) {
          throw new Error('Missing authorization code or state parameter');
        }

        console.log('🔐 Received OAuth callback, forwarding to Edge Function');
        console.log('📤 Sending to Edge Function:', { code: code.substring(0, 10) + '...', state });

        // Call the Edge Function to handle token exchange
        const { data, error: functionError } = await supabase.functions.invoke(
          'fathom-oauth-callback',
          {
            body: { code, state }
          }
        );

        console.log('📥 Edge Function response:', { data, error: functionError });

        if (functionError) {
          console.error('❌ Edge Function error:', functionError);
          throw new Error(functionError.message || 'Failed to complete OAuth flow');
        }

        console.log('✅ OAuth flow completed successfully', data);
        console.log('🔍 Checking popup status:', {
          hasOpener: !!window.opener,
          windowName: window.name,
          outerWidth: window.outerWidth
        });
        setStatus('success');

        // Check if we're in a popup window (multiple detection methods)
        const isPopup = !!(window.opener || window.name === 'Fathom OAuth' || window.outerWidth < 700);

        console.log('📊 Is popup?', isPopup);

        if (isPopup && window.opener) {
          console.log('📤 Sending success message to parent window');
          window.opener.postMessage({
            type: 'fathom-oauth-success',
            integrationId: data.integration_id,
            userId: data.user_id
          }, '*');

          // Close popup after 1 second
          setTimeout(() => {
            console.log('🚪 Closing popup window');
            window.close();
          }, 1000);
        } else if (isPopup && !window.opener) {
          // Popup but no opener (security restriction) - try to close anyway
          console.log('⚠️  Popup detected but no window.opener - attempting to close');
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // If not in popup, check session and redirect
          console.log('🔄 Not in popup, redirecting...');
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
        console.error('❌ OAuth callback error:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        setStatus('error');

        // Redirect back to integrations after 5 seconds
        setTimeout(() => {
          navigate('/integrations?error=fathom-connection-failed');
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
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00BEFF] rounded-lg mb-6">
              <svg className="w-8 h-8 text-white animate-pulse" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 18c.55 0 1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1v10c0 .55.45 1 1 1z"/>
                <path d="M9 18c.55 0 1-.45 1-1V11c0-.55-.45-1-1-1s-1 .45-1 1v6c0 .55.45 1 1 1z"/>
                <path d="M14 18c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1s-1 .45-1 1v8c0 .55.45 1 1 1z"/>
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Connecting to Fathom</h1>
            <p className="text-gray-400">Please wait while we complete the connection.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#00BEFF] rounded-lg mb-6">
              <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 18c.55 0 1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1v10c0 .55.45 1 1 1z"/>
                <path d="M9 18c.55 0 1-.45 1-1V11c0-.55-.45-1-1-1s-1 .45-1 1v6c0 .55.45 1 1 1z"/>
                <path d="M14 18c.55 0 1-.45 1-1V9c0-.55-.45-1-1-1s-1 .45-1 1v8c0 .55.45 1 1 1z"/>
              </svg>
              <div className="absolute">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Successfully Connected!</h1>
            <p className="text-gray-400">Your Fathom account has been successfully connected.</p>
            <p className="text-[#00BEFF] text-sm mt-2">Redirecting...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 border-2 border-red-500 rounded-lg mb-6">
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
