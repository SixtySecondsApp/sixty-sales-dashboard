#!/usr/bin/env node

/**
 * Script to create a user profile in Supabase
 * Usage: node scripts/create-profile.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createProfile() {
  try {
    // Get current user
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.log('⚠️ No users found. Please sign up first.');
      return;
    }

    console.log('\n📋 Found users:');
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.id})`);
    });

    // For each user, check if profile exists
    for (const user of users) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code === 'PGRST116') {
        // No profile exists, create one
        console.log(`\n📝 Creating profile for ${user.email}...`);
        
        // Start with minimal required fields
        const profileData = {
          id: user.id,
          email: user.email,
          first_name: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || 'User',
          last_name: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ')[1] || '',
          stage: 'Junior', // Default stage for new users
          is_admin: false // Default non-admin for new users
        };

        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert(profileData)
          .select()
          .single();

        if (createError) {
          console.error(`❌ Error creating profile for ${user.email}:`, createError);
        } else {
          console.log(`✅ Profile created for ${user.email}`);
        }
      } else if (profile) {
        console.log(`✅ Profile already exists for ${user.email}`);
      } else if (profileError) {
        console.error(`❌ Error checking profile for ${user.email}:`, profileError);
      }
    }

    console.log('\n✨ Profile check complete!');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
createProfile();