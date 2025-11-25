/**
 * CSVImportMapping - Step 2: Map CSV columns to lead fields
 */

import React, { useMemo } from 'react';
import { Check, ChevronDown, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LEAD_FIELD_GROUPS, getFieldLabel } from '@/lib/types/csvImport';
import { getSampleValues } from '@/lib/services/csvImportService';
import { MappingTemplateSelector } from './MappingTemplateSelector';

interface CSVImportMappingProps {
  headers: string[];
  rows: Record<string, string>[];
  mappings: Record<string, string>;
  autoDetectedMappings: Record<string, string>;
  onMappingChange: (csvColumn: string, leadField: string | null) => void;
  onLoadTemplate: (mappings: Record<string, string>) => void;
}

export function CSVImportMapping({
  headers,
  rows,
  mappings,
  autoDetectedMappings,
  onMappingChange,
  onLoadTemplate,
}: CSVImportMappingProps) {
  // Calculate which lead fields are already used
  const usedLeadFields = useMemo(() => {
    return new Set(Object.values(mappings).filter((f) => f && !f.startsWith('__')));
  }, [mappings]);

  // Count of mapped columns
  const mappedCount = useMemo(() => {
    return Object.values(mappings).filter((f) => f && f !== '__skip__').length;
  }, [mappings]);

  // Check if email or name is mapped
  const hasEmailOrName = useMemo(() => {
    const fields = Object.values(mappings);
    return fields.includes('contact_email') || fields.includes('contact_name');
  }, [mappings]);

  return (
    <div className="space-y-4">
      {/* Header with template selector */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Map Your Columns
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mappedCount} of {headers.length} columns mapped
          </p>
        </div>
        <MappingTemplateSelector
          currentMappings={mappings}
          onLoadTemplate={onLoadTemplate}
        />
      </div>

      {/* Requirement notice */}
      {!hasEmailOrName && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 border border-yellow-200 dark:border-yellow-500/30">
          <Info className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            You must map at least an <strong>Email</strong> or <strong>Full Name</strong> column to continue.
          </p>
        </div>
      )}

      {/* Mapping table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr,120px,180px] gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <div>CSV Column</div>
          <div>Sample Data</div>
          <div>Maps to Lead Field</div>
        </div>

        {/* Mapping rows */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {headers.map((header) => (
            <MappingRow
              key={header}
              csvColumn={header}
              sampleValues={getSampleValues(rows, header, 3)}
              selectedField={mappings[header] || null}
              isAutoDetected={header in autoDetectedMappings}
              usedFields={usedLeadFields}
              onChange={(field) => onMappingChange(header, field)}
            />
          ))}
        </div>
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Columns marked with <span className="text-emerald-500">✓ Auto</span> were automatically detected.
        You can change them if needed.
      </p>
    </div>
  );
}

// ============================================================================
// MappingRow Component
// ============================================================================

interface MappingRowProps {
  csvColumn: string;
  sampleValues: string[];
  selectedField: string | null;
  isAutoDetected: boolean;
  usedFields: Set<string>;
  onChange: (field: string | null) => void;
}

function MappingRow({
  csvColumn,
  sampleValues,
  selectedField,
  isAutoDetected,
  usedFields,
  onChange,
}: MappingRowProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const displayValue = selectedField
    ? selectedField === '__skip__'
      ? 'Skip this column'
      : selectedField === '__metadata__'
      ? 'Store in metadata'
      : getFieldLabel(selectedField)
    : 'Select field...';

  return (
    <div className="grid grid-cols-[1fr,120px,180px] gap-2 px-4 py-3 items-center">
      {/* CSV Column name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
          {csvColumn}
        </span>
      </div>

      {/* Sample values */}
      <div className="text-xs text-gray-500 dark:text-gray-400 truncate" title={sampleValues.join(', ')}>
        {sampleValues.length > 0 ? sampleValues.slice(0, 2).join(', ') : '—'}
        {sampleValues.length > 2 && '...'}
      </div>

      {/* Field selector */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border transition-colors',
            selectedField
              ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              : 'border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50',
            'hover:border-blue-400 dark:hover:border-blue-500'
          )}
        >
          <span
            className={cn(
              'truncate',
              selectedField ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'
            )}
          >
            {displayValue}
          </span>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isAutoDetected && selectedField && (
              <span className="text-xs text-emerald-500 flex items-center gap-0.5">
                <Check className="h-3 w-3" /> Auto
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </div>
        </button>

        {/* Dropdown */}
        {isOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
            <div className="absolute z-20 mt-1 w-64 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 max-h-72 overflow-y-auto">
              {/* Clear option */}
              <button
                onClick={() => {
                  onChange(null);
                  setIsOpen(false);
                }}
                className="w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                — Clear selection —
              </button>

              {/* Field groups */}
              {LEAD_FIELD_GROUPS.map((group) => (
                <div key={group.label}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider bg-gray-50 dark:bg-gray-900/50">
                    {group.label}
                  </div>
                  {group.fields.map((field) => {
                    const isUsed = usedFields.has(field.value) && field.value !== selectedField;
                    const isSelected = field.value === selectedField;

                    return (
                      <button
                        key={field.value}
                        onClick={() => {
                          if (!isUsed || field.isAction) {
                            onChange(field.value);
                            setIsOpen(false);
                          }
                        }}
                        disabled={isUsed && !field.isAction}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm flex items-center justify-between',
                          isSelected && 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
                          !isSelected && !isUsed && 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                          isUsed && !field.isAction && 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                        )}
                      >
                        <span className={cn(field.isAction && 'italic text-gray-500')}>
                          {field.label}
                        </span>
                        {isSelected && <Check className="h-4 w-4" />}
                        {isUsed && !field.isAction && (
                          <span className="text-xs text-gray-400">In use</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
