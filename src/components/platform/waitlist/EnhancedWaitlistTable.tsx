/**
 * EnhancedWaitlistTable Component
 * Waitlist table with checkbox selection and onboarding progress display
 */

import React, { useState } from 'react';
import { Check, X, Download, Trash2, RotateCw, Filter } from 'lucide-react';
import type { WaitlistEntry } from '@/lib/types/waitlist';
import { OnboardingProgressWidget } from './OnboardingProgressWidget';
import { useWaitlistOnboardingProgress } from '@/lib/hooks/useWaitlistOnboarding';

export interface EnhancedWaitlistTableProps {
  entries: WaitlistEntry[];
  isLoading: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  canSelect: (entry: WaitlistEntry) => boolean;
  isSelected: (id: string) => boolean;
  onRelease: (id: string, notes?: string) => Promise<void>;
  onResendMagicLink?: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onExport: () => Promise<void>;
  hideSeeded?: boolean;
  onHideSeededChange?: (hideSeeded: boolean) => void;
}

export function EnhancedWaitlistTable({
  entries,
  isLoading,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  canSelect,
  isSelected,
  onRelease,
  onResendMagicLink,
  onDelete,
  onExport,
  hideSeeded = true,
  onHideSeededChange,
}: EnhancedWaitlistTableProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Filter entries based on search and seeded status
  const filteredEntries = entries.filter((entry) => {
    // Search filter
    const matchesSearch =
      entry.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.company_name || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Seeded filter
    const matchesSeeded = hideSeeded ? !entry.is_seeded : true;

    return matchesSearch && matchesSeeded;
  });

  // Calculate select all state
  const selectableEntries = filteredEntries.filter(canSelect);
  const allSelectableSelected =
    selectableEntries.length > 0 &&
    selectableEntries.every((entry) => isSelected(entry.id));
  const someSelected = selectableEntries.some((entry) => isSelected(entry.id));

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-4 mb-3">
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="
              max-w-md px-4 py-2
              bg-white dark:bg-gray-800
              border border-gray-300 dark:border-gray-600
              rounded-lg
              text-gray-900 dark:text-white
              placeholder-gray-400 dark:placeholder-gray-500
              focus:ring-2 focus:ring-blue-500 focus:border-transparent
            "
          />
          <button
            onClick={onExport}
            className="
              flex items-center gap-2
              px-4 py-2
              border border-gray-300 dark:border-gray-600
              hover:bg-gray-50 dark:hover:bg-gray-800
              rounded-lg
              text-gray-700 dark:text-gray-300
              font-medium text-sm
              transition-colors
            "
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={hideSeeded}
              onChange={(e) => onHideSeededChange?.(e.target.checked)}
              className="
                w-4 h-4
                text-blue-600
                bg-white dark:bg-gray-700
                border-gray-300 dark:border-gray-600
                rounded
                focus:ring-2 focus:ring-blue-500
              "
            />
            <span>Hide seeded users</span>
            <span className="text-xs text-gray-500 dark:text-gray-500">
              ({entries.filter(e => e.is_seeded).length} seeded)
            </span>
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-left">
              <th className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={onSelectAll}
                  disabled={selectableEntries.length === 0}
                  className="
                    w-4 h-4
                    text-blue-600
                    bg-white dark:bg-gray-700
                    border-gray-300 dark:border-gray-600
                    rounded
                    focus:ring-2 focus:ring-blue-500
                    disabled:opacity-50 disabled:cursor-not-allowed
                  "
                  style={{
                    appearance: someSelected && !allSelectableSelected ? 'auto' : 'auto',
                  }}
                />
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">#</th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Name
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Email
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Company
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Dialer
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Meeting Recorder
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                CRM
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Referrals
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Points
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Status
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Onboarding
              </th>
              <th className="px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.length === 0 ? (
              <tr>
                <td
                  colSpan={13}
                  className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                >
                  No entries found
                </td>
              </tr>
            ) : (
              filteredEntries.map((entry) => {
                const selectable = canSelect(entry);
                const selected = isSelected(entry.id);

                return (
                  <WaitlistTableRow
                    key={entry.id}
                    entry={entry}
                    selectable={selectable}
                    selected={selected}
                    onToggleSelect={onToggleSelect}
                    onRelease={onRelease}
                    onResendMagicLink={onResendMagicLink}
                    onDelete={onDelete}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Separate row component for better performance with onboarding progress
function WaitlistTableRow({
  entry,
  selectable,
  selected,
  onToggleSelect,
  onRelease,
  onResendMagicLink,
  onDelete,
}: {
  entry: WaitlistEntry;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onRelease: (id: string, notes?: string) => Promise<void>;
  onResendMagicLink?: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  // Fetch onboarding progress if user is converted
  const { data: onboardingProgress } = useWaitlistOnboardingProgress(
    entry.user_id || null
  );

  return (
    <tr className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
      {/* Checkbox */}
      <td className="px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(entry.id)}
          disabled={!selectable}
          className="
            w-4 h-4
            text-blue-600
            bg-white dark:bg-gray-700
            border-gray-300 dark:border-gray-600
            rounded
            focus:ring-2 focus:ring-blue-500
            disabled:opacity-50 disabled:cursor-not-allowed
          "
        />
      </td>

      {/* Position */}
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
        #{entry.effective_position}
      </td>

      {/* Name */}
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
        <div className="flex items-center gap-2">
          <span>{entry.full_name}</span>
          {entry.is_seeded && (
            <span
              className="
                inline-flex items-center
                px-2 py-0.5
                rounded
                text-xs font-medium
                bg-purple-100 dark:bg-purple-900/20
                text-purple-800 dark:text-purple-400
                border border-purple-200 dark:border-purple-800
              "
              title="Seeded user for social proof"
            >
              Seeded
            </span>
          )}
        </div>
      </td>

      {/* Email */}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{entry.email}</td>

      {/* Company */}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {entry.company_name || '-'}
      </td>

      {/* Dialer */}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {entry.dialer_tool === 'Other' && entry.dialer_other
          ? entry.dialer_other
          : entry.dialer_tool || '-'}
      </td>

      {/* Meeting Recorder */}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {entry.meeting_recorder_tool === 'Other' && entry.meeting_recorder_other
          ? entry.meeting_recorder_other
          : entry.meeting_recorder_tool || '-'}
      </td>

      {/* CRM */}
      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
        {entry.crm_tool === 'Other' && entry.crm_other
          ? entry.crm_other
          : entry.crm_tool || '-'}
      </td>

      {/* Referrals */}
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
        {entry.referral_count}
      </td>

      {/* Points */}
      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
        {entry.total_points || 0}
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-sm">
        <span
          className={`
            inline-flex items-center gap-1.5
            px-2.5 py-1
            rounded-full
            text-xs font-medium
            ${
              entry.status === 'pending'
                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400'
                : entry.status === 'released'
                ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400'
                : entry.status === 'converted'
                ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-400'
            }
          `}
        >
          {entry.status}
        </span>
      </td>

      {/* Onboarding Progress */}
      <td className="px-4 py-3">
        {entry.status === 'converted' && onboardingProgress ? (
          <OnboardingProgressWidget progress={onboardingProgress} variant="badge" />
        ) : entry.status === 'released' ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">Pending signup</span>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3 text-sm">
        <div className="flex items-center gap-2">
          {entry.status === 'pending' && (
            <button
              onClick={() => onRelease(entry.id)}
              className="
                p-1.5
                text-green-600 dark:text-green-400
                hover:bg-green-50 dark:hover:bg-green-900/20
                rounded
                transition-colors
              "
              title="Grant access"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {entry.status === 'released' && onResendMagicLink && (
            <button
              onClick={() => onResendMagicLink(entry.id)}
              className="
                p-1.5
                text-blue-600 dark:text-blue-400
                hover:bg-blue-50 dark:hover:bg-blue-900/20
                rounded
                transition-colors
              "
              title="Resend magic link"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this entry?')) {
                onDelete(entry.id);
              }
            }}
            className="
              p-1.5
              text-red-600 dark:text-red-400
              hover:bg-red-50 dark:hover:bg-red-900/20
              rounded
              transition-colors
            "
            title="Delete entry"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
