// Fix form URLs to use current port
// Run this with: node scripts/fix-form-urls-port.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixFormUrls() {
  try {
    // Get all workflows with form nodes
    const { data: workflows, error: workflowError } = await supabase
      .from('user_automation_rules')
      .select('id, canvas_data')
      .not('canvas_data', 'is', null);

    if (workflowError) {
      throw workflowError;
    }

    let updatedCount = 0;

    for (const workflow of workflows) {
      if (!workflow.canvas_data?.nodes) continue;

      let needsUpdate = false;
      const updatedNodes = workflow.canvas_data.nodes.map(node => {
        if (node.type === 'form' && node.data?.config) {
          const config = { ...node.data.config };
          let nodeUpdated = false;

          // Fix testUrl
          if (config.testUrl && config.testUrl.includes(':5175/')) {
            config.testUrl = config.testUrl.replace(':5175/', ':5173/');
            nodeUpdated = true;
          }

          // Fix productionUrl  
          if (config.productionUrl && config.productionUrl.includes(':5175/')) {
            config.productionUrl = config.productionUrl.replace(':5175/', ':5173/');
            nodeUpdated = true;
          }

          if (nodeUpdated) {
            needsUpdate = true;
            return {
              ...node,
              data: {
                ...node.data,
                config
              }
            };
          }
        }
        return node;
      });

      // Update the workflow if needed
      if (needsUpdate) {
        const { error: updateError } = await supabase
          .from('user_automation_rules')
          .update({
            canvas_data: {
              ...workflow.canvas_data,
              nodes: updatedNodes
            }
          })
          .eq('id', workflow.id);

        if (updateError) {
        } else {
          updatedCount++;
        }
      }
    }
  } catch (error) {
  }
}

fixFormUrls();