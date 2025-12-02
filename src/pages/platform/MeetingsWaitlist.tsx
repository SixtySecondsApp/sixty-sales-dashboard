/**
 * MeetingsWaitlist Page
 * Enhanced waitlist management with bulk actions and onboarding tracking
 */

import React, { useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useWaitlistAdmin } from '@/lib/hooks/useWaitlistAdmin';
import { useWaitlistBulkActions } from '@/lib/hooks/useWaitlistBulkActions';
import { BulkActionToolbar } from '@/components/platform/waitlist/BulkActionToolbar';
import { BulkGrantAccessModal } from '@/components/platform/waitlist/BulkGrantAccessModal';
import { EnhancedWaitlistTable } from '@/components/platform/waitlist/EnhancedWaitlistTable';
import { WaitlistStatsComponent } from '@/components/admin/waitlist/WaitlistStats';
import { SeededUserManager } from '@/components/platform/waitlist/SeededUserManager';
import { resendMagicLink } from '@/lib/services/waitlistAdminService';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function MeetingsWaitlist() {
  const { user } = useAuth();
  const [showGrantAccessModal, setShowGrantAccessModal] = useState(false);
  const [showSeededManager, setShowSeededManager] = useState(false);
  const [hideSeeded, setHideSeeded] = useState(true); // Default to hiding seeded users

  // Existing waitlist data
  const { entries, stats, isLoading, releaseUser, deleteEntry, exportData } = useWaitlistAdmin();

  // Filter entries based on seeded status
  const filteredEntries = hideSeeded ? entries.filter(entry => !entry.is_seeded) : entries;

  // Recalculate stats based on filtered entries
  const filteredStats = {
    total_signups: filteredEntries.length,
    pending_count: filteredEntries.filter(e => e.status === 'pending').length,
    released_count: filteredEntries.filter(e => e.status === 'released').length,
    declined_count: filteredEntries.filter(e => e.status === 'declined').length,
    converted_count: filteredEntries.filter(e => e.status === 'converted').length,
    avg_referrals: filteredEntries.length > 0
      ? Math.round((filteredEntries.reduce((sum, e) => sum + (e.referral_count || 0), 0) / filteredEntries.length) * 10) / 10
      : 0,
    signups_last_7_days: filteredEntries.filter(e => {
      const created = new Date(e.created_at);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return created >= sevenDaysAgo;
    }).length,
    signups_last_30_days: filteredEntries.filter(e => {
      const created = new Date(e.created_at);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return created >= thirtyDaysAgo;
    }).length,
  };

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
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Meetings Waitlist</h1>
        <p className="text-gray-400">
          Manage waitlist signups, grant bulk access, and track onboarding progress
        </p>
      </div>

      {/* Seeded User Manager - Collapsible */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowSeededManager(!showSeededManager)}
          className="
            w-full
            flex items-center justify-between
            px-6 py-4
            hover:bg-gray-50 dark:hover:bg-gray-800
            transition-colors
          "
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20">
              <span className="text-lg">🎭</span>
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Seeded User Management
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Manage fake/demo users for social proof
              </p>
            </div>
          </div>
          {showSeededManager ? (
            <ChevronUp className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          )}
        </button>
        {showSeededManager && (
          <div className="px-6 pb-6 border-t border-gray-200 dark:border-gray-700">
            <div className="mt-4">
              <SeededUserManager />
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <WaitlistStatsComponent stats={filteredStats} isLoading={isLoading} />

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
        hideSeeded={hideSeeded}
        onHideSeededChange={setHideSeeded}
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
  );
}
