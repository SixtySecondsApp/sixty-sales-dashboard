/**
 * Email to Deal Conversion Button
 * Allows users to create a new deal from an email
 */

import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import { GmailMessage } from '@/lib/types/gmail';
import { DealWizard } from '../DealWizard';
import { toast } from 'sonner';
import logger from '@/lib/utils/logger';

interface EmailToDealButtonProps {
  email: GmailMessage;
  className?: string;
}

export function EmailToDealButton({ email, className = '' }: EmailToDealButtonProps) {
  const [isDealWizardOpen, setIsDealWizardOpen] = useState(false);

  // Extract contact info from email sender
  const extractContactInfo = () => {
    const fromAddress = email.from;

    // Handle EmailAddress object
    const contactEmail = fromAddress?.email || '';
    const contactName = fromAddress?.name || contactEmail.split('@')[0] || '';

    // Try to extract company from email domain
    const company = contactEmail.split('@')[1]?.split('.')[0] || '';

    return { contactName, contactEmail, company };
  };

  const { contactName, contactEmail, company } = extractContactInfo();

  const handleCreateDeal = () => {
    logger.log('📧 Creating new deal from email:', {
      subject: email.subject,
      from: email.from,
      id: email.id
    });

    toast.success('Opening deal wizard...');
    setIsDealWizardOpen(true);
  };

  return (
    <>
      <button
        onClick={handleCreateDeal}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors ${className}`}
        title="Create Deal from Email"
      >
        <Briefcase className="w-4 h-4" />
        <span>Create Deal</span>
      </button>

      {/* Deal Wizard for Creating New Deal */}
      {isDealWizardOpen && (
        <DealWizard
          isOpen={isDealWizardOpen}
          onClose={() => setIsDealWizardOpen(false)}
          initialData={{
            clientName: contactName || company || '',
            contactEmail: contactEmail,
          }}
          onDealCreated={(deal) => {
            toast.success('Deal created from email!');
            logger.log('✅ Deal created from email:', deal);
            setIsDealWizardOpen(false);
          }}
        />
      )}
    </>
  );
}
