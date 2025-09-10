import React, { useState, useEffect } from 'react';
import { X, ChevronRight, ChevronDown, Copy, CheckCircle, AlertCircle, Clock, Play } from 'lucide-react';
import { workflowExecutionService, type WorkflowExecution, type NodeExecution } from '@/lib/services/workflowExecutionService';
import { formatVariableValue } from '@/lib/utils/promptVariables';

interface ExecutionViewerProps {
  executionId?: string;
  workflowId?: string;
  isOpen: boolean;
  onClose: () => void;
  onVariableSelect?: (variable: string) => void;
}

export default function ExecutionViewer({ 
  executionId, 
  workflowId, 
  isOpen, 
  onClose,
  onVariableSelect 
}: ExecutionViewerProps) {
  const [execution, setExecution] = useState<WorkflowExecution | null>(null);
  const [selectedNode, setSelectedNode] = useState<NodeExecution | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | undefined>(executionId);
  const [activeTab, setActiveTab] = useState<'production' | 'test'>('production');

  useEffect(() => {
    if (workflowId) {
      // First, get any in-memory executions
      const memoryExecutions = workflowExecutionService.getWorkflowExecutionsByMode(
        workflowId, 
        activeTab === 'test' ? true : false
      );
      
      // If we have executions in memory, use them
      if (memoryExecutions.length > 0) {
        setExecutions(memoryExecutions);
        setSelectedExecutionId(memoryExecutions[0].id);
      } else {
        // Otherwise, load from database
        workflowExecutionService.loadExecutionsFromDatabase(workflowId).then(dbExecutions => {
          // Filter by mode
          const filteredExecutions = dbExecutions.filter(exec => 
            activeTab === 'test' ? exec.isTestMode === true : exec.isTestMode !== true
          );
          
          setExecutions(filteredExecutions);
          
          // Reset selected execution when changing tabs
          if (filteredExecutions.length > 0) {
            setSelectedExecutionId(filteredExecutions[0].id);
          } else {
            setSelectedExecutionId(undefined);
            setExecution(null);
          }
        });
      }
    }
  }, [workflowId, activeTab]);

  useEffect(() => {
    if (selectedExecutionId) {
      const exec = workflowExecutionService.getExecution(selectedExecutionId);
      setExecution(exec || null);

      // Subscribe to updates
      const unsubscribe = workflowExecutionService.subscribeToExecution(
        selectedExecutionId,
        (updatedExecution) => {
          setExecution(updatedExecution);
        }
      );

      return () => unsubscribe();
    }
  }, [selectedExecutionId]);

  const toggleNodeExpanded = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const copyVariable = (path: string) => {
    const variable = `{{${path}}}`;
    navigator.clipboard.writeText(variable);
    if (onVariableSelect) {
      onVariableSelect(variable);
    }
  };

  const getStatusIcon = (status: NodeExecution['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Clock className="w-4 h-4 text-yellow-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return null;
    }
  };

  const renderValue = (value: any, path: string = '', depth: number = 0): JSX.Element => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500">null</span>;
    }

    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div className={depth > 0 ? 'ml-4' : ''}>
          {Object.entries(value).map(([key, val]) => (
            <div key={key} className="py-1">
              <div className="flex items-start gap-2">
                <span className="text-blue-400 min-w-[100px]">{key}:</span>
                <div className="flex-1">
                  {renderValue(val, path ? `${path}.${key}` : key, depth + 1)}
                </div>
                {typeof val !== 'object' && (
                  <button
                    onClick={() => copyVariable(path ? `${path}.${key}` : key)}
                    className="p-1 hover:bg-gray-700 rounded transition-colors opacity-0 group-hover:opacity-100"
                    title="Copy as variable"
                  >
                    <Copy className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div className={depth > 0 ? 'ml-4' : ''}>
          {value.map((item, index) => (
            <div key={index} className="py-1">
              <div className="flex items-start gap-2">
                <span className="text-gray-400">[{index}]:</span>
                <div className="flex-1">
                  {renderValue(item, `${path}[${index}]`, depth + 1)}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <span className="text-gray-200">
        {typeof value === 'string' && value.length > 100 
          ? value.substring(0, 100) + '...' 
          : formatVariableValue(value)}
      </span>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-900 border border-gray-800 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-lg font-semibold text-white">Workflow Execution Viewer</h2>
            {execution && (
              <p className="text-sm text-gray-400 mt-1">
                Execution ID: {execution.id} {execution.isTestMode ? '(Test)' : '(Production)'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Execution Type Tabs */}
        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('production')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'production'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Production Executions
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'test'
                ? 'text-green-400 border-b-2 border-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Test Executions
          </button>
        </div>

        {/* Execution Selector */}
        {executions.length > 0 && (
          <div className="p-4 border-b border-gray-800">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Execution
            </label>
            <select
              value={selectedExecutionId}
              onChange={(e) => setSelectedExecutionId(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            >
              {executions.map((exec) => (
                <option key={exec.id} value={exec.id}>
                  {exec.triggeredBy} - {new Date(exec.startedAt).toLocaleString()} - {exec.status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!execution ? (
            <div className="text-center py-8">
              <p className="text-gray-400">
                No {activeTab} execution data available
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {activeTab === 'test' 
                  ? 'Use the test URL to trigger test executions'
                  : 'Run the workflow to see production execution details'
                }
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Execution Overview */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Execution Overview</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={`font-medium ${
                      execution.status === 'completed' ? 'text-green-500' :
                      execution.status === 'failed' ? 'text-red-500' :
                      execution.status === 'running' ? 'text-yellow-500' :
                      'text-gray-500'
                    }`}>
                      {execution.status}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Triggered By:</span>
                    <span className="text-white">{execution.triggeredBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Started:</span>
                    <span className="text-white">
                      {new Date(execution.startedAt).toLocaleString()}
                    </span>
                  </div>
                  {execution.completedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Completed:</span>
                      <span className="text-white">
                        {new Date(execution.completedAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Trigger Data */}
              {execution.triggerData && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Trigger Data</h3>
                  <div className="group">
                    {renderValue(execution.triggerData, 'triggerData')}
                  </div>
                </div>
              )}

              {/* Node Executions */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-white">Node Executions</h3>
                {execution.nodeExecutions.map((nodeExec) => (
                  <div
                    key={nodeExec.nodeId}
                    className="bg-gray-800 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        toggleNodeExpanded(nodeExec.nodeId);
                        setSelectedNode(nodeExec);
                      }}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-700 transition-colors"
                    >
                      {expandedNodes.has(nodeExec.nodeId) ? (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      )}
                      {getStatusIcon(nodeExec.status)}
                      <span className="text-white font-medium">
                        {nodeExec.nodeType} - {nodeExec.nodeId}
                      </span>
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(nodeExec.startedAt).toLocaleTimeString()}
                      </span>
                    </button>

                    {expandedNodes.has(nodeExec.nodeId) && (
                      <div className="p-4 border-t border-gray-700 space-y-4">
                        {/* Input */}
                        {nodeExec.input && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                              Input
                            </h4>
                            <div className="bg-gray-900 rounded p-3 group">
                              {renderValue(nodeExec.input, `nodes.${nodeExec.nodeId}.input`)}
                            </div>
                          </div>
                        )}

                        {/* Output */}
                        {nodeExec.output && (
                          <div>
                            <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                              Output
                            </h4>
                            <div className="bg-gray-900 rounded p-3 group">
                              {renderValue(nodeExec.output, `nodes.${nodeExec.nodeId}.output`)}
                            </div>
                          </div>
                        )}

                        {/* Error */}
                        {nodeExec.error && (
                          <div>
                            <h4 className="text-xs font-semibold text-red-400 uppercase mb-2">
                              Error
                            </h4>
                            <div className="bg-red-900/20 rounded p-3 text-red-300">
                              {nodeExec.error}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Final Output */}
              {execution.finalOutput && (
                <div className="bg-gray-800 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Final Output</h3>
                  <div className="group">
                    {renderValue(execution.finalOutput, 'finalOutput')}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <p className="text-xs text-gray-500">
            Click on any value and use the copy button to use it as a variable in other nodes
          </p>
        </div>
      </div>
    </div>
  );
}