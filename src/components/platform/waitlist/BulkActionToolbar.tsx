/**
 * BulkActionToolbar Component
 * Sticky toolbar showing selection count and bulk actions
 */

import React from 'react';
import { X, Send, Download, Trash2 } from 'lucide-react';

export interface BulkActionToolbarProps {
  selectedCount: number;
  onGrantAccess: () => void;
  onExport: () => void;
  onClearSelection: () => void;
  isProcessing?: boolean;
  className?: string;
}

export function BulkActionToolbar({
  selectedCount,
  onGrantAccess,
  onExport,
  onClearSelection,
  isProcessing = false,
  className = '',
}: BulkActionToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={`
        sticky top-0 z-10
        flex items-center justify-between gap-4
        px-6 py-3
        bg-blue-600 dark:bg-blue-700
        text-white
        shadow-lg
        border-b border-blue-700 dark:border-blue-800
        ${className}
      `}
    >
      {/* Selection count */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount} {selectedCount === 1 ? 'user' : 'users'} selected
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        {/* Grant Access Button */}
        <button
          onClick={onGrantAccess}
          disabled={isProcessing}
          className="
            flex items-center gap-2
            px-4 py-2
            bg-white text-blue-600
            hover:bg-blue-50
            disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed
            rounded-lg
            font-medium text-sm
            transition-colors
            shadow-sm
          "
        >
          <Send className="w-4 h-4" />
          Grant Access
        </button>

        {/* Export Button */}
        <button
          onClick={onExport}
          disabled={isProcessing}
          className="
            flex items-center gap-2
            px-4 py-2
            bg-blue-700 text-white
            hover:bg-blue-800
            disabled:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed
            rounded-lg
            font-medium text-sm
            transition-colors
            border border-blue-800
          "
        >
          <Download className="w-4 h-4" />
          Export Selected
        </button>

        {/* Clear Selection Button */}
        <button
          onClick={onClearSelection}
          disabled={isProcessing}
          className="
            flex items-center gap-2
            px-4 py-2
            bg-transparent text-white
            hover:bg-blue-700
            disabled:opacity-50 disabled:cursor-not-allowed
            rounded-lg
            font-medium text-sm
            transition-colors
            border border-blue-500
          "
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      </div>
    </div>
  );
}
