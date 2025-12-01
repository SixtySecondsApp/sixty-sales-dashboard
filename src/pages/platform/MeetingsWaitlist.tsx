/**
 * MeetingsWaitlist Page
 * Enhanced waitlist management with bulk actions and onboarding tracking
 */

import React, { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useWaitlistAdmin } from '@/lib/hooks/useWaitlistAdmin';
import { useWaitlistBulkActions } from '@/lib/hooks/useWaitlistBulkActions';
import { BulkActionToolbar } from '@/components/platform/waitlist/BulkActionToolbar';
import { BulkGrantAccessModal } from '@/components/platform/waitlist/BulkGrantAccessModal';
import { EnhancedWaitlistTable } from '@/components/platform/waitlist/EnhancedWaitlistTable';
import { WaitlistStatsComponent } from '@/components/admin/waitlist/WaitlistStats';
import { resendMagicLink } from '@/lib/services/waitlistAdminService';

export default function MeetingsWaitlist() {
  const { user } = useAuth();
  const [showGrantAccessModal, setShowGrantAccessModal] = useState(false);

  // Existing waitlist data
  const { entries, stats, isLoading, releaseUser, deleteEntry, exportData } = useWaitlistAdmin();

  // Bulk actions
  const bulkActions = useWaitlistBulkActions(user?.id || '', entries);

  const handleGrantAccess = async () => {
    setShowGrantAccessModal(true);
  };

  const handleBulkGrantAccess = async (params: {
    emailTemplateId?: string;
    adminNotes?: string;
  }) => {
    return await bulkActions.grantAccess(params);
  };

  const handleResendMagicLink = async (entryId: string) => {
    if (!user?.id) return;
    const result = await resendMagicLink(entryId, user.id);
    if (result.success) {
      alert('Magic link resent successfully!');
    } else {
      alert(`Failed: ${result.error}`);
    }
  };

  const handleExportSelected = async () => {
    const selectedEntries = bulkActions.selectedEntries;
    if (selectedEntries.length === 0) {
      alert('No entries selected');
      return;
    }

    const headers = ['Email', 'Name', 'Company', 'Position', 'Referrals', 'Status'];
    const rows = selectedEntries.map((entry) => [
      entry.email,
      entry.full_name,
      entry.company_name || '',
      entry.effective_position?.toString() || '',
      entry.referral_count?.toString() || '0',
      entry.status,
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-selected-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Meetings Waitlist</h1>
          <p className="text-gray-400">
            Manage waitlist signups, grant bulk access, and track onboarding progress
          </p>
        </div>

        {/* Stats */}
        <WaitlistStatsComponent stats={stats} isLoading={isLoading} />

        {/* Bulk Action Toolbar */}
        <BulkActionToolbar
          selectedCount={bulkActions.selectedCount}
          onGrantAccess={handleGrantAccess}
          onExport={handleExportSelected}
          onClearSelection={bulkActions.clearSelection}
          isProcessing={bulkActions.isProcessing}
        />

        {/* Enhanced Table */}
        <EnhancedWaitlistTable
          entries={entries}
          isLoading={isLoading}
          selectedIds={bulkActions.selectedIds}
          onToggleSelect={bulkActions.toggleEntry}
          onSelectAll={() => bulkActions.selectAll(entries)}
          canSelect={bulkActions.canSelect}
          isSelected={bulkActions.isSelected}
          onRelease={releaseUser}
          onResendMagicLink={handleResendMagicLink}
          onDelete={deleteEntry}
          onExport={exportData}
        />

        {/* Bulk Grant Access Modal */}
        {showGrantAccessModal && (
          <BulkGrantAccessModal
            isOpen={showGrantAccessModal}
            onClose={() => setShowGrantAccessModal(false)}
            selectedEntries={bulkActions.selectedEntries}
            onGrantAccess={handleBulkGrantAccess}
            adminName={user?.email || 'Admin'}
          />
        )}
      </div>
    </AppLayout>
  );
}
