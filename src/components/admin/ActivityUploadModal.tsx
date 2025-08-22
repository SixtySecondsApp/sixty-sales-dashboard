import React, { useState, useRef } from 'react';
import * as Papa from 'papaparse';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"; // Assuming Dialog is in ui
import { CheckCircle, XCircle, Info, UploadCloud } from 'lucide-react';
import logger from '@/lib/utils/logger';

// Define the expected column order (same as before)
const COLUMN_ORDER = [
  'id', 'user_id', 'type', 'status', 'priority', 'client_name', 'sales_rep',
  'details', 'amount', 'date', 'created_at', 'updated_at', 'quantity',
  'contact_identifier', 'contact_identifier_type'
];

interface ActivityUploadModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export function ActivityUploadModal({ open, setOpen }: ActivityUploadModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<'csv' | 'tsv' | null>(null);

  // Function to trigger file input
  const handleUploadClick = (type: 'csv' | 'tsv') => {
    setUploadType(type);
    setResult(null); // Clear previous results when starting a new upload
    fileInputRef.current?.click();
  };

  // Function to handle file selection and parsing (moved from BulkActivityImport)
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !uploadType) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      delimiter: uploadType === 'csv' ? ',' : '\t',
      complete: async (results) => {
        logger.log("Parsed data:", results.data);
        if (!Array.isArray(results.data) || results.data.length === 0 || !Array.isArray(results.data[0])) {
           toast.error('Parsing failed or file is empty. Please check file format.');
           setIsLoading(false);
           return;
        }

        const dataToProcess = results.data as any[][];
        const activitiesToInsert = dataToProcess.map((row: any[], rowIndex: number) => {
          const activity: { [key: string]: any } = {};
          if (row.length !== COLUMN_ORDER.length) {
            logger.warn(`Row ${rowIndex + 1}: Incorrect column count (${row.length}), expected ${COLUMN_ORDER.length}. Skipping.`);
            toast.warning(`Row ${rowIndex + 1} has an incorrect number of columns (${row.length}). It will be skipped.`);
            return null;
          }
          COLUMN_ORDER.forEach((colName, index) => {
            let value = row[index]?.trim();
             if (value === '\\N' || value === '') { value = null; }
             if (value !== null) {
                 if ((colName === 'amount' || colName === 'quantity') && typeof value === 'string') {
                     const num = colName === 'amount' ? parseFloat(value) : parseInt(value, 10);
                     value = isNaN(num) ? null : num;
                 }
             }
             activity[colName] = value;
          });
          if (!activity.id || !activity.user_id) {
             logger.warn(`Row ${rowIndex + 1}: Missing required 'id' or 'user_id'. Skipping.`);
             toast.warning(`Row ${rowIndex + 1} is missing required 'id' or 'user_id'. It will be skipped.`);
             return null;
          }
          return activity;
        }).filter(activity => activity !== null);

        if (activitiesToInsert.length === 0) {
            toast.warning('No valid activity rows found in the file after parsing.');
            setIsLoading(false);
            return;
        }
        logger.log("Activities to insert:", activitiesToInsert);
        await invokeImportFunction(activitiesToInsert);
      },
      error: (error: any) => {
        logger.error('PapaParse Error:', error);
        toast.error(`Error parsing ${uploadType?.toUpperCase()} file: ${error.message}`);
        setIsLoading(false);
      }
    });

    if (event.target) { event.target.value = ''; }
  };

  // Function to invoke the Supabase Edge Function (moved from BulkActivityImport)
  const invokeImportFunction = async (parsedData: any[]) => {
    setIsLoading(true);
    setResult(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        toast.error('Authentication error. Please log in again.');
        setIsLoading(false); return;
      }

      logger.log("Invoking function with:", parsedData);
      const { data, error } = await supabase.functions.invoke('bulk-import-activities', {
        body: JSON.stringify(parsedData),
        headers: { 'Content-Type': 'application/json' }
      });

      if (error) {
        logger.error('Function Invoke Error:', error);
        toast.error(`Function invocation failed: ${error.message}`);
        setResult({ type: 'error', message: `Invocation failed: ${error.message}` });
      } else {
        logger.log('Function Response:', data);
        if (data.error || data.databaseError) {
            const errorMessage = data.databaseError || data.message || data.error || 'Unknown import error.';
            toast.error(`Import failed: ${errorMessage}`);
            setResult({ type: 'error', ...data });
        } else {
            toast.success(data.message || 'Import completed successfully.');
            setResult({ type: 'success', ...data });
            // Optionally close modal on success after a short delay
            // setTimeout(() => setOpen(false), 2000);
        }
      }
    } catch (err: any) {
      logger.error('Unexpected Import Error:', err);
      toast.error('An unexpected error occurred during import.');
      setResult({ type: 'error', message: `Unexpected error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Reset result when modal is closed
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setResult(null);
      setUploadType(null);
    }
    setOpen(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[625px] bg-gray-900 border-gray-800/50 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center gap-2">
             <UploadCloud className="w-5 h-5" /> Bulk Import Activities
          </DialogTitle>
          <DialogDescription className="text-gray-400 pt-2 text-left">
             Upload a CSV or TSV file to import multiple activities at once.
             Ensure your file adheres to the required format and column order.
          </DialogDescription>
        </DialogHeader>

        {/* Instructions and Format */}
        <div className="py-4 space-y-3">
             <p className="text-sm text-gray-400">
                 Required columns in order: <code className="text-xs bg-gray-700/50 px-1 py-0.5 rounded">{COLUMN_ORDER.join(', ')}</code>.
                 <br/> Use empty fields or <code className="text-xs bg-gray-700/50 px-1 py-0.5 rounded">\N</code> for null values. No header row expected.
             </p>
             <Alert variant="default" className="border-blue-500/30 bg-blue-900/10">
                 <Info className="h-4 w-4 text-blue-400" />
                 <AlertTitle className="text-blue-300">Example File Format</AlertTitle>
                 <AlertDescription className="text-blue-400/80 text-xs">
                     <code className="block bg-gray-700/30 px-1 py-0.5 rounded my-1">ca2e54a1-...,ac4efca2-...,meeting,completed,medium,"Client Name","User Name","Notes...",,\N,2025-01-27...,2025-01-27...,2025-01-27...,1,\N,\N</code> (CSV row)<br/>
                     <code className="block bg-gray-700/30 px-1 py-0.5 rounded my-1">ca2e54a1-...\tac4efca2-...\tmeeting\tcompleted\tmedium\tClient Name\tUser Name\tNotes...\t\N\t2025-01-27...\t2025-01-27...\t2025-01-27...\t1\t\N\t\N</code> (TSV row)<br/>
                     Quotes may be needed for CSV fields containing commas.
                 </AlertDescription>
             </Alert>
         </div>

        {/* Hidden file input */}
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv,.tsv"
            style={{ display: 'none' }}
            disabled={isLoading}
        />

        {/* Display results inside modal */}
        {result && (
            <Alert variant={result.type === 'success' ? 'default' : 'destructive'} className="my-4">
              {result.type === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              <AlertTitle>{result.type === 'success' ? 'Import Summary' : 'Import Error'}</AlertTitle>
              <AlertDescription>
                  {result.message}<br />
                  {result.insertedCount !== undefined && `Rows successfully inserted: ${result.insertedCount}`}<br />
                  {result.skippedLinesCount !== undefined && `Rows skipped (parsing/validation): ${result.skippedLinesCount}`}<br />
                  {result.parsingErrors && result.parsingErrors.length > 0 && (
                  <>
                      <span className="font-semibold">First few parsing errors:</span>
                      <ul className="list-disc list-inside text-xs max-h-20 overflow-y-auto">
                          {result.parsingErrors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                      </ul>
                  </>
                  )}
                  {result.databaseError && `Database Error: ${result.databaseError}`}
              </AlertDescription>
            </Alert>
        )}

        <DialogFooter className="sm:justify-start gap-2">
          <Button type="button" onClick={() => handleUploadClick('csv')} disabled={isLoading}>
            {isLoading && uploadType === 'csv' ? 'Processing...' : 'Upload CSV File'}
          </Button>
          <Button type="button" onClick={() => handleUploadClick('tsv')} disabled={isLoading}>
             {isLoading && uploadType === 'tsv' ? 'Processing...' : 'Upload TSV File'}
          </Button>
          <DialogClose asChild>
              <Button type="button" variant="outline" disabled={isLoading}>
                 Close
              </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
} 