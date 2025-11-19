import React from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';

export const ConditionNode = ({ data, selected }: any) => {
  
  const CustomHandles = (
    <>
      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES} 
        id="true" 
        style={{ top: '35%' }} 
      />
      <div className="absolute right-[-24px] top-[35%] -translate-y-1/2 text-[10px] font-bold text-green-500 pointer-events-none">
        YES
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES} 
        id="false" 
        style={{ top: '65%' }} 
      />
      <div className="absolute right-[-20px] top-[65%] -translate-y-1/2 text-[10px] font-bold text-red-500 pointer-events-none">
        NO
      </div>
    </>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={GitBranch}
      title={data.label}
      subtitle="Condition"
      color="text-blue-600 dark:text-blue-400"
      status={data.testStatus}
      handleLeft={true}
      handleRight={false} // We provide custom handles
      handles={CustomHandles}
      className="min-w-[220px]" // Slightly wider for the labels
    >
      <div className="p-3 bg-gray-50 dark:bg-zinc-900/50">
        <div className="text-xs text-gray-700 dark:text-zinc-300 font-mono bg-gray-100 dark:bg-black/20 p-1.5 rounded border border-gray-200 dark:border-zinc-800/50">
          {data.condition || 'If condition met'}
        </div>
      </div>
    </ModernNodeCard>
  );
};
