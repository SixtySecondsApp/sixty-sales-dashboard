import React, { useState, useEffect, useCallback } from 'react';
import { 
  Beaker as BeakerIcon, 
  Play as PlayIcon, 
  Pause as PauseIcon, 
  Square as StopIcon,
  FileText as DocumentTextIcon,
  CheckCircle as CheckCircleIcon,
  AlertCircle as ExclamationCircleIcon,
  Info as InformationCircleIcon,
  ChevronDown as ChevronDownIcon,
  ChevronRight as ChevronRightIcon,
  Download as ArrowDownTrayIcon,
  Upload as ArrowUpTrayIcon,
  Clock as ClockIcon,
  Trash2 as TrashIcon,
  ClipboardCheck as ClipboardDocumentCheckIcon
} from 'lucide-react';
import { 
  payloadTemplates, 
  getTemplatesByCategory, 
  getTemplateById,
  validatePayload,
  type PayloadTemplate 
} from '@/lib/utils/testPayloadTemplates';
import { WorkflowTestEngine, type TestExecutionState, type ExecutionLog } from '@/lib/utils/workflowTestEngine';

interface TestingLabCustomPayloadProps {
  workflow: any;
  nodes: any[];
  edges: any[];
  testEngine: WorkflowTestEngine | null;
  executionState: TestExecutionState | null;
}

interface PayloadHistory {
  id: string;
  timestamp: number;
  payload: any;
  name?: string;
  success?: boolean;
}

