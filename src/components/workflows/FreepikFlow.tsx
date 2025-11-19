import React, { useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  addEdge, 
  useNodesState, 
  useEdgesState,
  NodeTypes
} from 'reactflow';
import 'reactflow/dist/style.css';
import FreepikImageGenNode from './nodes/freepik/FreepikImageGenNode';
import FreepikUpscaleNode from './nodes/freepik/FreepikUpscaleNode';
import FreepikVideoGenNode from './nodes/freepik/FreepikVideoGenNode';
import AnimatedTestEdge from './AnimatedTestEdge';

// --- NODE TYPES ---
const nodeTypes: NodeTypes = {
  freepikImageGen: FreepikImageGenNode,
  freepikUpscale: FreepikUpscaleNode,
  freepikVideoGen: FreepikVideoGenNode
};

// --- EDGE TYPES ---
const edgeTypes = {
  animated: AnimatedTestEdge,
};

// --- INITIAL DATA ---
const initialNodes = [
  { 
    id: '1', 
    type: 'freepikImageGen', 
    position: { x: 100, y: 100 }, 
    data: { 
      prompt: "Ultra-realistic cinematic photo of a young man in a gray sports car",
      aspect_ratio: "landscape",
      generated_image: "https://img.freepik.com/free-photo/pair-trainers_144627-3800.jpg?w=300" // Placeholder
    } 
  },
  { 
    id: '2', 
    type: 'freepikUpscale', 
    position: { x: 450, y: 100 }, 
    data: { 
      scale_factor: 2,
      optimize_for: "quality",
      input_image: "https://img.freepik.com/free-photo/pair-trainers_144627-3800.jpg?w=300" // Simulated connection
    } 
  },
  { 
    id: '3', 
    type: 'freepikVideoGen', 
    position: { x: 800, y: 100 }, 
    data: { 
      prompt: "The car drives slowly through a neon city",
      duration: "5",
      input_image: "https://img.freepik.com/free-photo/pair-trainers_144627-3800.jpg?w=300" // Simulated connection
    } 
  }
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', type: 'animated', animated: true },
  { id: 'e2-3', source: '2', target: '3', type: 'animated', animated: true },
];

// --- MAIN COMPONENT ---
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
        className="freepik-theme"
        minZoom={0.2}
      >
        <Background color="#333" gap={20} size={1} />
        <Controls className="bg-[#1e1e1e] border border-zinc-800 fill-zinc-400" />
      </ReactFlow>

      {/* Global CSS overrides */}
      <style>{`
        .react-flow__attribution { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
      `}</style>
    </div>
  );
}
