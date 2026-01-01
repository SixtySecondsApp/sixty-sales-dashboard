/**
 * TestContactList
 *
 * Displays a list of contacts with quality indicators for skill testing.
 */

import { Loader2, User, Building2, Calendar, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type TestContact } from '@/lib/hooks/useTestContacts';
import { getTierColorClasses, type ContactQualityTier } from '@/lib/utils/contactQualityScoring';

interface TestContactListProps {
  contacts: TestContact[];
  isLoading: boolean;
  selectedContactId: string | null;
  onSelect: (contact: TestContact) => void;
  tier: ContactQualityTier;
}

export function TestContactList({
  contacts,
  isLoading,
  selectedContactId,
  onSelect,
  tier,
}: TestContactListProps) {
  const tierColors = getTierColorClasses(tier);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading {tier} contacts...
        </span>
      </div>
    );
  }

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No {tier} contacts found in your organization.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[280px] overflow-y-auto">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Select a contact to test with ({contacts.length} found)
      </p>
      {contacts.map((contact) => {
        const isSelected = selectedContactId === contact.id;
        const displayName =
          contact.full_name ||
          [contact.first_name, contact.last_name].filter(Boolean).join(' ') ||
          contact.email;

        return (
          <button
            key={contact.id}
            type="button"
            onClick={() => onSelect(contact)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
              isSelected
                ? `${tierColors.border} ${tierColors.badge}`
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
            )}
          >
            {/* Avatar with tier color */}
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm shrink-0',
                tierColors.bg
              )}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>

            {/* Contact info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {displayName}
                </span>
                {isSelected && (
                  <Check className={cn('w-4 h-4 shrink-0', tierColors.text)} />
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {contact.title && (
                  <span className="truncate max-w-[120px]">{contact.title}</span>
                )}
                {contact.company_name && (
                  <span className="flex items-center gap-1 truncate max-w-[100px]">
                    <Building2 className="w-3 h-3" />
                    {contact.company_name}
                  </span>
                )}
              </div>
            </div>

            {/* Quality indicators */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <div className={cn('text-xs font-semibold', tierColors.text)}>
                {contact.qualityScore.score}/100
              </div>
              {contact.total_meetings_count != null && contact.total_meetings_count > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Calendar className="w-3 h-3" />
                  {contact.total_meetings_count}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
