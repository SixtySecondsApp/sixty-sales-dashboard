import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
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
  Settings
} from 'lucide-react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { workflowExecutionService, type WorkflowExecution, type NodeExecution } from '@/lib/services/workflowExecutionService';
import NodeExecutionModal from './NodeExecutionModal';

interface TestWorkflowModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowId: string | null;
  workflowName: string;
  nodes: Node[];
  edges: Edge[];
  onSave: (workflow: any) => void;
}

interface TestScenario {
  id: string;
  name: string;
  description: string;
  data: Record<string, any>;
}

const TestWorkflowModal: React.FC<TestWorkflowModalProps> = ({
  isOpen,
  onClose,
  workflowId,
  workflowName,
  nodes,
  edges,
  onSave
}) => {
  const [testNodes, setTestNodes] = useNodesState(nodes);
  const [testEdges, setTestEdges] = useEdgesState(edges);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [currentNodeIndex, setCurrentNodeIndex] = useState(0);
  const [executionSpeed, setExecutionSpeed] = useState(1000); // ms between steps
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [showDataInput, setShowDataInput] = useState(false);
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeExecution, setSelectedNodeExecution] = useState<NodeExecution | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
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
            message: 'This is a test message',
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
      description: 'Deal with high value for testing value-based routing',
      data: {
        formData: {
          submittedAt: new Date().toISOString(),
          fields: {
            dealName: 'Enterprise Software License',
            value: 250000,
            stage: 'Opportunity',
            priority: 'high',
            owner: 'sales-manager'
          },
          formId: 'deal-form',
          submissionId: 'deal-' + Date.now()
        }
      }
    },
    {
      id: 'low-value-deal',
      name: '🏷️ Low Value Deal',
      description: 'Deal with low value for testing routing logic',
      data: {
        formData: {
          submittedAt: new Date().toISOString(),
          fields: {
            dealName: 'Small Business Package',
            value: 5000,
            stage: 'SQL',
            priority: 'normal',
            owner: 'sales-rep'
          },
          formId: 'deal-form',
          submissionId: 'deal-' + Date.now()
        }
      }
    },
    {
      id: 'custom',
      name: '⚙️ Custom Data',
      description: 'Define your own test data',
      data: {}
    }
  ];

  // Initialize nodes with test status
  useEffect(() => {
    if (isOpen) {
      const initialNodes = nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          testStatus: 'idle' as const,
          executionData: null
        }
      }));
      setTestNodes(initialNodes);
      setTestEdges(edges);
      setSelectedScenario(testScenarios[0].id);
      setExecutionLog([]);
    }
  }, [isOpen, nodes, edges]);

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
    setExecutionLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // Start test execution
  const startExecution = async () => {
    if (!workflowId) {
      addLog('❌ No workflow ID - please save workflow first');
      return;
    }

    if (testNodes.length === 0) {
      addLog('❌ No nodes to execute');
      return;
    }

    setIsExecuting(true);
    setIsPaused(false);
    setCurrentNodeIndex(0);
    
    addLog('🚀 Starting test execution...');
    
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

      // Start the actual execution
      const executionId = await workflowExecutionService.startExecution(
        workflowId,
        testNodes,
        testEdges,
        'manual',
        testData,
        true, // isTestMode
        workflowName || 'Test Execution'
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
    } else if (execution.status === 'failed') {
      addLog('❌ Test execution failed');
      setIsExecuting(false);
    }
  };

  // Visual step-through execution
  const startVisualExecution = () => {
    let stepIndex = 0;
    const totalNodes = testNodes.length;

    intervalRef.current = setInterval(() => {
      if (isPaused) return;

      if (stepIndex < totalNodes) {
        // Highlight current node
        const updatedNodes = testNodes.map((node, index) => ({
          ...node,
          data: {
            ...node.data,
            testStatus: index === stepIndex ? 'running' : 
                       index < stepIndex ? 'completed' : 'idle'
          }
        }));
        setTestNodes(updatedNodes);
        setCurrentNodeIndex(stepIndex);
        
        addLog(`⚡ Processing node: ${testNodes[stepIndex]?.data?.label || testNodes[stepIndex]?.id}`);
        stepIndex++;
      } else {
        // Execution complete
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

  const stepForward = () => {
    if (currentNodeIndex < testNodes.length - 1) {
      setCurrentNodeIndex(currentNodeIndex + 1);
      addLog(`👆 Stepped to node: ${testNodes[currentNodeIndex + 1]?.data?.label}`);
    }
  };

  // Handle node click
  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    const nodeExecution = currentExecution?.nodeExecutions.find(ne => ne.nodeId === node.id);
    setSelectedNodeExecution(nodeExecution || null);
    setShowNodeModal(true);
  };

  // Export results
  const exportResults = () => {
    const results = {
      workflowName,
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
    a.download = `workflow-test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    addLog('📥 Test results exported');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="w-full h-full max-w-7xl max-h-[95vh] bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                  <Play className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">🧪 Test Workflow</h2>
                  <p className="text-sm text-blue-200">{workflowName || 'Untitled Workflow'}</p>
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

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Test Controls */}
            <div className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
              {/* Test Scenarios */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">Test Scenarios</h3>
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
                  <h3 className="text-sm font-semibold text-white mb-3">Custom Test Data</h3>
                  <textarea
                    value={JSON.stringify(customData, null, 2)}
                    onChange={(e) => {
                      try {
                        setCustomData(JSON.parse(e.target.value));
                      } catch {}
                    }}
                    className="w-full h-32 p-3 bg-gray-700 border border-gray-600 rounded text-white text-xs font-mono resize-none focus:outline-none focus:border-blue-500"
                    placeholder="Enter JSON test data..."
                  />
                </div>
              )}

              {/* Execution Controls */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">Controls</h3>
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
                  
                  <div className="flex gap-2">
                    <button
                      onClick={stepForward}
                      disabled={!isExecuting || currentNodeIndex >= testNodes.length - 1}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <StepForward className="w-4 h-4" />
                      Step
                    </button>
                    <button
                      onClick={exportResults}
                      disabled={!currentExecution}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Export
                    </button>
                  </div>
                </div>
              </div>

              {/* Execution Speed */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-white mb-3">Speed</h3>
                <input
                  type="range"
                  min="100"
                  max="3000"
                  step="100"
                  value={executionSpeed}
                  onChange={(e) => setExecutionSpeed(Number(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400 mt-1">
                  {executionSpeed}ms between steps
                </div>
              </div>

              {/* Execution Log */}
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-3">Execution Log</h3>
                <div className="bg-gray-900 border border-gray-600 rounded-lg p-3 h-40 overflow-y-auto">
                  {executionLog.length === 0 ? (
                    <p className="text-gray-500 text-xs">No logs yet...</p>
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

            {/* Right Panel - Workflow Canvas */}
            <div className="flex-1 bg-gray-900 relative">
              <ReactFlowProvider>
                <ReactFlow
                  nodes={testNodes}
                  edges={testEdges}
                  onNodeClick={handleNodeClick}
                  fitView
                  className="bg-gray-900"
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={true}
                >
                  <Background color="#374151" />
                  <Controls />
                  <MiniMap 
                    nodeColor="#6B7280"
                    className="bg-gray-800 border border-gray-600"
                  />
                </ReactFlow>
              </ReactFlowProvider>

              {/* Status Overlay */}
              {isExecuting && (
                <div className="absolute top-4 left-4 bg-blue-500/20 backdrop-blur border border-blue-500/30 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-blue-200">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">
                      {isPaused ? 'Paused' : 'Executing'} - Node {currentNodeIndex + 1} of {testNodes.length}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>

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
    </AnimatePresence>
  );
};

export default TestWorkflowModal;