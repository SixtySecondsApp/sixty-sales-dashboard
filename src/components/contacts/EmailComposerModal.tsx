import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Send, 
  X, 
  Mail, 
  Plus, 
  Paperclip,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { googleEmailService, SendEmailRequest } from '@/lib/services/googleEmailService';

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactEmail?: string;
  contactName?: string;
  onSent?: (messageId: string) => void;
}

interface EmailField {
  value: string;
  error?: string;
}

interface EmailData {
  to: EmailField;
  cc: EmailField;
  bcc: EmailField;
  subject: EmailField;
  body: EmailField;
}

const EmailComposerModal: React.FC<EmailComposerModalProps> = ({
  isOpen,
  onClose,
  contactEmail,
  contactName,
  onSent
}) => {
  const [emailData, setEmailData] = useState<EmailData>({
    to: { value: '' },
    cc: { value: '' },
    bcc: { value: '' },
    subject: { value: '' },
    body: { value: '' }
  });
  
  const [isRichText, setIsRichText] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);

  // Initialize with contact email if provided
  useEffect(() => {
    if (contactEmail && isOpen) {
      setEmailData(prev => ({
        ...prev,
        to: { value: contactEmail }
      }));
    }
  }, [contactEmail, isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmailData({
        to: { value: '' },
        cc: { value: '' },
        bcc: { value: '' },
        subject: { value: '' },
        body: { value: '' }
      });
      setShowCc(false);
      setShowBcc(false);
      setIsSending(false);
    }
  }, [isOpen]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateEmailList = (emailString: string): { valid: boolean; emails: string[] } => {
    if (!emailString.trim()) return { valid: true, emails: [] };
    
    const emails = emailString.split(',').map(email => email.trim());
    const invalidEmails = emails.filter(email => !validateEmail(email));
    
    return {
      valid: invalidEmails.length === 0,
      emails: emails.filter(email => email)
    };
  };

  const updateField = (field: keyof EmailData, value: string) => {
    setEmailData(prev => ({
      ...prev,
      [field]: { value, error: undefined }
    }));
  };

  const validateForm = (): boolean => {
    const newEmailData = { ...emailData };
    let isValid = true;

    // Validate TO field
    const toValidation = validateEmailList(emailData.to.value);
    if (!emailData.to.value.trim()) {
      newEmailData.to.error = 'At least one recipient is required';
      isValid = false;
    } else if (!toValidation.valid) {
      newEmailData.to.error = 'Please enter valid email addresses';
      isValid = false;
    }

    // Validate CC field
    if (emailData.cc.value.trim()) {
      const ccValidation = validateEmailList(emailData.cc.value);
      if (!ccValidation.valid) {
        newEmailData.cc.error = 'Please enter valid email addresses';
        isValid = false;
      }
    }

    // Validate BCC field
    if (emailData.bcc.value.trim()) {
      const bccValidation = validateEmailList(emailData.bcc.value);
      if (!bccValidation.valid) {
        newEmailData.bcc.error = 'Please enter valid email addresses';
        isValid = false;
      }
    }

    // Validate subject
    if (!emailData.subject.value.trim()) {
      newEmailData.subject.error = 'Subject is required';
      isValid = false;
    }

    // Validate body
    if (!emailData.body.value.trim()) {
      newEmailData.body.error = 'Email body is required';
      isValid = false;
    }

    setEmailData(newEmailData);
    return isValid;
  };

  const handleSend = async () => {
    if (!validateForm()) {
      toast.error('Please correct the errors before sending');
      return;
    }

    setIsSending(true);

    try {
      const toValidation = validateEmailList(emailData.to.value);
      const ccValidation = validateEmailList(emailData.cc.value);
      const bccValidation = validateEmailList(emailData.bcc.value);

      const emailRequest: SendEmailRequest = {
        to: toValidation.emails,
        cc: ccValidation.emails.length > 0 ? ccValidation.emails : undefined,
        bcc: bccValidation.emails.length > 0 ? bccValidation.emails : undefined,
        subject: emailData.subject.value.trim(),
        body: emailData.body.value.trim(),
        isHtml: isRichText
      };

      const result = await googleEmailService.sendEmail(emailRequest);

      if (result.success) {
        toast.success('Email sent successfully!');
        if (onSent && result.messageId) {
          onSent(result.messageId);
        }
        onClose();
      } else {
        toast.error(result.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSend();
    }
  };

  const recipientCount = () => {
    const toEmails = validateEmailList(emailData.to.value).emails.length;
    const ccEmails = validateEmailList(emailData.cc.value).emails.length;
    const bccEmails = validateEmailList(emailData.bcc.value).emails.length;
    return toEmails + ccEmails + bccEmails;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/50">
        <DialogHeader className="flex flex-row items-center justify-between pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold text-white">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Mail className="h-5 w-5 text-blue-400" />
            </div>
            Compose Email
            {contactName && (
              <Badge variant="secondary" className="bg-slate-700/50 text-slate-300">
                to {contactName}
              </Badge>
            )}
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-slate-400 hover:text-white hover:bg-slate-800/50"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4" onKeyDown={handleKeyPress}>
          {/* To Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">To</label>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                {recipientCount() > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {recipientCount()} recipient{recipientCount() !== 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
            <Input
              value={emailData.to.value}
              onChange={(e) => updateField('to', e.target.value)}
              placeholder="recipient@example.com, another@example.com"
              className={`bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 ${
                emailData.to.error ? 'border-red-500/50' : ''
              }`}
            />
            {emailData.to.error && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {emailData.to.error}
              </div>
            )}
          </div>

          {/* CC/BCC Toggle Buttons */}
          <div className="flex gap-2">
            {!showCc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCc(true)}
                className="text-slate-400 hover:text-white text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                CC
              </Button>
            )}
            {!showBcc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBcc(true)}
                className="text-slate-400 hover:text-white text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                BCC
              </Button>
            )}
          </div>

          {/* CC Field */}
          {showCc && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">CC</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCc(false);
                    updateField('cc', '');
                  }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={emailData.cc.value}
                onChange={(e) => updateField('cc', e.target.value)}
                placeholder="cc@example.com, another@example.com"
                className={`bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 ${
                  emailData.cc.error ? 'border-red-500/50' : ''
                }`}
              />
              {emailData.cc.error && (
                <div className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {emailData.cc.error}
                </div>
              )}
            </motion.div>
          )}

          {/* BCC Field */}
          {showBcc && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">BCC</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowBcc(false);
                    updateField('bcc', '');
                  }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <Input
                value={emailData.bcc.value}
                onChange={(e) => updateField('bcc', e.target.value)}
                placeholder="bcc@example.com, another@example.com"
                className={`bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 ${
                  emailData.bcc.error ? 'border-red-500/50' : ''
                }`}
              />
              {emailData.bcc.error && (
                <div className="flex items-center gap-1 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  {emailData.bcc.error}
                </div>
              )}
            </motion.div>
          )}

          {/* Subject Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Subject</label>
            <Input
              value={emailData.subject.value}
              onChange={(e) => updateField('subject', e.target.value)}
              placeholder="Email subject"
              className={`bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 ${
                emailData.subject.error ? 'border-red-500/50' : ''
              }`}
            />
            {emailData.subject.error && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {emailData.subject.error}
              </div>
            )}
          </div>

          {/* Body Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-300">Message</label>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={isRichText ? "default" : "secondary"}
                  className="text-xs cursor-pointer"
                  onClick={() => setIsRichText(!isRichText)}
                >
                  {isRichText ? 'HTML' : 'Plain Text'}
                </Badge>
              </div>
            </div>
            <Textarea
              value={emailData.body.value}
              onChange={(e) => updateField('body', e.target.value)}
              placeholder={isRichText ? "Write your message here... (HTML supported)" : "Write your message here..."}
              rows={12}
              className={`bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-400 focus:border-blue-500/50 resize-none ${
                emailData.body.error ? 'border-red-500/50' : ''
              }`}
            />
            {emailData.body.error && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <AlertCircle className="h-3 w-3" />
                {emailData.body.error}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-6 border-t border-slate-700/50">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-white"
              disabled
            >
              <Paperclip className="h-4 w-4 mr-1" />
              Attach
            </Button>
            <div className="text-xs text-slate-500">
              Ctrl/Cmd + Enter to send
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              disabled={isSending}
              className="text-slate-400 hover:text-white"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailComposerModal;