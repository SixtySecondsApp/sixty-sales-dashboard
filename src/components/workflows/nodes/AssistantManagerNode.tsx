import React, { memo } from 'react';
import { NodeProps } from 'reactflow';
import { Settings, Code, Database, Plus, Edit2 } from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface AssistantManagerNodeData {
  label: string;
  config?: {
    operation?: 'create' | 'update';
    assistantId?: string;
    assistantName?: string;
    description?: string;
    model?: string;
    instructions?: string;
    tools?: {
      codeInterpreter?: boolean;
      fileSearch?: boolean;
      functions?: Array<{
        name: string;
        description: string;
        parameters: any;
      }>;
    };
    files?: Array<{
      id: string;
      name: string;
      size: number;
      type: string;
    }>;
    vectorStoreId?: string;
    vectorStoreName?: string;
    metadata?: Record<string, string>;
    temperature?: number;
    topP?: number;
    responseFormat?: 'text' | 'json_object';
  };
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const AssistantManagerNode = memo(({ data, selected }: NodeProps<AssistantManagerNodeData>) => {
  const isCreateMode = data.config?.operation === 'create';
  const OperationIcon = isCreateMode ? Plus : Edit2;

  const mapStatus = () => {
    if (!data.executionMode) return undefined;
    switch (data.executionStatus) {
      case 'completed': return 'success';
      case 'failed': return 'failed';
      case 'running': return 'active';
      default: return 'idle';
    }
  };

  // Count enabled tools
  const enabledTools = [];
  if (data.config?.tools?.codeInterpreter) enabledTools.push('Code');
  if (data.config?.tools?.fileSearch) enabledTools.push('Files');
  if (data.config?.tools?.functions?.length) enabledTools.push(`${data.config.tools.functions.length} Fn`);

  const Badge = (
    <div className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] rounded border border-indigo-500/30 font-bold mr-1">
      OpenAI
    </div>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={Settings}
      title={data.config?.assistantName || data.label || (isCreateMode ? 'Create Assistant' : 'Update Assistant')}
      subtitle={data.config?.model || `${isCreateMode ? 'Create' : 'Update'} Assistant`}
      color="text-indigo-400"
      status={mapStatus()}
      badge={Badge}
      className="w-[320px]"
    >
      <div className="p-3 space-y-3 bg-[#1e1e1e]">
        {data.config?.instructions && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Instructions</label>
            <div className="text-xs text-zinc-300 bg-zinc-900/50 p-2 rounded border border-zinc-800 min-h-[60px] max-h-[100px] overflow-y-auto custom-scrollbar font-mono">
              {data.config.instructions}
            </div>
          </div>
        )}

        {enabledTools.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {data.config?.tools?.codeInterpreter && (
              <div className="px-1.5 py-0.5 bg-blue-500/10 rounded border border-blue-500/20 text-[9px] text-blue-300 flex items-center gap-1">
                <Code size={10} />
                Code
              </div>
            )}
            {data.config?.tools?.fileSearch && (
              <div className="px-1.5 py-0.5 bg-green-500/10 rounded border border-green-500/20 text-[9px] text-green-300 flex items-center gap-1">
                <Database size={10} />
                Search
              </div>
            )}
            {data.config?.tools?.functions?.length && (
              <div className="px-1.5 py-0.5 bg-purple-500/10 rounded border border-purple-500/20 text-[9px] text-purple-300">
                {data.config.tools.functions.length} Fn
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 pt-2 border-t border-zinc-800">
          <div className="flex flex-col gap-1">
            <span className="uppercase tracking-wider">Operation</span>
            <span className="text-zinc-300 capitalize">{data.config?.operation || 'create'}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="uppercase tracking-wider">Files</span>
            <span className="text-zinc-300">{data.config?.files?.length || 0}</span>
          </div>
        </div>

        {data.executionMode && data.executionData && (
          <div className="pt-2 border-t border-zinc-800">
            <div className="text-[10px] text-zinc-500">
              {data.executionData.assistantId ? `ID: ${data.executionData.assistantId.slice(0, 8)}...` : 'Processing...'}
            </div>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

AssistantManagerNode.displayName = 'AssistantManagerNode';

export default AssistantManagerNode;
