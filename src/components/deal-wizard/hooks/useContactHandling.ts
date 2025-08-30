import { useState } from 'react';
import { toast } from 'sonner';
import { useContacts } from '@/lib/hooks/useContacts';
import { WizardState } from '../types';
import logger from '@/lib/utils/logger';

export function useContactHandling() {
  const { contacts, createContact, findContactByEmail, autoCreateFromEmail } = useContacts();

  const handleContactSelect = (contact: any, wizard: WizardState, setWizard: (wizard: WizardState) => void) => {
    setWizard({
      ...wizard,
      selectedContact: contact,
      dealData: {
        ...wizard.dealData,
        contact_name: contact.full_name || `${contact.first_name} ${contact.last_name}`.trim(),
        contact_email: contact.email,
        contact_phone: contact.phone || '',
        company: contact.company?.name || wizard.dealData.company,
        name: contact.company?.name ? `${contact.company.name} Opportunity` : wizard.dealData.name
      }
    });
  };

  const handleCreateContact = async (
    wizard: WizardState, 
    setWizard: (wizard: WizardState) => void,
    userData: any,
    setIsLoading: (loading: boolean) => void
  ) => {
    if (!wizard.dealData.contact_email) {
      toast.error('Email address is required to create a contact');
      return;
    }

    try {
      setIsLoading(true);
      
      // Check if contact exists first
      const existingContact = await findContactByEmail(wizard.dealData.contact_email);
      
      if (existingContact) {
        handleContactSelect(existingContact, wizard, setWizard);
        return;
      }

      // Auto-create contact from email and name info
      const [firstName, ...lastNameParts] = wizard.dealData.contact_name.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const newContact = await autoCreateFromEmail(
        wizard.dealData.contact_email,
        userData?.id || '',
        firstName,
        lastName,
        wizard.dealData.company
      );

      if (newContact) {
        handleContactSelect(newContact, wizard, setWizard);
        toast.success('Contact created successfully!');
      } else {
        throw new Error('Failed to create contact');
      }
    } catch (error) {
      logger.error('Error creating contact:', error);
      toast.error('Failed to create contact. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return {
    contacts,
    handleContactSelect,
    handleCreateContact
  };
}