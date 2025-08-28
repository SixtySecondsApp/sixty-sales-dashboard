// Debug specific column issues
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

async function debugColumnIssue() {
    console.log('🐛 Debugging column access issue...\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Test each column individually to find the problem
    const testColumns = [
        'id',
        'name', 
        'key_hash',
        'key_preview',
        'user_id',
        'permissions',
        'rate_limit',
        'usage_count',
        'last_used',      // This might be the issue
        'last_used_at',   // Alternative name
        'expires_at',
        'is_active',      // This might be the issue 
        'created_at',
        'updated_at'
    ];

    console.log('Testing individual column access:');
    for (const column of testColumns) {
        try {
            const { error } = await supabase
                .from('api_keys')
                .select(column)
                .limit(0);
            
            if (error) {
                console.log(`❌ ${column}: ${error.message} (code: ${error.code})`);
            } else {
                console.log(`✅ ${column}`);
            }
        } catch (e) {
            console.log(`💥 ${column}: ${e.message}`);
        }
    }

    // Now test the exact select that's failing in the verification script
    console.log('\nTesting the exact failing select:');
    try {
        const { error } = await supabase
            .from('api_keys')
            .select('id, name, key_hash, key_preview, user_id, permissions, rate_limit, usage_count, expires_at, is_active, created_at, updated_at')
            .limit(0);
        
        if (error) {
            console.log('❌ Combined select failed:', error.message);
            console.log('Error details:', JSON.stringify(error, null, 2));
            
            // Try without the problematic columns
            console.log('\nTrying without potentially problematic columns:');
            const { error: safeError } = await supabase
                .from('api_keys')
                .select('id, name, key_hash, key_preview, user_id, permissions, rate_limit, created_at')
                .limit(0);
            
            if (safeError) {
                console.log('❌ Even safe select failed:', safeError.message);
            } else {
                console.log('✅ Safe select works - issue is with usage_count, expires_at, is_active, or updated_at');
            }
            
        } else {
            console.log('✅ Combined select works fine');
        }
    } catch (e) {
        console.log('💥 Combined select threw exception:', e.message);
    }
}

debugColumnIssue();