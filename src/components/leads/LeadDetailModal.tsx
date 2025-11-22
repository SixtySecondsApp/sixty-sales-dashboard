import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadDetailPanel } from './LeadDetailPanel';
import type { LeadWithPrep } from '@/lib/services/leadService';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: LeadWithPrep | null;
}

export function LeadDetailModal({ isOpen, onClose, lead }: LeadDetailModalProps) {
  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm pt-20 pb-12 px-4"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          'relative w-full max-w-4xl max-h-full overflow-hidden',
          'bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800',
          'flex flex-col'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Lead Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <LeadDetailPanel lead={lead} />
        </div>
      </div>
    </div>
  );
}

