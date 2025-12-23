import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkWorkflows() {
  console.log('🔍 Fetching all workflows...');
  
  const { data: workflows, error } = await supabase
    .from('user_automation_rules')
    .select('*')
    .limit(5);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Found workflows:', workflows?.length || 0);
  
  if (workflows && workflows.length > 0) {
    console.log('\nFirst workflow structure:');
    const firstWorkflow = workflows[0];
    console.log('Available fields:', Object.keys(firstWorkflow));
    
    // Check for workflows with AI and Google Docs nodes
    workflows.forEach(w => {
      console.log(`\n- ID: ${w.id}`);
      const nodes = w.canvas_data?.nodes || [];
      const hasAIAgent = nodes.some(n => n.type === 'aiAgent');
      const hasGoogleDocs = nodes.some(n => n.type === 'googleDocsCreator');
      const hasFathom = nodes.some(n => n.type === 'fathomWebhook');
      
      if (hasFathom || hasAIAgent || hasGoogleDocs) {
        console.log(`  Has Fathom: ${hasFathom}`);
        console.log(`  Has AI Agent: ${hasAIAgent}`);
        console.log(`  Has Google Docs: ${hasGoogleDocs}`);
        
        if (hasAIAgent) {
          const aiNode = nodes.find(n => n.type === 'aiAgent');
          console.log(`  AI Agent ID: ${aiNode?.id}`);
          console.log(`  AI Agent position: x=${aiNode?.position?.x}, y=${aiNode?.position?.y}`);
        }
        if (hasGoogleDocs) {
          const gdNode = nodes.find(n => n.type === 'googleDocsCreator');
          console.log(`  Google Docs ID: ${gdNode?.id}`);
          console.log(`  Google Docs position: x=${gdNode?.position?.x}, y=${gdNode?.position?.y}`);
        }
      }
    });
  }
}

checkWorkflows().catch(console.error);
