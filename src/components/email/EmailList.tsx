import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Star,
  Paperclip,
  Flag,
  Archive,
  Trash2,
  MoreHorizontal,
  Clock,
  AlertCircle,
  CheckCircle2,
  Square,
  CheckSquare,
  MinusSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { EmailListSkeleton } from './EmailSkeleton';
import { NoEmailsEmptyState, NoSearchResultsEmptyState, GmailNotConnectedEmptyState } from './EmailEmptyStates';
import { useBulkEmailActions } from '@/lib/hooks/useBulkEmailActions';
import { BulkActionsToolbar } from './BulkActionsToolbar';
import { EmailAnalysisBadge } from './EmailAnalysisBadge';
import {
  getEmailLabel,
  getEmailFolderLabel,
  getEmailLoadingAnnouncement,
  announceToScreenReader,
  KEYBOARD_KEYS
} from '@/lib/utils/accessibilityUtils';
import {
  createSwipeHandlers,
  isTouchDevice,
  hapticFeedback
} from '@/lib/utils/mobileUtils';

interface Email {
  id: string;
  from: string;
  fromName: string;
  subject: string;
  preview: string;
  timestamp: Date;
  read: boolean;
  starred: boolean;
  important: boolean;
  labels: string[];
  attachments: number;
  thread: any[];
}

interface EmailListProps {
  emails: Email[];
  selectedEmail: string | null;
  onSelectEmail: (emailId: string) => void;
  onMarkRead: (emailId: string, read: boolean) => void;
  onStarEmail: (emailId: string, starred: boolean) => void;
  onArchiveEmail: (emailId: string) => void;
  searchQuery: string;
  isLoading?: boolean;
  onClearSearch?: () => void;
  isGmailConnected?: boolean;
  onConnectGmail?: () => void;
  onRefetch?: () => void;
  currentFolder?: string;
}

