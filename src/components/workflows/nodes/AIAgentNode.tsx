import React, { memo, useState } from 'react';
import { NodeProps } from 'reactflow';
import { 
  Sparkles, 
  Settings2, 
  Zap, 
  Bot,
  Network,
  Brain,
  Play
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
    <div className="px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[9px] rounded border border-indigo-200 dark:border-indigo-500/30 font-bold mr-1">
      MCP
    </div>
  ) : null;

  const ConfigButton = (
    <button
      onClick={(e) => {
        e.stopPropagation();
        // Open full config modal action would go here
        setIsConfigExpanded(!isConfigExpanded);
      }}
      className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300"
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
      color="text-purple-600 dark:text-purple-400"
      status={mapStatus()}
      badge={Badge}
      headerAction={ConfigButton}
      className="w-[320px]"
    >
      <div className="p-0">
        {/* Prompt Preview Area (Freepik Style) */}
        <div className="p-3 bg-white dark:bg-[#1e1e1e] space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">System Prompt</label>
            <div className="text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[60px] max-h-[100px] overflow-y-auto custom-scrollbar font-mono">
              {data.config?.systemPrompt || <span className="text-gray-400 dark:text-zinc-600 italic">Define agent behavior...</span>}
            </div>
          </div>

           <div className="space-y-1">
            <label className="text-[10px] font-medium text-gray-500 dark:text-zinc-500 uppercase tracking-wider">User Prompt</label>
            <div className="text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 min-h-[40px] max-h-[80px] overflow-y-auto custom-scrollbar font-mono">
              {data.config?.userPrompt || <span className="text-gray-400 dark:text-zinc-600 italic">Enter task instructions...</span>}
            </div>
          </div>

          {/* Model & Config Info */}
          <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-zinc-500 pt-2 border-t border-gray-200 dark:border-zinc-800">
             <div className="flex items-center gap-2">
                <span className="capitalize">{data.config?.modelProvider || 'Provider'}</span>
                <span>•</span>
                <span>{data.config?.temperature ?? 0.7} temp</span>
             </div>
             {data.config?.mcpEnabled && (
                <div className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                   <Network size={10} />
                   <span>{data.config.mcpTools?.length || 0} tools</span>
                </div>
             )}
          </div>

          {/* MCP Servers List */}
          {data.config?.mcpEnabled && data.config?.mcpServers && data.config.mcpServers.length > 0 && (
             <div className="text-[9px] text-gray-600 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-900/30 p-1.5 rounded border border-gray-200 dark:border-zinc-800/50 flex flex-wrap gap-1">
                {data.config.mcpServers.map(server => (
                  <span key={server} className="px-1 rounded bg-indigo-100 dark:bg-indigo-500/5 text-indigo-700 dark:text-indigo-300/70 border border-indigo-200 dark:border-indigo-500/10">
                    {server}
                  </span>
                ))}
             </div>
          )}
        </div>

        {/* Execution Results */}
        {data.executionMode && (
          <div className="p-3 border-t border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-black/20">
             <div className="flex justify-between items-center text-[10px] mb-2">
                <span className="text-gray-500 dark:text-zinc-500 capitalize font-medium">{data.executionStatus || 'Pending'}</span>
                {data.executionData?.duration && (
                  <span className="text-gray-600 dark:text-zinc-600">{data.executionData.duration}ms</span>
                )}
             </div>
             
             {data.executionData?.output && (
               <div className="bg-green-50 dark:bg-green-500/10 p-2 rounded border border-green-200 dark:border-green-500/20 text-[10px] text-green-700 dark:text-green-300 font-mono break-words max-h-[100px] overflow-y-auto custom-scrollbar">
                  {typeof data.executionData.output === 'string' 
                    ? data.executionData.output
                    : JSON.stringify(data.executionData.output, null, 2)
                  }
               </div>
             )}

             {data.executionData?.error && (
               <div className="bg-red-50 dark:bg-red-500/10 p-2 rounded border border-red-200 dark:border-red-500/20 text-[10px] text-red-700 dark:text-red-300 font-mono break-words">
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
