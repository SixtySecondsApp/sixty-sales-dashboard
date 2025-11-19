import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { FileText, Settings } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface GoogleDocsNodeData {
  label: string;
  description?: string;
  config?: {
    name: string;
    type: 'document' | 'spreadsheet' | 'presentation' | 'form';
    content?: string;
    templateId?: string;
    folderId?: string;
    shareWith?: string[];
    permissionLevel?: 'view' | 'comment' | 'edit';
  };
  testStatus?: string;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const GoogleDocsNode = memo(({ data, selected }: NodeProps<GoogleDocsNodeData>) => {
  const isConfigured = data.config && data.config.name && data.config.type;

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

  const getDocTypeName = () => {
    switch (data.config?.type) {
      case 'spreadsheet':
        return 'Spreadsheet';
      case 'presentation':
        return 'Presentation';
      case 'form':
        return 'Form';
      default:
        return 'Document';
    }
  };

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-500/20 text-yellow-300 text-[9px] rounded border border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={FileText}
      title={data.config?.name || data.label || 'Create Doc'}
      subtitle={isConfigured ? getDocTypeName() : 'Configure document'}
      color="text-emerald-400"
      status={mapStatus()}
      badge={ConfigBadge}
      className="w-[280px]"
    >
      <div className="p-3 space-y-3 bg-[#1e1e1e]">
        {data.config?.content && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Content</label>
            <div className="text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 min-h-[60px] max-h-[100px] overflow-y-auto custom-scrollbar">
              {data.config.content}
            </div>
          </div>
        )}

        {!isConfigured && (
          <div className="flex items-center gap-2 text-[10px] text-yellow-400/80 bg-yellow-500/10 p-2 rounded border border-yellow-500/20">
            <Settings size={12} />
            <span>Needs configuration</span>
          </div>
        )}

        {isConfigured && data.config && (
          <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider">Type</span>
              <span className="text-zinc-300">{getDocTypeName()}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="uppercase tracking-wider">Sharing</span>
              <span className="text-zinc-300">{data.config.shareWith?.length || 0} user{data.config.shareWith?.length !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

GoogleDocsNode.displayName = 'GoogleDocsNode';

export default GoogleDocsNode;
