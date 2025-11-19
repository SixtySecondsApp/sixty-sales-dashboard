import React from 'react';
import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { ModernNodeCard, HANDLE_STYLES } from '../ModernNodeCard';

export const RouterNode = ({ data, selected }: any) => {
  
  const CustomHandles = (
    <>
      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES} 
        id="a" 
        style={{ top: '30%' }} 
      />
      <div className="absolute right-[-15px] top-[30%] -translate-y-1/2 text-[8px] font-bold text-gray-600 dark:text-zinc-500 pointer-events-none">A</div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES} 
        id="b" 
        style={{ top: '50%' }} 
      />
      <div className="absolute right-[-15px] top-[50%] -translate-y-1/2 text-[8px] font-bold text-gray-600 dark:text-zinc-500 pointer-events-none">B</div>

      <Handle 
        type="source" 
        position={Position.Right} 
        className={HANDLE_STYLES} 
        id="c" 
        style={{ top: '70%' }} 
      />
      <div className="absolute right-[-15px] top-[70%] -translate-y-1/2 text-[8px] font-bold text-gray-600 dark:text-zinc-500 pointer-events-none">C</div>
    </>
  );

  return (
    <ModernNodeCard
      selected={selected}
      icon={GitBranch}
      title={data.label}
      subtitle="Router"
      color="text-blue-600 dark:text-blue-400"
      status={data.testStatus}
      handleLeft={true}
      handleRight={false}
      handles={CustomHandles}
    >
      <div className="p-3 bg-gray-50 dark:bg-zinc-900/50">
        <div className="text-xs text-gray-700 dark:text-zinc-400 leading-relaxed">
          {data.description || 'Routes to multiple paths'}
        </div>
      </div>
    </ModernNodeCard>
  );
};
