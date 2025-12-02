/**
 * WaitlistCallback Page
 * Handles magic link authentication and waitlist-to-user linking
 */

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase/clientV2';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function WaitlistCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your invitation...');

  useEffect(() => {
    handleMagicLink();
  }, []);

  const handleMagicLink = async () => {
    try {
      // Get waitlist entry ID from URL params
      const waitlistEntryId = searchParams.get('waitlist_entry');

      if (waitlistEntryId) {
        // Store in localStorage for signup flow
        localStorage.setItem('waitlist_entry_id', waitlistEntryId);
      }

      // Check if user is already authenticated (clicked magic link)
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (session) {
        // User is authenticated - the database trigger will handle linking
        setStatus('success');
        setMessage('Welcome! Redirecting to your dashboard...');

        // Wait a moment then redirect
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else {
        // User not authenticated - redirect to signup
        setStatus('success');
        setMessage('Please complete your account setup...');

        // Get email from waitlist entry if available
        if (waitlistEntryId) {
          try {
            const { data: entry, error: entryError } = await supabase
              .from('meetings_waitlist')
              .select('email, full_name')
              .eq('id', waitlistEntryId)
              .single();

            if (!entryError && entry) {
              // Store email for pre-filling signup form
              localStorage.setItem('waitlist_email', entry.email);
              if (entry.full_name) {
                localStorage.setItem('waitlist_name', entry.full_name);
              }
            }
          } catch (err) {
            console.error('Error fetching waitlist entry:', err);
          }
        }

        setTimeout(() => {
          navigate('/signup', { replace: true });
        }, 1500);
      }
    } catch (error: any) {
      console.error('Waitlist callback error:', error);
      setStatus('error');
      setMessage(error.message || 'Failed to process your invitation. Please try again.');

      // Redirect to signup after error
      setTimeout(() => {
        navigate('/signup', { replace: true });
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 border border-gray-200 dark:border-gray-800">
          {/* Status Icon */}
          <div className="flex justify-center mb-6">
            {status === 'loading' && (
              <div className="p-4 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                <Loader2 className="w-12 h-12 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
            {status === 'success' && (
              <div className="p-4 bg-green-100 dark:bg-green-900/20 rounded-full">
                <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
              </div>
            )}
            {status === 'error' && (
              <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full">
                <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400" />
              </div>
            )}
          </div>

          {/* Status Message */}
          <div className="text-center">
            <h1
              className={`text-2xl font-bold mb-2 ${
                status === 'error'
                  ? 'text-red-900 dark:text-red-200'
                  : 'text-gray-900 dark:text-white'
              }`}
            >
              {status === 'loading' && 'Processing Invitation'}
              {status === 'success' && 'Success!'}
              {status === 'error' && 'Something Went Wrong'}
            </h1>
            <p
              className={`text-sm ${
                status === 'error'
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {message}
            </p>
          </div>

          {/* Loading Spinner for Success */}
          {status === 'success' && (
            <div className="flex justify-center mt-6">
              <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
          )}

          {/* Error Actions */}
          {status === 'error' && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={() => navigate('/signup')}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors"
              >
                Go to Signup
              </button>
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
