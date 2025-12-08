#!/usr/bin/env node
/**
 * Create Development Users Script
 *
 * Creates auth users in the development Supabase project and links them
 * to existing profiles from production.
 *
 * Usage: node scripts/create-dev-users.mjs
 */

import { createClient } from '@supabase/supabase-js';

// Development Supabase credentials
const DEV_SUPABASE_URL = 'https://jczngsvpywgrlgdwzjbr.supabase.co';
const DEV_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc';

// Default password for all dev users (change after first login)
const DEFAULT_PASSWORD = 'DevPassword123!';

async function main() {
  console.log('🔐 Creating development auth users...\n');

  const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  // Get all profiles from dev database
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .order('created_at', { ascending: true });

  if (profilesError) {
    console.error('❌ Failed to fetch profiles:', profilesError.message);
    process.exit(1);
  }

  console.log(`📋 Found ${profiles.length} profiles in development database\n`);

  const results = {
    created: [],
    skipped: [],
    failed: []
  };

  for (const profile of profiles) {
    if (!profile.email) {
      console.log(`⏭️  Skipping profile ${profile.id} - no email`);
      results.skipped.push({ id: profile.id, reason: 'no email' });
      continue;
    }

    console.log(`\n👤 Processing: ${profile.email}`);

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === profile.email);

    if (existingUser) {
      console.log(`   ⏭️  Auth user already exists (${existingUser.id})`);

      // Check if IDs match
      if (existingUser.id !== profile.id) {
        console.log(`   ⚠️  ID mismatch: auth=${existingUser.id}, profile=${profile.id}`);
        console.log(`   🔧 Updating profile ID to match auth user...`);

        // Update profile ID to match auth user ID
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ id: existingUser.id })
          .eq('id', profile.id);

        if (updateError) {
          console.log(`   ❌ Failed to update profile: ${updateError.message}`);
          results.failed.push({ email: profile.email, error: updateError.message });
        } else {
          console.log(`   ✅ Profile ID updated`);
          results.created.push({ email: profile.email, id: existingUser.id });
        }
      } else {
        results.skipped.push({ email: profile.email, reason: 'already exists' });
      }
      continue;
    }

    // Create new auth user with the SAME UUID as the profile
    try {
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: profile.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: [profile.first_name, profile.last_name].filter(Boolean).join(' '),
          migrated_from_prod: true
        }
      });

      if (createError) {
        console.log(`   ❌ Failed to create: ${createError.message}`);
        results.failed.push({ email: profile.email, error: createError.message });
        continue;
      }

      console.log(`   ✅ Created auth user: ${newUser.user.id}`);

      // Update profile to use the new auth user ID
      if (newUser.user.id !== profile.id) {
        console.log(`   🔧 Updating profile ID: ${profile.id} → ${newUser.user.id}`);

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ id: newUser.user.id })
          .eq('id', profile.id);

        if (updateError) {
          console.log(`   ⚠️  Profile update failed: ${updateError.message}`);
          // Try to update related records
        }
      }

      results.created.push({ email: profile.email, id: newUser.user.id });
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
      results.failed.push({ email: profile.email, error: err.message });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Created/Updated: ${results.created.length}`);
  console.log(`⏭️  Skipped: ${results.skipped.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);

  if (results.created.length > 0) {
    console.log('\n🔐 Default password for all users: ' + DEFAULT_PASSWORD);
    console.log('⚠️  Users should change their password after first login!');
  }

  if (results.failed.length > 0) {
    console.log('\n❌ Failed users:');
    results.failed.forEach(f => console.log(`   - ${f.email}: ${f.error}`));
  }

  console.log('\n✨ Done!');
}

main().catch(console.error);
