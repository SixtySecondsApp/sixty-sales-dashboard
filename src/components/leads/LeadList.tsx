import type { LeadWithPrep } from '@/lib/services/leadService';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useCompanyLogo } from '@/lib/hooks/useCompanyLogo';
import { useState, useMemo, useEffect } from 'react';
import { Calendar, Clock, User, Tag, Building2 } from 'lucide-react';

interface LeadListProps {
  leads: LeadWithPrep[];
  selectedLeadId: string | null;
  onSelect: (leadId: string) => void;
  isLoading?: boolean;
}

type FilterType = 'all' | 'meeting_date' | 'booked_date';

export function LeadList({ leads, selectedLeadId, onSelect, isLoading }: LeadListProps) {
  console.warn('🔵 [LeadList] Component rendering with', leads.length, 'leads');
  if (leads.length > 0) {
    console.warn('🔵 [LeadList] First lead sample:', {
      id: leads[0].id,
      email: leads[0].contact_email,
      domain: leads[0].domain,
      hasOwner: !!leads[0].owner,
      hasSource: !!leads[0].source,
    });
  }
  
  const [filterType, setFilterType] = useState<FilterType>('all');

  // Sort leads based on filter type
  const sortedLeads = useMemo(() => {
    const sorted = [...leads];
    
    if (filterType === 'meeting_date') {
      return sorted.sort((a, b) => {
        const aDate = a.meeting_start ? new Date(a.meeting_start).getTime() : 0;
        const bDate = b.meeting_start ? new Date(b.meeting_start).getTime() : 0;
        return bDate - aDate; // Most recent first
      });
    }
    
    if (filterType === 'booked_date') {
      return sorted.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate; // Most recent first
      });
    }
    
    // Default: sort by created_at (booked date)
    return sorted.sort((a, b) => {
      const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bDate - aDate;
    });
  }, [leads, filterType]);

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
    <div className="flex flex-col h-full">
      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 px-4 sm:px-5 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Sort by:</span>
        <div className="flex gap-1">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md transition-colors',
              filterType === 'all'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilterType('meeting_date')}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md transition-colors',
              filterType === 'meeting_date'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            Meeting Date
          </button>
          <button
            onClick={() => setFilterType('booked_date')}
            className={cn(
              'px-2 py-1 text-xs font-medium rounded-md transition-colors',
              filterType === 'booked_date'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            )}
          >
            Booked Date
          </button>
        </div>
      </div>

      {/* Lead List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-200 dark:divide-gray-800">
        {sortedLeads.map((lead) => {
          console.log('[LeadList] Mapping lead:', lead.id, lead.contact_email, lead.domain);
          return (
            <LeadListItem
              key={lead.id}
              lead={lead}
              isSelected={selectedLeadId === lead.id}
              onSelect={() => onSelect(lead.id)}
            />
          );
        })}
      </div>
    </div>
  );
}

interface LeadListItemProps {
  lead: LeadWithPrep;
  isSelected: boolean;
  onSelect: () => void;
}

function LeadListItem({ lead, isSelected, onSelect }: LeadListItemProps) {
  console.warn('🟢 [LeadListItem] Rendering for lead:', lead.id, {
    email: lead.contact_email,
    domain: lead.domain,
    hasOwner: !!lead.owner,
    hasSource: !!lead.source,
  });
  
  // Extract domain from email if domain field is not available
  const domainForLogo = useMemo(() => {
    if (lead.domain) {
      console.log('[LeadListItem] Using lead.domain:', lead.domain);
      return lead.domain;
    }
    
    // Extract domain from email
    if (lead.contact_email) {
      const emailDomain = lead.contact_email.split('@')[1];
      if (emailDomain) {
        // Filter out common free email providers
        const freeEmailProviders = [
          'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 
          'icloud.com', 'proton.me', 'aol.com', 'mail.com', 'live.com'
        ];
        
        const normalizedDomain = emailDomain.toLowerCase();
        if (!freeEmailProviders.includes(normalizedDomain)) {
          console.log('[LeadListItem] Extracted domain from email:', normalizedDomain);
          return normalizedDomain;
        } else {
          console.log('[LeadListItem] Email domain is free provider, skipping:', normalizedDomain);
        }
      }
    }
    
    console.log('[LeadListItem] No valid domain found');
    return null;
  }, [lead.domain, lead.contact_email]);

  const { logoUrl, isLoading } = useCompanyLogo(domainForLogo);
  const [logoError, setLogoError] = useState(false);
  
  // Debug logging
  useEffect(() => {
    console.log('[LeadListItem] Effect - Domain for logo:', domainForLogo);
    console.log('[LeadListItem] Effect - Logo URL:', logoUrl);
    console.log('[LeadListItem] Effect - Is loading:', isLoading);
    console.log('[LeadListItem] Effect - Logo error:', logoError);
  }, [domainForLogo, logoUrl, isLoading, logoError]);
  
  // Reset error state when domain or logoUrl changes
  useEffect(() => {
    setLogoError(false);
  }, [domainForLogo, logoUrl]);
  
  const owner = lead.owner as { first_name: string | null; last_name: string | null; email: string | null } | null;
  const source = lead.source as { name: string | null; source_key: string | null } | null;
  const contact = lead.contact as { title: string | null; first_name: string | null; last_name: string | null; email: string | null } | null;
  
  // Debug: Log contact data to verify it's being fetched
  useEffect(() => {
    if (lead.id) {
      console.log('[LeadListItem] Contact data for lead', lead.id, ':', {
        contact_id: lead.contact_id,
        contact: contact,
        hasTitle: !!contact?.title,
        title: contact?.title,
      });
    }
  }, [lead.id, lead.contact_id, contact]);

  // Get source label
  const getSourceLabel = () => {
    if (source?.name) return source.name;
    
    // Fallback to UTM or booking link name
    if (lead.utm_source) {
      const utm = lead.utm_source.toLowerCase();
      if (utm.includes('facebook')) return 'Facebook Ads';
      if (utm.includes('linkedin')) return 'LinkedIn Ads';
      if (utm.includes('email')) return 'Email Outreach';
    }
    
    if (lead.booking_link_name) {
      const linkName = lead.booking_link_name.toLowerCase();
      if (linkName.includes('linkedin')) return 'LinkedIn Ads';
      if (linkName.includes('facebook')) return 'Facebook Ads';
      if (linkName.includes('email')) return 'Email Outreach';
      if (linkName.includes('website') || linkName.includes('homepage')) return 'Website';
      if (linkName.includes('personal') || linkName.includes('direct')) return 'Personal Link';
    }
    
    return 'Unknown Source';
  };

  const sourceLabel = getSourceLabel();
  const ownerName = owner
    ? [owner.first_name, owner.last_name].filter(Boolean).join(' ') || owner.email
    : null;

  // Extract and format company name from domain
  const companyName = useMemo(() => {
    if (!domainForLogo) return null;
    
    // Remove common TLDs and www
    let name = domainForLogo
      .replace(/^www\./, '')
      .replace(/\.(com|net|org|io|co|ai|app|dev|tech|ly|me|uk|us|ca|au|de|fr|es|it|nl|se|no|dk|fi|pl|cz|at|ch|be|ie|pt|gr|ro|hu|bg|hr|si|sk|lt|lv|ee|lu|mt|cy)$/i, '');
    
    // Check for common suffixes after TLD removal (e.g., "companyinc", "companyllc")
    const nameLower = name.toLowerCase();
    let suffix = '';
    if (nameLower.endsWith('inc')) {
      suffix = ' Inc';
      name = name.slice(0, -3).trim();
    } else if (nameLower.endsWith('llc')) {
      suffix = ' LLC';
      name = name.slice(0, -3).trim();
    } else if (nameLower.endsWith('ltd')) {
      suffix = ' Ltd';
      name = name.slice(0, -3).trim();
    } else if (nameLower.endsWith('corp')) {
      suffix = ' Corp';
      name = name.slice(0, -4).trim();
    }
    
    // Handle camelCase: add space before capital letters (but not at the start)
    name = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2');
    
    // Replace hyphens and underscores with spaces
    name = name.replace(/[-_]/g, ' ');
    
    // Handle numbers: add space before/after numbers if needed
    name = name.replace(/([a-z])([0-9])/gi, '$1 $2');
    name = name.replace(/([0-9])([a-z])/gi, '$1 $2');
    
    // Normalize multiple spaces
    name = name.replace(/\s+/g, ' ').trim();
    
    // Capitalize first letter of each word
    name = name
      .split(' ')
      .map(word => {
        // Handle special cases like "m1" -> "M1", "ai" -> "AI" if it's a short acronym
        if (word.length <= 2 && /^[a-z]+$/i.test(word)) {
          return word.toUpperCase();
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
    
    // Add suffix back if we had one
    if (suffix) {
      name += suffix;
    }
    
    return name || null;
  }, [domainForLogo]);

  // Format company name with title if available: "{title} @ {company name}" or just "{title}" or just "{company name}"
  const companyNameWithTitle = useMemo(() => {
    const title = contact?.title?.trim();
    if (title && companyName) {
      return `${title} @ ${companyName}`;
    } else if (title) {
      return title;
    } else if (companyName) {
      return companyName;
    }
    return null;
  }, [contact?.title, companyName]);

  // Extract initials for fallback when logo is not available
  const initials = useMemo(() => {
    // Try company name first
    if (companyName) {
      const words = companyName.split(' ').filter(Boolean).filter(w => w.length > 0);
      if (words.length >= 2) {
        const first = words[0][0]?.toUpperCase() || '';
        const second = words[1][0]?.toUpperCase() || '';
        if (first && second) return first + second;
      } else if (words.length === 1 && words[0].length >= 2) {
        return words[0].substring(0, 2).toUpperCase();
      } else if (words.length === 1 && words[0].length === 1) {
        return words[0].toUpperCase();
      }
    }
    
    // Fallback to contact name
    const contactName = lead.contact_name || '';
    if (contactName && contactName.trim()) {
      const nameParts = contactName.trim().split(/\s+/).filter(p => p.length > 0);
      if (nameParts.length >= 2) {
        const first = nameParts[0][0]?.toUpperCase() || '';
        const last = nameParts[nameParts.length - 1][0]?.toUpperCase() || '';
        if (first && last) return first + last;
      } else if (nameParts.length === 1) {
        const name = nameParts[0];
        if (name.length >= 2) {
          return name.substring(0, 2).toUpperCase();
        } else if (name.length === 1) {
          return name.toUpperCase();
        }
      }
    }
    
    // Fallback to email prefix (before @)
    if (lead.contact_email) {
      const emailPrefix = lead.contact_email.split('@')[0];
      if (emailPrefix && emailPrefix.length >= 2) {
        // Try to extract initials from email (e.g., "kelston.smith" -> "KS")
        const parts = emailPrefix.split(/[._-]/).filter(p => p.length > 0);
        if (parts.length >= 2) {
          const first = parts[0][0]?.toUpperCase() || '';
          const second = parts[parts.length - 1][0]?.toUpperCase() || '';
          if (first && second) return first + second;
        } else if (parts.length === 1 && parts[0].length >= 2) {
          return parts[0].substring(0, 2).toUpperCase();
        }
      }
    }
    
    // Last resort: use domain initials
    if (domainForLogo) {
      const domainParts = domainForLogo.split('.').filter(p => p.length > 0 && p !== 'www');
      if (domainParts.length > 0) {
        const mainPart = domainParts[0];
        if (mainPart.length >= 2) {
          return mainPart.substring(0, 2).toUpperCase();
        } else if (mainPart.length === 1) {
          return mainPart.toUpperCase();
        }
      }
    }
    
    // Absolute fallback
    return '?';
  }, [companyName, lead.contact_name, lead.contact_email, domainForLogo]);

  // Format dates
  const bookedDate = lead.created_at || lead.external_occured_at;
  const meetingDate = lead.meeting_start;

  // Consolidated status badge
  const prepStatus = lead.prep_status?.toLowerCase() || 'pending';
  const enrichStatus = lead.enrichment_status?.toLowerCase() || 'pending';
  const isComplete = prepStatus === 'completed' && enrichStatus === 'completed';
  const isInProgress = prepStatus === 'in_progress' || enrichStatus === 'in_progress';
  const hasFailed = prepStatus === 'failed' || enrichStatus === 'failed';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-4 sm:px-5 py-6 min-h-[120px] transition-all active:scale-[0.99]',
        'hover:bg-emerald-50 dark:hover:bg-emerald-500/10',
        isSelected
          ? 'bg-emerald-100/70 dark:bg-emerald-500/20 border-l-4 border-emerald-500'
          : 'border-l-4 border-transparent'
      )}
    >
      <div className="flex items-start gap-4">
        {/* Company Logo - Always show */}
        <div className="flex-shrink-0">
          {logoUrl && !logoError && !isLoading ? (
            <img
              src={logoUrl}
              alt={domainForLogo || 'Company logo'}
              className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5"
              onError={() => {
                console.error('[LeadListItem] Image load error for:', logoUrl);
                // Show placeholder on error
                setLogoError(true);
              }}
            />
          ) : (
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-2 font-semibold text-xs",
              isLoading
                ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                : "bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-600 dark:to-teal-700 border-emerald-200 dark:border-emerald-500/30 text-white shadow-sm"
            )}>
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="select-none">{initials}</span>
              )}
            </div>
          )}
        </div>

        {/* Lead Content */}
        <div className="flex-1 min-w-0">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {lead.contact_name || lead.contact_email || 'Unnamed Lead'}
              </p>
              {companyNameWithTitle && (
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-0.5 truncate">
                  {companyNameWithTitle}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                {lead.meeting_title || 'Discovery Call'}
              </p>
            </div>
            
            {/* Consolidated Status Badge */}
            <div className="flex-shrink-0">
              <ConsolidatedStatusBadge
                prepStatus={prepStatus}
                enrichStatus={enrichStatus}
                isComplete={isComplete}
                isInProgress={isInProgress}
                hasFailed={hasFailed}
              />
            </div>
          </div>

          {/* Labels Row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {/* Meeting Booked Label */}
            {lead.external_source === 'savvycal' && (
              <LabelBadge icon={Tag} label="Meeting Booked" variant="emerald" />
            )}
            
            {/* Source Label */}
            <LabelBadge icon={Tag} label={sourceLabel} variant="blue" />
            
            {/* Owner Label */}
            {ownerName && (
              <LabelBadge icon={User} label={ownerName} variant="purple" />
            )}
          </div>

          {/* Timestamps Row */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {bookedDate && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Booked {formatDistanceToNow(new Date(bookedDate), { addSuffix: true })}</span>
              </div>
            )}
            {meetingDate && (
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                <span>Meeting {format(new Date(meetingDate), 'MMM d, h:mm a')}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

interface ConsolidatedStatusBadgeProps {
  prepStatus: string;
  enrichStatus: string;
  isComplete: boolean;
  isInProgress: boolean;
  hasFailed: boolean;
}

function ConsolidatedStatusBadge({
  prepStatus,
  enrichStatus,
  isComplete,
  isInProgress,
  hasFailed,
}: ConsolidatedStatusBadgeProps) {
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
}

interface LabelBadgeProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant: 'emerald' | 'blue' | 'purple' | 'gray';
}

function LabelBadge({ icon: Icon, label, variant }: LabelBadgeProps) {
  const variants: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/30',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-200 dark:border-blue-500/30',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/10 dark:text-purple-200 dark:border-purple-500/30',
    gray: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-500/10 dark:text-gray-200 dark:border-gray-500/30',
  };

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium',
      variants[variant]
    )}>
      <Icon className="w-3 h-3" />
      <span className="truncate max-w-[120px]">{label}</span>
    </span>
  );
}
