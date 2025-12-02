import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import CoachingPreferences from '@/pages/settings/CoachingPreferences';

export default function SalesCoachingPage() {
  return (
    <SettingsPageWrapper
      title="Sales Coaching"
      description="Configure AI coaching preferences and reference meetings"
    >
      <CoachingPreferences />
    </SettingsPageWrapper>
  );
}
