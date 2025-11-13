import { RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LeadPrepToolbarProps {
  isProcessing: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
}

export function LeadPrepToolbar({ isProcessing, onGenerate, onRefresh }: LeadPrepToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800/60 dark:bg-gray-950/40">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lead Prep Inbox</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enriched SavvyCal bookings with actionable prep guidance.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          disabled={isProcessing}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60',
            'dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60'
          )}
        >
          <RefreshCw className={cn('h-4 w-4', isProcessing && 'animate-spin')} />
          Refresh
        </button>
        <button
          onClick={onGenerate}
          disabled={isProcessing}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-75'
          )}
        >
          <Sparkles className="h-4 w-4" />
          {isProcessing ? 'Generating…' : 'Generate Prep'}
        </button>
      </div>
    </div>
  );
}



