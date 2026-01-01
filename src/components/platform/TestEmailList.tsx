/**
 * TestEmailList
 *
 * Displays a list of emails with category and urgency indicators for skill testing.
 */

import { Loader2, Mail, Check, ArrowDownLeft, ArrowUpRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { type TestEmail } from '@/lib/hooks/useTestEmails';
import { getTierColorClasses, type QualityTier } from '@/lib/utils/entityTestTypes';
import {
  getEmailCategoryBadgeStyle,
  getUrgencyBadgeStyle,
} from '@/lib/utils/emailQualityScoring';

interface TestEmailListProps {
  emails: TestEmail[];
  isLoading: boolean;
  selectedEmailId: string | null;
  onSelect: (email: TestEmail) => void;
  tier: QualityTier;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Truncate subject for display
 */
function truncateSubject(subject: string | null, maxLength: number = 40): string {
  if (!subject) return '(No subject)';
  if (subject.length <= maxLength) return subject;
  return subject.substring(0, maxLength) + '...';
}

export function TestEmailList({
  emails,
  isLoading,
  selectedEmailId,
  onSelect,
  tier,
}: TestEmailListProps) {
  const tierColors = getTierColorClasses(tier);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
          Loading {tier} emails...
        </span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="text-center py-8">
        <Mail className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No {tier} emails found in your inbox.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[280px] overflow-y-auto">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        Select an email to test with ({emails.length} found)
      </p>
      {emails.map((email) => {
        const isSelected = selectedEmailId === email.id;
        const categoryStyle = getEmailCategoryBadgeStyle(email.category);
        const urgencyStyle = getUrgencyBadgeStyle(email.signals?.urgency);

        return (
          <button
            key={email.id}
            type="button"
            onClick={() => onSelect(email)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
              'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500',
              isSelected
                ? `${tierColors.border} ${tierColors.bg}`
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800/50'
            )}
          >
            {/* Icon with direction indicator */}
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 relative',
                tierColors.bg,
                tierColors.text
              )}
            >
              <Mail className="w-5 h-5" />
              {email.direction === 'inbound' ? (
                <ArrowDownLeft className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-blue-500" />
              ) : (
                <ArrowUpRight className="w-3 h-3 absolute -bottom-0.5 -right-0.5 text-green-500" />
              )}
            </div>

            {/* Email info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {truncateSubject(email.subject)}
                </span>
                {isSelected && (
                  <Check className={cn('w-4 h-4 shrink-0', tierColors.text)} />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {email.from_email && (
                  <span className="truncate max-w-[120px]">{email.from_email}</span>
                )}
                {email.received_at && (
                  <span className="shrink-0">{formatDate(email.received_at)}</span>
                )}
              </div>
            </div>

            {/* Category and urgency indicators */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <div className="flex items-center gap-1.5">
                <Badge
                  variant={categoryStyle.variant}
                  className={cn('text-[10px] px-1.5 py-0', categoryStyle.className)}
                >
                  {email.category.replace('_', ' ')}
                </Badge>
                {urgencyStyle.label && (
                  <Badge variant="outline" className={cn('text-[10px] px-1 py-0', urgencyStyle.className)}>
                    {urgencyStyle.label}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className={cn('font-medium', tierColors.text)}>
                  {email.qualityScore.score}/100
                </span>
                {email.signals?.response_required && (
                  <AlertCircle className="w-3 h-3 text-amber-500" title="Response required" />
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
