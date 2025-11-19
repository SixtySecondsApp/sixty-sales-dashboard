import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Webhook, Settings } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface FathomWebhookNodeData {
  label?: string;
  webhookUrl?: string;
  payloadTypes?: string[];
  isConfigured?: boolean;
  config?: {
    acceptedTopics?: string[];
    extractFathomId?: boolean;
    validatePayload?: boolean;
  };
  testStatus?: string;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const FathomWebhookNode = memo(({ data, selected }: NodeProps<FathomWebhookNodeData>) => {
  const isConfigured = data.isConfigured || false;

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

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 text-[9px] rounded border border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={Webhook}
      title={data.label || 'Fathom Webhook'}
      subtitle={data.payloadTypes && data.payloadTypes.length > 0 ? `${data.payloadTypes.length} event${data.payloadTypes.length !== 1 ? 's' : ''}` : 'Webhook trigger'}
      color="text-purple-400"
      status={mapStatus()}
      badge={ConfigBadge}
      handleLeft={false}
      handleRight={true}
      className="w-[280px]"
    >
      <div className="p-3 space-y-3 bg-[#1e1e1e]">
        {data.webhookUrl && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Webhook URL</label>
            <div className="text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 font-mono break-all">
              {data.webhookUrl}
            </div>
          </div>
        )}

        {data.payloadTypes && data.payloadTypes.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Event Types</label>
            <div className="flex flex-wrap gap-1">
              {data.payloadTypes.map((type, idx) => (
                <span key={idx} className="px-1.5 py-0.5 bg-purple-500/10 rounded border border-purple-500/20 text-[9px] text-purple-300">
                  {type}
                </span>
              ))}
            </div>
          </div>
        )}

        {!isConfigured && (
          <div className="flex items-center gap-2 text-[10px] text-yellow-400/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
            <Settings size={12} />
            <span>Setup required</span>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

FathomWebhookNode.displayName = 'FathomWebhookNode';

export default FathomWebhookNode;
