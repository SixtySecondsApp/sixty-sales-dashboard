// Verify API Keys Fix
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

async function verifyApiFix() {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 1. Check if api_keys table exists and is accessible
        const { data: tableData, error: tableError } = await supabase
            .from('api_keys')
            .select('id, name, created_at')
            .limit(1);
        
        if (tableError) {
            if (tableError.code === '42P01') {
                return false;
            } else {
                return false;
            }
        }
        // 2. Check if required columns exist by attempting an insert (dry run)
        const testData = {
            name: 'test-key-dry-run',
            key_hash: 'test-hash-' + Date.now(),
            key_preview: 'sk_test...1234',
            user_id: '00000000-0000-0000-0000-000000000000', // Placeholder UUID
            permissions: ['deals:read'],
            rate_limit: 500,
            is_active: true,
            usage_count: 0
        };

        // First, let's just validate the structure by selecting with these columns
        // Note: some columns might be named differently (last_used vs last_used_at)
        const { error: structureError } = await supabase
            .from('api_keys')
            .select('id, name, key_hash, key_preview, user_id, permissions, rate_limit, usage_count, expires_at, is_active, created_at, updated_at')
            .limit(0);
        
        // Also test the alternative column name
        const { error: altStructureError } = await supabase
            .from('api_keys')  
            .select('last_used_at')
            .limit(0);
        
        if (structureError) {
            return false;
        }
        // 3. Check if api_requests table exists
        const { error: requestsError } = await supabase
            .from('api_requests')
            .select('id')
            .limit(0);
        
        if (requestsError) {
            return false;
        }
        // 4. Test helper functions exist
        try {
            const { data: hashTest, error: hashError } = await supabase.rpc('hash_api_key', { key_text: 'test-key' });
            if (hashError) {
                return false;
            }
            const { data: generateTest, error: generateError } = await supabase.rpc('generate_api_key');
            if (generateError) {
                return false;
            }
        } catch (e) {
            return false;
        }
        return true;

    } catch (error) {
        return false;
    }
}

// Run verification
verifyApiFix();