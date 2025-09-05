import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const connectionString = supabaseUrl
  ? supabaseUrl.replace('https://', 'postgresql://postgres.').replace('.supabase.co', '.supabase.co:5432/postgres')
  : null;

async function fixTableDirectly() {
  if (!connectionString) {
    console.error('Could not construct connection string from VITE_SUPABASE_URL');
    
    // Provide manual instructions instead
    console.log('\n================================');
    console.log('MANUAL FIX REQUIRED');
    console.log('================================\n');
    console.log('The Supabase schema cache is out of sync with the actual table.');
    console.log('\nPlease follow these steps to fix it:\n');
    console.log('1. Go to your Supabase Dashboard:');
    console.log('   https://app.supabase.com/project/ewtuefzeogytgmsnkpmb/editor\n');
    console.log('2. Run this SQL query:\n');
    console.log(`-- First, check if the table exists and what columns it has
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_automation_rules' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- If canvas_data column is missing, add it:
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS canvas_data JSONB;

-- Add other missing columns if needed:
ALTER TABLE public.user_automation_rules 
ADD COLUMN IF NOT EXISTS trigger_conditions JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS action_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS template_id TEXT,
ADD COLUMN IF NOT EXISTS priority_level INTEGER DEFAULT 1;

-- Force the schema cache to refresh:
NOTIFY pgrst, 'reload schema';`);
    console.log('\n3. After running the SQL, click "Run" in the SQL editor');
    console.log('\n4. Wait about 30 seconds for the schema cache to refresh');
    console.log('\n5. Try saving a workflow again in the app\n');
    console.log('================================\n');
    return;
  }

  try {
    // This won't work without proper auth, but provide the instructions
    console.log('Direct database connection not available.');
    console.log('Please run the SQL manually as shown above.');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

fixTableDirectly();