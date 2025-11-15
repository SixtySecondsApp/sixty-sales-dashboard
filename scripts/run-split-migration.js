import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

// Create Supabase client with service role key for admin access
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
  try {
    // Read the migration file
    const migrationSQL = readFileSync(
      join(__dirname, '..', 'supabase', 'migrations', '20250824210900_add_split_activity_columns.sql'),
      'utf-8'
    );
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    // Execute each statement
    for (const statement of statements) {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: statement + ';'
      });
      
      if (error) {
        // Continue with other statements even if one fails
      } else {
      }
    }
  } catch (error) {
    process.exit(1);
  }
}

runMigration();