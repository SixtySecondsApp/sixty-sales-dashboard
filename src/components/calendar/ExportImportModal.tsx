import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Upload,
  FileText,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { CalendarEvent } from '@/pages/Calendar';
import { ICalService } from '@/lib/services/iCalService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import logger from '@/lib/utils/logger';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CalendarEvent[];
  selectedEventIds?: Set<string>;
  onImport: (events: Partial<CalendarEvent>[]) => Promise<void>;
  userId: string;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  events,
  selectedEventIds,
  onImport,
  userId,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewEvents, setPreviewEvents] = useState<Partial<CalendarEvent>[]>([]);
  const [importStats, setImportStats] = useState<{
    total: number;
    meetings: number;
    calls: number;
    tasks: number;
    other: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const eventsToExport = selectedEventIds && selectedEventIds.size > 0
    ? events.filter(e => selectedEventIds.has(e.id))
    : events;

  const handleExportAll = () => {
    try {
      setIsProcessing(true);

      const iCalContent = ICalService.generateICalFile(
        eventsToExport,
        'Sixty Sales Calendar'
      );

      const filename = `sixty-sales-calendar-${format(new Date(), 'yyyy-MM-dd')}.ics`;
      ICalService.downloadICalFile(iCalContent, filename);

      toast.success(`Exported ${eventsToExport.length} events to ${filename}`);
      logger.log(`📥 Exported ${eventsToExport.length} events`);

      onClose();
    } catch (error) {
      logger.error('Export failed:', error);
      toast.error('Failed to export events');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportSelected = () => {
    if (!selectedEventIds || selectedEventIds.size === 0) {
      toast.error('No events selected');
      return;
    }

    handleExportAll();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.ics') && file.type !== 'text/calendar') {
      toast.error('Please select a valid .ics calendar file');
      return;
    }

    setImportFile(file);

    try {
      setIsProcessing(true);

      // Read and parse file
      const content = await ICalService.readICalFile(file);
      const parsedEvents = ICalService.parseICalFile(content);
      const calendarEvents = ICalService.convertToCalendarEvents(parsedEvents, userId);

      setPreviewEvents(calendarEvents);

      // Calculate stats
      const stats = {
        total: calendarEvents.length,
        meetings: calendarEvents.filter(e => e.category === 'meeting').length,
        calls: calendarEvents.filter(e => e.category === 'call').length,
        tasks: calendarEvents.filter(e => e.category === 'task').length,
        other: calendarEvents.filter(e => !['meeting', 'call', 'task'].includes(e.category || '')).length,
      };

      setImportStats(stats);

      toast.success(`Found ${calendarEvents.length} events in file`);
      logger.log(`📤 Parsed ${calendarEvents.length} events from file`);
    } catch (error) {
      logger.error('Import failed:', error);
      toast.error('Failed to parse calendar file');
      setImportFile(null);
      setPreviewEvents([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = async () => {
    if (previewEvents.length === 0) {
      toast.error('No events to import');
      return;
    }

    try {
      setIsProcessing(true);

      await onImport(previewEvents);

      toast.success(`Imported ${previewEvents.length} events successfully`);
      logger.log(`✅ Imported ${previewEvents.length} events`);

      // Reset state
      setImportFile(null);
      setPreviewEvents([]);
      setImportStats(null);

      onClose();
    } catch (error) {
      logger.error('Import failed:', error);
      toast.error('Failed to import events');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelImport = () => {
    setImportFile(null);
    setPreviewEvents([]);
    setImportStats(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-[#37bd7e]" />
            Export / Import Calendar
          </DialogTitle>
          <DialogDescription>
            Export your events to iCal format or import events from an .ics file
          </DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'export'
                ? 'bg-[#37bd7e] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Download className="w-4 h-4 inline mr-2" />
            Export
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'import'
                ? 'bg-[#37bd7e] text-white'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Upload className="w-4 h-4 inline mr-2" />
            Import
          </button>
        </div>

        {/* Export Tab */}
        {activeTab === 'export' && (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium mb-2">Export Events</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Download your calendar events in iCal (.ics) format. Compatible with Google Calendar, Apple Calendar, Outlook, and more.
                  </p>

                  <div className="flex items-center gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Total Events:</span>
                      <Badge className="ml-2 bg-[#37bd7e]/20 text-[#37bd7e] border-[#37bd7e]/30">
                        {events.length}
                      </Badge>
                    </div>
                    {selectedEventIds && selectedEventIds.size > 0 && (
                      <div>
                        <span className="text-gray-400">Selected:</span>
                        <Badge className="ml-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
                          {selectedEventIds.size}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleExportAll}
                disabled={isProcessing || events.length === 0}
                className="flex-1 bg-[#37bd7e] hover:bg-[#2da76c]"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Export All ({events.length})
                  </>
                )}
              </Button>

              {selectedEventIds && selectedEventIds.size > 0 && (
                <Button
                  onClick={handleExportSelected}
                  disabled={isProcessing}
                  variant="outline"
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Selected ({selectedEventIds.size})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Import Tab */}
        {activeTab === 'import' && (
          <div className="space-y-4 py-4">
            {!importFile ? (
              <>
                <div className="p-8 border-2 border-dashed border-gray-700 rounded-lg text-center">
                  <Upload className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <h3 className="font-medium mb-2">Import Calendar File</h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Select an iCal (.ics) file to import events
                  </p>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".ics,text/calendar"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    className="bg-[#37bd7e] hover:bg-[#2da76c]"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Choose File
                      </>
                    )}
                  </Button>
                </div>

                <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-gray-300">
                      <p className="font-medium text-blue-400 mb-1">Supported Formats</p>
                      <p className="text-gray-400">
                        Import .ics files from Google Calendar, Apple Calendar, Outlook, or any other calendar application that supports the iCalendar standard.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Import Preview */}
                <div className="p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <span className="font-medium">{importFile.name}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelImport}
                      disabled={isProcessing}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {importStats && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Total Events:</span>
                        <Badge className="ml-2 bg-[#37bd7e]/20 text-[#37bd7e] border-[#37bd7e]/30">
                          {importStats.total}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-400">Meetings:</span>
                        <Badge className="ml-2" variant="outline">
                          {importStats.meetings}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-400">Calls:</span>
                        <Badge className="ml-2" variant="outline">
                          {importStats.calls}
                        </Badge>
                      </div>
                      <div>
                        <span className="text-gray-400">Tasks:</span>
                        <Badge className="ml-2" variant="outline">
                          {importStats.tasks}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preview List */}
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {previewEvents.slice(0, 10).map((event, index) => (
                    <div
                      key={index}
                      className="p-3 bg-gray-800/20 rounded border border-gray-700/50 text-sm"
                    >
                      <div className="font-medium">{event.title}</div>
                      <div className="text-xs text-gray-400 mt-1">
                        {event.start && format(new Date(event.start), 'MMM d, yyyy h:mm a')}
                        {event.category && ` • ${event.category}`}
                      </div>
                    </div>
                  ))}
                  {previewEvents.length > 10 && (
                    <div className="text-center text-sm text-gray-400 py-2">
                      + {previewEvents.length - 10} more events
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleCancelImport}
                    variant="outline"
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmImport}
                    disabled={isProcessing}
                    className="flex-1 bg-[#37bd7e] hover:bg-[#2da76c]"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Import {previewEvents.length} Events
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
