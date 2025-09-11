import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Send, 
  Paperclip, 
  Bold, 
  Italic, 
  Underline, 
  List, 
  Link,
  Image,
  Smile,
  Calendar,
  Clock,
  Minimize2,
  Maximize2,
  Trash2,
  Save,
  Sparkles,
  Zap,
  MessageSquare,
  Eye
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  replyTo?: Email | null;
}

export function EmailComposer({ isOpen, onClose, replyTo }: EmailComposerProps) {
  const [to, setTo] = useState(replyTo?.from || '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '');
  const [content, setContent] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDrafting, setIsDrafting] = useState(false);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [scheduledSend, setScheduledSend] = useState<Date | null>(null);
  
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save draft
  useEffect(() => {
    if (!isOpen) return;
    
    const saveDraft = () => {
      if (to || subject || content) {
        setIsDrafting(true);
        // Simulate saving
        setTimeout(() => setIsDrafting(false), 500);
      }
    };

    const interval = setInterval(saveDraft, 5000);
    return () => clearInterval(interval);
  }, [isOpen, to, subject, content]);

  const handleSend = async () => {
    if (!to || !content) return;
    
    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Reset form
    setTo('');
    setCc('');
    setBcc('');
    setSubject('');
    setContent('');
    setAttachments([]);
    onClose();
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const insertText = (before: string, after: string = '') => {
    const textarea = contentRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = content.substring(0, start) + before + selectedText + after + content.substring(end);
    
    setContent(newText);
    
    // Reset cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const aiSuggestions = [
    { icon: Sparkles, label: 'Polish writing', description: 'Improve grammar and tone' },
    { icon: Zap, label: 'Make shorter', description: 'Reduce word count' },
    { icon: MessageSquare, label: 'Add greeting', description: 'Insert professional greeting' },
    { icon: Calendar, label: 'Suggest meeting', description: 'Add meeting request' },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ 
            scale: isMinimized ? 0.95 : 1, 
            opacity: 1, 
            y: 0,
            height: isMinimized ? 'auto' : '80vh'
          }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={cn(
            'bg-gray-900/90 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden',
            isMinimized ? 'w-96' : 'w-full max-w-4xl'
          )}
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-white">
                {replyTo ? 'Reply' : 'New Message'}
              </h2>
              {isDrafting && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-1 text-xs text-gray-400"
                >
                  <Save className="w-3 h-3" />
                  Saving draft...
                </motion.div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAIAssist(!showAIAssist)}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  showAIAssist 
                    ? 'bg-[#37bd7e]/20 text-[#37bd7e]'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800/70'
                )}
              >
                <Sparkles className="w-4 h-4" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 transition-colors"
              >
                {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className="p-2 rounded-lg bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Recipients */}
              <div className="p-4 space-y-3 border-b border-gray-800/50">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-300 w-12">To:</label>
                  <input
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    placeholder="Enter recipient email"
                    className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none"
                    multiple
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowCc(!showCc)}
                      className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      Cc
                    </button>
                    <button
                      onClick={() => setShowBcc(!showBcc)}
                      className="text-xs text-gray-400 hover:text-gray-300 transition-colors"
                    >
                      Bcc
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showCc && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-3"
                    >
                      <label className="text-sm font-medium text-gray-300 w-12">Cc:</label>
                      <input
                        type="email"
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        placeholder="Carbon copy"
                        className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {showBcc && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-3"
                    >
                      <label className="text-sm font-medium text-gray-300 w-12">Bcc:</label>
                      <input
                        type="email"
                        value={bcc}
                        onChange={(e) => setBcc(e.target.value)}
                        placeholder="Blind carbon copy"
                        className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-300 w-12">Subject:</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Email subject"
                    className="flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* AI Assistant Panel */}
              <AnimatePresence>
                {showAIAssist && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-4 bg-gray-800/30 border-b border-gray-800/50"
                  >
                    <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#37bd7e]" />
                      AI Writing Assistant
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      {aiSuggestions.map((suggestion, index) => (
                        <motion.button
                          key={index}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="p-3 bg-gray-700/30 hover:bg-gray-700/50 rounded-lg border border-gray-600/30 transition-colors text-left"
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <suggestion.icon className="w-4 h-4 text-[#37bd7e]" />
                            <span className="text-sm font-medium text-white">{suggestion.label}</span>
                          </div>
                          <p className="text-xs text-gray-400">{suggestion.description}</p>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toolbar */}
              <div className="p-3 border-b border-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => insertText('**', '**')}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <Bold className="w-4 h-4 text-gray-400" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => insertText('*', '*')}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <Italic className="w-4 h-4 text-gray-400" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => insertText('_', '_')}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <Underline className="w-4 h-4 text-gray-400" />
                  </motion.button>
                  <div className="w-px h-4 bg-gray-700 mx-1" />
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => insertText('- ')}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <List className="w-4 h-4 text-gray-400" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => insertText('[', '](url)')}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <Link className="w-4 h-4 text-gray-400" />
                  </motion.button>
                </div>

                <div className="flex items-center gap-1">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <Paperclip className="w-4 h-4 text-gray-400" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <Image className="w-4 h-4 text-gray-400" />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-2 rounded hover:bg-gray-800/50 transition-colors"
                  >
                    <Smile className="w-4 h-4 text-gray-400" />
                  </motion.button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 flex gap-4">
                <div className="flex-1">
                  <textarea
                    ref={contentRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write your message..."
                    className="w-full h-full bg-transparent border-none text-white placeholder-gray-500 resize-none focus:outline-none"
                  />
                </div>

                {/* Live Preview */}
                {content && (
                  <div className="w-1/3 border-l border-gray-800/50 pl-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Eye className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-400">Preview</span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <div className="text-gray-300 whitespace-pre-wrap">
                        {content}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Attachments */}
              <AnimatePresence>
                {attachments.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="p-4 border-t border-gray-800/50"
                  >
                    <h3 className="text-sm font-medium text-gray-300 mb-3">
                      Attachments ({attachments.length})
                    </h3>
                    <div className="space-y-2">
                      {attachments.map((file, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 p-2 bg-gray-800/30 rounded-lg"
                        >
                          <Paperclip className="w-4 h-4 text-[#37bd7e]" />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-200 truncate">
                              {file.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatFileSize(file.size)}
                            </div>
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={() => removeAttachment(index)}
                            className="p-1 rounded hover:bg-gray-700/50 transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="p-4 border-t border-gray-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    <Clock className="w-4 h-4" />
                    Schedule send
                  </motion.button>
                </div>

                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={onClose}
                    className="px-4 py-2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    Discard
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleSend}
                    disabled={!to || !content}
                    className="px-6 py-2 bg-[#37bd7e] hover:bg-[#2da76c] disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </motion.button>
                </div>
              </div>
            </>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}