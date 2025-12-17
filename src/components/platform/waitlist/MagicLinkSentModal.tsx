/**
 * MagicLinkSentModal Component
 * In-app modal that blurs background and shows checkmark when magic link is sent
 */

import React from 'react';
import { CheckCircle, X } from 'lucide-react';

export interface MagicLinkSentModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientEmail?: string;
}

// Add keyframe animation styles once globally
if (typeof document !== 'undefined' && !document.head.querySelector('style[data-modal-popin]')) {
  const style = document.createElement('style');
  style.setAttribute('data-modal-popin', 'true');
  style.textContent = `
    @keyframes modalPopIn {
      from {
        opacity: 0;
        transform: scale(0.9) translateY(-10px);
      }
      to {
        opacity: 1;
        transform: scale(1) translateY(0);
      }
    }
    @keyframes backdropFadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }
    @keyframes checkmarkPop {
      0% {
        opacity: 0;
        transform: scale(0);
      }
      50% {
        transform: scale(1.1);
      }
      100% {
        opacity: 1;
        transform: scale(1);
      }
    }
        .magic-link-modal-backdrop {
          opacity: 0;
          animation: backdropFadeIn 0.2s ease-out forwards;
        }
        .magic-link-modal-content {
          opacity: 0;
          transform: scale(0.9) translateY(-10px);
          animation: modalPopIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          will-change: opacity, transform;
        }
        .magic-link-checkmark-circle {
          opacity: 0;
          transform: scale(0);
          animation: checkmarkPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both forwards;
        }
  `;
  document.head.appendChild(style);
}

export function MagicLinkSentModal({ isOpen, onClose, recipientEmail }: MagicLinkSentModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with blur */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 magic-link-modal-backdrop"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-auto magic-link-modal-content"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="text-center">
            {/* Checkmark circle */}
            <div className="mx-auto mb-6 w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center magic-link-checkmark-circle">
              <CheckCircle className="w-12 h-12 text-green-600 dark:text-green-400" />
            </div>

            {/* Title */}
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Magic Link Sent!
            </h3>

            {/* Message */}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {recipientEmail ? (
                <>
                  A magic link has been sent to <span className="font-semibold text-gray-900 dark:text-white">{recipientEmail}</span>
                </>
              ) : (
                'A magic link has been sent successfully!'
              )}
            </p>

            {/* Close button */}
            <button
              onClick={onClose}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors duration-200"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
