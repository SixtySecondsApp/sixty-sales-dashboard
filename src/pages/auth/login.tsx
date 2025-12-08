import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/contexts/AuthContext';
import { toast } from 'sonner';
import { Mail, Lock, ArrowRight, KeyRound, ArrowLeft } from 'lucide-react';

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [needsVerification, setNeedsVerification] = useState(false);
  const navigate = useNavigate();
  const { signIn, verifySecondFactor } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(formData.email, formData.password);

      if (error) {
        // Check if this error requires verification
        if (error.requiresVerification) {
          setNeedsVerification(true);
          toast.info('Please check your email for a verification code');
        } else {
          toast.error(error.message);
        }
      } else {
        // Success is handled by AuthContext
        navigate('/');
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await verifySecondFactor(verificationCode);

      if (error) {
        toast.error(error.message);
      } else {
        // Success - navigate to home
        navigate('/');
      }
    } catch (error: any) {
      toast.error('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setNeedsVerification(false);
    setVerificationCode('');
  };

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

          {!needsVerification ? (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2 text-white">Welcome back</h1>
                <p className="text-gray-400">Sign in to your account to continue</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50"
                      placeholder="sarah@example.com"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-medium text-gray-400">
                      Password
                    </label>
                    <Link
                      to="/auth/forgot-password"
                      className="text-xs text-[#37bd7e] hover:text-[#2da76c] font-medium transition-colors"
                    >
                      Forgot Password?
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      required
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50"
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
                  {isLoading ? 'Signing in...' : 'Sign in'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/auth/signup"
                  className="text-[#37bd7e] hover:text-[#2da76c] text-sm font-medium inline-flex items-center gap-1 transition-all duration-300 hover:gap-2"
                >
                  Create an account
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </>
          ) : (
            <>
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2 text-white">Enter Verification Code</h1>
                <p className="text-gray-400">
                  We've sent a verification code to<br />
                  <span className="text-white font-medium">{formData.email}</span>
                </p>
              </div>

              <form onSubmit={handleVerifyCode} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-400">
                    Verification Code
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      required
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full bg-gray-800/30 border border-gray-700/30 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-colors hover:bg-gray-800/50 text-center text-lg tracking-widest"
                      placeholder="000000"
                      disabled={isLoading}
                      maxLength={6}
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    Enter the 6-digit code from your email
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || verificationCode.length !== 6}
                  className="w-full bg-[#37bd7e] text-white py-2.5 rounded-xl font-medium hover:bg-[#2da76c] focus:outline-none focus:ring-2 focus:ring-[#37bd7e] focus:ring-offset-2 focus:ring-offset-gray-900 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#37bd7e]/20"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={handleBackToLogin}
                  className="text-[#37bd7e] hover:text-[#2da76c] text-sm font-medium inline-flex items-center gap-1 transition-all duration-300 hover:gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to login
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}