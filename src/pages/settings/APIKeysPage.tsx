import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import AIProviderSettings from '@/components/settings/AIProviderSettings';

export default function APIKeysPage() {
  return (
    <SettingsPageWrapper
      title="API Keys"
      description="Manage AI provider API keys (encrypted and secure)"
    >
      <AIProviderSettings />
    </SettingsPageWrapper>
  );
}
