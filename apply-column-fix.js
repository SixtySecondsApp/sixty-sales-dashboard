// Apply the missing column fix
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

async function applyColumnFix() {
    console.log('🔧 Applying missing column fix...\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        // Read the SQL fix file
        const sqlFix = fs.readFileSync('fix-missing-columns.sql', 'utf8');
        
        // Apply the fix using a simple SQL execution
        // Since we can't use RPC directly, we'll add the column manually
        
        console.log('1. Adding is_active column if missing...');
        const { error: addColumnError } = await supabase.rpc('exec_sql', {
            sql: 'ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;'
        }).catch(async () => {
            // RPC might not work, try direct query approach
            // This is a fallback - the column should be added manually in Supabase dashboard
            console.log('   RPC not available - column must be added manually');
            console.log('   SQL: ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;');
            return { error: null };
        });

        if (addColumnError) {
            console.log('   Error adding column:', addColumnError.message);
        } else {
            console.log('   ✅ is_active column handled');
        }

        console.log('\n2. Testing column access after fix...');
        const { error: testError } = await supabase
            .from('api_keys')
            .select('is_active')
            .limit(0);
        
        if (testError) {
            console.log('   ❌ is_active column still not accessible:', testError.message);
            console.log('\n   📋 MANUAL FIX REQUIRED:');
            console.log('   1. Go to Supabase Dashboard > Database > Tables');
            console.log('   2. Find the api_keys table');
            console.log('   3. Add column: is_active (type: bool, default: true, nullable: false)');
            console.log('   4. Run this script again to verify');
        } else {
            console.log('   ✅ is_active column is now accessible');
        }

        console.log('\n3. Final verification...');
        const { error: finalError } = await supabase
            .from('api_keys')
            .select('id, name, key_hash, key_preview, user_id, permissions, rate_limit, usage_count, expires_at, is_active, created_at, updated_at')
            .limit(0);
        
        if (finalError) {
            console.log('   ❌ Final verification failed:', finalError.message);
        } else {
            console.log('   ✅ All columns accessible - fix successful!');
        }

    } catch (error) {
        console.error('💥 Error applying fix:', error.message);
    }
}

applyColumnFix();