import React, { memo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { 
  Sparkles, 
  Settings2, 
  Zap, 
  Bot,
  Network,
  Brain
} from 'lucide-react';
import { ModernNodeCard } from './ModernNodeCard';

export interface AIAgentNodeData {
  label: string;
  config?: {
    modelProvider?: 'openai' | 'anthropic' | 'openrouter';
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    // MCP Support
    mcpEnabled?: boolean;
    mcpServers?: string[];
    mcpTools?: string[];
    mcpResources?: string[];
    toolExecutionMode?: 'sequential' | 'parallel' | 'conditional';
    maxToolCalls?: number;
    toolCallTimeout?: number;
  };
  executionMode?: boolean;
  executionData?: {
    output?: any;
    error?: string;
    duration?: number;
    timestamp?: string;
    toolCalls?: Array<{
      tool: string;
      input: any;
      output?: any;
      error?: string;
      duration?: number;
    }>;
    mcpConnections?: Array<{
      server: string;
      status: 'connected' | 'failed' | 'timeout';
      tools?: string[];
    }>;
  };
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const AIAgentNode = memo(({ data, selected }: NodeProps<AIAgentNodeData>) => {
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);

  const getModelProviderIcon = () => {
    switch (data.config?.modelProvider) {
      case 'openai':
        return Bot;
      case 'anthropic':
        return Brain;
      case 'openrouter':
        return Network;
      default:
        return Sparkles;
    }
  };

  const mapStatus = () => {
    if (!data.executionMode) return undefined;
    switch (data.executionStatus) {
      case 'completed': return 'success';
      case 'failed': return 'failed';
      case 'running': return 'active';
      default: return 'idle';
    }
  };

  const Badge = data.config?.mcpEnabled ? (
    <div className="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-300 text-[9px] rounded border border-indigo-500/30 font-bold mr-1">
      MCP
    </div>
  ) : null;

  const ConfigButton = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setIsConfigExpanded(!isConfigExpanded);
      }}
      className="p-1 hover:bg-zinc-700 rounded transition-colors text-zinc-500 hover:text-zinc-300"
    >
      <Settings2 size={14} />
    </button>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={getModelProviderIcon()}
      title={data.label || 'AI Agent'}
      subtitle={data.config?.model || 'Select model...'}
      color="text-purple-400"
      status={mapStatus()}
      badge={Badge}
      headerAction={ConfigButton}
    >
      <div className="p-3 space-y-3">
        {/* Model Info */}
        {data.config?.modelProvider && (
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="capitalize">{data.config.modelProvider}</span>
            <span>•</span>
            <span>{data.config.temperature ?? 0.7} temp</span>
          </div>
        )}

        {/* MCP Info */}
        {data.config?.mcpEnabled && (
          <div className="bg-indigo-500/10 rounded p-2 border border-indigo-500/20">
            <div className="text-[10px] text-indigo-300 font-medium mb-1 flex items-center gap-1">
              <Network size={10} /> MCP Context
            </div>
            <div className="text-[9px] text-indigo-200/70 space-y-0.5">
              {data.config.mcpServers?.map(server => (
                <div key={server}>• {server}</div>
              ))}
            </div>
          </div>
        )}

        {/* Expanded Configuration */}
        {isConfigExpanded && data.config && (
          <div className="text-[10px] space-y-1 bg-black/20 p-2 rounded border border-zinc-800/50">
            <div className="font-medium text-zinc-400">Configuration</div>
            <div className="text-zinc-500 grid grid-cols-2 gap-x-2">
              <span>Max Tokens:</span> <span className="text-zinc-300">{data.config.maxTokens || 'Default'}</span>
              <span>Tools:</span> <span className="text-zinc-300">{data.config.mcpTools?.length || 0}</span>
            </div>
          </div>
        )}

        {/* Execution Results */}
        {data.executionMode && (
          <div className="pt-2 border-t border-zinc-800 space-y-2">
             <div className="flex justify-between items-center text-[10px]">
                <span className="text-zinc-500 capitalize">{data.executionStatus || 'Pending'}</span>
                {data.executionData?.duration && (
                  <span className="text-zinc-600">{data.executionData.duration}ms</span>
                )}
             </div>
             
             {data.executionData?.output && (
               <div className="bg-green-500/10 p-2 rounded border border-green-500/20 text-[10px] text-green-300 font-mono break-words">
                  {typeof data.executionData.output === 'string' 
                    ? data.executionData.output.slice(0, 100) + (data.executionData.output.length > 100 ? '...' : '')
                    : JSON.stringify(data.executionData.output).slice(0, 100)
                  }
               </div>
             )}

             {data.executionData?.error && (
               <div className="bg-red-500/10 p-2 rounded border border-red-500/20 text-[10px] text-red-300 font-mono break-words">
                  {data.executionData.error}
               </div>
             )}
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

AIAgentNode.displayName = 'AIAgentNode';

export default AIAgentNode;
