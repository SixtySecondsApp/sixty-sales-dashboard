#!/usr/bin/env node

/**
 * Permanent fix for user profile authentication issues
 * This script ensures profiles are correctly linked to auth users by email
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixProfiles() {
  console.log('🔍 Fetching all auth users...');
  
  // Get all users from auth
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  
  if (usersError) {
    console.error('❌ Error fetching users:', usersError);
    return;
  }
  
  console.log(`Found ${users.length} auth users`);
  
  for (const user of users) {
    console.log(`\n📧 Processing user: ${user.email}`);
    
    // Check if profile exists by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();
    
    if (profileError && profileError.code !== 'PGRST116') {
      console.error(`❌ Error fetching profile for ${user.email}:`, profileError);
      continue;
    }
    
    if (profile) {
      console.log(`✅ Profile exists for ${user.email}`);
      console.log(`   Name: ${profile.first_name} ${profile.last_name}`);
      console.log(`   Stage: ${profile.stage}`);
      console.log(`   Admin: ${profile.is_admin}`);
      
      // Check if ID matches
      if (profile.id !== user.id) {
        console.log(`⚠️  Profile ID mismatch! Profile: ${profile.id}, Auth: ${user.id}`);
        console.log(`   This is OK - we now use email as primary key`);
      }
    } else {
      console.log(`❌ No profile found for ${user.email}`);
      
      // Create profile with correct data
      const profileData = {
        id: user.id,
        email: user.email,
        first_name: user.user_metadata?.first_name || user.email.split('@')[0].split('.')[0] || 'User',
        last_name: user.user_metadata?.last_name || user.email.split('@')[0].split('.')[1] || '',
        stage: 'Junior', // Default stage
        is_admin: false, // Default non-admin
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      // Special case for known admins
      if (user.email === 'andrew.bryce@sixtyseconds.video') {
        profileData.first_name = 'Andrew';
        profileData.last_name = 'Bryce';
        profileData.stage = 'Director';
        profileData.is_admin = true;
      }
      
      console.log(`📝 Creating profile with data:`, profileData);
      
      const { error: createError } = await supabase
        .from('profiles')
        .insert(profileData);
      
      if (createError) {
        console.error(`❌ Error creating profile:`, createError);
      } else {
        console.log(`✅ Profile created successfully`);
      }
    }
  }
  
  console.log('\n✨ Profile fix complete!');
}

// Run the fix
fixProfiles().catch(console.error);