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
  FlaskConical,
  GitMerge,
  Bot
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
import CustomGPTNode from './nodes/CustomGPTNode';
import CustomGPTConfigModal from './CustomGPTConfigModal';
import type { CustomGPTNodeConfig } from './CustomGPTConfigModal';
import AssistantManagerNode from './nodes/AssistantManagerNode';
import AssistantManagerConfigModal from './AssistantManagerConfigModal';
import type { AssistantManagerNodeConfig } from './AssistantManagerConfigModal';
import FormNode from './nodes/FormNode';
import GoogleEmailNode from './nodes/GoogleEmailNode';
import GoogleDocsNode from './nodes/GoogleDocsNode';
import FathomWebhookNode from './nodes/FathomWebhookNode';
import ConditionalBranchNode from './nodes/ConditionalBranchNode';
import GoogleDocsCreatorNode from './nodes/GoogleDocsCreatorNode';
import MeetingUpsertNode from './nodes/MeetingUpsertNode';
import ActionItemProcessorNode from './nodes/ActionItemProcessorNode';
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

import { TriggerNode } from './nodes/standard/TriggerNode';
import { ConditionNode } from './nodes/standard/ConditionNode';
import { ActionNode } from './nodes/standard/ActionNode';
import { RouterNode } from './nodes/standard/RouterNode';
import { iconMap } from './utils';
import { WorkflowNodeLibrary } from './components/WorkflowNodeLibrary';
import { LocalTestPanel } from './components/LocalTestPanel';
import { createWorkflowNode, calculateNodePosition } from './utils/nodeFactory';
import { nodeRegistry } from './utils/nodeRegistry';

// Base node types
const baseNodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  router: RouterNode,
  aiAgent: AIAgentNode,
  customGPT: CustomGPTNode,
  assistantManager: AssistantManagerNode,
  form: FormNode,
  googleEmail: GoogleEmailNode,
  googleDocs: GoogleDocsNode,
  fathomWebhook: FathomWebhookNode,
  conditionalBranch: ConditionalBranchNode,
  googleDocsCreator: GoogleDocsCreatorNode,
  meetingUpsert: MeetingUpsertNode,
  actionItemProcessor: ActionItemProcessorNode
};

