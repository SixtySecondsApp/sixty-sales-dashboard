import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function applyMigration() {
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'supabase/migrations/20250905100000_create_workflow_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    }).single();
    
    if (error) {
      // If exec_sql doesn't exist, try a direct approach
      // Create the table directly using the Supabase client
      const { error: tableError } = await supabase
        .from('user_automation_rules')
        .select('id')
        .limit(1);
      
      if (tableError && tableError.code === '42P01') {
      } else if (!tableError) {
      } else {
      }
    } else {
    }
    
  } catch (error) {
  }
}

applyMigration();