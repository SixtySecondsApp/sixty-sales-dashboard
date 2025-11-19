/**
 * Unified Testing Lab Component
 * Combines features from TestingLabNew and TestingLabEnhanced
 * Supports both simulated and real data testing modes
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TestTube,
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Database,
  FileText,
  Zap,
  RefreshCw,
  Eye,
  Settings,
  Activity,
  Target,
  TrendingUp,
  X,
  Loader2,
  Globe,
  FlaskConical
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
import { WorkflowTestEngine, TEST_SCENARIOS, TestExecutionState } from '@/lib/utils/workflowTestEngine';
import AnimatedTestEdge from './AnimatedTestEdge';
import NodeExecutionModal from './NodeExecutionModal';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';

interface TestingLabProps {
  workflow: any;
}

interface TestResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  workflowName: string;
  status: 'passed' | 'failed' | 'running';
  executionTime: number;
  timestamp: Date;
  logs: any[];
  nodesPassed: number;
  nodesTotal: number;
  executionProgress?: number;
  errorMessage?: string;
}

// Unified test node component
const TestNode = ({ data, selected, id }: any) => {
  const status = data.testStatus || 'idle';
  const isActive = status === 'active' || status === 'running';
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success': return 'border-green-500 bg-green-500/20';
      case 'failed': return 'border-red-500 bg-red-500/20';
      case 'running':
      case 'active': return 'border-blue-500 bg-blue-500/20 animate-pulse';
      case 'pending': return 'border-yellow-500 bg-yellow-500/20';
      case 'skipped': return 'border-gray-500 bg-gray-500/20 opacity-50';
      default: return 'border-gray-500 bg-gray-700';
    }
  };

  return (
    <div className={`px-3 py-2 rounded-lg border-2 transition-all duration-300 ${getStatusColor(status)} ${selected ? 'ring-2 ring-blue-300' : ''}`}>
      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-white border-2 border-gray-500" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-white border-2 border-gray-500" />
      <div className="flex items-center gap-2 text-white">
        {isActive && <Loader2 className="w-3 h-3 animate-spin" />}
        {(status === 'completed' || status === 'success') && <CheckCircle className="w-3 h-3 text-green-400" />}
        {status === 'failed' && <XCircle className="w-3 h-3 text-red-400" />}
        {status === 'skipped' && <div className="w-3 h-3 text-gray-500">⊘</div>}
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

const edgeTypes = {
  animated: AnimatedTestEdge
};

const TestingLab: React.FC<TestingLabProps> = ({ workflow }) => {
  const { userData: user } = useUser();
  const [testNodes, setTestNodes, onNodesChange] = useNodesState([]);
  const [testEdges, setTestEdges, onEdgesChange] = useEdgesState([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentExecution, setCurrentExecution] = useState<WorkflowExecution | null>(null);
  const [executionSpeed, setExecutionSpeed] = useState(1000);
  const [selectedScenario, setSelectedScenario] = useState<string>(TEST_SCENARIOS[0]?.id || '');
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [showNodeModal, setShowNodeModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedNodeExecution, setSelectedNodeExecution] = useState<NodeExecution | null>(null);
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [testHistory, setTestHistory] = useState<WorkflowExecution[]>([]);
  const [testMode, setTestMode] = useState<'simulated' | 'real'>('simulated');
  const [realDataScenarios, setRealDataScenarios] = useState<any[]>([]);
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  const [testExecutionState, setTestExecutionState] = useState<TestExecutionState | null>(null);
  const testEngineRef = useRef<WorkflowTestEngine | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load test history
  const loadTestHistory = async () => {
    if (!workflow?.id) return;
    
    try {
      await workflowExecutionService.loadAllExecutionsFromDatabase();
      const executions = workflowExecutionService.getAllExecutions()
        .filter(exec => exec.workflowId === workflow.id && exec.isTestMode)
        .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
        .slice(0, 10);
      
      setTestHistory(executions);
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  // Load real data scenarios
  const loadRealDataScenarios = async () => {
    if (!user) return;
    
    setIsLoadingRealData(true);
    try {
      const triggerNode = workflow?.canvas_data?.nodes?.find((n: any) => n.type === 'trigger');
      if (!triggerNode) {
        return;
      }

      const triggerType = triggerNode.data?.triggerType;
      let scenarios = [];

      switch (triggerType) {
        case 'pipeline_stage_changed':
          const { data: deals } = await supabase
            .from('deals')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(5);
          
          scenarios = (deals || []).map((deal: any) => ({
            id: `real_deal_${deal.id}`,
            name: `Real: ${deal.company_name}`,
            description: `Test with actual deal: ${deal.company_name} (${deal.stage})`,
            testData: {
              dealId: deal.id,
              companyName: deal.company_name,
              stage: deal.stage,
              value: deal.value,
              assignedTo: deal.assigned_to
            }
          }));
          break;

        case 'activity_created':
          const { data: activities } = await supabase
            .from('activities')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
          
          scenarios = (activities || []).map((activity: any) => ({
            id: `real_activity_${activity.id}`,
            name: `Real: ${activity.type}`,
            description: `Test with actual ${activity.type} activity`,
            testData: {
              activityId: activity.id,
              type: activity.type,
              dealId: activity.deal_id,
              contactId: activity.contact_id,
              notes: activity.notes
            }
          }));
          break;

        case 'deal_created':
          const { data: recentDeals } = await supabase
            .from('deals')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(5);
          
          scenarios = (recentDeals || []).map((deal: any) => ({
            id: `real_new_deal_${deal.id}`,
            name: `Real: ${deal.company_name}`,
            description: `Test with newly created deal: ${deal.company_name}`,
            testData: {
              dealId: deal.id,
              companyName: deal.company_name,
              value: deal.value,
              stage: deal.stage
            }
          }));
          break;
      }

      setRealDataScenarios(scenarios);
    } catch (error) {
      console.error('Failed to load real data scenarios:', error);
    } finally {
      setIsLoadingRealData(false);
    }
  };

  // Initialize nodes
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
      setSelectedScenario(TEST_SCENARIOS[0]?.id || '');
      setExecutionLog([]);
      loadTestHistory();
      
      if (testMode === 'real') {
        loadRealDataScenarios();
      }
    }
  }, [workflow, testMode]);

  // Get available scenarios based on mode
  const getAvailableScenarios = () => {
    if (testMode === 'real') {
      return realDataScenarios;
    }
    return TEST_SCENARIOS;
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
    
    addLog(`🚀 Starting ${testMode} test execution...`);
    
    // Reset all nodes
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
      // Get test data
      const scenarios = getAvailableScenarios();
      const scenario = scenarios.find(s => s.id === selectedScenario);
      const testData = scenario?.testData || customData;

      addLog(`📋 Using scenario: ${scenario?.name || 'Custom'}`);

      // Create test engine
      const engine = new WorkflowTestEngine(
        testNodes,
        testEdges,
        (state) => {
          setTestExecutionState(state);
          // Update node states
          const updatedNodes = testNodes.map(node => {
            const nodeState = state.nodeStates.get(node.id);
            return {
              ...node,
              data: {
                ...node.data,
                testStatus: nodeState?.status || 'idle'
              }
            };
          });
          setTestNodes(updatedNodes);
        }
      );

      testEngineRef.current = engine;

      // Start execution
      if (testMode === 'simulated') {
        engine.startTest(scenario);
      } else {
        // Real data mode - use workflowExecutionService
        const executionId = await workflowExecutionService.startExecution(
          workflow.id,
          testNodes,
          testEdges,
          'manual',
          testData,
          true,
          workflow.name
        );
        
        // Monitor execution
        workflowExecutionService.subscribeToExecution(executionId, (execution) => {
          setCurrentExecution(execution);
          if (execution.status === 'completed' || execution.status === 'failed') {
            setIsExecuting(false);
            loadTestHistory();
          }
        });
      }
    } catch (error) {
      addLog(`❌ Execution failed: ${error}`);
      setIsExecuting(false);
    }
  };

  const pauseExecution = () => {
    if (testMode === 'simulated') {
      testEngineRef.current?.pause();
    }
    setIsPaused(true);
    addLog('⏸️ Execution paused');
  };

  const resumeExecution = () => {
    if (testMode === 'simulated') {
      testEngineRef.current?.resume();
    }
    setIsPaused(false);
    addLog('▶️ Execution resumed');
  };

  const stopExecution = () => {
    if (testMode === 'simulated') {
      testEngineRef.current?.stop();
    }
    setIsExecuting(false);
    setIsPaused(false);
    setCurrentExecution(null);
    addLog('⏹️ Execution stopped');
    
    // Reset nodes
    const resetNodes = testNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        testStatus: 'idle' as const
      }
    }));
    setTestNodes(resetNodes);
  };

  const handleNodeClick = (event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    if (currentExecution) {
      const nodeExec = currentExecution.nodeExecutions.find(ne => ne.nodeId === node.id);
      setSelectedNodeExecution(nodeExec || null);
      setShowNodeModal(true);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TestTube className="w-5 h-5 text-[#37bd7e]" />
            <h2 className="text-lg font-semibold text-white">Testing Lab</h2>
            <span className="text-xs text-gray-400">({workflow?.name || 'Unnamed Workflow'})</span>
          </div>
          
          {/* Mode Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTestMode('simulated')}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                testMode === 'simulated'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <FlaskConical className="w-4 h-4 inline mr-1" />
              Simulated
            </button>
            <button
              onClick={() => {
                setTestMode('real');
                loadRealDataScenarios();
              }}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                testMode === 'real'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <Globe className="w-4 h-4 inline mr-1" />
              Real Data
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Controls */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col">
          {/* Scenario Selection */}
          <div className="p-4 border-b border-gray-700">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Test Scenario
            </label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
              disabled={isExecuting}
            >
              {getAvailableScenarios().map(scenario => (
                <option key={scenario.id} value={scenario.id}>
                  {scenario.name}
                </option>
              ))}
            </select>
          </div>

          {/* Controls */}
          <div className="p-4 border-b border-gray-700 space-y-3">
            {!isExecuting ? (
              <button
                onClick={startExecution}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Test
              </button>
            ) : (
              <div className="flex gap-2">
                {isPaused ? (
                  <button
                    onClick={resumeExecution}
                    className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Resume
                  </button>
                ) : (
                  <button
                    onClick={pauseExecution}
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg flex items-center justify-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    Pause
                  </button>
                )}
                <button
                  onClick={stopExecution}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center justify-center gap-2"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              </div>
            )}

            {/* Speed Control */}
            {isExecuting && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Execution Speed</label>
                <select
                  value={executionSpeed}
                  onChange={(e) => {
                    const speed = Number(e.target.value);
                    setExecutionSpeed(speed);
                    testEngineRef.current?.setSpeed(speed);
                  }}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm"
                >
                  <option value={500}>0.5x</option>
                  <option value={1000}>1x</option>
                  <option value={2000}>2x</option>
                  <option value={5000}>5x</option>
                </select>
              </div>
            )}
          </div>

          {/* Execution Log */}
          <div className="flex-1 overflow-y-auto p-4">
            <h3 className="text-sm font-medium text-gray-300 mb-2">Execution Log</h3>
            <div className="space-y-1">
              {executionLog.length === 0 ? (
                <p className="text-xs text-gray-500">No logs yet...</p>
              ) : (
                executionLog.map((log, index) => (
                  <div key={index} className="text-xs text-gray-400 font-mono bg-gray-900 p-2 rounded">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Panel - Visualization */}
        <div className="flex-1 bg-gray-900 relative">
          {testNodes.length > 0 ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={testNodes}
                edges={testEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={handleNodeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                className="bg-gray-900"
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={true}
              >
                <Background color="#374151" />
                <Controls className="bg-gray-800 border-gray-700" />
                <MiniMap 
                  nodeColor="#6B7280"
                  className="bg-gray-800 border border-gray-700"
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
        </div>
      </div>

      {/* Node Execution Modal */}
      {showNodeModal && selectedNode && (
        <NodeExecutionModal
          isOpen={showNodeModal}
          onClose={() => setShowNodeModal(false)}
          nodeData={selectedNode.data}
          executionData={selectedNodeExecution}
        />
      )}
    </div>
  );
};

export default TestingLab;
