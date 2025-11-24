import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Trash2,
  Clock,
  Mail,
  X,
  RefreshCw,
  Download,
  Upload,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  EmailDraft,
  getAllDrafts,
  deleteDraft,
  deleteAllDrafts,
  getDraftStats,
  exportDrafts,
  importDrafts
} from '@/lib/utils/draftStorage';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

interface DraftManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadDraft: (draft: EmailDraft) => void;
  currentDraftId?: string | null;
}

export function DraftManager({
  isOpen,
  onClose,
  onLoadDraft,
  currentDraftId
}: DraftManagerProps) {
  const [drafts, setDrafts] = useState<EmailDraft[]>(getAllDrafts());
  const [selectedDraft, setSelectedDraft] = useState<EmailDraft | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const refreshDrafts = () => {
    setDrafts(getAllDrafts());
  };

  const handleDeleteDraft = (draftId: string) => {
    if (deleteDraft(draftId)) {
      refreshDrafts();
      toast.success('Draft deleted');
      if (selectedDraft?.id === draftId) {
        setSelectedDraft(null);
      }
    } else {
      toast.error('Failed to delete draft');
    }
  };

  const handleDeleteAllDrafts = () => {
    if (deleteAllDrafts()) {
      refreshDrafts();
      setSelectedDraft(null);
      setShowDeleteConfirm(false);
      toast.success('All drafts deleted');
    } else {
      toast.error('Failed to delete drafts');
    }
  };

  const handleLoadDraft = (draft: EmailDraft) => {
    onLoadDraft(draft);
    onClose();
    toast.success('Draft loaded');
  };

  const handleExportDrafts = () => {
    try {
      const jsonData = exportDrafts();
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `email-drafts-${format(new Date(), 'yyyy-MM-dd')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success('Drafts exported');
    } catch (error) {
      toast.error('Failed to export drafts');
    }
  };

  const handleImportDrafts = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const jsonString = event.target?.result as string;
            if (importDrafts(jsonString)) {
              refreshDrafts();
              toast.success('Drafts imported');
            } else {
              toast.error('Failed to import drafts');
            }
          } catch (error) {
            toast.error('Invalid draft file');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const stats = getDraftStats();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-gray-900 rounded-2xl border border-gray-800 shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <FileText className="w-6 h-6 text-blue-500" />
                  Email Drafts
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {stats.total} draft{stats.total !== 1 ? 's' : ''} • {formatBytes(stats.storageUsed)} used
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={refreshDrafts}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={handleExportDrafts}
                disabled={drafts.length === 0}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={handleImportDrafts}
                className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm flex items-center gap-2 transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={drafts.length === 0}
                className="px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2 transition-colors ml-auto disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-4 h-4" />
                Delete All
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Draft List */}
            <div className="w-1/2 border-r border-gray-800 overflow-y-auto">
              {drafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <FileText className="w-16 h-16 text-gray-600 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-300 mb-2">
                    No drafts saved
                  </h3>
                  <p className="text-sm text-gray-500">
                    Drafts are automatically saved every 30 seconds while composing emails.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-800">
                  {drafts.map((draft) => (
                    <motion.div
                      key={draft.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        'p-4 cursor-pointer transition-colors',
                        selectedDraft?.id === draft.id
                          ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                          : currentDraftId === draft.id
                            ? 'bg-green-500/10 border-l-2 border-l-green-500'
                            : 'hover:bg-gray-800/50'
                      )}
                      onClick={() => setSelectedDraft(draft)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* To */}
                          <div className="flex items-center gap-2 mb-1">
                            <Mail className="w-3 h-3 text-gray-500 flex-shrink-0" />
                            <span className="text-sm font-medium text-white truncate">
                              {draft.to || '(no recipient)'}
                            </span>
                          </div>

                          {/* Subject */}
                          <div className="text-sm font-medium text-gray-300 truncate mb-1">
                            {draft.subject || '(no subject)'}
                          </div>

                          {/* Body Preview */}
                          <div className="text-xs text-gray-500 line-clamp-2 mb-2">
                            {draft.body || '(empty)'}
                          </div>

                          {/* Metadata */}
                          <div className="flex items-center gap-3 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatDistanceToNow(new Date(draft.updatedAt), { addSuffix: true })}
                            </div>
                            {draft.attachments && draft.attachments.length > 0 && (
                              <span>{draft.attachments.length} attachment{draft.attachments.length !== 1 ? 's' : ''}</span>
                            )}
                            {currentDraftId === draft.id && (
                              <span className="text-green-400">● Current</span>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteDraft(draft.id);
                          }}
                          className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-400" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Draft Preview */}
            <div className="w-1/2 overflow-y-auto">
              {selectedDraft ? (
                <div className="p-6 space-y-4">
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">To</label>
                    <p className="text-sm text-white mt-1">{selectedDraft.to || '(no recipient)'}</p>
                  </div>

                  {selectedDraft.cc && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">CC</label>
                      <p className="text-sm text-white mt-1">{selectedDraft.cc}</p>
                    </div>
                  )}

                  {selectedDraft.bcc && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">BCC</label>
                      <p className="text-sm text-white mt-1">{selectedDraft.bcc}</p>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Subject</label>
                    <p className="text-sm text-white mt-1">{selectedDraft.subject || '(no subject)'}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Body</label>
                    <div className="text-sm text-gray-300 mt-2 whitespace-pre-wrap bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                      {selectedDraft.body || '(empty)'}
                    </div>
                  </div>

                  {selectedDraft.attachments && selectedDraft.attachments.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Attachments ({selectedDraft.attachments.length})
                      </label>
                      <div className="mt-2 space-y-2">
                        {selectedDraft.attachments.map((attachment, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
                          >
                            <FileText className="w-4 h-4 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{attachment.name}</p>
                              <p className="text-xs text-gray-500">{formatBytes(attachment.size)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-gray-800">
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleLoadDraft(selectedDraft)}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Load Draft
                    </motion.button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Mail className="w-16 h-16 text-gray-600 mb-4" />
                  <p className="text-sm text-gray-500">
                    Select a draft to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Delete All Confirmation */}
        <AnimatePresence>
          {showDeleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-gray-900 rounded-xl border border-gray-800 p-6 max-w-md w-full mx-4"
              >
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      Delete All Drafts?
                    </h3>
                    <p className="text-sm text-gray-400">
                      This will permanently delete all {drafts.length} draft{drafts.length !== 1 ? 's' : ''}. This action cannot be undone.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAllDrafts}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                  >
                    Delete All
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
