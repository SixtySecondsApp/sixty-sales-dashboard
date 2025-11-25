/**
 * CSVImportPreview - Step 3: Preview and validate data before import
 */

import React, { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ValidationResult, ImportOptions, getFieldLabel } from '@/lib/types/csvImport';
import { transformRowsForPreview } from '@/lib/services/csvImportService';

interface CSVImportPreviewProps {
  rows: Record<string, string>[];
  mappings: Record<string, string>;
  validation: ValidationResult;
  options: ImportOptions;
  onOptionsChange: (options: Partial<ImportOptions>) => void;
}

export function CSVImportPreview({
  rows,
  mappings,
  validation,
  options,
  onOptionsChange,
}: CSVImportPreviewProps) {
  // Get preview data (first 5 rows transformed)
  const previewData = useMemo(() => {
    return transformRowsForPreview(rows, mappings, 5);
  }, [rows, mappings]);

  // Get the mapped field names for preview columns
  const previewColumns = useMemo(() => {
    const fields: { key: string; label: string }[] = [];
    const seen = new Set<string>();

    Object.entries(mappings).forEach(([_, leadField]) => {
      if (leadField && !leadField.startsWith('__') && !seen.has(leadField)) {
        seen.add(leadField);
        fields.push({ key: leadField, label: getFieldLabel(leadField) });
      }
    });

    // Ensure email and name are first if present
    const priority = ['contact_email', 'contact_name', 'contact_first_name', 'contact_last_name'];
    fields.sort((a, b) => {
      const aIndex = priority.indexOf(a.key);
      const bIndex = priority.indexOf(b.key);
      if (aIndex >= 0 && bIndex >= 0) return aIndex - bIndex;
      if (aIndex >= 0) return -1;
      if (bIndex >= 0) return 1;
      return 0;
    });

    return fields.slice(0, 5); // Show max 5 columns in preview
  }, [mappings]);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Preview Import
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ready to import <strong className="text-gray-900 dark:text-gray-100">{validation.validRows}</strong> leads
          {validation.totalRows !== validation.validRows && (
            <span> out of {validation.totalRows} total rows</span>
          )}
        </p>
      </div>

      {/* Validation Summary */}
      <div className="space-y-2">
        {/* Errors */}
        {validation.errors.map((issue, i) => (
          <ValidationMessage key={`error-${i}`} type="error" issue={issue} />
        ))}

        {/* Warnings */}
        {validation.warnings.map((issue, i) => (
          <ValidationMessage key={`warning-${i}`} type="warning" issue={issue} />
        ))}

        {/* Success message if valid */}
        {validation.isValid && validation.errors.length === 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              <strong>{validation.validRows}</strong> rows are ready to import
            </p>
          </div>
        )}
      </div>

      {/* Preview Table */}
      {previewData.length > 0 && previewColumns.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Preview (first 5 rows)
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800/30">
                  {previewColumns.map((col) => (
                    <th
                      key={col.key}
                      className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 truncate max-w-[150px]"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {previewData.map((row, rowIndex) => (
                  <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    {previewColumns.map((col) => (
                      <td
                        key={col.key}
                        className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[150px]"
                        title={String(row[col.key] || '')}
                      >
                        {formatPreviewValue(row[col.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Options */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Import Options
        </h4>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={options.skipDuplicates}
            onChange={(e) => onOptionsChange({ skipDuplicates: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Skip duplicates
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Skip rows where the email already exists in your leads
            </p>
          </div>
        </label>

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={options.updateExisting}
            onChange={(e) => onOptionsChange({ updateExisting: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-500 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Update existing leads
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              If an email already exists, update the lead with new data instead of skipping
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

interface ValidationMessageProps {
  type: 'error' | 'warning';
  issue: {
    message: string;
    count: number;
    rowNumbers?: number[];
  };
}

function ValidationMessage({ type, issue }: ValidationMessageProps) {
  const Icon = type === 'error' ? XCircle : AlertTriangle;
  const colors =
    type === 'error'
      ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400'
      : 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-200 dark:border-yellow-500/30 text-yellow-700 dark:text-yellow-400';
  const iconColor = type === 'error' ? 'text-red-600 dark:text-red-500' : 'text-yellow-600 dark:text-yellow-500';

  return (
    <div className={cn('flex items-start gap-2 p-3 rounded-lg border', colors)}>
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', iconColor)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm">{issue.message}</p>
        {issue.rowNumbers && issue.rowNumbers.length > 0 && (
          <p className="text-xs mt-1 opacity-75">
            Rows: {issue.rowNumbers.slice(0, 5).join(', ')}
            {issue.rowNumbers.length > 5 && `... and ${issue.rowNumbers.length - 5} more`}
          </p>
        )}
      </div>
    </div>
  );
}

function formatPreviewValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
