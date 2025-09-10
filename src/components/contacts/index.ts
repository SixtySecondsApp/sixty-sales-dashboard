// Google Integration Components for CRM
export { default as EmailComposerModal } from './EmailComposerModal';
export { default as ContactEmailHistory } from './ContactEmailHistory';
export { default as EmailSyncStatus } from './EmailSyncStatus';
export { default as SendEmailButton } from './SendEmailButton';
export { default as ContactDocuments } from './ContactDocuments';

// Re-export types for convenience
export type {
  SendEmailRequest,
  EmailMessage,
  ContactEmail
} from '@/lib/services/googleEmailService';