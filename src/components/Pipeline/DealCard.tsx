import React, { useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Building2, 
  User, 
  Calendar, 
  Clock, 
  AlertCircle, 
  ExternalLink,
  Users,
  PieChart,
  DollarSign
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useDealSplits } from '@/lib/hooks/useDealSplits';
import { Badge } from './Badge';
import { format } from 'date-fns';

interface DealCardProps {
  deal: any;
  index?: number;
  onClick: (deal: any) => void;
  onConvertToSubscription?: (deal: any) => void;
  isDragOverlay?: boolean;
}

export function DealCard({ deal, onClick, onConvertToSubscription, isDragOverlay = false }: DealCardProps) {
  // Assurer que l'ID est une chaîne de caractères
  const dealId = String(deal.id);

  // Get deal splits information
  const { splits, calculateSplitTotals } = useDealSplits({ dealId: deal.id });
  
  // Calculate split information
  const splitInfo = useMemo(() => {
    const totals = calculateSplitTotals(deal.id);
    const hasSplits = totals.splitCount > 0;
    const userSplit = splits.find(split => split.user_id === deal.owner_id);
    
    return {
      hasSplits,
      totalSplits: totals.splitCount,
      remainingPercentage: totals.remainingPercentage,
      userSplitPercentage: userSplit?.percentage || (hasSplits ? totals.remainingPercentage : 100),
      userSplitAmount: userSplit?.amount || (deal.value * (hasSplits ? totals.remainingPercentage : 100) / 100)
    };
  }, [splits, calculateSplitTotals, deal.id, deal.value, deal.owner_id]);

  // Set up sortable drag behavior
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: dealId,
    data: {
      ...deal,
      id: dealId // Assurer que l'ID dans les données est aussi une chaîne
    },
    disabled: isDragOverlay
  });

  // Apply transform styles for dragging with animations
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? '0.3' : '1',
    ...(isDragOverlay ? { zIndex: 9999 } : {}),
  };

  // Get company information (normalized vs legacy)
  const companyInfo = useMemo(() => {
    // Primary: Use normalized company relationship
    if (deal.companies) {
      return {
        name: deal.companies.name,
        domain: deal.companies.domain,
        size: deal.companies.size,
        isNormalized: true
      };
    }
    
    // Fallback: Use legacy company field
    return {
      name: deal.company || 'Unknown Company',
      domain: null,
      size: null,
      isNormalized: false
    };
  }, [deal.companies, deal.company]);

  // Get primary contact information (normalized vs legacy)
  const contactInfo = useMemo(() => {
    // Debug logging
    console.log('DealCard contact info for deal:', deal.id, {
      hasContacts: !!deal.contacts,
      contacts: deal.contacts,
      contact_name: deal.contact_name,
      contact_email: deal.contact_email
    });
    
    // Primary: Use normalized contact relationship
    if (deal.contacts) {
      const name = deal.contacts.full_name || `${deal.contacts.first_name || ''} ${deal.contacts.last_name || ''}`.trim();
      console.log('Using normalized contact name:', name);
      return {
        name: name || 'Unnamed Contact',
        email: deal.contacts.email,
        phone: deal.contacts.phone,
        title: deal.contacts.title,
        isNormalized: true
      };
    }
    
    // Fallback: Use legacy contact fields
    const legacyName = deal.contact_name || 'No contact';
    console.log('Using legacy contact name:', legacyName);
    return {
      name: legacyName,
      email: deal.contact_email,
      phone: deal.contact_phone,
      title: null,
      isNormalized: false
    };
  }, [deal.contacts, deal.contact_name, deal.contact_email, deal.contact_phone]);

  // Check if deal has additional contacts
  const hasMultipleContacts = useMemo(() => {
    return deal.deal_contacts && Array.isArray(deal.deal_contacts) && deal.deal_contacts.length > 1;
  }, [deal.deal_contacts]);

  // Determine time indicator status
  const timeIndicator = useMemo(() => {
    if (!deal.daysInStage) return { status: 'normal', text: 'New', icon: null };

    if (deal.daysInStage > 14) {
      return {
        status: 'danger',
        text: `${deal.daysInStage}d`,
        icon: AlertCircle
      };
    } else if (deal.daysInStage > 7) {
      return {
        status: 'warning',
        text: `${deal.daysInStage}d`,
        icon: Clock
      };
    } else {
      return {
        status: 'normal',
        text: `${deal.daysInStage}d`,
        icon: Clock
      };
    }
  }, [deal.daysInStage]);

  // Format deal value
  const formattedValue = useMemo(() => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(deal.value);
  }, [deal.value]);

  // Calculate probability
  const probability = deal.probability || deal.deal_stages?.default_probability || 0;

  // Determine stage color for indicators
  const stageColor = deal.deal_stages?.color || '#3b82f6';

  // Get stage name from the deal data
  const stageName = useMemo(() => {
    // Primary: Get stage name from deal_stages object if available
    if (deal.deal_stages?.name) {
      return deal.deal_stages.name;
    }

    // Secondary: If deal_stages is missing but we have a stage_id that doesn't match deal_stages.id,
    // we should try to find the stage info from the pipeline context
    if (deal.stage_id && (!deal.deal_stages || deal.stage_id !== deal.deal_stages.id)) {
      // This would require access to the stages from the pipeline context
      // For now we'll fall back to known stages
    }

    // Tertiary: Check if stage_id matches a known stage name
    const knownStages: Record<string, string> = {
      'lead': 'Lead',
      'sql': 'SQL',
      'discovery': 'Discovery',
      'proposal': 'Proposal',
      'negotiation': 'Negotiation',
      'closed': 'Closed/Won'
    };

    if (deal.stage_id && knownStages[deal.stage_id.toLowerCase()]) {
      return knownStages[deal.stage_id.toLowerCase()];
    }

    // Fallback to showing the stage_id if nothing else is available
    return deal.stage_id || 'Unknown Stage';
  }, [deal.deal_stages, deal.id, deal.stage_id]);

  // Custom badge styles based on stage color
  const stageBadgeStyle = useMemo(() => {
    if (deal.deal_stages?.color) {
      return {
        backgroundColor: `${deal.deal_stages.color}20`,
        color: deal.deal_stages.color,
        // Remplacer les propriétés en conflit
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: `${deal.deal_stages.color}40`
        // Supprimer la ligne border: '1px solid' qui créait le conflit
      };
    }
    return {};
  }, [deal.deal_stages?.color]);

  // Check if deal can be converted to subscription (is in Won/Closed/Signed stage)
  const canConvertToSubscription = useMemo(() => {
    const wonStageNames = ['closed', 'won', 'closed/won', 'closed-won', 'signed'];
    const currentStageName = stageName?.toLowerCase() || '';
    const stageId = deal.stage_id?.toLowerCase() || '';
    
    return wonStageNames.some(wonStage => 
      currentStageName.includes(wonStage) || stageId.includes(wonStage)
    ) && onConvertToSubscription;
  }, [stageName, deal.stage_id, onConvertToSubscription]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      data-testid={`deal-card-${deal.id}`}
      onClick={(e) => {
        // Don't trigger click during dragging or if it's a button/link click
        if (isDragging || (e.target as HTMLElement).closest('button, a, [data-drag-handle]')) return;
        onClick(deal);
      }}
      className={`
        bg-gray-800/50 rounded-xl p-4 hover:bg-gray-800/70
        transition-all border border-gray-800/80
        hover:border-gray-700 shadow-sm hover:shadow-md group cursor-pointer
        ${isDragging || isDragOverlay ? 'shadow-lg cursor-grabbing z-[9999]' : ''}
        relative overflow-hidden
      `}
      style={style}
    >
      {/* Shine effect */}
      {!isDragging && !isDragOverlay && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent
          via-white/[0.02] to-transparent translate-x-[-200%]
          group-hover:translate-x-[200%] transition-transform duration-1000 pointer-events-none
          z-[1]"
        />
      )}

      <div className="relative z-[2]">
        {/* Header with deal name and value */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            {/* Deal name as primary title */}
            <h3 className="font-semibold text-white text-base truncate mb-2"
                title={deal.name || 'Untitled Deal'}
            >
              {deal.name || 'Untitled Deal'}
            </h3>
            
            {/* Company info */}
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
              <span className="text-sm text-gray-300 truncate"
                    title={companyInfo.name}
              >
                {companyInfo.name}
              </span>
            </div>
            
            {/* Contact info */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate" title={contactInfo.name}>
                {contactInfo.name}
              </span>
              {hasMultipleContacts && (
                <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded text-[10px]">
                  +{deal.deal_contacts.length - 1}
                </span>
              )}
            </div>
          </div>

          <div className="ml-3 flex-shrink-0 text-right flex items-start gap-2">
            <div>
              {splitInfo.hasSplits ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-emerald-400 font-semibold text-base">
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        maximumFractionDigits: 0
                      }).format(splitInfo.userSplitAmount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {splitInfo.userSplitPercentage}% of {formattedValue}
                  </div>
                  <div className="text-xs text-blue-400">
                    Split with {splitInfo.totalSplits} other{splitInfo.totalSplits === 1 ? '' : 's'}
                  </div>
                </div>
              ) : (
                <div className="text-emerald-400 font-semibold text-lg">
                  {formattedValue}
                </div>
              )}
            </div>
            
            {/* Drag Handle */}
            <div 
              {...listeners}
              data-drag-handle
              className="mt-1 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-700/50 opacity-60 hover:opacity-100 transition-opacity"
              title="Drag to move"
            >
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mb-1"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mb-1"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {/* Due date badge if exists */}
          {deal.expected_close_date && (
            <span className={`
              inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
              ${isPastDue(deal.expected_close_date) 
                ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }
            `}>
              <Calendar className="w-3 h-3 mr-1" />
              {format(new Date(deal.expected_close_date), 'MMM d')}
            </span>
          )}

          {/* Company size badge (if normalized) */}
          {companyInfo.isNormalized && companyInfo.size && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
              bg-gray-500/20 text-gray-400 border border-gray-500/30">
              {companyInfo.size}
            </span>
          )}

          {/* CRM status indicator */}
          {companyInfo.isNormalized && contactInfo.isNormalized && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
              bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              CRM
            </span>
          )}
        </div>

        {/* Bottom row - time indicator and probability */}
        <div className="flex items-center justify-between">
          {/* Time in stage indicator */}
          <div className={`
            flex items-center gap-1.5 text-xs
            ${timeIndicator.status === 'danger' ? 'text-red-400' :
              timeIndicator.status === 'warning' ? 'text-yellow-400' : 'text-gray-400'}
          `}>
            {timeIndicator.icon && <timeIndicator.icon className="w-3.5 h-3.5" />}
            <span>{timeIndicator.text}</span>
          </div>

          {/* Probability indicator */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${probability}%`,
                  backgroundColor: stageColor
                }}
              />
            </div>
            <span className="text-xs font-medium text-gray-300">
              {probability}%
            </span>
          </div>
        </div>

        {/* Convert to Subscription Button */}
        {canConvertToSubscription && (
          <div className="mt-3 pt-3 border-t border-gray-700/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConvertToSubscription?.(deal);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 
                         hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/30 
                         rounded-lg transition-all text-emerald-400 hover:text-emerald-300 text-sm font-medium"
            >
              <DollarSign className="w-4 h-4" />
              Convert to Subscription
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getColorFromHex(hex: string | undefined): "blue" | "emerald" | "violet" | "orange" | "yellow" | "red" | "gray" {
  if (!hex) return 'gray';

  // This is a simple mapping - you'd want to extend this
  // based on your color scheme
  if (hex.includes('#10b981') || hex.includes('emerald')) return 'emerald';
  if (hex.includes('#3b82f6') || hex.includes('blue')) return 'blue';
  if (hex.includes('#8b5cf6') || hex.includes('violet')) return 'violet';
  if (hex.includes('#f97316') || hex.includes('orange')) return 'orange';
  if (hex.includes('#eab308') || hex.includes('yellow')) return 'yellow';
  if (hex.includes('#ef4444') || hex.includes('red')) return 'red';

  return 'gray';
}

function isPastDue(dateString: string): boolean {
  const date = new Date(dateString);
  return date < new Date();
}