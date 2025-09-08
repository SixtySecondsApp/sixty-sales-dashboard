import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Copy, Clock, CheckCircle, XCircle, AlertTriangle, PlayCircle, Code, Database, Eye, EyeOff } from 'lucide-react';

interface NodeExecutionModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeData: any;
  executionData: any;
  nodeName: string;
  nodeType: string;
}

const NodeExecutionModal: React.FC<NodeExecutionModalProps> = ({
  isOpen,
  onClose,
  nodeData,
  executionData,
  nodeName,
  nodeType
}) => {
  const [activeTab, setActiveTab] = useState<'summary' | 'input' | 'output'>('summary');
  const [showRawInput, setShowRawInput] = useState(false);
  const [showRawOutput, setShowRawOutput] = useState(false);

  if (!isOpen) return null;

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'running':
        return <PlayCircle className="w-5 h-5 text-blue-400" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'failed':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'running':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const formatDuration = (startTime?: string, endTime?: string) => {
    if (!startTime || !endTime) return 'N/A';
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime();
    return duration < 1000 ? `${duration}ms` : `${(duration / 1000).toFixed(2)}s`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const formatJSON = (data: any) => {
    if (!data) return 'No data available';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  };

  const renderJSONViewer = (data: any, showRaw: boolean, toggleRaw: () => void) => {
    if (!data) {
      return (
        <div className="text-center py-8 text-gray-400">
          <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No data available</p>
        </div>
      );
    }

    if (showRaw) {
      return (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Raw JSON</span>
            <button
              onClick={toggleRaw}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <EyeOff className="w-3 h-3" />
              Hide Raw
            </button>
          </div>
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 overflow-auto max-h-96">
            <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
              {formatJSON(data)}
            </pre>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Structured View</span>
          <div className="flex gap-2">
            <button
              onClick={toggleRaw}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <Eye className="w-3 h-3" />
              Show Raw
            </button>
            <button
              onClick={() => copyToClipboard(formatJSON(data))}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300"
            >
              <Copy className="w-3 h-3" />
              Copy
            </button>
          </div>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3 max-h-96 overflow-auto">
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="border-b border-gray-700/50 pb-2 last:border-b-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-blue-400">{key}</span>
                <span className="text-xs text-gray-500">{typeof value}</span>
              </div>
              <div className="text-sm text-gray-300 font-mono bg-gray-900/50 rounded p-2 break-all">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-750 p-6 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {getStatusIcon(executionData?.status)}
                  <div>
                    <h2 className="text-xl font-semibold text-white">{nodeName}</h2>
                    <p className="text-sm text-gray-400">{nodeType} • Node Execution Details</p>
                  </div>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(executionData?.status)}`}>
                  {executionData?.status || 'pending'}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="bg-gray-800/50 px-6 py-3 border-b border-gray-700">
            <div className="flex gap-1">
              {[
                { id: 'summary', label: 'Summary', icon: AlertTriangle },
                { id: 'input', label: 'Input', icon: Database },
                { id: 'output', label: 'Output', icon: Code }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {activeTab === 'summary' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Status</div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(executionData?.status)}
                      <span className="text-sm font-medium capitalize">{executionData?.status || 'Unknown'}</span>
                    </div>
                  </div>
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Duration</div>
                    <div className="text-sm font-medium">
                      {formatDuration(executionData?.startedAt, executionData?.completedAt)}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Started At</div>
                    <div className="text-sm font-medium">
                      {executionData?.startedAt ? new Date(executionData.startedAt).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>
                  <div className="bg-gray-800/30 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Operations</div>
                    <div className="text-sm font-medium">
                      {executionData?.operations || 1} operation{(executionData?.operations || 1) !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>

                {executionData?.error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                    <h3 className="text-red-400 font-medium mb-2">Error Details</h3>
                    <pre className="text-sm text-red-300 font-mono whitespace-pre-wrap">
                      {executionData.error}
                    </pre>
                  </div>
                )}

                <div className="bg-gray-800/30 rounded-lg p-4">
                  <h3 className="text-white font-medium mb-3">Node Configuration</h3>
                  <div className="space-y-2 text-sm">
                    {Object.entries(nodeData || {}).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-400">{key}:</span>
                        <span className="text-gray-300 font-mono max-w-xs truncate">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'input' && (
              <div>
                <h3 className="text-white font-medium mb-4">Input Data</h3>
                {renderJSONViewer(executionData?.input, showRawInput, () => setShowRawInput(!showRawInput))}
              </div>
            )}

            {activeTab === 'output' && (
              <div>
                <h3 className="text-white font-medium mb-4">Output Data</h3>
                {renderJSONViewer(executionData?.output, showRawOutput, () => setShowRawOutput(!showRawOutput))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-800/50 px-6 py-4 border-t border-gray-700 flex justify-between items-center">
            <div className="text-xs text-gray-400">
              Execution ID: {executionData?.id || 'N/A'}
            </div>
            <div className="flex gap-2">
              <button className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors">
                <Download className="w-3 h-3" />
                Export
              </button>
              <button
                onClick={() => copyToClipboard(formatJSON({ input: executionData?.input, output: executionData?.output }))}
                className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy All
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default NodeExecutionModal;