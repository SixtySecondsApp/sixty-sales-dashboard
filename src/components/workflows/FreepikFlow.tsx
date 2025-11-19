import React, { useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  Handle, 
  Position, 
  addEdge, 
  useNodesState, 
  useEdgesState,
  BaseEdge,
  getBezierPath,
  MarkerType,
  NodeProps,
  EdgeProps
} from 'reactflow';
import { Image, FileText, Sparkles, Maximize2, MoreHorizontal } from 'lucide-react';
import 'reactflow/dist/style.css';

// --- 1. STYLING CONSTANTS ---

// These match the Freepik dark theme
const NODE_STYLES = "bg-[#1e1e1e] border border-zinc-800 rounded-lg shadow-xl w-64 overflow-hidden transition-shadow hover:border-zinc-600";
const HANDLE_STYLES = "w-3 h-3 bg-zinc-500 border-2 border-[#1e1e1e] hover:bg-blue-500 transition-colors";

// --- 2. CUSTOM NODES ---

// A Reusable Header Component for all nodes
const NodeHeader = ({ icon: Icon, title, color = "text-zinc-400" }: { icon: any, title: string, color?: string }) => (
  <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800 bg-[#1e1e1e]">
    <div className={`flex items-center gap-2 text-xs font-semibold ${color}`}>
      <Icon size={14} />
      <span className="text-zinc-300">{title}</span>
    </div>
    <MoreHorizontal size={14} className="text-zinc-600 cursor-pointer hover:text-zinc-400" />
  </div>
);

// Node Type: Image Input (The starting image)
const ImageInputNode = ({ data }: NodeProps) => {
  return (
    <div className={NODE_STYLES}>
      <NodeHeader icon={Image} title="Input Image" />
      <div className="relative h-40 bg-zinc-900 group">
        <img src={data.src} alt="input" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded backdrop-blur-sm">
          Original
        </div>
      </div>
      {/* Output Handle */}
      <Handle type="source" position={Position.Right} className={HANDLE_STYLES} />
    </div>
  );
};

// Node Type: Prompt/Instruction (Text areas)
const PromptNode = ({ data }: NodeProps) => {
  return (
    <div className={NODE_STYLES}>
      <Handle type="target" position={Position.Left} className={HANDLE_STYLES} />
      <NodeHeader icon={Sparkles} title="Instruction" color="text-purple-400" />
      <div className="p-3 bg-zinc-900/50">
        <div className="text-xs text-zinc-300 leading-relaxed font-mono h-24 overflow-y-auto custom-scrollbar">
          {data.text}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className={HANDLE_STYLES} />
    </div>
  );
};

// Node Type: Result (The generated output)
const ResultNode = ({ data }: NodeProps) => {
  return (
    <div className={NODE_STYLES}>
      <Handle type="target" position={Position.Left} className={HANDLE_STYLES} />
      <NodeHeader icon={Image} title="Result" />
      <div className="relative h-56 bg-zinc-900 flex items-center justify-center overflow-hidden">
        {/* Simulating a generated image with a colored placeholder */}
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: data.color }}>
           <span className="text-black/30 font-black text-2xl uppercase tracking-widest">{data.label}</span>
        </div>
        <button className="absolute top-2 right-2 p-1.5 bg-black/50 rounded hover:bg-black/70 text-white transition-colors">
          <Maximize2 size={12} />
        </button>
      </div>
      <Handle type="source" position={Position.Right} className={HANDLE_STYLES} />
    </div>
  );
};

// Register the custom types
const nodeTypes = {
  imageInput: ImageInputNode,
  prompt: PromptNode,
  result: ResultNode,
};

// --- 3. CUSTOM EDGE (The Moving Dot) ---

const CustomAnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: EdgeProps) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={{ ...style, stroke: '#52525b', strokeWidth: 2 }} />
      <circle r="3" fill="#a1a1aa">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};

const edgeTypes = {
  animated: CustomAnimatedEdge,
};

// --- 4. INITIAL DATA ---

const initialNodes = [
  { 
    id: '1', type: 'imageInput', position: { x: 0, y: 200 }, 
    data: { src: 'https://img.freepik.com/free-photo/pair-trainers_144627-3800.jpg?w=300' } 
  },
  { 
    id: '2', type: 'prompt', position: { x: 400, y: 0 }, 
    data: { text: "Ultra-realistic cinematic photo of the same young man and the same aluminum gray sports car..." } 
  },
  { 
    id: '3', type: 'prompt', position: { x: 400, y: 250 }, 
    data: { text: "A person sitting on the edge of a large green metal container, viewed from an extreme nadir angle..." } 
  },
  { 
    id: '4', type: 'result', position: { x: 800, y: 0 }, 
    data: { color: '#e5e5e5', label: 'Hood' } 
  },
  { 
    id: '5', type: 'result', position: { x: 800, y: 250 }, 
    data: { color: '#3b82f6', label: 'Container' } 
  },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', type: 'animated' },
  { id: 'e1-3', source: '1', target: '3', type: 'animated' },
  { id: 'e2-4', source: '2', target: '4', type: 'animated' },
  { id: 'e3-5', source: '3', target: '5', type: 'animated' },
];

// --- 5. MAIN COMPONENT ---

export default function FreepikFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params, type: 'animated' }, eds)),
    [setEdges]
  );

  return (
    <div className="w-full h-full bg-[#0f0f0f] min-h-[500px] rounded-xl overflow-hidden border border-zinc-800">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        // Dark mode defaults
        className="freepik-theme"
        minZoom={0.2}
      >
        <Background color="#333" gap={20} size={1} />
        <Controls className="bg-[#1e1e1e] border border-zinc-800 fill-zinc-400" />
      </ReactFlow>

      {/* Global CSS overrides for Handles to make them look perfect */}
      <style>{`
        /* Hide the default React Flow attribution for cleaner look (optional) */
        .react-flow__attribution { display: none; }
        
        /* Custom Scrollbar for text areas */
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>
    </div>
  );
}

