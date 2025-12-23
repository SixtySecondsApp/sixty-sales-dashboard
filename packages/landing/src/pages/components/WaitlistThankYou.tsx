import { motion } from 'framer-motion';
import { Check, Mail, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WaitlistThankYouProps {
  email: string;
  fullName: string;
  onClose?: () => void;
}

export function WaitlistThankYou({ email, fullName, onClose }: WaitlistThankYouProps) {
  const firstName = fullName.split(' ')[0];

  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden bg-white dark:bg-gray-950 transition-colors duration-300">
      {/* Subtle Background Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-emerald-500/5 dark:bg-emerald-900/10 blur-[100px] rounded-full pointer-events-none -z-10" />

      {/* Content */}
      <div className="relative z-10 max-w-lg w-full mx-auto px-4 md:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative backdrop-blur-xl bg-white/95 dark:bg-gray-900/95 border border-gray-200 dark:border-gray-800 rounded-2xl p-5 sm:p-10 shadow-xl text-center"
        >
          {/* Close Button */}
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          )}

          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/30"
          >
            <Check className="w-10 h-10 text-white" strokeWidth={3} />
          </motion.div>

          {/* Thank You Message */}
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-gray-900 dark:text-white mb-3"
          >
            Thank You, {firstName}!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg text-gray-600 dark:text-gray-300 mb-6"
          >
            You've successfully joined the waitlist.
          </motion.p>

          {/* Email Notification Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-8"
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-lg font-semibold text-blue-900 dark:text-blue-100">Check Your Email</span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              We've sent a confirmation email to:
            </p>
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mt-1">
              {email}
            </p>
          </motion.div>

          {/* What's Next */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="text-left space-y-3 mb-8"
          >
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">What happens next?</h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>We'll keep you updated on our progress</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>You'll be among the first to get early access</span>
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span>Exclusive 50% lifetime discount when we launch</span>
              </li>
            </ul>
          </motion.div>

          {/* Close Button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Button
              onClick={onClose || (() => window.location.href = '/')}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold h-12"
            >
              <span className="text-white">Got It!</span>
            </Button>
          </motion.div>

          {/* Footer Note */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-xs text-gray-500 dark:text-gray-500 mt-4"
          >
            Didn't receive the email? Check your spam folder or contact support.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
