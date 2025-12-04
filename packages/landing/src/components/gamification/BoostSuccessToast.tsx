import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Zap, Linkedin, Twitter, X } from 'lucide-react';

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
      borderColor: 'border-yellow-500/50',
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400',
      textColor: 'text-yellow-300',
      glowColor: 'rgba(234, 179, 8, 0.3)'
    },
    twitter: {
      name: 'Twitter/X',
      icon: Twitter,
      color: 'from-blue-400 to-sky-500',
      borderColor: 'border-blue-500/50',
      iconBg: 'bg-blue-500/20',
      iconColor: 'text-blue-400',
      textColor: 'text-blue-300',
      glowColor: 'rgba(59, 130, 246, 0.3)'
    }
  };

  const config = platformConfig[platform];
  const PlatformIcon = config.icon;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
            onClick={onClose}
          />

          {/* Centered Modal */}
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: -20 }}
              transition={{ 
                type: 'spring', 
                duration: 0.5,
                bounce: 0.3
              }}
              className="relative w-full max-w-lg pointer-events-auto"
            >
              {/* Outer Glow */}
              <motion.div
                className="absolute inset-0 rounded-3xl blur-3xl opacity-50"
                style={{
                  background: `radial-gradient(circle, ${config.glowColor}, transparent 70%)`
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.5, 0.7, 0.5]
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut'
                }}
              />

              {/* Main Card */}
              <div
                className={`relative rounded-3xl p-8 shadow-2xl border-2 ${config.borderColor}`}
                style={{
                  background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(31, 41, 55, 0.95) 100%)',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  boxShadow: `0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px ${config.glowColor}`
                }}
              >
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700/50 flex items-center justify-center transition-colors group"
                >
                  <X className="w-4 h-4 text-gray-400 group-hover:text-gray-200" />
                </button>

                {/* Success Icon */}
                <div className="flex justify-center mb-6">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200, damping: 15 }}
                    className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${config.color} flex items-center justify-center shadow-2xl`}
                  >
                    <CheckCircle className="w-12 h-12 text-white" strokeWidth={2.5} />

                    {/* Pulsing Ring */}
                    <motion.div
                      className={`absolute inset-0 rounded-full border-2 ${config.borderColor}`}
                      animate={{
                        scale: [1, 1.3, 1],
                        opacity: [0.8, 0, 0.8]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeInOut'
                      }}
                    />

                    {/* Sparkle Particles */}
                    {[...Array(6)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-2 h-2 bg-white rounded-full"
                        style={{
                          top: '50%',
                          left: '50%',
                          transformOrigin: '0 0'
                        }}
                        initial={{ 
                          scale: 0,
                          x: 0,
                          y: 0,
                          opacity: 0
                        }}
                        animate={{
                          scale: [0, 1, 0],
                          x: Math.cos((i * Math.PI * 2) / 6) * 50,
                          y: Math.sin((i * Math.PI * 2) / 6) * 50,
                          opacity: [0, 1, 0]
                        }}
                        transition={{
                          delay: 0.3 + i * 0.1,
                          duration: 1,
                          repeat: Infinity,
                          repeatDelay: 2
                        }}
                      />
                    ))}
                  </motion.div>
                </div>

                {/* Title */}
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="text-3xl font-bold text-white text-center mb-3"
                >
                  🎉 Boost Activated!
                </motion.h3>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="text-gray-300 text-center mb-6 text-lg"
                >
                  You've jumped <span className={`font-bold text-xl ${config.textColor}`}>50 spots</span> for sharing on{' '}
                  <span className={`font-semibold ${config.textColor}`}>{config.name}</span>!
                </motion.p>

                {/* Points Badge */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: 0.45, type: 'spring', stiffness: 200 }}
                  className={`mx-auto w-fit px-8 py-4 rounded-2xl bg-gradient-to-r ${config.color} shadow-xl mb-4`}
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ rotate: [0, 15, -15, 0] }}
                      transition={{ duration: 0.5, delay: 0.6 }}
                    >
                      <Zap className="w-6 h-6 text-white fill-white" />
                    </motion.div>
                    <span className="text-white font-bold text-2xl">+50 Points</span>
                  </div>
                </motion.div>

                {/* Platform Icon Badge */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.55 }}
                  className="flex justify-center mb-4"
                >
                  <div className={`w-12 h-12 rounded-xl ${config.iconBg} flex items-center justify-center border ${config.borderColor}`}>
                    <PlatformIcon className={`w-6 h-6 ${config.iconColor}`} />
                  </div>
                </motion.div>

                {/* Auto-dismiss indicator */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.65 }}
                  className="text-center"
                >
                  <p className="text-sm text-gray-400">
                    Your position will update automatically
                  </p>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
