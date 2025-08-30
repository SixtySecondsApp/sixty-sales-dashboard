// Debug script to test API keys database structure
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

async function debugApiKeysDatabase() {
    console.log('🔍 Starting API Keys Database Diagnosis...\n');
    
    // Create service role client for admin access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });

    try {
        console.log('1. Testing basic database connection...');
        const { data: connectionTest, error: connectionError } = await supabase
            .from('profiles')
            .select('id')
            .limit(1);
        
        if (connectionError) {
            console.error('❌ Database connection failed:', connectionError.message);
            return;
        }
        console.log('✅ Database connection successful\n');

        console.log('2. Checking if api_keys table exists...');
        const { data: tableCheck, error: tableError } = await supabase
            .from('api_keys')
            .select('*')
            .limit(1);
        
        if (tableError) {
            if (tableError.code === '42P01') {
                console.error('❌ api_keys table does NOT exist');
                console.log('This is the primary issue causing API key creation failures\n');
                
                // Try to get list of all tables
                console.log('3. Listing all available tables...');
                try {
                    const { data: tables, error: tablesError } = await supabase.rpc('exec', {
                        sql: `
                            SELECT table_name 
                            FROM information_schema.tables 
                            WHERE table_schema = 'public' 
                            ORDER BY table_name;
                        `
                    });
                    
                    if (tablesError) {
                        console.log('Could not fetch table list:', tablesError.message);
                    } else {
                        console.log('Available tables:', tables?.map(t => t.table_name).join(', '));
                    }
                } catch (e) {
                    console.log('Table list fetch failed:', e.message);
                }
                
            } else {
                console.error('❌ api_keys table error:', tableError.message, '(code:', tableError.code + ')');
            }
            return;
        }
        console.log('✅ api_keys table exists and accessible\n');

        console.log('3. Checking api_keys table structure...');
        const { data: structure, error: structureError } = await supabase.rpc('exec', {
            sql: `
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'api_keys'
                ORDER BY ordinal_position;
            `
        });
        
        if (structureError) {
            console.error('❌ Could not fetch table structure:', structureError.message);
        } else {
            console.log('📋 api_keys table structure:');
            console.table(structure);
            
            // Check for required columns
            const columnNames = structure.map(col => col.column_name);
            const requiredColumns = ['id', 'name', 'key_hash', 'key_preview', 'user_id', 'permissions', 'created_at'];
            
            console.log('\n4. Verifying required columns...');
            const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
            
            if (missingColumns.length > 0) {
                console.error('❌ Missing required columns:', missingColumns.join(', '));
            } else {
                console.log('✅ All required columns present');
            }
        }

        console.log('\n5. Checking RLS policies...');
        const { data: policies, error: policiesError } = await supabase.rpc('exec', {
            sql: `
                SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
                FROM pg_policies 
                WHERE tablename = 'api_keys';
            `
        });
        
        if (policiesError) {
            console.error('❌ Could not fetch RLS policies:', policiesError.message);
        } else if (policies && policies.length > 0) {
            console.log('📋 RLS policies:');
            console.table(policies);
        } else {
            console.log('⚠️  No RLS policies found for api_keys table');
        }

        console.log('\n6. Testing Edge Function availability...');
        try {
            // We can't directly test Edge Functions from Node.js easily, so just report the structure
            console.log('📁 Edge Function should be at: supabase/functions/create-api-key/');
            
            const edgeFunctionPath = path.join(process.cwd(), 'supabase', 'functions', 'create-api-key', 'index.ts');
            
            if (fs.existsSync(edgeFunctionPath)) {
                console.log('✅ Edge Function file exists');
                const stats = fs.statSync(edgeFunctionPath);
                console.log(`   Size: ${stats.size} bytes`);
                console.log(`   Modified: ${stats.mtime.toISOString()}`);
            } else {
                console.log('❌ Edge Function file not found');
            }
            
        } catch (e) {
            console.log('❌ Edge Function check failed:', e.message);
        }

        console.log('\n📊 DIAGNOSIS SUMMARY');
        console.log('===================');
        
        if (tableError?.code === '42P01') {
            console.log('🚨 CRITICAL ISSUE: api_keys table does not exist');
            console.log('');
            console.log('RESOLUTION STEPS:');
            console.log('1. Run the migration files to create the api_keys table');
            console.log('2. Check that the latest migration (20250828000000_update_api_keys_structure.sql) was applied');
            console.log('3. Verify RLS policies are correctly set up');
            console.log('');
            console.log('COMMANDS TO RUN:');
            console.log('supabase db reset (if using local dev)');
            console.log('OR manually run the migration files in the Supabase dashboard');
        } else {
            console.log('✅ Database structure appears correct');
            console.log('The issue may be in authentication or Edge Function logic');
        }
        
    } catch (error) {
        console.error('💥 Unexpected error during diagnosis:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the diagnosis
debugApiKeysDatabase();