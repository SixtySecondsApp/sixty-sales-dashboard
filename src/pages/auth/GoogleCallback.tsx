import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { googleAuthService } from '@/lib/services/googleAuthService';
import { gmailService } from '@/lib/services/gmailService';
import { googleCalendarService } from '@/lib/services/googleCalendarService';
import { toast } from 'sonner';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import logger from '@/lib/utils/logger';

export default function GoogleCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing Google authorization...');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setMessage(`Authorization failed: ${error}`);
        toast.error('Google authorization failed');
        setTimeout(() => navigate('/integrations'), 3000);
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('No authorization code received');
        toast.error('Invalid callback - no authorization code');
        setTimeout(() => navigate('/integrations'), 3000);
        return;
      }

      try {
        // Exchange code for tokens
        setMessage('Exchanging authorization code...');
        const success = await googleAuthService.exchangeCodeForTokens(code);
        
        if (!success) {
          throw new Error('Failed to exchange code for tokens');
        }

        // Sync Gmail
        setMessage('Syncing Gmail...');
        const emailCount = await gmailService.syncEmails();
        logger.log(`Synced ${emailCount} emails`);

        // Sync Calendar
        setMessage('Syncing Google Calendar...');
        const eventCount = await googleCalendarService.syncCalendar();
        logger.log(`Synced ${eventCount} calendar events`);

        setStatus('success');
        setMessage('Google account connected successfully!');
        toast.success(`Connected! Synced ${emailCount} emails and ${eventCount} calendar events`);
        
        // Redirect to email or calendar page
        setTimeout(() => {
          const returnTo = localStorage.getItem('google_oauth_return') || '/email';
          localStorage.removeItem('google_oauth_return');
          navigate(returnTo);
        }, 2000);
      } catch (error) {
        logger.error('OAuth callback error:', error);
        setStatus('error');
        setMessage('Failed to connect Google account');
        toast.error('Connection failed. Please try again.');
        setTimeout(() => navigate('/integrations'), 3000);
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-900/50 backdrop-blur-md rounded-xl border border-gray-800 p-8">
          <div className="flex flex-col items-center space-y-6">
            {/* Status Icon */}
            <div className="relative">
              {status === 'processing' && (
                <Loader2 className="h-16 w-16 text-blue-500 animate-spin" />
              )}
              {status === 'success' && (
                <CheckCircle className="h-16 w-16 text-green-500 animate-pulse" />
              )}
              {status === 'error' && (
                <XCircle className="h-16 w-16 text-red-500" />
              )}
            </div>

            {/* Status Message */}
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-white">
                {status === 'processing' && 'Connecting to Google'}
                {status === 'success' && 'Connected Successfully!'}
                {status === 'error' && 'Connection Failed'}
              </h2>
              <p className="text-gray-400">{message}</p>
            </div>

            {/* Progress Indicator */}
            {status === 'processing' && (
              <div className="w-full bg-gray-800 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{ width: '75%' }} />
              </div>
            )}

            {/* Additional Info */}
            {status === 'success' && (
              <div className="text-center text-sm text-gray-500">
                <p>Redirecting you to your dashboard...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center text-sm text-gray-500">
                <p>Redirecting you back...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}