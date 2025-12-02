import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Zap, Linkedin, Twitter } from 'lucide-react';

interface BoostSuccessToastProps {
  isOpen: boolean;
  platform: 'linkedin' | 'twitter';
  onClose: () => void;
}

export function BoostSuccessToast({
  isOpen,
  platform,
  onClose
}: BoostSuccessToastProps) {
  const platformConfig = {
    linkedin: {
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'from-yellow-500 to-orange-500',
      borderColor: 'border-yellow-500/40',
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400',
      textColor: 'text-yellow-300'
    },
    twitter: {
      name: 'Twitter/X',
      icon: Twitter,
      color: 'from-blue-400 to-sky-500',
      borderColor: 'border-blue-500/40',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-300'
    }
  };

  const config = platformConfig[platform];
  const PlatformIcon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -20 }}
            transition={{ type: 'spring', duration: 0.6 }}
            className="relative w-full max-w-md pointer-events-auto"
          >
            {/* Toast Card */}
            <div
              className={`relative rounded-2xl p-6 shadow-2xl border ${config.borderColor}`}
              style={{
                background: 'rgba(17, 24, 39, 0.98)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)'
              }}
            >
              {/* Success Icon */}
              <div className="flex justify-center mb-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
                  className={`relative w-20 h-20 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center shadow-lg`}
                >
                  <CheckCircle className="w-10 h-10 text-white" strokeWidth={2.5} />

                  {/* Sparkle effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [0.5, 0, 0.5]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut'
                    }}
                  >
                    <div className={`w-full h-full rounded-full bg-gradient-to-br ${config.color} opacity-50`} />
                  </motion.div>
                </motion.div>
              </div>

              {/* Title */}
              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold text-white text-center mb-2"
              >
                🎉 Boost Activated!
              </motion.h3>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-gray-300 text-center mb-4"
              >
                You've jumped <span className={`font-bold ${config.textColor}`}>50 spots</span> for sharing on {config.name}!
              </motion.p>

              {/* Points Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className={`mx-auto w-fit px-6 py-3 rounded-full bg-gradient-to-r ${config.color} shadow-lg`}
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-white fill-white" />
                  <span className="text-white font-bold text-lg">+50 Points</span>
                </div>
              </motion.div>

              {/* Auto-dismiss indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-4 text-center"
              >
                <p className="text-xs text-gray-500">
                  Your position will update shortly
                </p>
              </motion.div>
            </div>

            {/* Glow Effect */}
            <motion.div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${config.color} opacity-20 blur-2xl -z-10`}
              animate={{
                scale: [1, 1.1, 1],
                opacity: [0.2, 0.4, 0.2]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut'
              }}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
