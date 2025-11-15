import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Star, 
  Archive, 
  Reply, 
  ReplyAll, 
  Forward, 
  Trash2, 
  MoreHorizontal,
  Paperclip,
  Download,
  ExternalLink,
  Clock,
  AlertCircle,
  Flag,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';

interface EmailThread {
  id: string;
  from: string;
  fromName: string;
  content: string;
  bodyHtml?: string;
  timestamp: Date;
  attachments?: string[];
}

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
  thread: EmailThread[];
}

interface EmailThreadProps {
  email: Email;
  onClose: () => void;
  onMarkRead: (emailId: string, read: boolean) => void;
  onStarEmail: (emailId: string, starred: boolean) => void;
  onArchiveEmail: (emailId: string) => void;
  onReply: () => void;
}

export function EmailThread({
  email,
  onClose,
  onMarkRead,
  onStarEmail,
  onArchiveEmail,
  onReply
}: EmailThreadProps) {
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set([email.thread[0]?.id]));
  const [showAllMessages, setShowAllMessages] = useState(false);

  const toggleMessage = (messageId: string) => {
    const newExpanded = new Set(expandedMessages);
    if (newExpanded.has(messageId)) {
      newExpanded.delete(messageId);
    } else {
      newExpanded.add(messageId);
    }
    setExpandedMessages(newExpanded);
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

  const formatContent = (content: string, html?: string) => {
    // If HTML is available, render it safely
    if (html) {
      // Sanitize HTML - remove potentially dangerous elements
      const sanitizedHtml = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
        .replace(/javascript:/gi, ''); // Remove javascript: URLs
      
      return (
        <div 
          className="email-html-content prose prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
          style={{
            // Sanitize and style HTML emails
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
            // Ensure images don't overflow
            maxWidth: '100%'
          }}
        />
      );
    }
    
    // Otherwise, format as plain text
    return content.split('\n').map((line, index) => (
      <p key={index} className={line.trim() === '' ? 'mb-2' : 'mb-1'}>
        {line || '\u00A0'}
      </p>
    ));
  };

  const visibleMessages = showAllMessages ? email.thread : email.thread.slice(0, 3);
  const hiddenMessageCount = email.thread.length - visibleMessages.length;

  return (
    <div className="h-full flex flex-col bg-gray-900/20 backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-gray-800/50">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {email.important && <AlertCircle className="w-4 h-4 text-red-400" />}
              <h1 className="text-xl font-semibold text-white truncate">{email.subject}</h1>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>{email.thread.length} message{email.thread.length > 1 ? 's' : ''}</span>
              <span>•</span>
              <span>{formatDistanceToNow(email.timestamp, { addSuffix: true })}</span>
              {email.attachments > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Paperclip className="w-3 h-3" />
                    <span>{email.attachments} attachment{email.attachments > 1 ? 's' : ''}</span>
                  </div>
                </>
              )}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800/70 transition-colors"
          >
            <X className="w-5 h-5" />
          </motion.button>
        </div>

        {/* Labels */}
        {email.labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            {email.labels.map((label) => (
              <span
                key={label}
                className={cn(
                  'px-2 py-1 text-xs font-medium rounded-full border',
                  getLabelColor(label)
                )}
              >
                {label}
              </span>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onReply}
            className="px-4 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Reply className="w-4 h-4" />
            Reply
          </motion.button>

          <div className="flex items-center gap-1">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onStarEmail(email.id, !email.starred)}
              className={cn(
                'p-2 rounded-lg transition-colors',
                email.starred
                  ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                  : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/70'
              )}
            >
              <Star className={cn('w-4 h-4', email.starred && 'fill-yellow-400')} />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onArchiveEmail(email.id)}
              className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 transition-colors"
            >
              <Archive className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => onMarkRead(email.id, !email.read)}
              className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 transition-colors"
            >
              {email.read ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </motion.button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="p-6 space-y-4">
          <AnimatePresence>
            {visibleMessages.map((message, index) => {
              const isExpanded = expandedMessages.has(message.id);
              const isLatest = index === email.thread.length - 1;

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'bg-gray-900/30 backdrop-blur-sm rounded-xl border border-gray-800/50 overflow-hidden',
                    isLatest && 'ring-1 ring-[#37bd7e]/20'
                  )}
                >
                  {/* Message Header */}
                  <motion.div
                    className="p-4 border-b border-gray-800/50 cursor-pointer"
                    onClick={() => !isLatest && toggleMessage(message.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#37bd7e]/20 flex items-center justify-center">
                          <span className="text-sm font-medium text-[#37bd7e]">
                            {message.fromName.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-white">{message.fromName}</div>
                          <div className="text-sm text-gray-400">{message.from}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-sm text-gray-400">
                          {format(message.timestamp, 'MMM d, h:mm a')}
                        </div>
                        {!isLatest && (
                          <motion.button
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            className="p-1 rounded hover:bg-gray-800/50 transition-colors"
                          >
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </motion.div>

                  {/* Message Content */}
                  <AnimatePresence>
                    {(isExpanded || isLatest) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: 'easeInOut' }}
                      >
                        <div className="p-4">
                          <div className="prose prose-invert max-w-none">
                            <div className="text-gray-200 whitespace-pre-wrap leading-relaxed">
                              {formatContent(message.content, message.bodyHtml)}
                            </div>
                          </div>

                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-800/50">
                              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                                <Paperclip className="w-4 h-4" />
                                Attachments ({message.attachments.length})
                              </h4>
                              <div className="space-y-2">
                                {message.attachments.map((attachment, attachIndex) => (
                                  <motion.div
                                    key={attachIndex}
                                    whileHover={{ scale: 1.02 }}
                                    className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50 hover:border-gray-600/50 transition-colors cursor-pointer"
                                  >
                                    <div className="w-8 h-8 rounded bg-[#37bd7e]/20 flex items-center justify-center">
                                      <Paperclip className="w-4 h-4 text-[#37bd7e]" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm text-gray-200 truncate">
                                        {attachment}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        PDF Document • 2.3 MB
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="p-1 rounded hover:bg-gray-700/50 transition-colors"
                                      >
                                        <Download className="w-4 h-4 text-gray-400" />
                                      </motion.button>
                                      <motion.button
                                        whileHover={{ scale: 1.1 }}
                                        whileTap={{ scale: 0.9 }}
                                        className="p-1 rounded hover:bg-gray-700/50 transition-colors"
                                      >
                                        <ExternalLink className="w-4 h-4 text-gray-400" />
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Show More Messages */}
          {hiddenMessageCount > 0 && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAllMessages(true)}
              className="w-full p-4 bg-gray-800/30 hover:bg-gray-800/50 rounded-xl border border-gray-700/50 transition-colors flex items-center justify-center gap-2 text-gray-300"
            >
              <ChevronUp className="w-4 h-4" />
              Show {hiddenMessageCount} earlier message{hiddenMessageCount > 1 ? 's' : ''}
            </motion.button>
          )}
        </div>
      </div>

      {/* Quick Reply Actions */}
      <div className="p-6 border-t border-gray-800/50 bg-gray-900/50">
        <div className="flex items-center gap-2 flex-wrap">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onReply}
            className="flex-1 px-4 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Reply className="w-4 h-4" />
            Reply
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-gray-800/50 hover:bg-gray-800/70 text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <ReplyAll className="w-4 h-4" />
            Reply All
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-4 py-2 bg-gray-800/50 hover:bg-gray-800/70 text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            <Forward className="w-4 h-4" />
            Forward
          </motion.button>
        </div>
      </div>
    </div>
  );
}