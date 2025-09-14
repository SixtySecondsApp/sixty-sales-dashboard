import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import logger from '@/lib/utils/logger';

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [isValidRecovery, setIsValidRecovery] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [debugInfo, setDebugInfo] = useState('');
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { updatePassword } = useAuth();

  // Check if this is a valid password recovery session
  useEffect(() => {
    const checkRecoverySession = async () => {
      try {
        const currentUrl = window.location.href;
        const hash = window.location.hash;
        const search = window.location.search;
        
        logger.log('=== RECOVERY SESSION DEBUG ===');
        logger.log('Current URL:', currentUrl);
        logger.log('Hash params:', hash);
        logger.log('Search params:', search);
        
        setDebugInfo(`URL: ${currentUrl}\nHash: ${hash}\nSearch: ${search}`);
        
        // Check for both hash and search parameters (different auth flows)
        const hashParams = new URLSearchParams(hash.substring(1));
        const searchParams = new URLSearchParams(search);
        
        const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
        const type = hashParams.get('type') || searchParams.get('type');
        const tokenHash = searchParams.get('token_hash');
        
        const debugParams = { 
          accessToken: !!accessToken, 
          refreshToken: !!refreshToken, 
          type, 
          tokenHash: !!tokenHash 
        };
        
        logger.log('Parsed parameters:', debugParams);
        setDebugInfo(prev => prev + '\nParsed: ' + JSON.stringify(debugParams));
        
        // Handle modern Supabase recovery flow with token_hash
        if (type === 'recovery' && tokenHash) {
          logger.log('✅ Modern recovery flow detected with token_hash');
          setDebugInfo(prev => prev + '\n✅ Modern recovery flow detected');
          
          // For recovery links, we just need to verify the token exists
          // We DON'T want to establish the session yet - that happens when password is reset
          logger.log('✅ Valid recovery token detected, showing password reset form');
          setDebugInfo(prev => prev + '\n✅ Valid recovery token, showing form');
          setIsValidRecovery(true);
        }
        // Handle legacy recovery flow with access_token
        else if (type === 'recovery' && accessToken) {
          logger.log('✅ Legacy recovery flow detected with access_token');
          setDebugInfo(prev => prev + '\n✅ Legacy recovery flow detected');
          
          // Set the session manually for legacy flow
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });
          
          logger.log('Legacy recovery session:', { session: !!session, error });
          
          if (error || !session) {
            logger.error('❌ Legacy recovery error:', error);
            setDebugInfo(prev => prev + '\n❌ Legacy session failed');
            toast.error('Your reset link has expired. Please request a new one.');
            setIsCheckingSession(false);
            return;
          }
          
          setIsValidRecovery(true);
          setDebugInfo(prev => prev + '\n✅ Legacy session established');
        } else {
          logger.log('❌ No valid recovery parameters found');
          setDebugInfo(prev => prev + '\n❌ No valid parameters found');
          toast.error('Invalid password reset link');
        }
        
        setIsCheckingSession(false);
      } catch (error) {
        logger.error('❌ Recovery check error:', error);
        setDebugInfo(prev => prev + '\n❌ Exception: ' + (error as Error).message);
        toast.error('Your reset link has expired. Please request a new one.');
        navigate('/auth/forgot-password');
        setIsCheckingSession(false);
      }
    };

    checkRecoverySession();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);

    try {
      // Get the token_hash from URL for verification during password update
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const tokenHash = searchParams.get('token_hash');
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      
      logger.log('Password update attempt:', { tokenHash: !!tokenHash, accessToken: !!accessToken });

      // If we have a token_hash, verify the OTP first to establish the session
      if (tokenHash) {
        logger.log('Verifying recovery token before password update...');
        
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: 'recovery'
        });

        if (verifyError) {
          logger.error('Token verification failed:', verifyError);
          toast.error('Your reset link has expired. Please request a new one.');
          navigate('/auth/forgot-password');
          return;
        }

        if (!data?.session) {
          logger.error('No session established during verification');
          toast.error('Failed to establish session. Please try again.');
          return;
        }

        logger.log('✅ Recovery session established, updating password...');
      }

      // Now update the password
      const { error } = await supabase.auth.updateUser({
        password: formData.password
      });

      if (error) {
        logger.error('Password update error:', error);
        toast.error(error.message || 'Failed to update password. Please try again.');
      } else {
        toast.success('Password updated successfully! Redirecting to dashboard...');
        // After successful password update, user should already be authenticated
        // Wait a moment for the auth state to update, then redirect to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      }
    } catch (error: any) {
      logger.error('Password update error:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while checking recovery session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center w-full max-w-2xl"
        >
          <div className="w-8 h-8 border-2 border-[#37bd7e] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400 mb-4">Verifying password reset link...</p>
          {debugInfo && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 mt-4 text-left">
              <h3 className="text-white font-medium mb-2">Debug Information:</h3>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-800/50 p-3 rounded overflow-auto max-h-96">
                {debugInfo}
              </pre>
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  // Show debug information if recovery session is invalid
  if (!isValidRecovery) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center w-full max-w-2xl"
        >
          <h2 className="text-2xl font-bold text-white mb-4">Password Reset Debug</h2>
          <p className="text-gray-400 mb-6">Analyzing the password reset link...</p>
          
          {debugInfo && (
            <div className="bg-gray-900/80 border border-gray-700 rounded-xl p-4 mb-6 text-left">
              <h3 className="text-white font-medium mb-2">Debug Information:</h3>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono bg-gray-800/50 p-3 rounded overflow-auto max-h-96">
                {debugInfo}
              </pre>
            </div>
          )}
          
          <div className="space-y-4">
            <button 
              onClick={() => setIsValidRecovery(true)}
              className="bg-[#37bd7e] text-white px-6 py-2 rounded-xl font-medium hover:bg-[#2da76c] transition-colors"
            >
              Force Show Password Reset Form
            </button>
            
            <div>
              <button 
                onClick={() => navigate('/auth/forgot-password')}
                className="bg-gray-700 text-white px-6 py-2 rounded-xl font-medium hover:bg-gray-600 transition-colors"
              >
                Request New Reset Link
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="relative bg-gray-900/50 backdrop-blur-xl rounded-2xl border border-gray-800/50 p-6 sm:p-8 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900/90 via-gray-900/70 to-gray-900/30 rounded-2xl -z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.15),transparent)] rounded-2xl -z-10" />
          <div className="absolute -right-20 -top-20 w-40 h-40 bg-[#37bd7e]/10 blur-3xl rounded-full" />

          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-white">Set New Password</h1>
            <p className="text-gray-400">Create a new password for your account</p>
            {debugInfo && (
              <details className="mt-4 text-left">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-200">
                  Show Debug Info
                </summary>
                <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono bg-gray-800/30 p-3 rounded mt-2 max-h-40 overflow-auto">
                  {debugInfo}
                </pre>
              </details>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors hover:bg-gray-600"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-400">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors hover:bg-gray-600"
                  placeholder="••••••••"
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#37bd7e] text-white py-2.5 rounded-xl font-medium hover:bg-[#2da76c] focus:outline-none focus:ring-2 focus:ring-[#37bd7e] focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#37bd7e]/20"
            >
              {isLoading ? 'Updating Password...' : 'Update Password'}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
} 