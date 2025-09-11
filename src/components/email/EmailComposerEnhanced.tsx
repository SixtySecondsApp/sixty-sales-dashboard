import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Send,
  Paperclip,
  Image,
  Smile,
  Bold,
  Italic,
  Underline,
  Link,
  List,
  ListOrdered,
  Quote,
  Code,
  MoreHorizontal,
  Clock,
  Calendar,
  ChevronDown,
  User,
  Users,
  Eye,
  EyeOff,
  Trash2,
  Save,
  FileText,
  Zap,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGmailSend } from '@/lib/hooks/useGoogleIntegration';
import { toast } from 'sonner';
import { format, addDays, addHours } from 'date-fns';

interface EmailComposerEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  replyTo?: any;
  template?: EmailTemplate;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: 'sales' | 'follow-up' | 'introduction' | 'thank-you' | 'custom';
}

const emailTemplates: EmailTemplate[] = [
  {
    id: '1',
    name: 'Sales Introduction',
    subject: 'Quick Introduction - [Your Company]',
    body: `Hi [Name],

I hope this email finds you well. I wanted to reach out because I noticed [relevant trigger/reason].

At [Your Company], we help businesses like yours [value proposition]. We've helped companies achieve [specific results].

Would you be open to a brief 15-minute call next week to discuss how we might be able to help [their company]?

Best regards,
[Your Name]`,
    category: 'introduction'
  },
  {
    id: '2',
    name: 'Follow-up After Meeting',
    subject: 'Great connecting today - Next steps',
    body: `Hi [Name],

Thank you for taking the time to meet with me today. I enjoyed our conversation about [topic discussed].

As discussed, here are the next steps:
1. [Action item 1]
2. [Action item 2]
3. [Action item 3]

I'll follow up [timeframe] with [deliverable].

Please let me know if you have any questions in the meantime.

Best regards,
[Your Name]`,
    category: 'follow-up'
  },
  {
    id: '3',
    name: 'Thank You',
    subject: 'Thank you!',
    body: `Hi [Name],

I wanted to send a quick note to thank you for [specific reason].

[Personal note about the interaction]

Looking forward to [future interaction/next steps].

Best regards,
[Your Name]`,
    category: 'thank-you'
  }
];

const emailSignatures = [
  {
    id: '1',
    name: 'Professional',
    html: `<div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e5e5;">
      <div style="font-family: Arial, sans-serif;">
        <div style="font-weight: bold; color: #333;">John Doe</div>
        <div style="color: #666; font-size: 14px;">Sales Director</div>
        <div style="color: #666; font-size: 14px;">Sixty Sales</div>
        <div style="margin-top: 10px; font-size: 14px;">
          <a href="tel:+1234567890" style="color: #37bd7e; text-decoration: none;">+1 (234) 567-890</a> | 
          <a href="mailto:john@sixtysales.com" style="color: #37bd7e; text-decoration: none;">john@sixtysales.com</a>
        </div>
        <div style="margin-top: 10px;">
          <a href="https://linkedin.com" style="margin-right: 10px;"><img src="/linkedin.png" alt="LinkedIn" width="20" height="20"/></a>
          <a href="https://twitter.com"><img src="/twitter.png" alt="Twitter" width="20" height="20"/></a>
        </div>
      </div>
    </div>`
  },
  {
    id: '2',
    name: 'Simple',
    html: `<div style="margin-top: 20px; font-family: Arial, sans-serif; color: #666;">
      Best regards,<br/>
      John Doe<br/>
      Sixty Sales | Sales Director<br/>
      john@sixtysales.com
    </div>`
  }
];

