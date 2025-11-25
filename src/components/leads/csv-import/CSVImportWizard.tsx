/**
 * CSVImportWizard - Main wizard container for generic CSV lead import
 *
 * A 4-step wizard that guides users through importing leads from any CSV file:
 * 1. Upload - Drag and drop or select a CSV file
 * 2. Map - Map CSV columns to lead fields
 * 3. Preview - Preview and validate data before import
 * 4. Import - Track progress and view results
 */

import React, { useState, useCallback } from 'react';
import { X, FileSpreadsheet, MapPin, Eye, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  CSVImportState,
  CSVImportStep,
  ImportOptions,
  ValidationResult,
} from '@/lib/types/csvImport';
import {
  parseCSVFile,
  autoDetectMappings,
  validateImportData,
  executeImport,
} from '@/lib/services/csvImportService';
import { CSVImportUpload } from './CSVImportUpload';
import { CSVImportMapping } from './CSVImportMapping';
import { CSVImportPreview } from './CSVImportPreview';
import { CSVUploadProgress } from '../CSVUploadProgress';
import { toast } from 'sonner';

interface CSVImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

const STEPS = [
  { number: 1, label: 'Upload', icon: FileSpreadsheet },
  { number: 2, label: 'Map', icon: MapPin },
  { number: 3, label: 'Preview', icon: Eye },
  { number: 4, label: 'Import', icon: Upload },
] as const;

const initialState: CSVImportState = {
  step: 1,
  file: null,
  fileName: null,
  headers: [],
  rows: [],
  totalRows: 0,
  mappings: {},
  autoDetectedMappings: {},
  validation: {
    isValid: false,
    totalRows: 0,
    validRows: 0,
    errors: [],
    warnings: [],
  },
  importOptions: {
    skipDuplicates: true,
    updateExisting: false,
  },
  importProgress: null,
  importResult: null,
};

