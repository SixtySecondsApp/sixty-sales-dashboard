import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env file manually
const envPath = join(__dirname, '..', '.env');
const envContent = readFileSync(envPath, 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    envVars[key.trim()] = values.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const serviceKey = envVars.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixDealsSchema() {
  try {
    // Try to select from deals to see what columns are available
    const { data: sampleDeal, error: sampleError } = await supabase
      .from('deals')
      .select('*')
      .limit(1);
    
    if (!sampleError && sampleDeal) {
      const availableColumns = sampleDeal.length > 0 ? Object.keys(sampleDeal[0]) : [];
      
      if (availableColumns.length > 0) {
        availableColumns.forEach(col => undefined);
      }
    }
    
    // Test creating a deal without the problematic fields
    // Get a user and stage for testing
    const { data: users } = await supabase.from('profiles').select('id').limit(1);
    const { data: stages } = await supabase.from('deal_stages').select('id').limit(1);
    
    if (!users?.[0] || !stages?.[0]) {
      return;
    }
    
    const testDeal = {
      name: 'Schema Test Deal - No Contact',
      company: 'Test Company',
      value: 1000,
      stage_id: stages[0].id,
      owner_id: users[0].id,
      status: 'active',
      // These fields will work with the existing schema
      contact_name: 'Test Contact',
      contact_email: 'test@example.com'
    };
    const { data: newDeal, error: createError } = await supabase
      .from('deals')
      .insert(testDeal)
      .select('id, name, contact_name, contact_email')
      .single();
    
    if (createError) {
    } else {
      // Clean up test deal
      await supabase.from('deals').delete().eq('id', newDeal.id);
    }
    
  } catch (error) {
  }
}

// Run the fix
fixDealsSchema().then(() => {
  process.exit(0);
});