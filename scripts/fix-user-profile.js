#!/usr/bin/env node

/**
 * Script to fix user profiles - restore admin access, names, and stages
 * Usage: node scripts/fix-user-profile.js
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

// User profiles to fix with their proper data
const userProfiles = {
  'andrew.bryce@sixtyseconds.video': {
    first_name: 'Andrew',
    last_name: 'Bryce',
    stage: 'Director',
    is_admin: true,
    role: 'Admin',
    department: 'Sales'
  },
  'phil@sixtyseconds.video': {
    first_name: 'Phil',
    last_name: '',
    stage: 'Director',
    is_admin: true,
    role: 'Admin',
    department: 'Sales'
  },
  'steve.gibson@sixtyseconds.video': {
    first_name: 'Steve',
    last_name: 'Gibson',
    stage: 'Manager',
    is_admin: true,
    role: 'Admin',
    department: 'Sales'
  },
  'james.lord@sixtyseconds.video': {
    first_name: 'James',
    last_name: 'Lord',
    stage: 'Senior',
    is_admin: false,
    role: 'User',
    department: 'Sales'
  },
  'nick@sixtyseconds.video': {
    first_name: 'Nick',
    last_name: '',
    stage: 'Junior',
    is_admin: false,
    role: 'User',
    department: 'Sales'
  }
};

async function fixUserProfiles() {
  try {
    console.log('🔧 Fixing user profiles...\n');

    // First, let's see what columns actually exist in the profiles table
    const { data: sampleProfile, error: sampleError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .single();

    if (sampleProfile) {
      console.log('📊 Available columns in profiles table:');
      console.log(Object.keys(sampleProfile).join(', '));
      console.log('\n');
    }

    // Update each user profile
    for (const [email, profileData] of Object.entries(userProfiles)) {
      console.log(`📝 Updating profile for ${email}...`);

      // First get the user to get their ID
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
      
      if (usersError) {
        console.error('❌ Error fetching users:', usersError);
        continue;
      }

      const user = users?.find(u => u.email === email);
      
      if (!user) {
        console.log(`⚠️ User not found: ${email}`);
        continue;
      }

      // Build update object based on what columns exist
      const updateData = {
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        email: email,
        updated_at: new Date().toISOString()
      };

      // Add optional fields if they exist in the table
      if (sampleProfile && 'stage' in sampleProfile) {
        updateData.stage = profileData.stage;
      }
      if (sampleProfile && 'is_admin' in sampleProfile) {
        updateData.is_admin = profileData.is_admin;
      }
      if (sampleProfile && 'role' in sampleProfile) {
        updateData.role = profileData.role;
      }
      if (sampleProfile && 'department' in sampleProfile) {
        updateData.department = profileData.department;
      }
      if (sampleProfile && 'full_name' in sampleProfile) {
        updateData.full_name = `${profileData.first_name} ${profileData.last_name}`.trim();
      }
      if (sampleProfile && 'username' in sampleProfile) {
        updateData.username = email;
      }

      // Update the profile
      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        // If update fails, try to create the profile
        if (updateError.code === 'PGRST116') {
          console.log(`  Creating new profile...`);
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              ...updateData
            })
            .select()
            .single();

          if (createError) {
            console.error(`❌ Error creating profile:`, createError);
          } else {
            console.log(`✅ Profile created successfully`);
            if (profileData.is_admin) {
              console.log(`  👑 Admin privileges granted`);
            }
          }
        } else {
          console.error(`❌ Error updating profile:`, updateError);
        }
      } else {
        console.log(`✅ Profile updated successfully`);
        if (profileData.is_admin) {
          console.log(`  👑 Admin privileges confirmed`);
        }
        console.log(`  📊 Stage: ${profileData.stage}`);
        console.log(`  👤 Name: ${profileData.first_name} ${profileData.last_name}`);
      }
    }

    console.log('\n✨ Profile fixes complete!');
    console.log('\n📌 Note: If some columns were not updated, they may not exist in your database schema.');
    console.log('You may need to run a migration to add missing columns like stage, is_admin, role, etc.');
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

// Run the script
fixUserProfiles();