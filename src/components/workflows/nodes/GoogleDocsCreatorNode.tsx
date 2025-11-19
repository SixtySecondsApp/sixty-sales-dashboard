import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { FileText, Settings, Check } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface GoogleDocsCreatorNodeData {
  label?: string;
  docTitle?: string;
  folderId?: string;
  permissions?: string[];
  isConfigured?: boolean;
  config?: {
    formatTranscript?: boolean;
    addTimestamps?: boolean;
    shareWithAI?: boolean;
    vectorDbReady?: boolean;
  };
  testStatus?: string;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const GoogleDocsCreatorNode = memo(({ data, selected }: NodeProps<GoogleDocsCreatorNodeData>) => {
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

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 text-[9px] rounded border border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  const enabledFeatures = [];
  if (config.formatTranscript) enabledFeatures.push('Format');
  if (config.addTimestamps) enabledFeatures.push('Timestamps');
  if (config.shareWithAI) enabledFeatures.push('AI Access');
  if (config.vectorDbReady) enabledFeatures.push('Vector DB');

  return (
    <ModernNodeCard
      selected={selected}
      icon={FileText}
      title={data.docTitle || data.label || 'Create Google Doc'}
      subtitle={isConfigured ? 'Document creator' : 'Configure document'}
      color="text-emerald-400"
      status={mapStatus()}
      badge={ConfigBadge}
      className="w-[280px]"
    >
      <div className="p-3 space-y-3 bg-[#1e1e1e]">
        {enabledFeatures.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Features</label>
            <div className="flex flex-wrap gap-1">
              {enabledFeatures.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 rounded border border-emerald-500/20 text-[9px] text-emerald-300">
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
            <span>Google auth required</span>
          </div>
        )}

        {data.permissions && data.permissions.length > 0 && (
          <div className="text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
            <span className="uppercase tracking-wider">Permissions: </span>
            <span className="text-zinc-300">{data.permissions.length} user{data.permissions.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

GoogleDocsCreatorNode.displayName = 'GoogleDocsCreatorNode';

export default GoogleDocsCreatorNode;
