// Fix form URLs to use current port
// Run this with: node scripts/fix-form-urls-port.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixFormUrls() {
  console.log('🔧 Fixing form URLs to use port 5173...\n');

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
            console.log(`📝 Updated form URLs in workflow ${workflow.id}:`);
            console.log(`   Test: ${config.testUrl}`);
            console.log(`   Prod: ${config.productionUrl}`);
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
          console.error(`❌ Error updating workflow ${workflow.id}:`, updateError);
        } else {
          updatedCount++;
          console.log(`✅ Successfully updated workflow ${workflow.id}\n`);
        }
      }
    }

    console.log(`\n🎉 Complete! Updated ${updatedCount} workflows.`);
    console.log('All form URLs now use port 5173.');

  } catch (error) {
    console.error('❌ Error fixing form URLs:', error);
  }
}

fixFormUrls();