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
  console.log('🔍 Checking for Fathom workflows...');
  
  const { data: workflows, error } = await supabase
    .from('user_automation_rules')
    .select('id, name, canvas_data')
    .or('name.ilike.%Fathom%,name.ilike.%fathom%');
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log('Found workflows:', workflows?.length || 0);
  workflows?.forEach(w => {
    console.log(`- ID: ${w.id}`);
    console.log(`  Name: ${w.name}`);
    const nodes = w.canvas_data?.nodes || [];
    const hasAIAgent = nodes.some(n => n.id === 'ai-summary-analyzer' || n.type === 'aiAgent');
    const hasGoogleDocs = nodes.some(n => n.id === 'google-docs-creator' || n.type === 'googleDocsCreator');
    console.log(`  Has AI Agent: ${hasAIAgent}`);
    console.log(`  Has Google Docs: ${hasGoogleDocs}`);
    if (hasAIAgent) {
      const aiNode = nodes.find(n => n.id === 'ai-summary-analyzer' || n.type === 'aiAgent');
      console.log(`  AI Agent position: x=${aiNode?.position?.x}, y=${aiNode?.position?.y}`);
    }
    if (hasGoogleDocs) {
      const gdNode = nodes.find(n => n.id === 'google-docs-creator' || n.type === 'googleDocsCreator');
      console.log(`  Google Docs position: x=${gdNode?.position?.x}, y=${gdNode?.position?.y}`);
    }
  });
}

checkWorkflows().catch(console.error);
