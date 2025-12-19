/**
 * PasswordSetupModal
 *
 * Full-screen modal that prompts magic link users to set their password.
 * Cannot be dismissed - password setup is mandatory.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, CheckCircle, Loader2, Mail, Sparkles } from 'lucide-react';

interface PasswordSetupModalProps {
  isOpen: boolean;
  userEmail: string | null;
  onComplete: (password: string) => Promise<boolean>;
}

export function PasswordSetupModal({ isOpen, userEmail, onComplete }: PasswordSetupModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const success = await onComplete(password);

      if (success) {
        setShowSuccess(true);
        // Brief success animation before modal closes
        setTimeout(() => {
          setShowSuccess(false);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to set password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center"
      >
        {/* Backdrop - no click to dismiss */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(74,74,117,0.25),transparent)] pointer-events-none" />
        </div>

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
          className="relative w-full max-w-md mx-4"
        >
          <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl">
            {showSuccess ? (
              // Success State
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', bounce: 0.5, delay: 0.1 }}
                  className="inline-flex items-center justify-center w-20 h-20 bg-[#37bd7e]/20 rounded-full mb-6"
                >
                  <CheckCircle className="w-10 h-10 text-[#37bd7e]" />
                </motion.div>
                <h2 className="text-2xl font-bold text-white mb-2">You're all set!</h2>
                <p className="text-gray-400">Redirecting to your dashboard...</p>
              </motion.div>
            ) : (
              // Form State
              <>
                {/* Welcome Header */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-[#37bd7e]/20 rounded-full mb-4">
                    <Sparkles className="w-8 h-8 text-[#37bd7e]" />
                  </div>
                  <h1 className="text-3xl font-bold text-white mb-2">Welcome to Early Access!</h1>
                  <p className="text-gray-400">
                    {userEmail ? `Signed in as ${userEmail}` : 'Set your password to get started'}
                  </p>
                </div>

                {/* Password Setup Form */}
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Error Message */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3 bg-red-900/20 border border-red-800/50 rounded-lg"
                    >
                      <p className="text-sm text-red-400">{error}</p>
                    </motion.div>
                  )}

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                      Set Your Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter password (min 6 characters)"
                        className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-all"
                        required
                        minLength={6}
                        disabled={isLoading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm your password"
                        className="w-full pl-10 pr-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#37bd7e] focus:border-transparent transition-all"
                        required
                        minLength={6}
                        disabled={isLoading}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !password || !confirmPassword}
                    className="w-full bg-[#37bd7e] hover:bg-[#2da76c] disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Setting up your account...
                      </>
                    ) : (
                      'Complete Setup & Go to Dashboard'
                    )}
                  </button>
                </form>

                {/* Info Message */}
                <div className="mt-6 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Mail className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-gray-400">
                      <p className="font-medium text-gray-300 mb-1">Your account is ready!</p>
                      <p>Once you set your password, you'll have full access to the dashboard and all Early Access features.</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
