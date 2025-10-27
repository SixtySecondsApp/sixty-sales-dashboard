import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GoogleCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Google authentication...');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Ensure auth session is available before calling Edge Function
        let sessionAvailable = false;
        for (let attempt = 0; attempt < 10; attempt++) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            sessionAvailable = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 200));
        }

        if (!sessionAvailable) {
          setStatus('error');
          setMessage('Authentication required. Please sign in and try again.');
          setTimeout(() => {
            navigate('/auth/login?next=/integrations');
          }, 1500);
          return;
        }

        // Get the authorization code and state from URL
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Check for OAuth errors from Google
        if (error) {
          console.error('OAuth error from Google:', error, errorDescription);
          setStatus('error');
          setMessage(errorDescription || error || 'Authentication failed');
          
          // Redirect with error
          setTimeout(() => {
            navigate(`/integrations?error=${error}&error_description=${encodeURIComponent(errorDescription || '')}`);
          }, 2000);
          return;
        }

        // Validate we have required parameters
        if (!code || !state) {
          console.error('Missing code or state parameter');
          setStatus('error');
          setMessage('Invalid authentication response');
          
          setTimeout(() => {
            navigate('/integrations?error=invalid_response');
          }, 2000);
          return;
        }

        console.log('Processing OAuth callback with code and state');
        setMessage('Exchanging authorization code...');

        // Call the Edge Function to exchange the code for tokens
        // This is an authenticated call - the user must be logged in
        const { data, error: exchangeError } = await supabase.functions.invoke('google-oauth-exchange', {
          body: { code, state }
        });

        if (exchangeError) {
          // Try to surface deeper context if provided by supabase-js
          // @ts-expect-error context may exist on the error
          const context = (exchangeError as any)?.context;
          console.error('Exchange error:', exchangeError, context);
          setStatus('error');
          setMessage(
            (context && (context.error || context.message)) ||
            exchangeError.message ||
            'Failed to complete authentication'
          );
          
          setTimeout(() => {
            navigate(`/integrations?error=exchange_failed&error_description=${encodeURIComponent(exchangeError.message || '')}`);
          }, 2000);
          return;
        }

        if (!data || !data.success) {
          console.error('Exchange failed:', data);
          setStatus('error');
          setMessage(data?.error || 'Failed to complete authentication');
          
          setTimeout(() => {
            navigate(`/integrations?error=exchange_failed&error_description=${encodeURIComponent(data?.error || 'Unknown error')}`);
          }, 2000);
          return;
        }

        // Success!
        console.log('OAuth exchange successful:', data);
        setStatus('success');
        setMessage(`Successfully connected to Google as ${data.email}!`);
        toast.success('Google account connected successfully');
        
        // Redirect to integrations page with success message
        setTimeout(() => {
          navigate(`/integrations?status=connected&email=${encodeURIComponent(data.email || '')}`);
        }, 1500);

      } catch (error: any) {
        console.error('Unexpected error in OAuth callback:', error);
        setStatus('error');
        setMessage(error.message || 'An unexpected error occurred');
        
        setTimeout(() => {
          navigate(`/integrations?error=unexpected&error_description=${encodeURIComponent(error.message || '')}`);
        }, 2000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full mx-4">
        <div className="flex flex-col items-center space-y-4">
          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 animate-spin text-emerald-500" />
              <h2 className="text-xl font-semibold text-white">Connecting to Google</h2>
            </>
          )}
          
          {status === 'success' && (
            <>
              <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Success!</h2>
            </>
          )}
          
          {status === 'error' && (
            <>
              <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold text-white">Connection Failed</h2>
            </>
          )}
          
          <p className="text-gray-400 text-center">{message}</p>
          
          {status !== 'processing' && (
            <p className="text-sm text-gray-500">Redirecting...</p>
          )}
        </div>
      </div>
    </div>
  );
}