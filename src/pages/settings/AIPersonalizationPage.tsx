import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import AIPersonalizationSettings from '@/pages/settings/AIPersonalizationSettings';

export default function AIPersonalizationPage() {
  return (
    <SettingsPageWrapper
      title="AI Personalization"
      description="Customize AI behavior and preferences"
    >
      <AIPersonalizationSettings />
    </SettingsPageWrapper>
  );
}
