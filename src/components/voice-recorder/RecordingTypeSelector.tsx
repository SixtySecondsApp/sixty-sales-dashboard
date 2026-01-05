import { memo } from 'react';
import { Users, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RecordingType } from './types';

interface RecordingTypeSelectorProps {
  value: RecordingType;
  onChange: (type: RecordingType) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * RecordingTypeSelector - Toggle between Meeting and Voice Note recording types
 * Meeting: Multiple speakers, integrates with Meetings page
 * Voice Note: Single speaker, stays in Voice Recorder with simple view
 */
export const RecordingTypeSelector = memo(function RecordingTypeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: RecordingTypeSelectorProps) {
  return (
    <div className={cn('flex gap-2', className)}>
      <button
        type="button"
        onClick={() => onChange('meeting')}
        disabled={disabled}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all',
          'border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#37bd7e] focus-visible:ring-offset-2',
          value === 'meeting'
            ? 'bg-[#37bd7e] text-white border-[#37bd7e] shadow-lg shadow-[#37bd7e]/20'
            : 'bg-white dark:bg-gray-900/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Users className="w-4 h-4" />
        <span>Meeting</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('voice_note')}
        disabled={disabled}
        className={cn(
          'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium text-sm transition-all',
          'border focus:outline-none focus-visible:ring-2 focus-visible:ring-[#37bd7e] focus-visible:ring-offset-2',
          value === 'voice_note'
            ? 'bg-[#37bd7e] text-white border-[#37bd7e] shadow-lg shadow-[#37bd7e]/20'
            : 'bg-white dark:bg-gray-900/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-800/50',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <Mic className="w-4 h-4" />
        <span>Voice Note</span>
      </button>
    </div>
  );
});

export default RecordingTypeSelector;
