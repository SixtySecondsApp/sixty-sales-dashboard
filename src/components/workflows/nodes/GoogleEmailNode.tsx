import React from 'react';
import { Handle, Position } from 'reactflow';
import { Mail } from 'lucide-react';

interface GoogleEmailNodeProps {
  data: {
    label: string;
    description?: string;
    config?: {
      to: string[];
      cc?: string[];
      bcc?: string[];
      subject: string;
      body: string;
      isHtml?: boolean;
      attachments?: string[];
    };
    testStatus?: string;
  };
  selected?: boolean;
}

const GoogleEmailNode: React.FC<GoogleEmailNodeProps> = ({ data, selected }) => {
  const isConfigured = data.config && data.config.to && data.config.to.length > 0 && data.config.subject;
  const isActive = data.testStatus === 'active';
  
  return (
    <div 
      className={`
        bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg p-3 min-w-[180px] 
        border-2 shadow-lg relative transition-all duration-300
        ${isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-blue-500'}
        ${selected ? 'ring-2 ring-blue-300' : ''}
        ${!isConfigured ? 'opacity-75' : ''}
      `}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-white border-2 border-blue-500"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-white border-2 border-blue-500"
      />
      
      <div className="flex items-center gap-2 text-white">
        <div className="p-1.5 bg-white/20 rounded">
          <Mail className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold">{data.label || 'Send Gmail'}</div>
          <div className="text-[10px] opacity-80">
            {data.description || (isConfigured ? `To: ${data.config?.to[0]}` : 'Click to configure')}
          </div>
        </div>
      </div>
      
      {data.config && (
        <div className="mt-2 text-[9px] text-white/70 space-y-0.5">
          {data.config.to && <div>To: {data.config.to.join(', ')}</div>}
          {data.config.subject && <div>Subject: {data.config.subject}</div>}
        </div>
      )}
      
      {!isConfigured && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
          <span className="text-[8px] text-black font-bold">!</span>
        </div>
      )}
    </div>
  );
};

export default GoogleEmailNode;