/**
 * Copilot Right Panel Component
 *
 * Three collapsible sections:
 * 1. Action Items - AI-generated actions pending user approval
 * 2. Context - Data sources being used (HubSpot, Fathom, Calendar)
 * 3. Connected - Integration status (HubSpot, Fathom, Slack, Calendar)
 */

import React, { useState } from 'react';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useActionItemStore, type ActionItem } from '@/lib/stores/actionItemStore';
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

interface ActionItemsSectionProps {
  items?: ActionItem[];
}

function ActionItemsSection({ items: propItems }: ActionItemsSectionProps) {
  // Use store items if no props provided
  const storeItems = useActionItemStore((state) => state.getPendingItems());
  const approveItem = useActionItemStore((state) => state.approveItem);
  const dismissItem = useActionItemStore((state) => state.dismissItem);
  const items = propItems ?? storeItems;
  const hasItems = items.length > 0;

  // Modal state
  const [previewItem, setPreviewItem] = useState<ActionItem | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const handlePreview = (item: ActionItem) => {
    setPreviewItem(item);
    setIsPreviewOpen(true);
  };

  const handleClosePreview = () => {
    setIsPreviewOpen(false);
    // Delay clearing item to allow close animation
    setTimeout(() => setPreviewItem(null), 200);
  };

  const handleApprove = (item: ActionItem) => {
    // TODO: Wire actual approval execution in US-011 (send email, update CRM, etc.)
    approveItem(item.id);
  };

  const handleDismiss = (item: ActionItem, reason: string) => {
    dismissItem(item.id, reason);
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

interface Integration {
  id: string;
  name: string;
  connected: boolean;
}

interface ConnectedSectionProps {
  integrations?: Integration[];
}

function ConnectedSection({ integrations }: ConnectedSectionProps) {
  // Default to the 4 integrations in scope
  const defaultIntegrations: Integration[] = [
    { id: 'hubspot', name: 'HubSpot', connected: false },
    { id: 'fathom', name: 'Fathom', connected: false },
    { id: 'slack', name: 'Slack', connected: false },
    { id: 'calendar', name: 'Calendar', connected: false },
  ];

  const items = integrations || defaultIntegrations;

  return (
    <CollapsibleSection
      title="Connected"
      icon={<Link2 className="w-4 h-4" />}
      iconColor="text-purple-400"
      defaultOpen={true}
    >
      <div className="space-y-2">
        {items.map((integration) => (
          <div
            key={integration.id}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors"
          >
            <div className={cn(
              'w-9 h-9 rounded-xl flex items-center justify-center border',
              integration.connected
                ? 'bg-emerald-500/10 border-emerald-500/20'
                : 'bg-white/5 border-white/10'
            )}>
              <IntegrationIcon id={integration.id} connected={integration.connected} />
            </div>
            <span className={cn(
              'text-sm flex-1',
              integration.connected ? 'text-slate-300' : 'text-slate-500'
            )}>
              {integration.name}
            </span>
            {integration.connected && (
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
            )}
          </div>
        ))}

        <button
          type="button"
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-all mt-3 border border-dashed border-white/10"
        >
          <span className="text-lg leading-none">+</span>
          Add connector
        </button>
      </div>
    </CollapsibleSection>
  );
}

function IntegrationIcon({ id, connected }: { id: string; connected: boolean }) {
  const baseClass = cn(
    'w-4 h-4',
    connected ? getConnectedColor(id) : 'text-slate-500'
  );

  // Simple placeholder icons - these would be replaced with actual brand icons
  switch (id) {
    case 'hubspot':
      return <span className={cn(baseClass, 'font-bold text-xs')}>HS</span>;
    case 'fathom':
      return <span className={cn(baseClass, 'font-bold text-xs')}>F</span>;
    case 'slack':
      return <span className={cn(baseClass, 'font-bold text-xs')}>S</span>;
    case 'calendar':
      return <span className={cn(baseClass, 'font-bold text-xs')}>C</span>;
    default:
      return <span className={cn(baseClass, 'font-bold text-xs')}>?</span>;
  }
}

function getConnectedColor(id: string): string {
  switch (id) {
    case 'hubspot':
      return 'text-orange-400';
    case 'fathom':
      return 'text-violet-400';
    case 'slack':
      return 'text-pink-400';
    case 'calendar':
      return 'text-emerald-400';
    default:
      return 'text-slate-400';
  }
}

export interface CopilotRightPanelProps {
  /** Action items pending user approval (uses store if not provided) */
  actionItems?: ActionItem[];
  /** Context data sources being used */
  contextItems?: ContextItem[];
  /** Integration connection status */
  integrations?: Integration[];
}

export function CopilotRightPanel({
  actionItems = [],
  contextItems = [],
  integrations,
}: CopilotRightPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <ActionItemsSection items={actionItems} />
      <ContextSection items={contextItems} />
      <ConnectedSection integrations={integrations} />
    </div>
  );
}

export default CopilotRightPanel;
