import type { LeadWithPrep } from '@/lib/services/leadService';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface LeadListProps {
  leads: LeadWithPrep[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  isLoading?: boolean;
}

export function LeadList({ leads, selectedLeadId, onSelect, isLoading }: LeadListProps) {
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

  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {leads.map((lead) => (
        <button
          key={lead.id}
          onClick={() => onSelect(lead.id)}
          className={cn(
            'w-full text-left px-4 py-3 transition-colors',
            'hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
            selectedLeadId === lead.id
              ? 'bg-emerald-100/70 dark:bg-emerald-500/20 border-l-4 border-emerald-500'
              : 'border-l-4 border-transparent'
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {lead.meeting_title || 'Discovery Call'} •{' '}
                {lead.domain || lead.contact_email?.split('@')[1] || 'Unknown domain'}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <StatusPill status={lead.prep_status} label="Prep" />
              <StatusPill status={lead.enrichment_status} label="Enrichment" />
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>{lead.owner_id ? 'Assigned' : 'Unassigned'}</span>
            {lead.created_at && (
              <span>
                {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

interface StatusPillProps {
  status: string | null;
  label: string;
}

function StatusPill({ status, label }: StatusPillProps) {
  const normalized = (status ?? '').toLowerCase();
  const variants: Record<string, string> = {
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    in_progress: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    pending: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
    failed: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
  };

  const pillClass =
    variants[normalized] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', pillClass)}>
      <span>{label}</span>
      <span className="uppercase tracking-wide">{status ?? 'unknown'}</span>
    </span>
  );
}

