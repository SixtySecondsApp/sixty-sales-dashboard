import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TestTube,
  Play,
  Pause,
  Square,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trophy,
  Target,
  Zap,
  Clock,
  Activity,
  TrendingUp,
  Award,
  Shield,
  Star,
  Flame,
  Info,
  FileText,
  Database,
  GitBranch,
  ChevronRight,
  RefreshCw,
  Download,
  Upload,
  Eye,
  X,
  Loader2
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
import { WorkflowTestEngine, TEST_SCENARIOS, TestExecutionState } from '@/lib/utils/workflowTestEngine';
import AnimatedTestEdge from './AnimatedTestEdge';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/lib/supabase/clientV2';
import { useUser } from '@/lib/hooks/useUser';

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

interface TestingLabEnhancedProps {
  workflow?: any;
}

// Define node components separately to avoid React Flow warnings about new nodeTypes objects
const TriggerNode = ({ data }: any) => (
  <div className={`px-4 py-2 rounded-lg border-2 transition-all ${
    data.testStatus === 'active' ? 'border-yellow-400 bg-yellow-400/20 animate-pulse' :
    data.testStatus === 'success' ? 'border-green-400 bg-green-400/20' :
    data.testStatus === 'failed' ? 'border-red-400 bg-red-400/20' :
    'border-purple-600 bg-purple-600/20'
  }`}>
    <div className="text-xs font-medium text-white">{data.label}</div>
    {data.testStatus && (
      <div className="mt-1">
        {data.testStatus === 'active' && <div className="w-1 h-1 bg-yellow-400 rounded-full animate-ping mx-auto" />}
        {data.testStatus === 'success' && <CheckCircle className="w-3 h-3 text-green-400 mx-auto" />}
        {data.testStatus === 'failed' && <XCircle className="w-3 h-3 text-red-400 mx-auto" />}
        {data.testStatus === 'skipped' && <div className="w-3 h-3 text-gray-500 mx-auto">⊘</div>}
      </div>
    )}
  </div>
);

const ConditionNode = ({ data }: any) => (
  <div className={`px-4 py-2 rounded-lg border-2 transition-all ${
    data.testStatus === 'active' ? 'border-yellow-400 bg-yellow-400/20 animate-pulse' :
    data.testStatus === 'success' ? (data.conditionPassed ? 'border-green-400 bg-green-400/20' : 'border-orange-400 bg-orange-400/20') :
    data.testStatus === 'failed' ? 'border-red-400 bg-red-400/20' :
    data.testStatus === 'skipped' ? 'border-gray-500 bg-gray-500/20' :
    'border-blue-600 bg-blue-600/20'
  }`}>
    <div className="text-xs font-medium text-white">{data.label}</div>
    {data.testStatus && (
      <div className="mt-1">
        {data.testStatus === 'active' && <div className="w-1 h-1 bg-yellow-400 rounded-full animate-ping mx-auto" />}
        {data.testStatus === 'success' && (
          data.conditionPassed ? 
          <CheckCircle className="w-3 h-3 text-green-400 mx-auto" /> :
          <XCircle className="w-3 h-3 text-orange-400 mx-auto" />
        )}
        {data.testStatus === 'failed' && <XCircle className="w-3 h-3 text-red-400 mx-auto" />}
        {data.testStatus === 'skipped' && <div className="w-3 h-3 text-gray-500 mx-auto">⊘</div>}
      </div>
    )}
    {data.testStatus === 'success' && data.conditionResult !== undefined && (
      <div className="mt-1 text-[10px] text-center">
        {data.conditionResult ? 'PASS' : 'FAIL'}
      </div>
    )}
  </div>
);

