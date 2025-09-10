#!/usr/bin/env node

/**
 * Script to check current user profiles and their data
 * Usage: node scripts/check-current-profile.js
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

async function checkProfiles() {
  try {
    console.log('🔍 Checking user profiles...\n');

    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('email');

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError);
      return;
    }

    console.log('📊 All profiles in database:\n');
    console.log('═'.repeat(80));
    
    profiles.forEach(profile => {
      console.log(`Email: ${profile.email}`);
      console.log(`  ID: ${profile.id}`);
      console.log(`  Name: ${profile.first_name || 'NULL'} ${profile.last_name || 'NULL'}`);
      console.log(`  Stage: ${profile.stage || 'NULL'}`);
      console.log(`  Admin: ${profile.is_admin === true ? '✅ YES' : '❌ NO'}`);
      console.log(`  Created: ${profile.created_at}`);
      console.log(`  Updated: ${profile.updated_at}`);
      console.log('─'.repeat(80));
    });

    // Check specifically for Andrew Bryce
    console.log('\n🎯 Checking Andrew Bryce profile specifically:\n');
    
    const andrewEmails = [
      'andrew.bryce@sixtyseconds.video',
      'andrewbryce@sixtyseconds.video',
      'andrew@sixtyseconds.video'
    ];

    for (const email of andrewEmails) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (profile) {
        console.log(`✅ Found profile for ${email}:`);
        console.log(JSON.stringify(profile, null, 2));
        break;
      } else if (error && error.code !== 'PGRST116') {
        console.log(`⚠️ Error checking ${email}:`, error);
      } else {
        console.log(`❌ No profile found for ${email}`);
      }
    }

    // Also check auth users
    console.log('\n👥 Checking auth users:\n');
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }

    const sixtySUsers = users?.filter(u => u.email?.includes('sixtyseconds')) || [];
    
    sixtySUsers.forEach(user => {
      console.log(`Auth User: ${user.email}`);
      console.log(`  ID: ${user.id}`);
      console.log(`  Created: ${user.created_at}`);
      console.log(`  Last Sign In: ${user.last_sign_in_at}`);
      
      // Check if this user has a profile
      const profile = profiles.find(p => p.id === user.id);
      if (profile) {
        console.log(`  ✅ Has profile - Name: ${profile.first_name} ${profile.last_name}, Stage: ${profile.stage}, Admin: ${profile.is_admin}`);
      } else {
        console.log(`  ❌ NO PROFILE FOUND`);
      }
      console.log('─'.repeat(80));
    });

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
checkProfiles();