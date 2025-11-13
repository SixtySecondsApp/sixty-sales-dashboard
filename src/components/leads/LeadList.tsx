import type { LeadWithPrep } from '@/lib/services/leadService';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Calendar, User, Globe, CheckCircle2, Clock, AlertCircle, Building2 } from 'lucide-react';

interface LeadListProps {
  leads: LeadWithPrep[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  isLoading?: boolean;
}

// Helper function to determine source from booking link name
function getSourceLabel(lead: LeadWithPrep): string | null {
  const linkName = (lead.booking_link_name || '').toLowerCase();
  const channel = (lead.source_channel || '').toLowerCase();
  const medium = (lead.source_medium || '').toLowerCase();
  
  // Check booking link name first
  if (linkName.includes('linkedin') || linkName.includes('linkedin ads')) {
    return 'LinkedIn Ads';
  }
  if (linkName.includes('facebook') || linkName.includes('facebook ads')) {
    return 'Facebook Ads';
  }
  if (linkName.includes('website') || linkName.includes('homepage')) {
    return 'Website';
  }
  if (linkName.includes('personal') || linkName.includes('direct')) {
    return 'Personal Link';
  }
  
  // Fallback to channel/medium
  if (channel.includes('linkedin') || medium.includes('linkedin')) {
    return 'LinkedIn Ads';
  }
  if (channel.includes('facebook') || medium.includes('facebook')) {
    return 'Facebook Ads';
  }
  if (channel.includes('website') || medium.includes('organic')) {
    return 'Website';
  }
  if (channel.includes('direct') || channel.includes('personal')) {
    return 'Personal Link';
  }
  
  return null;
}

// Helper function to get owner name
function getOwnerName(lead: LeadWithPrep): string | null {
  if (!lead.owner_id) return null;
  
  // Check if owner is populated from join (Supabase returns it as 'owner' object)
  const owner = (lead as any).owner;
  if (owner) {
    const name = [owner.first_name, owner.last_name].filter(Boolean).join(' ');
    return name || owner.email || null;
  }
  
  return null;
}

// Helper function to get overall readiness status (combines prep and enrichment)
function getReadinessStatus(lead: LeadWithPrep): { status: string; label: string; icon: any; color: string } {
  const prepStatus = (lead.prep_status || 'pending').toLowerCase();
  const enrichStatus = (lead.enrichment_status || 'pending').toLowerCase();
  
  // If both are completed, show ready
  if (prepStatus === 'completed' && enrichStatus === 'completed') {
    return {
      status: 'ready',
      label: 'Ready',
      icon: CheckCircle2,
      color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200',
    };
  }
  
  // If either is in progress, show in progress
  if (prepStatus === 'in_progress' || enrichStatus === 'in_progress') {
    return {
      status: 'in_progress',
      label: 'Processing',
      icon: Clock,
      color: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200',
    };
  }
  
  // If either failed, show failed
  if (prepStatus === 'failed' || enrichStatus === 'failed') {
    return {
      status: 'failed',
      label: 'Failed',
      icon: AlertCircle,
      color: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200',
    };
  }
  
  // Default to pending
  return {
    status: 'pending',
    label: 'Pending',
    icon: Clock,
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };
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
      {leads.map((lead) => {
        const isSavvyCal = lead.external_source === 'savvycal';
        const sourceLabel = getSourceLabel(lead);
        const ownerName = getOwnerName(lead);
        const readiness = getReadinessStatus(lead);
        const ReadinessIcon = readiness.icon;
        
        return (
          <button
            key={lead.id}
            onClick={() => onSelect(lead.id)}
            className={cn(
              'w-full text-left px-4 py-4 transition-colors',
              'hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
              selectedLeadId === lead.id
                ? 'bg-emerald-100/70 dark:bg-emerald-500/20 border-l-4 border-emerald-500'
                : 'border-l-4 border-transparent'
            )}
          >
            {/* Top row: Contact name and readiness status */}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
                  </p>
                  {isSavvyCal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-500/10 dark:text-blue-200 flex-shrink-0">
                      <Calendar className="h-3 w-3" />
                      Meeting Booked
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {lead.meeting_title || 'Discovery Call'}
                </p>
              </div>
              <div className="flex-shrink-0">
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
                  readiness.color
                )}>
                  <ReadinessIcon className="h-3 w-3" />
                  {readiness.label}
                </span>
              </div>
            </div>
            
            {/* Middle row: Company/domain and metadata */}
            <div className="flex items-center gap-3 mb-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
                <span className="truncate">
                  {lead.domain || lead.contact_email?.split('@')[1] || 'Unknown domain'}
                </span>
              </div>
              {sourceLabel && (
                <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/10 dark:text-purple-200 flex-shrink-0">
                  <Globe className="h-3 w-3" />
                  {sourceLabel}
                </span>
              )}
            </div>
            
            {/* Bottom row: Owner and timestamp */}
            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                {ownerName ? (
                  <>
                    <User className="h-3.5 w-3.5" />
                    <span className="font-medium">{ownerName}</span>
                  </>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">Unassigned</span>
                )}
              </div>
              {lead.created_at && (
                <span>
                  {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}




