import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Database, Settings, Check } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface MeetingUpsertNodeData {
  label?: string;
  table?: string;
  upsertKey?: string;
  fields?: string[];
  isConfigured?: boolean;
  config?: {
    handleAttendees?: boolean;
    storeEmbedUrl?: boolean;
    processMetrics?: boolean;
    aiTrainingMetadata?: boolean;
    linkContacts?: boolean;
    enrichContacts?: boolean;
    createCompanies?: boolean;
    updateEngagement?: boolean;
  };
  testStatus?: string;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const MeetingUpsertNode = memo(({ data, selected }: NodeProps<MeetingUpsertNodeData>) => {
  const isConfigured = data.isConfigured || false;
  const config = data.config || {};

  const mapStatus = () => {
    if (data.executionMode) {
      switch (data.executionStatus) {
        case 'completed': return 'success';
        case 'failed': return 'failed';
        case 'running': return 'active';
        default: return 'idle';
      }
    }
    return data.testStatus === 'active' ? 'active' : undefined;
  };

  const enabledFeatures = [];
  if (config.handleAttendees) enabledFeatures.push('Attendees');
  if (config.linkContacts) enabledFeatures.push('Link Contacts');
  if (config.enrichContacts) enabledFeatures.push('Enrich');
  if (config.createCompanies) enabledFeatures.push('Companies');
  if (config.updateEngagement) enabledFeatures.push('Engagement');
  if (config.storeEmbedUrl) enabledFeatures.push('Embed URL');
  if (config.processMetrics) enabledFeatures.push('Metrics');
  if (config.aiTrainingMetadata) enabledFeatures.push('AI Metadata');

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 text-[9px] rounded border border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={Database}
      title={data.label || 'Upsert Meeting'}
      subtitle={data.table || 'meetings'}
      color="text-blue-400"
      status={mapStatus()}
      badge={ConfigBadge}
      className="w-[300px]"
    >
      <div className="p-3 space-y-3 bg-[#1e1e1e]">
        {data.upsertKey && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Upsert Key</label>
            <div className="text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 font-mono">
              {data.upsertKey}
            </div>
          </div>
        )}

        {enabledFeatures.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Features</label>
            <div className="flex flex-wrap gap-1">
              {enabledFeatures.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-500/10 rounded border border-blue-500/20 text-[9px] text-blue-300">
                  <Check size={8} />
                  {feature}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isConfigured && (
          <div className="flex items-center gap-2 text-[10px] text-yellow-400/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
            <Settings size={12} />
            <span>Configure fields</span>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

MeetingUpsertNode.displayName = 'MeetingUpsertNode';

export default MeetingUpsertNode;
