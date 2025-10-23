import React from 'react';
import { Handle, Position } from 'reactflow';
import { FileText } from 'lucide-react';

interface GoogleDocsCreatorNodeProps {
  data: {
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
  };
  selected?: boolean;
}

const GoogleDocsCreatorNode: React.FC<GoogleDocsCreatorNodeProps> = ({ data, selected }) => {
  const isConfigured = data.isConfigured || false;
  const config = data.config || {};
  
  return (
    <div className={`bg-gradient-to-r from-green-600 to-emerald-600 rounded-lg p-3 min-w-[180px] shadow-lg ${
      selected ? 'ring-2 ring-green-400 ring-offset-2 ring-offset-gray-900' : ''
    } ${isConfigured ? 'opacity-100' : 'opacity-80'}`}>
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
      
      <div className="flex items-center gap-2 text-white mb-2">
        <FileText className="w-5 h-5" />
        <div className="font-semibold text-sm">Create Google Doc</div>
      </div>
      
      <div className="text-xs text-green-100 space-y-1">
        {data.docTitle && (
          <div className="bg-green-700/50 px-2 py-1 rounded">
            📄 {data.docTitle}
          </div>
        )}
        
        <div className="space-y-1 mt-2">
          {config.formatTranscript && (
            <div className="flex items-center gap-1">
              <span className="text-green-300">✓</span>
              <span className="text-[10px]">Format transcript</span>
            </div>
          )}
          {config.addTimestamps && (
            <div className="flex items-center gap-1">
              <span className="text-green-300">✓</span>
              <span className="text-[10px]">Add timestamps</span>
            </div>
          )}
          {config.shareWithAI && (
            <div className="flex items-center gap-1">
              <span className="text-green-300">✓</span>
              <span className="text-[10px]">AI access enabled</span>
            </div>
          )}
          {config.vectorDbReady && (
            <div className="flex items-center gap-1">
              <span className="text-green-300">✓</span>
              <span className="text-[10px]">Vector DB ready</span>
            </div>
          )}
        </div>
      </div>
      
      {!isConfigured && (
        <div className="mt-2 text-yellow-300 text-[10px]">
          ⚠️ Google auth required
        </div>
      )}
    </div>
  );
};

export default GoogleDocsCreatorNode;