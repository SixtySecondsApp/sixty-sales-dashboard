import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  Paperclip, 
  Flag, 
  Archive, 
  Trash2, 
  MoreHorizontal,
  Clock,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

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
}

export function EmailList({
  emails,
  selectedEmail,
  onSelectEmail,
  onMarkRead,
  onStarEmail,
  onArchiveEmail,
  searchQuery
}: EmailListProps) {
  const [hoveredEmail, setHoveredEmail] = useState<string | null>(null);

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

  const sortedEmails = useMemo(() => {
    return [...emails].sort((a, b) => {
      // Unread emails first, then by timestamp
      if (a.read !== b.read) {
        return a.read ? 1 : -1;
      }
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [emails]);

  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <CheckCircle2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">All caught up!</h3>
          <p className="text-gray-500">No emails match your current filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-200">
            {searchQuery ? `Search results (${emails.length})` : `Inbox (${emails.length})`}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              {emails.filter(e => !e.read).length} unread
            </span>
          </div>
        </div>
      </div>

      {/* Email List with Virtual Scrolling */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-px">
          <AnimatePresence>
            {sortedEmails.map((email, index) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.03, duration: 0.3 }}
                layout
                className={cn(
                  'relative group cursor-pointer border-l-2 transition-all duration-200',
                  selectedEmail === email.id
                    ? 'bg-[#37bd7e]/10 border-l-[#37bd7e] backdrop-blur-sm'
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
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
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
                                className="p-1 rounded hover:bg-gray-700/50 transition-colors"
                              >
                                <Archive className="w-3 h-3 text-gray-400" />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onStarEmail(email.id, !email.starred);
                                }}
                                className="p-1 rounded hover:bg-gray-700/50 transition-colors"
                              >
                                <Star className={cn(
                                  'w-3 h-3',
                                  email.starred ? 'text-yellow-400 fill-yellow-400' : 'text-gray-400'
                                )} />
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                className="p-1 rounded hover:bg-gray-700/50 transition-colors"
                              >
                                <MoreHorizontal className="w-3 h-3 text-gray-400" />
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

                      <div className="text-sm text-gray-500 truncate mb-2">
                        {highlightText(email.preview, searchQuery)}
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
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}