export function EmailList({
  emails,
  selectedEmail,
  onSelectEmail,
  onMarkRead,
  onStarEmail,
  onArchiveEmail,
  searchQuery,
  isLoading = false,
  onClearSearch,
  isGmailConnected = true,
  onConnectGmail,
  onRefetch,
  currentFolder = 'inbox'
}: EmailListProps) {
  const [hoveredEmail, setHoveredEmail] = useState<string | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const listRef = useRef<HTMLDivElement>(null);
  const [isTouch] = useState(() => isTouchDevice());

  // Bulk actions hook
  const bulkActions = useBulkEmailActions({
    onSuccess: () => {
      onRefetch?.();
    }
  });

  const sortedEmails = useMemo(() => {
    return [...emails].sort((a, b) => {
      // Unread emails first, then by timestamp (verified unique)
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [emails]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!listRef.current || sortedEmails.length === 0) return;

      // Only handle keyboard navigation when list is focused
      if (!listRef.current.contains(document.activeElement)) return;

      switch (e.key) {
        case KEYBOARD_KEYS.ARROW_DOWN:
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = Math.min(prev + 1, sortedEmails.length - 1);
            announceToScreenReader(getEmailLabel({
              from: sortedEmails[next].fromName,
              subject: sortedEmails[next].subject,
              preview: sortedEmails[next].preview,
              timestamp: sortedEmails[next].timestamp,
              read: sortedEmails[next].read,
              starred: sortedEmails[next].starred,
              attachments: sortedEmails[next].attachments
            }), 'polite');
            return next;
          });
          break;

        case KEYBOARD_KEYS.ARROW_UP:
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = Math.max(prev - 1, 0);
            announceToScreenReader(getEmailLabel({
              from: sortedEmails[next].fromName,
              subject: sortedEmails[next].subject,
              preview: sortedEmails[next].preview,
              timestamp: sortedEmails[next].timestamp,
              read: sortedEmails[next].read,
              starred: sortedEmails[next].starred,
              attachments: sortedEmails[next].attachments
            }), 'polite');
            return next;
          });
          break;

        case KEYBOARD_KEYS.ENTER:
        case KEYBOARD_KEYS.SPACE:
          e.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < sortedEmails.length) {
            onSelectEmail(sortedEmails[focusedIndex].id);
            announceToScreenReader('Email opened');
          }
          break;

        case KEYBOARD_KEYS.HOME:
          e.preventDefault();
          setFocusedIndex(0);
          announceToScreenReader('First email');
          break;

        case KEYBOARD_KEYS.END:
          e.preventDefault();
          setFocusedIndex(sortedEmails.length - 1);
          announceToScreenReader('Last email');
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sortedEmails, focusedIndex, onSelectEmail]);

  // Set initial focus when emails load
  useEffect(() => {
    if (sortedEmails.length > 0 && focusedIndex === -1) {
      setFocusedIndex(0);
    }
  }, [sortedEmails.length]);

  // Announce loading state
  useEffect(() => {
    if (!isLoading && emails.length > 0) {
      announceToScreenReader(getEmailLoadingAnnouncement(false, emails.length));
    }
  }, [isLoading, emails.length]);

  // Create swipe handlers for email item
  const createEmailSwipeHandlers = useCallback((email: Email) => {
    if (!isTouch) return {};

    return createSwipeHandlers({
      onSwipeLeft: () => {
        // Swipe left = Archive
        hapticFeedback('medium');
        onArchiveEmail(email.id);
        announceToScreenReader(`Email from ${email.fromName} archived`);
      },
      onSwipeRight: () => {
        // Swipe right = Star/Unstar
        hapticFeedback('light');
        onStarEmail(email.id, !email.starred);
        announceToScreenReader(
          email.starred
            ? `Email from ${email.fromName} unstarred`
            : `Email from ${email.fromName} starred`
        );
      },
    });
  }, [isTouch, onArchiveEmail, onStarEmail]);

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} className="bg-[#37bd7e]/20 text-[#37bd7e] rounded px-1">
          {part}
        </mark>
      ) : part
    );
  };

  const getLabelColor = (label: string) => {
    const colors: Record<string, string> = {
      'work': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'urgent': 'bg-red-500/20 text-red-300 border-red-500/30',
      'investment': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'follow-up': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      'github': 'bg-gray-500/20 text-gray-300 border-gray-500/30',
      'notifications': 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      'client': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      'contract': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'supabase': 'bg-green-500/20 text-green-300 border-green-500/30',
      'backup': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    };
    return colors[label] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  // Virtual scrolling setup for performance with large lists
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: sortedEmails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 140, // Increased estimated height for better spacing
    overscan: 10, // Increased overscan for smoother scrolling with more emails
  });

  // Show loading skeleton
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b border-gray-800/50">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-200">Loading...</h2>
          </div>
        </div>
        <EmailListSkeleton count={10} />
      </div>
    );
  }

  // Show empty states
  if (emails.length === 0) {
    // Gmail not connected takes priority
    if (!isGmailConnected) {
      return (
        <GmailNotConnectedEmptyState
          onConnect={onConnectGmail || (() => {})}
        />
      );
    }

    // Search query with no results
    if (searchQuery) {
      return (
        <NoSearchResultsEmptyState
          query={searchQuery}
          onClearSearch={onClearSearch || (() => {})}
        />
      );
    }

    // No emails at all
    return <NoEmailsEmptyState />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Bulk Actions Toolbar */}
      <BulkActionsToolbar
        selectedCount={bulkActions.selectedCount}
        isPerformingAction={bulkActions.isPerformingAction}
        onArchive={bulkActions.bulkArchive}
        onDelete={bulkActions.bulkDelete}
        onStar={bulkActions.bulkStar}
        onUnstar={bulkActions.bulkUnstar}
        onMarkRead={bulkActions.bulkMarkRead}
        onMarkUnread={bulkActions.bulkMarkUnread}
        onMoveToFolder={bulkActions.bulkMoveToFolder}
        onDeselectAll={bulkActions.deselectAll}
        currentFolder={currentFolder}
      />

      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Select All Checkbox */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (bulkActions.selectedCount === sortedEmails.length) {
                  bulkActions.deselectAll();
                } else {
                  bulkActions.selectAll(sortedEmails.map(e => e.id));
                }
              }}
              className={cn(
                'rounded hover:bg-gray-800 transition-colors',
                isTouch ? 'p-2.5 min-w-[44px] min-h-[44px]' : 'p-1'
              )}
              title={bulkActions.selectedCount > 0 ? "Deselect all" : "Select all"}
              aria-label={
                bulkActions.selectedCount === 0
                  ? "Select all emails"
                  : bulkActions.selectedCount === sortedEmails.length
                    ? `Deselect all ${sortedEmails.length} emails`
                    : `${bulkActions.selectedCount} of ${sortedEmails.length} emails selected, select all`
              }
            >
              {bulkActions.selectedCount === 0 ? (
                <Square className={cn(isTouch ? 'w-5 h-5' : 'w-4 h-4', 'text-gray-400')} />
              ) : bulkActions.selectedCount === sortedEmails.length ? (
                <CheckSquare className={cn(isTouch ? 'w-5 h-5' : 'w-4 h-4', 'text-[#37bd7e]')} />
              ) : (
                <MinusSquare className={cn(isTouch ? 'w-5 h-5' : 'w-4 h-4', 'text-[#37bd7e]')} />
              )}
            </motion.button>

            <h2 className="font-semibold text-gray-200">
              {searchQuery ? `Search results (${emails.length})` : `Inbox (${emails.length})`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {emails.filter(e => !e.read).length} unread
            </span>
          </div>
        </div>
      </div>

      {/* Email List with Virtual Scrolling */}
      <div
        ref={(el) => {
          (parentRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          (listRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className="flex-1 overflow-y-auto"
        role="list"
        aria-label={getEmailFolderLabel(currentFolder, emails.filter(e => !e.read).length)}
        tabIndex={0}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const email = sortedEmails[virtualRow.index];
            const swipeHandlers = createEmailSwipeHandlers(email);

            return (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ duration: 0.3 }}
                layout
                role="listitem"
                aria-label={getEmailLabel({
                  from: email.fromName,
                  subject: email.subject,
                  preview: email.preview,
                  timestamp: email.timestamp,
                  read: email.read,
                  starred: email.starred,
                  attachments: email.attachments
                })}
                aria-selected={selectedEmail === email.id}
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className={cn(
                  'relative group cursor-pointer border-l-2 transition-all duration-200',
                  selectedEmail === email.id
                    ? 'bg-[#37bd7e]/10 border-l-[#37bd7e] backdrop-blur-sm'
                    : focusedIndex === virtualRow.index
                      ? 'bg-gray-800/50 border-l-blue-400 ring-2 ring-blue-400/50'
                      : email.read
                        ? 'bg-gray-900/20 border-l-transparent hover:bg-gray-800/30'
                        : 'bg-gray-900/40 border-l-blue-500/50 hover:bg-gray-800/40'
                )}
                onMouseEnter={() => setHoveredEmail(email.id)}
                onMouseLeave={() => setHoveredEmail(null)}
                onClick={() => {
                  onSelectEmail(email.id);
                  if (!email.read) {
                    onMarkRead(email.id, true);
                  }
                }}
                {...swipeHandlers}
              >
                <div className="p-4 py-3">
                  <div className="flex items-start gap-3">
                    {/* Selection Checkbox */}
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        bulkActions.toggleEmailSelection(email.id);
                      }}
                      className={cn(
                        'rounded hover:bg-gray-800 transition-colors',
                        isTouch ? 'p-2.5 min-w-[44px] min-h-[44px]' : 'p-1 mt-0.5'
                      )}
                      aria-label={
                        bulkActions.isSelected(email.id)
                          ? `Deselect email from ${email.fromName}`
                          : `Select email from ${email.fromName}`
                      }
                      aria-checked={bulkActions.isSelected(email.id)}
                      role="checkbox"
                    >
                      {bulkActions.isSelected(email.id) ? (
                        <CheckSquare className={cn(isTouch ? 'w-5 h-5' : 'w-4 h-4', 'text-[#37bd7e]')} />
                      ) : (
                        <Square className={cn(isTouch ? 'w-5 h-5' : 'w-4 h-4', 'text-gray-400')} />
                      )}
                    </motion.button>

                    {/* Status Indicators */}
                    <div className="flex flex-col items-center gap-1 pt-1">
                      {!email.read && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      )}
                      {email.important && (
                        <AlertCircle className="w-3 h-3 text-red-400" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn(
                          'font-medium truncate',
                          email.read ? 'text-gray-300' : 'text-white'
                        )}>
                          {highlightText(email.fromName, searchQuery)}
                        </span>
                        
                        {/* Quick Actions (on hover) */}
                        <AnimatePresence>
                          {hoveredEmail === email.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-1 ml-auto"
                            >
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onArchiveEmail(email.id);
                                }}
                                className={cn(
                                  'rounded hover:bg-gray-700/50 transition-colors',
                                  isTouch ? 'p-2.5 min-w-[44px] min-h-[44px]' : 'p-1'
                                )}
                                aria-label={`Archive email from ${email.fromName}`}
                              >
                                <Archive className={cn(isTouch ? 'w-4 h-4' : 'w-3 h-3', 'text-gray-400')} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStarEmail(email.id, !email.starred);
                                }}
                                className={cn(
                                  'rounded hover:bg-gray-700/50 transition-colors',
                                  isTouch ? 'p-2.5 min-w-[44px] min-h-[44px]' : 'p-1'
                                )}
                                aria-label={
                                  email.starred
                                    ? `Unstar email from ${email.fromName}`
                                    : `Star email from ${email.fromName}`
                                }
                                aria-pressed={email.starred}
                              >
                                <Star className={cn(
                                  isTouch ? 'w-4 h-4' : 'w-3 h-3',
                                  email.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'
                                )} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className={cn(
                                  'rounded hover:bg-gray-700/50 transition-colors',
                                  isTouch ? 'p-2.5 min-w-[44px] min-h-[44px]' : 'p-1'
                                )}
                                aria-label={`More actions for email from ${email.fromName}`}
                              >
                                <MoreHorizontal className={cn(isTouch ? 'w-4 h-4' : 'w-3 h-3', 'text-gray-400')} />
                              </motion.button>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Timestamp */}
                        <span className="text-xs text-gray-500 whitespace-nowrap ml-auto">
                          {email.timestamp && !isNaN(email.timestamp.getTime()) 
                            ? formatDistanceToNow(email.timestamp, { addSuffix: true })
                            : 'Unknown time'
                          }
                        </span>
                      </div>

                      <div className={cn(
                        'font-medium mb-1 truncate',
                        email.read ? 'text-gray-400' : 'text-gray-200'
                      )}>
                        {highlightText(email.subject, searchQuery)}
                      </div>

                      <div className="text-sm text-gray-500 truncate mb-1.5">
                        {highlightText(email.preview, searchQuery)}
                      </div>

                      {/* AI Analysis Badge */}
                      <div className="mb-1.5">
                        <EmailAnalysisBadge email={email as any} compact={true} />
                      </div>

                      {/* Labels and Metadata */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {email.labels.slice(0, 2).map((label) => (
                          <span
                            key={label}
                            className={cn(
                              'px-2 py-0.5 text-xs font-medium rounded-full border',
                              getLabelColor(label)
                            )}
                          >
                            {label}
                          </span>
                        ))}
                        
                        {email.labels.length > 2 && (
                          <span className="text-xs text-gray-500">
                            +{email.labels.length - 2} more
                          </span>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          {email.attachments > 0 && (
                            <div className="flex items-center gap-1 text-gray-500">
                              <Paperclip className="w-3 h-3" />
                              <span className="text-xs">{email.attachments}</span>
                            </div>
                          )}
                          
                          {email.starred && hoveredEmail !== email.id && (
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selection Indicator */}
                {selectedEmail === email.id && (
                  <motion.div
                    layoutId="selectedEmail"
                    className="absolute inset-y-0 left-0 w-1 bg-[#37bd7e]"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}