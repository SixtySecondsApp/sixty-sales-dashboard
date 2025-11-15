/**
 * Script to create a test user in Supabase
 * Run with: node scripts/create-test-user.js
 * 
 * Make sure to set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file
 * 
 * This script will:
 * 1. Try to create a test user with email: test@sixty.com
 * 2. If user exists, verify the password works
 * 3. Create/update the user profile
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
const envPath = join(__dirname, '..', '.env');
let envVars = {};

try {
  const envFile = readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      envVars[key] = value;
    }
  });
} catch (error) {
  console.error('Error reading .env file:', error.message);
  console.log('Make sure .env file exists in the root directory');
  process.exit(1);
}

const supabaseUrl = envVars.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const testEmail = envVars.TEST_USER_EMAIL || 'test@sixty.com';
const testPassword = envVars.TEST_USER_PASSWORD || 'TestPassword123!';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestUser() {
  console.log('🔐 Creating test user...');
  console.log(`   Email: ${testEmail}`);
  console.log(`   Password: ${testPassword}`);
  console.log('');

  try {
    // Try to sign up the user
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          full_name: 'Test User',
          first_name: 'Test',
          last_name: 'User'
        }
      }
    });

    if (error) {
      if (error.message.includes('already registered') || error.message.includes('already exists')) {
        console.log('ℹ️  User already exists. Attempting to sign in...');
        
        // Try to sign in to verify credentials
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: testEmail,
          password: testPassword
        });

        if (signInError) {
          console.error('❌ Sign in failed:', signInError.message);
          console.log('');
          console.log('💡 If the user exists but password is wrong, you can:');
          console.log('   1. Reset password in Supabase Dashboard');
          console.log('   2. Or delete the user and run this script again');
          process.exit(1);
        } else {
          console.log('✅ Test user credentials are valid!');
          console.log(`   User ID: ${signInData.user.id}`);
          console.log('');
          console.log('You can now use these credentials to log in:');
          console.log(`   Email: ${testEmail}`);
          console.log(`   Password: ${testPassword}`);
        }
      } else {
        console.error('❌ Error creating user:', error.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Test user created successfully!');
      console.log(`   User ID: ${data.user?.id}`);
      console.log('');
      
      if (data.user && !data.session) {
        console.log('⚠️  Note: Email confirmation may be required.');
        console.log('   Check your email or disable email confirmation in Supabase Dashboard');
        console.log('   (Authentication > Settings > Email Auth > Confirm email: OFF)');
      }
      
      console.log('');
      console.log('You can now use these credentials to log in:');
      console.log(`   Email: ${testEmail}`);
      console.log(`   Password: ${testPassword}`);
    }
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

createTestUser();

