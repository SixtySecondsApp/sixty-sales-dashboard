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
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
  items?: unknown[];
}

function ActionItemsSection({ items = [] }: ActionItemsSectionProps) {
  const hasItems = items.length > 0;

  return (
    <CollapsibleSection
      title="Action Items"
      icon={<Zap className="w-4 h-4" />}
      iconColor="text-amber-400"
      count={items.length}
      defaultOpen={true}
    >
      {hasItems ? (
        <div className="space-y-2">
          {/* Action item cards will be rendered here in US-004 */}
          <p className="text-sm text-slate-400">Action items will appear here.</p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <p className="text-sm text-slate-500">
            No pending actions. Ask me to draft a follow-up or prep for a meeting.
          </p>
        </div>
      )}
    </CollapsibleSection>
  );
}

interface ContextItem {
  type: 'hubspot' | 'fathom' | 'calendar';
  label: string;
  detail: string;
}

interface ContextSectionProps {
  items?: ContextItem[];
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
          {/* Context items will be rendered here in US-006 */}
          <p className="text-sm text-slate-400">Context data will appear here.</p>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
          <div className="flex gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5" />
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-white/10 to-white/5" />
          </div>
          <p className="text-sm text-slate-500">Data sources will appear here.</p>
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
  /** Action items pending user approval */
  actionItems?: unknown[];
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
