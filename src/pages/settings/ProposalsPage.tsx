import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import ProposalSettings from '@/pages/settings/ProposalSettings';

export default function ProposalsPage() {
  return (
    <SettingsPageWrapper
      title="Proposals"
      description="Configure proposal templates and settings"
    >
      <ProposalSettings />
    </SettingsPageWrapper>
  );
}
