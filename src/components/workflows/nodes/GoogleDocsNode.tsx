import React from 'react';
import { Handle, Position } from 'reactflow';
import { FileText } from 'lucide-react';

interface GoogleDocsNodeProps {
  data: {
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
  };
  selected?: boolean;
}

const GoogleDocsNode: React.FC<GoogleDocsNodeProps> = ({ data, selected }) => {
  const isConfigured = data.config && data.config.name && data.config.type;
  const isActive = data.testStatus === 'active';
  
  const getDocTypeIcon = () => {
    switch (data.config?.type) {
      case 'spreadsheet':
        return '📊';
      case 'presentation':
        return '📽️';
      case 'form':
        return '📋';
      default:
        return '📄';
    }
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
  
  return (
    <div 
      className={`
        bg-gradient-to-r from-green-600 to-green-700 rounded-lg p-3 min-w-[180px] 
        border-2 shadow-lg relative transition-all duration-300
        ${isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-green-500'}
        ${selected ? 'ring-2 ring-green-300' : ''}
        ${!isConfigured ? 'opacity-75' : ''}
      `}
    >
      <Handle 
        type="target" 
        position={Position.Left} 
        className="w-3 h-3 bg-white border-2 border-green-500"
      />
      <Handle 
        type="source" 
        position={Position.Right} 
        className="w-3 h-3 bg-white border-2 border-green-500"
      />
      
      <div className="flex items-center gap-2 text-white">
        <div className="p-1.5 bg-white/20 rounded">
          <FileText className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold">{data.label || 'Create Doc'}</div>
          <div className="text-[10px] opacity-80">
            {data.description || (isConfigured ? `${getDocTypeIcon()} ${data.config?.name}` : 'Click to configure')}
          </div>
        </div>
      </div>
      
      {data.config && (
        <div className="mt-2 text-[9px] text-white/70 space-y-0.5">
          <div>Type: {getDocTypeName()}</div>
          {data.config.name && <div>Name: {data.config.name}</div>}
          {data.config.templateId && <div>From template</div>}
          {data.config.shareWith && data.config.shareWith.length > 0 && (
            <div>Share: {data.config.shareWith.length} user(s)</div>
          )}
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

export default GoogleDocsNode;