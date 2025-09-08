// Workflow Canvas Component - v2.1 with Visual Testing
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StatusIndicator, NodeStatus } from './StatusIndicator';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  Handle,
  Position,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Save, 
  Play, 
  Settings,
  Target,
  Activity,
  CheckSquare,
  Bell,
  Mail,
  Database,
  GitBranch,
  Zap,
  ChevronRight,
  Clock,
  Users,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Briefcase,
  FileText,
  Heart,
  Sparkles,
  X,
  Pause,
  Square,
  Search,
  Edit,
  Check,
  ChevronDown,
  Monitor,
  FlaskConical
} from 'lucide-react';
import { FaSlack } from 'react-icons/fa';
import { SlackConnectionButton } from '@/components/SlackConnectionButton';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { supabase } from '@/lib/supabase/clientV2';
import { WorkflowTestEngine, TestExecutionState, TEST_SCENARIOS, NodeExecutionState } from '@/lib/utils/workflowTestEngine';
import AnimatedTestEdge from './AnimatedTestEdge';
import WorkflowSaveModal from './WorkflowSaveModal';
import { WorkflowSuggestionGenerator } from '@/lib/utils/workflowSuggestions';
import AIAgentNode from './nodes/AIAgentNode';
import AIAgentConfigModal from './AIAgentConfigModal';
import type { AINodeConfig } from './AIAgentConfigModal';
import FormNode from './nodes/FormNode';
import type { FormField } from './nodes/FormNode';
import FormConfigModal from './FormConfigModal';
import FormPreview from './FormPreview';
import { formStorageService } from '@/lib/services/formStorageService';
import WorkflowTestMode from './WorkflowTestMode';
import ExecutionMonitor from './ExecutionMonitor';
import NodeExecutionModal from './NodeExecutionModal';
import { AIProviderService } from '@/lib/services/aiProvider';
import { createContextFromWorkflow } from '@/lib/utils/promptVariables';
import { formService } from '@/lib/services/formService';
import { workflowExecutionService } from '@/lib/services/workflowExecutionService';
import { useUsers } from '@/lib/hooks/useUsers';
import VariablePicker from './VariablePicker';
import LiveMonitorModal from './LiveMonitorModal';

// Icon mapping
const iconMap: { [key: string]: any } = {
  Target,
  Activity,
  Database,
  GitBranch,
  CheckSquare,
  Bell,
  Mail,
  Clock,
  Zap,
  Users,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Briefcase,
  FileText,
  Heart,
  Plus
};

// Map legacy test status to new NodeStatus type
const mapTestStatusToNodeStatus = (status: NodeExecutionState['status']): NodeStatus => {
  switch (status) {
    case 'active': return 'processing';
    case 'success': return 'success';
    case 'failed': return 'failed';
    case 'skipped': return 'skipped';
    case 'waiting': return 'waiting';
    case 'idle': 
    default: return 'idle';
  }
};

// Custom Node Types with Visual Testing - 33% smaller
const TriggerNode = ({ data, selected }: any) => {
  const Icon = data.iconName ? iconMap[data.iconName] : Target;
  const status = data.testStatus as NodeExecutionState['status'] | undefined;
  const nodeStatus = mapTestStatusToNodeStatus(status || 'idle');
  const isActive = status === 'active';
  
  return (
    <div className={`bg-purple-600 rounded-lg p-2 min-w-[72px] border-2 shadow-lg relative transition-all duration-300 ${
      isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-purple-500'
    } ${selected ? 'ring-2 ring-purple-300' : ''}`}>
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
        />
      )}
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-purple-500" />
      <div className="flex items-center gap-1.5 text-white">
        <Icon className="w-3 h-3" />
        <div>
          <div className="text-[10px] font-semibold">{data.label}</div>
          <div className="text-[8px] opacity-80">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

const ConditionNode = ({ data, selected }: any) => {
  const status = data.testStatus as NodeExecutionState['status'] | undefined;
  const nodeStatus = mapTestStatusToNodeStatus(status || 'idle');
  const isActive = status === 'active';
  
  return (
    <div className={`bg-blue-600 rounded-lg p-2 min-w-[66px] border-2 shadow-lg relative transition-all duration-300 ${
      isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-blue-500'
    } ${selected ? 'ring-2 ring-blue-300' : ''}`}>
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
        />
      )}
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" id="true" style={{top: '35%'}} />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" id="false" style={{top: '65%'}} />
      <div className="flex items-center gap-1.5 text-white">
        <GitBranch className="w-3 h-3" />
        <div>
          <div className="text-[10px] font-semibold">{data.label}</div>
          <div className="text-[8px] opacity-80">{data.condition || 'If condition met'}</div>
        </div>
      </div>
    </div>
  );
};

