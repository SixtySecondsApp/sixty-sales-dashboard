#!/usr/bin/env tsx

/**
 * Create a test user for Playwright E2E testing
 * This script creates a user account that can be used in automated tests
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  const testEmail = 'test@playwright.local';
  const testPassword = 'TestPassword123!';
  try {
    // Create user using admin API
    const { data: user, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: 'Test User (Playwright)',
        is_admin: true // Give admin permissions for comprehensive testing
      }
    });

    if (createError) {
      if (createError.message.includes('already registered')) {
        // Update existing user to ensure they have admin permissions
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email === testEmail);
        
        if (existingUser) {
          const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
            user_metadata: {
              full_name: 'Test User (Playwright)',
              is_admin: true
            }
          });
          
          if (updateError) {
          } else {
          }
        }
      } else {
        throw createError;
      }
    } else {
    }

    // Update test environment file
    const testEnvContent = `# Test Environment Configuration for Playwright
# These credentials are for the automated test user

# Test user credentials
PLAYWRIGHT_TEST_USER_EMAIL=${testEmail}
PLAYWRIGHT_TEST_USER_PASSWORD=${testPassword}

# Base URL for testing
PLAYWRIGHT_TEST_BASE_URL=http://localhost:5173

# Supabase Configuration (same as production)
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${process.env.VITE_SUPABASE_ANON_KEY}
`;

    await import('fs/promises').then(fs => 
      fs.writeFile('.env.test', testEnvContent, 'utf-8')
    );
  } catch (error) {
    process.exit(1);
  }
}

// Run the script
createTestUser();