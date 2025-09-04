import React, { useState, useCallback, useRef } from 'react';
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
  ChevronRight
} from 'lucide-react';

// Icon mapping
const iconMap: { [key: string]: any } = {
  Target,
  Activity,
  Database,
  GitBranch,
  CheckSquare,
  Bell,
  Mail
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
  const [workflowName, setWorkflowName] = useState(selectedWorkflow?.name || 'Untitled Workflow');
  const [workflowDescription, setWorkflowDescription] = useState(selectedWorkflow?.description || '');
  const reactFlowInstance = useRef<any>(null);
  
  const onConnect = useCallback(
    (params: Edge | Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

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
    const workflow = {
      name: workflowName,
      description: workflowDescription,
      nodes,
      edges,
      trigger_type: nodes.find(n => n.type === 'trigger')?.data?.type || 'manual',
      action_type: nodes.find(n => n.type === 'action')?.data?.type || 'create_task',
      is_active: true
    };
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