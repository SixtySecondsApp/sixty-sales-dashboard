import React, { useState, useCallback, useRef, useEffect } from 'react';
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
  X
} from 'lucide-react';
import { FaSlack } from 'react-icons/fa';
import { SlackConnectionButton } from '@/components/SlackConnectionButton';
import { slackOAuthService } from '@/lib/services/slackOAuthService';
import { supabase } from '@/lib/supabase/clientV2';

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

// Custom Node Types - 33% smaller
const TriggerNode = ({ data }: any) => {
  const Icon = data.iconName ? iconMap[data.iconName] : Target;
  return (
    <div className="bg-purple-600 rounded-lg p-3 min-w-[120px] border-2 border-purple-500 shadow-lg">
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-purple-500" />
      <div className="flex items-center gap-2 text-white">
        <Icon className="w-4 h-4" />
        <div>
          <div className="text-xs font-semibold">{data.label}</div>
          <div className="text-[10px] opacity-80">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

const ConditionNode = ({ data }: any) => {
  return (
    <div className="bg-blue-600 rounded-lg p-3 min-w-[110px] border-2 border-blue-500 shadow-lg">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-blue-500" />
      <div className="flex items-center gap-2 text-white">
        <GitBranch className="w-3.5 h-3.5" />
        <div>
          <div className="text-xs font-semibold">{data.label}</div>
          <div className="text-[10px] opacity-80">{data.condition}</div>
        </div>
      </div>
    </div>
  );
};

const ActionNode = ({ data }: any) => {
  const Icon = data.iconName === 'Slack' ? FaSlack : (data.iconName ? iconMap[data.iconName] : CheckSquare);
  return (
    <div className="bg-[#37bd7e] rounded-lg p-3 min-w-[120px] border-2 border-[#37bd7e] shadow-lg">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-white border-2 border-[#37bd7e]" />
      <div className="flex items-center gap-2 text-white">
        <Icon className="w-4 h-4" />
        <div>
          <div className="text-xs font-semibold">{data.label}</div>
          <div className="text-[10px] opacity-80">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

// Router Node for advanced workflows - 33% smaller
const RouterNode = ({ data }: any) => {
  return (
    <div className="bg-orange-600 rounded-lg p-3 min-w-[110px] border-2 border-orange-500 shadow-lg">
      <Handle type="target" position={Position.Left} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" style={{top: '30%'}} id="a" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" style={{top: '50%'}} id="b" />
      <Handle type="source" position={Position.Right} className="w-2.5 h-2.5 bg-white border-2 border-orange-500" style={{top: '70%'}} id="c" />
      <div className="flex items-center gap-2 text-white">
        <GitBranch className="w-3.5 h-3.5" />
        <div>
          <div className="text-xs font-semibold">{data.label}</div>
          <div className="text-[10px] opacity-80">{data.description || 'Routes to multiple paths'}</div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode,
  router: RouterNode
};

interface WorkflowCanvasProps {
  selectedWorkflow: any;
  onSave: (workflow: any) => void;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ selectedWorkflow, onSave }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showNodePanel, setShowNodePanel] = useState(true);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const [workflowDescription, setWorkflowDescription] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [slackConnected, setSlackConnected] = useState(false);
  const [slackChannels, setSlackChannels] = useState<any[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const reactFlowInstance = useRef<any>(null);

  // Get current user on mount
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    };
    getUser();
  }, []);

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

  // Load selected workflow data
  useEffect(() => {
    if (selectedWorkflow) {
      setWorkflowName(selectedWorkflow.name || 'Untitled Workflow');
      setWorkflowDescription(selectedWorkflow.description || '');
      
      // Load canvas data if available
      if (selectedWorkflow.canvas_data) {
        const canvasData = typeof selectedWorkflow.canvas_data === 'string' 
          ? JSON.parse(selectedWorkflow.canvas_data) 
          : selectedWorkflow.canvas_data;
        
        if (canvasData.nodes) {
          setNodes(canvasData.nodes);
        }
        if (canvasData.edges) {
          setEdges(canvasData.edges);
        }
      }
    } else {
      // Reset for new workflow
      setWorkflowName('Untitled Workflow');
      setWorkflowDescription('');
      setNodes([]);
      setEdges([]);
    }
  }, [selectedWorkflow, setNodes, setEdges]);
  
  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Handle node selection
  const onNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      setSelectedNode(node);
      setShowNodeEditor(true);
    },
    []
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
          return updatedNode;
        }
        return node;
      })
    );
  };

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
          
          const newNode = {
            id: `${type}_${Date.now()}`,
            type,
            position: {
              x: centerX - 60, // Center horizontally (node width ~120px)
              y: centerY - 30  // Center vertically (node height ~60px)
            },
            data: enhancedData,
          };

          setNodes((nds) => nds.concat(newNode));
        }
      }
    },
    [setNodes]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleSave = () => {
    // Extract trigger and action information from nodes
    const triggerNode = nodes.find(n => n.type === 'trigger');
    const actionNode = nodes.find(n => n.type === 'action');
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
          action_config.task_title = `Task from ${workflowName}`;
          action_config.task_description = 'Automated task';
          action_config.due_in_days = 1;
          action_config.priority = 'medium';
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
      }
    }

    const workflow = {
      id: selectedWorkflow?.id, // Include ID for updates
      name: workflowName,
      description: workflowDescription,
      canvas_data: { nodes, edges },
      trigger_type: triggerNode?.data?.type || 'manual',
      trigger_config: trigger_conditions,
      action_type: actionNode?.data?.type || 'create_task',
      action_config: action_config,
      is_active: false, // Start inactive by default
      template_id: selectedWorkflow?.template_id || null
    };
    
    console.log('💾 Saving workflow:', workflow);
    onSave(workflow);
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
    <div className="h-[calc(100vh-8rem)] flex overflow-hidden">
      {/* Left Panel - Node Library */}
      <motion.div 
        initial={{ x: -300 }}
        animate={{ x: showNodePanel ? 0 : -300 }}
        className="w-80 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800/50 p-6 overflow-y-auto h-[calc(100vh-8rem)]" 
      >
        <div className="space-y-6">
          {/* Workflow Details */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Workflow Details</h3>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="Workflow name..."
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors mb-2"
            />
            <textarea
              value={workflowDescription}
              onChange={(e) => setWorkflowDescription(e.target.value)}
              placeholder="Description..."
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
            />
          </div>
          
          {/* Triggers */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Triggers</h3>
            <div className="space-y-2">
              {[
                { type: 'stage_changed', label: 'Stage Changed', iconName: 'Target', description: 'When deal moves stages' },
                { type: 'activity_created', label: 'Activity Created', iconName: 'Activity', description: 'When activity logged' },
                { type: 'deal_created', label: 'Deal Created', iconName: 'Database', description: 'When new deal added' },
                { type: 'webhook_received', label: 'Webhook Received', iconName: 'Zap', description: 'External webhook trigger' },
                { type: 'task_overdue', label: 'Task Overdue', iconName: 'AlertTriangle', description: 'Task past due date' },
                { type: 'activity_monitor', label: 'Activity Monitor', iconName: 'Activity', description: 'Monitor activity levels' },
                { type: 'scheduled', label: 'Scheduled', iconName: 'Clock', description: 'Time-based trigger' },
                { type: 'time_based', label: 'Time Based', iconName: 'Clock', description: 'After time period' }
              ].map((trigger) => {
                const TriggerIcon = iconMap[trigger.iconName] || Target;
                return (
                  <div
                    key={trigger.type}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('nodeType', 'trigger');
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
          
          {/* Conditions & Routers */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Logic & Routing</h3>
            <div className="space-y-2">
              {[
                { type: 'if_value', label: 'If Value', condition: 'Check field value' },
                { type: 'if_stage', label: 'If Stage', condition: 'Check deal stage' },
                { type: 'if_custom_field', label: 'Custom Field Value', condition: 'Check custom fields' },
                { type: 'time_since_contact', label: 'Time Since Contact', condition: 'Days since last interaction' },
                { type: 'if_time', label: 'If Time', condition: 'Time-based condition' },
                { type: 'if_user', label: 'If User', condition: 'User-based check' },
                { type: 'stage_router', label: 'Stage Router', condition: 'Route by stage', nodeType: 'router' }
              ].map((condition) => (
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
          
          {/* Actions */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Actions</h3>
            <div className="space-y-2">
              {[
                { type: 'create_task', label: 'Create Task', iconName: 'CheckSquare', description: 'Generate task' },
                { type: 'create_recurring_task', label: 'Recurring Task', iconName: 'CheckSquare', description: 'Scheduled tasks' },
                { type: 'send_webhook', label: 'Send Webhook', iconName: 'Zap', description: 'Call external API' },
                { type: 'send_notification', label: 'Send Notification', iconName: 'Bell', description: 'Send alert' },
                { type: 'send_slack', label: 'Send to Slack', iconName: 'Slack', description: 'Post to Slack channel' },
                { type: 'send_email', label: 'Send Email', iconName: 'Mail', description: 'Email notification' },
                { type: 'add_note', label: 'Add Note/Comment', iconName: 'FileText', description: 'Add activity note' },
                { type: 'update_field', label: 'Update Field', iconName: 'TrendingUp', description: 'Change data' },
                { type: 'update_multiple_fields', label: 'Update Multiple Fields', iconName: 'TrendingUp', description: 'Batch updates' },
                { type: 'assign_owner', label: 'Assign Owner', iconName: 'Users', description: 'Change owner' },
                { type: 'create_activity', label: 'Create Activity', iconName: 'Calendar', description: 'Log activity' },
                { type: 'multi_action', label: 'Multiple Actions', iconName: 'Zap', description: 'Multiple steps' }
              ].map((action) => {
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
        </div>
      </motion.div>

      {/* Main Canvas */}
      <div className="flex-1 relative h-[calc(100vh-8rem)] overflow-hidden">
        {/* Canvas Toolbar */}
        <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
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
            onClick={handleTest}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            Test
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-2 bg-[#37bd7e] hover:bg-[#37bd7e]/90 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>

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

        {/* Node Editor Panel */}
        {showNodeEditor && selectedNode && (
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
                        <option value="update_field">Update Field</option>
                        <option value="assign_owner">Assign Owner</option>
                        <option value="send_email">Send Email</option>
                        <option value="multi_action">Multiple Actions</option>
                      </select>
                    </div>

                    {selectedNode.data.type === 'create_task' && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Task Title</label>
                          <input
                            type="text"
                            value={selectedNode.data.taskTitle || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { taskTitle: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="e.g., Follow up with {deal_name}"
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
                      </>
                    )}

                    {selectedNode.data.type === 'update_multiple_fields' && (
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
                          <label className="block text-sm font-medium text-gray-300 mb-2">Notification Title</label>
                          <input
                            type="text"
                            value={selectedNode.data.notificationTitle || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { notificationTitle: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                            placeholder="e.g., Deal Update"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-300 mb-2">Notification Message</label>
                          <textarea
                            value={selectedNode.data.notificationMessage || ''}
                            onChange={(e) => updateNodeData(selectedNode.id, { notificationMessage: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors resize-none h-20"
                            placeholder="Enter notification message..."
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
                                  <option value="update_field">Update Field</option>
                                  <option value="assign_owner">Assign Owner</option>
                                  <option value="create_activity">Create Activity</option>
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