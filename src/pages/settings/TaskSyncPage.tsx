import SettingsPageWrapper from '@/components/SettingsPageWrapper';
import TaskSyncSettings from '@/pages/settings/TaskSyncSettings';

export default function TaskSyncPage() {
  return (
    <SettingsPageWrapper
      title="Task Auto-Sync"
      description="Automatically create tasks from action items"
    >
      <TaskSyncSettings />
    </SettingsPageWrapper>
  );
}
