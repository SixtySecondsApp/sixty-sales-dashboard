import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { sendBulkInvites, getInviteStats } from '@/lib/services/emailInviteService';
import type { SendInvitesResult } from '@/lib/services/emailInviteService';

interface EmailInviteFormProps {
  entryId: string;
  referralCode: string;
  senderName: string;
}

export function EmailInviteForm({ entryId, referralCode, senderName }: EmailInviteFormProps) {
  const [emails, setEmails] = useState<string[]>(['', '', '']);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SendInvitesResult | null>(null);
  const [showResult, setShowResult] = useState(false);

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const addEmailField = () => {
    if (emails.length < 5) {
      setEmails([...emails, '']);
    }
  };

  const removeEmailField = (index: number) => {
    if (emails.length > 1) {
      const newEmails = emails.filter((_, i) => i !== index);
      setEmails(newEmails);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    setShowResult(false);

    // Filter out empty emails
    const filledEmails = emails.filter(email => email.trim().length > 0);

    if (filledEmails.length === 0) {
      setResult({
        success: false,
        sent: 0,
        failed: 0,
        total: 0,
        errors: ['Please enter at least one email address']
      });
      setShowResult(true);
      setIsSubmitting(false);
      return;
    }

    try {
      const sendResult = await sendBulkInvites({
        waitlist_entry_id: entryId,
        emails: filledEmails,
        referral_code: referralCode,
        sender_name: senderName
      });

      setResult(sendResult);
      setShowResult(true);

      // Clear form if all emails sent successfully
      if (sendResult.success && sendResult.failed === 0) {
        setEmails(['', '', '']);
      }
    } catch (error) {
      setResult({
        success: false,
        sent: 0,
        failed: filledEmails.length,
        total: filledEmails.length,
        errors: ['An unexpected error occurred. Please try again.']
      });
      setShowResult(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 2.2, duration: 0.8 }}
      className="bg-white/5 border border-white/10 rounded-xl p-4"
    >
      {/* Header */}
      <div className="flex items-center justify-center gap-2 mb-3">
        <Mail className="w-5 h-5 text-blue-400" />
        <h3 className="font-heading text-lg font-bold text-white">Invite Friends via Email</h3>
      </div>

      <p className="text-gray-400 text-center text-sm mb-4">
        Invite up to 5 revenue leaders. Each referral gets you <strong className="text-white">5 spots ahead</strong> in line.
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Email Inputs */}
        <div className="space-y-2">
          {emails.map((email, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex gap-2"
            >
              <Input
                type="email"
                placeholder={`Email ${index + 1}`}
                value={email}
                onChange={(e) => handleEmailChange(index, e.target.value)}
                className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 text-sm"
                disabled={isSubmitting}
              />
              {emails.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeEmailField(index)}
                  disabled={isSubmitting}
                  className="text-gray-400 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </motion.div>
          ))}
        </div>

        {/* Add More Button */}
        {emails.length < 5 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addEmailField}
            disabled={isSubmitting}
            className="w-full border-white/10 hover:bg-white/10 text-sm"
          >
            + Add Another Email
          </Button>
        )}

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Sending Invites...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Send Invites
            </>
          )}
        </Button>
      </form>

      {/* Result Message */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4"
          >
            {result.success ? (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-emerald-400 font-medium text-sm">
                      {result.sent === 1 ? 'Invite sent!' : `${result.sent} invites sent!`}
                    </p>
                    <p className="text-emerald-300 text-xs mt-1">
                      Your friends will receive an email with your referral link.
                    </p>
                    {result.failed > 0 && (
                      <p className="text-yellow-400 text-xs mt-1">
                        {result.failed} {result.failed === 1 ? 'invite' : 'invites'} failed. Check the errors below.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-medium text-sm">Failed to send invites</p>
                    {result.errors.length > 0 && (
                      <ul className="text-red-300 text-xs mt-1 space-y-1">
                        {result.errors.map((error, index) => (
                          <li key={index}>• {error}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Info Note */}
      <div className="mt-4 text-center text-xs text-gray-500">
        💡 Your referral link will be automatically included in each email
      </div>
    </motion.div>
  );
}
