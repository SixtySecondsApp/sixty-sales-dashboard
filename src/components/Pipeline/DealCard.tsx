import React, { useMemo, useState } from 'react';
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
import { NextActionBadge, NextActionPanel } from '@/components/next-actions';
import { DealHealthBadge } from '@/components/DealHealthBadge';
import { DealSentimentIndicator, type DealSentimentData } from '@/components/sentiment';
import { RiskBadge, type RiskLevel } from '@/components/health';
import { extractDomainFromDeal } from '@/lib/utils/domainUtils';
import { useCompanyLogo } from '@/lib/hooks/useCompanyLogo';

interface DealCardProps {
  deal: any;
  index?: number;
  onClick: (deal: any) => void;
  onConvertToSubscription?: (deal: any) => void;
  isDragOverlay?: boolean;
  // Performance optimization: Pass batched metadata as props
  nextActionsPendingCount?: number;
  highUrgencyCount?: number;
  healthScore?: {
    overall_health_score: number;
    health_status: 'healthy' | 'warning' | 'critical' | 'stalled';
    risk_level?: RiskLevel;
    risk_factors?: string[];
  } | null;
  /** Sentiment trend data from meetings */
  sentimentData?: DealSentimentData | null;
}

export function DealCard({
  deal,
  onClick,
  onConvertToSubscription,
  isDragOverlay = false,
  // Default to 0 if not provided (batched data loading or unavailable)
  nextActionsPendingCount = 0,
  highUrgencyCount = 0,
  healthScore = null,
  sentimentData = null
}: DealCardProps) {
  const [logoError, setLogoError] = useState(false);

  // Extract domain for logo
  const domainForLogo = useMemo(() => {
    return extractDomainFromDeal({
      companies: deal.companies,
      company: deal.company,
      contact_email: deal.contact_email,
      company_website: deal.company_website,
    });
  }, [deal.companies, deal.company, deal.contact_email, deal.company_website]);

  const { logoUrl, isLoading } = useCompanyLogo(domainForLogo);

  // Reset error state when domain or logoUrl changes
  React.useEffect(() => {
    setLogoError(false);
  }, [domainForLogo, logoUrl]);
  // Assurer que l'ID est une chaîne de caractères
  const dealId = String(deal.id);

  // Next-action suggestions state
  const [showNextActionsPanel, setShowNextActionsPanel] = useState(false);

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
    // Primary: Use normalized contact relationship
    if (deal.contacts) {
      const name = deal.contacts.full_name || `${deal.contacts.first_name || ''} ${deal.contacts.last_name || ''}`.trim();
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
      {...listeners}
      data-testid={`deal-card-${deal.id}`}
      onClick={(e) => {
        // Don't trigger click during dragging or if it's a button/link click
        if (isDragging || (e.target as HTMLElement).closest('button, a')) return;
        onClick(deal);
      }}
      className={`
        bg-white dark:bg-gray-900/80 backdrop-blur-sm rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50
        transition-all border border-gray-200 dark:border-gray-700/50
        hover:border-gray-300 dark:hover:border-gray-600 shadow-sm dark:shadow-none hover:shadow-md group cursor-pointer
        ${isDragging || isDragOverlay ? 'shadow-lg cursor-grabbing z-[9999]' : 'cursor-grab'}
        relative overflow-hidden
      `}
      style={style}
    >
      {/* Shine effect removed for cleaner theme consistency */}

      <div className="relative z-[2]">
        {/* Header with deal name and value */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            {/* Deal name as primary title */}
            <h3 className="font-semibold text-gray-900 dark:text-white text-base truncate mb-2"
                title={deal.name || 'Untitled Deal'}
            >
              {deal.name || 'Untitled Deal'}
            </h3>

            {/* Company info */}
            <div className="flex items-center gap-2 mb-1">
              {logoUrl && !logoError && !isLoading ? (
                <img
                  src={logoUrl}
                  alt={`${companyInfo.name} logo`}
                  className="w-3.5 h-3.5 rounded flex-shrink-0 object-cover"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              )}
              <span className="text-sm text-gray-900 dark:text-gray-100 truncate"
                    title={companyInfo.name}
              >
                {companyInfo.name}
              </span>
            </div>

            {/* Contact info */}
            <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate" title={contactInfo.name}>
                {contactInfo.name}
              </span>
              {hasMultipleContacts && (
                <span className="text-xs bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">
                  +{deal.deal_contacts.length - 1}
                </span>
              )}
            </div>
          </div>

          <div className="ml-3 flex-shrink-0 text-right flex flex-col items-end gap-2">
            {/* Sentiment Trend and Health Score Row */}
            <div className="flex items-center gap-1">
              {/* Sentiment Trend Indicator */}
              {sentimentData && sentimentData.meeting_count > 0 && (
                <DealSentimentIndicator
                  sentiment={sentimentData}
                  compact
                />
              )}

              {/* Compact Health Score */}
              {healthScore && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/crm/health`;
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group/health"
                  title={`Health Score: ${healthScore.overall_health_score} (${healthScore.health_status})`}
                >
                  <div className={`w-2 h-2 rounded-full ${
                    healthScore.health_status === 'healthy' ? 'bg-green-500' :
                    healthScore.health_status === 'warning' ? 'bg-yellow-500' :
                    healthScore.health_status === 'critical' ? 'bg-red-500' :
                    'bg-gray-500'
                  }`} />
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 group-hover/health:text-gray-900 dark:group-hover/health:text-white">
                    {healthScore.overall_health_score}
                  </span>
                </button>
              )}
            </div>

            <div>
              {splitInfo.hasSplits ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <PieChart className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-base">
                      {new Intl.NumberFormat('en-GB', {
                        style: 'currency',
                        currency: 'GBP',
                        maximumFractionDigits: 0
                      }).format(splitInfo.userSplitAmount)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {splitInfo.userSplitPercentage}% of {formattedValue}
                  </div>
                  <div className="text-xs text-blue-600 dark:text-blue-400">
                    Split with {splitInfo.totalSplits} other{splitInfo.totalSplits === 1 ? '' : 's'}
                  </div>
                </div>
              ) : (
                <div className="text-emerald-600 dark:text-emerald-400 font-semibold text-lg">
                  {formattedValue}
                </div>
              )}

              {/* Next-Action Badge */}
              {nextActionsPendingCount > 0 && (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <NextActionBadge
                    count={nextActionsPendingCount}
                    urgency={highUrgencyCount > 0 ? 'high' : 'medium'}
                    onClick={() => setShowNextActionsPanel(true)}
                    compact
                  />
                </div>
              )}
            </div>

            {/* Drag Handle Indicator */}
            <div
              className="mt-1 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700/50 opacity-60 hover:opacity-100 transition-opacity"
              title="Drag to move"
            >
              <div className="w-1.5 h-1.5 bg-gray-500 dark:bg-gray-400 rounded-full mb-1"></div>
              <div className="w-1.5 h-1.5 bg-gray-500 dark:bg-gray-400 rounded-full mb-1"></div>
              <div className="w-1.5 h-1.5 bg-gray-500 dark:bg-gray-400 rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {/* Risk Badge - Show prominently for at-risk deals */}
          {healthScore?.risk_level && healthScore.risk_level !== 'low' && (
            <RiskBadge
              riskLevel={healthScore.risk_level}
              riskFactors={healthScore.risk_factors}
              compact
              interactive
            />
          )}

          {/* Due date badge if exists */}
          {deal.expected_close_date && (
            <span className={`
              inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
              ${isPastDue(deal.expected_close_date)
                ? 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-500/20'
                : 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20'
              }
            `}>
              <Calendar className="w-3 h-3 mr-1" />
              {format(new Date(deal.expected_close_date), 'MMM d')}
            </span>
          )}

          {/* Company size badge (if normalized) */}
          {companyInfo.isNormalized && companyInfo.size && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
              bg-gray-50 dark:bg-gray-500/10 text-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-500/20">
              {companyInfo.size}
            </span>
          )}

          {/* CRM status indicator */}
          {companyInfo.isNormalized && contactInfo.isNormalized && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold
              bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20">
              CRM
            </span>
          )}
        </div>

        {/* Bottom row - time indicator and probability */}
        <div className="flex items-center justify-between">
          {/* Time in stage indicator */}
          <div className={`
            flex items-center gap-1.5 text-xs
            ${timeIndicator.status === 'danger' ? 'text-red-600 dark:text-red-400' :
              timeIndicator.status === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600 dark:text-gray-400'}
          `}>
            {timeIndicator.icon && <timeIndicator.icon className="w-3.5 h-3.5" />}
            <span>{timeIndicator.text}</span>
          </div>

          {/* Probability indicator */}
          <div className="flex items-center gap-2">
            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${probability}%`,
                  backgroundColor: stageColor
                }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              {probability}%
            </span>
          </div>
        </div>

        {/* Convert to Subscription Button */}
        {canConvertToSubscription && (
          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700/50">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConvertToSubscription?.(deal);
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-500/10
                         hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/20
                         hover:border-emerald-300 dark:hover:border-emerald-500/30
                         rounded-lg transition-all text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm font-semibold"
            >
              <DollarSign className="w-4 h-4" />
              Convert to Subscription
            </button>
          </div>
        )}
      </div>

      {/* Next-Action Suggestions Panel */}
      <NextActionPanel
        dealId={deal.id}
        isOpen={showNextActionsPanel}
        onClose={() => setShowNextActionsPanel(false)}
      />
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