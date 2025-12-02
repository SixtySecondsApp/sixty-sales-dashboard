import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import { EmailSyncPanel } from '@/components/health/EmailSyncPanel';

export default function EmailSyncPage() {
  return (
    <SettingsPageWrapper
      title="Email Sync"
      description="Sync and analyze email communications"
    >
      <EmailSyncPanel />
    </SettingsPageWrapper>
  );
}
