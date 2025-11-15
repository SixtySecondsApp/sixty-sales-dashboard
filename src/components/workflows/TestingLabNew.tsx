import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TestTube,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Database,
  FileText,
  Zap,
  Download,
  Copy,
  StepForward,
  SkipForward,
  Eye,
  Settings,
  Activity,
  Target,
  TrendingUp,
  Award,
  Star,
  Shield,
  Trophy,
  X,
  Loader2,
  RefreshCw
} from 'lucide-react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { workflowExecutionService, type WorkflowExecution, type NodeExecution } from '@/lib/services/workflowExecutionService';
import { formatDistanceToNow } from 'date-fns';
import NodeExecutionModal from './NodeExecutionModal';

interface TestingLabNewProps {
  workflow: any;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  data: Record<string, any>;
}

// Custom node components with execution status
const TestNode = ({ data, selected, id }: any) => {
  const status = data.testStatus || 'idle';
  const isActive = status === 'running';
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'border-green-500 bg-green-500/20';
      case 'failed': return 'border-red-500 bg-red-500/20';
      case 'running': return 'border-blue-500 bg-blue-500/20 animate-pulse';
      case 'pending': return 'border-yellow-500 bg-yellow-500/20';
      default: return 'border-gray-500 bg-gray-700';
    }
  };

  return (
    <div className={`px-3 py-2 rounded-lg border-2 transition-all duration-300 ${getStatusColor(status)} ${selected ? 'ring-2 ring-blue-300' : ''}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-white border-2 border-gray-500" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-white border-2 border-gray-500" />
      <div className="flex items-center gap-2 text-white">
        {status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
        {status === 'completed' && <CheckCircle className="w-3 h-3 text-green-400" />}
        {status === 'failed' && <AlertCircle className="w-3 h-3 text-red-400" />}
        <div>
          <div className="text-[10px] font-semibold">{data.label || data.type}</div>
          {data.description && (
            <div className="text-[8px] opacity-80">{data.description}</div>
          )}
        </div>
      </div>
    </div>
  );
};

const nodeTypes = {
  trigger: TestNode,
  form: TestNode,
  aiAgent: TestNode,
  action: TestNode,
  condition: TestNode,
  router: TestNode,
  default: TestNode
};

const TestingLabNew: React.FC<TestingLabNewProps> = ({ workflow }) => {
  const [testNodes, setTestNodes] = useNodesState(workflow?.canvas_data?.nodes || []);
  const [testEdges, setTestEdges] = useEdgesState(workflow?.canvas_data?.edges || []);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [executionSpeed, setExecutionSpeed] = useState(1000);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [showDataInput, setShowDataInput] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeExecution, setSelectedNodeExecution] = useState<NodeExecution | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [testHistory, setTestHistory] = useState<WorkflowExecution[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-defined test scenarios
  const testScenarios: TestScenario[] = [
    {
      id: 'basic-form',
      name: '📋 Basic Form Submission',
      description: 'Simple form data with name, email, and message',
      data: {
        formData: {
          submittedAt: new Date().toISOString(),
          fields: {
            name: 'John Doe',
            email: 'john@example.com',
            message: 'This is a test message from the Testing Lab',
            company: 'Test Company'
          },
          formId: 'test-form-1',
          submissionId: 'sub-' + Date.now()
        }
      }
    },
    {
      id: 'high-value-deal',
      name: '💰 High Value Deal',
      description: 'Enterprise deal for testing value-based routing',
      data: {
        formData: {
          submittedAt: new Date().toISOString(),
          fields: {
            dealName: 'Enterprise Software License',
            value: 250000,
            stage: 'Opportunity',
            priority: 'high',
            owner: 'sales-manager',
            company: 'Enterprise Corp',
            contact: 'jane.doe@enterprise.com'
          },
          formId: 'deal-form',
          submissionId: 'deal-' + Date.now()
        }
      }
    },
    {
      id: 'low-value-deal',
      name: '🏷️ Small Business Deal',
      description: 'Small business package for testing routing logic',
      data: {
        formData: {
          submittedAt: new Date().toISOString(),
          fields: {
            dealName: 'Small Business Package',
            value: 5000,
            stage: 'SQL',
            priority: 'normal',
            owner: 'sales-rep',
            company: 'Small Business Inc',
            contact: 'owner@smallbiz.com'
          },
          formId: 'deal-form',
          submissionId: 'deal-' + Date.now()
        }
      }
    },
    {
      id: 'support-ticket',
      name: '🎧 Support Request',
      description: 'Customer support ticket for testing support workflows',
      data: {
        formData: {
          submittedAt: new Date().toISOString(),
          fields: {
            ticketType: 'Bug Report',
            priority: 'high',
            subject: 'Application crashes on startup',
            description: 'The application crashes immediately when I try to start it.',
            customerEmail: 'customer@example.com',
            customerTier: 'premium'
          },
          formId: 'support-form',
          submissionId: 'ticket-' + Date.now()
        }
      }
    },
    {
      id: 'custom',
      name: '⚙️ Custom Test Data',
      description: 'Define your own test data for specific scenarios',
      data: {}
    }
  ];

  // Load test history
  const loadTestHistory = async () => {
    if (!workflow?.id) return;
    
    try {
      await workflowExecutionService.loadAllExecutionsFromDatabase();
      const executions = workflowExecutionService.getAllExecutions()
        .filter(exec => exec.workflowId === workflow.id && exec.isTestMode)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 10); // Last 10 test executions
      
      setTestHistory(executions);
    } catch (error) {
    }
  };

  // Initialize nodes with test status
  useEffect(() => {
    if (workflow?.canvas_data?.nodes) {
      const initialNodes = workflow.canvas_data.nodes.map((node: any) => ({
        ...node,
        data: {
          ...node.data,
          testStatus: 'idle' as const,
          executionData: null
        }
      }));
      setTestNodes(initialNodes);
      setTestEdges(workflow.canvas_data.edges || []);
      setSelectedScenario(testScenarios[0].id);
      setExecutionLog([]);
      loadTestHistory();
    }
  }, [workflow]);

  // Handle test scenario selection
  const handleScenarioChange = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    const scenario = testScenarios.find(s => s.id === scenarioId);
    if (scenario && scenarioId !== 'custom') {
      setCustomData(scenario.data);
      setShowDataInput(false);
    } else {
      setShowDataInput(true);
    }
  };

  // Add log entry
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setExecutionLog(prev => [...prev, `${timestamp}: ${message}`]);
  };

  // Start test execution
  const startExecution = async () => {
    if (!workflow?.id) {
      addLog('❌ No workflow selected');
      return;
    }

    if (testNodes.length === 0) {
      addLog('❌ No nodes to execute');
      return;
    }

    setIsExecuting(true);
    setIsPaused(false);
    
    addLog('🚀 Starting test execution in Testing Lab...');
    
    // Reset all nodes to idle state
    const resetNodes = testNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        testStatus: 'idle' as const,
        executionData: null
      }
    }));
    setTestNodes(resetNodes);

    try {
      // Get test data based on selected scenario
      const testData = selectedScenario === 'custom' ? customData : 
        testScenarios.find(s => s.id === selectedScenario)?.data || {};

      addLog(`📋 Using test scenario: ${testScenarios.find(s => s.id === selectedScenario)?.name}`);

      // Start the actual execution
      const executionId = await workflowExecutionService.startExecution(
        workflow.id,
        testNodes,
        testEdges,
        'manual',
        testData,
        true, // isTestMode - This is key for the Testing Lab!
        workflow.rule_name || 'Test Execution'
      );

      addLog(`✅ Test execution started: ${executionId}`);
      
      // Subscribe to execution updates
      const unsubscribe = workflowExecutionService.subscribeToExecution(
        executionId,
        handleExecutionUpdate
      );

      // Start visual step-through
      startVisualExecution();

      // Store cleanup function
      return () => {
        unsubscribe();
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };

    } catch (error: any) {
      addLog(`❌ Failed to start execution: ${error.message}`);
      setIsExecuting(false);
    }
  };

  // Handle execution updates from service
  const handleExecutionUpdate = (execution: WorkflowExecution) => {
    setCurrentExecution(execution);
    
    // Update node states based on execution
    const updatedNodes = testNodes.map(node => {
      const nodeExecution = execution.nodeExecutions.find(ne => ne.nodeId === node.id);
      if (nodeExecution) {
        return {
          ...node,
          data: {
            ...node.data,
            testStatus: nodeExecution.status,
            executionData: nodeExecution
          }
        };
      }
      return node;
    });
    
    setTestNodes(updatedNodes);
    
    if (execution.status === 'completed') {
      addLog('✅ Test execution completed successfully');
      setIsExecuting(false);
      loadTestHistory(); // Refresh history
    } else if (execution.status === 'failed') {
      addLog('❌ Test execution failed');
      setIsExecuting(false);
      loadTestHistory(); // Refresh history
    }
  };

  // Visual step-through execution
  const startVisualExecution = () => {
    let stepIndex = 0;
    const totalNodes = testNodes.length;

    intervalRef.current = setInterval(() => {
      if (isPaused) return;

      if (stepIndex < totalNodes) {
        addLog(`⚡ Processing node: ${testNodes[stepIndex]?.data?.label || testNodes[stepIndex]?.id}`);
        stepIndex++;
      } else {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      }
    }, executionSpeed);
  };

  // Control functions
  const pauseExecution = () => {
    setIsPaused(!isPaused);
    addLog(isPaused ? '▶️ Resumed execution' : '⏸️ Paused execution');
  };

  const stopExecution = () => {
    setIsExecuting(false);
    setIsPaused(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    // Reset all nodes
    const resetNodes = testNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        testStatus: 'idle' as const
      }
    }));
    setTestNodes(resetNodes);
    
    addLog('⏹️ Execution stopped');
  };

  // Handle node click
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    const nodeExecution = currentExecution?.nodeExecutions.find(ne => ne.nodeId === node.id);
    setSelectedNodeExecution(nodeExecution || null);
    setShowNodeModal(true);
  };

  // Export test results
  const exportResults = () => {
    const results = {
      workflowName: workflow?.rule_name,
      testScenario: selectedScenario,
      testData: selectedScenario === 'custom' ? customData : 
        testScenarios.find(s => s.id === selectedScenario)?.data,
      execution: currentExecution,
      logs: executionLog,
      exportedAt: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `testing-lab-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addLog('📥 Test results exported');
  };

  if (!workflow) {
    return (
      <div className="bg-white dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-xl p-8 text-center">
        <TestTube className="w-12 h-12 mx-auto text-gray-500 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Testing Lab</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">Select a workflow to start testing</p>
        <div className="text-sm text-gray-500">
          Build your workflow in the Builder tab, then come here to test it with real data
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900/50 backdrop-blur-xl border border-gray-200 dark:border-gray-800/50 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-white dark:bg-gradient-to-r dark:from-blue-900 dark:to-purple-900 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <TestTube className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">🧪 Testing Lab</h2>
              <p className="text-sm text-gray-600 dark:text-blue-200">{workflow.rule_name || 'Untitled Workflow'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTestHistory}
              className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300"
              title="Refresh test history"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={exportResults}
              disabled={!currentExecution}
              className="p-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
              title="Export test results"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex h-[600px]">
        {/* Left Panel - Test Controls */}
        <div className="w-80 bg-white dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          {/* Test Scenarios */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Test Scenarios
            </h3>
            <div className="space-y-2">
              {testScenarios.map(scenario => (
                <button
                  key={scenario.id}
                  onClick={() => handleScenarioChange(scenario.id)}
                  className={`w-full p-3 text-left rounded-lg border transition-colors ${
                    selectedScenario === scenario.id
                      ? 'bg-blue-500/20 border-blue-500 text-blue-200'
                      : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{scenario.name}</div>
                  <div className="text-xs opacity-75 mt-1">{scenario.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Data Input */}
          {showDataInput && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Custom Test Data</h3>
              <textarea
                value={JSON.stringify(customData, null, 2)}
                onChange={(e) => {
                  try {
                    setCustomData(JSON.parse(e.target.value));
                  } catch {}
                }}
                className="w-full h-32 p-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white text-xs font-mono resize-none focus:outline-none focus:border-blue-500"
                placeholder="Enter JSON test data..."
              />
            </div>
          )}

          {/* Execution Controls */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Play className="w-4 h-4 text-green-400" />
              Controls
            </h3>
            <div className="space-y-2">
              {!isExecuting ? (
                <button
                  onClick={startExecution}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Start Test
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={pauseExecution}
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    onClick={stopExecution}
                    className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Stop
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Test History */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" />
              Recent Tests ({testHistory.length})
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {testHistory.map((test) => (
                <div
                  key={test.id}
                  className="p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 text-xs"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {test.status === 'completed' ? '✅' : test.status === 'failed' ? '❌' : '⏳'}
                    </span>
                    <span className="text-gray-400">
                      {formatDistanceToNow(new Date(test.startedAt))} ago
                    </span>
                  </div>
                  {test.error && (
                    <div className="text-red-400 truncate">
                      Error: {test.error}
                    </div>
                  )}
                </div>
              ))}
              {testHistory.length === 0 && (
                <p className="text-gray-500 text-xs">No test history yet</p>
              )}
            </div>
          </div>

          {/* Execution Log */}
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" />
              Execution Log
            </h3>
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-3 h-40 overflow-y-auto">
              {executionLog.length === 0 ? (
                <p className="text-gray-500 text-xs">Start a test to see logs...</p>
              ) : (
                <div className="space-y-1">
                  {executionLog.map((log, index) => (
                    <div key={index} className="text-xs text-gray-300 font-mono">
                      {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Workflow Visualization */}
        <div className="flex-1 bg-gray-50 dark:bg-gray-900 relative">
          {testNodes.length > 0 ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={testNodes}
                edges={testEdges}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                fitView
                className="bg-gray-50 dark:bg-gray-900"
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
              >
                <Background color="#374151" />
                <Controls />
                <MiniMap 
                  nodeColor="#6B7280"
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600"
                />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              <div className="text-center">
                <TestTube className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-semibold">No Workflow Loaded</p>
                <p className="text-sm">Build your workflow in the Builder tab first</p>
              </div>
            </div>
          )}

          {/* Status Overlay */}
          {isExecuting && (
            <div className="absolute top-4 left-4 bg-blue-500/20 backdrop-blur border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-200">
                <Clock className="w-4 h-4 animate-spin" />
                <span className="text-sm font-medium">
                  {isPaused ? 'Test Paused' : 'Running Test...'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Node Execution Modal */}
      {showNodeModal && selectedNode && (
        <NodeExecutionModal
          isOpen={showNodeModal}
          onClose={() => setShowNodeModal(false)}
          nodeData={selectedNode.data}
          executionData={selectedNodeExecution}
          nodeName={selectedNode.data?.label || selectedNode.id}
          nodeType={selectedNode.type || 'unknown'}
        />
      )}
    </div>
  );
};

export default TestingLabNew;