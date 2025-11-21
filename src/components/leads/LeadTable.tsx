import type { LeadWithPrep } from '@/lib/services/leadService';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar, Clock, RotateCw, Loader2 } from 'lucide-react';
import type { MouseEvent } from 'react';

interface LeadTableProps {
  leads: LeadWithPrep[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  isLoading?: boolean;
  onReprocessLead?: (leadId: string) => Promise<void> | void;
  reprocessingLeadId?: string | null;
  isReprocessing?: boolean;
}

export function LeadTable({
  leads,
  selectedLeadId,
  onSelect,
  isLoading,
  onReprocessLead,
  reprocessingLeadId,
  isReprocessing,
}: LeadTableProps) {
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
        Loading leads…
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="flex flex-1 items-center justify-center py-12 text-sm text-gray-500 dark:text-gray-400">
        No leads yet. Webhook-processing new SavvyCal bookings will populate this list.
      </div>
    );
  }

  const getStatusBadge = (lead: LeadWithPrep) => {
    const prepStatus = lead.prep_status?.toLowerCase() || 'pending';
    const enrichStatus = lead.enrichment_status?.toLowerCase() || 'pending';
    const isComplete = prepStatus === 'completed' && enrichStatus === 'completed';
    const isInProgress = prepStatus === 'in_progress' || enrichStatus === 'in_progress';
    const hasFailed = prepStatus === 'failed' || enrichStatus === 'failed';

    let variant: 'completed' | 'in_progress' | 'pending' | 'failed' = 'pending';
    let label = 'Prep & Enrich';

    if (hasFailed) {
      variant = 'failed';
      label = 'Failed';
    } else if (isComplete) {
      variant = 'completed';
      label = 'Ready';
    } else if (isInProgress) {
      variant = 'in_progress';
      label = 'Processing';
    }

    const variants: Record<string, string> = {
      completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
      in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
      pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
      failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
    };

    return (
      <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium', variants[variant])}>
        {label}
      </span>
    );
  };

  const handleReprocessClick = async (e: MouseEvent<HTMLButtonElement>, leadId: string) => {
    e.stopPropagation();
    if (onReprocessLead) {
      await onReprocessLead(leadId);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  };

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'MMM d, yyyy • h:mm a');
    } catch {
      return 'Invalid date';
    }
  };

  const getCompanyName = (lead: LeadWithPrep) => {
    const contact = lead.contact as { title: string | null; first_name: string | null; last_name: string | null; email: string | null } | null;
    if (contact?.title && lead.domain) {
      return `${contact.title} @ ${lead.domain}`;
    }
    return lead.domain || contact?.title || 'Unknown';
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Contact Name
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Company
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Meeting Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Booked Date
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {leads.map((lead) => {
            const bookedDate = lead.first_seen_at || lead.external_occured_at || lead.created_at;
            const meetingDate = lead.meeting_start;
            const isSelected = selectedLeadId === lead.id;
            const isReprocessing = reprocessingLeadId === lead.id;

            return (
              <tr
                key={lead.id}
                onClick={() => onSelect(lead.id)}
                className={cn(
                  'cursor-pointer transition-colors',
                  'hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
                  isSelected && 'bg-emerald-100/70 dark:bg-emerald-500/20'
                )}
              >
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
                  </div>
                  {lead.contact_email && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {lead.contact_email}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 dark:text-gray-100">
                    {getCompanyName(lead)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {meetingDate ? (
                    <div className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-gray-100">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      <span>{formatDateTime(meetingDate)}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {bookedDate ? (
                    <div className="flex items-center gap-1.5 text-sm text-gray-900 dark:text-gray-100">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span>{formatDateTime(bookedDate)}</span>
                    </div>
                  ) : (
                    <span className="text-sm text-gray-400">N/A</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(lead)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {onReprocessLead && (
                      <button
                        type="button"
                        onClick={(e) => handleReprocessClick(e, lead.id)}
                        disabled={isReprocessing || (isReprocessing && reprocessingLeadId !== lead.id)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors',
                          'border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800',
                          (isReprocessing || (isReprocessing && reprocessingLeadId !== lead.id)) && 'opacity-60 cursor-not-allowed'
                        )}
                        title="Reprocess lead prep"
                      >
                        {isReprocessing ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCw className="h-3 w-3" />
                        )}
                        <span>Reprocess</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

