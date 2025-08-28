// Verify API Keys Fix
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

async function verifyApiFix() {
    console.log('🔧 Verifying API Keys Fix...\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        // 1. Check if api_keys table exists and is accessible
        console.log('1. Testing api_keys table access...');
        const { data: tableData, error: tableError } = await supabase
            .from('api_keys')
            .select('id, name, created_at')
            .limit(1);
        
        if (tableError) {
            if (tableError.code === '42P01') {
                console.log('❌ api_keys table does not exist - migration needs to be applied');
                return false;
            } else {
                console.log('❌ Table access error:', tableError.message);
                return false;
            }
        }
        console.log('✅ api_keys table is accessible');

        // 2. Check if required columns exist by attempting an insert (dry run)
        console.log('\n2. Testing table structure...');
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
            console.log('❌ Table structure issue:', structureError.message);
            return false;
        }
        console.log('✅ All required columns are present');

        // 3. Check if api_requests table exists
        console.log('\n3. Testing api_requests table...');
        const { error: requestsError } = await supabase
            .from('api_requests')
            .select('id')
            .limit(0);
        
        if (requestsError) {
            console.log('❌ api_requests table issue:', requestsError.message);
            return false;
        }
        console.log('✅ api_requests table is accessible');

        // 4. Test helper functions exist
        console.log('\n4. Testing helper functions...');
        try {
            const { data: hashTest, error: hashError } = await supabase.rpc('hash_api_key', { key_text: 'test-key' });
            if (hashError) {
                console.log('❌ hash_api_key function not available:', hashError.message);
                return false;
            }
            console.log('✅ hash_api_key function works');

            const { data: generateTest, error: generateError } = await supabase.rpc('generate_api_key');
            if (generateError) {
                console.log('❌ generate_api_key function not available:', generateError.message);
                return false;
            }
            console.log('✅ generate_api_key function works');
        } catch (e) {
            console.log('❌ Function test failed:', e.message);
            return false;
        }

        console.log('\n✅ ALL CHECKS PASSED!');
        console.log('🎉 The API Keys system should now work correctly.');
        console.log('\nNext steps:');
        console.log('1. Apply the migration if you haven\'t: 20250829000000_fix_api_keys_final.sql');
        console.log('2. Test the Edge Function by creating an API key through the UI');
        console.log('3. Verify the API authentication works with the new key');
        
        return true;

    } catch (error) {
        console.error('💥 Verification failed:', error.message);
        return false;
    }
}

// Run verification
verifyApiFix();