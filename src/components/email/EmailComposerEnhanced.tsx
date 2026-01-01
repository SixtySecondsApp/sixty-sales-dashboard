import { useState, useRef, useEffect, useMemo } from 'react';
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
  Sparkles,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGmailSend } from '@/lib/hooks/useGoogleIntegration';
import { useDraftAutosave } from '@/lib/hooks/useDraftAutosave';
import { DraftManager } from './DraftManager';
import { EmailDraft } from '@/lib/utils/draftStorage';
import { TemplateSelectorModal } from './TemplateSelectorModal';
import { type TemplateContext, type PersonalizedEmail } from '@/lib/services/salesTemplateService';
import { toast } from 'sonner';
import { format, addDays, addHours, formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase/clientV2';
import logger from '@/lib/utils/logger';
import { TipTapEditor } from './TipTapEditor';
import { scheduleEmail } from '@/lib/services/scheduledEmailService';
import { useUndoSend } from '@/lib/hooks/useUndoSend';
import { SmartReplyPanel } from './SmartReplyPanel';
import { ContactAutoComplete } from './ContactAutoComplete';
import { emailActivityLogger } from '@/lib/services/emailActivityLogger';
import {
  getComposerButtonLabel,
  getEmailActionAnnouncement,
  useEmailFocusTrap,
  KEYBOARD_KEYS,
  announceToScreenReader
} from '@/lib/utils/accessibilityUtils';

interface EmailComposerEnhancedProps {
  isOpen: boolean;
  onClose: () => void;
  replyTo?: any;
  template?: EmailTemplate;
  initialTo?: string;
  initialSubject?: string;
  initialBody?: string;
  contactId?: string;
  calendarEventId?: string;
  dealId?: string;
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
  template,
  initialTo,
  initialSubject,
  initialBody,
  contactId,
  calendarEventId,
  dealId
}: EmailComposerEnhancedProps) {
  const [to, setTo] = useState(initialTo || '');
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [subject, setSubject] = useState(initialSubject || '');
  const [body, setBody] = useState(initialBody || '');
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
  const [showDraftManager, setShowDraftManager] = useState(false);
  const [showSalesTemplates, setShowSalesTemplates] = useState(false);
  const [templateContext, setTemplateContext] = useState<TemplateContext | undefined>();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const sendEmail = useGmailSend();

  // Focus trap for accessibility
  useEmailFocusTrap(isOpen, modalRef, toInputRef);

  // Escape key handler to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === KEYBOARD_KEYS.ESCAPE && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Undo send functionality (5-second window)
  const { startUndoWindow, isUndoActive, remainingTime, cancelSend } = useUndoSend({
    onSendConfirmed: () => {
      toast.success('Email sent successfully');
      announceToScreenReader(getEmailActionAnnouncement('sent'));
      if (currentDraftId) {
        deleteCurrentDraft();
      }
      handleClose();
    },
  });

  // Prepare draft data for auto-save
  const draftData = useMemo(() => ({
    to,
    cc,
    bcc,
    subject,
    body,
    attachments: attachments.map(f => ({
      name: f.name,
      size: f.size,
      type: f.type
    })),
    isReply: !!replyTo,
    replyToId: replyTo?.id
  }), [to, cc, bcc, subject, body, attachments, replyTo]);

  // Auto-save hook
  const {
    currentDraftId,
    lastSaved,
    isSaving,
    hasUnsavedChanges,
    saveNow,
    deleteCurrentDraft,
    loadDraft
  } = useDraftAutosave(draftData, {
    enabled: isOpen,
    onDraftSaved: () => {
      setIsDraft(true);
    }
  });

  useEffect(() => {
    if (replyTo) {
      // Use replyTo field if available, otherwise use from
      setTo(replyTo.replyTo || replyTo.from);
      // Remove existing "Re:" prefix if present
      const subject = replyTo.subject || '';
      setSubject(subject.startsWith('Re:') ? subject : `Re: ${subject}`);
    } else if (initialTo || initialSubject || initialBody) {
      // Use initial values if provided (e.g., from query params)
      if (initialTo) setTo(initialTo);
      if (initialSubject) setSubject(initialSubject);
      if (initialBody) setBody(initialBody);
    }
    if (template) {
      setSelectedTemplate(template);
      setSubject(template.subject);
      setBody(template.body);
    }
  }, [replyTo, template, initialTo, initialSubject, initialBody]);

  // Build template context when modal opens with contact/calendar/deal IDs
  useEffect(() => {
    const buildTemplateContext = async () => {
      if (!showSalesTemplates) {
        return;
      }

      if (!contactId && !calendarEventId && !dealId) {
        setTemplateContext(undefined);
        return;
      }

      try {
        const context: TemplateContext = {};

        // Fetch contact if ID provided
        if (contactId) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('*')
            .eq('id', contactId)
            .single();

          if (contact) {
            context.contact = {
              id: contact.id,
              first_name: contact.first_name,
              last_name: contact.last_name,
              full_name: contact.full_name,
              email: contact.email,
              company_name: contact.company,
              title: contact.title,
              linkedin_url: contact.linkedin_url
            };
          }
        }

        // Fetch calendar event if ID provided
        if (calendarEventId) {
          const { data: event } = await supabase
            .from('calendar_events')
            .select('*')
            .eq('id', calendarEventId)
            .single();

          if (event) {
            context.calendar_event = {
              id: event.id,
              title: event.title,
              start_time: event.start_time,
              end_time: event.end_time,
              notes: event.description,
              location: event.location
            };
          }
        }

        // Fetch deal if ID provided
        if (dealId) {
          const { data: deal } = await supabase
            .from('deals')
            .select('*')
            .eq('id', dealId)
            .single();

          if (deal) {
            context.deal = {
              id: deal.id,
              name: deal.name,
              value: deal.value,
              stage: deal.stage_id || '',
              probability: deal.probability || 0,
              description: deal.notes
            };
          }
        }

        // Get current user profile
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profile) {
            context.user_profile = {
              id: profile.id,
              name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
              email: user.email || '',
              title: (profile as any).title || null,
              company: (profile as any).company_name || null
            };
          }
        }

        setTemplateContext(context);
        logger.log('📧 Built template context:', context);
      } catch (error) {
        logger.error('Failed to build template context:', error);
        setTemplateContext(undefined);
      }
    };

    buildTemplateContext();
  }, [showSalesTemplates, contactId, calendarEventId, dealId]);

  const handleSend = async () => {
    if (!to || !subject) {
      toast.error('Please fill in required fields');
      return;
    }

    try {
      // Add signature to body
      const fullBody = `${body}\n\n${selectedSignature.html}`;

      if (isScheduled && scheduleDate) {
        // Schedule email for later sending
        await scheduleEmail({
          to,
          cc,
          bcc,
          subject,
          body: fullBody,
          scheduledFor: new Date(scheduleDate),
          replyToMessageId: replyTo?.id,
          threadId: replyTo?.threadId,
          contactId,
          dealId,
          calendarEventId,
        });
        toast.success('Email scheduled for ' + format(new Date(scheduleDate), 'PPpp'));
        announceToScreenReader(getEmailActionAnnouncement('scheduled'));

        // Log scheduled email activity for CRM contacts
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await emailActivityLogger.logOutboundEmail({
            emailId: `scheduled-${Date.now()}`,
            subject,
            from: user.email || '',
            to,
            cc,
            direction: 'outbound',
            timestamp: new Date(scheduleDate), // Use scheduled time
            body: fullBody,
            threadId: replyTo?.threadId,
          });
        }

        // Delete draft after successful schedule
        if (currentDraftId) {
          deleteCurrentDraft();
        }
        handleClose();
      } else {
        // Use undo send window for immediate sends (5-second delay)
        startUndoWindow(async () => {
          await sendEmail.mutateAsync({
            to,
            cc,
            bcc,
            subject,
            body: fullBody,
            attachments: attachments.map(f => f.name)
          });

          // Log email activity for CRM contacts
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await emailActivityLogger.logOutboundEmail({
              emailId: `sent-${Date.now()}`, // Generate temp ID
              subject,
              from: user.email || '',
              to,
              cc,
              direction: 'outbound',
              timestamp: new Date(),
              body: fullBody,
              threadId: replyTo?.threadId,
            });
          }
        });
        // Don't close or delete draft here - handled in onSendConfirmed callback
      }
    } catch (error) {
      toast.error('Failed to send email');
    }
  };

  const handleSaveDraft = async () => {
    const savedDraft = await saveNow();
    if (savedDraft) {
      toast.success('Draft saved');
    }
  };

  const handleLoadDraft = (draft: EmailDraft) => {
    setTo(draft.to);
    setCc(draft.cc || '');
    setBcc(draft.bcc || '');
    setSubject(draft.subject);
    setBody(draft.body);
    setShowCc(!!draft.cc);
    setShowBcc(!!draft.bcc);
    // Note: Cannot restore actual File objects from stored drafts
    // Attachments would need to be re-uploaded
    toast.info('Draft loaded. Note: Attachments need to be re-uploaded.');
  };

  const handleClose = () => {
    // Don't prompt if draft is auto-saved or empty
    if (hasUnsavedChanges && !isDraft) {
      if (!confirm('You have unsaved changes. Close anyway?')) return;
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

  const handleSalesTemplateSelect = (personalized: PersonalizedEmail) => {
    setSubject(personalized.subject);
    setBody(personalized.body);

    toast.success('AI-personalized template applied successfully');
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
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="email-composer-title"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="flex items-center gap-4">
                <h2 id="email-composer-title" className="text-lg font-semibold flex items-center gap-2">
                  <Send className="w-5 h-5 text-[#37bd7e]" />
                  {replyTo ? 'Reply' : 'New Email'}
                </h2>

                {/* Auto-save status */}
                {currentDraftId && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    {isSaving ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : lastSaved ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                        <span>Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsMinimized(true)}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  aria-label={getComposerButtonLabel('minimize')}
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClose}
                  className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
                  aria-label={getComposerButtonLabel('close')}
                >
                  <X className="w-4 h-4" />
                </motion.button>
              </div>
            </div>

            {/* Toolbar - Templates and AI */}
            <div className="flex items-center gap-1 p-2 border-b border-gray-800" role="toolbar" aria-label="Email composer tools">
              <button
                onClick={() => setShowTemplates(!showTemplates)}
                className="p-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
                aria-label={getComposerButtonLabel('template')}
                aria-expanded={showTemplates}
              >
                <FileText className="w-4 h-4" />
                <span className="text-xs">Templates</span>
              </button>
              <button
                onClick={() => setShowSalesTemplates(true)}
                className="p-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
                aria-label={getComposerButtonLabel('aiTemplate')}
              >
                <Sparkles className="w-4 h-4 text-[#37bd7e]" />
                <span className="text-xs">AI Templates</span>
              </button>
              <button
                onClick={() => setShowAiSuggestions(!showAiSuggestions)}
                className="p-2 rounded hover:bg-gray-800 transition-colors flex items-center gap-1"
                aria-label={getComposerButtonLabel('aiSuggestion')}
                aria-expanded={showAiSuggestions}
              >
                <Zap className="w-4 h-4 text-yellow-400" />
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
                <ContactAutoComplete
                  value={to}
                  onChange={setTo}
                  placeholder="recipient@example.com"
                  className="flex-1"
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
                  <ContactAutoComplete
                    value={cc}
                    onChange={setCc}
                    placeholder="cc@example.com"
                    className="flex-1"
                  />
                </div>
              )}

              {showBcc && (
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400 w-16">Bcc:</label>
                  <ContactAutoComplete
                    value={bcc}
                    onChange={setBcc}
                    placeholder="bcc@example.com"
                    className="flex-1"
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
              <TipTapEditor
                content={body}
                onChange={setBody}
                placeholder="Write your email..."
                className="h-full"
              />
            </div>

            {/* AI Smart Reply Panel (shown when replying) */}
            {replyTo && (
              <SmartReplyPanel
                replyToEmail={replyTo}
                onSelectReply={(content) => {
                  setBody(content);
                }}
              />
            )}

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
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowDraftManager(true)}
                  className="px-3 py-2 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors flex items-center gap-2"
                  title="Manage drafts"
                >
                  <FileText className="w-4 h-4" />
                  <span className="text-sm">Drafts</span>
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

          {/* Draft Manager Modal */}
          <DraftManager
            isOpen={showDraftManager}
            onClose={() => setShowDraftManager(false)}
            onLoadDraft={handleLoadDraft}
            currentDraftId={currentDraftId}
          />

          {/* Sales Template Selector Modal */}
          <TemplateSelectorModal
            isOpen={showSalesTemplates}
            onClose={() => setShowSalesTemplates(false)}
            onSelect={handleSalesTemplateSelect}
            context={templateContext}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}