import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, X, Linkedin, Twitter, Sparkles } from 'lucide-react';
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
      color: 'from-blue-600 to-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
      iconColor: 'text-blue-400'
    },
    twitter: {
      name: 'X (Twitter)',
      icon: Twitter,
      color: 'from-sky-400 to-blue-500',
      bgColor: 'bg-sky-500/10',
      borderColor: 'border-sky-500/30',
      iconColor: 'text-sky-400'
    }
  };

  const config = platformConfig[platform];
  const PlatformIcon = config.icon;

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-sm mx-4 sm:mx-auto"
          >
            {/* Card */}
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-gray-700/50 bg-gray-900">
              {/* Header with gradient */}
              <div className={`bg-gradient-to-r ${config.color} px-6 py-5`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <PlatformIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Confirm Your Share
                      </h3>
                      <p className="text-sm text-white/80">{config.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Question */}
                <p className="text-gray-200 text-center text-base mb-5">
                  Did you post to {config.name}?
                </p>

                {/* Reward Preview */}
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  className={`${config.bgColor} ${config.borderColor} border rounded-xl p-4 mb-6`}
                >
                  <div className="flex items-center justify-center gap-3">
                    <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${config.color} flex items-center justify-center`}>
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-white">+{pointsBoost} points</p>
                      <p className="text-sm text-gray-400">Jump ahead in line!</p>
                    </div>
                  </div>
                </motion.div>

                {/* Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={onClose}
                    variant="outline"
                    className="flex-1 h-11 border-gray-600 hover:bg-gray-800 text-gray-300 rounded-xl"
                  >
                    Not Yet
                  </Button>
                  <Button
                    onClick={onConfirm}
                    className={`flex-1 h-11 bg-gradient-to-r ${config.color} hover:opacity-90 text-white font-semibold rounded-xl shadow-lg`}
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Yes, I Shared!
                  </Button>
                </div>

                {/* Fine Print */}
                <p className="text-xs text-gray-500 text-center mt-4">
                  Please only confirm if you actually posted
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Use portal to render modal at document body level
  if (typeof document !== 'undefined') {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
}
