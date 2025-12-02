import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import Preferences from '@/pages/Preferences';

export default function AppearanceSettings() {
  return (
    <SettingsPageWrapper
      title="Appearance"
      description="Customize theme and display preferences"
    >
      <Preferences />
    </SettingsPageWrapper>
  );
}