export function CSVImportWizard({ isOpen, onClose, onImportComplete }: CSVImportWizardProps) {
  const [state, setState] = useState<CSVImportState>(initialState);
  const [isProcessing, setIsProcessing] = useState(false);

  // Reset state when modal closes
  const handleClose = useCallback(() => {
    setState(initialState);
    onClose();
  }, [onClose]);

  // Handle file selection (Step 1)
  const handleFileSelect = useCallback(async (file: File) => {
    setIsProcessing(true);
    try {
      const parsed = await parseCSVFile(file);

      if (parsed.totalRows === 0) {
        toast.error('The CSV file is empty or has no data rows');
        return;
      }

      const autoMappings = autoDetectMappings(parsed.headers);

      setState((prev) => ({
        ...prev,
        file,
        fileName: file.name,
        headers: parsed.headers,
        rows: parsed.rows,
        totalRows: parsed.totalRows,
        mappings: autoMappings,
        autoDetectedMappings: autoMappings,
        step: 2,
      }));

      toast.success(`Loaded ${parsed.totalRows} rows with ${parsed.headers.length} columns`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to parse CSV file');
    } finally {
      setIsProcessing(false);
    }
  }, []);

  // Handle mapping changes (Step 2)
  const handleMappingChange = useCallback(
    (csvColumn: string, leadField: string | null) => {
      setState((prev) => {
        const newMappings = { ...prev.mappings };
        if (leadField) {
          newMappings[csvColumn] = leadField;
        } else {
          delete newMappings[csvColumn];
        }
        return { ...prev, mappings: newMappings };
      });
    },
    []
  );

  // Load a saved template
  const handleLoadTemplate = useCallback((mappings: Record<string, string>) => {
    setState((prev) => ({
      ...prev,
      mappings,
      autoDetectedMappings: {}, // Clear auto-detected markers when loading template
    }));
    toast.success('Template loaded');
  }, []);

  // Navigate to preview (Step 2 -> 3)
  const handleGoToPreview = useCallback(() => {
    const validation = validateImportData(state.rows, state.mappings);
    setState((prev) => ({
      ...prev,
      validation,
      step: 3,
    }));
  }, [state.rows, state.mappings]);

  // Handle import options change
  const handleOptionsChange = useCallback((options: Partial<ImportOptions>) => {
    setState((prev) => ({
      ...prev,
      importOptions: { ...prev.importOptions, ...options },
    }));
  }, []);

  // Start import (Step 3 -> 4)
  const handleStartImport = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      step: 4,
      importProgress: {
        stage: 'uploading',
        progress: 0,
        currentRow: 0,
        totalRows: prev.totalRows,
        stats: { processed: 0, created: 0, updated: 0, skipped: 0, errors: 0 },
        message: 'Sending data to server...',
      },
    }));

    try {
      // Update to processing stage
      setState((prev) => ({
        ...prev,
        importProgress: prev.importProgress
          ? {
              ...prev.importProgress,
              stage: 'processing',
              progress: 10,
              message: 'Processing leads...',
            }
          : null,
      }));

      const result = await executeImport(
        state.rows,
        state.mappings,
        state.importOptions
      );

      setState((prev) => ({
        ...prev,
        importResult: result,
        importProgress: {
          stage: result.success ? 'complete' : 'error',
          progress: 100,
          currentRow: prev.totalRows,
          totalRows: prev.totalRows,
          stats: {
            processed: result.created + result.updated + result.skipped,
            created: result.created,
            updated: result.updated,
            skipped: result.skipped,
            errors: result.errors.length,
          },
          message: result.success
            ? `Successfully imported ${result.created + result.updated} leads`
            : 'Import completed with errors',
        },
      }));

      if (result.success) {
        toast.success(`Imported ${result.created + result.updated} leads`);
        onImportComplete?.();
      } else {
        toast.warning('Import completed with some errors');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        importProgress: {
          stage: 'error',
          progress: 0,
          currentRow: 0,
          totalRows: prev.totalRows,
          stats: { processed: 0, created: 0, updated: 0, skipped: 0, errors: prev.totalRows },
          message: error instanceof Error ? error.message : 'Import failed',
        },
      }));
      toast.error(error instanceof Error ? error.message : 'Import failed');
    }
  }, [state.rows, state.mappings, state.importOptions, onImportComplete]);

  // Navigation
  const handleBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(1, prev.step - 1) as CSVImportStep,
    }));
  }, []);

  if (!isOpen) return null;

  // Step 4 uses the existing CSVUploadProgress component
  if (state.step === 4 && state.importProgress) {
    return (
      <CSVUploadProgress
        isOpen={true}
        onClose={handleClose}
        stage={state.importProgress.stage}
        progress={state.importProgress.progress}
        currentRow={state.importProgress.currentRow}
        totalRows={state.importProgress.totalRows}
        message={state.importProgress.message}
        stats={state.importProgress.stats}
        error={state.importProgress.stage === 'error' ? state.importProgress.message : undefined}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Import Leads from CSV
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => {
              const Icon = step.icon;
              const isActive = state.step === step.number;
              const isComplete = state.step > step.number;

              return (
                <React.Fragment key={step.number}>
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                        isActive && 'bg-blue-500 text-white',
                        isComplete && 'bg-emerald-500 text-white',
                        !isActive && !isComplete && 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <span
                      className={cn(
                        'text-sm font-medium hidden sm:inline',
                        isActive && 'text-blue-500',
                        isComplete && 'text-emerald-500',
                        !isActive && !isComplete && 'text-gray-500'
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        isComplete ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'
                      )}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {state.step === 1 && (
            <CSVImportUpload
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
              selectedFile={state.file}
            />
          )}

          {state.step === 2 && (
            <CSVImportMapping
              headers={state.headers}
              rows={state.rows}
              mappings={state.mappings}
              autoDetectedMappings={state.autoDetectedMappings}
              onMappingChange={handleMappingChange}
              onLoadTemplate={handleLoadTemplate}
            />
          )}

          {state.step === 3 && (
            <CSVImportPreview
              rows={state.rows}
              mappings={state.mappings}
              validation={state.validation}
              options={state.importOptions}
              onOptionsChange={handleOptionsChange}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={state.step === 1 ? handleClose : handleBack}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            {state.step === 1 ? 'Cancel' : '← Back'}
          </button>

          {state.step === 1 && (
            <button
              disabled={!state.file || isProcessing}
              onClick={() => {}} // File selection auto-advances
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Continue →
            </button>
          )}

          {state.step === 2 && (
            <button
              onClick={handleGoToPreview}
              disabled={Object.keys(state.mappings).length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Preview Import →
            </button>
          )}

          {state.step === 3 && (
            <button
              onClick={handleStartImport}
              disabled={!state.validation.isValid || state.validation.validRows === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-500 rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Start Import →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
