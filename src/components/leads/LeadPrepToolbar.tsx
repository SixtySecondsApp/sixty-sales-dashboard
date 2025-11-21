import React from 'react';
import { RefreshCw, Sparkles, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LeadViewToggle } from './LeadViewToggle';

interface LeadPrepToolbarProps {
  isProcessing: boolean;
  onGenerate: () => void;
  onRefresh: () => void;
  onUpload?: (file: File) => void;
  isUploading?: boolean;
  viewMode?: 'list' | 'table';
  onViewModeChange?: (view: 'list' | 'table') => void;
}

export function LeadPrepToolbar({ 
  isProcessing, 
  onGenerate, 
  onRefresh, 
  onUpload, 
  isUploading,
  viewMode,
  onViewModeChange,
}: LeadPrepToolbarProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload && !isProcessing && !isUploading) {
      onUpload(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    if (!isProcessing && !isUploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4 dark:border-gray-800/60 dark:bg-gray-950/40">
      <div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Lead Prep Inbox</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enriched SavvyCal bookings with actionable prep guidance.
        </p>
      </div>

      <div className="flex items-center gap-2">
        {viewMode && onViewModeChange && (
          <LeadViewToggle
            view={viewMode}
            onViewChange={onViewModeChange}
            disabled={isProcessing || isUploading}
          />
        )}
        {onUpload && (
          <>
            <button
              onClick={handleUploadClick}
              disabled={isProcessing || isUploading}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60',
                'dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800/60'
              )}
            >
              <Upload className="h-4 w-4" />
              {isUploading ? 'Uploading…' : 'Import SavvyCal CSV'}
            </button>
            <input
              ref={fileInputRef}
              id="savvycal-csv-upload"
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              disabled={isProcessing || isUploading}
            />
          </>
        )}
        <button
          onClick={onRefresh}
          disabled={isProcessing || isUploading}
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
          disabled={isProcessing || isUploading}
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




