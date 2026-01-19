/**
 * Copilot Right Panel Component
 *
 * Three collapsible sections:
 * 1. Action Items - AI-generated actions pending user approval
 * 2. Context - Data sources being used (HubSpot, Fathom, Calendar)
 * 3. Connected - Integration status (HubSpot, Fathom, Slack, Calendar)
 */

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Zap,
  Database,
  Link2,
  Building2,
  DollarSign,
  User,
  Activity,
  Mic,
  Calendar,
  Clock,
  Sparkles,
  ExternalLink,
  Check,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActionItemStore, type ActionItem } from '@/lib/stores/actionItemStore';
import { approveActionItem, dismissActionItem } from '@/lib/services/actionItemApprovalService';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { ActionItemCard } from './ActionItemCard';
import { ActionItemPreviewModal } from './ActionItemPreviewModal';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  iconColor,
  count,
  defaultOpen = true,
  children
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-white/5 last:border-b-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={iconColor}>{icon}</span>
          <h3 className="font-semibold text-white text-sm">
            {title}
            {typeof count === 'number' && count > 0 && (
              <span className="ml-2 text-xs text-slate-400">({count})</span>
            )}
          </h3>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {isOpen && (
        <div className="px-5 pb-5">
          {children}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Progress Section
// ============================================================================

export interface ProgressStep {
  id: number;
  label: string;
  status: 'pending' | 'active' | 'complete';
}

interface ProgressSectionProps {
  steps: ProgressStep[];
  isProcessing: boolean;
  totalSteps?: number;
}

function ProgressSection({ steps, totalSteps = 4 }: Omit<ProgressSectionProps, 'isProcessing'>) {
  // Always show the Progress section - it displays step indicators
  // and either progress steps or placeholder text
  return (
    <div className="p-5 border-b border-white/5">
      <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        Progress
      </h3>

      {/* Step Indicator Circles */}
      <div className="flex items-center gap-2 mb-4">
        {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => {
          const progressItem = steps.find(p => p.id === stepNum);
          const status = progressItem?.status || 'pending';

          return (
            <React.Fragment key={stepNum}>
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all',
                  status === 'complete' &&
                    'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/25',
                  status === 'active' &&
                    'bg-gradient-to-br from-violet-400 to-purple-600 text-white animate-pulse shadow-lg shadow-violet-500/25',
                  status === 'pending' &&
                    'bg-white/5 text-slate-600 border border-white/10'
                )}
              >
                {status === 'complete' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  stepNum
                )}
              </div>
              {stepNum < totalSteps && (
                <div
                  className={cn(
                    'flex-1 h-0.5 rounded-full transition-all',
                    status === 'complete'
                      ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                      : 'bg-white/10'
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Labels */}
      <div className="space-y-2">
        {steps.length > 0 ? (
          steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2">
              {step.status === 'active' ? (
                <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span
                className={cn(
                  'text-xs',
                  step.status === 'active' ? 'text-violet-300' : 'text-slate-400'
                )}
              >
                {step.label}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">Steps will show as the task unfolds.</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Action Items Section
// ============================================================================

interface ActionItemsSectionProps {
  items?: ActionItem[];
}

function ActionItemsSection({ items: propItems }: ActionItemsSectionProps) {
  // Use store items if no props provided
  // IMPORTANT: Select raw items array, not getPendingItems() - calling a method creates
  // a new array reference on every render causing infinite re-render loops
  const allStoreItems = useActionItemStore((state) => state.items);
  const storeItems = useMemo(
    () => allStoreItems.filter((item) => item.status === 'pending'),
    [allStoreItems]
  );
  const items = propItems ?? storeItems;
  const hasItems = items.length > 0;

  // Get current user for approval service
  const { data: user } = useAuthUser();

  // Modal state
  const [previewItem, setPreviewItem] = useState<ActionItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const handlePreview = (item: ActionItem) => {
    setPreviewItem(item);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    // Delay clearing item to allow close animation
    setTimeout(() => setPreviewItem(null), 200);
  };

  const handleApprove = async (item: ActionItem) => {
    if (!user?.id || isApproving) return;

    setIsApproving(true);
    try {
      // US-011: Execute approval via service (send email, update CRM, etc.)
      await approveActionItem(item, user.id);
    } finally {
      setIsApproving(false);
    }
  };

  const handleDismiss = (item: ActionItem, reason: string) => {
    // US-011: Dismiss with feedback via service
    dismissActionItem(item, reason);
  };

  const handleEdit = (item: ActionItem) => {
    // TODO: Wire edit functionality in future story
    setPreviewItem(item);
    setIsPreviewOpen(true);
  };

  return (
    <>
      <CollapsibleSection
        title="Action Items"
        icon={<Zap className="w-4 h-4" />}
        iconColor="text-amber-400"
        count={items.length}
        defaultOpen={true}
      >
        {hasItems ? (
          <div className="space-y-2">
            {items.map((item) => (
              <ActionItemCard
                key={item.id}
                item={item}
                onPreview={handlePreview}
                onEdit={handleEdit}
                onApprove={handleApprove}
              />
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <p className="text-sm text-slate-500">
              No pending actions. Ask me to draft a follow-up or prep for a meeting.
            </p>
          </div>
        )}
      </CollapsibleSection>

      {/* Preview Modal */}
      <ActionItemPreviewModal
        isOpen={isPreviewOpen}
        onClose={handleClosePreview}
        item={previewItem}
        onEdit={handleEdit}
        onApprove={handleApprove}
        onDismiss={handleDismiss}
      />
    </>
  );
}

// Context data types for each integration
export interface HubSpotContext {
  type: 'hubspot';
  companyName: string;
  dealValue?: number;
  dealName?: string;
  contactName?: string;
  contactRole?: string;
  activityCount?: number;
  hubspotUrl?: string;
}

export interface FathomContext {
  type: 'fathom';
  callCount: number;
  lastCallDate?: string;
  lastCallDuration?: string;
  keyInsight?: string;
  fathomUrl?: string;
}

export interface CalendarContext {
  type: 'calendar';
  nextMeetingTitle: string;
  nextMeetingDate: string;
  nextMeetingTime: string;
  calendarUrl?: string;
}

export type ContextItem = HubSpotContext | FathomContext | CalendarContext;

interface ContextSectionProps {
  items?: ContextItem[];
}

// HubSpot context card
function HubSpotContextCard({ data }: { data: HubSpotContext }) {
  const formattedValue = data.dealValue
    ? new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(data.dealValue)
    : null;

  return (
    <div
      className={cn(
        'p-3 rounded-xl bg-white/5 border border-white/10',
        'hover:bg-white/[0.07] hover:border-orange-500/30',
        'transition-all cursor-pointer group'
      )}
      onClick={() => data.hubspotUrl && window.open(data.hubspotUrl, '_blank')}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
          <Building2 className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-orange-400">HubSpot</span>
        {data.hubspotUrl && (
          <ExternalLink className="w-3 h-3 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Company & Deal */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-white truncate">{data.companyName}</p>
        {data.dealName && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <DollarSign className="w-3 h-3" />
            <span className="truncate">{data.dealName}</span>
            {formattedValue && (
              <span className="text-emerald-400 font-medium ml-auto">{formattedValue}</span>
            )}
          </div>
        )}
        {data.contactName && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <User className="w-3 h-3" />
            <span className="truncate">
              {data.contactName}
              {data.contactRole && <span className="text-slate-500"> · {data.contactRole}</span>}
            </span>
          </div>
        )}
        {typeof data.activityCount === 'number' && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Activity className="w-3 h-3" />
            <span>{data.activityCount} activities</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Fathom context card
function FathomContextCard({ data }: { data: FathomContext }) {
  return (
    <div
      className={cn(
        'p-3 rounded-xl bg-white/5 border border-white/10',
        'hover:bg-white/[0.07] hover:border-violet-500/30',
        'transition-all cursor-pointer group'
      )}
      onClick={() => data.fathomUrl && window.open(data.fathomUrl, '_blank')}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
          <Mic className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-violet-400">Fathom</span>
        {data.fathomUrl && (
          <ExternalLink className="w-3 h-3 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Call info */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <span className="text-white font-medium">{data.callCount} calls</span>
          {data.lastCallDate && (
            <>
              <span className="text-slate-500">·</span>
              <span>Last: {data.lastCallDate}</span>
            </>
          )}
        </div>
        {data.lastCallDuration && (
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            <span>Duration: {data.lastCallDuration}</span>
          </div>
        )}
        {data.keyInsight && (
          <div className="mt-2 p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <div className="flex items-start gap-1.5">
              <Sparkles className="w-3 h-3 text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-violet-300/80 line-clamp-2">{data.keyInsight}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Calendar context card
function CalendarContextCard({ data }: { data: CalendarContext }) {
  return (
    <div
      className={cn(
        'p-3 rounded-xl bg-white/5 border border-white/10',
        'hover:bg-white/[0.07] hover:border-emerald-500/30',
        'transition-all cursor-pointer group'
      )}
      onClick={() => data.calendarUrl && window.open(data.calendarUrl, '_blank')}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <Calendar className="w-3 h-3 text-white" />
        </div>
        <span className="text-xs font-medium text-emerald-400">Calendar</span>
        {data.calendarUrl && (
          <ExternalLink className="w-3 h-3 text-slate-500 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </div>

      {/* Meeting info */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-white truncate">{data.nextMeetingTitle}</p>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock className="w-3 h-3" />
          <span className="text-emerald-400 font-medium">{data.nextMeetingDate}</span>
          <span className="text-slate-500">at</span>
          <span>{data.nextMeetingTime}</span>
        </div>
      </div>
    </div>
  );
}

// Render context item based on type
function ContextItemCard({ item }: { item: ContextItem }) {
  switch (item.type) {
    case 'hubspot':
      return <HubSpotContextCard data={item} />;
    case 'fathom':
      return <FathomContextCard data={item} />;
    case 'calendar':
      return <CalendarContextCard data={item} />;
    default:
      return null;
  }
}

function ContextSection({ items = [] }: ContextSectionProps) {
  const hasItems = items.length > 0;

  return (
    <CollapsibleSection
      title="Context"
      icon={<Database className="w-4 h-4" />}
      iconColor="text-emerald-400"
      defaultOpen={true}
    >
      {hasItems ? (
        <div className="space-y-2">
          {items.map((item, index) => (
            <ContextItemCard key={`${item.type}-${index}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-orange-500/50" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
              <Mic className="w-5 h-5 text-violet-500/50" />
            </div>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-emerald-500/50" />
            </div>
          </div>
          <p className="text-sm text-slate-500">
            Ask about a contact or deal to see relevant data here.
          </p>
        </div>
      )}
    </CollapsibleSection>
  );
}

export interface Integration {
  id: string;
  name: string;
  connected: boolean;
  settingsUrl?: string;
}

interface ConnectedSectionProps {
  integrations?: Integration[];
  onAddConnector?: () => void;
}

// Brand logos as SVG components for compact display
const BrandLogos: Record<string, (connected: boolean) => React.ReactNode> = {
  hubspot: (connected) => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={connected ? '#FF7A59' : 'currentColor'}>
      <path d="M18.164 7.93V5.084a2.198 2.198 0 001.267-1.984v-.066A2.198 2.198 0 0017.235.838h-.066a2.198 2.198 0 00-2.196 2.196v.066c0 .907.55 1.685 1.334 2.022v2.793a5.14 5.14 0 00-2.514 1.313l-6.639-5.17A2.59 2.59 0 007.2 3.24a2.61 2.61 0 10-.518 1.548l6.549 5.1a5.173 5.173 0 00-.94 2.98 5.2 5.2 0 00.94 2.98l-2.067 2.067a1.97 1.97 0 00-.612-.1 1.99 1.99 0 101.99 1.99c0-.222-.037-.435-.1-.636l2.045-2.045a5.17 5.17 0 002.672.745 5.193 5.193 0 10.004-10.386 5.14 5.14 0 00-2.001.447zM17.169 15.8a2.593 2.593 0 01-2.597-2.597 2.593 2.593 0 012.597-2.597 2.593 2.593 0 012.597 2.597 2.593 2.593 0 01-2.597 2.597z"/>
    </svg>
  ),
  fathom: (connected) => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={connected ? '#8B5CF6' : 'currentColor'}>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
      <circle cx="12" cy="12" r="4"/>
    </svg>
  ),
  slack: (connected) => (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill={connected ? '#E01E5A' : 'currentColor'}>
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
    </svg>
  ),
  calendar: (connected) => (
    <svg className="w-6 h-6" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" fill={connected ? '#4285F4' : 'currentColor'}/>
      <path d="M3 9h18" stroke={connected ? '#fff' : '#1e293b'} strokeWidth="1.5"/>
      <path d="M8 2v4M16 2v4" stroke={connected ? '#EA4335' : 'currentColor'} strokeWidth="2" strokeLinecap="round"/>
      <rect x="6" y="12" width="3" height="2.5" rx="0.5" fill={connected ? '#fff' : '#1e293b'}/>
      <rect x="10.5" y="12" width="3" height="2.5" rx="0.5" fill={connected ? '#fff' : '#1e293b'}/>
      <rect x="15" y="12" width="3" height="2.5" rx="0.5" fill={connected ? '#fff' : '#1e293b'}/>
      <rect x="6" y="16" width="3" height="2.5" rx="0.5" fill={connected ? '#fff' : '#1e293b'}/>
      <rect x="10.5" y="16" width="3" height="2.5" rx="0.5" fill={connected ? '#fff' : '#1e293b'}/>
    </svg>
  ),
};

// Brand colors for each integration
const brandColors: Record<string, string> = {
  hubspot: '#FF7A59',
  fathom: '#8B5CF6',
  slack: '#E01E5A',
  calendar: '#4285F4',
};

function ConnectedSection({ integrations, onAddConnector }: ConnectedSectionProps) {
  // Default to the 4 integrations in scope
  const defaultIntegrations: Integration[] = [
    { id: 'hubspot', name: 'HubSpot', connected: false, settingsUrl: '/settings/integrations/hubspot' },
    { id: 'fathom', name: 'Fathom', connected: false, settingsUrl: '/settings/integrations/fathom' },
    { id: 'slack', name: 'Slack', connected: false, settingsUrl: '/settings/integrations/slack' },
    { id: 'calendar', name: 'Calendar', connected: false, settingsUrl: '/settings/integrations/calendar' },
  ];

  const items = integrations || defaultIntegrations;
  const connectedCount = items.filter(i => i.connected).length;

  const handleAddConnector = () => {
    if (onAddConnector) {
      onAddConnector();
    } else {
      window.location.href = '/settings/integrations';
    }
  };

  const handleIntegrationClick = (integration: Integration) => {
    if (integration.settingsUrl) {
      window.location.href = integration.settingsUrl;
    }
  };

  return (
    <div className="p-5 border-b border-white/5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white text-sm flex items-center gap-2">
          <Link2 className="w-4 h-4 text-purple-400" />
          Connected
          {connectedCount > 0 && (
            <span className="text-xs text-slate-400">({connectedCount})</span>
          )}
        </h3>
        <button
          type="button"
          onClick={handleAddConnector}
          className="text-xs text-slate-400 hover:text-violet-400 transition-colors"
        >
          + Add
        </button>
      </div>

      {/* Compact horizontal logo row */}
      <div className="flex items-center gap-3">
        {items.map((integration) => {
          const logoFn = BrandLogos[integration.id];
          const color = brandColors[integration.id] || '#64748b';

          return (
            <button
              key={integration.id}
              type="button"
              onClick={() => handleIntegrationClick(integration)}
              title={`${integration.name}${integration.connected ? ' (Connected)' : ' (Click to connect)'}`}
              className={cn(
                'relative w-11 h-11 rounded-xl flex items-center justify-center transition-all',
                'hover:scale-110',
                integration.connected
                  ? 'bg-white/10 hover:bg-white/15'
                  : 'bg-white/[0.03] hover:bg-white/10 text-slate-500 hover:text-slate-300'
              )}
              style={{
                boxShadow: integration.connected ? `0 4px 14px ${color}30` : undefined
              }}
            >
              {logoFn ? logoFn(integration.connected) : <Link2 className="w-6 h-6" />}
              {/* Connected indicator dot */}
              {integration.connected && (
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900 shadow-lg shadow-emerald-500/50" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface CopilotRightPanelProps {
  /** Action items pending user approval (uses store if not provided) */
  actionItems?: ActionItem[];
  /** Context data sources being used */
  contextItems?: ContextItem[];
  /** Integration connection status */
  integrations?: Integration[];
  /** Progress steps for current task */
  progressSteps?: ProgressStep[];
  /** Whether AI is currently processing */
  isProcessing?: boolean;
}

export function CopilotRightPanel({
  actionItems = [],
  contextItems = [],
  integrations,
  progressSteps = [],
  isProcessing = false,
}: CopilotRightPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <ProgressSection steps={progressSteps} />
      <ActionItemsSection items={actionItems} />
      <ContextSection items={contextItems} />
      <ConnectedSection integrations={integrations} />
    </div>
  );
}

export default CopilotRightPanel;