export default function TestingLabCustomPayload({
  workflow,
  nodes,
  edges,
  testEngine: providedTestEngine,
  executionState: providedExecutionState
}: TestingLabCustomPayloadProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<PayloadTemplate | null>(null);
  const [payloadText, setPayloadText] = useState('{\n  \n}');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<PayloadTemplate['category'] | 'all'>('all');
  const [payloadHistory, setPayloadHistory] = useState<PayloadHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [testEngine, setTestEngine] = useState<WorkflowTestEngine | null>(providedTestEngine);
  const [executionState, setExecutionState] = useState<TestExecutionState | null>(providedExecutionState);

  // Initialize test engine when nodes/edges change
  useEffect(() => {
    if (nodes && edges && nodes.length > 0) {
      const engine = new WorkflowTestEngine(
        nodes,
        edges,
        (state) => setExecutionState(state)
      );
      setTestEngine(engine);
    }
  }, [nodes, edges]);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('workflow_payload_history');
    if (savedHistory) {
      try {
        setPayloadHistory(JSON.parse(savedHistory));
      } catch (e) {
      }
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (payloadHistory.length > 0) {
      localStorage.setItem('workflow_payload_history', JSON.stringify(payloadHistory.slice(0, 10)));
    }
  }, [payloadHistory]);

  // Validate JSON as user types
  useEffect(() => {
    try {
      JSON.parse(payloadText);
      setIsValid(true);
      setValidationErrors([]);
    } catch (e) {
      setIsValid(false);
      const error = e as Error;
      const lineMatch = error.message.match(/position (\d+)/);
      const line = lineMatch ? Math.floor(parseInt(lineMatch[1]) / 50) + 1 : 1;
      setValidationErrors([`Line ${line}: ${error.message}`]);
    }
  }, [payloadText]);

  // Load template
  const handleTemplateSelect = (template: PayloadTemplate) => {
    setSelectedTemplate(template);
    const formattedPayload = JSON.stringify(template.payload, null, 2);
    setPayloadText(formattedPayload);
  };

  // Format JSON
  const formatJson = () => {
    try {
      const parsed = JSON.parse(payloadText);
      setPayloadText(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // Already showing validation errors
    }
  };

  // Clear payload
  const clearPayload = () => {
    setPayloadText('{\n  \n}');
    setSelectedTemplate(null);
  };

  // Test with payload
  const testWithPayload = async () => {
    if (!isValid || !testEngine) return;

    try {
      const payload = JSON.parse(payloadText);
      
      // Add to history
      const historyEntry: PayloadHistory = {
        id: `history_${Date.now()}`,
        timestamp: Date.now(),
        payload,
        name: selectedTemplate?.name || 'Custom Payload'
      };
      
      setPayloadHistory(prev => [historyEntry, ...prev].slice(0, 10));
      
      // Start test
      await testEngine.startTestWithCustomPayload(payload);
      
      // Update history entry with success
      setPayloadHistory(prev => 
        prev.map(h => h.id === historyEntry.id ? { ...h, success: true } : h)
      );
    } catch (error) {
      // Update history entry with failure
      setPayloadHistory(prev => 
        prev.map((h, i) => i === 0 ? { ...h, success: false } : h)
      );
    }
  };

  // Load from history
  const loadFromHistory = (entry: PayloadHistory) => {
    setPayloadText(JSON.stringify(entry.payload, null, 2));
    setSelectedTemplate(null);
    setShowHistory(false);
  };

  // Delete from history
  const deleteFromHistory = (id: string) => {
    setPayloadHistory(prev => prev.filter(h => h.id !== id));
  };

  // Export payload
  const exportPayload = () => {
    const dataStr = JSON.stringify({
      payload: JSON.parse(payloadText),
      template: selectedTemplate?.name,
      timestamp: new Date().toISOString(),
      workflow: workflow?.name
    }, null, 2);
    
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `workflow_test_payload_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Import payload
  const importPayload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const data = JSON.parse(content);
          const payload = data.payload || data;
          setPayloadText(JSON.stringify(payload, null, 2));
          setSelectedTemplate(null);
        } catch (error) {
        }
      };
      reader.readAsText(file);
    }
  };

  // Toggle node expansion
  const toggleNodeExpansion = (nodeId: string) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  // Get node response data
  const getNodeResponseData = (nodeId: string) => {
    if (!executionState) return null;
    const nodeState = executionState.nodeStates.get(nodeId);
    const logs = executionState.logs.filter(log => log.nodeId === nodeId);
    return { nodeState, logs };
  };

  // Render JSON tree viewer
  const renderJsonTree = (data: any, depth = 0): JSX.Element => {
    if (data === null) return <span className="text-gray-500">null</span>;
    if (data === undefined) return <span className="text-gray-500">undefined</span>;
    
    if (typeof data === 'object' && !Array.isArray(data)) {
      return (
        <div className={depth > 0 ? 'ml-4' : ''}>
          {'{'}
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="ml-4">
              <span className="text-blue-400">"{key}"</span>: {renderJsonTree(value, depth + 1)}
            </div>
          ))}
          {'}'}
        </div>
      );
    }
    
    if (Array.isArray(data)) {
      return (
        <span>
          [{data.length > 0 && '...'}] ({data.length} items)
        </span>
      );
    }
    
    if (typeof data === 'string') return <span className="text-green-400">"{data}"</span>;
    if (typeof data === 'number') return <span className="text-yellow-400">{data}</span>;
    if (typeof data === 'boolean') return <span className="text-purple-400">{String(data)}</span>;
    
    return <span>{String(data)}</span>;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BeakerIcon className="h-6 w-6 text-purple-400" />
            <h2 className="text-lg font-semibold">Custom Payload Testing</h2>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Template Selector */}
            <select
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              value={selectedTemplate?.id || ''}
              onChange={(e) => {
                const template = getTemplateById(e.target.value);
                if (template) handleTemplateSelect(template);
              }}
            >
              <option value="">Select Template...</option>
              {payloadTemplates.map(template => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
            >
              <option value="all">All Categories</option>
              <option value="fathom">Fathom</option>
              <option value="crm">CRM</option>
              <option value="task">Tasks</option>
              <option value="webhook">Webhooks</option>
              <option value="general">General</option>
            </select>

            {/* Import/Export */}
            <button
              onClick={() => document.getElementById('import-file')?.click()}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Import JSON"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
            </button>
            <input
              id="import-file"
              type="file"
              accept=".json"
              className="hidden"
              onChange={importPayload}
            />
            
            <button
              onClick={exportPayload}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Export JSON"
              disabled={!isValid}
            >
              <ArrowUpTrayIcon className="h-5 w-5" />
            </button>

            {/* History */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors relative"
              title="Payload History"
            >
              <ClockIcon className="h-5 w-5" />
              {payloadHistory.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                  {payloadHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - JSON Editor */}
        <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="flex-1 relative">
            <textarea
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              className={`absolute inset-0 w-full h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4 font-mono text-sm resize-none focus:outline-none ${
                !isValid ? 'border-2 border-red-500' : ''
              }`}
              placeholder="Enter your JSON payload here..."
              spellCheck={false}
            />
            
            {/* Line Numbers */}
            <div className="absolute left-0 top-0 p-4 text-gray-600 font-mono text-sm pointer-events-none select-none">
              {payloadText.split('\n').map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
          </div>

          {/* Validation Status */}
          <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3">
            {isValid ? (
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircleIcon className="h-5 w-5" />
                <span className="text-sm">Valid JSON</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-red-400">
                  <ExclamationCircleIcon className="h-5 w-5" />
                  <span className="text-sm">Invalid JSON</span>
                </div>
                {validationErrors.map((error, i) => (
                  <div key={i} className="text-xs text-red-300 ml-7">
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2">
            <button
              onClick={formatJson}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
              disabled={!isValid}
            >
              Format JSON
            </button>
            
            <button
              onClick={clearPayload}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
            >
              Clear
            </button>
            
            <button
              onClick={() => {
                navigator.clipboard.writeText(payloadText);
              }}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-sm transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-200"
            >
              <ClipboardDocumentCheckIcon className="h-4 w-4 inline mr-1" />
              Copy
            </button>

            <div className="flex-1" />
            
            <button
              onClick={testWithPayload}
              disabled={!isValid || !testEngine || executionState?.isRunning}
              className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:text-gray-500 rounded text-sm transition-colors flex items-center gap-2"
            >
              <PlayIcon className="h-4 w-4" />
              Test with Payload
            </button>
          </div>
        </div>

        {/* Right Panel - Node Responses */}
        <div className="w-1/2 flex flex-col">
          <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3">
            <h3 className="font-medium">Node Responses</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4">
            {executionState && executionState.logs.length > 0 ? (
              <div className="space-y-3">
                {/* Group logs by node */}
                {nodes.map(node => {
                  const responseData = getNodeResponseData(node.id);
                  if (!responseData?.logs?.length) return null;
                  
                  const { nodeState, logs } = responseData;
                  const isExpanded = expandedNodes.has(node.id);
                  
                  return (
                    <div 
                      key={node.id} 
                      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                    >
                      <button
                        onClick={() => toggleNodeExpansion(node.id)}
                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDownIcon className="h-4 w-4" />
                          ) : (
                            <ChevronRightIcon className="h-4 w-4" />
                          )}
                          <span className="font-medium">{node.data?.label || node.id}</span>
                          
                          {/* Status Badge */}
                          {nodeState && (
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              nodeState.status === 'success' ? 'bg-green-900 text-green-300' :
                              nodeState.status === 'failed' ? 'bg-red-900 text-red-300' :
                              nodeState.status === 'skipped' ? 'bg-gray-700 text-gray-400' :
                              nodeState.status === 'active' ? 'bg-blue-900 text-blue-300' :
                              'bg-gray-700 text-gray-400'
                            }`}>
                              {nodeState.status}
                            </span>
                          )}
                        </div>
                        
                        {nodeState?.executionTime && (
                          <span className="text-sm text-gray-400">
                            {nodeState.executionTime}ms
                          </span>
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="border-t border-gray-200 dark:border-gray-700">
                          {/* Input Data */}
                          {nodeState?.inputData && (
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">📥 Input Data:</div>
                              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                                {JSON.stringify(nodeState.inputData, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {/* Output Data */}
                          {nodeState?.outputData && (
                            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">📤 Output Data:</div>
                              <pre className="text-xs bg-gray-50 dark:bg-gray-900 p-2 rounded overflow-x-auto">
                                {JSON.stringify(nodeState.outputData, null, 2)}
                              </pre>
                            </div>
                          )}
                          
                          {/* Execution Logs */}
                          <div className="p-4">
                            <div className="text-sm text-gray-400 mb-2">📋 Execution Log:</div>
                            <div className="space-y-1">
                              {logs.map((log, i) => (
                                <div key={i} className="text-xs flex items-start gap-2">
                                  <span className="text-gray-600">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                  <span className={`${
                                    log.type === 'error' ? 'text-red-400' :
                                    log.type === 'complete' ? 'text-green-400' :
                                    log.type === 'condition' ? 'text-blue-400' :
                                    'text-gray-300'
                                  }`}>
                                    {log.message}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          
                          {/* Error Message */}
                          {nodeState?.error && (
                            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
                              <div className="text-sm text-red-400">❌ Error:</div>
                              <div className="text-xs text-red-300 mt-1">{nodeState.error}</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <InformationCircleIcon className="h-12 w-12 mb-3" />
                <p className="text-sm">Run a test to see node responses</p>
                <p className="text-xs mt-1">Each node will show input/output data and execution details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="absolute top-16 right-4 w-80 max-h-96 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden z-50">
          <div className="bg-gray-50 dark:bg-gray-900 p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="font-medium">Payload History</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {payloadHistory.length > 0 ? (
              <div className="p-2 space-y-2">
                {payloadHistory.map(entry => (
                  <div 
                    key={entry.id}
                    className="bg-gray-50 dark:bg-gray-900 rounded p-3 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer group"
                    onClick={() => loadFromHistory(entry)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{entry.name}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteFromHistory(entry.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <TrashIcon className="h-4 w-4 text-red-400 hover:text-red-300" />
                      </button>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                    {entry.success !== undefined && (
                      <div className="mt-1">
                        {entry.success ? (
                          <span className="text-xs text-green-400">✅ Success</span>
                        ) : (
                          <span className="text-xs text-red-400">❌ Failed</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                No history yet
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}