export function EmailComposerEnhanced({
  isOpen,
  onClose,
  replyTo,
  template
}: EmailComposerEnhancedProps) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [selectedSignature, setSelectedSignature] = useState(emailSignatures[0]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const sendEmail = useGmailSend();

  useEffect(() => {
    if (replyTo) {
      setTo(replyTo.from);
      setSubject(`Re: ${replyTo.subject}`);
    }
    if (template) {
      setSelectedTemplate(template);
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [replyTo, template]);

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      // Add signature to body
      const fullBody = `${body}\n\n${selectedSignature.html}`;
      
      if (isScheduled && scheduleDate) {
        // TODO: Implement scheduled sending
        toast.info('Email scheduled for ' + format(new Date(scheduleDate), 'PPpp'));
      } else {
        await sendEmail.mutateAsync({
          to,
          cc,
          bcc,
          subject,
          body: fullBody,
          attachments: attachments.map(f => f.name)
        });
        toast.success('Email sent successfully');
      }
      
      handleClose();
    } catch (error) {
      toast.error('Failed to send email');
    }
  };

  const handleSaveDraft = () => {
    setIsDraft(true);
    // TODO: Save to drafts
    toast.success('Email saved as draft');
  };

  const handleClose = () => {
    if (body && !isDraft) {
      if (!confirm('Discard email draft?')) return;
    }
    setTo('');
    setCc('');
    setBcc('');
    setSubject('');
    setBody('');
    setAttachments([]);
    setIsScheduled(false);
    setScheduleDate('');
    setSelectedTemplate(null);
    setShowCc(false);
    setShowBcc(false);
    setIsDraft(false);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setBody(template.body);
    setShowTemplates(false);
    toast.success(`Applied "${template.name}" template`);
  };

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    const url = prompt('Enter URL:');
    if (url) {
      formatText('createLink', url);
    }
  };

  const scheduleSuggestions = [
    { label: 'Tomorrow morning', value: addHours(addDays(new Date(), 1), 9) },
    { label: 'Tomorrow afternoon', value: addHours(addDays(new Date(), 1), 14) },
    { label: 'Next Monday', value: addDays(new Date(), ((1 - new Date().getDay() + 7) % 7) || 7) },
    { label: 'Next week', value: addDays(new Date(), 7) }
  ];

  const aiSuggestions = [
    { type: 'greeting', text: 'Hope this email finds you well.' },
    { type: 'closing', text: 'Looking forward to hearing from you.' },
    { type: 'follow-up', text: 'I wanted to follow up on our previous conversation.' },
    { type: 'thanks', text: 'Thank you for your time and consideration.' }
  ];

  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed bottom-4 right-4 bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-2xl cursor-pointer"
        onClick={() => setIsMinimized(false)}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 bg-[#37bd7e] rounded-full animate-pulse" />
          <span className="text-sm font-medium">Composing: {subject || 'New Email'}</span>
        </div>
      </motion.div>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Send className="w-5 h-5 text-[#37bd7e]" />
                {replyTo ? 'Reply' : 'New Email'}
              </h2>
              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMinimized(true)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 p-2 border-b border-gray-800">
              <button
                onClick={() => formatText('bold')}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Bold"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('italic')}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Italic"
              >
                <Italic className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('underline')}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Underline"
              >
                <Underline className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-800 mx-1" />
              <button
                onClick={insertLink}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Insert Link"
              >
                <Link className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('insertUnorderedList')}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Bullet List"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('insertOrderedList')}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Numbered List"
              >
                <ListOrdered className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('formatBlock', 'blockquote')}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Quote"
              >
                <Quote className="w-4 h-4" />
              </button>
              <button
                onClick={() => formatText('formatBlock', 'pre')}
                className="p-2 rounded hover:bg-gray-800 transition-colors"
                title="Code"
              >
                <Code className="w-4 h-4" />
              </button>
              <div className="w-px h-6 bg-gray-800 mx-1" />
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="p-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
                title="Templates"
              >
                <FileText className="w-4 h-4" />
                <span className="text-xs">Templates</span>
              </button>
              <button
                onClick={() => setShowAiSuggestions(!showAiSuggestions)}
                className="p-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
                title="AI Suggestions"
              >
                <Sparkles className="w-4 h-4 text-[#37bd7e]" />
                <span className="text-xs">AI</span>
              </button>
            </div>

            {/* Templates Dropdown */}
            {showTemplates && (
              <div className="absolute top-24 left-4 z-10 bg-gray-800 rounded-lg shadow-xl p-2 w-64 max-h-80 overflow-y-auto">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                  Email Templates
                </div>
                {emailTemplates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => applyTemplate(template)}
                    className="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors"
                  >
                    <div className="font-medium text-sm">{template.name}</div>
                    <div className="text-xs text-gray-400 capitalize">{template.category}</div>
                  </button>
                ))}
              </div>
            )}

            {/* AI Suggestions */}
            {showAiSuggestions && (
              <div className="absolute top-24 right-4 z-10 bg-gray-800 rounded-lg shadow-xl p-2 w-64">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
                  AI Suggestions
                </div>
                {aiSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setBody(prev => prev + '\n\n' + suggestion.text);
                      setShowAiSuggestions(false);
                    }}
                    className="w-full text-left p-2 rounded hover:bg-gray-700 transition-colors"
                  >
                    <div className="text-sm">{suggestion.text}</div>
                    <div className="text-xs text-gray-400 capitalize">{suggestion.type}</div>
                  </button>
                ))}
              </div>
            )}

            {/* Recipients */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-16">To:</label>
                <input
                  type="email"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="recipient@example.com"
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                />
                <button
                  onClick={() => setShowCc(!showCc)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Cc
                </button>
                <button
                  onClick={() => setShowBcc(!showBcc)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  Bcc
                </button>
              </div>

              {showCc && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400 w-16">Cc:</label>
                  <input
                    type="email"
                    value={cc}
                    onChange={(e) => setCc(e.target.value)}
                    placeholder="cc@example.com"
                    className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                  />
                </div>
              )}

              {showBcc && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400 w-16">Bcc:</label>
                  <input
                    type="email"
                    value={bcc}
                    onChange={(e) => setBcc(e.target.value)}
                    placeholder="bcc@example.com"
                    className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-400 w-16">Subject:</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                />
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-4 pt-0">
              <div
                ref={editorRef}
                contentEditable
                className="w-full h-full min-h-[200px] bg-gray-800/50 border border-gray-700 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#37bd7e]/50"
                onInput={(e) => setBody(e.currentTarget.textContent || '')}
                suppressContentEditableWarning
              >
                {body}
              </div>
            </div>

            {/* Attachments */}
            {attachments.length > 0 && (
              <div className="px-4 pb-2">
                <div className="flex flex-wrap gap-2">
                  {attachments.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded-lg text-sm"
                    >
                      <Paperclip className="w-3 h-3" />
                      <span>{file.name}</span>
                      <button
                        onClick={() => removeAttachment(idx)}
                        className="text-gray-400 hover:text-red-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schedule Options */}
            {isScheduled && (
              <div className="px-4 pb-2">
                <div className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg">
                  <Clock className="w-4 h-4 text-[#37bd7e]" />
                  <input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none"
                  />
                  <div className="flex gap-1 ml-auto">
                    {scheduleSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => setScheduleDate(format(suggestion.value, "yyyy-MM-dd'T'HH:mm"))}
                        className="px-2 py-1 text-xs bg-gray-700 rounded hover:bg-gray-600"
                      >
                        {suggestion.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between p-4 border-t border-gray-800">
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                  title="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsScheduled(!isScheduled)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    isScheduled
                      ? "bg-[#37bd7e]/20 text-[#37bd7e]"
                      : "bg-gray-800/50 hover:bg-gray-800"
                  )}
                  title="Schedule send"
                >
                  <Clock className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSaveDraft}
                  className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors"
                  title="Save draft"
                >
                  <Save className="w-4 h-4" />
                </motion.button>
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSend}
                  disabled={!to || !subject || sendEmail.isPending}
                  className="px-6 py-2 bg-[#37bd7e] hover:bg-[#2da76c] text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {sendEmail.isPending ? (
                    <>Sending...</>
                  ) : isScheduled ? (
                    <>
                      <Clock className="w-4 h-4" />
                      Schedule
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Send
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}