const ActionNode = ({ data }: any) => (
  <div className={`px-4 py-2 rounded-lg border-2 transition-all ${
    data.testStatus === 'active' ? 'border-yellow-400 bg-yellow-400/20 animate-pulse' :
    data.testStatus === 'success' ? 'border-green-400 bg-green-400/20' :
    data.testStatus === 'failed' ? 'border-red-400 bg-red-400/20' :
    data.testStatus === 'skipped' ? 'border-gray-500 bg-gray-500/20 opacity-50' :
    'border-[#37bd7e] bg-[#37bd7e]/20'
  }`}>
    <div className="text-xs font-medium text-white">{data.label}</div>
    {data.testStatus && (
      <div className="mt-1">
        {data.testStatus === 'active' && <div className="w-1 h-1 bg-yellow-400 rounded-full animate-ping mx-auto" />}
        {data.testStatus === 'success' && <CheckCircle className="w-3 h-3 text-green-400 mx-auto" />}
        {data.testStatus === 'failed' && <XCircle className="w-3 h-3 text-red-400 mx-auto" />}
        {data.testStatus === 'skipped' && <div className="w-3 h-3 text-gray-500 mx-auto">⊘</div>}
      </div>
    )}
  </div>
);

const RouterNode = ({ data }: any) => (
  <div className={`px-4 py-2 rounded-lg border-2 transition-all ${
    data.testStatus === 'active' ? 'border-yellow-400 bg-yellow-400/20 animate-pulse' :
    data.testStatus === 'success' ? 'border-green-400 bg-green-400/20' :
    data.testStatus === 'failed' ? 'border-red-400 bg-red-400/20' :
    'border-orange-600 bg-orange-600/20'
  }`}>
    <div className="text-xs font-medium text-white">{data.label}</div>
    {data.testStatus && (
      <div className="mt-1">
        {data.testStatus === 'active' && <div className="w-1 h-1 bg-yellow-400 rounded-full animate-ping mx-auto" />}
        {data.testStatus === 'success' && <CheckCircle className="w-3 h-3 text-green-400 mx-auto" />}
        {data.testStatus === 'failed' && <XCircle className="w-3 h-3 text-red-400 mx-auto" />}
        {data.testStatus === 'skipped' && <div className="w-3 h-3 text-gray-500 mx-auto">⊘</div>}
      </div>
    )}
  </div>
);

const nodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  router: RouterNode
};

const edgeTypes = {
  animated: AnimatedTestEdge
};

