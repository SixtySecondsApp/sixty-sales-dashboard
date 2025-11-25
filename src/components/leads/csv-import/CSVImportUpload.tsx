/**
 * CSVImportUpload - Step 1: File upload with drag and drop
 */

import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CSVImportUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  selectedFile: File | null;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function CSVImportUpload({
  onFileSelect,
  isProcessing,
  selectedFile,
}: CSVImportUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSelectFile = useCallback(
    (file: File) => {
      setError(null);

      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        setError('Please select a .csv file');
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        setError('File size exceeds 5MB limit');
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        validateAndSelectFile(files[0]);
      }
    },
    [validateAndSelectFile]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        validateAndSelectFile(files[0]);
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    },
    [validateAndSelectFile]
  );

  const handleClick = useCallback(() => {
    if (!isProcessing) {
      fileInputRef.current?.click();
    }
  }, [isProcessing]);

  const handleRemoveFile = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Upload Your CSV File
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Drag and drop or click to browse. Maximum file size: 5MB.
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer',
          'flex flex-col items-center justify-center text-center',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10'
            : 'border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600',
          isProcessing && 'opacity-50 cursor-not-allowed',
          error && 'border-red-300 dark:border-red-700'
        )}
      >
        {isProcessing ? (
          <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        ) : (
          <div
            className={cn(
              'p-4 rounded-full mb-4',
              isDragging
                ? 'bg-blue-500/20'
                : 'bg-gray-100 dark:bg-gray-800'
            )}
          >
            <Upload
              className={cn(
                'h-8 w-8',
                isDragging ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'
              )}
            />
          </div>
        )}

        {isProcessing ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Parsing CSV file...
          </p>
        ) : (
          <>
            <p className="text-base font-medium text-gray-700 dark:text-gray-300">
              {isDragging ? 'Drop your CSV file here' : 'Drag and drop your CSV file here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or click to browse
            </p>
          </>
        )}
      </div>

      {/* Selected file display */}
      {selectedFile && !isProcessing && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-lg border border-blue-200 dark:border-blue-500/30">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <FileSpreadsheet className="h-5 w-5 text-blue-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
              {selectedFile.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveFile();
            }}
            className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
          >
            <X className="h-4 w-4 text-blue-500" />
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* File format help */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          CSV File Requirements
        </h4>
        <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <li>• File must have a header row with column names</li>
          <li>• Supported encoding: UTF-8</li>
          <li>• At minimum, include an Email or Name column</li>
          <li>• Export from tools like HubSpot, Salesforce, Google Sheets, Excel</li>
        </ul>
      </div>
    </div>
  );
}
