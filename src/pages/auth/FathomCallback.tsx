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

        // Call the Edge Function to handle token exchange
        const { data, error: functionError } = await supabase.functions.invoke(
          'fathom-oauth-callback',
          {
            body: { code, state }
          }
        );

        if (functionError) {
          console.error('❌ Edge Function error:', functionError);
          throw new Error(functionError.message || 'Failed to complete OAuth flow');
        }

        console.log('✅ OAuth flow completed successfully');
        setStatus('success');

        // Check if user is still authenticated
        // If session was lost during OAuth flow, redirect to login with message
        // Otherwise redirect to integrations
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            navigate('/auth/login?message=fathom-connected&redirect=/integrations');
          } else {
            navigate('/integrations?fathom=connected');
          }
        }, 2000);

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-600 to-blue-600">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {status === 'processing' && (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white mb-4"></div>
            <h1 className="text-2xl font-bold text-white mb-2">Connecting Fathom...</h1>
            <p className="text-white/80">Please wait while we complete the connection.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-green-500 rounded-full mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Fathom Connected!</h1>
            <p className="text-white/80">Your Fathom account has been successfully connected.</p>
            <p className="text-white/60 text-sm mt-2">Redirecting...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 bg-red-500 rounded-full mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Connection Failed</h1>
            <p className="text-white/80 mb-4">{error}</p>
            <button
              onClick={() => navigate('/integrations')}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Return to Integrations
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
