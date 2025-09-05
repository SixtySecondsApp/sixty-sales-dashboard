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
  Heart
} from 'lucide-react';

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
  Heart
};

// Custom Node Types
const TriggerNode = ({ data }: any) => {
  const Icon = data.iconName ? iconMap[data.iconName] : Target;
  return (
    <div className="bg-purple-600 rounded-xl p-4 min-w-[180px] border-2 border-purple-500 shadow-lg">
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white border-2 border-purple-500" />
      <div className="flex items-center gap-3 text-white">
        <Icon className="w-6 h-6" />
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          <div className="text-xs opacity-80">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

const ConditionNode = ({ data }: any) => {
  return (
    <div className="bg-blue-600 rounded-xl p-4 min-w-[160px] border-2 border-blue-500 shadow-lg">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white border-2 border-blue-500" />
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white border-2 border-blue-500" />
      <div className="flex items-center gap-3 text-white">
        <GitBranch className="w-5 h-5" />
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          <div className="text-xs opacity-80">{data.condition}</div>
        </div>
      </div>
    </div>
  );
};

const ActionNode = ({ data }: any) => {
  const Icon = data.iconName ? iconMap[data.iconName] : CheckSquare;
  return (
    <div className="bg-[#37bd7e] rounded-xl p-4 min-w-[180px] border-2 border-[#37bd7e] shadow-lg">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white border-2 border-[#37bd7e]" />
      <div className="flex items-center gap-3 text-white">
        <Icon className="w-6 h-6" />
        <div>
          <div className="text-sm font-semibold">{data.label}</div>
          <div className="text-xs opacity-80">{data.description}</div>
        </div>
      </div>
    </div>
  );
};

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  condition: ConditionNode,
  action: ActionNode
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
  const reactFlowInstance = useRef<any>(null);

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
          return {
            ...node,
            data: {
              ...node.data,
              ...newData,
            },
          };
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
      
      const reactFlowBounds = (event.target as HTMLElement)?.getBoundingClientRect();
      const type = event.dataTransfer.getData('nodeType');
      const nodeData = JSON.parse(event.dataTransfer.getData('nodeData'));

      if (type && nodeData && reactFlowInstance.current) {
        const position = reactFlowInstance.current.project({
          x: event.clientX - reactFlowBounds.left,
          y: event.clientY - reactFlowBounds.top,
        });

        const newNode = {
          id: `${type}_${Date.now()}`,
          type,
          position,
          data: nodeData,
        };

        setNodes((nds) => nds.concat(newNode));
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

  return (
    <div className="h-full flex">
      {/* Left Panel - Node Library */}
      <motion.div 
        initial={{ x: -300 }}
        animate={{ x: showNodePanel ? 0 : -300 }}
        className="w-80 bg-gray-900/50 backdrop-blur-xl border-r border-gray-800/50 p-6 overflow-y-auto"
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
                { type: 'pipeline_stage_changed', label: 'Stage Changed', iconName: 'Target', description: 'When deal moves' },
                { type: 'activity_created', label: 'Activity Created', iconName: 'Activity', description: 'When activity logged' },
                { type: 'deal_created', label: 'Deal Created', iconName: 'Database', description: 'When new deal' }
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
          
          {/* Conditions */}
          <div>
            <h3 className="text-sm font-semibold text-white mb-3">Conditions</h3>
            <div className="space-y-2">
              {[
                { type: 'if_value', label: 'If Value', condition: 'Check field value' },
                { type: 'if_time', label: 'If Time', condition: 'Time-based condition' },
                { type: 'if_user', label: 'If User', condition: 'User-based check' }
              ].map((condition) => (
                <div
                  key={condition.type}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('nodeType', 'condition');
                    e.dataTransfer.setData('nodeData', JSON.stringify(condition));
                  }}
                  className="bg-blue-600/20 border border-blue-600/30 rounded-lg p-3 cursor-move hover:bg-blue-600/30 transition-colors"
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
                { type: 'send_notification', label: 'Send Notification', iconName: 'Bell', description: 'Send alert' },
                { type: 'send_email', label: 'Send Email', iconName: 'Mail', description: 'Email notification' },
                { type: 'update_field', label: 'Update Field', iconName: 'Database', description: 'Change data' }
              ].map((action) => {
                const ActionIcon = iconMap[action.iconName] || CheckSquare;
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
      <div className="flex-1 relative">
        {/* Canvas Toolbar */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
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
          className="bg-gray-950"
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
            className="absolute top-0 right-0 w-96 h-full bg-gray-900/95 backdrop-blur-xl border-l border-gray-800/50 p-6 overflow-y-auto z-20"
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
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Condition</label>
                    <input
                      type="text"
                      value={selectedNode.data.condition || ''}
                      onChange={(e) => updateNodeData(selectedNode.id, { condition: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:border-[#37bd7e] outline-none transition-colors"
                      placeholder="e.g., value > 10000"
                    />
                    <p className="text-xs text-gray-500 mt-1">Enter condition logic</p>
                  </div>
                )}

                {/* Action-specific settings */}
                {selectedNode.type === 'action' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Action Type</label>
                      <select
                        value={selectedNode.data.type || 'create_task'}
                        onChange={(e) => updateNodeData(selectedNode.id, { type: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                      >
                        <option value="create_task">Create Task</option>
                        <option value="send_notification">Send Notification</option>
                        <option value="create_activity">Create Activity</option>
                        <option value="update_deal_stage">Update Deal Stage</option>
                        <option value="update_field">Update Field</option>
                      </select>
                    </div>

                    {selectedNode.data.type === 'create_task' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Task Priority</label>
                        <select
                          value={selectedNode.data.priority || 'medium'}
                          onChange={(e) => updateNodeData(selectedNode.id, { priority: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>
                    )}
                  </>
                )}

                {/* Trigger-specific settings */}
                {selectedNode.type === 'trigger' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Trigger Type</label>
                    <select
                      value={selectedNode.data.type || 'pipeline_stage_changed'}
                      onChange={(e) => updateNodeData(selectedNode.id, { type: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white text-sm focus:border-[#37bd7e] outline-none transition-colors"
                    >
                      <option value="pipeline_stage_changed">Pipeline Stage Changed</option>
                      <option value="activity_created">Activity Created</option>
                      <option value="deal_created">Deal Created</option>
                      <option value="task_completed">Task Completed</option>
                      <option value="manual">Manual Trigger</option>
                    </select>
                  </div>
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