const TestingLabEnhanced: React.FC<TestingLabEnhancedProps> = ({ workflow }) => {
  const { userData: user } = useUser();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedScenario, setSelectedScenario] = useState<string>('');
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [currentTest, setCurrentTest] = useState<TestResult | null>(null);
  const [showVisualization, setShowVisualization] = useState(true);
  const [dynamicScenarios, setDynamicScenarios] = useState<any[]>([]);
  const [testMode, setTestMode] = useState<'simulated' | 'real'>('simulated');
  const [isLoadingRealData, setIsLoadingRealData] = useState(false);
  const [realDataScenarios, setRealDataScenarios] = useState<any[]>([]);
  const [testExecutionState, setTestExecutionState] = useState<TestExecutionState>({
    isRunning: false,
    isPaused: false,
    currentNodeId: null,
    nodeStates: new Map(),
    executionPath: [],
    testData: {},
    executionSpeed: 1,
    logs: []
  });
  const testEngineRef = useRef<WorkflowTestEngine | null>(null);
  const reactFlowInstance = useRef<any>(null);

  // Use useMemo for nodeTypes and edgeTypes to ensure referential stability
  const memoizedNodeTypes = useMemo(() => nodeTypes, []);
  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  // Load real data scenarios from database
  const loadRealDataScenarios = async () => {
    if (!user) return;
    
    setIsLoadingRealData(true);
    try {
      // Get the trigger type from the workflow
      const triggerNode = workflow?.canvas_data?.nodes?.find((n: any) => n.type === 'trigger');
      if (!triggerNode) {
        return;
      }

      const triggerType = triggerNode.data?.triggerType;
      let scenarios = [];

      // Load real data based on trigger type
      switch (triggerType) {
        case 'pipeline_stage_changed':
          const { data: deals } = await supabase
            .from('deals')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(5);
          
          scenarios = (deals || []).map((deal, idx) => ({
            id: `real_deal_${deal.id}`,
            name: `Real: ${deal.company_name}`,
            description: `Test with actual deal: ${deal.company_name} (${deal.stage})`,
            testData: {
              dealId: deal.id,
              companyName: deal.company_name,
              stage: deal.stage,
              previousStage: 'sql', // We'd need to track this
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
          
          scenarios = (activities || []).map((activity, idx) => ({
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
          
          scenarios = (recentDeals || []).map((deal, idx) => ({
            id: `real_new_deal_${deal.id}`,
            name: `Real: ${deal.company_name}`,
            description: `Test with newly created deal: ${deal.company_name}`,
            testData: {
              dealId: deal.id,
              companyName: deal.company_name,
              value: deal.value,
              stage: deal.stage,
              source: deal.source || 'direct'
            }
          }));
          break;

        case 'task_completed':
          const { data: tasks } = await supabase
            .from('tasks')
            .select('*')
            .eq('user_id', user.id)
            .eq('completed', true)
            .order('updated_at', { ascending: false })
            .limit(5);
          
          scenarios = (tasks || []).map((task, idx) => ({
            id: `real_task_${task.id}`,
            name: `Real: ${task.title}`,
            description: `Test with completed task: ${task.title}`,
            testData: {
              taskId: task.id,
              title: task.title,
              priority: task.priority,
              completedBy: task.completed_by || user.id
            }
          }));
          break;
      }

      setRealDataScenarios(scenarios);
    } catch (error) {
    } finally {
      setIsLoadingRealData(false);
    }
  };

  // Generate dynamic test scenarios based on workflow configuration
  const generateDynamicScenarios = () => {
    if (!workflow?.canvas_data) return [];
    
    const workflowNodes = workflow.canvas_data.nodes || [];
    const triggerNode = workflowNodes.find((n: any) => n.type === 'trigger');
    const conditionNodes = workflowNodes.filter((n: any) => n.type === 'condition');
    const actionNodes = workflowNodes.filter((n: any) => n.type === 'action');
    
    if (!triggerNode) return [];
    
    const scenarios = [];
    const triggerType = triggerNode.data.triggerType || triggerNode.data.type;
    const triggerLabel = triggerNode.data.label || 'Trigger';
    
    // Scenario 1: Test that should pass all conditions
    if (conditionNodes.length > 0) {
      const conditionNode = conditionNodes[0];
      
      // Check if there's a raw condition string
      const rawCondition = conditionNode.data.condition;
      let conditionType = 'unknown';
      let conditionValue = null;
      
      if (rawCondition && typeof rawCondition === 'string') {
        // Parse conditions like "deal_value > 10000"
        const match = rawCondition.match(/(\w+)\s*([><=!]+)\s*(.+)/);
        if (match) {
          conditionType = match[1]; // e.g., "deal_value"
          conditionValue = match[3].replace(/['"]/g, ''); // e.g., "10000"
        }
      } else {
        // Fallback to other property names
        conditionType = conditionNode.data.conditionType || 
                       conditionNode.data.type || 
                       conditionNode.data.field ||
                       (conditionNode.data.label?.toLowerCase().includes('activity') ? 'activity_type' : 'unknown');
        conditionValue = conditionNode.data.value || 
                        conditionNode.data.threshold || 
                        conditionNode.data.expectedValue ||
                        conditionNode.data.targetValue ||
                        (conditionType === 'activity_type' ? 'proposal_sent' : null);
      }
      scenarios.push({
        id: 'pass_condition',
        name: `${triggerLabel} - Pass Condition`,
        description: `Test with data that should pass the ${conditionNode.data.label} condition`,
        testData: generateTestDataForCondition(triggerType, conditionType, conditionValue, true)
      });
      
      scenarios.push({
        id: 'fail_condition',
        name: `${triggerLabel} - Fail Condition`,
        description: `Test with data that should fail the ${conditionNode.data.label} condition`,
        testData: generateTestDataForCondition(triggerType, conditionType, conditionValue, false)
      });
    } else {
      // No conditions, just test the trigger and actions
      scenarios.push({
        id: 'basic_flow',
        name: `${triggerLabel} - Basic Flow`,
        description: `Test the workflow with typical ${triggerLabel.toLowerCase()} data`,
        testData: generateBasicTestData(triggerType)
      });
    }
    
    // Edge case scenario
    scenarios.push({
      id: 'edge_case',
      name: `${triggerLabel} - Edge Case`,
      description: `Test with minimal or edge case data`,
      testData: generateEdgeCaseData(triggerType)
    });
    
    return scenarios;
  };
  
  // Generate test data that should pass or fail a condition
  const generateTestDataForCondition = (triggerType: string, conditionType: string, conditionValue: any, shouldPass: boolean) => {
    const baseData = {
      test_run_id: `test_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    // Handle deal_value conditions (e.g., from "deal_value > 10000")
    if (conditionType === 'deal_value') {
      const threshold = parseFloat(conditionValue) || 10000;
      return {
        ...baseData,
        deal_value: shouldPass ? threshold + 5000 : threshold - 5000,
        value: shouldPass ? threshold + 5000 : threshold - 5000, // Include both field names
        deal_name: shouldPass ? 'High Value Deal' : 'Low Value Deal',
        company: 'Test Company',
        stage: 'Opportunity',
        activity_type: 'proposal_sent', // Include this since it's a proposal workflow
        description: 'Sent proposal to client'
      };
    }
    
    // Smart Proposal Follow-up specific test data - check if it's an activity type condition
    if (triggerType === 'activity_created' && (conditionType === 'activity_type' || conditionType === 'unknown' || conditionValue === 'proposal_sent')) {
      // For activity type conditions, we need to match or not match the expected value
      const testActivityType = shouldPass ? (conditionValue || 'proposal_sent') : 'call';
      return {
        ...baseData,
        activity_type: testActivityType,
        description: shouldPass ? 'Sent proposal to client' : 'Had a call with client',
        deal_id: 'test_deal_123',
        deal_name: 'Test Deal - Acme Corp',
        company: 'Acme Corp',
        contact_name: 'John Doe',
        deal_value: 15000, // Include a value for potential value checks
        value: 15000
      };
    }
    
    // Value-based conditions
    if (conditionType === 'value_check' || conditionType === 'value_greater_than') {
      const threshold = parseInt(conditionValue) || 10000;
      return {
        ...baseData,
        value: shouldPass ? threshold + 5000 : threshold - 5000,
        deal_name: shouldPass ? 'High Value Deal' : 'Low Value Deal',
        company: 'Test Company',
        stage: 'Opportunity'
      };
    }
    
    // Stage-based conditions
    if (conditionType === 'stage_check') {
      return {
        ...baseData,
        old_stage: 'SQL',
        new_stage: shouldPass ? conditionValue : 'Different Stage',
        deal_name: 'Stage Test Deal',
        company: 'Test Company'
      };
    }
    
    // Default fallback
    return {
      ...baseData,
      value: shouldPass ? 50000 : 5000,
      stage: 'Opportunity',
      company: 'Test Company'
    };
  };
  
  // Generate basic test data for workflows without conditions
  const generateBasicTestData = (triggerType: string) => {
    const baseData = {
      test_run_id: `test_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    
    switch (triggerType) {
      case 'activity_created':
        return {
          ...baseData,
          activity_type: 'proposal_sent',
          description: 'Sent proposal to client',
          deal_id: 'test_deal_123',
          deal_name: 'Test Deal - Basic Flow',
          company: 'Test Company',
          contact_name: 'Jane Smith'
        };
      case 'stage_changed':
        return {
          ...baseData,
          old_stage: 'SQL',
          new_stage: 'Opportunity',
          deal_id: 'test_deal_456',
          deal_name: 'Pipeline Test Deal',
          value: 25000
        };
      default:
        return {
          ...baseData,
          deal_name: 'Basic Test Deal',
          value: 10000,
          stage: 'SQL'
        };
    }
  };
  
  // Generate edge case test data
  const generateEdgeCaseData = (triggerType: string) => {
    return {
      test_run_id: `test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      // Minimal data with some missing fields
      deal_name: '',
      value: 0,
      stage: null
    };
  };

  // Load workflow canvas data and generate scenarios
  useEffect(() => {
    const loadScenarios = async () => {
      if (workflow?.canvas_data) {
        // Set nodes with initial state
        setNodes(workflow.canvas_data.nodes || []);
        // Set edges with visible styles so connections show immediately
        setEdges((workflow.canvas_data.edges || []).map((edge: any) => ({
          ...edge,
          type: 'default',
          style: {
            stroke: '#6b7280',
            strokeWidth: 2
          },
          animated: false
        })));
        
        // Show visualization immediately when workflow is loaded
        setShowVisualization(true);
        
        // Try to load saved test scenarios first
        let scenarios: any[] = [];
        
        if (workflow.id) {
          try {
            const { WorkflowTestGenerator } = await import('@/lib/utils/workflowTestGenerator');
            const savedScenarios = await WorkflowTestGenerator.loadTestScenarios(workflow.id);
            
            if (savedScenarios && savedScenarios.length > 0) {
              scenarios = savedScenarios;
            }
          } catch (error) {
          }
        }
        
        // If no saved scenarios, generate them dynamically
        if (scenarios.length === 0) {
          scenarios = generateDynamicScenarios();
        }
        
        setDynamicScenarios(scenarios);
        
        // Set first scenario as default
        if (scenarios.length > 0 && !selectedScenario) {
          setSelectedScenario(scenarios[0].id);
        }
      }
    };
    
    loadScenarios();
  }, [workflow]);

  // Handle test state changes
  const handleTestStateChange = (newState: TestExecutionState) => {
    setTestExecutionState(newState);
    
    // Update node visual states
    const updatedNodes = nodes.map(node => {
      const nodeState = newState.nodeStates.get(node.id);
      const outputData = nodeState?.outputData;
      
      // For condition nodes, extract whether the condition passed
      let conditionPassed = undefined;
      let conditionResult = undefined;
      if (node.type === 'condition' && outputData) {
        conditionPassed = outputData.conditionMet;
        conditionResult = outputData.conditionMet;
      }
      
      return {
        ...node,
        data: {
          ...node.data,
          testStatus: nodeState?.status || null,
          executionTime: nodeState?.executionTime,
          error: nodeState?.error,
          conditionPassed,
          conditionResult
        }
      };
    });
    setNodes(updatedNodes);

    // Update edge states for flow visualization
    const updatedEdges = edges.map(edge => {
      const isActive = newState.currentNodeId === edge.source;
      const wasExecuted = newState.executionPath.includes(edge.source) && 
                         newState.executionPath.includes(edge.target);
      return {
        ...edge,
        animated: isActive,
        style: {
          ...edge.style,
          stroke: isActive ? '#facc15' : wasExecuted ? '#10b981' : '#6b7280',
          strokeWidth: isActive ? 3 : 2
        },
        data: {
          ...edge.data,
          isTestActive: isActive,
          isFlowing: isActive
        }
      };
    });
    setEdges(updatedEdges);

    // Update current test result with proper progress tracking
    if (currentTest) {
      // Count completed nodes (any status except idle or waiting)
      const completedNodes = Array.from(newState.nodeStates.values())
        .filter(state => ['success', 'failed', 'skipped'].includes(state.status)).length;
      const nodesPassed = Array.from(newState.nodeStates.values())
        .filter(state => state.status === 'success').length;
      // Filter out note nodes from total count
      const executableNodes = nodes.filter(n => n.type !== 'note');
      const nodesTotal = executableNodes.length;
      const executionProgress = nodesTotal > 0 ? Math.round((completedNodes / nodesTotal) * 100) : 0;
      
      setCurrentTest({
        ...currentTest,
        status: newState.isRunning ? 'running' : 
                nodesPassed === nodesTotal ? 'passed' : 'failed',
        nodesPassed: nodesPassed, // Use actual passed nodes for display
        nodesTotal,
        logs: newState.logs,
        executionProgress: executionProgress
      });
    }
  };

  // Record test execution in database (for real data mode)
  const recordTestExecution = async (scenario: any, status: string, executionTimeMs: number, error?: string) => {
    if (!user || testMode !== 'real') return;
    
    try {
      await supabase.from('automation_executions').insert({
        rule_id: workflow.id,
        trigger_data: scenario.testData,
        execution_result: { 
          scenario: scenario.name,
          testMode: 'real_data_test'
        },
        status: status === 'passed' ? 'success' : status === 'failed' ? 'failed' : 'test_mode',
        error_message: error,
        execution_time_ms: executionTimeMs,
        executed_by: user.id,
        is_test_run: true,
        test_scenario_id: scenario.id
      });
    } catch (error) {
    }
  };

  // Start test execution
  const startTest = () => {
    if (!workflow?.canvas_data) {
      alert('No workflow data available to test');
      return;
    }

    // Find selected scenario from appropriate source
    const scenarios = testMode === 'real' ? realDataScenarios : dynamicScenarios;
    const scenario = scenarios.find(s => s.id === selectedScenario);
    if (!scenario) {
      alert('Please select a test scenario');
      return;
    }
    // Create test result entry (exclude note nodes from count)
    const executableNodes = nodes.filter(n => n.type !== 'note');
    const testResult: TestResult = {
      id: Date.now().toString(),
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      workflowName: workflow.name || workflow.rule_name || 'Untitled Workflow',
      status: 'running',
      executionTime: 0,
      timestamp: new Date(),
      logs: [],
      nodesPassed: 0,
      nodesTotal: executableNodes.length,
      executionProgress: 0
    };

    setCurrentTest(testResult);
    // Visualization is already shown when workflow loads

    // Auto-fit view
    if (reactFlowInstance.current) {
      setTimeout(() => {
        reactFlowInstance.current.fitView({ 
          padding: 0.2, 
          duration: 800,
          maxZoom: 1.2,
          minZoom: 0.5
        });
      }, 100);
    }

    // Create and start test engine with custom test data
    testEngineRef.current = new WorkflowTestEngine(nodes, edges, handleTestStateChange);
    testEngineRef.current.startTest({ 
      id: scenario.id,
      name: scenario.name,
      testData: scenario.testData 
    });
  };

  const pauseTest = () => {
    testEngineRef.current?.pause();
  };

  const resumeTest = () => {
    testEngineRef.current?.resume();
  };

  const stopTest = async () => {
    testEngineRef.current?.stop();
    
    // Save test result
    if (currentTest) {
      const endTime = Date.now();
      const startTime = currentTest.timestamp.getTime();
      const finalResult: TestResult = {
        ...currentTest,
        status: currentTest.nodesPassed === currentTest.nodesTotal ? 'passed' : 'failed',
        executionTime: endTime - startTime
      };
      
      setTestResults(prev => [finalResult, ...prev]);
      
      // Record to database if real data mode
      const scenarios = testMode === 'real' ? realDataScenarios : dynamicScenarios;
      const scenario = scenarios.find(s => s.id === currentTest.scenarioId);
      if (scenario) {
        await recordTestExecution(
          scenario,
          finalResult.status,
          finalResult.executionTime
        );
      }
      
      setCurrentTest(null);
    }
    
    // Reset visual states
    resetNodeStates();
  };

  const resetNodeStates = () => {
    setNodes(nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        testStatus: null,
        executionTime: null,
        error: null,
        conditionPassed: undefined,
        conditionResult: undefined
      }
    })));
    
    setEdges(edges.map(edge => ({
      ...edge,
      type: 'default',
      animated: false,
      style: {
        stroke: '#6b7280',
        strokeWidth: 2
      },
      data: {
        ...edge.data,
        isTestActive: false,
        isFlowing: false
      }
    })));
  };

  const handleSpeedChange = (speed: number) => {
    testEngineRef.current?.setSpeed(speed);
  };

  const exportResults = () => {
    const data = JSON.stringify(testResults, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearResults = () => {
    if (confirm('Clear all test results?')) {
      setTestResults([]);
    }
  };

  return (
    <div className="h-[calc(100vh-12rem)]">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Workflow Testing Lab</h2>
            <p className="text-gray-400">Test and debug your workflows with visual execution</p>
          </div>
          
          <div className="flex items-center gap-3">
            {testResults.length > 0 && (
              <>
                <button
                  onClick={exportResults}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export Results
                </button>
                <button
                  onClick={clearResults}
                  className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Clear Results
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {!workflow ? (
        <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-12 text-center">
          <TestTube className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-400 mb-2">No Workflow Selected</h3>
          <p className="text-gray-500">Select a workflow from the "My Workflows" tab to start testing</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6 h-full">
          {/* Test Controls */}
          <div className="lg:col-span-1 space-y-4">
            {/* Test Configuration */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-white mb-3">Test Configuration</h3>
              
              <div className="space-y-3">
                {/* Test Mode Selector */}
                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">Test Mode</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setTestMode('simulated');
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                        testMode === 'simulated' 
                          ? 'bg-[#37bd7e] text-white' 
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <TestTube className="w-4 h-4 inline mr-1" />
                      Simulated
                    </button>
                    <button
                      onClick={() => {
                        setTestMode('real');
                        if (realDataScenarios.length === 0) {
                          loadRealDataScenarios();
                        }
                      }}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                        testMode === 'real' 
                          ? 'bg-[#37bd7e] text-white' 
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      <Database className="w-4 h-4 inline mr-1" />
                      Real Data
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-400 mb-1 block">
                    {testMode === 'real' ? 'Real Data Scenario' : 'Test Scenario'}
                  </label>
                  {isLoadingRealData ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-5 h-5 animate-spin text-[#37bd7e]" />
                      <span className="ml-2 text-sm text-gray-400">Loading real data...</span>
                    </div>
                  ) : (
                    <select
                      value={selectedScenario}
                      onChange={(e) => setSelectedScenario(e.target.value)}
                      disabled={testExecutionState.isRunning}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm disabled:opacity-50"
                    >
                      {testMode === 'real' && realDataScenarios.length === 0 ? (
                        <option value="">No real data available</option>
                      ) : (
                        (testMode === 'real' ? realDataScenarios : dynamicScenarios).map(scenario => (
                          <option key={scenario.id} value={scenario.id}>
                            {scenario.name}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>

                {testMode === 'real' && realDataScenarios.length > 0 && (
                  <button
                    onClick={loadRealDataScenarios}
                    className="w-full px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh Real Data
                  </button>
                )}

                {!testExecutionState.isRunning ? (
                  <button
                    onClick={startTest}
                    className="w-full px-3 py-2 bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Test
                  </button>
                ) : (
                  <div className="flex gap-2">
                    {testExecutionState.isPaused ? (
                      <button
                        onClick={resumeTest}
                        className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" />
                        Resume
                      </button>
                    ) : (
                      <button
                        onClick={pauseTest}
                        className="flex-1 px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        <Pause className="w-4 h-4" />
                        Pause
                      </button>
                    )}
                    <button
                      onClick={stopTest}
                      className="flex-1 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Square className="w-4 h-4" />
                      Stop
                    </button>
                  </div>
                )}

                {testExecutionState.isRunning && (
                  <div>
                    <label className="text-xs font-medium text-gray-400 mb-1 block">Execution Speed</label>
                    <select
                      value={testExecutionState.executionSpeed}
                      onChange={(e) => handleSpeedChange(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
                    >
                      <option value={0.5}>0.5x Speed</option>
                      <option value={1}>1x Speed</option>
                      <option value={2}>2x Speed</option>
                      <option value={5}>5x Speed</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Current Test Status */}
            {currentTest && (
              <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-white mb-3">Current Test</h3>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Workflow</span>
                    <span className="text-xs text-white">{currentTest.workflowName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Scenario</span>
                    <span className="text-xs text-white">{currentTest.scenarioName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Progress</span>
                    <span className="text-xs text-white">{currentTest.nodesPassed}/{currentTest.nodesTotal} nodes</span>
                  </div>
                  
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                      <span>Execution Progress</span>
                      <span>{currentTest.executionProgress ?? Math.round((currentTest.nodesPassed / currentTest.nodesTotal) * 100)}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-[#37bd7e] to-blue-500 transition-all duration-500"
                        style={{ width: `${currentTest.executionProgress ?? ((currentTest.nodesPassed / currentTest.nodesTotal) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Test Execution Log */}
            {currentTest && testExecutionState.logs.length > 0 && (
              <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-semibold text-white mb-3">Execution Log</h3>
                <div className="space-y-1 max-h-32 overflow-y-auto bg-gray-950/50 rounded p-2">
                  {testExecutionState.logs.slice(-10).map((log, i) => (
                    <div key={i} className="text-xs font-mono">
                      <span className={`
                        ${log.type === 'error' ? 'text-red-400' :
                          log.type === 'condition' ? (log.success ? 'text-green-400' : 'text-orange-400') :
                          log.type === 'skip' ? 'text-gray-500' :
                          log.type === 'complete' ? 'text-green-400' :
                          'text-gray-400'}
                      `}>
                        {log.type === 'condition' && (log.success ? '✓' : '✗')}
                        {log.type === 'skip' && '⊘'}
                        {log.type === 'error' && '✗'}
                        {log.type === 'complete' && '✓'}
                        {' '}
                        {log.nodeName}: {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Test Results */}
            <div className="bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg p-4 flex-1 overflow-y-auto">
              <h3 className="text-sm font-semibold text-white mb-3">Test Results</h3>
              
              {testResults.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-4">No test results yet</p>
              ) : (
                <div className="space-y-2">
                  {testResults.slice(0, 10).map((result) => (
                    <div
                      key={result.id}
                      className="bg-gray-800/30 rounded-lg p-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
                      onClick={() => {
                        // Could implement viewing past test details
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-2">
                          {result.status === 'passed' ? (
                            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-400 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-xs font-medium text-white">{result.scenarioName}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{result.workflowName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {result.nodesPassed}/{result.nodesTotal} nodes
                              </span>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-gray-500">
                                {result.executionTime}ms
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs font-medium ${
                            result.status === 'passed' ? 'text-green-400' : 'text-red-400'
                          }`}>
                            {result.status === 'passed' ? 'Passed' : 'Failed'}
                          </span>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDistanceToNow(result.timestamp, { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      {result.errorMessage && (
                        <p className="text-xs text-red-400 mt-2">{result.errorMessage}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Workflow Visualization */}
          <div className="lg:col-span-2 bg-gray-900/50 backdrop-blur-xl border border-gray-800/50 rounded-lg overflow-hidden">
            {showVisualization ? (
              <ReactFlowProvider>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onInit={(instance) => { reactFlowInstance.current = instance; }}
                  nodeTypes={memoizedNodeTypes}
                  edgeTypes={memoizedEdgeTypes}
                  defaultEdgeOptions={{
                    type: 'default',
                    style: { stroke: '#6b7280', strokeWidth: 2 }
                  }}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background color="#374151" gap={16} />
                  <Controls />
                  <MiniMap 
                    nodeColor={(node) => {
                      if (node.data?.testStatus === 'active') return '#facc15';
                      if (node.data?.testStatus === 'success') return '#10b981';
                      if (node.data?.testStatus === 'failed') return '#ef4444';
                      if (node.type === 'trigger') return '#9333ea';
                      if (node.type === 'condition') return '#2563eb';
                      return '#37bd7e';
                    }}
                  />
                </ReactFlow>
              </ReactFlowProvider>
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <Eye className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-400 mb-1">Workflow Visualization</h3>
                  <p className="text-sm text-gray-500">Start a test to see the workflow execution</p>
                </div>
              </div>
            )}
            
            {/* Execution Logs */}
            {currentTest && currentTest.logs.length > 0 && (
              <div className="absolute bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 p-4 max-h-48 overflow-y-auto">
                <h4 className="text-xs font-semibold text-gray-400 mb-2">Execution Logs</h4>
                <div className="space-y-1">
                  {currentTest.logs.slice(-5).map((log, index) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <div className="flex items-center gap-1">
                        {log.type === 'error' && <XCircle className="w-3 h-3 text-red-400" />}
                        {log.type === 'complete' && <CheckCircle className="w-3 h-3 text-green-400" />}
                        {log.type === 'condition' && <GitBranch className="w-3 h-3 text-blue-400" />}
                        {log.type === 'start' && <Play className="w-3 h-3 text-purple-400" />}
                        {log.type === 'data' && <Database className="w-3 h-3 text-yellow-400" />}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium text-white">{log.nodeName}:</span>
                        <span className="text-gray-400 ml-1">{log.message}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TestingLabEnhanced;