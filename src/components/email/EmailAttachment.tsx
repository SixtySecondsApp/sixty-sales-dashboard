import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Download,
  Eye,
  X,
  File,
  FileText,
  Image,
  FileCode,
  Music,
  Video,
  Archive,
  Table,
  Presentation,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EmailAttachment as EmailAttachmentType } from '@/types/email';
import {
  formatFileSize,
  getFileIcon,
  getFileTypeColor,
  downloadAttachment,
  createPreviewUrl
} from '@/lib/utils/attachmentUtils';
import { useGmailGetAttachment } from '@/lib/hooks/useGoogleIntegration';
import { toast } from 'sonner';

interface EmailAttachmentProps {
  attachment: EmailAttachmentType;
  messageId: string;
}

const iconMap: Record<string, any> = {
  'file': File,
  'file-text': FileText,
  'image': Image,
  'file-code': FileCode,
  'music': Music,
  'video': Video,
  'archive': Archive,
  'table': Table,
  'presentation': Presentation,
};

export function EmailAttachment({ attachment, messageId }: EmailAttachmentProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const getAttachment = useGmailGetAttachment();

  const iconName = getFileIcon(attachment.mimeType);
  const Icon = iconMap[iconName] || File;
  const colorClass = getFileTypeColor(attachment.mimeType);

  const handleDownload = async () => {
    // If we already have the data, download directly
    if (attachment.data) {
      downloadAttachment(attachment);
      toast.success(`Downloaded ${attachment.filename}`);
      return;
    }

    // Otherwise, fetch from Gmail API first
    try {
      const response = await getAttachment.mutateAsync({
        messageId,
        attachmentId: attachment.id
      });

      if (response?.data) {
        const downloadableAttachment = {
          ...attachment,
          data: response.data
        };
        downloadAttachment(downloadableAttachment);
        toast.success(`Downloaded ${attachment.filename}`);
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      toast.error('Failed to download attachment');
    }
  };

  const handlePreview = async () => {
    // If we already have the data, create preview directly
    if (attachment.data) {
      const url = createPreviewUrl(attachment);
      if (url) {
        setPreviewUrl(url);
        setShowPreview(true);
      }
      return;
    }

    // Otherwise, fetch from Gmail API first
    try {
      const response = await getAttachment.mutateAsync({
        messageId,
        attachmentId: attachment.id
      });

      if (response?.data) {
        const previewableAttachment = {
          ...attachment,
          data: response.data
        };
        const url = createPreviewUrl(previewableAttachment);
        if (url) {
          setPreviewUrl(url);
          setShowPreview(true);
        }
      }
    } catch (error) {
      console.error('Error previewing attachment:', error);
      toast.error('Failed to preview attachment');
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
      >
        {/* File Icon */}
        <div className={cn('flex-shrink-0', colorClass)}>
          <Icon className="w-8 h-8" />
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {attachment.filename}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {attachment.sizeFormatted || formatFileSize(attachment.size)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {attachment.canPreview && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePreview}
              disabled={getAttachment.isPending}
              className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors disabled:opacity-50"
              title="Preview"
            >
              {getAttachment.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </motion.button>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleDownload}
            disabled={getAttachment.isPending}
            className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
            title="Download"
          >
            {getAttachment.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
          </motion.button>
        </div>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && previewUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => {
              setShowPreview(false);
              if (previewUrl) {
                window.URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <Icon className={cn('w-5 h-5', colorClass)} />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {attachment.filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {attachment.sizeFormatted || formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDownload}
                    className="p-2 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowPreview(false);
                      if (previewUrl) {
                        window.URL.revokeObjectURL(previewUrl);
                        setPreviewUrl(null);
                      }
                    }}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto">
                {attachment.mimeType.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={attachment.filename}
                    className="max-w-full h-auto rounded-lg"
                  />
                ) : attachment.mimeType === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] rounded-lg border-0"
                    title={attachment.filename}
                  />
                ) : attachment.mimeType.startsWith('text/') ? (
                  <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap font-mono">
                    {/* Text preview would require fetching and decoding the content */}
                    Preview not available for this file type
                  </pre>
                ) : (
                  <div className="text-center py-12">
                    <File className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Preview not available for this file type
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