// Merge with registered custom nodes
const nodeTypes: NodeTypes = {
  ...baseNodeTypes,
  ...nodeRegistry.getNodeTypes()
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
  const [nodes, setNodes, onNodesChangeBase] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showNodePanel, setShowNodePanel] = useState(true);
  
  // Track if user has manually moved nodes or tidied them
  const [userHasInteracted, setUserHasInteracted] = useState(false);
  const [hasTidied, setHasTidied] = useState(false);
  
  // Custom onNodesChange to track user interactions
  const onNodesChange = useCallback((changes: any) => {
    // Check if user is dragging nodes (position changes)
    const hasPositionChange = changes.some((change: any) => 
      change.type === 'position' && change.dragging === false
    );
    
    if (hasPositionChange) {
      setUserHasInteracted(true);
    }
    
    // Call the base handler
    onNodesChangeBase(changes);
  }, [onNodesChangeBase]);
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
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackChannels, setSlackChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const reactFlowInstance = useRef<any>(null);
  const [showAIConfigModal, setShowAIConfigModal] = useState(false);
  const [selectedAINode, setSelectedAINode] = useState<Node | null>(null);
  const [showCustomGPTConfigModal, setShowCustomGPTConfigModal] = useState(false);
  const [selectedCustomGPTNode, setSelectedCustomGPTNode] = useState<Node | null>(null);
  const [showAssistantManagerConfigModal, setShowAssistantManagerConfigModal] = useState(false);
  const [selectedAssistantManagerNode, setSelectedAssistantManagerNode] = useState<Node | null>(null);
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
        
        // Check if positions look like they've been tidied (aligned coordinates)
        const isTidied = hasTidied || nodesData.some(node => 
          node.position && 
          (node.position.x % 100 === 0 || node.position.x % 400 === 0) && 
          (node.position.y % 100 === 0 || node.position.y % 250 === 0)
        );
        
        // Only apply automatic positioning if the layout isn't already tidy or user has manually tidied or moved nodes
        const shouldAutoPosition = !isTidied && !hasTidied && !userHasInteracted && nodesData.length > 0;
        
        // Fix AI Agent positioning to be after Google Docs Creator in the transcript branch
        // Only adjust positions if nodes seem to be in wrong places AND not tidied
        const hasAIAgent = nodesData.some(n => n.type === 'aiAgent');
        const hasGoogleDocs = nodesData.some(n => n.type === 'googleDocsCreator');
        
        if (shouldAutoPosition && hasAIAgent && hasGoogleDocs) {
          // Find the Google Docs node to use as reference
          const googleDocsNode = nodesData.find(n => n.type === 'googleDocsCreator');
          const aiAgentNode = nodesData.find(n => n.type === 'aiAgent');
          
          if (googleDocsNode && aiAgentNode) {
            // Only fix if AI Agent is not already to the right of Google Docs
            if (aiAgentNode.position.x <= googleDocsNode.position.x) {
              nodesData = nodesData.map(node => {
                // Position AI Agent to the right of Google Docs Creator
                if (node.type === 'aiAgent') {
                  return {
                    ...node,
                    position: { 
                      x: googleDocsNode.position.x + 250, 
                      y: googleDocsNode.position.y 
                    }
                  };
                }
                return node;
              });
            }
          }
        }
        
        // Only apply comprehensive positioning if not tidied
        if (shouldAutoPosition) {
          // Comprehensive node positioning for clean layout
          const webhookNode = nodesData.find(n => n.type === 'fathomWebhook');
          const branchNode = nodesData.find(n => n.type === 'conditionalBranch');
          
          if (branchNode) {
          const baseX = 100;  // Starting X position
          const branchX = 350;  // Branch X position
          const nodeDistance = 300; // Distance between columns
          
          nodesData = nodesData.map(node => {
            // Webhook node - leftmost
            if (node.type === 'fathomWebhook') {
              return {
                ...node,
                position: { x: baseX, y: 200 }
              };
            }
            // Branch node - second column
            else if (node.type === 'conditionalBranch') {
              // Also fix the branch order in the data
              const updatedNode = {
                ...node,
                position: { x: branchX, y: 200 }
              };
              
              // Ensure branches are in correct order: Transcript (1), Summary (2), Actions (3)
              if (node.data?.branches) {
                updatedNode.data = {
                  ...node.data,
                  branches: [
                    { id: 'transcript', label: 'Transcript', condition: 'payload.topic === "transcript" || payload.transcript' },
                    { id: 'summary', label: 'Summary', condition: 'payload.topic === "summary" || payload.ai_summary' },
                    { id: 'action_items', label: 'Action Items', condition: 'payload.topic === "action_items" || payload.action_item' }
                  ]
                };
              }
              
              return updatedNode;
            }
            // Google Docs Creator - Transcript branch (top - position 1)
            else if (node.type === 'googleDocsCreator') {
              return {
                ...node,
                position: { x: branchX + nodeDistance, y: 100 }
              };
            }
            // Process Summary - Summary branch (middle - position 2)
            else if (node.type === 'meetingUpsert' && (node.data?.label === 'Process Summary' || node.data?.table === 'meetings')) {
              // Check if this is the summary processor (not the transcript update)
              if (!node.data?.label?.includes('Update') && !node.data?.label?.includes('Upsert Meeting')) {
                return {
                  ...node,
                  position: { x: branchX + nodeDistance, y: 200 }
                };
              }
            }
            // Action Item Processor - Action Items branch (bottom - position 3)
            else if (node.type === 'actionItemProcessor' || (node.type === 'action' && node.data?.label?.includes('Process Actions'))) {
              return {
                ...node,
                position: { x: branchX + nodeDistance, y: 350 }
              };
            }
            // AI Agent - after Google Docs
            else if (node.type === 'aiAgent') {
              return {
                ...node,
                position: { x: branchX + nodeDistance + 250, y: 100 }
              };
            }
            // Upsert Meeting - after AI Agent
            else if (node.type === 'meetingUpsert' && (node.data?.label === 'Upsert Meeting' || node.data?.label?.includes('Update'))) {
              return {
                ...node,
                position: { x: branchX + nodeDistance + 500, y: 100 }
              };
            }
            // Create Tasks - right side
            else if (node.type === 'taskCreator' || (node.type === 'action' && node.data?.label?.includes('Create Tasks'))) {
              return {
                ...node,
                position: { x: branchX + nodeDistance + 250, y: 350 }
              };
            }
            // Send Notifications - bottom right
            else if (node.type === 'notification' || (node.type === 'action' && node.data?.label?.includes('Send Notifications'))) {
              return {
                ...node,
                position: { x: branchX + nodeDistance, y: 450 }
              };
            }
            
            return node;
          });
          } // End of branchNode check
        } // End of shouldAutoPosition check
        
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
        
        // Clean up edges - remove unnecessary labels
        let edgesData = selectedWorkflow.canvas_data.edges || [];
        edgesData = edgesData.map(edge => {
          // Remove "Payload" label from webhook to branch connection
          if ((edge.source === 'webhook-trigger' || edge.source?.includes('webhook')) && 
              (edge.target === 'payload-router' || edge.target?.includes('router') || edge.target?.includes('branch'))) {
            return {
              ...edge,
              label: undefined,  // Remove any label
              data: {
                ...edge.data,
                label: undefined
              }
            };
          }
          return edge;
        });
        
        setNodes(nodesData);
        setEdges(edgesData);
        
        // Auto-fit view after loading workflow with a slight delay
        // Commented out to prevent auto-repositioning when loading workflow
        // setTimeout(() => {
        //   if (reactFlowInstance.current && nodesData.length > 0) {
        //     reactFlowInstance.current.fitView({ 
        //       padding: 0.15,
        //       duration: 500,
        //       maxZoom: 1.0,
        //       minZoom: 0.5
        //     });
        //   }
        // }, 100);
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
    }
  };

  const loadSlackChannels = async () => {
    if (!userId) return;
    
    setLoadingChannels(true);
    try {
      const channels = await slackOAuthService.getChannels(userId);
      setSlackChannels(channels);
    } catch (error) {
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
    } catch (error) {
    } finally {
      setIsAutoSaving(false);
    }
  };
  
  const onConnect = useCallback(
    (params: Edge | Connection) => {
      // Find the source and target nodes
      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);
      
      // For Multiple Actions node in sequential mode, check if it already has a connection
      if (sourceNode?.data.type === 'multi_action' && sourceNode?.data.executionMode === 'sequential') {
        const existingConnections = edges.filter(e => e.source === params.source);
        if (existingConnections.length > 0) {
          // In sequential mode, only allow one outgoing connection from Multiple Actions
          alert('Sequential mode only allows one outgoing connection. Change to parallel mode for multiple connections.');
          return;
        }
      }
      
      // For Join Actions node, check if source already has an outgoing connection
      if (sourceNode?.data.type === 'join_actions') {
        const existingOutgoing = edges.filter(e => e.source === params.source);
        if (existingOutgoing.length > 0) {
          alert('Join Actions node can only have one outgoing connection to continue the flow.');
          return;
        }
      }
      
      // Style the edge based on node types
      let edgeStyle = { stroke: '#37bd7e', strokeWidth: 2 };
      let animated = false;
      
      if (sourceNode?.data.type === 'multi_action') {
        edgeStyle = { stroke: '#9333ea', strokeWidth: 2 };
        animated = true;
      } else if (targetNode?.data.type === 'join_actions') {
        edgeStyle = { stroke: '#14b8a6', strokeWidth: 2 };
        animated = true;
      }
      
      // Allow the connection
      setEdges((eds) => addEdge({
        ...params,
        animated,
        style: edgeStyle
      }, eds));
    },
    [setEdges, nodes, edges]
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
      } else if (node.type === 'customGPT') {
        setSelectedCustomGPTNode(node);
        setShowCustomGPTConfigModal(true);
      } else if (node.type === 'assistantManager') {
        setSelectedAssistantManagerNode(node);
        setShowAssistantManagerConfigModal(true);
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

  const onEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (executionMode) return; // Don't allow edge editing in execution mode
      
      setSelectedEdge(edge);
      setSelectedNode(null); // Clear node selection
      setShowNodeEditor(true); // Reuse the editor panel for edges
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
    
    // Mark workflow as modified to trigger autosave when node data changes
    setHasUnsavedChanges(true);
  };

  // Update edge data when edited
  const updateEdgeData = (edgeId: string, newData: any) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.id === edgeId) {
          const updatedEdge = { ...edge, ...newData };
          // Also update selectedEdge if it's the one being edited
          if (selectedEdge && selectedEdge.id === edgeId) {
            setSelectedEdge(updatedEdge);
          }
          return updatedEdge;
        }
        return edge;
      })
    );
  };

  // Get available variables from previous nodes in the workflow
  const getAvailableVariables = (currentNodeId: string): { label: string; value: string; source: string }[] => {
    const variables: { label: string; value: string; source: string }[] = [];
    
    // Find all nodes that come before the current node
    const getPreviousNodes = (nodeId: string, visited = new Set<string>()): string[] => {
      if (visited.has(nodeId)) return [];
      visited.add(nodeId);
      
      const incomingEdges = edges.filter(e => e.target === nodeId);
      const previousNodeIds: string[] = [];
      
      for (const edge of incomingEdges) {
        previousNodeIds.push(edge.source);
        previousNodeIds.push(...getPreviousNodes(edge.source, visited));
      }
      
      return [...new Set(previousNodeIds)];
    };
    
    const previousNodeIds = getPreviousNodes(currentNodeId);
    const previousNodes = nodes.filter(n => previousNodeIds.includes(n.id));
    
    // Add trigger node variables
    const triggerNode = previousNodes.find(n => n.type === 'trigger' || n.data?.type?.includes('trigger'));
    if (triggerNode) {
      const triggerType = triggerNode.data?.type || triggerNode.data?.triggerType;
      
      if (triggerType === 'deal_created' || triggerType === 'stage_changed') {
        variables.push(
          { label: 'Deal ID', value: '{{deal.id}}', source: 'Deal' },
          { label: 'Deal Name', value: '{{deal.name}}', source: 'Deal' },
          { label: 'Deal Value', value: '{{deal.value}}', source: 'Deal' },
          { label: 'Deal Stage', value: '{{deal.stage}}', source: 'Deal' },
          { label: 'Company Name', value: '{{deal.company}}', source: 'Deal' },
          { label: 'Contact Name', value: '{{deal.contact}}', source: 'Deal' },
          { label: 'Owner Name', value: '{{deal.owner}}', source: 'Deal' }
        );
      } else if (triggerType === 'task_completed' || triggerType === 'task_overdue') {
        variables.push(
          { label: 'Task ID', value: '{{task.id}}', source: 'Task' },
          { label: 'Task Title', value: '{{task.title}}', source: 'Task' },
          { label: 'Task Description', value: '{{task.description}}', source: 'Task' },
          { label: 'Task Due Date', value: '{{task.due_date}}', source: 'Task' },
          { label: 'Task Priority', value: '{{task.priority}}', source: 'Task' },
          { label: 'Assigned To', value: '{{task.assigned_to}}', source: 'Task' }
        );
      } else if (triggerType === 'activity_created') {
        variables.push(
          { label: 'Activity ID', value: '{{activity.id}}', source: 'Activity' },
          { label: 'Activity Type', value: '{{activity.type}}', source: 'Activity' },
          { label: 'Activity Notes', value: '{{activity.notes}}', source: 'Activity' },
          { label: 'Activity Date', value: '{{activity.date}}', source: 'Activity' },
          { label: 'Related Deal', value: '{{activity.deal_name}}', source: 'Activity' },
          { label: 'Created By', value: '{{activity.created_by}}', source: 'Activity' }
        );
      } else if (triggerType === 'form_submission') {
        variables.push(
          { label: 'Form Name', value: '{{form.name}}', source: 'Form' },
          { label: 'Submission ID', value: '{{form.submission_id}}', source: 'Form' },
          { label: 'Submitted At', value: '{{form.submitted_at}}', source: 'Form' },
          { label: 'Form Fields', value: '{{form.fields}}', source: 'Form' }
        );
      }
      
      // Add common variables
      variables.push(
        { label: 'Current Date', value: '{{current_date}}', source: 'System' },
        { label: 'Current Time', value: '{{current_time}}', source: 'System' },
        { label: 'Workflow Name', value: '{{workflow.name}}', source: 'System' },
        { label: 'User Email', value: '{{user.email}}', source: 'System' },
        { label: 'User Name', value: '{{user.name}}', source: 'System' }
      );
    }
    
    // Add variables from condition nodes
    previousNodes.filter(n => n.data?.type === 'condition').forEach(node => {
      if (node.data?.conditionField) {
        variables.push({
          label: `Condition: ${node.data.label || node.data.conditionField}`,
          value: `{{${node.data.conditionField}}}`,
          source: node.data.label || 'Condition'
        });
      }
    });
    
    // Add variables from form nodes
    previousNodes.filter(n => n.data?.type === 'form').forEach(node => {
      if (node.data?.formFields) {
        node.data.formFields.forEach((field: any) => {
          variables.push({
            label: field.label || field.name,
            value: `{{form.${field.name}}}`,
            source: node.data.label || 'Form'
          });
        });
      }
    });
    
    return variables;
  };

  // Insert variable at cursor position in textarea
  const insertVariable = (nodeId: string, field: 'slackMessage' | 'slackCustomMessage' | 'slackBlocks', variable: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const currentValue = node.data[field] || '';
    const textarea = document.querySelector(`#${field}-${nodeId}`) as HTMLTextAreaElement;
    
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      updateNodeData(nodeId, { [field]: newValue });
      
      // Restore cursor position after the inserted variable
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    } else {
      // Fallback: append to the end if we can't find the textarea
      updateNodeData(nodeId, { [field]: currentValue + variable });
    }
  };
  
  // Handle AI configuration save
  const handleAIConfigSave = (config: AINodeConfig) => {
    if (selectedAINode) {
      updateNodeData(selectedAINode.id, { config });
      setSelectedAINode(null);
    }
  };

  // Handle Custom GPT configuration save
  const handleCustomGPTConfigSave = (config: CustomGPTNodeConfig) => {
    if (selectedCustomGPTNode) {
      updateNodeData(selectedCustomGPTNode.id, { config });
      setSelectedCustomGPTNode(null);
    }
  };

  // Run workflow execution
  const runWorkflow = async (triggerData?: any) => {
    if (isRunning) {
      return;
    }
    
    setIsRunning(true);
    
    try {
      // Check if there are nodes to execute
      if (nodes.length === 0) {
        alert('Please add nodes to the workflow before running');
        return;
      }
      let currentWorkflowId = workflowId;
      
      // If workflow hasn't been saved yet, save it first
      if (!currentWorkflowId) {
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
          } else {
            throw new Error('No ID returned from save operation');
          }
        } catch (error) {
          alert('Failed to save the workflow. Please try saving manually first.');
          return;
        }
      }
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
      setCurrentExecutionId(executionId);
      
      // Show success message (removed popup)
      // Execution logged - will appear in Jobs tab
    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred';
      alert(`Failed to run workflow: ${errorMessage}\n\nCheck console for details.`);
    } finally {
      setIsRunning(false);
    }
  };

  // Quick test run with visual feedback

  // Live monitor for production jobs
  const runLiveMonitor = () => {
    setShowLiveMonitor(true);
    setShowRunDropdown(false);
  };

  // Quick run without UI
  const runQuickExecution = async () => {
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
      const { type, data } = event.data;
      
      if (type === 'formSubmitted' || type === 'formTestSubmission') {
        const { workflowId: eventWorkflowId, formData, formId } = data;
        // Check if this workflow contains a form node with matching formId
        const matchingFormNode = nodes.find(node => {
          if (node.type !== 'form') return false;
          
          const testUrl = node.data?.config?.testUrl;
          const prodUrl = node.data?.config?.productionUrl;
          
          const matches = (type === 'formTestSubmission' && testUrl && testUrl.includes(formId)) ||
                         (type === 'formSubmitted' && prodUrl && prodUrl.includes(formId));
          
          if (matches) {
          }
          
          return matches;
        });
        
        if (matchingFormNode) {
          // Show test mode UI if it's a test submission
          if (type === 'formTestSubmission' && !showWorkflowTestMode) {
            setShowWorkflowTestMode(true);
          }
          
          const isTestSubmission = type === 'formTestSubmission';
          runWorkflow({ ...formData, testMode: isTestSubmission });
        } else if (eventWorkflowId === workflowId) {
          const isTestSubmission = type === 'formTestSubmission';
          runWorkflow({ ...formData, testMode: isTestSubmission });
        } else {
        }
      }
    };
    
    channel.addEventListener('message', handleBroadcastMessage);
    
    // Also keep CustomEvent listeners for backward compatibility (same-tab submissions)
    const handleFormSubmission = (event: CustomEvent) => {
      handleBroadcastMessage({ data: { type: 'formSubmitted', data: event.detail } } as MessageEvent);
    };
    
    const handleTestFormSubmission = (event: CustomEvent) => {
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
          // Calculate node position
          const position = calculateNodePosition(
            x,
            y,
            zoom,
            reactFlowBounds.width,
            reactFlowBounds.height
          );

          // Create node using factory
          const newNode = createWorkflowNode(
            {
              type,
              nodeData,
              workflowId
            },
            position
          );

          setNodes((nds) => nds.concat(newNode));
        }
      }
    },
    [setNodes, workflowId]
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
        case 'create_or_update_deal':
          action_config.deal_name = actionNode.data.dealName || '{{payload.title}} - {{payload.date}}';
          action_config.deal_value = actionNode.data.dealValue || '{{aiAnalysis.coaching.opportunity_score * 1000}}';
          action_config.deal_company = actionNode.data.dealCompany || '{{payload.participants[0].company}}';
          action_config.deal_stage = actionNode.data.dealStage || 'SQL';
          action_config.deal_probability = actionNode.data.dealProbability || '{{aiAnalysis.coaching.opportunity_score}}';
          action_config.owner_id = actionNode.data.ownerId || '{{payload.organizer_id}}';
          action_config.score_threshold = actionNode.data.scoreThreshold || 60;
          action_config.auto_create_enabled = actionNode.data.autoCreateEnabled || true;
          action_config.update_existing = actionNode.data.updateExisting || true;
          action_config.upsert_key = actionNode.data.upsertKey || 'meeting_id';
          action_config.progression_rules = actionNode.data.progressionRules || {
            sql_to_opportunity: 60,
            opportunity_to_verbal: 75,
            verbal_to_signed: 85
          };
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
    // Map various trigger types to valid database values
    // NOTE: 'manual' is NOT valid despite what old migrations suggest
    const validTriggerTypes = ['activity_created', 'stage_changed', 'deal_created', 'task_completed'];
    
    if (mappedTriggerType === 'form_submission' || triggerNode?.type === 'form') {
      // Form submissions trigger an activity creation event
      mappedTriggerType = 'activity_created';
    } else if (mappedTriggerType === 'manual') {
      // Manual triggers also map to activity_created
      mappedTriggerType = 'activity_created';
    } else if (!validTriggerTypes.includes(mappedTriggerType)) {
      mappedTriggerType = 'activity_created';
    }
    // Map action types to valid database values
    // Based on testing, only 'create_task' and 'update_deal_stage' are currently valid
    const validActionTypes = ['create_task', 'update_deal_stage', 'create_contact', 'create_deal', 'create_or_update_deal', 'create_company'];
    let mappedActionType = actionNode?.data?.type || 'create_task';
    
    if (actionNode?.type === 'aiAgent' || mappedActionType === 'ai_agent') {
      // AI agents map to create_task (most compatible)
      mappedActionType = 'create_task';
    } else if (mappedActionType === 'send_slack') {
      // Slack actions map to create_task for now
      mappedActionType = 'create_task';
    } else if (!validActionTypes.includes(mappedActionType)) {
      // Default to create_task if action type is not valid
      mappedActionType = 'create_task';
    }
    
    // Validate template_id is a valid UUID or null
    const getValidTemplateId = (): string | null => {
      const templateId = selectedWorkflow?.template_id || selectedWorkflow?.id;
      if (!templateId) return null;
      // Only use if it's a valid UUID
      return isValidUUID(templateId) ? templateId : null;
    };

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
      template_id: getValidTemplateId() // Only use valid UUID template IDs
    };
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
      onSave(workflow);
    }
  };
  
  const handleModalSave = async (name: string, description: string) => {
    setWorkflowName(name);
    setWorkflowDescription(description);
    
    const workflow = buildWorkflowData();
    workflow.name = name;
    workflow.description = description;
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
  };

  
  // Tidy nodes - arrange them in a clean layout
  const tidyNodes = () => {
    if (nodes.length === 0) return;
    
    // Mark as tidied to prevent auto-repositioning
    setHasTidied(true);
    
    // Create connection maps for graph traversal
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
    
    // Find root nodes (triggers, webhooks, or nodes with no incoming edges)
    const rootNodes = nodes.filter(node => 
      node.type === 'trigger' || 
      node.type === 'fathomWebhook' ||
      !nodeIncoming.has(node.id) || 
      nodeIncoming.get(node.id)!.length === 0
    );
    
    // Calculate node levels and track branch paths
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    const branchPaths = new Map<string, string>(); // Track which branch each node belongs to
    
    // BFS with branch tracking
    const queue: { id: string, level: number, path: string }[] = [];
    rootNodes.forEach((node, idx) => {
      queue.push({ id: node.id, level: 0, path: `root${idx}` });
      levels.set(node.id, 0);
      branchPaths.set(node.id, `root${idx}`);
    });
    
    while (queue.length > 0) {
      const item = queue.shift()!;
      if (visited.has(item.id)) continue;
      visited.add(item.id);
      
      const children = nodeConnections.get(item.id) || [];
      const node = nodes.find(n => n.id === item.id);
      
      // Detect branching nodes
      const isBranching = node && (
        node.type === 'conditionalBranch' ||
        node.type === 'router' ||
        node.type === 'condition' ||
        children.length > 1
      );
      
      children.forEach((childId, idx) => {
        const currentLevel = levels.get(childId);
        const newLevel = item.level + 1;
        
        // Update level to maximum encountered
        if (!currentLevel || newLevel > currentLevel) {
          levels.set(childId, newLevel);
        }
        
        // Create unique branch paths for each child of a branching node
        const childPath = isBranching ? `${item.path}-branch${idx}` : item.path;
        branchPaths.set(childId, childPath);
        
        if (!visited.has(childId)) {
          queue.push({ id: childId, level: newLevel, path: childPath });
        }
      });
    }
    
    // Group nodes by level
    const nodesByLevel = new Map<number, { node: Node, path: string }[]>();
    nodes.forEach(node => {
      const level = levels.get(node.id) || 0;
      const path = branchPaths.get(node.id) || 'root0';
      
      if (!nodesByLevel.has(level)) {
        nodesByLevel.set(level, []);
      }
      nodesByLevel.get(level)!.push({ node, path });
    });
    
    // Professional layout parameters
    const HORIZONTAL_SPACING = 400; // Wide spacing for clarity
    const VERTICAL_SPACING = 250;   // Good vertical separation
    const START_X = 100;
    const CENTER_Y = 400; // Center line for main flow
    
    // Calculate positions with professional spacing
    const nodePositions = new Map<string, { x: number, y: number }>();
    
    nodesByLevel.forEach((levelNodes, level) => {
      const x = START_X + level * HORIZONTAL_SPACING;
      
      // Sort nodes by their branch path for consistent ordering
      levelNodes.sort((a, b) => a.path.localeCompare(b.path));
      
      if (levelNodes.length === 1) {
        // Single node at this level - place on center line
        nodePositions.set(levelNodes[0].node.id, { x, y: CENTER_Y });
      } else {
        // Multiple nodes - create professional branch layout
        // Identify unique branch roots
        const uniqueBranches = new Set(levelNodes.map(n => n.path.split('-')[0]));
        const branchGroups = new Map<string, typeof levelNodes>();
        
        // Group nodes by their root branch
        levelNodes.forEach(item => {
          const rootBranch = item.path.split('-')[0];
          if (!branchGroups.has(rootBranch)) {
            branchGroups.set(rootBranch, []);
          }
          branchGroups.get(rootBranch)!.push(item);
        });
        
        // Position branches with professional spacing
        if (levelNodes.length === 2) {
          // Two branches - one above, one below center
          levelNodes[0] && nodePositions.set(levelNodes[0].node.id, { x, y: CENTER_Y - VERTICAL_SPACING * 0.8 });
          levelNodes[1] && nodePositions.set(levelNodes[1].node.id, { x, y: CENTER_Y + VERTICAL_SPACING * 0.8 });
        } else if (levelNodes.length === 3) {
          // Three branches - top, center, bottom
          levelNodes[0] && nodePositions.set(levelNodes[0].node.id, { x, y: CENTER_Y - VERTICAL_SPACING });
          levelNodes[1] && nodePositions.set(levelNodes[1].node.id, { x, y: CENTER_Y });
          levelNodes[2] && nodePositions.set(levelNodes[2].node.id, { x, y: CENTER_Y + VERTICAL_SPACING });
        } else {
          // More than 3 nodes - distribute evenly with good spacing
          const totalHeight = (levelNodes.length - 1) * VERTICAL_SPACING * 0.8;
          const startY = CENTER_Y - totalHeight / 2;
          
          levelNodes.forEach((item, idx) => {
            nodePositions.set(item.node.id, {
              x,
              y: startY + idx * VERTICAL_SPACING * 0.8
            });
          });
        }
      }
    });
    
    // Handle convergence nodes (multiple incoming edges)
    nodes.forEach(node => {
      const incoming = nodeIncoming.get(node.id) || [];
      if (incoming.length > 1) {
        // This is a convergence point - center it between source nodes
        const sourcePositions = incoming
          .map(sourceId => nodePositions.get(sourceId))
          .filter(pos => pos !== undefined) as { x: number, y: number }[];
        
        if (sourcePositions.length > 0) {
          const avgY = sourcePositions.reduce((sum, pos) => sum + pos.y, 0) / sourcePositions.length;
          const currentPos = nodePositions.get(node.id);
          if (currentPos) {
            // Keep x position but center y between sources
            nodePositions.set(node.id, { x: currentPos.x, y: avgY });
          }
        }
      }
    });

    // Apply positions with smooth animation
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

    // Fit view after tidying with smooth animation
    setTimeout(() => {
      if (reactFlowInstance.current) {
        reactFlowInstance.current.fitView({ 
          padding: 0.15, 
          duration: 800,
          maxZoom: 1.0,
          minZoom: 0.5 
        });
      }
    }, 100);
  };

  return (
    <>
    <div className="h-[calc(100vh-8rem)] flex overflow-hidden">
      {/* Left Panel - Node Library OR Test Panel - Hide in execution mode */}
      {!executionMode && (
        <motion.div 
          initial={{ x: 0, width: 320 }}
          animate={{ 
            x: (showNodePanel || showTestPanel) ? 0 : -300,
            width: (showNodePanel || showTestPanel) ? 320 : 0
          }}
          transition={{ type: 'tween', duration: 0.25 }}
          className="bg-white dark:bg-gray-900/50 backdrop-blur-xl border-r border-gray-200 dark:border-gray-800/50 overflow-y-auto h-[calc(100vh-8rem)]"
          style={{ width: (showNodePanel || showTestPanel) ? 320 : 0, pointerEvents: (showNodePanel || showTestPanel) ? 'auto' : 'none', overflow: 'hidden' }}
        >
        {showTestPanel ? (
          <LocalTestPanel
            testExecutionState={testExecutionState}
            selectedScenario={selectedScenario}
            onScenarioChange={setSelectedScenario}
            onStart={startTest}
            onStop={stopTest}
            onPause={pauseTest}
            onResume={resumeTest}
            onSpeedChange={handleSpeedChange}
            onClose={() => {
              setShowTestPanel(false);
              if (testExecutionState?.isRunning) {
                stopTest();
              }
            }}
          />
        ) : (
          <WorkflowNodeLibrary />
        )}
      </motion.div>
      )}

      {/* Main Canvas */}
      <div className={`${executionMode ? 'w-full' : 'flex-1'} relative h-[calc(100vh-8rem)] overflow-hidden bg-gray-50 dark:bg-gray-900`}>
        {/* Auto-save notification - Bottom right corner */}
        {lastSaveTime && (
          <div className="absolute bottom-4 right-4 z-40">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-900/90 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
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
              <div className="bg-white dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 min-w-80">
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
                className="px-4 py-2 bg-white dark:bg-gray-900/95 backdrop-blur-xl border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg cursor-pointer hover:border-gray-300 dark:hover:border-gray-600 transition-colors group"
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
                className="absolute top-full mt-1 right-0 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl z-50"
              >
                <div className="p-2">
                  {/* Live Monitor Option */}
                  <button
                    onClick={runLiveMonitor}
                    className="w-full px-3 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded flex items-center gap-3 transition-colors"
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
                    className="w-full px-3 py-2 text-left text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 rounded flex items-center gap-3 transition-colors"
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
          onEdgeClick={onEdgeClick}
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
          fitViewOptions={{
            padding: 0.2,
            maxZoom: 0.8,
            minZoom: 0.4
          }}
          defaultViewport={{ x: 0, y: 0, zoom: 0.7 }}
          minZoom={0.3}
          maxZoom={1.5}
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
            className="absolute top-0 right-0 w-96 h-[calc(100vh-8rem)] theme-bg-card backdrop-blur-xl border-l theme-border p-6 overflow-y-auto z-50"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold theme-text-primary">Edit Node</h3>
                  <p className="text-sm theme-text-secondary mt-1">Configure node settings</p>
                </div>
                <button
                  onClick={() => setShowNodeEditor(false)}
                  className="theme-text-tertiary hover:theme-text-primary transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Node Type */}
              <div className="theme-bg-elevated rounded-lg p-4 theme-border">
                <p className="text-xs theme-text-tertiary mb-1">Node Type</p>
                <p className="theme-text-primary font-medium capitalize">{selectedNode.type}</p>
              </div>

              {/* Node Settings */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium theme-text-secondary mb-2">Label</label>
                  <input
                    type="text"
                    value={selectedNode.data.label || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
                    className="w-full px-3 py-2 theme-bg-elevated theme-border rounded-lg theme-text-primary text-sm placeholder:theme-text-tertiary focus:border-[#37bd7e] outline-none transition-colors"
                    placeholder="Enter node label..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium theme-text-secondary mb-2">Description</label>
                  <textarea
                    value={selectedNode.data.description || ''}
                    onChange={(e) => updateNodeData(selectedNode.id, { description: e.target.value })}
                    className="w-full px-3 py-2 theme-bg-elevated theme-border rounded-lg theme-text-primary text-sm placeholder:theme-text-tertiary focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
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
                        <option value="multi_channel_notify">Send Notifications</option>
                        <option value="send_slack">Send Slack Message</option>
                        <option value="create_activity">Create Activity</option>
                        <option value="update_deal_stage">Update Deal Stage</option>
                        <option value="update_fields">Update Fields</option>
                        <option value="assign_owner">Assign Owner</option>
                        <option value="create_contact">Create Contact</option>
                        <option value="create_deal">Create Deal</option>
                        <option value="create_or_update_deal">Create/Update Deal</option>
                        <option value="create_company">Create Company</option>
                        <option value="send_email">Send Email</option>
                        <option value="multi_action">Multiple Actions</option>
                        <option value="edit_fields">Edit Fields</option>
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
                          <label className="block text-sm font-medium text-gray-300 mb-2">Task Stage</label>
                          <select
                            value={selectedNode.data.taskStatus || 'planned'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { taskStatus: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="planned">Planned</option>
                            <option value="overdue">Overdue</option>
                            <option value="started">Started</option>
                            <option value="complete">Complete</option>
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
                        
                        {selectedNode.data.recurrencePattern === 'weekly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Day of Week</label>
                            <select
                              value={selectedNode.data.dayOfWeek || 'monday'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { dayOfWeek: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="monday">Monday</option>
                              <option value="tuesday">Tuesday</option>
                              <option value="wednesday">Wednesday</option>
                              <option value="thursday">Thursday</option>
                              <option value="friday">Friday</option>
                              <option value="saturday">Saturday</option>
                              <option value="sunday">Sunday</option>
                            </select>
                          </div>
                        )}
                        
                        {selectedNode.data.recurrencePattern === 'monthly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Day of Month</label>
                            <input
                              type="number"
                              value={selectedNode.data.dayOfMonth || 1}
                              onChange={(e) => updateNodeData(selectedNode.id, { dayOfMonth: parseInt(e.target.value) || 1 })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              min="1"
                              max="31"
                              placeholder="1-31"
                            />
                            <div className="text-xs text-gray-500 mt-1">Tasks on days 29-31 will be created on the last valid day of the month</div>
                          </div>
                        )}
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Time of Day</label>
                          <input
                            type="time"
                            value={selectedNode.data.timeOfDay || '09:00'}
                            onChange={(e) => updateNodeData(selectedNode.id, { timeOfDay: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                          />
                          <div className="text-xs text-gray-500 mt-1">Time when the task will be created (in user's timezone)</div>
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
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { webhookPayload: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24 font-mono"
                            placeholder={'{"deal_id": "{{deal_id}}", "value": "{{value}}"}'}
                          />
                          <p className="text-xs text-gray-500 mt-1">Use variables: {`{{deal_id}}, {{deal_name}}, {{value}}, {{stage}}`}</p>
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
                                  <optgroup label="Deal Fields">
                                    <option value="stage">Stage</option>
                                    <option value="value">Deal Value</option>
                                    <option value="probability">Probability (%)</option>
                                    <option value="expected_close">Expected Close Date</option>
                                    <option value="owner">Deal Owner</option>
                                    <option value="priority">Priority</option>
                                    <option value="source">Lead Source</option>
                                    <option value="type">Deal Type</option>
                                    <option value="status">Status</option>
                                    <option value="next_step">Next Step</option>
                                  </optgroup>
                                  <optgroup label="Contact Fields">
                                    <option value="contact_name">Contact Name</option>
                                    <option value="contact_email">Contact Email</option>
                                    <option value="contact_phone">Contact Phone</option>
                                    <option value="contact_title">Contact Title</option>
                                    <option value="contact_owner">Contact Owner</option>
                                  </optgroup>
                                  <optgroup label="Company Fields">
                                    <option value="company_name">Company Name</option>
                                    <option value="company_domain">Company Domain</option>
                                    <option value="company_industry">Industry</option>
                                    <option value="company_size">Company Size</option>
                                    <option value="company_revenue">Annual Revenue</option>
                                  </optgroup>
                                  <optgroup label="Custom Fields">
                                    <option value="custom_field_1">Custom Field 1</option>
                                    <option value="custom_field_2">Custom Field 2</option>
                                    <option value="custom_field_3">Custom Field 3</option>
                                  </optgroup>
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
                            <div className="relative">
                              <textarea
                                id={`slackMessage-${selectedNode.id}`}
                                value={selectedNode.data.slackMessage || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { slackMessage: e.target.value });
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                placeholder="🎉 New deal created: {{deal_name}}"
                                rows={2}
                              />
                              <div className="mt-2">
                                <details className="group">
                                  <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none">
                                    <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                                    Insert Variable
                                  </summary>
                                  <div className="mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                                    {getAvailableVariables(selectedNode.id).length > 0 ? (
                                      <div className="space-y-1">
                                        {getAvailableVariables(selectedNode.id).map((variable, index) => (
                                          <button
                                            key={index}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              insertVariable(selectedNode.id, 'slackMessage', variable.value);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="w-full text-left px-2 py-1 text-xs hover:bg-gray-700/50 rounded transition-colors flex items-center justify-between group"
                                          >
                                            <span className="text-gray-300">{variable.label}</span>
                                            <span className="text-gray-500 text-[10px] group-hover:text-gray-400">
                                              {variable.source}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-500">No variables available. Connect to a trigger node first.</p>
                                    )}
                                  </div>
                                </details>
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Click "Insert Variable" to add dynamic content</p>
                          </div>
                        )}
                        
                        {selectedNode.data.slackMessageType === 'custom' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Custom Message</label>
                            <div className="relative">
                              <textarea
                                id={`slackCustomMessage-${selectedNode.id}`}
                                value={selectedNode.data.slackCustomMessage || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { slackCustomMessage: e.target.value });
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                placeholder="Use {{deal_name}}, {{company}}, {{value}}, {{stage}}"
                                rows={3}
                              />
                              <div className="mt-2">
                                <details className="group">
                                  <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none">
                                    <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                                    Insert Variable
                                  </summary>
                                  <div className="mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                                    {getAvailableVariables(selectedNode.id).length > 0 ? (
                                      <div className="space-y-1">
                                        {getAvailableVariables(selectedNode.id).map((variable, index) => (
                                          <button
                                            key={index}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              insertVariable(selectedNode.id, 'slackCustomMessage', variable.value);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="w-full text-left px-2 py-1 text-xs hover:bg-gray-700/50 rounded transition-colors flex items-center justify-between group"
                                          >
                                            <span className="text-gray-300">{variable.label}</span>
                                            <span className="text-gray-500 text-[10px] group-hover:text-gray-400">
                                              {variable.source}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-500">No variables available. Connect to a trigger node first.</p>
                                    )}
                                  </div>
                                </details>
                              </div>
                            </div>
                          </div>
                        )}

                        {selectedNode.data.slackMessageType === 'blocks' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Slack Blocks JSON</label>
                            <div className="relative">
                              <textarea
                                id={`slackBlocks-${selectedNode.id}`}
                                value={selectedNode.data.slackBlocks || ''}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { slackBlocks: e.target.value });
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
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
                              <div className="mt-2">
                                <details className="group">
                                  <summary className="flex items-center gap-2 cursor-pointer text-xs text-gray-400 hover:text-gray-300 select-none">
                                    <ChevronDown className="w-3 h-3 group-open:rotate-180 transition-transform" />
                                    Insert Variable
                                  </summary>
                                  <div className="mt-2 p-2 bg-gray-800/50 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                                    {getAvailableVariables(selectedNode.id).length > 0 ? (
                                      <div className="space-y-1">
                                        {getAvailableVariables(selectedNode.id).map((variable, index) => (
                                          <button
                                            key={index}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              insertVariable(selectedNode.id, 'slackBlocks', variable.value);
                                            }}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            className="w-full text-left px-2 py-1 text-xs hover:bg-gray-700/50 rounded transition-colors flex items-center justify-between group"
                                          >
                                            <span className="text-gray-300">{variable.label}</span>
                                            <span className="text-gray-500 text-[10px] group-hover:text-gray-400">
                                              {variable.source}
                                            </span>
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-gray-500">No variables available. Connect to a trigger node first.</p>
                                    )}
                                  </div>
                                </details>
                              </div>
                            </div>
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
                          <label className="block text-sm font-medium text-gray-300 mb-2">Recipient Email</label>
                          <input
                            type="email"
                            value={selectedNode.data.recipientEmail || '{{formData.fields.email}}'}
                            onChange={(e) => updateNodeData(selectedNode.id, { recipientEmail: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="recipient@example.com or {{formData.fields.email}}"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Email Format</label>
                          <select
                            value={selectedNode.data.emailFormat || 'html'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { emailFormat: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="html">HTML Email</option>
                            <option value="text">Plain Text</option>
                            <option value="both">HTML with Text Fallback</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                          <input
                            type="text"
                            value={selectedNode.data.emailSubject || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { emailSubject: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Email subject (supports variables like {{formData.fields.name}})"
                          />
                        </div>
                        
                        {(selectedNode.data.emailFormat === 'text' || selectedNode.data.emailFormat === 'both' || !selectedNode.data.emailFormat || selectedNode.data.emailFormat === 'html') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                              {selectedNode.data.emailFormat === 'text' ? 'Plain Text Body' : 'Email Body'}
                            </label>
                            <textarea
                              value={selectedNode.data.emailBody || ''}
                              onChange={(e) => updateNodeData(selectedNode.id, { emailBody: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24"
                              placeholder="Email content (supports variables like {{formData.fields.name}})"
                            />
                            <div className="text-xs text-gray-500 mt-1">
                              {selectedNode.data.emailFormat === 'html' ? 
                                'For HTML emails, this will be wrapped in a professional template' :
                                'Plain text content - line breaks will be preserved'
                              }
                            </div>
                          </div>
                        )}
                        
                        {(selectedNode.data.emailFormat === 'html' || selectedNode.data.emailFormat === 'both') && (
                          <div>
                            <label className="flex items-center gap-2 mb-2">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.useCustomHTML || false}
                                onChange={(e) => updateNodeData(selectedNode.id, { useCustomHTML: e.target.checked })}
                                className="text-[#37bd7e] bg-gray-800 border-gray-600 rounded focus:ring-[#37bd7e]"
                              />
                              <span className="text-sm font-medium text-gray-300">Use Custom HTML</span>
                            </label>
                            
                            {selectedNode.data.useCustomHTML && (
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Custom HTML Body</label>
                                <textarea
                                  value={selectedNode.data.htmlBody || ''}
                                  onChange={(e) => updateNodeData(selectedNode.id, { htmlBody: e.target.value })}
                                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-32 font-mono"
                                  placeholder="<h1>Custom HTML content</h1><p>Use {{formData.fields.name}} for variables</p>"
                                />
                                <div className="text-xs text-gray-500 mt-1">
                                  Custom HTML will be sent as-is. Include complete HTML structure if needed.
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        <div className="bg-gray-800/30 p-3 rounded-lg border border-gray-700">
                          <h4 className="text-sm font-medium text-gray-300 mb-2">📧 Email Configuration</h4>
                          <div className="text-xs text-gray-400 space-y-1">
                            <div>• <strong>From:</strong> workflows@sixtyseconds.ai</div>
                            <div>• <strong>Provider:</strong> Amazon SES</div>
                            <div>• <strong>Variables:</strong> Use {'{{formData.fields.fieldName}}'} syntax</div>
                          </div>
                        </div>
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
                        
                        {/* Meeting-specific fields */}
                        {selectedNode.data.activityType === 'meeting' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Location</label>
                              <input
                                type="text"
                                value={selectedNode.data.meetingLocation || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { meetingLocation: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                placeholder="e.g., Zoom, Office, Client Site"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Meeting Duration (minutes)</label>
                              <input
                                type="number"
                                value={selectedNode.data.meetingDuration || 60}
                                onChange={(e) => updateNodeData(selectedNode.id, { meetingDuration: parseInt(e.target.value) || 60 })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                min="15"
                                step="15"
                                placeholder="60"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Deal Stage</label>
                              <select
                                value={selectedNode.data.meetingStage || 'SQL'}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { meetingStage: e.target.value });
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
                          </>
                        )}
                        
                        {/* Proposal-specific fields */}
                        {selectedNode.data.activityType === 'proposal' && (
                          <>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Deal Value</label>
                              <input
                                type="number"
                                value={selectedNode.data.proposalValue || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { proposalValue: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                placeholder="{{deal.value}} or enter amount"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Proposal Type</label>
                              <select
                                value={selectedNode.data.proposalType || 'initial'}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  updateNodeData(selectedNode.id, { proposalType: e.target.value });
                                }}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                              >
                                <option value="initial">Initial Proposal</option>
                                <option value="revised">Revised Proposal</option>
                                <option value="final">Final Proposal</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Expiry Date</label>
                              <input
                                type="date"
                                value={selectedNode.data.proposalExpiry || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { proposalExpiry: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              />
                            </div>
                          </>
                        )}
                        
                        {/* Contact/Company mapping fields for all activity types */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Contact Email</label>
                          <input
                            type="text"
                            value={selectedNode.data.contactEmail || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { contactEmail: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="{{contact.email}} or email@example.com"
                          />
                          <div className="text-xs text-gray-500 mt-1">Used to link activity to contact and company</div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Company Domain</label>
                          <input
                            type="text"
                            value={selectedNode.data.companyDomain || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { companyDomain: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="{{company.domain}} or example.com"
                          />
                          <div className="text-xs text-gray-500 mt-1">Optional: Used to link to company if contact not found</div>
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
                        
                        {/* Additional Deal Information */}
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Contact Email</label>
                          <input
                            type="email"
                            value={selectedNode.data.dealContactEmail || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealContactEmail: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="{{contact.email}} or email@example.com"
                          />
                          <div className="text-xs text-gray-500 mt-1">Primary contact for this deal</div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Expected Close Date</label>
                          <input
                            type="date"
                            value={selectedNode.data.expectedCloseDate || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { expectedCloseDate: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Deal Type</label>
                          <select
                            value={selectedNode.data.dealType || 'new_business'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { dealType: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="new_business">New Business</option>
                            <option value="renewal">Renewal</option>
                            <option value="expansion">Expansion</option>
                            <option value="replacement">Replacement</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Lead Source</label>
                          <select
                            value={selectedNode.data.leadSource || 'inbound'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { leadSource: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="inbound">Inbound</option>
                            <option value="outbound">Outbound</option>
                            <option value="referral">Referral</option>
                            <option value="partner">Partner</option>
                            <option value="website">Website</option>
                            <option value="social_media">Social Media</option>
                            <option value="event">Event</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Probability (%)</label>
                          <input
                            type="number"
                            value={selectedNode.data.probability || 10}
                            onChange={(e) => updateNodeData(selectedNode.id, { probability: parseInt(e.target.value) || 10 })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            min="0"
                            max="100"
                            step="10"
                          />
                          <div className="text-xs text-gray-500 mt-1">Win probability based on stage</div>
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

                    {selectedNode.data.type === 'create_or_update_deal' && (
                      <>
                        <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 p-3 rounded-lg border border-blue-500/30 mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-blue-400 text-sm">🤖</span>
                            <span className="text-blue-300 text-sm font-medium">AI-Powered Deal Management</span>
                          </div>
                          <div className="text-xs text-blue-200">
                            Automatically creates deals when opportunity score {'>'} threshold, or updates existing deals based on meeting insights.
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Auto-Create Threshold</label>
                          <input
                            type="number"
                            value={selectedNode.data.scoreThreshold || 60}
                            onChange={(e) => updateNodeData(selectedNode.id, { scoreThreshold: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="60"
                            min="0"
                            max="100"
                            step="5"
                          />
                          <div className="text-xs text-gray-500 mt-1">Create deals when AI opportunity score exceeds this value</div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="flex items-center gap-2 text-sm text-gray-300">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.autoCreateEnabled !== false}
                                onChange={(e) => updateNodeData(selectedNode.id, { autoCreateEnabled: e.target.checked })}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Auto-create deals
                            </label>
                          </div>
                          <div>
                            <label className="flex items-center gap-2 text-sm text-gray-300">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.updateExisting !== false}
                                onChange={(e) => updateNodeData(selectedNode.id, { updateExisting: e.target.checked })}
                                className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                              />
                              Update existing
                            </label>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Deal Name Template</label>
                          <input
                            type="text"
                            value={selectedNode.data.dealName || '{{payload.title}} - {{payload.date}}'}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealName: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="{{payload.title}} - {{payload.date}}"
                          />
                          <div className="text-xs text-gray-500 mt-1">Use variables like {'{{payload.title}}'}, {'{{payload.date}}'}</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Deal Value Formula</label>
                          <input
                            type="text"
                            value={selectedNode.data.dealValue || '{{aiAnalysis.coaching.opportunity_score * 1000}}'}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealValue: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="{{aiAnalysis.coaching.opportunity_score * 1000}}"
                          />
                          <div className="text-xs text-gray-500 mt-1">Formula based on AI analysis or fixed value</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Company Mapping</label>
                          <input
                            type="text"
                            value={selectedNode.data.dealCompany || '{{payload.participants[0].company}}'}
                            onChange={(e) => updateNodeData(selectedNode.id, { dealCompany: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="{{payload.participants[0].company}}"
                          />
                          <div className="text-xs text-gray-500 mt-1">Extract company from meeting participants</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Initial Stage</label>
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
                          <div className="text-xs text-gray-500 mt-1">Starting stage for new deals</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Stage Progression Rules</label>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">SQL → Opportunity:</span>
                              <input
                                type="number"
                                value={selectedNode.data.sqlToOpportunity || 60}
                                onChange={(e) => updateNodeData(selectedNode.id, { sqlToOpportunity: parseInt(e.target.value) })}
                                className="w-16 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-xs"
                                min="0"
                                max="100"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Opportunity → Verbal:</span>
                              <input
                                type="number"
                                value={selectedNode.data.opportunityToVerbal || 75}
                                onChange={(e) => updateNodeData(selectedNode.id, { opportunityToVerbal: parseInt(e.target.value) })}
                                className="w-16 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-xs"
                                min="0"
                                max="100"
                              />
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-400">Verbal → Signed:</span>
                              <input
                                type="number"
                                value={selectedNode.data.verbalToSigned || 85}
                                onChange={(e) => updateNodeData(selectedNode.id, { verbalToSigned: parseInt(e.target.value) })}
                                className="w-16 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-xs"
                                min="0"
                                max="100"
                              />
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">AI scores needed to progress deal stages</div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Upsert Key</label>
                          <select
                            value={selectedNode.data.upsertKey || 'meeting_id'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { upsertKey: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="meeting_id">Meeting ID</option>
                            <option value="company_name">Company Name</option>
                            <option value="contact_email">Contact Email</option>
                            <option value="deal_name">Deal Name</option>
                          </select>
                          <div className="text-xs text-gray-500 mt-1">How to identify existing deals for updates</div>
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

                    {selectedNode.data.type === 'meeting' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Action Type</label>
                          <select
                            value={selectedNode.data.meetingAction || 'create'}
                            onChange={(e) => updateNodeData(selectedNode.id, { meetingAction: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="create">Create Meeting</option>
                            <option value="update">Update Meeting</option>
                            <option value="add_transcript">Add Transcript</option>
                            <option value="add_summary">Add Summary</option>
                            <option value="add_tasks">Add Tasks</option>
                            <option value="add_next_steps">Add Next Steps</option>
                            <option value="add_coaching">Add Coaching</option>
                            <option value="add_rating">Add Rating</option>
                            <option value="add_talk_time">Add Talk Time</option>
                          </select>
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
                          <div className="text-xs text-gray-500 mt-1">
                            {selectedNode.data.meetingAction === 'create' ? 
                              'Leave empty to create new meeting, or provide ID to update existing' :
                              'Required for update/add operations'
                            }
                          </div>
                        </div>

                        {/* Create Meeting Fields */}
                        {(selectedNode.data.meetingAction === 'create' || !selectedNode.data.meetingAction) && (
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
                                placeholder="{{formData.fields.dealId}}"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-300 mb-2">Contact ID (optional)</label>
                              <input
                                type="text"
                                value={selectedNode.data.contactId || ''}
                                onChange={(e) => updateNodeData(selectedNode.id, { contactId: e.target.value })}
                                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                placeholder="{{formData.fields.contactId}}"
                              />
                            </div>
                          </>
                        )}

                        {/* Update Meeting Fields */}
                        {selectedNode.data.meetingAction === 'update' && (
                          <>
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

                        {/* Add Transcript Fields */}
                        {selectedNode.data.meetingAction === 'add_transcript' && (
                          <>
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
                                placeholder="Full transcript text..."
                              />
                            </div>
                          </>
                        )}

                        {/* Add Summary Fields */}
                        {selectedNode.data.meetingAction === 'add_summary' && (
                          <>
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
                          </>
                        )}

                        {/* Add Tasks Fields */}
                        {selectedNode.data.meetingAction === 'add_tasks' && (
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

                        {/* Add Next Steps Fields */}
                        {selectedNode.data.meetingAction === 'add_next_steps' && (
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

                        {/* Add Coaching Fields */}
                        {selectedNode.data.meetingAction === 'add_coaching' && (
                          <>
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
                          </>
                        )}

                        {/* Add Rating Fields */}
                        {selectedNode.data.meetingAction === 'add_rating' && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Overall Rating (1-10)</label>
                                <input
                                  type="number"
                                  value={selectedNode.data.overallRating || ''}
                                  onChange={(e) => updateNodeData(selectedNode.id, { overallRating: e.target.value })}
                                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                  min="1"
                                  max="10"
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Communication (1-10)</label>
                                <input
                                  type="number"
                                  value={selectedNode.data.communicationRating || ''}
                                  onChange={(e) => updateNodeData(selectedNode.id, { communicationRating: e.target.value })}
                                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                  min="1"
                                  max="10"
                                />
                              </div>
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

                        {/* Add Talk Time Fields */}
                        {selectedNode.data.meetingAction === 'add_talk_time' && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Sales Rep Talk Time (%)</label>
                                <input
                                  type="number"
                                  value={selectedNode.data.salesRepTalkTime || ''}
                                  onChange={(e) => updateNodeData(selectedNode.id, { salesRepTalkTime: e.target.value })}
                                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
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
                                  min="0"
                                  max="100"
                                />
                              </div>
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
                          </>
                        )}

                        {/* User Assignment Section for Create/Update */}
                        {(selectedNode.data.meetingAction === 'create' || selectedNode.data.meetingAction === 'update' || !selectedNode.data.meetingAction) && (
                          <>
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
                      </>
                    )}


                    {selectedNode.data.type === 'multi_action' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Execution Mode</label>
                          <select
                            value={selectedNode.data.executionMode || 'parallel'}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { executionMode: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                          >
                            <option value="parallel">Parallel (all at once)</option>
                            <option value="sequential">Sequential (one after another)</option>
                          </select>
                          <div className="text-xs text-gray-500 mt-1">
                            {selectedNode.data.executionMode === 'parallel' ? 
                              'All action nodes will execute simultaneously (connects to all nodes directly)' :
                              'Action nodes will execute one after another in sequence (creates a chain)'
                            }
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Auto-Connect Actions</label>
                          <div className="space-y-2 max-h-60 overflow-y-auto border border-gray-700 rounded-lg p-3 bg-gray-800/20">
                            {[
                              { type: 'create_task', label: 'Create Task', iconName: 'CheckSquare' },
                              { type: 'send_email', label: 'Send Email', iconName: 'Mail' },
                              { type: 'send_notification', label: 'Send Notification', iconName: 'Bell' },
                              { type: 'multi_channel_notify', label: 'Send Notifications', iconName: 'Bell' },
                              { type: 'send_slack', label: 'Send to Slack', iconName: 'Slack' },
                              { type: 'add_note', label: 'Add Note/Comment', iconName: 'FileText' },
                              { type: 'update_fields', label: 'Update Fields', iconName: 'TrendingUp' },
                              { type: 'create_activity', label: 'Create Activity', iconName: 'Calendar' },
                              { type: 'create_contact', label: 'Create Contact', iconName: 'Users' },
                              { type: 'create_deal', label: 'Create Deal', iconName: 'Database' },
                              { type: 'meeting', label: 'Meeting', iconName: 'Calendar' },
                              { type: 'edit_fields', label: 'Edit Fields', iconName: 'Edit' },
                              { type: 'send_webhook', label: 'Send Webhook', iconName: 'Zap' }
                            ].map((action) => {
                              const isSelected = Array.isArray(selectedNode.data.selectedActions) && 
                                selectedNode.data.selectedActions.some((a: any) => a.type === action.type);
                              
                              return (
                                <label key={action.type} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800/30 p-2 rounded">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const currentActions = Array.isArray(selectedNode.data.selectedActions) ? selectedNode.data.selectedActions : [];
                                      let newActions;
                                      
                                      if (e.target.checked) {
                                        // Add action
                                        newActions = [...currentActions, { 
                                          type: action.type, 
                                          label: action.label, 
                                          iconName: action.iconName,
                                          id: `${action.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                                        }];
                                      } else {
                                        // Remove action
                                        newActions = currentActions.filter((a: any) => a.type !== action.type);
                                      }
                                      
                                      updateNodeData(selectedNode.id, { selectedActions: newActions });
                                    }}
                                    className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-2"
                                  />
                                  <span className="text-gray-300 flex-1">{action.label}</span>
                                  {isSelected && (
                                    <span className="text-xs text-green-400">✓ Selected</span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                          <div className="text-xs text-gray-500 mt-2">
                            Select actions to automatically create and connect. A Join Actions node will be added to merge the branches back together.
                          </div>
                        </div>

                        {selectedNode.data.selectedActions && selectedNode.data.selectedActions.length > 0 && (
                          <div>
                            <button
                              onClick={() => {
                                // Auto-create and connect selected action nodes
                                const multiActionNode = selectedNode;
                                const selectedActions = multiActionNode.data.selectedActions || [];
                                const executionMode = multiActionNode.data.executionMode || 'parallel';
                                
                                const newNodes: any[] = [];
                                const newEdges: any[] = [];
                                
                                // Position nodes to the right of the configuration panel (panel is ~480px wide)
                                const horizontalOffset = 550; // Place nodes well beyond the panel width
                                const verticalSpacing = 120; // Reduced vertical spacing for better visibility
                                
                                selectedActions.forEach((action: any, index: number) => {
                                  // Create new action node
                                  const newNodeId = `${action.type}_${Date.now()}_${index}`;
                                  const newNode = {
                                    id: newNodeId,
                                    type: 'custom',
                                    position: { 
                                      x: multiActionNode.position.x + horizontalOffset + (executionMode === 'sequential' ? index * 250 : 0), 
                                      y: multiActionNode.position.y + (executionMode === 'parallel' ? (index * verticalSpacing) - ((selectedActions.length - 1) * verticalSpacing / 2) : 0)
                                    },
                                    data: { 
                                      type: action.type,
                                      label: action.label,
                                      iconName: action.iconName
                                    },
                                  };
                                  newNodes.push(newNode);
                                });
                                
                                // Note: Join Actions functionality is now automated in Multiple Actions node
                                
                                // Create edges based on execution mode
                                if (executionMode === 'parallel') {
                                  // Parallel: Connect Multiple Actions to all nodes
                                  newNodes.forEach((node) => {
                                    const newEdge = {
                                      id: `${multiActionNode.id}-${node.id}`,
                                      source: multiActionNode.id,
                                      target: node.id,
                                      type: 'default',
                                      animated: true,
                                      style: { stroke: '#9333ea', strokeWidth: 2 }
                                    };
                                    newEdges.push(newEdge);
                                    
                                    // Note: Branches will automatically merge after Multiple Actions execution
                                  });
                                } else {
                                  // Sequential: Connect Multiple Actions to first node, then chain the rest
                                  if (newNodes.length > 0) {
                                    // Connect Multiple Actions to first node
                                    const firstEdge = {
                                      id: `${multiActionNode.id}-${newNodes[0].id}`,
                                      source: multiActionNode.id,
                                      target: newNodes[0].id,
                                      type: 'default',
                                      animated: true,
                                      style: { stroke: '#9333ea', strokeWidth: 2 }
                                    };
                                    newEdges.push(firstEdge);
                                    
                                    // Chain the rest of the nodes
                                    for (let i = 0; i < newNodes.length - 1; i++) {
                                      const chainEdge = {
                                        id: `${newNodes[i].id}-${newNodes[i + 1].id}`,
                                        source: newNodes[i].id,
                                        target: newNodes[i + 1].id,
                                        type: 'default',
                                        animated: true,
                                        style: { stroke: '#37bd7e', strokeWidth: 2 }
                                      };
                                      newEdges.push(chainEdge);
                                    }
                                    
                                    // Note: Sequential chains will automatically complete after the last action
                                  }
                                }
                                
                                // Note: Join functionality is now automated
                                
                                // Add all nodes and edges to the workflow
                                setNodes(prev => [...prev, ...newNodes]);
                                setEdges(prev => [...prev, ...newEdges]);
                                
                                // Clear selected actions after creating
                                updateNodeData(selectedNode.id, { selectedActions: [] });
                                
                                // Auto-pan to show the newly created nodes
                                if (reactFlowInstance.current && newNodes.length > 0) {
                                  // Calculate the center of all new nodes
                                  const bounds = newNodes.reduce((acc, node) => ({
                                    minX: Math.min(acc.minX, node.position.x),
                                    maxX: Math.max(acc.maxX, node.position.x + 200), // Assume node width ~200px
                                    minY: Math.min(acc.minY, node.position.y),
                                    maxY: Math.max(acc.maxY, node.position.y + 100), // Assume node height ~100px
                                  }), {
                                    minX: newNodes[0].position.x,
                                    maxX: newNodes[0].position.x + 200,
                                    minY: newNodes[0].position.y,
                                    maxY: newNodes[0].position.y + 100,
                                  });
                                  
                                  const centerX = (bounds.minX + bounds.maxX) / 2;
                                  const centerY = (bounds.minY + bounds.maxY) / 2;
                                  
                                  // Smooth pan to show the new nodes (offset to account for panel)
                                  reactFlowInstance.current.setCenter(centerX + 200, centerY, { 
                                    duration: 800, 
                                    zoom: reactFlowInstance.current.getZoom() 
                                  });
                                }
                              }}
                              className="w-full px-4 py-2 bg-[#37bd7e] hover:bg-[#2d9a64] text-white text-sm font-medium rounded-lg transition-colors"
                            >
                              Create & Connect {selectedNode.data.selectedActions.length} Action{selectedNode.data.selectedActions.length !== 1 ? 's' : ''}
                            </button>
                            <div className="text-xs text-gray-500 mt-1">
                              {selectedNode.data.executionMode === 'parallel' ? 
                                `Will create ${selectedNode.data.selectedActions.length} action nodes with parallel connections, plus a Join Actions node to merge them.` :
                                `Will create ${selectedNode.data.selectedActions.length} action nodes in sequence, plus a Join Actions node at the end.`
                              }
                            </div>
                          </div>
                        )}
                        
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-blue-400 mb-2">🔀 Advanced Splitter</h4>
                          <div className="text-xs text-gray-400 space-y-1">
                            <div>• Select actions above to auto-connect to this splitter</div>
                            <div>• All connected actions receive the same input data</div>
                            <div>• Choose parallel for speed or sequential for order</div>
                            <div>• Perfect for creating multiple tasks, sending emails, and updating records</div>
                          </div>
                        </div>
                      </>
                    )}


                    {selectedNode.data.type === 'send_email' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">To (Recipients)</label>
                          <input
                            type="text"
                            value={selectedNode.data.emailTo || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { emailTo: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="{{contact.email}}, user@example.com"
                          />
                          <div className="text-xs text-gray-500 mt-1">Comma-separated emails or variables</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Subject</label>
                          <input
                            type="text"
                            value={selectedNode.data.emailSubject || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { emailSubject: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="Follow-up: {{deal.name}}"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Body</label>
                          <textarea
                            value={selectedNode.data.emailBody || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { emailBody: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-32"
                            placeholder="Hi {{contact.first_name}},\n\nThank you for..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">CC (Optional)</label>
                          <input
                            type="text"
                            value={selectedNode.data.emailCc || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { emailCc: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="manager@example.com"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Email Provider</label>
                          <select
                            value={selectedNode.data.emailProvider || 'ses'}
                            onChange={(e) => updateNodeData(selectedNode.id, { emailProvider: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="ses">AWS SES</option>
                            <option value="sendgrid">SendGrid</option>
                            <option value="mailgun">Mailgun</option>
                            <option value="smtp">Custom SMTP</option>
                          </select>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'send_notification' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Notification Title</label>
                          <input
                            type="text"
                            value={selectedNode.data.notificationTitle || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { notificationTitle: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="New deal stage: {{deal.stage}}"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Message</label>
                          <textarea
                            value={selectedNode.data.notificationMessage || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { notificationMessage: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                            placeholder="Deal {{deal.name}} moved to {{deal.stage}}"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Notification Type</label>
                          <select
                            value={selectedNode.data.notificationType || 'info'}
                            onChange={(e) => updateNodeData(selectedNode.id, { notificationType: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="info">Info</option>
                            <option value="success">Success</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Notify Users</label>
                          <select
                            value={selectedNode.data.notifyUsers || 'current'}
                            onChange={(e) => updateNodeData(selectedNode.id, { notifyUsers: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="current">Current User</option>
                            <option value="owner">Deal/Task Owner</option>
                            <option value="team">Entire Team</option>
                            <option value="specific">Specific Users</option>
                          </select>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'send_slack' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Slack Channel</label>
                          <input
                            type="text"
                            value={selectedNode.data.slackChannel || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { slackChannel: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="#sales-team or @username"
                          />
                        </div>
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Message</label>
                            <VariablePicker
                              onInsert={(variable) => {
                                const currentValue = selectedNode.data.slackMessage || '';
                                const newValue = currentValue + variable;
                                updateNodeData(selectedNode.id, { slackMessage: newValue });
                              }}
                              buttonText="Insert Variable"
                              formFields={getFormFieldsFromWorkflow()}
                            />
                          </div>
                          <textarea
                            value={selectedNode.data.slackMessage || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { slackMessage: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24"
                            placeholder=":tada: Deal {{deal.name}} closed for ${{deal.value}}!"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Webhook URL</label>
                          <input
                            type="url"
                            value={selectedNode.data.slackWebhook || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { slackWebhook: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="https://hooks.slack.com/services/..."
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.slackMention || false}
                              onChange={(e) => updateNodeData(selectedNode.id, { slackMention: e.target.checked })}
                              className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                            />
                            @mention users in message
                          </label>
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
                            placeholder="Discussed pricing options. Customer interested in {{product.name}}..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Attach To</label>
                          <select
                            value={selectedNode.data.attachTo || 'deal'}
                            onChange={(e) => updateNodeData(selectedNode.id, { attachTo: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="deal">Current Deal</option>
                            <option value="contact">Current Contact</option>
                            <option value="company">Current Company</option>
                            <option value="task">Current Task</option>
                          </select>
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-sm text-gray-300">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.noteInternal || false}
                              onChange={(e) => updateNodeData(selectedNode.id, { noteInternal: e.target.checked })}
                              className="rounded border-gray-600 bg-gray-800/50 text-[#37bd7e] focus:ring-[#37bd7e]/30"
                            />
                            Internal note (not visible to customers)
                          </label>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'update_fields' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Entity Type</label>
                          <select
                            value={selectedNode.data.entityType || 'deal'}
                            onChange={(e) => updateNodeData(selectedNode.id, { entityType: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                          >
                            <option value="deal">Deal</option>
                            <option value="contact">Contact</option>
                            <option value="company">Company</option>
                            <option value="task">Task</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Field Updates</label>
                          <div className="space-y-2">
                            {(selectedNode.data.fieldUpdates || [{ field: '', value: '' }]).map((update: any, index: number) => (
                              <div key={index} className="flex gap-2">
                                <input
                                  type="text"
                                  value={update.field || ''}
                                  onChange={(e) => {
                                    const updates = [...(selectedNode.data.fieldUpdates || [])];
                                    updates[index] = { ...updates[index], field: e.target.value };
                                    updateNodeData(selectedNode.id, { fieldUpdates: updates });
                                  }}
                                  className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                  placeholder="Field name"
                                />
                                <input
                                  type="text"
                                  value={update.value || ''}
                                  onChange={(e) => {
                                    const updates = [...(selectedNode.data.fieldUpdates || [])];
                                    updates[index] = { ...updates[index], value: e.target.value };
                                    updateNodeData(selectedNode.id, { fieldUpdates: updates });
                                  }}
                                  className="flex-1 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                                  placeholder="New value"
                                />
                                <button
                                  onClick={() => {
                                    const updates = (selectedNode.data.fieldUpdates || []).filter((_: any, i: number) => i !== index);
                                    updateNodeData(selectedNode.id, { fieldUpdates: updates });
                                  }}
                                  className="px-2 text-red-400 hover:text-red-300"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <button
                              onClick={() => {
                                const updates = [...(selectedNode.data.fieldUpdates || []), { field: '', value: '' }];
                                updateNodeData(selectedNode.id, { fieldUpdates: updates });
                              }}
                              className="text-sm text-[#37bd7e] hover:text-[#2d9a64]"
                            >
                              + Add field
                            </button>
                          </div>
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'send_webhook' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Webhook URL</label>
                          <input
                            type="url"
                            value={selectedNode.data.webhookUrl || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookUrl: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="https://api.example.com/webhook"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">HTTP Method</label>
                          <select
                            value={selectedNode.data.webhookMethod || 'POST'}
                            onChange={(e) => updateNodeData(selectedNode.id, { webhookMethod: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
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
                            value={selectedNode.data.webhookHeaders || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { webhookHeaders: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-16 font-mono text-xs"
                            placeholder={'{"Authorization": "Bearer {{api_key}}", "Content-Type": "application/json"}'}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Body (JSON)</label>
                          <textarea
                            value={selectedNode.data.webhookBody || ''}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateNodeData(selectedNode.id, { webhookBody: e.target.value });
                            }}
                            onMouseDown={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-24 font-mono text-xs"
                            placeholder={'{"deal_id": "{{deal.id}}", "stage": "{{deal.stage}}", "value": {{deal.value}}}'}
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.data.type === 'edit_fields' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Field Mappings</label>
                          <div className="space-y-3">
                            {(selectedNode.data.fieldMappings || []).map((mapping: any, index: number) => (
                              <div key={index} className="bg-gray-800/30 border border-gray-700 rounded-lg p-3">
                                <div className="grid grid-cols-1 gap-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Source Variable</label>
                                    <input
                                      type="text"
                                      value={mapping.sourceField || ''}
                                      onChange={(e) => {
                                        const newMappings = [...(selectedNode.data.fieldMappings || [])];
                                        newMappings[index] = { ...newMappings[index], sourceField: e.target.value };
                                        updateNodeData(selectedNode.id, { fieldMappings: newMappings });
                                      }}
                                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none"
                                      placeholder="{{formData.fields.name}} or existing variable"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">New Variable Name</label>
                                    <input
                                      type="text"
                                      value={mapping.targetField || ''}
                                      onChange={(e) => {
                                        const newMappings = [...(selectedNode.data.fieldMappings || [])];
                                        newMappings[index] = { ...newMappings[index], targetField: e.target.value };
                                        updateNodeData(selectedNode.id, { fieldMappings: newMappings });
                                      }}
                                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none"
                                      placeholder="customerName, userEmail, etc."
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-medium text-gray-400 mb-1">Transformation (Optional)</label>
                                    <select
                                      value={mapping.transformation || 'none'}
                                      onChange={(e) => {
                                        const newMappings = [...(selectedNode.data.fieldMappings || [])];
                                        newMappings[index] = { ...newMappings[index], transformation: e.target.value };
                                        updateNodeData(selectedNode.id, { fieldMappings: newMappings });
                                      }}
                                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-[#37bd7e] outline-none cursor-pointer"
                                    >
                                      <option value="none">No transformation</option>
                                      <option value="uppercase">UPPERCASE</option>
                                      <option value="lowercase">lowercase</option>
                                      <option value="capitalize">Capitalize First Letter</option>
                                      <option value="trim">Remove spaces</option>
                                      <option value="email_domain">Extract email domain</option>
                                    </select>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    const newMappings = (selectedNode.data.fieldMappings || []).filter((_: any, i: number) => i !== index);
                                    updateNodeData(selectedNode.id, { fieldMappings: newMappings });
                                  }}
                                  className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                                >
                                  ✕ Remove mapping
                                </button>
                              </div>
                            ))}
                          </div>
                          
                          <button
                            onClick={() => {
                              const newMappings = [...(selectedNode.data.fieldMappings || []), { sourceField: '', targetField: '', transformation: 'none' }];
                              updateNodeData(selectedNode.id, { fieldMappings: newMappings });
                            }}
                            className="mt-3 w-full px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-600/30 rounded-lg text-green-400 text-sm transition-colors"
                          >
                            + Add Field Mapping
                          </button>
                        </div>
                        
                        <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                          <h4 className="text-sm font-medium text-purple-400 mb-2">🔄 Variable Transformer</h4>
                          <div className="text-xs text-gray-400 space-y-1">
                            <div>• Transform existing variables into new ones</div>
                            <div>• Useful for renaming fields, formatting data</div>
                            <div>• New variables available to connected nodes</div>
                            <div>• Example: {'{{formData.fields.email}}'} → customerEmail</div>
                          </div>
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* Fathom Webhook-specific settings */}
                {selectedNode.type === 'fathomWebhook' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Webhook URL</label>
                        <div className="bg-gray-800/50 rounded-lg p-3">
                          <code className="text-xs text-purple-400 break-all">
                            {window.location.origin}/api/workflows/webhook/{workflowId || selectedWorkflow?.id || '[save-workflow-first]'}
                          </code>
                          <button
                            onClick={() => {
                              const webhookUrl = `${window.location.origin}/api/workflows/webhook/${workflowId || selectedWorkflow?.id || '[save-workflow-first]'}`;
                              navigator.clipboard.writeText(webhookUrl);
                              // Show a quick toast or feedback
                              const btn = event.currentTarget as HTMLButtonElement;
                              const originalText = btn.textContent;
                              btn.textContent = 'Copied!';
                              setTimeout(() => {
                                btn.textContent = originalText;
                              }, 2000);
                            }}
                            className="mt-2 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                          >
                            Copy URL
                          </button>
                          {(!workflowId && !selectedWorkflow?.id) && (
                            <p className="text-xs text-amber-400 mt-2">
                              ⚠️ Save the workflow first to get your unique webhook URL
                            </p>
                          )}
                          <p className="text-[10px] text-gray-500 mt-2">
                            Copy this URL to your Fathom webhook settings
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Accepted Event Types</label>
                        <div className="space-y-2">
                          {['transcript', 'summary', 'action_items', 'coaching_summary'].map((eventType) => (
                            <label key={eventType} className="flex items-center gap-2 cursor-pointer hover:bg-gray-800/30 p-2 rounded">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.payloadTypes?.includes(eventType) || false}
                                onChange={(e) => {
                                  const currentTypes = selectedNode.data.payloadTypes || [];
                                  const newTypes = e.target.checked
                                    ? [...currentTypes, eventType]
                                    : currentTypes.filter(t => t !== eventType);
                                  updateNodeData(selectedNode.id, { 
                                    payloadTypes: newTypes,
                                    isConfigured: newTypes.length > 0
                                  });
                                }}
                                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded focus:ring-purple-500"
                              />
                              <span className="text-sm text-gray-300 capitalize">{eventType.replace('_', ' ')}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Processing Configuration</label>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.extractFathomId || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config,
                                    extractFathomId: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Extract Fathom Meeting ID</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.validatePayload || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config,
                                    validatePayload: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Validate Payload Structure</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-blue-400 mb-2">Available Variables</h4>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-blue-300">
                          <div>• {'{{payload.title}}'}</div>
                          <div>• {'{{payload.date}}'}</div>
                          <div>• {'{{payload.transcript}}'}</div>
                          <div>• {'{{payload.duration}}'}</div>
                          <div>• {'{{payload.summary}}'}</div>
                          <div>• {'{{payload.participants}}'}</div>
                          <div>• {'{{payload.action_items}}'}</div>
                          <div>• {'{{payload.organizer_email}}'}</div>
                          <div>• {'{{payload.attendees}}'}</div>
                          <div>• {'{{payload.key_points}}'}</div>
                          <div>• {'{{payload.fathom_id}}'}</div>
                          <div>• {'{{payload.decisions}}'}</div>
                          <div>• {'{{payload.recording_url}}'}</div>
                          <div>• {'{{payload.next_steps}}'}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Action Item Processor Configuration */}
                {selectedNode.type === 'actionItemProcessor' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Task Categories</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.categorizeByRole || false}
                              onChange={(e) => updateNodeData(selectedNode.id, { 
                                config: { ...selectedNode.data.config, categorizeByRole: e.target.checked }
                              })}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Categorize tasks by role (Sales Rep / Client)</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Priority Mapping</label>
                        <div className="space-y-2">
                          {['urgent', 'high', 'medium', 'low'].map(priority => (
                            <div key={priority} className="flex items-center gap-2">
                              <span className="text-sm text-gray-400 capitalize w-20">{priority}:</span>
                              <select
                                value={selectedNode.data.config?.deadlineCalculation?.[priority] || (priority === 'urgent' ? 1 : priority === 'high' ? 3 : priority === 'medium' ? 7 : 14)}
                                onChange={(e) => updateNodeData(selectedNode.id, {
                                  config: {
                                    ...selectedNode.data.config,
                                    deadlineCalculation: {
                                      ...selectedNode.data.config?.deadlineCalculation,
                                      [priority]: parseInt(e.target.value)
                                    }
                                  }
                                })}
                                className="flex-1 px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-xs"
                              >
                                <option value="1">1 day</option>
                                <option value="3">3 days</option>
                                <option value="7">1 week</option>
                                <option value="14">2 weeks</option>
                                <option value="30">1 month</option>
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-purple-400 mb-2">Processing Features</h4>
                        <ul className="text-[10px] text-purple-300 space-y-1">
                          <li>• Extracts action items from meeting data</li>
                          <li>• Categorizes by role and priority</li>
                          <li>• Sets automatic deadlines based on priority</li>
                          <li>• Accounts for weekends in deadline calculation</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {/* Metrics Calculator Configuration */}
                {selectedNode.type === 'metricsCalculator' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Metrics to Calculate</label>
                        <div className="space-y-2">
                          {[
                            { id: 'talkTime', label: 'Talk Time Distribution' },
                            { id: 'engagement', label: 'Engagement Score' },
                            { id: 'nextSteps', label: 'Next Steps Clarity' },
                            { id: 'sentiment', label: 'Overall Sentiment' }
                          ].map(metric => (
                            <label key={metric.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.config?.metrics?.[metric.id] !== false}
                                onChange={(e) => updateNodeData(selectedNode.id, {
                                  config: {
                                    ...selectedNode.data.config,
                                    metrics: {
                                      ...selectedNode.data.config?.metrics,
                                      [metric.id]: e.target.checked
                                    }
                                  }
                                })}
                                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                              />
                              <span className="text-sm text-gray-300">{metric.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-blue-400 mb-2">Calculated Metrics</h4>
                        <ul className="text-[10px] text-blue-300 space-y-1">
                          <li>• Talk time ratio (rep vs customer)</li>
                          <li>• Engagement level based on interaction</li>
                          <li>• Next steps clarity score</li>
                          <li>• Overall sentiment analysis</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {/* Sales Coach Configuration */}
                {selectedNode.type === 'salesCoach' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Coaching Areas</label>
                        <div className="space-y-2">
                          {[
                            { id: 'objectionHandling', label: 'Objection Handling' },
                            { id: 'closingTechniques', label: 'Closing Techniques' },
                            { id: 'discovery', label: 'Discovery Questions' },
                            { id: 'valueProposition', label: 'Value Proposition' }
                          ].map(area => (
                            <label key={area.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={selectedNode.data.config?.coachingAreas?.[area.id] !== false}
                                onChange={(e) => updateNodeData(selectedNode.id, {
                                  config: {
                                    ...selectedNode.data.config,
                                    coachingAreas: {
                                      ...selectedNode.data.config?.coachingAreas,
                                      [area.id]: e.target.checked
                                    }
                                  }
                                })}
                                className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                              />
                              <span className="text-sm text-gray-300">{area.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Coaching Intensity</label>
                        <select
                          value={selectedNode.data.config?.intensity || 'balanced'}
                          onChange={(e) => updateNodeData(selectedNode.id, {
                            config: { ...selectedNode.data.config, intensity: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm"
                        >
                          <option value="light">Light - Key highlights only</option>
                          <option value="balanced">Balanced - Main areas for improvement</option>
                          <option value="detailed">Detailed - Comprehensive feedback</option>
                        </select>
                      </div>

                      <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-green-400 mb-2">Coaching Insights</h4>
                        <ul className="text-[10px] text-green-300 space-y-1">
                          <li>• Personalized feedback based on call performance</li>
                          <li>• Specific improvement suggestions</li>
                          <li>• Best practices reinforcement</li>
                          <li>• Action items for skill development</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {/* Google Doc Creator Configuration */}
                {selectedNode.type === 'googleDocCreator' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Document Template</label>
                        <select
                          value={selectedNode.data.config?.template || 'meeting_summary'}
                          onChange={(e) => updateNodeData(selectedNode.id, {
                            config: { ...selectedNode.data.config, template: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm"
                        >
                          <option value="meeting_summary">Meeting Summary</option>
                          <option value="call_notes">Call Notes</option>
                          <option value="action_items">Action Items List</option>
                          <option value="comprehensive">Comprehensive Report</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Google Drive Folder ID</label>
                        <input
                          type="text"
                          value={selectedNode.data.config?.folderId || ''}
                          onChange={(e) => updateNodeData(selectedNode.id, {
                            config: { ...selectedNode.data.config, folderId: e.target.value }
                          })}
                          placeholder="Optional: Specific folder ID"
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedNode.data.config?.shareWithTeam || false}
                            onChange={(e) => updateNodeData(selectedNode.id, {
                              config: { ...selectedNode.data.config, shareWithTeam: e.target.checked }
                            })}
                            className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                          />
                          <span className="text-sm text-gray-300">Share with team members</span>
                        </label>
                      </div>

                      <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-yellow-400 mb-2">Document Features</h4>
                        <ul className="text-[10px] text-yellow-300 space-y-1">
                          <li>• Creates formatted Google Docs</li>
                          <li>• Includes meeting summary and action items</li>
                          <li>• Links to original Fathom recording</li>
                          <li>• Automatically shares with specified users</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {/* Database Saver Configuration */}
                {selectedNode.type === 'databaseSaver' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Save Options</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.saveMeeting !== false}
                              onChange={(e) => updateNodeData(selectedNode.id, {
                                config: { ...selectedNode.data.config, saveMeeting: e.target.checked }
                              })}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Save meeting data</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.saveActionItems !== false}
                              onChange={(e) => updateNodeData(selectedNode.id, {
                                config: { ...selectedNode.data.config, saveActionItems: e.target.checked }
                              })}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Save action items</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.saveMetrics || false}
                              onChange={(e) => updateNodeData(selectedNode.id, {
                                config: { ...selectedNode.data.config, saveMetrics: e.target.checked }
                              })}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Save performance metrics</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-gray-800/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Database Tables</h4>
                        <ul className="text-[10px] text-gray-300 space-y-1">
                          <li>• meetings - Main meeting records</li>
                          <li>• meeting_action_items - Task tracking</li>
                          <li>• meeting_metrics - Performance data</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {/* Task Creator Configuration */}
                {selectedNode.type === 'taskCreator' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Task Creation Settings</label>
                        <div className="space-y-2">
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.autoAssign !== false}
                              onChange={(e) => updateNodeData(selectedNode.id, {
                                config: { ...selectedNode.data.config, autoAssign: e.target.checked }
                              })}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Auto-assign based on role</span>
                          </label>
                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.sendNotifications || false}
                              onChange={(e) => updateNodeData(selectedNode.id, {
                                config: { ...selectedNode.data.config, sendNotifications: e.target.checked }
                              })}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Send notifications to assignees</span>
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Default Priority</label>
                        <select
                          value={selectedNode.data.config?.defaultPriority || 'medium'}
                          onChange={(e) => updateNodeData(selectedNode.id, {
                            config: { ...selectedNode.data.config, defaultPriority: e.target.value }
                          })}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="urgent">Urgent</option>
                        </select>
                      </div>

                      <div className="bg-indigo-900/20 border border-indigo-700/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-indigo-400 mb-2">Task Features</h4>
                        <ul className="text-[10px] text-indigo-300 space-y-1">
                          <li>• Creates tasks from action items</li>
                          <li>• Sets deadlines based on priority</li>
                          <li>• Links tasks to meeting records</li>
                          <li>• Triggers follow-up automation</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}

                {/* AI Agent Node Configuration */}
                {selectedNode.type === 'aiAgent' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Model Provider</label>
                        <select
                          value={selectedNode.data.aiProvider || 'openai'}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, { aiProvider: e.target.value });
                          }}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-600 outline-none"
                        >
                          <option value="openai">OpenAI</option>
                          <option value="anthropic">Anthropic</option>
                          <option value="openrouter">OpenRouter</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Model</label>
                        <select
                          value={selectedNode.data.model || 'gpt-4'}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, { model: e.target.value });
                          }}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-600 outline-none"
                        >
                          {selectedNode.data.aiProvider === 'openai' && (
                            <>
                              <option value="gpt-4">GPT-4</option>
                              <option value="gpt-4-turbo-preview">GPT-4 Turbo</option>
                              <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                            </>
                          )}
                          {selectedNode.data.aiProvider === 'anthropic' && (
                            <>
                              <option value="claude-3-opus">Claude 3 Opus</option>
                              <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                              <option value="claude-3-haiku">Claude 3 Haiku</option>
                            </>
                          )}
                          {selectedNode.data.aiProvider === 'openrouter' && (
                            <>
                              <option value="meta-llama/llama-2-70b-chat">Llama 2 70B</option>
                              <option value="mistralai/mixtral-8x7b">Mixtral 8x7B</option>
                            </>
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">System Prompt</label>
                        <textarea
                          value={selectedNode.data.systemPrompt || ''}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, { systemPrompt: e.target.value });
                          }}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-600 outline-none resize-none h-24 font-mono text-xs"
                          placeholder="You are a meeting analyst. Extract key insights, decisions, and next steps from meeting summaries."
                        />
                        <div className="flex gap-2 mt-1">
                          <button
                            onClick={() => {
                              updateNodeData(selectedNode.id, { 
                                systemPrompt: 'You are a meeting analyst specializing in extracting actionable insights from meeting transcripts and summaries. Your role is to identify key decisions, risks, follow-up requirements, and strategic insights that help teams stay aligned and productive.'
                              });
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300"
                          >
                            Use meeting analyst prompt
                          </button>
                          {selectedNode.data.label === 'Analyze Summary' && (
                            <>
                              <button
                                onClick={() => {
                                  updateNodeData(selectedNode.id, { 
                                    systemPrompt: 'You are an expert meeting analyst for the Fathom integration workflow. Your primary responsibility is to analyze meeting summaries and extract structured, actionable insights that will be used to automatically create tasks, update CRM records, and notify team members. You must provide clear, categorized output that downstream workflow nodes can process effectively. Focus on identifying concrete action items, key decisions with clear owners, potential risks that need mitigation, and strategic insights that impact the business.'
                                  });
                                }}
                                className="text-xs text-green-400 hover:text-green-300"
                              >
                                Use Fathom workflow prompt ✓
                              </button>
                              <button
                                onClick={() => {
                                  updateNodeData(selectedNode.id, { 
                                    systemPrompt: 'You are an expert B2B sales coach analyzing meeting transcripts to provide actionable coaching insights. Your analysis helps sales teams improve performance and close more deals.\n\nFocus areas:\n- Talk time ratio (ideal: customer 60-70%, rep 30-40%)\n- Discovery question quality and effectiveness\n- Objection handling techniques\n- Closing attempts and effectiveness\n- Next steps clarity and ownership\n- Buyer engagement signals\n- Risk factor identification\n- Deal progression likelihood\n\nProvide structured, measurable coaching insights that drive improvement.'
                                  });
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300"
                              >
                                Use Sales Coaching prompt ⭐
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">User Prompt Template</label>
                        <textarea
                          value={selectedNode.data.userPrompt || ''}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, { userPrompt: e.target.value });
                          }}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-purple-600 outline-none resize-none h-32 font-mono text-xs"
                          placeholder="Analyze the meeting data and extract insights..."
                        />
                        {!selectedNode.data.userPrompt ? (
                          <div className="flex gap-2 mt-1">
                            <button
                              onClick={() => {
                                updateNodeData(selectedNode.id, { 
                                  userPrompt: `Analyze this meeting summary from Fathom and extract the following:

## 1. KEY DECISIONS MADE
List all concrete decisions reached during the meeting with decision owners.

## 2. IMPORTANT TOPICS DISCUSSED  
Summarize the main discussion points and their outcomes.

## 3. RISKS OR CONCERNS RAISED
Identify any risks, blockers, or concerns mentioned that need attention.

## 4. FOLLOW-UP REQUIREMENTS
List all action items, next steps, and follow-ups with assigned owners and deadlines.

## 5. STRATEGIC INSIGHTS
Extract high-level insights and strategic implications from the discussion.

Meeting Summary:
${'{{payload.summary}}'}

Meeting Title: ${'{{payload.title}}'}
Participants: ${'{{payload.participants}}'}
Duration: ${'{{payload.duration}}'} minutes
Date: ${'{{payload.date}}'}

Additional Context:
- Fathom Recording ID: ${'{{payload.fathom_id}}'}
- Share URL: ${'{{payload.share_url}}'}

Return your analysis as structured JSON with the following format:
{
  "decisions": [{"decision": "...", "owner": "...", "context": "..."}],
  "topics": [{"topic": "...", "summary": "...", "outcome": "..."}],
  "risks": [{"risk": "...", "severity": "high/medium/low", "mitigation": "..."}],
  "followUps": [{"action": "...", "owner": "...", "deadline": "...", "priority": "..."}],
  "insights": [{"insight": "...", "impact": "...", "recommendation": "..."}],
  "tags": ["tag1", "tag2", "tag3"]
}`
                              });
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300"
                          >
                            Use general analysis prompt
                          </button>
                          {selectedNode.data.label === 'Analyze Summary' && (
                            <>
                            <button
                              onClick={() => {
                                updateNodeData(selectedNode.id, { 
                                  userPrompt: `You are analyzing a meeting summary that has been processed by Fathom. Your analysis will be used by the workflow to:
1. Create actionable tasks in the CRM
2. Update the meeting record in the database
3. Send notifications to relevant team members
4. Generate follow-up actions

Please analyze the following meeting data and provide a comprehensive, structured response:

**Meeting Summary:**
${'{{payload.summary}}'}

**Meeting Context:**
- Title: ${'{{payload.title}}'}
- Date: ${'{{payload.date}}'}
- Duration: ${'{{payload.duration}}'} minutes
- Participants: ${'{{payload.participants}}'}
- Organizer: ${'{{payload.organizer}}'}

**Additional Data Available:**
- Transcript available: ${'{{payload.transcript ? "Yes" : "No"}}'}
- Action items provided: ${'{{payload.action_items ? "Yes" : "No"}}'}
- Recording URL: ${'{{payload.share_url}}'}

**REQUIRED OUTPUT STRUCTURE:**

Return a JSON object with the following structure that will be used by downstream workflow nodes:

{
  "decisions": [
    {
      "decision": "Clear description of the decision",
      "owner": "Person responsible",
      "deadline": "When it needs to be implemented",
      "impact": "Business impact of this decision"
    }
  ],
  "risks": [
    {
      "risk": "Description of the risk or concern",
      "severity": "critical|high|medium|low",
      "owner": "Person who should address this",
      "mitigation": "Suggested mitigation strategy",
      "deadline": "When this needs attention"
    }
  ],
  "action_items": [
    {
      "title": "Clear, actionable task title",
      "description": "Detailed description of what needs to be done",
      "assignee": "Person responsible (match with participants)",
      "priority": "urgent|high|medium|low",
      "due_date": "Suggested deadline in ISO format or relative days",
      "category": "Follow-up|Technical|Administrative|Review|Decision",
      "dependencies": ["List any dependencies mentioned"]
    }
  ],
  "key_topics": [
    {
      "topic": "Main discussion topic",
      "summary": "What was discussed",
      "outcome": "What was decided or next steps",
      "owner": "Who is driving this forward"
    }
  ],
  "insights": [
    {
      "insight": "Strategic observation or learning",
      "impact": "Why this matters to the business",
      "recommendation": "What should be done about it",
      "priority": "How urgent is this"
    }
  ],
  "follow_up_required": {
    "next_meeting": "Suggested date/timeframe for follow-up",
    "attendees_needed": ["List of people who should attend"],
    "agenda_items": ["Topics that need to be discussed"]
  },
  "tags": ["meeting-type", "department", "project", "strategic-initiative"],
  "sentiment": "positive|neutral|concerning|critical",
  "meeting_effectiveness": "highly-productive|productive|average|needs-improvement",
  "summary_for_notification": "2-3 sentence summary suitable for Slack/email notifications"
}`
                                });
                              }}
                              className="text-xs text-green-400 hover:text-green-300"
                            >
                              Use Fathom workflow prompt ✓
                            </button>
                            <button
                              onClick={() => {
                                updateNodeData(selectedNode.id, { 
                                  userPrompt: `Analyze this sales meeting transcript for coaching opportunities:

**Transcript:** ${'{{googleDoc.content || payload.transcript}}'}
**Participants:** ${'{{payload.participants}}'}
**Duration:** ${'{{payload.duration}}'} minutes
**Deal Stage:** ${'{{deal.stage || "Unknown"}}'}
**Meeting Type:** ${'{{payload.title}}'}

**Required Analysis:**
Provide your coaching analysis as structured JSON:

{
  "talk_time_analysis": {
    "customer_percentage": 0,
    "rep_percentage": 0,
    "coaching_note": "Assessment of talk time ratio and recommendations"
  },
  "discovery_score": {
    "score": 0,
    "strengths": ["effective discovery techniques used"],
    "improvements": ["specific areas to improve questioning"]
  },
  "objection_handling": {
    "score": 0,
    "objections_raised": ["objection 1", "objection 2"],
    "handling_effectiveness": "Assessment of how objections were addressed",
    "missed_opportunities": ["areas where objections could have been better handled"]
  },
  "engagement_level": {
    "score": 0,
    "positive_signals": ["signs of customer interest and engagement"],
    "concerning_signals": ["red flags or disengagement indicators"]
  },
  "opportunity_score": 0,
  "buying_signals": ["explicit or implicit buying interest shown"],
  "risk_factors": ["concerns that could derail the deal"],
  "next_steps_clarity": {
    "score": 0,
    "defined_next_steps": ["specific next steps with owners"],
    "missing_elements": ["what should have been clarified"]
  },
  "coaching_priorities": ["top 3 coaching areas for this rep"],
  "manager_review_needed": false,
  "stage_progression_recommendation": "advance|maintain|regress",
  "follow_up_suggestions": ["specific recommended follow-up actions"]
}`
                                });
                              }}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Use Sales Coaching prompt ⭐
                            </button>
                            </>
                          )}
                        </div>
                        ) : null}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Temperature</label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={selectedNode.data.temperature || 0.3}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, { temperature: parseFloat(e.target.value) });
                          }}
                          className="w-full"
                        />
                        <div className="text-xs text-gray-400 mt-1">
                          Value: {selectedNode.data.temperature || 0.3} (Lower = More focused, Higher = More creative)
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Max Tokens</label>
                        <input
                          type="number"
                          min="100"
                          max="4000"
                          value={selectedNode.data.maxTokens || 1500}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, { maxTokens: parseInt(e.target.value) });
                          }}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-600 outline-none"
                          placeholder="1500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Output Format</label>
                        <select
                          value={selectedNode.data.outputFormat || 'structured_json'}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, { outputFormat: e.target.value });
                          }}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-600 outline-none"
                        >
                          <option value="text">Plain Text</option>
                          <option value="structured_json">Structured JSON</option>
                          <option value="markdown">Markdown</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Advanced Options</label>
                        <div className="space-y-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.extractKeyPoints || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config,
                                    extractKeyPoints: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Extract Key Points</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.identifyRisks || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config,
                                    identifyRisks: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Identify Risks</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.suggestFollowUps || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config,
                                    suggestFollowUps: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Suggest Follow-ups</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.generateTags || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config,
                                    generateTags: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Generate Tags</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedNode.data.config?.sentimentAnalysis || false}
                              onChange={(e) => {
                                updateNodeData(selectedNode.id, { 
                                  config: {
                                    ...selectedNode.data.config,
                                    sentimentAnalysis: e.target.checked
                                  }
                                });
                              }}
                              className="w-4 h-4 text-purple-600 bg-gray-800 border-gray-600 rounded"
                            />
                            <span className="text-sm text-gray-300">Sentiment Analysis</span>
                          </label>
                        </div>
                      </div>

                      <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-purple-400 mb-2">Available Variables</h4>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-purple-300">
                          <div>• {'{{payload.summary}}'}</div>
                          <div>• {'{{payload.title}}'}</div>
                          <div>• {'{{payload.participants}}'}</div>
                          <div>• {'{{payload.duration}}'}</div>
                          <div>• {'{{payload.action_items}}'}</div>
                          <div>• {'{{payload.transcript}}'}</div>
                          <div>• {'{{aiAnalysis.output}}'}</div>
                          <div>• {'{{aiAnalysis.decisions}}'}</div>
                          <div>• {'{{aiAnalysis.tags}}'}</div>
                          <div>• {'{{processedActions.items}}'}</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* ConditionalBranch node configuration */}
                {selectedNode.type === 'conditionalBranch' && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Conditional Branch Configuration</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Branch Description
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data.label || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, { label: e.target.value });
                        }}
                        placeholder="Route by Content Type"
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Conditions
                      </label>
                      <div className="space-y-3">
                        {(selectedNode.data.conditions || []).map((condition: any, index: number) => (
                          <div key={condition.id || index} className="bg-gray-800/30 p-3 rounded-lg">
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={condition.field || ''}
                                onChange={(e) => {
                                  const newConditions = [...(selectedNode.data.conditions || [])];
                                  newConditions[index] = { ...condition, field: e.target.value };
                                  updateNodeData(selectedNode.id, { conditions: newConditions });
                                }}
                                placeholder="Field (e.g., {'{{payload.transcript}}'})"
                                className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                              />
                              
                              <select
                                value={condition.operator || 'exists'}
                                onChange={(e) => {
                                  const newConditions = [...(selectedNode.data.conditions || [])];
                                  newConditions[index] = { ...condition, operator: e.target.value };
                                  updateNodeData(selectedNode.id, { conditions: newConditions });
                                }}
                                className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white"
                              >
                                <option value="exists">Exists</option>
                                <option value="equals">Equals</option>
                                <option value="contains">Contains</option>
                                <option value="greater_than">Greater Than</option>
                                <option value="less_than">Less Than</option>
                                <option value="not_equals">Not Equals</option>
                                <option value="is_empty">Is Empty</option>
                              </select>
                              
                              {condition.operator !== 'exists' && condition.operator !== 'is_empty' && (
                                <input
                                  type="text"
                                  value={condition.value || ''}
                                  onChange={(e) => {
                                    const newConditions = [...(selectedNode.data.conditions || [])];
                                    newConditions[index] = { ...condition, value: e.target.value };
                                    updateNodeData(selectedNode.id, { conditions: newConditions });
                                  }}
                                  placeholder="Value"
                                  className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                                />
                              )}
                              
                              <input
                                type="text"
                                value={condition.output || ''}
                                onChange={(e) => {
                                  const newConditions = [...(selectedNode.data.conditions || [])];
                                  newConditions[index] = { ...condition, output: e.target.value };
                                  updateNodeData(selectedNode.id, { conditions: newConditions });
                                }}
                                placeholder="Output branch name (e.g., transcript)"
                                className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                              />
                            </div>
                          </div>
                        ))}
                        
                        <button
                          onClick={() => {
                            const newCondition = {
                              id: `condition-${Date.now()}`,
                              field: '',
                              operator: 'exists',
                              value: '',
                              output: ''
                            };
                            updateNodeData(selectedNode.id, {
                              conditions: [...(selectedNode.data.conditions || []), newCondition]
                            });
                          }}
                          className="w-full px-3 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-sm transition-colors"
                        >
                          + Add Condition
                        </button>
                      </div>
                    </div>

                    <div className="bg-gray-800/30 p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-2">Available Variables:</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>• {'{{payload}}'} - Incoming webhook data</div>
                        <div>• {'{{payload.transcript}}'} - Meeting transcript</div>
                        <div>• {'{{payload.action_items}}'} - Action items</div>
                        <div>• {'{{payload.summary}}'} - Meeting summary</div>
                        <div>• {'{{payload.participants}}'} - Participant list</div>
                      </div>
                    </div>
                  </>
                )}

                {/* GoogleDocsCreator node configuration */}
                {selectedNode.type === 'googleDocsCreator' && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Google Docs Creator Configuration</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Document Title
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data.docTitle || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, { docTitle: e.target.value });
                        }}
                        placeholder="Meeting Transcript - {'{{payload.title}}'}"
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Document Content
                      </label>
                      <textarea
                        value={selectedNode.data.config?.content || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, {
                            config: { ...(selectedNode.data.config || {}), content: e.target.value }
                          });
                        }}
                        placeholder="# Meeting: {'{{payload.title}}'}\n\n**Date**: {'{{payload.date}}'}\n**Duration**: {'{{payload.duration}}'} minutes\n**Participants**: {'{{payload.participants}}'}\n\n## Transcript\n\n{'{{payload.transcript}}'}"
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors h-32 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Google Drive Folder ID
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data.config?.folderId || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, {
                            config: { ...(selectedNode.data.config || {}), folderId: e.target.value }
                          });
                        }}
                        placeholder="{'{{env.GOOGLE_DRIVE_FOLDER_ID}}'}"
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.formatTranscript || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), formatTranscript: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Format transcript for readability
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.addTimestamps || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), addTimestamps: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Add timestamps to transcript
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.shareWithAI || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), shareWithAI: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Share with AI for analysis
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.vectorDbReady || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), vectorDbReady: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Prepare for vector database
                      </label>
                    </div>
                  </>
                )}

                {/* ActionItemProcessor node configuration */}
                {selectedNode.type === 'actionItemProcessor' && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Action Item Processor Configuration</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        AI Model
                      </label>
                      <select
                        value={selectedNode.data.config?.aiModel || 'gpt-4'}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, {
                            config: { ...(selectedNode.data.config || {}), aiModel: e.target.value }
                          });
                        }}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                      >
                        <option value="gpt-4">GPT-4</option>
                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                        <option value="claude-3-opus">Claude 3 Opus</option>
                        <option value="claude-3-sonnet">Claude 3 Sonnet</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        AI Prompt
                      </label>
                      <textarea
                        value={selectedNode.data.config?.aiPrompt || ''}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, {
                            config: { ...(selectedNode.data.config || {}), aiPrompt: e.target.value }
                          });
                        }}
                        placeholder="Analyze these action items from the meeting:\n\n{'{{payload.action_items}}'}\n\nFor each action item:\n1. Classify priority (urgent/high/medium/low) based on context\n2. Identify the responsible person from: {'{{payload.participants}}'}\n3. Suggest a reasonable deadline (in business days)\n4. Add relevant tags and categories\n5. Extract any dependencies\n\nReturn as structured JSON."
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors h-32 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Default Deadline (days)
                      </label>
                      <input
                        type="number"
                        value={selectedNode.data.config?.defaultDeadlineDays || 3}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, {
                            config: { ...(selectedNode.data.config || {}), defaultDeadlineDays: parseInt(e.target.value) }
                          });
                        }}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Category Options
                      </label>
                      <input
                        type="text"
                        value={(selectedNode.data.config?.categoryOptions || []).join(', ')}
                        onChange={(e) => {
                          e.stopPropagation();
                          const categories = e.target.value.split(',').map(s => s.trim()).filter(s => s);
                          updateNodeData(selectedNode.id, {
                            config: { ...(selectedNode.data.config || {}), categoryOptions: categories }
                          });
                        }}
                        placeholder="Follow-up, Technical, Administrative, Review, Decision"
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.aiEnabled || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), aiEnabled: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Enable AI processing
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.calculateDeadlines || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), calculateDeadlines: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Calculate deadlines automatically
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.accountForWeekends || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), accountForWeekends: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Account for weekends in deadlines
                      </label>
                    </div>
                  </>
                )}

                {/* MeetingUpsert node configuration */}
                {selectedNode.type === 'meetingUpsert' && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Meeting Upsert Configuration</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Upsert Key
                      </label>
                      <input
                        type="text"
                        value={selectedNode.data.upsertKey || 'fathom_recording_id'}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateNodeData(selectedNode.id, { upsertKey: e.target.value });
                        }}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Field Mappings
                      </label>
                      <div className="space-y-2 bg-gray-800/30 p-3 rounded-lg max-h-64 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <span className="text-gray-400">title:</span>
                          <span className="text-gray-300">{'{{payload.title}}'}</span>
                          
                          <span className="text-gray-400">fathom_recording_id:</span>
                          <span className="text-gray-300">{'{{payload.fathom_id}}'}</span>
                          
                          <span className="text-gray-400">share_url:</span>
                          <span className="text-gray-300">{'{{payload.share_url}}'}</span>
                          
                          <span className="text-gray-400">video_url:</span>
                          <span className="text-gray-300">{'{{payload.video_url}}'}</span>
                          
                          <span className="text-gray-400">meeting_date:</span>
                          <span className="text-gray-300">{'{{payload.date}}'}</span>
                          
                          <span className="text-gray-400">duration_minutes:</span>
                          <span className="text-gray-300">{'{{payload.duration}}'}</span>
                          
                          <span className="text-gray-400">transcript:</span>
                          <span className="text-gray-300">{'{{payload.transcript}}'}</span>
                          
                          <span className="text-gray-400">transcript_doc_url:</span>
                          <span className="text-gray-300">{'{{googleDoc.url}}'}</span>
                          
                          <span className="text-gray-400">summary:</span>
                          <span className="text-gray-300">{'{{payload.summary}}'}</span>
                          
                          <span className="text-gray-400">ai_analysis:</span>
                          <span className="text-gray-300">{'{{aiAnalysis.output}}'}</span>
                          
                          <span className="text-gray-400">action_items:</span>
                          <span className="text-gray-300">{'{{processedActions.items}}'}</span>
                          
                          <span className="text-gray-400">tasks_created:</span>
                          <span className="text-gray-300">{'{{createdTasks.ids}}'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.createIfNotExists || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), createIfNotExists: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Create if not exists
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.updateExisting || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), updateExisting: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Update existing records
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.mergeArrays || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), mergeArrays: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Merge array fields
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.timestampFields || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), timestampFields: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Add timestamp fields
                      </label>

                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedNode.data.config?.auditLog || false}
                          onChange={(e) => {
                            updateNodeData(selectedNode.id, {
                              config: { ...(selectedNode.data.config || {}), auditLog: e.target.checked }
                            });
                          }}
                          className="mr-2 rounded bg-gray-700 border-gray-600"
                        />
                        Enable audit logging
                      </label>

                      {/* Contact & Company Enrichment Section */}
                      <div className="mt-4 p-3 bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg border border-green-500/30">
                        <h4 className="text-sm font-medium text-green-300 mb-3">🔗 Contact & Company Enrichment</h4>
                        
                        <label className="flex items-center text-sm text-gray-300 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedNode.data.config?.linkContacts || false}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), linkContacts: e.target.checked }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          Link meeting participants to CRM contacts
                        </label>

                        <label className="flex items-center text-sm text-gray-300 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedNode.data.config?.enrichContacts || false}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), enrichContacts: e.target.checked }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          Create new contacts for unknown participants
                        </label>

                        <label className="flex items-center text-sm text-gray-300 mb-2">
                          <input
                            type="checkbox"
                            checked={selectedNode.data.config?.createCompanies || false}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), createCompanies: e.target.checked }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          Auto-create companies from email domains
                        </label>

                        <label className="flex items-center text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedNode.data.config?.updateEngagement || false}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), updateEngagement: e.target.checked }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          Update contact engagement scores and interaction dates
                        </label>

                        <div className="mt-3 text-xs text-green-200 bg-green-900/20 p-2 rounded">
                          <div className="font-medium mb-1">Contact Enrichment Process:</div>
                          <div>• Match participants by email to existing contacts</div>
                          <div>• Create new contacts for unknown participants</div>
                          <div>• Extract company from email domain (@company.com)</div>
                          <div>• Update last interaction date and engagement score</div>
                          <div>• Link key topics discussed and next steps owned</div>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Multi-channel Notification Action configuration */}
                {selectedNode.type === 'action' && selectedNode.data.action === 'multi_channel_notify' && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-400 mb-3">Multi-Channel Notification Configuration</h3>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Notification Channels
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={(selectedNode.data.config?.channels || []).includes('slack')}
                            onChange={(e) => {
                              const channels = selectedNode.data.config?.channels || [];
                              const newChannels = e.target.checked 
                                ? [...channels, 'slack'].filter((v, i, a) => a.indexOf(v) === i)
                                : channels.filter(c => c !== 'slack');
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), channels: newChannels }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          Slack
                        </label>
                        <label className="flex items-center text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={(selectedNode.data.config?.channels || []).includes('email')}
                            onChange={(e) => {
                              const channels = selectedNode.data.config?.channels || [];
                              const newChannels = e.target.checked 
                                ? [...channels, 'email'].filter((v, i, a) => a.indexOf(v) === i)
                                : channels.filter(c => c !== 'email');
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), channels: newChannels }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          Email
                        </label>
                        <label className="flex items-center text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={(selectedNode.data.config?.channels || []).includes('in_app')}
                            onChange={(e) => {
                              const channels = selectedNode.data.config?.channels || [];
                              const newChannels = e.target.checked 
                                ? [...channels, 'in_app'].filter((v, i, a) => a.indexOf(v) === i)
                                : channels.filter(c => c !== 'in_app');
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), channels: newChannels }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          In-App Notification
                        </label>
                      </div>
                    </div>

                    {/* Slack Configuration */}
                    {(selectedNode.data.config?.channels || []).includes('slack') && (
                      <div className="bg-gray-800/30 p-3 rounded-lg space-y-2">
                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Slack Configuration</h4>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Channel</label>
                          <input
                            type="text"
                            value={selectedNode.data.config?.slackConfig?.channel || ''}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: {
                                  ...(selectedNode.data.config || {}),
                                  slackConfig: {
                                    ...(selectedNode.data.config?.slackConfig || {}),
                                    channel: e.target.value
                                  }
                                }
                              });
                            }}
                            placeholder="#meetings"
                            className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Message</label>
                          <textarea
                            value={selectedNode.data.config?.slackConfig?.message || ''}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: {
                                  ...(selectedNode.data.config || {}),
                                  slackConfig: {
                                    ...(selectedNode.data.config?.slackConfig || {}),
                                    message: e.target.value
                                  }
                                }
                              });
                            }}
                            placeholder=":white_check_mark: Meeting &quot;{'{{payload.title}}'}&quot; has been processed\n\n:memo: Summary: {'{{payload.summary|truncate:200}}'}\n:clipboard: Action Items: {'{{processedActions.count}}'}"
                            className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500 h-24 font-mono"
                          />
                        </div>
                        
                        <label className="flex items-center text-xs text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedNode.data.config?.slackConfig?.unfurlLinks === false}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: {
                                  ...(selectedNode.data.config || {}),
                                  slackConfig: {
                                    ...(selectedNode.data.config?.slackConfig || {}),
                                    unfurlLinks: !e.target.checked
                                  }
                                }
                              });
                            }}
                            className="mr-1 rounded bg-gray-700 border-gray-600"
                          />
                          Disable link previews
                        </label>
                      </div>
                    )}

                    {/* Email Configuration */}
                    {(selectedNode.data.config?.channels || []).includes('email') && (
                      <div className="bg-gray-800/30 p-3 rounded-lg space-y-2">
                        <h4 className="text-xs font-semibold text-gray-400 mb-2">Email Configuration</h4>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Recipients</label>
                          <input
                            type="text"
                            value={selectedNode.data.config?.emailConfig?.to || ''}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: {
                                  ...(selectedNode.data.config || {}),
                                  emailConfig: {
                                    ...(selectedNode.data.config?.emailConfig || {}),
                                    to: e.target.value
                                  }
                                }
                              });
                            }}
                            placeholder="{'{{payload.participants}}'}"
                            className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Subject</label>
                          <input
                            type="text"
                            value={selectedNode.data.config?.emailConfig?.subject || ''}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: {
                                  ...(selectedNode.data.config || {}),
                                  emailConfig: {
                                    ...(selectedNode.data.config?.emailConfig || {}),
                                    subject: e.target.value
                                  }
                                }
                              });
                            }}
                            placeholder="Meeting Processed: {'{{payload.title}}'}"
                            className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                          />
                        </div>
                        
                        <div>
                          <label className="block text-xs text-gray-400 mb-1">Template</label>
                          <select
                            value={selectedNode.data.config?.emailConfig?.template || 'meeting_processed'}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: {
                                  ...(selectedNode.data.config || {}),
                                  emailConfig: {
                                    ...(selectedNode.data.config?.emailConfig || {}),
                                    template: e.target.value
                                  }
                                }
                              });
                            }}
                            className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white"
                          >
                            <option value="meeting_processed">Meeting Processed</option>
                            <option value="action_items">Action Items</option>
                            <option value="summary">Meeting Summary</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Conditional Notifications */}
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Conditional Notifications
                      </label>
                      <div className="space-y-2">
                        {(selectedNode.data.config?.conditions || []).map((condition: any, index: number) => (
                          <div key={index} className="bg-gray-800/30 p-2 rounded space-y-1">
                            <input
                              type="text"
                              value={condition.if || ''}
                              onChange={(e) => {
                                const newConditions = [...(selectedNode.data.config?.conditions || [])];
                                newConditions[index] = { ...condition, if: e.target.value };
                                updateNodeData(selectedNode.id, {
                                  config: { ...(selectedNode.data.config || {}), conditions: newConditions }
                                });
                              }}
                              placeholder="Condition (e.g., processedActions.count > 0)"
                              className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                            />
                            <input
                              type="text"
                              value={condition.notify || ''}
                              onChange={(e) => {
                                const newConditions = [...(selectedNode.data.config?.conditions || [])];
                                newConditions[index] = { ...condition, notify: e.target.value };
                                updateNodeData(selectedNode.id, {
                                  config: { ...(selectedNode.data.config || {}), conditions: newConditions }
                                });
                              }}
                              placeholder="Notify (e.g., action_owners)"
                              className="w-full px-2 py-1 bg-gray-900/50 border border-gray-700 rounded text-xs text-white placeholder-gray-500"
                            />
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newCondition = { if: '', notify: '' };
                            updateNodeData(selectedNode.id, {
                              config: {
                                ...(selectedNode.data.config || {}),
                                conditions: [...(selectedNode.data.config?.conditions || []), newCondition]
                              }
                            });
                          }}
                          className="w-full px-2 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded text-xs transition-colors"
                        >
                          + Add Condition
                        </button>
                      </div>
                    </div>

                    {/* Enhanced Conditional Routing for CRM Integration */}
                    <div className="mt-4 p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-lg border border-purple-500/30">
                      <h4 className="text-sm font-medium text-purple-300 mb-3">🚀 CRM Integration Routing</h4>
                      
                      <div className="space-y-2 text-xs">
                        <div className="bg-purple-900/20 p-2 rounded">
                          <div className="font-medium text-purple-200 mb-1">Opportunity Score Based Routing:</div>
                          <div className="text-purple-300">• High Score ({'>'}75): Notify sales team + managers</div>
                          <div className="text-purple-300">• Medium Score (40-75): Notify deal owners</div>
                          <div className="text-purple-300">• Low Score ({'<'}40): Escalate to sales managers</div>
                        </div>
                        
                        <div className="bg-blue-900/20 p-2 rounded">
                          <div className="font-medium text-blue-200 mb-1">Manager Escalation Rules:</div>
                          <div className="text-blue-300">• Risk factors {'>'}2: Alert senior sales team</div>
                          <div className="text-blue-300">• Manager review needed: Direct supervisor notification</div>
                          <div className="text-blue-300">• Deal value {'>'}$50k: Executive team CC</div>
                        </div>
                        
                        <div className="bg-green-900/20 p-2 rounded">
                          <div className="font-medium text-green-200 mb-1">Coaching Insights Integration:</div>
                          <div className="text-green-300">• Include talk time ratio in notifications</div>
                          <div className="text-green-300">• Add discovery score and objection handling</div>
                          <div className="text-green-300">• Embed coaching priorities for follow-up</div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <label className="flex items-center text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedNode.data.config?.enhancedRouting || false}
                            onChange={(e) => {
                              updateNodeData(selectedNode.id, {
                                config: { ...(selectedNode.data.config || {}), enhancedRouting: e.target.checked }
                              });
                            }}
                            className="mr-2 rounded bg-gray-700 border-gray-600"
                          />
                          Enable CRM-driven conditional routing
                        </label>
                      </div>
                    </div>

                    <div className="bg-gray-800/30 p-3 rounded-lg">
                      <p className="text-xs text-gray-400 mb-2">Available Variables:</p>
                      <div className="text-xs text-gray-500 space-y-1">
                        <div>• {'{{payload.title}}'} - Meeting title</div>
                        <div>• {'{{payload.summary}}'} - Meeting summary</div>
                        <div>• {'{{processedActions.count}}'} - Action items count</div>
                        <div>• {'{{googleDoc.url}}'} - Transcript document URL</div>
                        <div>• {'{{payload.share_url}}'} - Recording URL</div>
                        <div>• {'{{aiAnalysis.risks}}'} - Identified risks</div>
                        <div className="mt-2 font-medium text-blue-400">CRM Integration Variables:</div>
                        <div>• {'{{aiAnalysis.coaching.opportunity_score}}'} - AI opportunity score (0-100)</div>
                        <div>• {'{{aiAnalysis.coaching.talk_time_analysis}}'} - Talk time breakdown</div>
                        <div>• {'{{aiAnalysis.coaching.discovery_score}}'} - Discovery effectiveness score</div>
                        <div>• {'{{aiAnalysis.coaching.manager_review_needed}}'} - Manager escalation flag</div>
                        <div>• {'{{aiAnalysis.coaching.risk_factors}}'} - Array of risk factors</div>
                        <div>• {'{{aiAnalysis.coaching.buying_signals}}'} - Positive buying indicators</div>
                        <div>• {'{{deal.value}}'} - Deal value (if deal created)</div>
                        <div>• {'{{deal.stage}}'} - Deal stage (if deal created)</div>
                        <div>• {'{{contacts.enriched_count}}'} - Number of contacts enriched</div>
                      </div>
                    </div>
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
                      <>
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
                        
                        {selectedNode.data.frequency === 'weekly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Day of Week</label>
                            <select
                              value={selectedNode.data.scheduledDayOfWeek || 'monday'}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateNodeData(selectedNode.id, { scheduledDayOfWeek: e.target.value });
                              }}
                              onMouseDown={(e) => e.stopPropagation()}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                            >
                              <option value="monday">Monday</option>
                              <option value="tuesday">Tuesday</option>
                              <option value="wednesday">Wednesday</option>
                              <option value="thursday">Thursday</option>
                              <option value="friday">Friday</option>
                              <option value="saturday">Saturday</option>
                              <option value="sunday">Sunday</option>
                            </select>
                          </div>
                        )}
                        
                        {selectedNode.data.frequency === 'monthly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Day of Month</label>
                            <input
                              type="number"
                              value={selectedNode.data.scheduledDayOfMonth || 1}
                              onChange={(e) => updateNodeData(selectedNode.id, { scheduledDayOfMonth: parseInt(e.target.value) || 1 })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              min="1"
                              max="31"
                              placeholder="1-31"
                            />
                            <div className="text-xs text-gray-500 mt-1">Runs on the last valid day if date doesn't exist</div>
                          </div>
                        )}
                        
                        {(selectedNode.data.frequency === 'daily' || selectedNode.data.frequency === 'weekly' || selectedNode.data.frequency === 'monthly') && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Time of Day</label>
                            <input
                              type="time"
                              value={selectedNode.data.scheduledTimeOfDay || '09:00'}
                              onChange={(e) => updateNodeData(selectedNode.id, { scheduledTimeOfDay: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            />
                            <div className="text-xs text-gray-500 mt-1">Time when the workflow will trigger (in user's timezone)</div>
                          </div>
                        )}
                        
                        {selectedNode.data.frequency === 'hourly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Minute of Hour</label>
                            <input
                              type="number"
                              value={selectedNode.data.minuteOfHour || 0}
                              onChange={(e) => updateNodeData(selectedNode.id, { minuteOfHour: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              min="0"
                              max="59"
                              placeholder="0-59"
                            />
                            <div className="text-xs text-gray-500 mt-1">Minute of each hour to trigger (e.g., 15 = quarter past)</div>
                          </div>
                        )}
                      </>
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
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Trigger at Time</label>
                          <input
                            type="time"
                            value={selectedNode.data.triggerTime || '09:00'}
                            onChange={(e) => updateNodeData(selectedNode.id, { triggerTime: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                          />
                          <div className="text-xs text-gray-500 mt-1">Specific time to trigger after the delay period (in user's timezone)</div>
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
                      <>
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
                        
                        {selectedNode.data.checkFrequency === 'daily' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Check Time</label>
                            <input
                              type="time"
                              value={selectedNode.data.checkTime || '09:00'}
                              onChange={(e) => updateNodeData(selectedNode.id, { checkTime: e.target.value })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            />
                            <div className="text-xs text-gray-500 mt-1">Daily check time for overdue tasks (in user's timezone)</div>
                          </div>
                        )}
                        
                        {selectedNode.data.checkFrequency === 'hourly' && (
                          <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Minute of Hour</label>
                            <input
                              type="number"
                              value={selectedNode.data.checkMinute || 0}
                              onChange={(e) => updateNodeData(selectedNode.id, { checkMinute: parseInt(e.target.value) || 0 })}
                              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                              min="0"
                              max="59"
                              placeholder="0-59"
                            />
                            <div className="text-xs text-gray-500 mt-1">Check at this minute of each hour</div>
                          </div>
                        )}
                      </>
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

                {/* Edge Configuration */}
                {selectedEdge && (
                  <>
                    <div className="mb-4 p-3 bg-blue-900/20 border border-blue-700/30 rounded-lg">
                      <h3 className="text-sm font-semibold text-blue-300 mb-2">Edge Configuration</h3>
                      <p className="text-xs text-blue-200/80">Configure connection properties and labels</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Edge Label</label>
                      <input
                        type="text"
                        value={selectedEdge.label || ''}
                        onChange={(e) => updateEdgeData(selectedEdge.id, { label: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                        placeholder="Enter edge label..."
                      />
                      <p className="text-xs text-gray-500 mt-1">Display name for this connection</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Edge Type</label>
                      <select
                        value={selectedEdge.type || 'default'}
                        onChange={(e) => updateEdgeData(selectedEdge.id, { type: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors cursor-pointer hover:bg-gray-800/70"
                      >
                        <option value="default">Default</option>
                        <option value="smoothstep">Smooth Step</option>
                        <option value="step">Step</option>
                        <option value="straight">Straight</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Animation</label>
                      <label className="flex items-center text-sm text-gray-300">
                        <input
                          type="checkbox"
                          checked={selectedEdge.animated || false}
                          onChange={(e) => updateEdgeData(selectedEdge.id, { animated: e.target.checked })}
                          className="w-4 h-4 bg-gray-700 border-gray-600 rounded text-[#37bd7e] focus:ring-[#37bd7e] focus:ring-2"
                        />
                        <span className="ml-2">Enable animation</span>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Edge Color</label>
                      <div className="flex gap-2">
                        {['#37bd7e', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#6b7280'].map((color) => (
                          <button
                            key={color}
                            onClick={() => updateEdgeData(selectedEdge.id, { 
                              style: { ...selectedEdge.style, stroke: color }
                            })}
                            className={`w-6 h-6 rounded border-2 transition-all ${
                              selectedEdge.style?.stroke === color ? 'border-white' : 'border-gray-600'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-800">
                {selectedNode && (
                  <button
                    onClick={deleteSelectedNode}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete Node
                  </button>
                )}
                {selectedEdge && (
                  <button
                    onClick={() => {
                      setEdges((eds) => eds.filter((edge) => edge.id !== selectedEdge.id));
                      setSelectedEdge(null);
                      setShowNodeEditor(false);
                    }}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Delete Edge
                  </button>
                )}
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
    
    {/* Custom GPT Configuration Modal */}
    <CustomGPTConfigModal
      isOpen={showCustomGPTConfigModal}
      onClose={() => {
        setShowCustomGPTConfigModal(false);
        setSelectedCustomGPTNode(null);
      }}
      config={selectedCustomGPTNode?.data?.config}
      onSave={handleCustomGPTConfigSave}
      availableVariables={['deal.value', 'deal.stage', 'contact.name', 'contact.email', 'activity.type', 'task.title', 'formData.fields']}
      formFields={getFormFieldsFromWorkflow()}
    />

    {/* Assistant Manager Configuration Modal */}
    <AssistantManagerConfigModal
      isOpen={showAssistantManagerConfigModal}
      onClose={() => {
        setShowAssistantManagerConfigModal(false);
        setSelectedAssistantManagerNode(null);
      }}
      config={selectedAssistantManagerNode?.data?.config}
      onSave={(config) => {
        if (selectedAssistantManagerNode) {
          updateNodeData(selectedAssistantManagerNode.id, { config });
        }
        setShowAssistantManagerConfigModal(false);
        setSelectedAssistantManagerNode(null);
      }}
      availableVariables={['deal.value', 'deal.stage', 'contact.name', 'contact.email', 'activity.type', 'task.title', 'formData.fields']}
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