import React, { memo } from 'react';
import { NodeProps, Handle, Position } from 'reactflow';
import { GitBranch, Settings } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from './ModernNodeCard';

export interface ConditionalBranchNodeData {
  label?: string;
  conditions?: Array<{
    id: string;
    field: string;
    operator: string;
    value: string;
    output: string;
  }>;
  isConfigured?: boolean;
  testStatus?: string;
  executionMode?: boolean;
  executionData?: any;
  executionStatus?: 'pending' | 'running' | 'completed' | 'failed';
}

const ConditionalBranchNode = memo(({ data, selected }: NodeProps<ConditionalBranchNodeData>) => {
  const conditions = data.conditions || [];
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

  const CustomHandles = (
    <>
      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES}
        id="transcript"
        style={{ top: '25%' }}
      />
      <div className="absolute right-[-28px] top-[25%] -translate-y-1/2 text-[10px] font-bold text-yellow-400 pointer-events-none">
        Transcript
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES}
        id="summary"
        style={{ top: '50%' }}
      />
      <div className="absolute right-[-20px] top-[50%] -translate-y-1/2 text-[10px] font-bold text-green-400 pointer-events-none">
        Summary
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES}
        id="action_items"
        style={{ top: '75%' }}
      />
      <div className="absolute right-[-24px] top-[75%] -translate-y-1/2 text-[10px] font-bold text-orange-400 pointer-events-none">
        Actions
      </div>
    </>
  );

  const ConfigBadge = !isConfigured ? (
    <div className="px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 text-[9px] rounded border border-yellow-200 dark:border-yellow-500/30 font-bold mr-1">
      !
    </div>
  ) : null;

  return (
    <ModernNodeCard
      selected={selected}
      icon={GitBranch}
      title={data.label || 'Conditional Branch'}
      subtitle={conditions.length > 0 ? `${conditions.length} condition${conditions.length !== 1 ? 's' : ''}` : 'Configure branches'}
      color="text-blue-400"
      status={mapStatus()}
      badge={ConfigBadge}
      handleLeft={true}
      handleRight={false}
      handles={CustomHandles}
      className="min-w-[240px]"
    >
      <div className="p-3 space-y-3 bg-white dark:bg-[#1e1e1e]">
        {conditions.length > 0 ? (
          <div className="space-y-2">
            {conditions.slice(0, 3).map((condition, idx) => (
              <div key={idx} className="text-xs text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-900/50 p-2 rounded border border-gray-200 dark:border-zinc-800 font-mono">
                {condition.field} {condition.operator} {condition.value}
              </div>
            ))}
            {conditions.length > 3 && (
              <div className="text-[10px] text-zinc-500 text-center">
                +{conditions.length - 3} more condition{conditions.length - 3 !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[10px] text-yellow-600 dark:text-yellow-400/80 bg-yellow-50 dark:bg-yellow-500/10 p-2 rounded border border-yellow-200 dark:border-yellow-500/20">
            <Settings size={12} />
            <span>Configure branches</span>
          </div>
        )}
      </div>
    </ModernNodeCard>
  );
});

ConditionalBranchNode.displayName = 'ConditionalBranchNode';

export default ConditionalBranchNode;
