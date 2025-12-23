import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixAIAgentPosition() {
  console.log('🔧 Fixing AI Agent position in Fathom workflow...');
  
  // First, check current state
  const { data: currentWorkflow, error: fetchError } = await supabase
    .from('user_automation_rules')
    .select('canvas_data')
    .eq('id', 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f')
    .single();
    
  if (fetchError) {
    console.error('Error fetching workflow:', fetchError);
    return;
  }
  
  console.log('📍 Current node positions:');
  const nodes = currentWorkflow.canvas_data.nodes || [];
  nodes.forEach(node => {
    console.log(`  - ${node.id}: x=${node.position.x}, y=${node.position.y}, label=${node.data?.label}`);
  });
  
  // Update the canvas data
  const updatedNodes = nodes.map(node => {
    if (node.id === 'ai-summary-analyzer') {
      return {
        ...node,
        position: { x: 850, y: 100 },
        data: {
          ...node.data,
          label: 'Sales Coaching AI'
        }
      };
    } else if (node.id === 'google-docs-creator') {
      return {
        ...node,
        position: { x: 600, y: 100 }
      };
    } else if (node.id === 'conditional-branch') {
      return {
        ...node,
        position: { x: 1100, y: 100 }
      };
    }
    return node;
  });
  
  // Update edges to ensure proper flow
  const edges = currentWorkflow.canvas_data.edges || [];
  const updatedEdges = edges.map(edge => {
    // Change Google Docs -> Conditional to Google Docs -> AI Agent
    if (edge.source === 'google-docs-creator' && edge.target === 'conditional-branch') {
      return {
        ...edge,
        target: 'ai-summary-analyzer',
        label: 'Meeting Transcript',
        data: {
          ...edge.data,
          label: 'Meeting Transcript'
        }
      };
    }
    // Remove any direct connection from router to AI Agent
    if (edge.source === 'router' && edge.target === 'ai-summary-analyzer') {
      return null;
    }
    return edge;
  }).filter(Boolean);
  
  // Add edge from AI Agent to Conditional Branch if it doesn't exist
  const hasAIToBranch = updatedEdges.some(
    edge => edge.source === 'ai-summary-analyzer' && edge.target === 'conditional-branch'
  );
  
  if (!hasAIToBranch) {
    updatedEdges.push({
      id: 'e-ai-to-branch',
      source: 'ai-summary-analyzer',
      target: 'conditional-branch',
      type: 'custom',
      label: 'AI Analysis',
      labelBgColor: '#7c3aed',
      labelTextColor: '#ffffff',
      data: {
        label: 'AI Analysis',
        labelBgColor: '#7c3aed',
        labelTextColor: '#ffffff'
      }
    });
  }
  
  const updatedCanvasData = {
    ...currentWorkflow.canvas_data,
    nodes: updatedNodes,
    edges: updatedEdges
  };
  
  // Update the workflow
  const { error: updateError } = await supabase
    .from('user_automation_rules')
    .update({ canvas_data: updatedCanvasData })
    .eq('id', 'c914a0af-7cd4-43b8-97f2-863e6a4abf9f');
    
  if (updateError) {
    console.error('Error updating workflow:', updateError);
    return;
  }
  
  console.log('✅ Successfully updated AI Agent position!');
  console.log('📍 New node positions:');
  updatedNodes.forEach(node => {
    if (['ai-summary-analyzer', 'google-docs-creator', 'conditional-branch'].includes(node.id)) {
      console.log(`  - ${node.id}: x=${node.position.x}, y=${node.position.y}, label=${node.data?.label}`);
    }
  });
  
  console.log('\n🔗 Edge connections:');
  updatedEdges.forEach(edge => {
    if (edge.source === 'google-docs-creator' || edge.target === 'ai-summary-analyzer' || 
        edge.source === 'ai-summary-analyzer' || edge.target === 'conditional-branch') {
      console.log(`  - ${edge.source} -> ${edge.target}: ${edge.label || 'no label'}`);
    }
  });
}

fixAIAgentPosition().catch(console.error);