const ActionNode = ({ data, selected }: any) => {
  const Icon = data.iconName === 'Slack' ? FaSlack : (data.iconName ? iconMap[data.iconName] : CheckSquare);
  const status = data.testStatus as NodeExecutionState['status'] | undefined;
  const nodeStatus = mapTestStatusToNodeStatus(status || 'idle');
  const isActive = status === 'active';
  
  return (
    <div className={`bg-[#37bd7e] rounded-lg p-2 min-w-[72px] border-2 shadow-lg relative transition-all duration-300 ${
      isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-[#37bd7e]'
    } ${selected ? 'ring-2 ring-green-300' : ''}`}>
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
        />
      )}
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-white border-2 border-[#37bd7e]" />
      <div className="flex items-center gap-1.5 text-white">
        <Icon className="w-3 h-3" />
        <div>
          <div className="text-[10px] font-semibold">{data.label}</div>
          <div className="text-[8px] opacity-80">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

// Router Node for advanced workflows - 33% smaller
const RouterNode = ({ data, selected }: any) => {
  const status = data.testStatus as NodeExecutionState['status'] | undefined;
  const nodeStatus = mapTestStatusToNodeStatus(status || 'idle');
  const isActive = status === 'active';
  
  return (
    <div className={`bg-orange-600 rounded-lg p-2 min-w-[66px] border-2 shadow-lg relative transition-all duration-300 ${
      isActive ? 'border-yellow-400 shadow-yellow-400/50 shadow-xl scale-105' : 'border-orange-500'
    } ${selected ? 'ring-2 ring-orange-300' : ''}`}>
      {nodeStatus !== 'idle' && (
        <StatusIndicator 
          status={nodeStatus}
          variant="badge"
          position="top-right"
          size="sm"
        />
      )}
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" style={{top: '30%'}} id="a" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" style={{top: '50%'}} id="b" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" style={{top: '70%'}} id="c" />
      <div className="flex items-center gap-1.5 text-white">
        <GitBranch className="w-3 h-3" />
        <div>
          <div className="text-[10px] font-semibold">{data.label}</div>
          <div className="text-[8px] opacity-80">{data.description || 'Routes to multiple paths'}</div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  router: RouterNode,
  aiAgent: AIAgentNode,
  form: FormNode
};

const edgeTypes = {
  animated: AnimatedTestEdge,
};

interface WorkflowCanvasProps {
  selectedWorkflow: any;
  onSave: (workflow: any) => void;
  executionMode?: boolean;
  executionData?: any;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ 
  selectedWorkflow, 
  onSave, 
  executionMode = false, 
  executionData 
}) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showNodePanel, setShowNodePanel] = useState(true);
  const [workflowName, setWorkflowName] = useState('');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [suggestedName, setSuggestedName] = useState('');
  const [suggestedDescription, setSuggestedDescription] = useState('');
  const [isFirstSave, setIsFirstSave] = useState(true);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [lastSavedData, setLastSavedData] = useState<string>('');
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [nodeSearchQuery, setNodeSearchQuery] = useState('');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackChannels, setSlackChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const reactFlowInstance = useRef<any>(null);
  const [showAIConfigModal, setShowAIConfigModal] = useState(false);
  const [selectedAINode, setSelectedAINode] = useState<Node | null>(null);
  const [showFormConfigModal, setShowFormConfigModal] = useState(false);
  const [selectedFormNode, setSelectedFormNode] = useState<Node | null>(null);
  const [showFormPreview, setShowFormPreview] = useState(false);
  const [showWorkflowTestMode, setShowWorkflowTestMode] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingDescription, setEditingDescription] = useState('');
  const [showExecutionModal, setShowExecutionModal] = useState(false);
  const [selectedExecutionNode, setSelectedExecutionNode] = useState<Node | null>(null);
  const [currentExecutionId, setCurrentExecutionId] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [showRunDropdown, setShowRunDropdown] = useState(false);
  const [showLiveMonitor, setShowLiveMonitor] = useState(false);
  const { users, isLoading: usersLoading } = useUsers();
  const aiProviderService = useRef<AIProviderService>(AIProviderService.getInstance());
  const runDropdownRef = useRef<HTMLDivElement>(null);
  
  // Test Execution State - Initialize with default state
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
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('high_value_deal');
  const testEngineRef = useRef<WorkflowTestEngine | null>(null);

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        // Initialize AI provider service with user ID
        aiProviderService.current.initialize(user.id);
      }
    };
    getUser();
  }, []);
  
  // Load workflow data when selectedWorkflow changes
  useEffect(() => {
    if (selectedWorkflow) {
      // Set workflow name and description
      setWorkflowName(selectedWorkflow.name || selectedWorkflow.rule_name || '');
      setWorkflowDescription(selectedWorkflow.description || selectedWorkflow.rule_description || '');
      setWorkflowId(selectedWorkflow.id || null);
      setIsFirstSave(false); // If we're loading a workflow, it's not the first save
      
      // Load canvas data if available
      if (selectedWorkflow.canvas_data) {
        let nodesData = selectedWorkflow.canvas_data.nodes || [];
        
        // If in execution mode, enhance nodes with execution data
        if (executionMode && executionData) {
          nodesData = nodesData.map(node => {
            // Add execution data overlay to each node
            const nodeExecution = executionData.nodeExecutions?.[node.id];
            return {
              ...node,
              data: {
                ...node.data,
                executionMode: true,
                executionData: nodeExecution || null,
                executionStatus: nodeExecution?.status || 'pending'
              }
            };
          });
        }
        
        setNodes(nodesData);
        setEdges(selectedWorkflow.canvas_data.edges || []);
      }
    } else {
      // Reset for new workflow
      setWorkflowName('');
      setWorkflowDescription('');
      setWorkflowId(null);
      setIsFirstSave(true);
    }
  }, [selectedWorkflow, setNodes, setEdges, executionMode, executionData]);

  // Check Slack connection and load channels
  useEffect(() => {
    if (userId) {
      checkSlackConnection();
    }
  }, [userId]);

  const checkSlackConnection = async () => {
    if (!userId) return;
    
    try {
      const connected = await slackOAuthService.hasActiveIntegration(userId);
      setSlackConnected(connected);
      
      if (connected) {
        loadSlackChannels();
      }
    } catch (error) {
      console.error('Failed to check Slack connection:', error);
    }
  };

  const loadSlackChannels = async () => {
    if (!userId) return;
    
    setLoadingChannels(true);
    try {
      const channels = await slackOAuthService.getChannels(userId);
      setSlackChannels(channels);
    } catch (error) {
      console.error('Failed to load Slack channels:', error);
    } finally {
      setLoadingChannels(false);
    }
  };

  // Autosave functionality
  useEffect(() => {
    // Only autosave if we have a workflow ID (not first save) and have name/description
    if (!workflowId || !workflowName || !workflowDescription) return;
    
    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Create a hash of current data to check if anything changed
    const currentData = JSON.stringify({ nodes, edges, workflowName, workflowDescription });
    
    // Only save if data changed
    if (currentData !== lastSavedData) {
      // Set new timer for autosave (3 seconds after last change)
      autoSaveTimerRef.current = setTimeout(() => {
        console.log('🔄 Autosaving workflow...');
        performAutoSave();
      }, 3000);
    }
    
    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [nodes, edges, workflowName, workflowDescription, workflowId]);
  
  const performAutoSave = async () => {
    if (!workflowId || !workflowName) return;
    
    setIsAutoSaving(true);
    const workflow = buildWorkflowData();
    workflow.id = workflowId;
    
    try {
      // Call the save function
      await onSave(workflow);
      
      // Update last saved data
      const currentData = JSON.stringify({ nodes, edges, workflowName, workflowDescription });
      setLastSavedData(currentData);
      setLastSaveTime(new Date());
      
      console.log('✅ Workflow autosaved');
    } catch (error) {
      console.error('Failed to autosave workflow:', error);
    } finally {
      setIsAutoSaving(false);
    }
  };
  
  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // If in execution mode, show execution modal
      if (executionMode) {
        setSelectedExecutionNode(node);
        setShowExecutionModal(true);
        return;
      }

      // Normal editing mode
      if (node.type === 'aiAgent') {
        setSelectedAINode(node);
        setShowAIConfigModal(true);
      } else if (node.type === 'form') {
        setSelectedFormNode(node);
        setShowFormConfigModal(true);
      } else {
        setSelectedNode(node);
        setShowNodeEditor(true);
      }
    },
    [executionMode]
  );

  // Update node data when edited
  const updateNodeData = (nodeId: string, newData: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const updatedNode = {
            ...node,
            data: {
              ...node.data,
              ...newData,
            },
          };
          // Also update selectedNode if it's the one being edited
          if (selectedNode && selectedNode.id === nodeId) {
            setSelectedNode(updatedNode);
          }
          // Also update selectedFormNode if it's the one being edited
          if (selectedFormNode && selectedFormNode.id === nodeId) {
            setSelectedFormNode(updatedNode);
          }
          // Also update selectedAINode if it's the one being edited
          if (selectedAINode && selectedAINode.id === nodeId) {
            setSelectedAINode(updatedNode);
          }
          return updatedNode;
        }
        return node;
      })
    );
  };
  
  // Handle AI configuration save
  const handleAIConfigSave = (config: AINodeConfig) => {
    if (selectedAINode) {
      updateNodeData(selectedAINode.id, { config });
      setSelectedAINode(null);
    }
  };

  // Run workflow execution
  const runWorkflow = async (triggerData?: any) => {
    console.log('🚀 Run button clicked! Starting workflow execution...');
    
    if (isRunning) {
      console.log('⚠️ Workflow is already running, ignoring click');
      return;
    }
    
    setIsRunning(true);
    
    try {
      // Check if there are nodes to execute
      if (nodes.length === 0) {
        console.warn('⚠️ No nodes in workflow to execute');
        alert('Please add nodes to the workflow before running');
        return;
      }
      
      console.log(`📊 Found ${nodes.length} nodes and ${edges.length} edges to execute`);
      
      let currentWorkflowId = workflowId;
      
      // If workflow hasn't been saved yet, save it first
      if (!currentWorkflowId) {
        console.log('💾 Workflow not saved yet, saving before execution...');
        const workflow = buildWorkflowData();
        
        // Ensure we have at least a basic name for the workflow
        if (!workflow.name) {
          workflow.name = `Workflow-${new Date().toISOString().slice(0, 16)}`;
        }
        
        try {
          const savedWorkflow = await onSave(workflow);
          currentWorkflowId = savedWorkflow?.id;
          if (currentWorkflowId) {
            setWorkflowId(currentWorkflowId);
            console.log('✅ Workflow saved with ID:', currentWorkflowId);
          } else {
            throw new Error('No ID returned from save operation');
          }
        } catch (error) {
          console.error('❌ Failed to save workflow before execution:', error);
          alert('Failed to save the workflow. Please try saving manually first.');
          return;
        }
      }
      
      console.log('🎯 Starting workflow execution:', { 
        workflowId: currentWorkflowId, 
        nodes: nodes.length, 
        edges: edges.length,
        triggerData 
      });
      
      // Start execution
      const isTestMode = triggerData?.testMode || false;
      const executionId = await workflowExecutionService.startExecution(
        currentWorkflowId,
        nodes,
        edges,
        triggerData ? 'form' : 'manual',
        triggerData,
        isTestMode,
        workflowName || 'Untitled Workflow'
      );
      
      console.log('✅ Execution started successfully!', { executionId, isTestMode });
      
      setCurrentExecutionId(executionId);
      
      // Show success message
      alert(`Workflow execution started! Execution ID: ${executionId.slice(0, 8)}...\n\nCheck the Jobs tab to see the results.`);
      
      // Execution logged - will appear in Jobs tab
    } catch (error: any) {
      console.error('❌ Error running workflow:', error);
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to run workflow: ${errorMessage}\n\nCheck console for details.`);
    } finally {
      setIsRunning(false);
    }
  };

  // Quick test run with visual feedback

  // Live monitor for production jobs
  const runLiveMonitor = () => {
    console.log('📺 Starting live monitor mode...');
    setShowLiveMonitor(true);
    setShowRunDropdown(false);
  };

  // Quick run without UI
  const runQuickExecution = async () => {
    console.log('⚡ Quick execution...');
    setShowRunDropdown(false);
    await runWorkflow();
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (runDropdownRef.current && !runDropdownRef.current.contains(event.target as Node)) {
        setShowRunDropdown(false);
      }
    };

    if (showRunDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showRunDropdown]);

  // Listen for form submissions (both CustomEvents and BroadcastChannel)
  useEffect(() => {
    // Handle BroadcastChannel messages (cross-tab communication)
    const channel = new BroadcastChannel('workflow-form-submissions');
    
    const handleBroadcastMessage = (event: MessageEvent) => {
      console.log('[WorkflowCanvas] BroadcastChannel message received:', event.data);
      const { type, data } = event.data;
      
      if (type === 'formSubmitted' || type === 'formTestSubmission') {
        const { workflowId: eventWorkflowId, formData, formId } = data;
        
        console.log('[WorkflowCanvas] Processing form submission from broadcast:', {
          type,
          formId,
          eventWorkflowId,
          currentWorkflowId: workflowId,
          nodes: nodes.map(n => ({
            id: n.id,
            type: n.type,
            testUrl: n.data?.config?.testUrl,
            productionUrl: n.data?.config?.productionUrl
          }))
        });
        
        // Check if this workflow contains a form node with matching formId
        const matchingFormNode = nodes.find(node => {
          if (node.type !== 'form') return false;
          
          const testUrl = node.data?.config?.testUrl;
          const prodUrl = node.data?.config?.productionUrl;
          
          const matches = (type === 'formTestSubmission' && testUrl && testUrl.includes(formId)) ||
                         (type === 'formSubmitted' && prodUrl && prodUrl.includes(formId));
          
          if (matches) {
            console.log('[WorkflowCanvas] Found matching form node:', {
              nodeId: node.id,
              testUrl,
              prodUrl,
              formId
            });
          }
          
          return matches;
        });
        
        if (matchingFormNode) {
          console.log('[WorkflowCanvas] Triggering workflow execution from broadcast');
          
          // Show test mode UI if it's a test submission
          if (type === 'formTestSubmission' && !showWorkflowTestMode) {
            setShowWorkflowTestMode(true);
          }
          
          const isTestSubmission = type === 'formTestSubmission';
          runWorkflow({ ...formData, testMode: isTestSubmission });
        } else if (eventWorkflowId === workflowId) {
          console.log('[WorkflowCanvas] Workflow ID matches, triggering execution');
          const isTestSubmission = type === 'formTestSubmission';
          runWorkflow({ ...formData, testMode: isTestSubmission });
        } else {
          console.log('[WorkflowCanvas] No matching form node or workflow ID found');
        }
      }
    };
    
    channel.addEventListener('message', handleBroadcastMessage);
    
    // Also keep CustomEvent listeners for backward compatibility (same-tab submissions)
    const handleFormSubmission = (event: CustomEvent) => {
      console.log('[WorkflowCanvas] CustomEvent received (same tab):', event.detail);
      handleBroadcastMessage({ data: { type: 'formSubmitted', data: event.detail } } as MessageEvent);
    };
    
    const handleTestFormSubmission = (event: CustomEvent) => {
      console.log('[WorkflowCanvas] CustomEvent test received (same tab):', event.detail);
      handleBroadcastMessage({ data: { type: 'formTestSubmission', data: event.detail } } as MessageEvent);
    };

    window.addEventListener('formSubmitted', handleFormSubmission as EventListener);
    window.addEventListener('formTestSubmission', handleTestFormSubmission as EventListener);
    
    return () => {
      channel.close();
      window.removeEventListener('formSubmitted', handleFormSubmission as EventListener);
      window.removeEventListener('formTestSubmission', handleTestFormSubmission as EventListener);
    };
  }, [nodes, edges, workflowId, showWorkflowTestMode]);

  // Delete selected node
  const deleteSelectedNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((node) => node.id !== selectedNode.id));
      setEdges((eds) => eds.filter((edge) => 
        edge.source !== selectedNode.id && edge.target !== selectedNode.id
      ));
      setSelectedNode(null);
      setShowNodeEditor(false);
    }
  };

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      
      const type = event.dataTransfer.getData('nodeType');
      const nodeData = JSON.parse(event.dataTransfer.getData('nodeData'));

      if (type && nodeData && reactFlowInstance.current) {
        // Get viewport info for proper centering
        const { x, y, zoom } = reactFlowInstance.current.getViewport();
        const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
        
        if (reactFlowBounds) {
          // Calculate center of the visible viewport
          const centerX = (-x + reactFlowBounds.width / 2) / zoom;
          const centerY = (-y + reactFlowBounds.height / 2) / zoom;
          
          // Enhanced data for condition nodes based on their type
          let enhancedData = { ...nodeData };
          
          // Initialize multi_action node with default actions
          if (type === 'action' && nodeData.type === 'multi_action') {
            enhancedData = {
              ...nodeData,
              actions: [
                { type: 'create_task' },
                { type: 'send_notification' }
              ],
              executionMode: 'sequential'
            };
          }
          
          // Initialize router node with default configuration
          if (type === 'router') {
            enhancedData = {
              ...nodeData,
              routerType: 'stage',
              route_SQL: 'continue',
              route_Opportunity: 'action1',
              route_Verbal: 'action2',
              route_Signed: 'action3'
            };
          }
          
          // Initialize AI Agent node with default configuration
          if (type === 'aiAgent') {
            enhancedData = {
              ...nodeData,
              config: {
                modelProvider: 'openai',
                model: 'gpt-3.5-turbo',
                systemPrompt: 'You are a helpful AI assistant for a CRM system.',
                userPrompt: 'Process the following deal: {{deal.value}} for {{contact.name}}',
                temperature: 0.7,
                maxTokens: 1000
              }
            };
          }
          
          // Initialize Form node with default configuration
          if (type === 'form') {
            enhancedData = {
              ...nodeData,
              config: {
                formTitle: 'New Form',
                formDescription: 'Enter your information below',
                submitButtonText: 'Submit',
                requireAuth: false,
                fields: [],
                responseSettings: {
                  showSuccessMessage: true,
                  successMessage: 'Thank you for your submission!',
                  redirectUrl: '',
                  continueWorkflow: true
                }
              }
            };
          }
          
          if (type === 'condition') {
            if (nodeData.type === 'if_value') {
              enhancedData = {
                ...nodeData,
                conditionType: 'field',
                fieldName: 'deal_value',
                fieldOperator: '>',
                fieldValue: '10000',
                condition: 'deal_value > 10000'
              };
            } else if (nodeData.type === 'if_stage') {
              enhancedData = {
                ...nodeData,
                conditionType: 'stage',
                stageCondition: 'Opportunity',
                condition: 'stage = Opportunity'
              };
            } else if (nodeData.type === 'if_time') {
              enhancedData = {
                ...nodeData,
                conditionType: 'custom',
                condition: 'days_in_stage > 7'
              };
            } else if (nodeData.type === 'if_user') {
              enhancedData = {
                ...nodeData,
                conditionType: 'owner',
                condition: 'owner = current_user'
              };
            }
          }
          
          const nodeId = `${type}_${Date.now()}`;
          
          // Special handling for form nodes - automatically generate URLs
          if (type === 'form') {
            const timestamp = Date.now();
            const randomStr = Math.random().toString(36).substring(2, 15);
            const testFormId = `form-test-${timestamp}-${randomStr}`;
            const prodFormId = `form-prod-${timestamp}-${randomStr}`;
            
            // Generate URLs
            const testUrl = `${window.location.origin}/form-test/${testFormId}`;
            const productionUrl = `${window.location.origin}/form/${prodFormId}`;
            
            // Create default configuration
            const defaultFormConfig = {
              formTitle: nodeData.label || 'New Form',
              formDescription: 'Please fill out this form',
              submitButtonText: 'Submit',
              fields: [
                {
                  id: 'field-1',
                  name: 'name',
                  label: 'Name',
                  type: 'text' as const,
                  required: true,
                  placeholder: 'Enter your name'
                },
                {
                  id: 'field-2',
                  name: 'email',
                  label: 'Email',
                  type: 'email' as const,
                  required: true,
                  placeholder: 'Enter your email'
                }
              ] as FormField[],
              authentication: 'none' as const,
              responseSettings: {
                onSubmit: 'continue' as const,
                successMessage: 'Thank you for your submission!',
                errorMessage: 'An error occurred. Please try again.'
              },
              testUrl,
              productionUrl
            };
            
            // Save form configurations immediately (async but don't wait)
            // For new workflows, generate a temporary ID that will be updated when saved
            const currentWorkflowId = workflowId || crypto.randomUUID();
            formStorageService.storeFormConfig(testFormId, defaultFormConfig, currentWorkflowId, true);
            formStorageService.storeFormConfig(prodFormId, defaultFormConfig, currentWorkflowId, false);
            
            // Log for debugging
            console.log('[WorkflowCanvas] Form node created with URLs:', {
              testUrl,
              productionUrl,
              testFormId,
              prodFormId,
              workflowId: currentWorkflowId
            });
            
            // Add URLs to node data
            enhancedData = {
              ...enhancedData,
              config: defaultFormConfig
            };
          }
          
          const newNode = {
            id: nodeId,
            type,
            position: {
              x: centerX - 36, // Center horizontally (node width ~72px, 40% smaller)
              y: centerY - 18  // Center vertically (node height ~36px, 40% smaller)
            },
            data: enhancedData,
          };

          setNodes((nds) => nds.concat(newNode));
          
          // Show helpful message for form nodes
          if (type === 'form') {
            console.log('✅ Form node created with test and production URLs ready to use!');
          }
        }
      }
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Test Execution Functions
  const handleTestStateChange = (newState: TestExecutionState) => {
    setTestExecutionState(newState);
    
    // Update node visual states
    const updatedNodes = nodes.map(node => {
      const nodeState = newState.nodeStates.get(node.id);
      return {
        ...node,
        data: {
          ...node.data,
          testStatus: nodeState?.status || 'idle'
        }
      };
    });
    setNodes(updatedNodes);
    
    // Update edge visual states for animation
    const updatedEdges = edges.map(edge => {
      const sourceState = newState.nodeStates.get(edge.source);
      const targetState = newState.nodeStates.get(edge.target);
      
      // Edge is flowing if source is complete and target is active
      const isFlowing = sourceState?.status === 'success' && targetState?.status === 'active';
      // Edge is active if either node is active
      const isTestActive = sourceState?.status === 'active' || targetState?.status === 'active' || isFlowing;
      
      return {
        ...edge,
        type: newState.isRunning ? 'animated' : undefined,
        animated: false, // Disable default animation
        data: {
          ...edge.data,
          isTestActive,
          isFlowing
        }
      };
    });
    setEdges(updatedEdges);
  };

  const startTest = () => {
    console.log('🚀 Starting test with nodes:', nodes.length, 'edges:', edges.length);
    
    // Check if there are nodes to test
    if (nodes.length === 0) {
      alert('Please add some nodes to the workflow before testing.');
      return;
    }
    
    // Check for trigger node
    const hasTrigger = nodes.some(n => n.type === 'trigger');
    if (!hasTrigger) {
      alert('Please add a trigger node to start the workflow.');
      return;
    }
    
    // Auto-fit view to show all nodes when test starts
    if (reactFlowInstance.current) {
      reactFlowInstance.current.fitView({ 
        padding: 0.2, 
        duration: 800,
        maxZoom: 1.5,
        minZoom: 0.5
      });
    }
    
    // Create test engine instance
    testEngineRef.current = new WorkflowTestEngine(nodes, edges, handleTestStateChange);
    
    // Find selected scenario
    const scenario = TEST_SCENARIOS.find(s => s.id === selectedScenario);
    console.log('📊 Selected scenario:', scenario);
    
    // Start test execution
    testEngineRef.current.startTest(scenario);
    
    // Ensure test panel is visible and node editor is closed
    setShowTestPanel(true);
    setShowNodeEditor(false);
  };

  const pauseTest = () => {
    testEngineRef.current?.pause();
  };

  const resumeTest = () => {
    testEngineRef.current?.resume();
  };

  const stopTest = () => {
    testEngineRef.current?.stop();
    
    // Reset all node states
    const updatedNodes = nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        testStatus: 'idle'
      }
    }));
    setNodes(updatedNodes);
    
    // Reset all edge states
    const updatedEdges = edges.map(edge => ({
      ...edge,
      type: undefined,
      animated: true,
      data: {
        ...edge.data,
        isTestActive: false,
        isFlowing: false
      }
    }));
    setEdges(updatedEdges);
    
    setTestExecutionState(null);
  };

  const handleSpeedChange = (speed: number) => {
    testEngineRef.current?.setSpeed(speed);
  };

  // Get form fields from workflow form nodes for variable picker
  const getFormFieldsFromWorkflow = () => {
    const formFields: Array<{ name: string; type: string; label: string }> = [];
    
    nodes.forEach(node => {
      if (node.type === 'form' && node.data?.config?.fields) {
        node.data.config.fields.forEach((field: any) => {
          formFields.push({
            name: field.name || field.label?.toLowerCase().replace(/\s+/g, '_') || 'field',
            type: field.type || 'text',
            label: field.label || field.name || 'Field'
          });
        });
      }
    });
    
    return formFields;
  };

  const buildWorkflowData = () => {
    // Extract trigger and action information from nodes
    // Form nodes can also act as triggers
    const triggerNode = nodes.find(n => n.type === 'trigger' || n.type === 'form');
    const actionNode = nodes.find(n => n.type === 'action' || n.type === 'aiAgent');
    const conditionNodes = nodes.filter(n => n.type === 'condition');

    // Build trigger conditions from condition nodes
    const trigger_conditions: any = {};
    conditionNodes.forEach(node => {
      if (node.data.condition && node.data.label) {
        // Parse condition (simplified for now)
        const conditionParts = node.data.condition.split(' ');
        if (conditionParts.length >= 3) {
          const field = conditionParts[0];
          const operator = conditionParts[1];
          const value = conditionParts.slice(2).join(' ');
          trigger_conditions[field] = { operator, value };
        }
      }
    });

    // Build action config from action node
    const action_config: any = {};
    if (actionNode?.data) {
      action_config.action_title = actionNode.data.label;
      action_config.action_description = actionNode.data.description;
      // Add specific config based on action type
      switch (actionNode.data.type) {
        case 'create_task':
          action_config.task_title = actionNode.data.taskTitle || `Task from ${workflowName}`;
          action_config.task_description = actionNode.data.taskDescription || 'Automated task';
          action_config.due_in_days = actionNode.data.dueDays || 1;
          action_config.priority = actionNode.data.priority || 'medium';
          action_config.assigned_to = actionNode.data.assignedTo || '';
          action_config.multiple_assignees = actionNode.data.multipleAssignees || false;
          action_config.assignee_list = Array.isArray(actionNode.data.assignedTo) ? actionNode.data.assignedTo : [];
          break;
        case 'send_notification':
          action_config.message = `Notification from ${workflowName}`;
          action_config.urgency = 'medium';
          break;
        case 'send_slack':
          action_config.webhook_url = actionNode.data.slackWebhookUrl || '';
          action_config.message_type = actionNode.data.slackMessageType || 'simple';
          action_config.message = actionNode.data.slackMessage || '';
          action_config.custom_message = actionNode.data.slackCustomMessage || '';
          action_config.blocks = actionNode.data.slackBlocks || '';
          action_config.channel = actionNode.data.slackChannel || '';
          action_config.mention_users = actionNode.data.slackMentionUsers || '';
          action_config.include_deal_link = actionNode.data.slackIncludeDealLink || false;
          action_config.include_owner = actionNode.data.slackIncludeOwner || false;
          break;
        case 'assign_owner':
          action_config.assign_to = actionNode.data.assignTo || 'round_robin';
          action_config.specific_user_id = actionNode.data.specificUserId || '';
          break;
        case 'create_contact':
          action_config.contact_name = actionNode.data.contactName || '';
          action_config.contact_email = actionNode.data.contactEmail || '';
          action_config.contact_phone = actionNode.data.contactPhone || '';
          action_config.contact_company = actionNode.data.contactCompany || '';
          action_config.assigned_to = actionNode.data.assignedTo || '';
          action_config.multiple_assignees = actionNode.data.multipleAssignees || false;
          action_config.assignee_list = Array.isArray(actionNode.data.assignedTo) ? actionNode.data.assignedTo : [];
          break;
        case 'create_deal':
          action_config.deal_name = actionNode.data.dealName || '';
          action_config.deal_value = actionNode.data.dealValue || 0;
          action_config.deal_company = actionNode.data.dealCompany || '';
          action_config.deal_stage = actionNode.data.dealStage || 'SQL';
          action_config.owner_id = actionNode.data.ownerId || '';
          action_config.multiple_owners = actionNode.data.multipleOwners || false;
          action_config.owner_list = Array.isArray(actionNode.data.ownerId) ? actionNode.data.ownerId : [];
          break;
        case 'create_company':
          action_config.company_name = actionNode.data.companyName || '';
          action_config.company_domain = actionNode.data.companyDomain || '';
          action_config.company_industry = actionNode.data.companyIndustry || '';
          action_config.company_size = actionNode.data.companySize || '';
          action_config.owner_id = actionNode.data.ownerId || '';
          action_config.multiple_owners = actionNode.data.multipleOwners || false;
          action_config.owner_list = Array.isArray(actionNode.data.ownerId) ? actionNode.data.ownerId : [];
          break;
        case 'create_meeting':
          action_config.meeting_title = actionNode.data.meetingTitle || '';
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.scheduled_for = actionNode.data.scheduledFor || '';
          action_config.duration = actionNode.data.duration || 30;
          action_config.attendees = actionNode.data.attendees || [];
          action_config.deal_id = actionNode.data.dealId || '';
          action_config.contact_id = actionNode.data.contactId || '';
          action_config.assigned_to = actionNode.data.assignedTo || '';
          action_config.multiple_assignees = actionNode.data.multipleAssignees || false;
          action_config.assignee_list = Array.isArray(actionNode.data.assignedTo) ? actionNode.data.assignedTo : [];
          break;
        case 'update_meeting':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.meeting_status = actionNode.data.meetingStatus || '';
          action_config.actual_duration = actionNode.data.actualDuration || '';
          action_config.meeting_notes = actionNode.data.meetingNotes || '';
          action_config.meeting_outcome = actionNode.data.meetingOutcome || '';
          break;
        case 'add_meeting_transcript':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.google_docs_url = actionNode.data.googleDocsUrl || '';
          action_config.transcript_text = actionNode.data.transcriptText || '';
          break;
        case 'add_meeting_summary':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.summary = actionNode.data.summary || '';
          action_config.key_points = actionNode.data.keyPoints || [];
          action_config.decisions = actionNode.data.decisions || [];
          break;
        case 'add_meeting_tasks':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.tasks = actionNode.data.tasks || [];
          break;
        case 'add_meeting_next_steps':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.next_steps = actionNode.data.nextSteps || [];
          action_config.follow_up_date = actionNode.data.followUpDate || '';
          break;
        case 'add_coaching_summary':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.coaching_summary = actionNode.data.coachingSummary || '';
          action_config.strengths = actionNode.data.strengths || [];
          action_config.improvement_areas = actionNode.data.improvementAreas || [];
          action_config.coaching_notes = actionNode.data.coachingNotes || '';
          break;
        case 'add_coaching_rating':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.overall_rating = actionNode.data.overallRating || '';
          action_config.communication_rating = actionNode.data.communicationRating || '';
          action_config.knowledge_rating = actionNode.data.knowledgeRating || '';
          action_config.closing_rating = actionNode.data.closingRating || '';
          action_config.rating_notes = actionNode.data.ratingNotes || '';
          break;
        case 'add_talk_time_percentage':
          action_config.fathom_meeting_id = actionNode.data.fathomMeetingId || '';
          action_config.sales_rep_talk_time = actionNode.data.salesRepTalkTime || '';
          action_config.prospect_talk_time = actionNode.data.prospectTalkTime || '';
          action_config.talk_time_analysis = actionNode.data.talkTimeAnalysis || '';
          action_config.talk_time_recommendations = actionNode.data.talkTimeRecommendations || '';
          break;
      }
    }

    // Only include ID if it's a valid UUID (not a template ID)
    const isValidUUID = (id: string) => {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return id && uuidRegex.test(id);
    };
    
    // Map form nodes to 'activity_created' trigger type
    // IMPORTANT: Database constraint does NOT allow 'manual' - only: 'activity_created', 'stage_changed', 'deal_created', 'task_completed'
    let mappedTriggerType = triggerNode?.data?.type || 'activity_created';
    
    // Debug logging
    console.log('🔍 Trigger node:', triggerNode);
    console.log('🔍 Trigger node type:', triggerNode?.type);
    console.log('🔍 Trigger node data type:', triggerNode?.data?.type);
    console.log('🔍 Original trigger type:', mappedTriggerType);
    
    // Map various trigger types to valid database values
    // NOTE: 'manual' is NOT valid despite what old migrations suggest
    const validTriggerTypes = ['activity_created', 'stage_changed', 'deal_created', 'task_completed'];
    
    if (mappedTriggerType === 'form_submission' || triggerNode?.type === 'form') {
      // Form submissions trigger an activity creation event
      mappedTriggerType = 'activity_created';
      console.log('📝 Mapping form trigger to activity_created');
    } else if (mappedTriggerType === 'manual') {
      // Manual triggers also map to activity_created
      mappedTriggerType = 'activity_created';
      console.log('📝 Mapping manual trigger to activity_created');
    } else if (!validTriggerTypes.includes(mappedTriggerType)) {
      console.warn(`⚠️ Invalid trigger type "${mappedTriggerType}", defaulting to "activity_created"`);
      mappedTriggerType = 'activity_created';
    }
    
    console.log('🔍 Mapped trigger type:', mappedTriggerType);
    
    // Map action types to valid database values
    // Based on testing, only 'create_task' and 'update_deal_stage' are currently valid
    const validActionTypes = ['create_task', 'update_deal_stage', 'create_contact', 'create_deal', 'create_company'];
    let mappedActionType = actionNode?.data?.type || 'create_task';
    
    if (actionNode?.type === 'aiAgent' || mappedActionType === 'ai_agent') {
      // AI agents map to create_task (most compatible)
      mappedActionType = 'create_task';
      console.log('🤖 Mapping AI agent to create_task');
    } else if (mappedActionType === 'send_slack') {
      // Slack actions map to create_task for now
      mappedActionType = 'create_task';
      console.log('💬 Mapping Slack action to create_task');
    } else if (!validActionTypes.includes(mappedActionType)) {
      // Default to create_task if action type is not valid
      console.warn(`⚠️ Invalid action type "${mappedActionType}", defaulting to "create_task"`);
      mappedActionType = 'create_task';
    }
    
    const workflow = {
      id: isValidUUID(selectedWorkflow?.id) ? selectedWorkflow.id : undefined, // Only include valid UUID IDs
      name: workflowName,
      description: workflowDescription,
      canvas_data: { nodes, edges },
      trigger_type: mappedTriggerType,
      trigger_config: trigger_conditions,
      action_type: mappedActionType,
      action_config: action_config,
      is_active: false, // Start inactive by default
      template_id: selectedWorkflow?.template_id || selectedWorkflow?.id || null // Use template ID or fallback to ID if it's a template
    };
    
    console.log('📦 Final workflow object being returned:', workflow);
    console.log('📦 Final trigger_type:', workflow.trigger_type);
    console.log('📦 Final action_type:', workflow.action_type);
    
    return workflow;
  };
  
  const handleSave = () => {
    // If first save or no name/description, show modal
    if (isFirstSave || !workflowName || !workflowDescription) {
      // Generate AI suggestions based on current workflow
      const suggestions = WorkflowSuggestionGenerator.generateSuggestions(nodes, edges);
      setSuggestedName(workflowName || suggestions.name);
      setSuggestedDescription(workflowDescription || suggestions.description);
      setShowSaveModal(true);
    } else {
      // Direct save for existing workflows with name/description
      const workflow = buildWorkflowData();
      console.log('💾 Saving workflow:', workflow);
      onSave(workflow);
    }
  };
  
  const handleModalSave = async (name: string, description: string) => {
    setWorkflowName(name);
    setWorkflowDescription(description);
    
    const workflow = buildWorkflowData();
    workflow.name = name;
    workflow.description = description;
    
    console.log('💾 Saving workflow from modal:', workflow);
    
    // Save the workflow and get the returned data
    const savedWorkflow = await onSave(workflow);
    
    // If we got a saved workflow back, update the ID for autosave
    if (savedWorkflow?.id) {
      setWorkflowId(savedWorkflow.id);
      // After first save, enable autosave
      setIsFirstSave(false);
    }
    
    // Store the saved data hash
    const currentData = JSON.stringify({ nodes, edges, workflowName: name, workflowDescription: description });
    setLastSavedData(currentData);
    
    // Close modal
    setShowSaveModal(false);
  };

  // Handle inline title editing
  const handleTitleClick = () => {
    setEditingName(workflowName);
    setEditingDescription(workflowDescription);
    setIsEditingTitle(true);
  };

  const handleTitleSave = () => {
    if (editingName.trim()) {
      setWorkflowName(editingName.trim());
      setWorkflowDescription(editingDescription.trim());
      
      // Auto-save if this is not the first save
      if (!isFirstSave && workflowId) {
        const workflow = buildWorkflowData();
        workflow.name = editingName.trim();
        workflow.description = editingDescription.trim();
        onSave(workflow);
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditingName(workflowName);
    setEditingDescription(workflowDescription);
    setIsEditingTitle(false);
  };

  const handleTest = () => {
    console.log('Testing workflow with nodes:', nodes, 'edges:', edges);
  };

  // Tidy nodes - arrange them in a clean layout
  const tidyNodes = () => {
    if (nodes.length === 0) return;

    // Group nodes by type
    const triggers = nodes.filter(n => n.type === 'trigger');
    const routers = nodes.filter(n => n.type === 'router');
    const conditions = nodes.filter(n => n.type === 'condition');
    const actions = nodes.filter(n => n.type === 'action');

    // Create a map of node connections
    const nodeConnections = new Map<string, string[]>();
    const nodeIncoming = new Map<string, string[]>();
    
    edges.forEach(edge => {
      if (!nodeConnections.has(edge.source)) {
        nodeConnections.set(edge.source, []);
      }
      nodeConnections.get(edge.source)!.push(edge.target);
      
      if (!nodeIncoming.has(edge.target)) {
        nodeIncoming.set(edge.target, []);
      }
      nodeIncoming.get(edge.target)!.push(edge.source);
    });

    // Find root nodes (triggers or nodes with no incoming edges)
    const rootNodes = nodes.filter(node => 
      node.type === 'trigger' || !nodeIncoming.has(node.id) || nodeIncoming.get(node.id)!.length === 0
    );

    // Build a level-based layout
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const nodePositions = new Map<string, { x: number, y: number }>();

    // BFS to assign levels
    const queue: { node: Node, level: number }[] = rootNodes.map(n => ({ node: n, level: 0 }));
    rootNodes.forEach(n => levels.set(n.id, 0));

    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) continue;
      const { node, level } = item;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      const children = nodeConnections.get(node.id) || [];
      children.forEach(childId => {
        const childNode = nodes.find(n => n.id === childId);
        if (childNode && !levels.has(childId)) {
          levels.set(childId, level + 1);
          queue.push({ node: childNode, level: level + 1 });
        }
      });
    }

    // Group nodes by level
    const nodesByLevel = new Map<number, Node[]>();
    nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push(node);
    });

    // Calculate positions
    const horizontalSpacing = 250;
    const verticalSpacing = 120;
    const startX = 100;
    const startY = 100;

    nodesByLevel.forEach((levelNodes, level) => {
      const totalHeight = levelNodes.length * verticalSpacing;
      const startYForLevel = startY + (400 - totalHeight) / 2; // Center vertically

      levelNodes.forEach((node, index) => {
        nodePositions.set(node.id, {
          x: startX + level * horizontalSpacing,
          y: startYForLevel + index * verticalSpacing
        });
      });
    });

    // Update all node positions
    setNodes((nds) => 
      nds.map(node => {
        const newPosition = nodePositions.get(node.id);
        if (newPosition) {
          return {
            ...node,
            position: newPosition
          };
        }
        return node;
      })
    );

    // Fit view after tidying
    setTimeout(() => {
      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ padding: 0.2, duration: 800 });
      }
    }, 100);
  };

  return (
    <>
    <div className="h-[calc(100vh-8rem)] flex overflow-hidden">
      {/* Left Panel - Node Library OR Test Panel - Hide in execution mode */}
      {!executionMode && (
        <motion.div 
          initial={{ x: -300 }}
          animate={{ x: (showNodePanel || showTestPanel) ? 0 : -300 }}
          className="w-80 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800/50 overflow-y-auto h-[calc(100vh-8rem)]" 
        >
        {/* Show Test Panel if testing, otherwise show Node Library */}
        {showTestPanel ? (
          <div className="h-full flex flex-col">
            {/* Test Panel Header */}
            <div className="bg-gray-800 p-4 flex items-center justify-between border-b border-gray-700">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-[#37bd7e]" />
                <h3 className="text-sm font-semibold text-white">Test Execution</h3>
              </div>
              <button
                onClick={() => {
                  setShowTestPanel(false);
                  if (testExecutionState?.isRunning) {
                    stopTest();
                  }
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Close test panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {/* Test Controls */}
            <div className="p-4 border-b border-gray-700 space-y-3">
              {!testExecutionState.isRunning ? (
                <>
                  <div>
                    <label className="text-xs font-semibold text-gray-400 mb-1 block">Test Scenario</label>
                    <select
                      value={selectedScenario}
                      onChange={(e) => setSelectedScenario(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm"
                    >
                      {TEST_SCENARIOS.map(scenario => (
                        <option key={scenario.id} value={scenario.id}>
                          {scenario.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={startTest}
                    className="w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Test
                  </button>
                </>
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
              
              {/* Speed Control */}
              {testExecutionState.isRunning && (
                <div>
                  <label className="text-xs font-semibold text-gray-400 mb-1 block">Execution Speed</label>
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
            
            {/* Test Data */}
            <div className="p-4 border-b border-gray-700">
              <h4 className="text-xs font-semibold text-gray-400 mb-2">Test Data Context</h4>
              <pre className="text-xs text-gray-300 bg-gray-800 rounded p-2 overflow-x-auto max-h-32">
                {JSON.stringify(testExecutionState.testData, null, 2)}
              </pre>
            </div>
            
            {/* Execution Logs */}
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="text-xs font-semibold text-gray-400 mb-3">Execution Log</h4>
              <div className="space-y-2">
                {testExecutionState.logs.map((log, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded-lg text-xs ${
                      log.type === 'error' ? 'bg-red-900/20 border border-red-800/50' :
                      log.type === 'complete' ? 'bg-green-900/20 border border-green-800/50' :
                      log.type === 'condition' ? 'bg-blue-900/20 border border-blue-800/50' :
                      'bg-gray-800/50 border border-gray-700/50'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex items-center gap-1">
                        {log.type === 'error' && <X className="w-3 h-3 text-red-400" />}
                        {log.type === 'complete' && <CheckSquare className="w-3 h-3 text-green-400" />}
                        {log.type === 'condition' && <GitBranch className="w-3 h-3 text-blue-400" />}
                        {log.type === 'start' && <Play className="w-3 h-3 text-purple-400" />}
                        {log.type === 'data' && <Database className="w-3 h-3 text-yellow-400" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{log.nodeName}</div>
                        <div className="text-gray-400">{log.message}</div>
                        {log.data && (
                          <div className="mt-1">
                            <pre className="text-xs text-gray-500 bg-gray-900 rounded p-1 overflow-x-auto">
                              {JSON.stringify(log.data, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                      <div className="text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-800">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={nodeSearchQuery}
                  onChange={(e) => setNodeSearchQuery(e.target.value)}
                  placeholder="Search nodes..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                />
              </div>
            </div>
            
            {/* Node Library Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Check if search has no results */}
          {nodeSearchQuery && (() => {
            const allTriggers = [
              { type: 'form_submission', label: 'Form Submission', iconName: 'FileText', description: 'When form submitted', nodeType: 'form' },
              { type: 'stage_changed', label: 'Stage Changed', iconName: 'Target', description: 'When deal moves stages' },
              { type: 'activity_created', label: 'Activity Created', iconName: 'Activity', description: 'When activity logged' },
              { type: 'deal_created', label: 'Deal Created', iconName: 'Database', description: 'When new deal added' },
              { type: 'webhook_received', label: 'Webhook Received', iconName: 'Zap', description: 'External webhook trigger' },
              { type: 'task_overdue', label: 'Task Overdue', iconName: 'AlertTriangle', description: 'Task past due date' },
              { type: 'activity_monitor', label: 'Activity Monitor', iconName: 'Activity', description: 'Monitor activity levels' },
              { type: 'scheduled', label: 'Scheduled', iconName: 'Clock', description: 'Time-based trigger' },
              { type: 'time_based', label: 'Time Based', iconName: 'Clock', description: 'After time period' }
            ];
            
            const allConditions = [
              { type: 'if_value', label: 'If Value', condition: 'Check field value' },
              { type: 'if_stage', label: 'If Stage', condition: 'Check deal stage' },
              { type: 'if_custom_field', label: 'Custom Field Value', condition: 'Check custom fields' },
              { type: 'time_since_contact', label: 'Time Since Contact', condition: 'Days since last interaction' },
              { type: 'if_time', label: 'If Time', condition: 'Time-based condition' },
              { type: 'if_user', label: 'If User', condition: 'User-based check' },
              { type: 'stage_router', label: 'Stage Router', condition: 'Route by stage', nodeType: 'router' }
            ];
            
            const allActions = [
              { type: 'create_task', label: 'Create Task', iconName: 'CheckSquare', description: 'Generate task' },
              { type: 'create_recurring_task', label: 'Recurring Task', iconName: 'CheckSquare', description: 'Scheduled tasks' },
              { type: 'send_webhook', label: 'Send Webhook', iconName: 'Zap', description: 'Call external API' },
              { type: 'send_notification', label: 'Send Notification', iconName: 'Bell', description: 'Send alert' },
              { type: 'send_slack', label: 'Send to Slack', iconName: 'Slack', description: 'Post to Slack channel' },
              { type: 'send_email', label: 'Send Email', iconName: 'Mail', description: 'Email notification' },
              { type: 'add_note', label: 'Add Note/Comment', iconName: 'FileText', description: 'Add activity note' },
              { type: 'update_fields', label: 'Update Fields', iconName: 'TrendingUp', description: 'Update one or more fields' },
              { type: 'assign_owner', label: 'Assign Owner', iconName: 'Users', description: 'Change owner' },
              { type: 'create_activity', label: 'Create Activity', iconName: 'Calendar', description: 'Log activity' },
              { type: 'create_contact', label: 'Create Contact', iconName: 'Users', description: 'Create new contact' },
              { type: 'create_deal', label: 'Create Deal', iconName: 'Database', description: 'Create new deal' },
              { type: 'create_company', label: 'Create Company', iconName: 'Briefcase', description: 'Create new company' },
              { type: 'create_meeting', label: 'Create Meeting', iconName: 'Calendar', description: 'Schedule new meeting' },
              { type: 'update_meeting', label: 'Update Meeting', iconName: 'Edit', description: 'Update meeting details' },
              { type: 'add_meeting_transcript', label: 'Add Transcript', iconName: 'FileText', description: 'Add meeting transcript' },
              { type: 'add_meeting_summary', label: 'Add Summary', iconName: 'FileText', description: 'Add meeting summary' },
              { type: 'add_meeting_tasks', label: 'Add Meeting Tasks', iconName: 'CheckSquare', description: 'Create tasks from meeting' },
              { type: 'add_meeting_next_steps', label: 'Add Next Steps', iconName: 'ChevronRight', description: 'Add follow-up steps' },
              { type: 'add_coaching_summary', label: 'Add Coaching', iconName: 'Users', description: 'Add coaching feedback' },
              { type: 'add_coaching_rating', label: 'Add Rating', iconName: 'TrendingUp', description: 'Rate performance' },
              { type: 'add_talk_time_percentage', label: 'Add Talk Time', iconName: 'Clock', description: 'Record talk time data' },
              { type: 'multi_action', label: 'Multiple Actions', iconName: 'Zap', description: 'Multiple steps' }
            ];
            
            const query = nodeSearchQuery.toLowerCase();
            const hasResults = 
              allTriggers.some(t => t.label.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)) ||
              allConditions.some(c => c.label.toLowerCase().includes(query) || c.condition.toLowerCase().includes(query)) ||
              allActions.some(a => a.label.toLowerCase().includes(query) || a.description.toLowerCase().includes(query));
            
            if (!hasResults) {
              return (
                <div className="text-center py-8">
                  <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No nodes found</p>
                  <p className="text-gray-500 text-sm mt-1">Try searching for different keywords</p>
                </div>
              );
            }
            return null;
          })()}
          
          {/* Triggers */}
          {(() => {
            const triggers = [
                { type: 'form_submission', label: 'Form Submission', iconName: 'FileText', description: 'When form submitted', nodeType: 'form' },
                { type: 'stage_changed', label: 'Stage Changed', iconName: 'Target', description: 'When deal moves stages' },
                { type: 'activity_created', label: 'Activity Created', iconName: 'Activity', description: 'When activity logged' },
                { type: 'deal_created', label: 'Deal Created', iconName: 'Database', description: 'When new deal added' },
                { type: 'webhook_received', label: 'Webhook Received', iconName: 'Zap', description: 'External webhook trigger' },
                { type: 'task_overdue', label: 'Task Overdue', iconName: 'AlertTriangle', description: 'Task past due date' },
                { type: 'activity_monitor', label: 'Activity Monitor', iconName: 'Activity', description: 'Monitor activity levels' },
                { type: 'scheduled', label: 'Scheduled', iconName: 'Clock', description: 'Time-based trigger' },
                { type: 'time_based', label: 'Time Based', iconName: 'Clock', description: 'After time period' }
            ].filter(trigger => 
              !nodeSearchQuery || 
              trigger.label.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
              trigger.description.toLowerCase().includes(nodeSearchQuery.toLowerCase())
            );
            
            return triggers.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Triggers</h3>
                <div className="space-y-2">
                  {triggers.map((trigger) => {
                    const TriggerIcon = iconMap[trigger.iconName] || Target;
                    return (
                      <div
                        key={trigger.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('nodeType', trigger.nodeType || 'trigger');
                          e.dataTransfer.setData('nodeData', JSON.stringify(trigger));
                        }}
                        className="bg-purple-600/20 border border-purple-600/30 rounded-lg p-3 cursor-move hover:bg-purple-600/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <TriggerIcon className="w-4 h-4 text-purple-400" />
                          <div>
                            <div className="text-sm text-white">{trigger.label}</div>
                            <div className="text-xs text-gray-400">{trigger.description}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;
          })()}
          
          {/* Conditions & Routers */}
          {(() => {
            const conditions = [
                { type: 'if_value', label: 'If Value', condition: 'Check field value' },
                { type: 'if_stage', label: 'If Stage', condition: 'Check deal stage' },
                { type: 'if_custom_field', label: 'Custom Field Value', condition: 'Check custom fields' },
                { type: 'time_since_contact', label: 'Time Since Contact', condition: 'Days since last interaction' },
                { type: 'if_time', label: 'If Time', condition: 'Time-based condition' },
                { type: 'if_user', label: 'If User', condition: 'User-based check' },
                { type: 'stage_router', label: 'Stage Router', condition: 'Route by stage', nodeType: 'router' }
            ].filter(condition => 
              !nodeSearchQuery || 
              condition.label.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
              condition.condition.toLowerCase().includes(nodeSearchQuery.toLowerCase())
            );
            
            return conditions.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Logic & Routing</h3>
                <div className="space-y-2">
                  {conditions.map((condition) => (
                    <div
                      key={condition.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('nodeType', condition.nodeType || 'condition');
                        e.dataTransfer.setData('nodeData', JSON.stringify(condition));
                      }}
                      className={`${condition.nodeType === 'router' ? 'bg-orange-600/20 border-orange-600/30 hover:bg-orange-600/30' : 'bg-blue-600/20 border-blue-600/30 hover:bg-blue-600/30'} rounded-lg p-3 cursor-move transition-colors`}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="w-4 h-4 text-blue-400" />
                        <div>
                          <div className="text-sm text-white">{condition.label}</div>
                          <div className="text-xs text-gray-400">{condition.condition}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
          
          {/* AI & Intelligence */}
          {(() => {
            const aiNodes = [
              { type: 'ai_agent', label: 'AI Agent', description: 'Process with AI model', iconName: 'Sparkles', nodeType: 'aiAgent' }
            ].filter(node => 
              !nodeSearchQuery || 
              node.label.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
              node.description.toLowerCase().includes(nodeSearchQuery.toLowerCase())
            );
            
            return aiNodes.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">AI & Intelligence</h3>
                <div className="space-y-2">
                  {aiNodes.map((node) => (
                    <div
                      key={node.type}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('nodeType', node.nodeType);
                        e.dataTransfer.setData('nodeData', JSON.stringify(node));
                      }}
                      className="bg-purple-600/20 border border-purple-600/30 rounded-lg p-3 cursor-move hover:bg-purple-600/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-purple-400" />
                        <div>
                          <div className="text-sm text-white">{node.label}</div>
                          <div className="text-xs text-gray-400">{node.description}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
          
          {/* Actions */}
          {(() => {
            const actions = [
                { type: 'create_task', label: 'Create Task', iconName: 'CheckSquare', description: 'Generate task' },
                { type: 'create_recurring_task', label: 'Recurring Task', iconName: 'CheckSquare', description: 'Scheduled tasks' },
                { type: 'send_webhook', label: 'Send Webhook', iconName: 'Zap', description: 'Call external API' },
                { type: 'send_notification', label: 'Send Notification', iconName: 'Bell', description: 'Send alert' },
                { type: 'send_slack', label: 'Send to Slack', iconName: 'Slack', description: 'Post to Slack channel' },
                { type: 'send_email', label: 'Send Email', iconName: 'Mail', description: 'Email notification' },
                { type: 'add_note', label: 'Add Note/Comment', iconName: 'FileText', description: 'Add activity note' },
                { type: 'update_fields', label: 'Update Fields', iconName: 'TrendingUp', description: 'Update one or more fields' },
                { type: 'assign_owner', label: 'Assign Owner', iconName: 'Users', description: 'Change owner' },
                { type: 'create_activity', label: 'Create Activity', iconName: 'Calendar', description: 'Log activity' },
                { type: 'create_contact', label: 'Create Contact', iconName: 'Users', description: 'Create new contact' },
                { type: 'create_deal', label: 'Create Deal', iconName: 'Database', description: 'Create new deal' },
                { type: 'create_company', label: 'Create Company', iconName: 'Briefcase', description: 'Create new company' },
                { type: 'create_meeting', label: 'Create Meeting', iconName: 'Calendar', description: 'Schedule new meeting' },
                { type: 'update_meeting', label: 'Update Meeting', iconName: 'Edit', description: 'Update meeting details' },
                { type: 'add_meeting_transcript', label: 'Add Transcript', iconName: 'FileText', description: 'Add meeting transcript' },
                { type: 'add_meeting_summary', label: 'Add Summary', iconName: 'FileText', description: 'Add meeting summary' },
                { type: 'add_meeting_tasks', label: 'Add Meeting Tasks', iconName: 'CheckSquare', description: 'Create tasks from meeting' },
                { type: 'add_meeting_next_steps', label: 'Add Next Steps', iconName: 'ChevronRight', description: 'Add follow-up steps' },
                { type: 'add_coaching_summary', label: 'Add Coaching', iconName: 'Users', description: 'Add coaching feedback' },
                { type: 'add_coaching_rating', label: 'Add Rating', iconName: 'TrendingUp', description: 'Rate performance' },
                { type: 'add_talk_time_percentage', label: 'Add Talk Time', iconName: 'Clock', description: 'Record talk time data' },
                { type: 'multi_action', label: 'Multiple Actions', iconName: 'Zap', description: 'Multiple steps' }
            ].filter(action => 
              !nodeSearchQuery || 
              action.label.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
              action.description.toLowerCase().includes(nodeSearchQuery.toLowerCase())
            );
            
            return actions.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Actions</h3>
                <div className="space-y-2">
                  {actions.map((action) => {
                    const ActionIcon = action.iconName === 'Slack' ? FaSlack : (iconMap[action.iconName] || CheckSquare);
                    return (
                      <div
                        key={action.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('nodeType', 'action');
                          e.dataTransfer.setData('nodeData', JSON.stringify(action));
                        }}
                        className="bg-[#37bd7e]/20 border border-[#37bd7e]/30 rounded-lg p-3 cursor-move hover:bg-[#37bd7e]/30 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <ActionIcon className="w-4 h-4 text-[#37bd7e]" />
                          <div>
                            <div className="text-sm text-white">{action.label}</div>
                            <div className="text-xs text-gray-400">{action.description}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null;
          })()}
            </div>
          </div>
        )}
      </motion.div>
      )}

      {/* Main Canvas */}
      <div className={`${executionMode ? 'w-full' : 'flex-1'} relative h-[calc(100vh-8rem)] overflow-hidden`}>
        {/* Auto-save notification - Bottom right corner */}
        {lastSaveTime && (
          <div className="absolute bottom-4 right-4 z-40">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/90 backdrop-blur-xl border border-gray-700 rounded-lg shadow-lg">
              {isAutoSaving ? (
                <span className="flex items-center gap-2 text-yellow-400 text-xs">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                  Saving...
                </span>
              ) : (
                <span className="text-gray-400 text-xs">
                  Last saved {lastSaveTime.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Workflow Title - Top Left Corner - Editable */}
        {workflowName && !executionMode && (
          <div className="absolute top-4 left-4 z-40">
            {isEditingTitle ? (
              <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-lg shadow-lg p-3 min-w-80">
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm focus:outline-none focus:border-blue-500"
                    placeholder="Workflow name"
                    autoFocus
                  />
                  <textarea
                    value={editingDescription}
                    onChange={(e) => setEditingDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded text-white text-sm resize-none focus:outline-none focus:border-blue-500"
                    placeholder="Description (optional)"
                    rows={2}
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={handleTitleCancel}
                      className="px-3 py-1.5 text-gray-400 hover:text-white text-xs transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleTitleSave}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Save
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={handleTitleClick}
                className="px-4 py-2 bg-gray-900/95 backdrop-blur-xl border border-gray-700 rounded-lg shadow-lg cursor-pointer hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{workflowName}</span>
                  <Edit className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                {workflowDescription && (
                  <div className="text-xs text-gray-400 mt-0.5 max-w-60 truncate">
                    {workflowDescription}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Canvas Toolbar - Right Side - Hide in execution mode */}
        {!executionMode && (
          <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
          {/* Enhanced Run Button with Dropdown */}
          <div className="relative" ref={runDropdownRef}>
            {/* Main Run Button */}
            <div className="flex">
              <button
                onClick={() => runWorkflow()}
                disabled={isRunning || nodes.length === 0}
                className={`px-3 py-2 ${isRunning ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} text-white rounded-l-lg text-sm transition-colors flex items-center gap-2 ${(isRunning || nodes.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={isRunning ? 'Workflow is running...' : nodes.length === 0 ? 'Add nodes to run workflow' : 'Quick Run Workflow (Most Common)'}
              >
                {isRunning ? (
                  <Clock className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isRunning ? 'Running...' : 'Run'}
              </button>
              
              {/* Dropdown Toggle */}
              <button
                onClick={() => setShowRunDropdown(!showRunDropdown)}
                disabled={isRunning || nodes.length === 0}
                className={`px-2 ${isRunning ? 'bg-gray-600' : 'bg-green-600 hover:bg-green-700'} text-white rounded-r-lg border-l border-green-500 text-sm transition-colors ${(isRunning || nodes.length === 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="More run options"
              >
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            
            {/* Dropdown Menu */}
            {showRunDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-full mt-1 right-0 w-64 bg-gray-800 border border-gray-600 rounded-lg shadow-xl z-50"
              >
                <div className="p-2">
                  {/* Live Monitor Option */}
                  <button
                    onClick={runLiveMonitor}
                    className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 rounded flex items-center gap-3 transition-colors"
                    title="Keyboard: Ctrl+M (Cmd+M on Mac)"
                  >
                    <Monitor className="w-4 h-4 text-green-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">📡 Monitor Live Jobs</div>
                      <div className="text-xs text-gray-400">Watch production jobs in real-time</div>
                    </div>
                    <div className="text-xs text-gray-500 font-mono">Ctrl+M</div>
                  </button>
                  
                  <div className="border-t border-gray-700 my-2"></div>
                  
                  {/* Quick Run Option */}
                  <button
                    onClick={runQuickExecution}
                    className="w-full px-3 py-2 text-left text-white hover:bg-gray-700 rounded flex items-center gap-3 transition-colors"
                    title="Keyboard: Ctrl+R (Cmd+R on Mac)"
                  >
                    <Play className="w-4 h-4 text-orange-400" />
                    <div className="flex-1">
                      <div className="text-sm font-medium">⚡ Quick Run</div>
                      <div className="text-xs text-gray-400">Background execution, no UI</div>
                    </div>
                    <div className="text-xs text-gray-500 font-mono">Ctrl+R</div>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
          
          
          
          <div className="border-l border-gray-600 h-8 mx-1"></div>
          
          <button
            onClick={tidyNodes}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
            disabled={nodes.length === 0}
          >
            <Sparkles className="w-4 h-4" />
            Tidy Nodes
          </button>
          <button
            onClick={() => setShowNodePanel(!showNodePanel)}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {showNodePanel ? 'Hide' : 'Show'} Panel
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-2 bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
        )}

        {/* React Flow Canvas */}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onInit={(instance) => { reactFlowInstance.current = instance; }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionMode={ConnectionMode.Loose}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#37bd7e', strokeWidth: 2 },
            type: 'smoothstep'
          }}
          fitView
          className="bg-gray-950 h-full"
          style={{ height: '100%' }}
        >
          <Background color="#374151" gap={20} />
          <Controls className="bg-gray-800 border-gray-700" />
          <MiniMap 
            className="bg-gray-800 border-gray-700"
            nodeColor={(node) => {
              if (node.type === 'trigger') return '#9333ea';
              if (node.type === 'condition') return '#2563eb';
              return '#37bd7e';
            }}
          />
        </ReactFlow>

        {/* Empty State */}
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-center">
              <Zap className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-400 mb-1">Start Building</h3>
              <p className="text-sm text-gray-500">Drag and drop nodes from the left panel to get started</p>
            </div>
          </div>
        )}

        {/* Node Editor Panel - Hide when test panel is active */}
        {showNodeEditor && selectedNode && !showTestPanel && (
          <motion.div
            initial={{ x: 300 }}
            animate={{ x: 0 }}
            className="absolute top-0 right-0 w-96 h-[calc(100vh-8rem)] bg-gray-900/95 backdrop-blur-xl border-l border-gray-800/50 p-6 overflow-y-auto z-50"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-white">Edit Node</h3>
                  <p className="text-sm text-gray-400 mt-1">Configure node settings</p>
                </div>
                <button
                  onClick={() => setShowNodeEditor(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Node Type */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Node Type</p>
                <p className="text-white font-medium capitalize">{selectedNode.type}</p>
              </div>

              {/* Node Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Label</label>
                  <input
                    type="text"
                    value={selectedNode.data.label || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                    placeholder="Enter node label..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                  <textarea
                    value={selectedNode.data.description || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                    placeholder="Enter description..."
                  />
                </div>

                {/* Condition-specific settings */}
                {selectedNode.type === 'condition' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Condition Type</label>
                      <select
                        value={selectedNode.data.conditionType || 'field'}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, { conditionType: e.target.value });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                      >
                        <option value="field">Field Value</option>
                        <option value="stage">Deal Stage</option>
                        <option value="value">Deal Value</option>
                        <option value="owner">Deal Owner</option>
                        <option value="time">Time-Based</option>
                        <option value="custom_field">Custom Field</option>
                        <option value="time_since_contact">Time Since Contact</option>
                        <option value="custom">Custom Logic</option>
                      </select>
                    </div>

                    {selectedNode.data.conditionType === 'stage' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Stage Equals</label>
                        <select
                          value={selectedNode.data.stageCondition || 'SQL'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateNodeData(selectedNode.id, { 
                              stageCondition: e.target.value, 
                              condition: `stage = ${e.target.value}` 
                            });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                        >
                          <option value="SQL">SQL</option>
                          <option value="Opportunity">Opportunity</option>
                          <option value="Verbal">Verbal</option>
                          <option value="Signed">Signed</option>
                        </select>
                      </div>
                    )}

                    {selectedNode.data.conditionType === 'value' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Operator</label>
                          <select
                            value={selectedNode.data.operator || '>'}
                            onChange={(e) => {
                              e.stopPropagation();
                              const op = e.target.value;
                              const val = selectedNode.data.valueAmount || 10000;
                              updateNodeData(selectedNode.id, { 
                                operator: op, 
                                condition: `deal_value ${op} ${val}` 
                              });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value=">">Greater than</option>
                            <option value="<">Less than</option>
                            <option value="=">Equals</option>
                            <option value=">=">Greater or equal</option>
                            <option value="<=">Less or equal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Value</label>
                          <input
                            type="number"
                            value={selectedNode.data.valueAmount || 10000}
                            onChange={(e) => {
                              const val = e.target.value;
                              const op = selectedNode.data.operator || '>';
                              updateNodeData(selectedNode.id, { 
                                valueAmount: val, 
                                condition: `deal_value ${op} ${val}` 
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            placeholder="Enter amount..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.conditionType === 'owner' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Owner Condition</label>
                          <select
                            value={selectedNode.data.ownerCondition || 'is_current_user'}
                            onChange={(e) => {
                              e.stopPropagation();
                              const cond = e.target.value;
                              updateNodeData(selectedNode.id, { 
                                ownerCondition: cond,
                                condition: cond === 'is_current_user' ? 'owner = current_user' : 
                                          cond === 'is_not_current_user' ? 'owner != current_user' :
                                          cond === 'is_team_member' ? 'owner IN team_members' :
                                          'owner IS NULL'
                              });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="is_current_user">Is Current User</option>
                            <option value="is_not_current_user">Is Not Current User</option>
                            <option value="is_team_member">Is Team Member</option>
                            <option value="is_unassigned">Is Unassigned</option>
                          </select>
                        </div>
                        {selectedNode.data.ownerCondition === 'is_specific_user' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">User Email</label>
                            <input
                              type="email"
                              value={selectedNode.data.specificUser || ''}
                              onChange={(e) => {
                                const user = e.target.value;
                                updateNodeData(selectedNode.id, { 
                                  specificUser: user,
                                  condition: `owner = '${user}'`
                                });
                              }}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="user@example.com"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {selectedNode.data.conditionType === 'time' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Time Condition</label>
                          <select
                            value={selectedNode.data.timeField || 'days_in_stage'}
                            onChange={(e) => {
                              e.stopPropagation();
                              const field = e.target.value;
                              const op = selectedNode.data.timeOperator || '>';
                              const val = selectedNode.data.timeValue || 7;
                              updateNodeData(selectedNode.id, { 
                                timeField: field,
                                condition: `${field} ${op} ${val}`
                              });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="days_in_stage">Days in Current Stage</option>
                            <option value="days_since_created">Days Since Created</option>
                            <option value="days_since_last_activity">Days Since Last Activity</option>
                            <option value="days_until_due">Days Until Due Date</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Operator</label>
                          <select
                            value={selectedNode.data.timeOperator || '>'}
                            onChange={(e) => {
                              e.stopPropagation();
                              const op = e.target.value;
                              const field = selectedNode.data.timeField || 'days_in_stage';
                              const val = selectedNode.data.timeValue || 7;
                              updateNodeData(selectedNode.id, { 
                                timeOperator: op,
                                condition: `${field} ${op} ${val}`
                              });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value=">">More Than</option>
                            <option value="<">Less Than</option>
                            <option value="=">Exactly</option>
                            <option value=">=">At Least</option>
                            <option value="<=">At Most</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Days</label>
                          <input
                            type="number"
                            value={selectedNode.data.timeValue || 7}
                            onChange={(e) => {
                              const val = e.target.value;
                              const field = selectedNode.data.timeField || 'days_in_stage';
                              const op = selectedNode.data.timeOperator || '>';
                              updateNodeData(selectedNode.id, { 
                                timeValue: val,
                                condition: `${field} ${op} ${val}`
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Enter number of days..."
                            min="0"
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.conditionType === 'field' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Field to Check</label>
                          <select
                            value={selectedNode.data.fieldName || 'deal_value'}
                            onChange={(e) => {
                              e.stopPropagation();
                              const field = e.target.value;
                              const op = selectedNode.data.fieldOperator || '=';
                              const val = selectedNode.data.fieldValue || '';
                              updateNodeData(selectedNode.id, { 
                                fieldName: field,
                                condition: `${field} ${op} ${val}`
                              });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="deal_value">Deal Value</option>
                            <option value="deal_name">Deal Name</option>
                            <option value="company">Company</option>
                            <option value="contact_name">Contact Name</option>
                            <option value="owner">Owner</option>
                            <option value="stage">Stage</option>
                            <option value="days_in_stage">Days in Stage</option>
                            <option value="activity_count">Activity Count</option>
                            <option value="task_count">Task Count</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Operator</label>
                          <select
                            value={selectedNode.data.fieldOperator || '='}
                            onChange={(e) => {
                              e.stopPropagation();
                              const op = e.target.value;
                              const field = selectedNode.data.fieldName || 'deal_value';
                              const val = selectedNode.data.fieldValue || '';
                              updateNodeData(selectedNode.id, { 
                                fieldOperator: op,
                                condition: `${field} ${op} ${val}`
                              });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="=">Equals</option>
                            <option value="!=">Not Equals</option>
                            <option value=">">Greater Than</option>
                            <option value="<">Less Than</option>
                            <option value=">=">Greater or Equal</option>
                            <option value="<=">Less or Equal</option>
                            <option value="contains">Contains</option>
                            <option value="not_contains">Does Not Contain</option>
                            <option value="starts_with">Starts With</option>
                            <option value="ends_with">Ends With</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Value to Compare</label>
                          <input
                            type="text"
                            value={selectedNode.data.fieldValue || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              const field = selectedNode.data.fieldName || 'deal_value';
                              const op = selectedNode.data.fieldOperator || '=';
                              updateNodeData(selectedNode.id, { 
                                fieldValue: val,
                                condition: `${field} ${op} ${val}`
                              });
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Enter value to compare..."
                          />
                          <p className="text-xs text-gray-500 mt-1">Enter the value to compare against the selected field</p>
                        </div>
                      </>
                    )}
                    
                    {selectedNode.data.conditionType === 'custom_field' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Custom Field Name</label>
                          <input
                            type="text"
                            value={selectedNode.data.customFieldName || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { customFieldName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="e.g., industry, lead_source, priority"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Condition</label>
                          <select
                            value={selectedNode.data.customFieldOperator || 'equals'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { customFieldOperator: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="equals">Equals</option>
                            <option value="not_equals">Not Equals</option>
                            <option value="contains">Contains</option>
                            <option value="not_contains">Doesn't Contain</option>
                            <option value="is_empty">Is Empty</option>
                            <option value="is_not_empty">Is Not Empty</option>
                          </select>
                        </div>
                        {!['is_empty', 'is_not_empty'].includes(selectedNode.data.customFieldOperator || 'equals') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Value</label>
                            <input
                              type="text"
                              value={selectedNode.data.customFieldValue || ''}
                              onChange={(e) => updateNodeData(selectedNode.id, { customFieldValue: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="Enter value to check..."
                            />
                          </div>
                        )}
                      </>
                    )}

                    {selectedNode.data.conditionType === 'time_since_contact' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Comparison</label>
                          <select
                            value={selectedNode.data.timeComparison || 'greater_than'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { timeComparison: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="greater_than">More Than</option>
                            <option value="less_than">Less Than</option>
                            <option value="equals">Exactly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Days</label>
                          <input
                            type="number"
                            value={selectedNode.data.daysSinceContact || 7}
                            onChange={(e) => updateNodeData(selectedNode.id, { daysSinceContact: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Number of days..."
                            min="1"
                          />
                          <p className="text-xs text-gray-500 mt-1">Triggers based on time since last interaction</p>
                        </div>
                      </>
                    )}
                    
                    {selectedNode.data.conditionType === 'custom' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Custom Condition Logic</label>
                        <input
                          type="text"
                          value={selectedNode.data.condition || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { condition: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                          placeholder="e.g., days_in_stage > 14 AND deal_value > 10000"
                        />
                        <p className="text-xs text-gray-500 mt-1">Enter custom condition logic using SQL-like syntax</p>
                      </div>
                    )}
                  </>
                )}

                {/* Action-specific settings */}
                {selectedNode.type === 'action' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Action Type</label>
                      <select
                        value={selectedNode.data.type || 'create_task'}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, { type: e.target.value });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                      >
                        <option value="create_task">Create Task</option>
                        <option value="send_notification">Send Notification</option>
                        <option value="send_slack">Send Slack Message</option>
                        <option value="create_activity">Create Activity</option>
                        <option value="update_deal_stage">Update Deal Stage</option>
                        <option value="update_fields">Update Fields</option>
                        <option value="assign_owner">Assign Owner</option>
                        <option value="create_contact">Create Contact</option>
                        <option value="create_deal">Create Deal</option>
                        <option value="create_company">Create Company</option>
                        <option value="send_email">Send Email</option>
                        <option value="multi_action">Multiple Actions</option>
                      </select>
                    </div>

                    {selectedNode.data.type === 'create_task' && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Task Title</label>
                            <VariablePicker
                              onInsert={(variable) => {
                                const currentValue = selectedNode.data.taskTitle || '';
                                const newValue = currentValue + variable;
                                updateNodeData(selectedNode.id, { taskTitle: newValue });
                              }}
                              buttonText="Insert Variable"
                              formFields={getFormFieldsFromWorkflow()}
                            />
                          </div>
                          <input
                            type="text"
                            value={selectedNode.data.taskTitle || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { taskTitle: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="e.g., Follow up with {{formData.fields.name}}"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Task Priority</label>
                          <select
                            value={selectedNode.data.priority || 'medium'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { priority: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Assign To</label>
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.multipleAssignees || false}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { 
                                    multipleAssignees: e.target.checked,
                                    assignedTo: e.target.checked ? [] : ''
                                  });
                                }}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Multiple Users
                            </label>
                          </div>
                          {selectedNode.data.multipleAssignees ? (
                            <div className="space-y-2">
                              <div className="max-h-32 overflow-y-auto bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                                {usersLoading ? (
                                  <div className="text-gray-400 text-sm">Loading users...</div>
                                ) : (
                                  users.map(user => (
                                    <label key={user.id} className="flex items-center gap-2 py-1 text-sm text-gray-300 hover:bg-gray-700/50 rounded px-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(selectedNode.data.assignedTo || []).includes(user.id)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentAssignees = selectedNode.data.assignedTo || [];
                                          const newAssignees = e.target.checked 
                                            ? [...currentAssignees, user.id]
                                            : currentAssignees.filter((id: string) => id !== user.id);
                                          updateNodeData(selectedNode.id, { assignedTo: newAssignees });
                                        }}
                                        className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                                      />
                                      {user.first_name && user.last_name 
                                        ? `${user.first_name} ${user.last_name}` 
                                        : user.email}
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {((selectedNode.data.assignedTo || []).length || 0)} user(s) selected
                              </p>
                            </div>
                          ) : (
                            <select
                              value={selectedNode.data.assignedTo || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { assignedTo: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="">Select User...</option>
                              {usersLoading ? (
                                <option value="" disabled>Loading users...</option>
                              ) : (
                                users.map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}` 
                                      : user.email}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Due Date</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={selectedNode.data.dueInDays || 3}
                              onChange={(e) => updateNodeData(selectedNode.id, { dueInDays: parseInt(e.target.value) })}
                              className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="Number..."
                              min="0"
                            />
                            <span className="px-3 py-2 text-gray-400 text-sm">days from now</span>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'create_recurring_task' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Task Title</label>
                          <input
                            type="text"
                            value={selectedNode.data.taskTitle || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { taskTitle: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="e.g., Weekly check-in for {deal_name}"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Recurrence Pattern</label>
                          <select
                            value={selectedNode.data.recurrencePattern || 'weekly'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { recurrencePattern: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="biweekly">Bi-Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Assign To</label>
                          <select
                            value={selectedNode.data.assignedTo || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { assignedTo: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="">Select User...</option>
                            {usersLoading ? (
                              <option value="" disabled>Loading users...</option>
                            ) : (
                              users.map(user => (
                                <option key={user.id} value={user.id}>
                                  {user.first_name && user.last_name 
                                    ? `${user.first_name} ${user.last_name}` 
                                    : user.email}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">End After</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={selectedNode.data.occurrences || 10}
                              onChange={(e) => updateNodeData(selectedNode.id, { occurrences: parseInt(e.target.value) })}
                              className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="Number..."
                              min="1"
                            />
                            <span className="px-3 py-2 text-gray-400">occurrences</span>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'send_webhook' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Webhook URL</label>
                          <input
                            type="text"
                            value={selectedNode.data.webhookUrl || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookUrl: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="https://api.example.com/webhook"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">HTTP Method</label>
                          <select
                            value={selectedNode.data.httpMethod || 'POST'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { httpMethod: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Headers (JSON)</label>
                          <textarea
                            value={selectedNode.data.webhookHeaders || '{"Content-Type": "application/json"}'}
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookHeaders: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16 font-mono"
                            placeholder='{"Authorization": "Bearer token"}'
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Payload (JSON)</label>
                          <textarea
                            value={selectedNode.data.webhookPayload || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookPayload: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24 font-mono"
                            placeholder='{"deal_id": "{{deal_id}}", "value": "{{value}}"}'
                          />
                          <p className="text-xs text-gray-500 mt-1">Use variables: {{deal_id}}, {{deal_name}}, {{value}}, {{stage}}</p>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'add_note' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Note Content</label>
                          <textarea
                            value={selectedNode.data.noteContent || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { noteContent: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24"
                            placeholder="Enter note content... Use {{variables}} for dynamic content"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Note Type</label>
                          <select
                            value={selectedNode.data.noteType || 'general'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { noteType: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="general">General Note</option>
                            <option value="call">Call Notes</option>
                            <option value="meeting">Meeting Notes</option>
                            <option value="email">Email Notes</option>
                            <option value="internal">Internal Comment</option>
                          </select>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Assign To</label>
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.multipleAssignees || false}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { 
                                    multipleAssignees: e.target.checked,
                                    assignedTo: e.target.checked ? [] : ''
                                  });
                                }}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Multiple Users
                            </label>
                          </div>
                          {selectedNode.data.multipleAssignees ? (
                            <div className="space-y-2">
                              <div className="max-h-32 overflow-y-auto bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                                {usersLoading ? (
                                  <div className="text-gray-400 text-sm">Loading users...</div>
                                ) : (
                                  users.map(user => (
                                    <label key={user.id} className="flex items-center gap-2 py-1 text-sm text-gray-300 hover:bg-gray-700/50 rounded px-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(selectedNode.data.assignedTo || []).includes(user.id)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentAssignees = selectedNode.data.assignedTo || [];
                                          const newAssignees = e.target.checked 
                                            ? [...currentAssignees, user.id]
                                            : currentAssignees.filter((id: string) => id !== user.id);
                                          updateNodeData(selectedNode.id, { assignedTo: newAssignees });
                                        }}
                                        className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                                      />
                                      {user.first_name && user.last_name 
                                        ? `${user.first_name} ${user.last_name}` 
                                        : user.email}
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {((selectedNode.data.assignedTo || []).length || 0)} user(s) selected
                              </p>
                            </div>
                          ) : (
                            <select
                              value={selectedNode.data.assignedTo || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { assignedTo: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="">Select User...</option>
                              {usersLoading ? (
                                <option value="" disabled>Loading users...</option>
                              ) : (
                                users.map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}` 
                                      : user.email}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'update_fields' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Field Updates</label>
                          <div className="space-y-2">
                            {(selectedNode.data.fieldUpdates || [{ field: '', value: '' }]).map((update: any, index: number) => (
                              <div key={index} className="flex gap-2">
                                <select
                                  value={update.field || ''}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const updates = [...(selectedNode.data.fieldUpdates || [{ field: '', value: '' }])];
                                    updates[index].field = e.target.value;
                                    updateNodeData(selectedNode.id, { fieldUpdates: updates });
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                                >
                                  <option value="">Select field...</option>
                                  <option value="stage">Stage</option>
                                  <option value="value">Deal Value</option>
                                  <option value="probability">Probability</option>
                                  <option value="owner">Owner</option>
                                  <option value="expected_close">Expected Close</option>
                                  <option value="priority">Priority</option>
                                </select>
                                <input
                                  type="text"
                                  value={update.value || ''}
                                  onChange={(e) => {
                                    const updates = [...(selectedNode.data.fieldUpdates || [{ field: '', value: '' }])];
                                    updates[index].value = e.target.value;
                                    updateNodeData(selectedNode.id, { fieldUpdates: updates });
                                  }}
                                  className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                  placeholder="New value..."
                                />
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              const updates = [...(selectedNode.data.fieldUpdates || [{ field: '', value: '' }]), { field: '', value: '' }];
                              updateNodeData(selectedNode.id, { fieldUpdates: updates });
                            }}
                            className="mt-2 text-xs text-[#37bd7e] hover:text-[#2da96a] underline"
                          >
                            + Add another field
                          </button>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'send_notification' && (
                      <>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Notification Title</label>
                            <VariablePicker
                              onInsert={(variable) => {
                                const currentValue = selectedNode.data.notificationTitle || '';
                                const newValue = currentValue + variable;
                                updateNodeData(selectedNode.id, { notificationTitle: newValue });
                              }}
                              buttonText="Insert Variable"
                              formFields={getFormFieldsFromWorkflow()}
                            />
                          </div>
                          <input
                            type="text"
                            value={selectedNode.data.notificationTitle || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { notificationTitle: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="e.g., New submission from {{formData.fields.name}}"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Notification Message</label>
                            <VariablePicker
                              onInsert={(variable) => {
                                const currentValue = selectedNode.data.notificationMessage || '';
                                const newValue = currentValue + variable;
                                updateNodeData(selectedNode.id, { notificationMessage: newValue });
                              }}
                              buttonText="Insert Variable"
                              formFields={getFormFieldsFromWorkflow()}
                            />
                          </div>
                          <textarea
                            value={selectedNode.data.notificationMessage || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { notificationMessage: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                            placeholder="Enter notification message with {{formData.fields.email}} variables..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'send_slack' && (
                      <>
                        {/* Show Slack connection component if not connected */}
                        {!slackConnected ? (
                          <div className="mb-4">
                            <SlackConnectionButton 
                              onConnectionChange={(connected) => {
                                setSlackConnected(connected);
                                if (connected) {
                                  loadSlackChannels();
                                }
                              }}
                            />
                          </div>
                        ) : (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Slack Channel</label>
                              <div className="space-y-2">
                                {loadingChannels ? (
                                  <div className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-gray-400 text-sm">
                                    Loading channels...
                                  </div>
                                ) : (
                                  <>
                                    <select
                                      value={selectedNode.data.slackChannel || ''}
                                      onChange={(e) => {
                                        e.stopPropagation();
                                        updateNodeData(selectedNode.id, { slackChannel: e.target.value });
                                      }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                                    >
                                      <option value="">Select a channel...</option>
                                      {slackChannels.map((channel) => (
                                        <option key={channel.id} value={channel.id}>
                                          #{channel.name} {channel.is_private ? '🔒' : ''}
                                        </option>
                                      ))}
                                    </select>
                                    <div className="flex items-center justify-between">
                                      <button
                                        type="button"
                                        onClick={loadSlackChannels}
                                        className="text-xs text-[#37bd7e] hover:text-[#2da96a] underline"
                                      >
                                        Refresh channels
                                      </button>
                                      {selectedNode.data.slackChannel && (
                                        <button
                                          type="button"
                                          onClick={async () => {
                                            try {
                                              const success = await slackOAuthService.sendMessage(
                                                userId,
                                                selectedNode.data.slackChannel,
                                                { text: '✅ Test message from Sixty Sales workflow!' }
                                              );
                                              if (success) {
                                                alert('✅ Test message sent successfully!');
                                              }
                                            } catch (error) {
                                              alert(`❌ Test failed: ${error?.message || 'Unknown error'}`);
                                            }
                                          }}
                                          className="text-xs px-2 py-1 bg-[#37bd7e]/10 text-[#37bd7e] rounded hover:bg-[#37bd7e]/20 transition-colors"
                                        >
                                          Test Channel
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                              <h4 className="text-xs font-medium text-green-400 mb-1">✅ Connected to Slack</h4>
                              <p className="text-xs text-gray-400">
                                You can now select any channel from your workspace. The bot will automatically join public channels if needed.
                              </p>
                            </div>
                          </>
                        )}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Message Type</label>
                          <select
                            value={selectedNode.data.slackMessageType || 'simple'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { slackMessageType: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="simple">Simple Message</option>
                            <option value="deal_notification">Deal Notification</option>
                            <option value="task_created">Task Created</option>
                            <option value="custom">Custom Message</option>
                            <option value="blocks">Rich Message (Blocks)</option>
                          </select>
                        </div>
                        
                        {selectedNode.data.slackMessageType === 'simple' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                            <textarea
                              value={selectedNode.data.slackMessage || ''}
                              onChange={(e) => updateNodeData(selectedNode.id, { slackMessage: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="🎉 New deal created: {{deal_name}}"
                              rows={2}
                            />
                            <p className="text-xs text-gray-500 mt-1">Use variables: {{deal_name}}, {{company}}, {{value}}</p>
                          </div>
                        )}
                        
                        {selectedNode.data.slackMessageType === 'custom' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Custom Message</label>
                            <textarea
                              value={selectedNode.data.slackCustomMessage || ''}
                              onChange={(e) => updateNodeData(selectedNode.id, { slackCustomMessage: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="Use {{deal_name}}, {{company}}, {{value}}, {{stage}}"
                              rows={3}
                            />
                          </div>
                        )}

                        {selectedNode.data.slackMessageType === 'blocks' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Slack Blocks JSON</label>
                            <textarea
                              value={selectedNode.data.slackBlocks || ''}
                              onChange={(e) => updateNodeData(selectedNode.id, { slackBlocks: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors font-mono"
                              placeholder={`[
  {
    "type": "section",
    "text": {
      "type": "mrkdwn",
      "text": "🎉 *New deal created:* {{deal_name}}\\n💰 *Value:* \\${{value}}\\n🏢 *Company:* {{company}}"
    }
  }
]`}
                              rows={8}
                            />
                            <div className="mt-2 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                              <h4 className="text-xs font-medium text-blue-400 mb-1">💡 Slack Blocks Tips</h4>
                              <div className="text-xs text-gray-400 space-y-1">
                                <p>• Use JSON format for rich formatting, buttons, and layouts</p>
                                <p>• Variables: {{deal_name}}, {{company}}, {{value}}, {{stage}}, {{owner}}</p>
                                <p>• <a href="https://api.slack.com/block-kit/building" target="_blank" rel="noopener" className="text-blue-400 hover:text-blue-300 underline">Block Kit Builder</a> for visual editing</p>
                              </div>
                            </div>
                            
                            {selectedNode.data.slackBlocks && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    try {
                                      JSON.parse(selectedNode.data.slackBlocks);
                                      alert('✅ Valid JSON format');
                                    } catch (error) {
                                      alert(`❌ Invalid JSON: ${error?.message || 'Unknown error'}`);
                                    }
                                  }}
                                  className="text-xs px-3 py-1 bg-blue-500/10 text-blue-400 rounded hover:bg-blue-500/20 transition-colors"
                                >
                                  Validate JSON
                                </button>
                                {selectedNode.data.slackChannel && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        // Validate JSON first
                                        const blocks = JSON.parse(selectedNode.data.slackBlocks);
                                        
                                        const success = await slackOAuthService.sendMessage(
                                          userId,
                                          selectedNode.data.slackChannel,
                                          { 
                                            text: '🧪 Test blocks message from Sixty Sales workflow!',
                                            blocks: blocks
                                          }
                                        );
                                        if (success) {
                                          alert('✅ Blocks message sent successfully!');
                                        }
                                      } catch (error) {
                                        if (error?.message?.includes('Invalid JSON')) {
                                          alert(`❌ Invalid JSON format: ${error?.message || 'Unknown error'}`);
                                        } else {
                                          alert(`❌ Test failed: ${error?.message || 'Unknown error'}`);
                                        }
                                      }
                                    }}
                                    className="text-xs px-3 py-1 bg-[#37bd7e]/10 text-[#37bd7e] rounded hover:bg-[#37bd7e]/20 transition-colors"
                                  >
                                    Test Blocks
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Mention Users (optional)</label>
                          <input
                            type="text"
                            value={selectedNode.data.slackMentionUsers || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { slackMentionUsers: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="@username1, @username2"
                          />
                          <p className="text-xs text-gray-500 mt-1">Comma-separated Slack user IDs to mention</p>
                        </div>
                        
                        {selectedNode.data.slackMessageType === 'deal_notification' && (
                          <div className="space-y-2">
                            <div className="flex items-center">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedNode.data.slackIncludeDealLink || false}
                                  onChange={(e) => updateNodeData(selectedNode.id, { slackIncludeDealLink: e.target.checked })}
                                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-offset-0 focus:ring-offset-gray-900"
                                />
                                <span className="text-sm text-gray-300">Include Deal Link</span>
                              </label>
                            </div>
                            <div className="flex items-center">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedNode.data.slackIncludeOwner || false}
                                  onChange={(e) => updateNodeData(selectedNode.id, { slackIncludeOwner: e.target.checked })}
                                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-offset-0 focus:ring-offset-gray-900"
                                />
                                <span className="text-sm text-gray-300">Include Deal Owner</span>
                              </label>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {selectedNode.data.type === 'send_email' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Email Template</label>
                          <select
                            value={selectedNode.data.emailTemplate || 'follow_up'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { emailTemplate: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="follow_up">Follow-up</option>
                            <option value="welcome">Welcome</option>
                            <option value="proposal">Proposal</option>
                            <option value="reminder">Reminder</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        {selectedNode.data.emailTemplate === 'custom' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                              <input
                                type="text"
                                value={selectedNode.data.emailSubject || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { emailSubject: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                placeholder="Email subject..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Body</label>
                              <textarea
                                value={selectedNode.data.emailBody || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { emailBody: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                                placeholder="Email body..."
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {selectedNode.data.type === 'update_deal_stage' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">New Stage</label>
                        <select
                          value={selectedNode.data.newStage || 'Opportunity'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateNodeData(selectedNode.id, { newStage: e.target.value });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                        >
                          <option value="SQL">SQL</option>
                          <option value="Opportunity">Opportunity</option>
                          <option value="Verbal">Verbal</option>
                          <option value="Signed">Signed</option>
                        </select>
                      </div>
                    )}

                    {selectedNode.data.type === 'update_field' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Field Name</label>
                          <input
                            type="text"
                            value={selectedNode.data.fieldName || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fieldName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="e.g., priority, status"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">New Value</label>
                          <input
                            type="text"
                            value={selectedNode.data.fieldValue || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fieldValue: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="New value..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'assign_owner' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Assign To</label>
                          <select
                            value={selectedNode.data.assignTo || 'round_robin'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { assignTo: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="round_robin">Round Robin</option>
                            <option value="least_busy">Least Busy</option>
                            <option value="team_lead">Team Lead</option>
                            <option value="specific">Specific User</option>
                          </select>
                        </div>
                        {selectedNode.data.assignTo === 'specific' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Select User</label>
                            <select
                              value={selectedNode.data.specificUserId || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { specificUserId: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="">Select User...</option>
                              {usersLoading ? (
                                <option value="" disabled>Loading users...</option>
                              ) : (
                                users.map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}` 
                                      : user.email}
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {selectedNode.data.type === 'create_activity' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Activity Type</label>
                          <select
                            value={selectedNode.data.activityType || 'note'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { activityType: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="note">Note</option>
                            <option value="call">Call</option>
                            <option value="meeting">Meeting</option>
                            <option value="email">Email</option>
                            <option value="proposal">Proposal</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Activity Note</label>
                          <textarea
                            value={selectedNode.data.activityNote || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { activityNote: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                            placeholder="Activity details..."
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Assign To</label>
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.multipleAssignees || false}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { 
                                    multipleAssignees: e.target.checked,
                                    assignedTo: e.target.checked ? [] : ''
                                  });
                                }}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Multiple Users
                            </label>
                          </div>
                          {selectedNode.data.multipleAssignees ? (
                            <div className="space-y-2">
                              <div className="max-h-32 overflow-y-auto bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                                {usersLoading ? (
                                  <div className="text-gray-400 text-sm">Loading users...</div>
                                ) : (
                                  users.map(user => (
                                    <label key={user.id} className="flex items-center gap-2 py-1 text-sm text-gray-300 hover:bg-gray-700/50 rounded px-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(selectedNode.data.assignedTo || []).includes(user.id)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentAssignees = selectedNode.data.assignedTo || [];
                                          const newAssignees = e.target.checked 
                                            ? [...currentAssignees, user.id]
                                            : currentAssignees.filter((id: string) => id !== user.id);
                                          updateNodeData(selectedNode.id, { assignedTo: newAssignees });
                                        }}
                                        className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                                      />
                                      {user.first_name && user.last_name 
                                        ? `${user.first_name} ${user.last_name}` 
                                        : user.email}
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {((selectedNode.data.assignedTo || []).length || 0)} user(s) selected
                              </p>
                            </div>
                          ) : (
                            <select
                              value={selectedNode.data.assignedTo || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { assignedTo: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="">Select User...</option>
                              {usersLoading ? (
                                <option value="" disabled>Loading users...</option>
                              ) : (
                                users.map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}` 
                                      : user.email}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'create_contact' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Contact Name</label>
                          <input
                            type="text"
                            value={selectedNode.data.contactName || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { contactName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Contact full name..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
                          <input
                            type="email"
                            value={selectedNode.data.contactEmail || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { contactEmail: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="contact@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Phone (optional)</label>
                          <input
                            type="tel"
                            value={selectedNode.data.contactPhone || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { contactPhone: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="+1234567890"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Company (optional)</label>
                          <input
                            type="text"
                            value={selectedNode.data.contactCompany || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { contactCompany: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Company name..."
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Assign To</label>
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.multipleAssignees || false}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { 
                                    multipleAssignees: e.target.checked,
                                    assignedTo: e.target.checked ? [] : ''
                                  });
                                }}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Multiple Users
                            </label>
                          </div>
                          {selectedNode.data.multipleAssignees ? (
                            <div className="space-y-2">
                              <div className="max-h-32 overflow-y-auto bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                                {usersLoading ? (
                                  <div className="text-gray-400 text-sm">Loading users...</div>
                                ) : (
                                  users.map(user => (
                                    <label key={user.id} className="flex items-center gap-2 py-1 text-sm text-gray-300 hover:bg-gray-700/50 rounded px-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(selectedNode.data.assignedTo || []).includes(user.id)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentAssignees = selectedNode.data.assignedTo || [];
                                          const newAssignees = e.target.checked 
                                            ? [...currentAssignees, user.id]
                                            : currentAssignees.filter((id: string) => id !== user.id);
                                          updateNodeData(selectedNode.id, { assignedTo: newAssignees });
                                        }}
                                        className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                                      />
                                      {user.first_name && user.last_name 
                                        ? `${user.first_name} ${user.last_name}` 
                                        : user.email}
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {((selectedNode.data.assignedTo || []).length || 0)} user(s) selected
                              </p>
                            </div>
                          ) : (
                            <select
                              value={selectedNode.data.assignedTo || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { assignedTo: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="">Select User...</option>
                              {usersLoading ? (
                                <option value="" disabled>Loading users...</option>
                              ) : (
                                users.map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}` 
                                      : user.email}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'create_deal' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Deal Name</label>
                          <input
                            type="text"
                            value={selectedNode.data.dealName || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Deal title..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Deal Value</label>
                          <input
                            type="number"
                            value={selectedNode.data.dealValue || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealValue: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="0"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                          <input
                            type="text"
                            value={selectedNode.data.dealCompany || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealCompany: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Company name..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Stage</label>
                          <select
                            value={selectedNode.data.dealStage || 'SQL'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { dealStage: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="SQL">SQL</option>
                            <option value="Opportunity">Opportunity</option>
                            <option value="Verbal">Verbal</option>
                            <option value="Signed">Signed</option>
                          </select>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Assign Owner To</label>
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.multipleOwners || false}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { 
                                    multipleOwners: e.target.checked,
                                    ownerId: e.target.checked ? [] : ''
                                  });
                                }}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Multiple Owners
                            </label>
                          </div>
                          {selectedNode.data.multipleOwners ? (
                            <div className="space-y-2">
                              <div className="max-h-32 overflow-y-auto bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                                {usersLoading ? (
                                  <div className="text-gray-400 text-sm">Loading users...</div>
                                ) : (
                                  users.map(user => (
                                    <label key={user.id} className="flex items-center gap-2 py-1 text-sm text-gray-300 hover:bg-gray-700/50 rounded px-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(selectedNode.data.ownerId || []).includes(user.id)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentOwners = selectedNode.data.ownerId || [];
                                          const newOwners = e.target.checked 
                                            ? [...currentOwners, user.id]
                                            : currentOwners.filter((id: string) => id !== user.id);
                                          updateNodeData(selectedNode.id, { ownerId: newOwners });
                                        }}
                                        className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                                      />
                                      {user.first_name && user.last_name 
                                        ? `${user.first_name} ${user.last_name}` 
                                        : user.email}
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {((selectedNode.data.ownerId || []).length || 0)} owner(s) selected
                              </p>
                            </div>
                          ) : (
                            <select
                              value={selectedNode.data.ownerId || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { ownerId: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="">Select Owner...</option>
                              {usersLoading ? (
                                <option value="" disabled>Loading users...</option>
                              ) : (
                                users.map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}` 
                                      : user.email}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'create_company' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                          <input
                            type="text"
                            value={selectedNode.data.companyName || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { companyName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Company name..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Domain (optional)</label>
                          <input
                            type="url"
                            value={selectedNode.data.companyDomain || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { companyDomain: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="https://company.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Industry (optional)</label>
                          <input
                            type="text"
                            value={selectedNode.data.companyIndustry || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { companyIndustry: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Technology, Healthcare, etc."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Size (optional)</label>
                          <select
                            value={selectedNode.data.companySize || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { companySize: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="">Select size...</option>
                            <option value="1-10">1-10 employees</option>
                            <option value="11-50">11-50 employees</option>
                            <option value="51-200">51-200 employees</option>
                            <option value="201-500">201-500 employees</option>
                            <option value="501-1000">501-1000 employees</option>
                            <option value="1000+">1000+ employees</option>
                          </select>
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Assign Owner To</label>
                            <label className="flex items-center gap-2 text-sm text-gray-400">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.multipleOwners || false}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { 
                                    multipleOwners: e.target.checked,
                                    ownerId: e.target.checked ? [] : ''
                                  });
                                }}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Multiple Owners
                            </label>
                          </div>
                          {selectedNode.data.multipleOwners ? (
                            <div className="space-y-2">
                              <div className="max-h-32 overflow-y-auto bg-gray-800/50 border border-gray-700 rounded-lg p-2">
                                {usersLoading ? (
                                  <div className="text-gray-400 text-sm">Loading users...</div>
                                ) : (
                                  users.map(user => (
                                    <label key={user.id} className="flex items-center gap-2 py-1 text-sm text-gray-300 hover:bg-gray-700/50 rounded px-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={(selectedNode.data.ownerId || []).includes(user.id)}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const currentOwners = selectedNode.data.ownerId || [];
                                          const newOwners = e.target.checked 
                                            ? [...currentOwners, user.id]
                                            : currentOwners.filter((id: string) => id !== user.id);
                                          updateNodeData(selectedNode.id, { ownerId: newOwners });
                                        }}
                                        className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                                      />
                                      {user.first_name && user.last_name 
                                        ? `${user.first_name} ${user.last_name}` 
                                        : user.email}
                                    </label>
                                  ))
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {((selectedNode.data.ownerId || []).length || 0)} owner(s) selected
                              </p>
                            </div>
                          ) : (
                            <select
                              value={selectedNode.data.ownerId || ''}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { ownerId: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="">Select Owner...</option>
                              {usersLoading ? (
                                <option value="" disabled>Loading users...</option>
                              ) : (
                                users.map(user => (
                                  <option key={user.id} value={user.id}>
                                    {user.first_name && user.last_name 
                                      ? `${user.first_name} ${user.last_name}` 
                                      : user.email}
                                  </option>
                                ))
                              )}
                            </select>
                          )}
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'create_meeting' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Title</label>
                          <input
                            type="text"
                            value={selectedNode.data.meetingTitle || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { meetingTitle: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Meeting title..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Scheduled Date/Time</label>
                          <input
                            type="datetime-local"
                            value={selectedNode.data.scheduledFor || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { scheduledFor: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Duration (minutes)</label>
                          <input
                            type="number"
                            value={selectedNode.data.duration || 30}
                            onChange={(e) => updateNodeData(selectedNode.id, { duration: parseInt(e.target.value) || 30 })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            min="5"
                            max="480"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Associated Deal ID (optional)</label>
                          <input
                            type="text"
                            value={selectedNode.data.dealId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Deal ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Contact ID (optional)</label>
                          <input
                            type="text"
                            value={selectedNode.data.contactId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { contactId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Contact ID..."
                          />
                        </div>
                        
                        {/* User Assignment Section */}
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-300">Assign To</label>
                          <label className="flex items-center gap-2 text-sm text-gray-400">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.multipleAssignees || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  multipleAssignees: e.target.checked,
                                  assignedTo: e.target.checked ? [] : ''
                                });
                              }}
                              className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-2"
                            />
                            Multiple Users
                          </label>
                        </div>
                        
                        {selectedNode.data.multipleAssignees ? (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {users?.map((user: any) => (
                              <label key={user.id} className="flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={Array.isArray(selectedNode.data.assignedTo) && selectedNode.data.assignedTo.includes(user.id)}
                                  onChange={(e) => {
                                    const currentAssigned = Array.isArray(selectedNode.data.assignedTo) ? selectedNode.data.assignedTo : [];
                                    const newAssigned = e.target.checked
                                      ? [...currentAssigned, user.id]
                                      : currentAssigned.filter(id => id !== user.id);
                                    updateNodeData(selectedNode.id, { assignedTo: newAssigned });
                                  }}
                                  className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-2"
                                />
                                <span className="text-gray-300">{user.full_name || user.email}</span>
                              </label>
                            )) || (
                              <div className="text-sm text-gray-500">Loading users...</div>
                            )}
                          </div>
                        ) : (
                          <select
                            value={selectedNode.data.assignedTo || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { assignedTo: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="">Select user...</option>
                            {users?.map((user: any) => (
                              <option key={user.id} value={user.id}>
                                {user.full_name || user.email}
                              </option>
                            ))}
                          </select>
                        )}
                      </>
                    )}

                    {selectedNode.data.type === 'update_meeting' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Status</label>
                          <select
                            value={selectedNode.data.meetingStatus || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { meetingStatus: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="">Select status...</option>
                            <option value="scheduled">Scheduled</option>
                            <option value="in_progress">In Progress</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Actual Duration (minutes)</label>
                          <input
                            type="number"
                            value={selectedNode.data.actualDuration || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { actualDuration: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Actual duration..."
                            min="1"
                            max="480"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Notes</label>
                          <textarea
                            value={selectedNode.data.meetingNotes || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { meetingNotes: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                            placeholder="Meeting notes..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Outcome</label>
                          <input
                            type="text"
                            value={selectedNode.data.meetingOutcome || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { meetingOutcome: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Meeting outcome..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'add_meeting_transcript' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Google Docs URL</label>
                          <input
                            type="url"
                            value={selectedNode.data.googleDocsUrl || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { googleDocsUrl: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="https://docs.google.com/document/..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Transcript Text (optional)</label>
                          <textarea
                            value={selectedNode.data.transcriptText || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { transcriptText: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-32"
                            placeholder="Full transcript text (optional if using Google Docs)..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'add_meeting_summary' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Summary</label>
                          <textarea
                            value={selectedNode.data.summary || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { summary: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24"
                            placeholder="Meeting summary..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Key Points</label>
                          <textarea
                            value={Array.isArray(selectedNode.data.keyPoints) ? selectedNode.data.keyPoints.join('\n') : ''}
                            onChange={(e) => {
                              const points = e.target.value.split('\n').filter(p => p.trim());
                              updateNodeData(selectedNode.id, { keyPoints: points });
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                            placeholder="Enter key points (one per line)..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Decisions Made</label>
                          <textarea
                            value={Array.isArray(selectedNode.data.decisions) ? selectedNode.data.decisions.join('\n') : ''}
                            onChange={(e) => {
                              const decisions = e.target.value.split('\n').filter(d => d.trim());
                              updateNodeData(selectedNode.id, { decisions });
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                            placeholder="Enter decisions (one per line)..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'add_coaching_summary' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Coaching Summary</label>
                          <textarea
                            value={selectedNode.data.coachingSummary || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { coachingSummary: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24"
                            placeholder="Coaching feedback and analysis..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Strengths</label>
                          <textarea
                            value={Array.isArray(selectedNode.data.strengths) ? selectedNode.data.strengths.join('\n') : ''}
                            onChange={(e) => {
                              const strengths = e.target.value.split('\n').filter(s => s.trim());
                              updateNodeData(selectedNode.id, { strengths });
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16"
                            placeholder="Enter strengths (one per line)..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Improvement Areas</label>
                          <textarea
                            value={Array.isArray(selectedNode.data.improvementAreas) ? selectedNode.data.improvementAreas.join('\n') : ''}
                            onChange={(e) => {
                              const areas = e.target.value.split('\n').filter(a => a.trim());
                              updateNodeData(selectedNode.id, { improvementAreas: areas });
                            }}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16"
                            placeholder="Enter improvement areas (one per line)..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Additional Coaching Notes</label>
                          <textarea
                            value={selectedNode.data.coachingNotes || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { coachingNotes: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16"
                            placeholder="Additional coaching notes..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'add_coaching_rating' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Overall Rating (1-10)</label>
                          <input
                            type="number"
                            value={selectedNode.data.overallRating || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { overallRating: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Overall rating..."
                            min="1"
                            max="10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Communication Rating (1-10)</label>
                          <input
                            type="number"
                            value={selectedNode.data.communicationRating || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { communicationRating: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Communication rating..."
                            min="1"
                            max="10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Product Knowledge Rating (1-10)</label>
                          <input
                            type="number"
                            value={selectedNode.data.knowledgeRating || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { knowledgeRating: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Knowledge rating..."
                            min="1"
                            max="10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Closing Skills Rating (1-10)</label>
                          <input
                            type="number"
                            value={selectedNode.data.closingRating || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { closingRating: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Closing rating..."
                            min="1"
                            max="10"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Rating Notes</label>
                          <textarea
                            value={selectedNode.data.ratingNotes || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { ratingNotes: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16"
                            placeholder="Notes explaining the ratings..."
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'add_talk_time_percentage' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Sales Rep Talk Time (%)</label>
                          <input
                            type="number"
                            value={selectedNode.data.salesRepTalkTime || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { salesRepTalkTime: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Sales rep talk time percentage..."
                            min="0"
                            max="100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Prospect Talk Time (%)</label>
                          <input
                            type="number"
                            value={selectedNode.data.prospectTalkTime || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { prospectTalkTime: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Prospect talk time percentage..."
                            min="0"
                            max="100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Talk Time Analysis</label>
                          <textarea
                            value={selectedNode.data.talkTimeAnalysis || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { talkTimeAnalysis: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16"
                            placeholder="Analysis of talk time distribution..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Talk Time Recommendations</label>
                          <textarea
                            value={selectedNode.data.talkTimeRecommendations || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { talkTimeRecommendations: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16"
                            placeholder="Recommendations for improvement..."
                          />
                        </div>
                      </>
                    )}

                    {(selectedNode.data.type === 'add_meeting_tasks' || selectedNode.data.type === 'add_meeting_next_steps') && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Fathom Meeting ID</label>
                          <input
                            type="text"
                            value={selectedNode.data.fathomMeetingId || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { fathomMeetingId: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Fathom meeting ID..."
                          />
                        </div>
                        
                        {selectedNode.data.type === 'add_meeting_tasks' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Tasks</label>
                            <textarea
                              value={Array.isArray(selectedNode.data.tasks) ? 
                                selectedNode.data.tasks.map(t => typeof t === 'string' ? t : t.title || '').join('\n') : ''}
                              onChange={(e) => {
                                const taskLines = e.target.value.split('\n').filter(t => t.trim());
                                const tasks = taskLines.map(title => ({ title, assignee: '', due_date: '', priority: 'medium' }));
                                updateNodeData(selectedNode.id, { tasks });
                              }}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24"
                              placeholder="Enter tasks discussed in meeting (one per line)..."
                            />
                          </div>
                        )}
                        
                        {selectedNode.data.type === 'add_meeting_next_steps' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Next Steps</label>
                              <textarea
                                value={Array.isArray(selectedNode.data.nextSteps) ? 
                                  selectedNode.data.nextSteps.map(s => typeof s === 'string' ? s : s.description || '').join('\n') : ''}
                                onChange={(e) => {
                                  const stepLines = e.target.value.split('\n').filter(s => s.trim());
                                  const nextSteps = stepLines.map(description => ({ description, owner: '' }));
                                  updateNodeData(selectedNode.id, { nextSteps });
                                }}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24"
                                placeholder="Enter next steps (one per line)..."
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Follow-up Date</label>
                              <input
                                type="date"
                                value={selectedNode.data.followUpDate || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { followUpDate: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                              />
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {selectedNode.data.type === 'multi_action' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Actions to Execute</label>
                          <div className="space-y-2">
                            {(selectedNode.data.actions || []).map((action: any, index: number) => (
                              <div key={index} className="flex items-center gap-2">
                                <select
                                  value={action.type || 'create_task'}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    const newActions = [...(selectedNode.data.actions || [])];
                                    newActions[index] = { ...newActions[index], type: e.target.value };
                                    updateNodeData(selectedNode.id, { actions: newActions });
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                                >
                                  <option value="create_task">Create Task</option>
                                  <option value="send_notification">Send Notification</option>
                                  <option value="send_slack">Send Slack Message</option>
                                  <option value="send_email">Send Email</option>
                                  <option value="update_fields">Update Fields</option>
                                  <option value="assign_owner">Assign Owner</option>
                                  <option value="create_activity">Create Activity</option>
                                  <option value="create_contact">Create Contact</option>
                                  <option value="create_deal">Create Deal</option>
                                  <option value="create_company">Create Company</option>
                                  <option value="update_deal_stage">Update Stage</option>
                                </select>
                                <button
                                  onClick={() => {
                                    const newActions = (selectedNode.data.actions || []).filter((_: any, i: number) => i !== index);
                                    updateNodeData(selectedNode.id, { actions: newActions });
                                  }}
                                  className="p-2 bg-red-600/20 hover:bg-red-600/30 border border-red-600/30 rounded-lg text-red-400 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              const newActions = [...(selectedNode.data.actions || []), { type: 'create_task' }];
                              updateNodeData(selectedNode.id, { actions: newActions });
                            }}
                            className="mt-2 w-full px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded-lg text-green-400 text-sm transition-colors"
                          >
                            + Add Action
                          </button>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Execution Mode</label>
                          <select
                            value={selectedNode.data.executionMode || 'sequential'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { executionMode: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="sequential">Sequential (one after another)</option>
                            <option value="parallel">Parallel (all at once)</option>
                          </select>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Trigger-specific settings */}
                {selectedNode.type === 'trigger' && (
                  <>
                    {/* Display trigger type (read-only) */}
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <p className="text-xs text-gray-400 mb-1">Trigger Type</p>
                      <p className="text-white font-medium capitalize">
                        {selectedNode.data.type?.replace(/_/g, ' ') || 'Not Set'}
                      </p>
                    </div>

                    {/* Stage selection for stage_changed trigger */}
                    {selectedNode.data.type === 'stage_changed' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Stage</label>
                        <select
                          value={selectedNode.data.stage || 'any'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateNodeData(selectedNode.id, { stage: e.target.value });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                        >
                          <option value="any">Any Stage Change</option>
                          <option value="SQL">To SQL</option>
                          <option value="Opportunity">To Opportunity</option>
                          <option value="Verbal">To Verbal</option>
                          <option value="Signed">To Signed</option>
                        </select>
                      </div>
                    )}

                    {/* Activity type for activity_created trigger */}
                    {selectedNode.data.type === 'activity_created' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Activity Type</label>
                        <select
                          value={selectedNode.data.activityType || 'any'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateNodeData(selectedNode.id, { activityType: e.target.value });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                        >
                          <option value="any">Any Activity</option>
                          <option value="meeting">Meeting</option>
                          <option value="call">Call</option>
                          <option value="email">Email</option>
                          <option value="proposal">Proposal</option>
                        </select>
                      </div>
                    )}

                    {/* Schedule frequency for scheduled trigger */}
                    {selectedNode.data.type === 'scheduled' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Frequency</label>
                        <select
                          value={selectedNode.data.frequency || 'daily'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateNodeData(selectedNode.id, { frequency: e.target.value });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                        >
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </select>
                      </div>
                    )}

                    {/* Days inactive for no_activity trigger */}
                    {selectedNode.data.type === 'no_activity' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Days Inactive</label>
                        <input
                          type="number"
                          value={selectedNode.data.daysInactive || 7}
                          onChange={(e) => updateNodeData(selectedNode.id, { daysInactive: parseInt(e.target.value) })}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          placeholder="Number of days..."
                          min="1"
                        />
                      </div>
                    )}

                    {/* Time-based trigger settings */}
                    {selectedNode.data.type === 'time_based' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Time Period</label>
                          <select
                            value={selectedNode.data.timePeriod || 'after_deal_created'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { timePeriod: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="after_deal_created">After Deal Created</option>
                            <option value="after_stage_change">After Stage Change</option>
                            <option value="after_last_activity">After Last Activity</option>
                            <option value="before_close_date">Before Expected Close Date</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Time Amount</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={selectedNode.data.timeAmount || 3}
                              onChange={(e) => updateNodeData(selectedNode.id, { timeAmount: parseInt(e.target.value) })}
                              className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="Number..."
                              min="1"
                            />
                            <select
                              value={selectedNode.data.timeUnit || 'days'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { timeUnit: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="hours">Hours</option>
                              <option value="days">Days</option>
                              <option value="weeks">Weeks</option>
                              <option value="months">Months</option>
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Manual trigger settings */}
                    {selectedNode.data.type === 'manual' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Trigger Name</label>
                        <input
                          type="text"
                          value={selectedNode.data.triggerName || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, { triggerName: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                          placeholder="e.g., Send Follow-up"
                        />
                        <p className="text-xs text-gray-500 mt-1">This workflow will only run when manually triggered</p>
                      </div>
                    )}

                    {/* Webhook Received Trigger */}
                    {selectedNode.data.type === 'webhook_received' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Webhook URL</label>
                          <div className="p-2 bg-gray-900/50 border border-gray-700 rounded-lg">
                            <code className="text-xs text-green-400 break-all">
                              {`${window.location.origin}/api/webhooks/${selectedNode.id}`}
                            </code>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">POST data to this URL to trigger the workflow</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Authentication</label>
                          <input
                            type="text"
                            value={selectedNode.data.webhookSecret || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookSecret: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Optional secret key..."
                          />
                        </div>
                      </>
                    )}

                    {/* Task Overdue Trigger */}
                    {selectedNode.data.type === 'task_overdue' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Check Frequency</label>
                        <select
                          value={selectedNode.data.checkFrequency || 'hourly'}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateNodeData(selectedNode.id, { checkFrequency: e.target.value });
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                        >
                          <option value="every_15_min">Every 15 minutes</option>
                          <option value="every_30_min">Every 30 minutes</option>
                          <option value="hourly">Hourly</option>
                          <option value="daily">Daily</option>
                        </select>
                      </div>
                    )}

                    {/* Activity Monitor Trigger */}
                    {selectedNode.data.type === 'activity_monitor' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Monitor Type</label>
                          <select
                            value={selectedNode.data.monitorType || 'low_activity'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { monitorType: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="low_activity">Low Activity (Less than X activities)</option>
                            <option value="no_activity">No Activity (Zero activities)</option>
                            <option value="high_activity">High Activity (More than X activities)</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Activity Types to Monitor</label>
                          <div className="space-y-2">
                            {['outbound', 'meeting', 'proposal', 'email', 'call', 'task', 'note'].map((activityType) => (
                              <label key={activityType} className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={selectedNode.data.monitoredActivityTypes?.includes(activityType) || false}
                                  onChange={(e) => {
                                    const currentTypes = selectedNode.data.monitoredActivityTypes || [];
                                    const newTypes = e.target.checked
                                      ? [...currentTypes, activityType]
                                      : currentTypes.filter(t => t !== activityType);
                                    updateNodeData(selectedNode.id, { monitoredActivityTypes: newTypes });
                                  }}
                                  className="w-4 h-4 text-[#37bd7e] bg-gray-800 border-gray-600 rounded focus:ring-[#37bd7e] focus:ring-offset-0"
                                />
                                <span className="text-sm text-gray-300 capitalize">{activityType}</span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Leave unchecked to monitor all activity types</p>
                        </div>

                        {selectedNode.data.monitorType !== 'no_activity' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              {selectedNode.data.monitorType === 'low_activity' ? 'Maximum Activities' : 'Minimum Activities'}
                            </label>
                            <input
                              type="number"
                              value={selectedNode.data.activityThreshold || 3}
                              onChange={(e) => updateNodeData(selectedNode.id, { activityThreshold: parseInt(e.target.value) })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="Number of activities..."
                              min="1"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Time Period (Days)</label>
                          <input
                            type="number"
                            value={selectedNode.data.monitorDays || 7}
                            onChange={(e) => updateNodeData(selectedNode.id, { monitorDays: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Number of days..."
                            min="1"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Check Time</label>
                          <input
                            type="time"
                            value={selectedNode.data.checkTime || '09:00'}
                            onChange={(e) => updateNodeData(selectedNode.id, { checkTime: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          />
                          <p className="text-xs text-gray-500 mt-1">Daily check at this time</p>
                        </div>
                      </>
                    )}

                    {/* Task completed trigger settings */}
                    {selectedNode.data.type === 'task_completed' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Task Type</label>
                          <select
                            value={selectedNode.data.taskType || 'any'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { taskType: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="any">Any Task</option>
                            <option value="follow_up">Follow-up</option>
                            <option value="call">Call</option>
                            <option value="meeting">Meeting</option>
                            <option value="proposal">Proposal</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        {selectedNode.data.taskType === 'custom' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Task Name Contains</label>
                            <input
                              type="text"
                              value={selectedNode.data.taskNameFilter || ''}
                              onChange={(e) => updateNodeData(selectedNode.id, { taskNameFilter: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              placeholder="e.g., Follow-up"
                            />
                          </div>
                        )}
                      </>
                    )}

                    {/* Deal created trigger settings */}
                    {selectedNode.data.type === 'deal_created' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Deal Stage</label>
                          <select
                            value={selectedNode.data.dealStage || 'any'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { dealStage: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="any">Any Stage</option>
                            <option value="SQL">SQL</option>
                            <option value="Opportunity">Opportunity</option>
                            <option value="Verbal">Verbal</option>
                            <option value="Signed">Signed</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Deal Value</label>
                          <div className="flex gap-2">
                            <select
                              value={selectedNode.data.dealValueOperator || 'any'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { dealValueOperator: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="any">Any Value</option>
                              <option value=">">Greater than</option>
                              <option value="<">Less than</option>
                              <option value=">=">Greater or equal</option>
                              <option value="<=">Less or equal</option>
                            </select>
                            {selectedNode.data.dealValueOperator !== 'any' && (
                              <input
                                type="number"
                                value={selectedNode.data.dealValueAmount || 10000}
                                onChange={(e) => updateNodeData(selectedNode.id, { dealValueAmount: parseInt(e.target.value) })}
                                className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                                placeholder="Amount..."
                                min="0"
                              />
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Router-specific settings */}
                {selectedNode.type === 'router' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Router Type</label>
                      <select
                        value={selectedNode.data.routerType || 'stage'}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, { routerType: e.target.value });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                      >
                        <option value="stage">Route by Stage</option>
                        <option value="value">Route by Deal Value</option>
                        <option value="priority">Route by Priority</option>
                        <option value="owner">Route by Owner</option>
                      </select>
                    </div>

                    {selectedNode.data.routerType === 'stage' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Stage Routes</label>
                        <div className="space-y-2">
                          {['SQL', 'Opportunity', 'Verbal', 'Signed'].map((stage) => (
                            <div key={stage} className="flex items-center gap-2">
                              <span className="text-sm text-gray-300 w-24">{stage}:</span>
                              <select
                                value={selectedNode.data[`route_${stage}`] || 'continue'}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { [`route_${stage}`]: e.target.value });
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                              >
                                <option value="continue">Continue Flow</option>
                                <option value="action1">Action Path 1</option>
                                <option value="action2">Action Path 2</option>
                                <option value="action3">Action Path 3</option>
                                <option value="stop">Stop Workflow</option>
                              </select>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Connect different actions to each route</p>
                      </div>
                    )}

                    {selectedNode.data.routerType === 'value' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Value Ranges</label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-24">Low (&lt;10k):</span>
                            <select
                              value={selectedNode.data.route_low || 'continue'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { route_low: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="continue">Continue Flow</option>
                              <option value="action1">Action Path 1</option>
                              <option value="action2">Action Path 2</option>
                              <option value="stop">Stop Workflow</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-24">Med (10-50k):</span>
                            <select
                              value={selectedNode.data.route_medium || 'continue'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { route_medium: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="continue">Continue Flow</option>
                              <option value="action1">Action Path 1</option>
                              <option value="action2">Action Path 2</option>
                              <option value="stop">Stop Workflow</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-24">High (&gt;50k):</span>
                            <select
                              value={selectedNode.data.route_high || 'continue'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { route_high: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="continue">Continue Flow</option>
                              <option value="action1">Action Path 1</option>
                              <option value="action2">Action Path 2</option>
                              <option value="stop">Stop Workflow</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedNode.data.routerType === 'priority' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Priority Routes</label>
                        <div className="space-y-2">
                          {['Low', 'Medium', 'High'].map((priority) => (
                            <div key={priority} className="flex items-center gap-2">
                              <span className="text-sm text-gray-300 w-24">{priority}:</span>
                              <select
                                value={selectedNode.data[`route_${priority.toLowerCase()}`] || 'continue'}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { [`route_${priority.toLowerCase()}`]: e.target.value });
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                              >
                                <option value="continue">Continue Flow</option>
                                <option value="urgent">Urgent Path</option>
                                <option value="normal">Normal Path</option>
                                <option value="defer">Defer Path</option>
                                <option value="stop">Stop Workflow</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedNode.data.routerType === 'owner' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Owner Routes</label>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-24">Me:</span>
                            <select
                              value={selectedNode.data.route_me || 'continue'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { route_me: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="continue">Continue Flow</option>
                              <option value="personal">Personal Action</option>
                              <option value="delegate">Delegate Action</option>
                              <option value="stop">Stop Workflow</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-24">Team:</span>
                            <select
                              value={selectedNode.data.route_team || 'continue'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { route_team: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="continue">Continue Flow</option>
                              <option value="team">Team Action</option>
                              <option value="manager">Manager Action</option>
                              <option value="stop">Stop Workflow</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-24">Unassigned:</span>
                            <select
                              value={selectedNode.data.route_unassigned || 'continue'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { route_unassigned: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="continue">Continue Flow</option>
                              <option value="assign">Auto-Assign</option>
                              <option value="alert">Alert Manager</option>
                              <option value="stop">Stop Workflow</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-800">
                <button
                  onClick={deleteSelectedNode}
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Delete Node
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
    
    {/* Workflow Save Modal */}
    <WorkflowSaveModal
      isOpen={showSaveModal}
      onClose={() => setShowSaveModal(false)}
      onSave={handleModalSave}
      suggestedName={suggestedName}
      suggestedDescription={suggestedDescription}
      isFirstSave={isFirstSave}
    />
    
    {/* AI Agent Configuration Modal */}
    <AIAgentConfigModal
      isOpen={showAIConfigModal}
      onClose={() => {
        setShowAIConfigModal(false);
        setSelectedAINode(null);
      }}
      config={selectedAINode?.data?.config}
      onSave={handleAIConfigSave}
      availableVariables={['deal.value', 'deal.stage', 'contact.name', 'contact.email', 'activity.type', 'task.title']}
      formFields={getFormFieldsFromWorkflow()}
    />
    
    {/* Form Configuration Modal */}
    {showFormConfigModal && selectedFormNode && (
      <FormConfigModal
        isOpen={showFormConfigModal}
        onClose={() => {
          setShowFormConfigModal(false);
          setSelectedFormNode(null);
        }}
        nodeData={selectedFormNode.data || { config: {} }}
        onSave={(config) => {
          if (selectedFormNode) {
            updateNodeData(selectedFormNode.id, { config });
          }
        }}
        onPreview={() => {
          setShowFormConfigModal(false);
          setShowFormPreview(true);
        }}
        workflowId={workflowId || undefined}
      />
    )}
    
    {/* Form Preview Modal */}
    {showFormPreview && selectedFormNode?.data?.config && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <FormPreview
          formTitle={selectedFormNode.data.config.formTitle}
          formDescription={selectedFormNode.data.config.formDescription}
          submitButtonText={selectedFormNode.data.config.submitButtonText}
          fields={selectedFormNode.data.config.fields || []}
          onClose={() => setShowFormPreview(false)}
          showVariables={true}
        />
      </div>
    )}
    
    
    {/* Workflow Test Mode Modal */}
    {showWorkflowTestMode && (
      <WorkflowTestMode
        workflowId={selectedWorkflow?.id || crypto.randomUUID()}
        workflowName={workflowName || 'Untitled Workflow'}
        formUrls={(() => {
          // Get form URLs from form nodes
          const formNodes = nodes.filter(n => n.type === 'form');
          if (formNodes.length > 0 && formNodes[0].data?.config) {
            return {
              test: formNodes[0].data.config.testUrl,
              production: formNodes[0].data.config.productionUrl
            };
          }
          return undefined;
        })()}
        onClose={() => setShowWorkflowTestMode(false)}
        onExecutionSelect={(executionId) => {
          setCurrentExecutionId(executionId);
          // Executions now viewed in Jobs tab
        }}
      />
    )}

    {/* Node Execution Details Modal - Make.com style */}
    {showExecutionModal && selectedExecutionNode && (
      <NodeExecutionModal
        isOpen={showExecutionModal}
        onClose={() => {
          setShowExecutionModal(false);
          setSelectedExecutionNode(null);
        }}
        nodeData={selectedExecutionNode.data}
        executionData={selectedExecutionNode.data?.executionData}
        nodeName={selectedExecutionNode.data?.label || selectedExecutionNode.type || 'Unknown Node'}
        nodeType={selectedExecutionNode.type || 'Node'}
      />
    )}


    {/* Live Monitor Modal */}
    {showLiveMonitor && (
      <LiveMonitorModal
        isOpen={showLiveMonitor}
        onClose={() => setShowLiveMonitor(false)}
        workflowId={workflowId}
        workflowName={workflowName || 'Untitled Workflow'}
      />
    )}
    </>
  );
};

// Wrap with ReactFlowProvider
const WorkflowCanvasWrapper: React.FC<WorkflowCanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowCanvas {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowCanvasWrapper;