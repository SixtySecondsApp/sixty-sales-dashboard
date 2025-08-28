// Check current API keys table structure
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

async function checkCurrentStructure() {
    console.log('🔍 Checking current API keys table structure...\n');
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    try {
        // Try to get the current structure by attempting to select all columns
        const { data, error } = await supabase
            .from('api_keys')
            .select('*')
            .limit(1);
        
        if (error) {
            console.log('Error accessing table:', error.message);
            console.log('Error code:', error.code);
            return;
        }

        console.log('✅ Table exists and is accessible');
        
        if (data && data.length > 0) {
            console.log('Current record structure:');
            console.log(JSON.stringify(data[0], null, 2));
        } else {
            console.log('No records in table yet');
        }

        // Try to access specific columns to see what's missing
        const requiredColumns = [
            'id', 'name', 'key_hash', 'key_preview', 'user_id', 
            'permissions', 'rate_limit', 'usage_count', 'last_used', 
            'expires_at', 'is_active', 'created_at', 'updated_at'
        ];

        console.log('\nTesting individual columns:');
        for (const column of requiredColumns) {
            try {
                await supabase
                    .from('api_keys')
                    .select(column)
                    .limit(0);
                console.log(`✅ ${column}`);
            } catch (e) {
                console.log(`❌ ${column}: ${e.message}`);
            }
        }

        // Check what columns actually exist
        console.log('\nAttempting to identify existing columns...');
        const testSelects = [
            'id, name, key_hash',
            'user_id, permissions, rate_limit', 
            'created_at, updated_at',
            'last_used_at, expires_at', // Old naming
            'usage_count, is_active', // New columns
            'key_preview' // Frontend requirement
        ];

        for (const selectFields of testSelects) {
            try {
                await supabase
                    .from('api_keys')
                    .select(selectFields)
                    .limit(0);
                console.log(`✅ Available: ${selectFields}`);
            } catch (e) {
                console.log(`❌ Not available: ${selectFields}`);
            }
        }

    } catch (error) {
        console.error('💥 Unexpected error:', error.message);
    }
}

checkCurrentStructure();