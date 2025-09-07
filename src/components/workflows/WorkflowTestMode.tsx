import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  Pause,
  RotateCcw,
  Link,
  CheckCircle,
  AlertCircle,
  Clock,
  Activity,
  Terminal,
  Copy,
  ExternalLink,
  Loader2,
  X,
  Zap,
  Bug,
  Eye
} from 'lucide-react';
import QRCode from 'qrcode';
import { workflowExecutionService, WorkflowExecution, NodeExecution } from '@/lib/services/workflowExecutionService';
import { formatDistanceToNow } from 'date-fns';

interface WorkflowTestModeProps {
  workflowId: string;
  workflowName?: string;
  formUrls?: {
    test?: string;
    production?: string;
  };
  onClose: () => void;
  onExecutionSelect?: (executionId: string) => void;
}

export default function WorkflowTestMode({
  workflowId,
  workflowName,
  formUrls,
  onClose,
  onExecutionSelect
}: WorkflowTestModeProps) {
  const [isListening, setIsListening] = useState(true);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<'overview' | 'logs' | 'debug'>('overview');
  const [logs, setLogs] = useState<Array<{ timestamp: string; type: 'info' | 'error' | 'success' | 'warning'; message: string }>>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Generate QR code for form URL
  useEffect(() => {
    if (formUrls?.test) {
      QRCode.toDataURL(formUrls.test, { width: 200, margin: 2 })
        .then(setQrCode)
        .catch(console.error);
    }
  }, [formUrls]);

  // Subscribe to workflow executions
  useEffect(() => {
    if (!isListening) return;

    const handleExecution = (execution: WorkflowExecution) => {
      if (execution.workflowId === workflowId) {
        setCurrentExecution(execution);
        setExecutions(prev => {
          const existing = prev.findIndex(e => e.id === execution.id);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = execution;
            return updated;
          }
          return [execution, ...prev].slice(0, 10); // Keep last 10 executions
        });

        // Add log entry
        const logType = execution.status === 'failed' ? 'error' : 
                       execution.status === 'completed' ? 'success' : 'info';
        addLog(logType, `Execution ${execution.id.slice(-8)} - Status: ${execution.status}`);

        // Log node executions
        execution.nodeExecutions?.forEach(node => {
          if (node.status === 'failed') {
            addLog('error', `Node ${node.nodeId} failed: ${node.error}`);
          } else if (node.status === 'completed') {
            addLog('success', `Node ${node.nodeId} completed`);
          }
        });
      }
    };

    // Subscribe to execution updates
    const unsubscribe = workflowExecutionService.subscribe(workflowId, handleExecution);

    // Load existing executions
    const existingExecutions = workflowExecutionService.getExecutions(workflowId);
    setExecutions(existingExecutions.slice(0, 10));

    addLog('info', `Test mode activated for workflow: ${workflowName || workflowId}`);
    if (formUrls?.test) {
      addLog('info', `Form URL ready: ${formUrls.test}`);
    }

    return () => {
      unsubscribe();
      addLog('info', 'Test mode deactivated');
    };
  }, [workflowId, workflowName, isListening, formUrls]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type: 'info' | 'error' | 'success' | 'warning', message: string) => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toISOString(),
      type,
      message
    }].slice(-100)); // Keep last 100 logs
  };

  const copyFormUrl = () => {
    if (formUrls?.test) {
      navigator.clipboard.writeText(formUrls.test);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
      addLog('info', 'Form URL copied to clipboard');
    }
  };

  const openFormInNewTab = () => {
    if (formUrls?.test) {
      window.open(formUrls.test, '_blank');
      addLog('info', 'Form opened in new tab');
    }
  };

  const clearExecutions = () => {
    setExecutions([]);
    setCurrentExecution(null);
    setLogs([]);
    addLog('info', 'Execution history cleared');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'paused':
        return <Pause className="w-4 h-4 text-yellow-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-3 h-3 text-red-400" />;
      case 'success':
        return <CheckCircle className="w-3 h-3 text-green-400" />;
      case 'warning':
        return <AlertCircle className="w-3 h-3 text-yellow-400" />;
      default:
        return <Activity className="w-3 h-3 text-blue-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="w-full max-w-6xl h-[80vh] bg-gray-900 rounded-xl border border-gray-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-600/20 rounded-lg">
              <Bug className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Workflow Test Mode</h2>
              <p className="text-sm text-gray-400">{workflowName || workflowId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsListening(!isListening)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                isListening 
                  ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30' 
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {isListening ? (
                <>
                  <Activity className="w-4 h-4 animate-pulse" />
                  Listening
                </>
              ) : (
                <>
                  <Pause className="w-4 h-4" />
                  Paused
                </>
              )}
            </button>
            <button
              onClick={clearExecutions}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Clear
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Form Info & Executions */}
          <div className="w-1/3 border-r border-gray-800 flex flex-col">
            {/* Form URL Section */}
            {formUrls?.test && (
              <div className="p-4 border-b border-gray-800">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Test Form URL</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={formUrls.test}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-300"
                    />
                    <button
                      onClick={copyFormUrl}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      title="Copy URL"
                    >
                      {copiedUrl ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={openFormInNewTab}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                  {qrCode && (
                    <div className="flex justify-center p-2 bg-white rounded-lg">
                      <img src={qrCode} alt="Form URL QR Code" className="w-32 h-32" />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Executions List */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Recent Executions</h3>
                <div className="space-y-2">
                  {executions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No executions yet</p>
                      <p className="text-xs mt-1">Submit the form to trigger an execution</p>
                    </div>
                  ) : (
                    executions.map(execution => (
                      <button
                        key={execution.id}
                        onClick={() => {
                          setCurrentExecution(execution);
                          onExecutionSelect?.(execution.id);
                        }}
                        className={`w-full p-3 rounded-lg border transition-colors text-left ${
                          currentExecution?.id === execution.id
                            ? 'bg-blue-600/20 border-blue-600/50'
                            : 'bg-gray-800/50 border-gray-700 hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-gray-400">
                            {execution.id.slice(-8)}
                          </span>
                          {getStatusIcon(execution.status)}
                        </div>
                        <div className="text-sm text-gray-300">
                          {execution.triggeredBy === 'form' ? 'Form Submission' : execution.triggeredBy}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(execution.startedAt), { addSuffix: true })}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Tabs Content */}
          <div className="flex-1 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setSelectedTab('overview')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedTab === 'overview'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Overview
                </div>
              </button>
              <button
                onClick={() => setSelectedTab('logs')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedTab === 'logs'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4" />
                  Logs
                </div>
              </button>
              <button
                onClick={() => setSelectedTab('debug')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  selectedTab === 'debug'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Debug
                </div>
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {selectedTab === 'overview' && (
                <div>
                  {currentExecution ? (
                    <div className="space-y-4">
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Execution Details</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">ID:</span>
                            <span className="ml-2 text-gray-300">{currentExecution.id}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Status:</span>
                            <span className="ml-2 text-gray-300">{currentExecution.status}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Triggered By:</span>
                            <span className="ml-2 text-gray-300">{currentExecution.triggeredBy}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Started:</span>
                            <span className="ml-2 text-gray-300">
                              {new Date(currentExecution.startedAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Node Executions</h4>
                        <div className="space-y-2">
                          {currentExecution.nodeExecutions?.map((node, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-900/50 rounded">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(node.status)}
                                <span className="text-sm text-gray-300">{node.nodeId}</span>
                              </div>
                              <span className="text-xs text-gray-500">{node.nodeType}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Select an execution to view details</p>
                    </div>
                  )}
                </div>
              )}

              {selectedTab === 'logs' && (
                <div className="font-mono text-xs">
                  {logs.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No logs yet</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {logs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2 py-1">
                          <span className="text-gray-600">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          {getLogIcon(log.type)}
                          <span className={`flex-1 ${
                            log.type === 'error' ? 'text-red-400' :
                            log.type === 'success' ? 'text-green-400' :
                            log.type === 'warning' ? 'text-yellow-400' :
                            'text-gray-400'
                          }`}>
                            {log.message}
                          </span>
                        </div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  )}
                </div>
              )}

              {selectedTab === 'debug' && (
                <div>
                  {currentExecution ? (
                    <div className="space-y-4">
                      <div className="bg-gray-800/50 rounded-lg p-4">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Trigger Data</h4>
                        <pre className="text-xs text-gray-400 overflow-x-auto">
                          {JSON.stringify(currentExecution.triggerData, null, 2)}
                        </pre>
                      </div>
                      
                      {currentExecution.finalOutput && (
                        <div className="bg-gray-800/50 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-gray-300 mb-3">Final Output</h4>
                          <pre className="text-xs text-gray-400 overflow-x-auto">
                            {JSON.stringify(currentExecution.finalOutput, null, 2)}
                          </pre>
                        </div>
                      )}

                      {currentExecution.nodeExecutions?.filter(n => n.error).map((node, index) => (
                        <div key={index} className="bg-red-900/20 border border-red-800/50 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-red-400 mb-3">
                            Error in {node.nodeId}
                          </h4>
                          <pre className="text-xs text-red-300 overflow-x-auto">
                            {node.error}
                          </pre>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-gray-500">
                      <Bug className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Select an execution to debug</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}