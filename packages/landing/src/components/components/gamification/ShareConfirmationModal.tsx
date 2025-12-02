import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, Linkedin, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShareConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  platform: 'linkedin' | 'twitter';
  pointsBoost: number;
}

export function ShareConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  platform,
  pointsBoost
}: ShareConfirmationModalProps) {
  const platformConfig = {
    linkedin: {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'from-yellow-500 to-orange-500',
      iconBg: 'bg-yellow-500',
      iconColor: 'text-yellow-400'
    },
    twitter: {
      name: 'Twitter/X',
      icon: Twitter,
      color: 'from-blue-400 to-sky-500',
      iconBg: 'bg-blue-500',
      iconColor: 'text-blue-400'
    }
  };

  const config = platformConfig[platform];
  const PlatformIcon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative w-full max-w-md"
            >
              {/* Card */}
              <div
                className="relative rounded-2xl p-6 shadow-2xl"
                style={{
                  background: 'rgba(17, 24, 39, 0.95)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  border: '1px solid rgba(55, 65, 81, 0.5)'
                }}
              >
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                    className={`w-16 h-16 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}
                  >
                    <PlatformIcon className="w-8 h-8 text-white" />
                  </motion.div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-white text-center mb-2">
                  Did you complete your {config.name} share?
                </h3>

                {/* Description */}
                <p className="text-gray-300 text-center mb-6">
                  Click <span className="font-semibold text-emerald-400">Confirm</span> if you posted to {config.name} to receive your{' '}
                  <span className={`font-bold bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
                    {pointsBoost}-point boost
                  </span>!
                </p>

                {/* Boost Preview */}
                <div className={`bg-gradient-to-r ${config.color} bg-opacity-10 border border-opacity-30 rounded-lg p-4 mb-6`}
                  style={{
                    borderColor: platform === 'linkedin' ? 'rgba(251, 146, 60, 0.3)' : 'rgba(96, 165, 250, 0.3)'
                  }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${config.iconColor}`} />
                    <span className="text-white font-semibold">
                      Jump {pointsBoost} spots instantly!
                    </span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 h-12 border-white/10 hover:bg-white/5 text-gray-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={onConfirm}
                    className={`flex-1 h-12 bg-gradient-to-r ${config.color} hover:opacity-90 text-white font-semibold shadow-lg`}
                  >
                    Confirm Share
                  </Button>
                </div>

                {/* Fine Print */}
                <p className="text-xs text-gray-500 text-center mt-4">
                  Only click confirm if you actually posted to {config.name}
                </p>
              </div>

              {/* Glow Effect */}
              <motion.div
                className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${config.color} opacity-20 blur-xl -z-10`}
                animate={{
                  scale: [1, 1.05, 1],
                  opacity: [0.2, 0.3, 0.2]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
