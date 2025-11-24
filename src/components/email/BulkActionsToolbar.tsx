import { motion, AnimatePresence } from 'framer-motion';
import {
  Archive,
  Trash2,
  Star,
  Mail,
  MailOpen,
  X,
  FolderInput,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkActionsToolbarProps {
  selectedCount: number;
  isPerformingAction: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onStar: () => void;
  onUnstar: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onMoveToFolder: (folder: string) => void;
  onDeselectAll: () => void;
  currentFolder?: string;
}

export function BulkActionsToolbar({
  selectedCount,
  isPerformingAction,
  onArchive,
  onDelete,
  onStar,
  onUnstar,
  onMarkRead,
  onMarkUnread,
  onMoveToFolder,
  onDeselectAll,
  currentFolder = 'inbox'
}: BulkActionsToolbarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50"
      >
        <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-4">
          {/* Selection count */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#37bd7e]/10 rounded-lg border border-[#37bd7e]/20">
            <span className="text-sm font-medium text-[#37bd7e]">
              {selectedCount} selected
            </span>
          </div>

          {/* Divider */}
          <div className="w-px h-6 bg-gray-800" />

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Archive (only show if not in archive folder) */}
            {currentFolder !== 'archive' && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onArchive}
                disabled={isPerformingAction}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  "hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title="Archive"
              >
                <Archive className="w-4 h-4" />
              </motion.button>
            )}

            {/* Delete */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onDelete}
              disabled={isPerformingAction}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-gray-800 hover:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Move to trash"
            >
              <Trash2 className="w-4 h-4" />
            </motion.button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-800 mx-1" />

            {/* Star */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStar}
              disabled={isPerformingAction}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-gray-800 hover:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Star"
            >
              <Star className="w-4 h-4" />
            </motion.button>

            {/* Unstar */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onUnstar}
              disabled={isPerformingAction}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Unstar"
            >
              <Star className="w-4 h-4 fill-current" />
            </motion.button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-800 mx-1" />

            {/* Mark as read */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onMarkRead}
              disabled={isPerformingAction}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Mark as read"
            >
              <MailOpen className="w-4 h-4" />
            </motion.button>

            {/* Mark as unread */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onMarkUnread}
              disabled={isPerformingAction}
              className={cn(
                "p-2 rounded-lg transition-colors",
                "hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              title="Mark as unread"
            >
              <Mail className="w-4 h-4" />
            </motion.button>

            {/* Divider */}
            <div className="w-px h-6 bg-gray-800 mx-1" />

            {/* Move to folder dropdown */}
            <div className="relative group">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                disabled={isPerformingAction}
                className={cn(
                  "p-2 rounded-lg transition-colors",
                  "hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                title="Move to folder"
              >
                <FolderInput className="w-4 h-4" />
              </motion.button>

              {/* Dropdown menu */}
              <div className="absolute top-full left-0 mt-1 bg-gray-800 rounded-lg shadow-xl border border-gray-700 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                <button
                  onClick={() => onMoveToFolder('inbox')}
                  disabled={currentFolder === 'inbox'}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Inbox
                </button>
                <button
                  onClick={() => onMoveToFolder('archive')}
                  disabled={currentFolder === 'archive'}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Archive
                </button>
                <button
                  onClick={() => onMoveToFolder('spam')}
                  disabled={currentFolder === 'spam'}
                  className="block w-full px-4 py-2 text-left text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  Spam
                </button>
              </div>
            </div>
          </div>

          {/* Loading indicator */}
          {isPerformingAction && (
            <>
              <div className="w-px h-6 bg-gray-800" />
              <Loader2 className="w-4 h-4 animate-spin text-[#37bd7e]" />
            </>
          )}

          {/* Divider */}
          <div className="w-px h-6 bg-gray-800" />

          {/* Close button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDeselectAll}
            disabled={isPerformingAction}
            className={cn(
              "p-2 rounded-lg transition-colors",
              "hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
            title="Deselect all"
          >
            <X className="w-4 h-4" />
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
