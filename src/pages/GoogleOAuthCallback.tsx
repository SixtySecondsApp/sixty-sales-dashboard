import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { googleOAuthService } from '../lib/services/googleOAuthService';
import { toast } from 'sonner';

export const GoogleOAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const error = searchParams.get('error');

      if (error) {
        throw new Error(`Authentication failed: ${error}`);
      }

      if (!code) {
        throw new Error('No authorization code received');
      }

      // Get stored callback data
      const callbackData = localStorage.getItem('google_oauth_callback');
      if (!callbackData) {
        throw new Error('No callback data found');
      }

      const { userId, redirectTo } = JSON.parse(callbackData);
      localStorage.removeItem('google_oauth_callback');

      // Exchange code for tokens
      setMessage('Exchanging authorization code...');
      const { tokens, userInfo } = await googleOAuthService.exchangeCodeForTokens(code);

      // Save tokens to database
      setMessage('Saving authentication...');
      await googleOAuthService.saveTokens(userId, userInfo.email, tokens);

      // Success
      setStatus('success');
      setMessage('Google Workspace connected successfully!');
      toast.success('Google Workspace integration connected');

      // Close window or redirect
      setTimeout(() => {
        if (window.opener) {
          window.close();
        } else {
          navigate(redirectTo || '/workflows');
        }
      }, 2000);
    } catch (error) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Authentication failed');
      toast.error('Failed to connect Google Workspace');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg p-8 max-w-md w-full">
        <div className="flex flex-col items-center text-center">
          {status === 'processing' && (
            <>
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Connecting to Google Workspace
              </h2>
              <p className="text-gray-400">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="w-12 h-12 text-green-500 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Successfully Connected!
              </h2>
              <p className="text-gray-400">{message}</p>
              <p className="text-gray-500 text-sm mt-2">
                This window will close automatically...
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="w-12 h-12 text-red-500 mb-4" />
              <h2 className="text-xl font-semibold text-white mb-2">
                Connection Failed
              </h2>
              <p className="text-gray-400 mb-4">{message}</p>
              <button
                onClick={() => window.close()}
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Close Window
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};