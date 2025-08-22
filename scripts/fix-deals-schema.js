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
  console.error('❌ Missing Supabase credentials in environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

async function fixDealsSchema() {
  try {
    console.log('🔍 Checking deals table schema...\n');
    
    // Try to select from deals to see what columns are available
    const { data: sampleDeal, error: sampleError } = await supabase
      .from('deals')
      .select('*')
      .limit(1);
    
    if (!sampleError && sampleDeal) {
      const availableColumns = sampleDeal.length > 0 ? Object.keys(sampleDeal[0]) : [];
      
      if (availableColumns.length > 0) {
        console.log('📊 Current columns in deals table:');
        availableColumns.forEach(col => console.log(`   - ${col}`));
      }
      
      console.log('\n⚠️ The primary_contact_id column appears to be missing from the schema cache.');
      console.log('This usually means the column exists but Supabase needs to refresh its schema.\n');
      
      console.log('🔧 Please run these SQL commands in your Supabase SQL editor:\n');
      console.log('-- Add the column if it doesn\'t exist');
      console.log('ALTER TABLE deals ADD COLUMN IF NOT EXISTS primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;');
      console.log('');
      console.log('-- Add the company_id column if missing');
      console.log('ALTER TABLE deals ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;');
      console.log('');
      console.log('-- Create indexes for better performance');
      console.log('CREATE INDEX IF NOT EXISTS idx_deals_primary_contact_id ON deals(primary_contact_id);');
      console.log('CREATE INDEX IF NOT EXISTS idx_deals_company_id ON deals(company_id);');
      console.log('');
      console.log('-- After running these, reload the schema cache in Supabase Dashboard');
      console.log('-- Settings > API > Schema cache > Reload cache\n');
    }
    
    // Test creating a deal without the problematic fields
    console.log('🧪 Testing simplified deal creation...\n');
    
    // Get a user and stage for testing
    const { data: users } = await supabase.from('profiles').select('id').limit(1);
    const { data: stages } = await supabase.from('deal_stages').select('id').limit(1);
    
    if (!users?.[0] || !stages?.[0]) {
      console.log('❌ Cannot test - missing users or stages');
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
    
    console.log('📝 Creating test deal with basic fields...');
    const { data: newDeal, error: createError } = await supabase
      .from('deals')
      .insert(testDeal)
      .select('id, name, contact_name, contact_email')
      .single();
    
    if (createError) {
      console.log('❌ Deal creation failed:', createError.message);
    } else {
      console.log('✅ Deal created successfully with basic fields:', newDeal);
      
      // Clean up test deal
      await supabase.from('deals').delete().eq('id', newDeal.id);
      console.log('🧹 Test deal cleaned up');
    }
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the fix
fixDealsSchema().then(() => {
  console.log('\n🏁 Schema check completed');
  process.exit(0);
});