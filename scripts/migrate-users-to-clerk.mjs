#!/usr/bin/env node
/**
 * Migrate Users from Supabase Auth to Clerk
 *
 * This script:
 * 1. Fetches all users from Supabase Auth
 * 2. Creates them in Clerk (without passwords)
 * 3. Creates a mapping table in Supabase (supabase_user_id -> clerk_user_id)
 * 4. Users will need to reset their password on first Clerk login
 *
 * Prerequisites:
 * - SUPABASE_SERVICE_ROLE_KEY in .env (to list auth users)
 * - CLERK_SECRET_KEY in .env (to create Clerk users)
 *
 * Usage:
 *   node scripts/migrate-users-to-clerk.mjs
 *   node scripts/migrate-users-to-clerk.mjs --dry-run  # Preview without changes
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

// Check for dry-run mode
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!CLERK_SECRET_KEY) {
  console.error('❌ Missing CLERK_SECRET_KEY');
  process.exit(1);
}

// Initialize Supabase admin client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Fetch all users from Supabase Auth
 */
async function getSupabaseUsers() {
  console.log('📋 Fetching users from Supabase Auth...');

  const allUsers = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error('❌ Error fetching users:', error.message);
      throw error;
    }

    if (!data.users || data.users.length === 0) {
      break;
    }

    allUsers.push(...data.users);
    console.log(`   Fetched page ${page}: ${data.users.length} users`);

    if (data.users.length < perPage) {
      break;
    }

    page++;
  }

  console.log(`✅ Found ${allUsers.length} total users in Supabase`);
  return allUsers;
}

/**
 * Create a user in Clerk
 */
async function createClerkUser(supabaseUser) {
  const email = supabaseUser.email;

  if (!email) {
    console.warn(`⚠️ Skipping user ${supabaseUser.id} - no email address`);
    return null;
  }

  // Parse name from metadata
  const fullName = supabaseUser.user_metadata?.full_name ||
                   supabaseUser.user_metadata?.name ||
                   '';
  const nameParts = fullName.split(' ');
  const firstName = nameParts[0] || email.split('@')[0];
  const lastName = nameParts.slice(1).join(' ') || undefined;

  const payload = {
    email_address: [email],
    first_name: firstName,
    last_name: lastName,
    // Don't set password - user will need to reset
    skip_password_requirement: true,
    // Mark email as verified if it was verified in Supabase
    skip_password_checks: true,
    // Store Supabase user ID in external_id for reference
    external_id: supabaseUser.id,
    // Add public metadata
    public_metadata: {
      supabase_user_id: supabaseUser.id,
      migrated_from_supabase: true,
      migrated_at: new Date().toISOString(),
    },
  };

  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would create Clerk user for: ${email}`);
    return { id: `dry-run-${supabaseUser.id}`, email };
  }

  try {
    const response = await fetch('https://api.clerk.com/v1/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json();

      // Check if user already exists
      if (errorData.errors?.[0]?.code === 'form_identifier_exists') {
        console.log(`   ℹ️ User ${email} already exists in Clerk`);

        // Fetch existing user to get their ID
        const existingUser = await findClerkUserByEmail(email);
        return existingUser;
      }

      throw new Error(`Clerk API error: ${JSON.stringify(errorData)}`);
    }

    const clerkUser = await response.json();
    console.log(`   ✅ Created Clerk user for: ${email} (ID: ${clerkUser.id})`);
    return clerkUser;
  } catch (error) {
    console.error(`   ❌ Failed to create Clerk user for ${email}:`, error.message);
    return null;
  }
}

/**
 * Find a Clerk user by email
 */
async function findClerkUserByEmail(email) {
  try {
    const response = await fetch(
      `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const users = await response.json();
    return users[0] || null;
  } catch {
    return null;
  }
}

/**
 * Ensure the user mapping table exists in Supabase
 */
async function ensureMappingTableExists() {
  console.log('📋 Checking user mapping table...');

  if (DRY_RUN) {
    console.log('   [DRY RUN] Would create clerk_user_mapping table if not exists');
    return;
  }

  // Check if table exists by trying to query it
  const { error } = await supabase
    .from('clerk_user_mapping')
    .select('id')
    .limit(1);

  if (error?.code === '42P01') {
    // Table doesn't exist, create it
    console.log('   Creating clerk_user_mapping table...');

    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.clerk_user_mapping (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supabase_user_id UUID NOT NULL UNIQUE,
          clerk_user_id TEXT NOT NULL UNIQUE,
          email TEXT,
          migrated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_clerk_user_mapping_supabase_id
          ON public.clerk_user_mapping(supabase_user_id);

        CREATE INDEX IF NOT EXISTS idx_clerk_user_mapping_clerk_id
          ON public.clerk_user_mapping(clerk_user_id);

        -- Enable RLS
        ALTER TABLE public.clerk_user_mapping ENABLE ROW LEVEL SECURITY;

        -- Allow service role full access
        CREATE POLICY "Service role can manage mappings"
          ON public.clerk_user_mapping
          FOR ALL
          USING (true);
      `
    });

    if (createError) {
      console.error('❌ Failed to create mapping table:', createError.message);
      console.log('   You may need to create the table manually. SQL:');
      console.log(`
        CREATE TABLE IF NOT EXISTS public.clerk_user_mapping (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          supabase_user_id UUID NOT NULL UNIQUE,
          clerk_user_id TEXT NOT NULL UNIQUE,
          email TEXT,
          migrated_at TIMESTAMPTZ DEFAULT NOW(),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `);
    } else {
      console.log('   ✅ Created clerk_user_mapping table');
    }
  } else if (error) {
    console.error('❌ Error checking mapping table:', error.message);
  } else {
    console.log('   ✅ Mapping table already exists');
  }
}

/**
 * Save user mapping to Supabase
 */
async function saveUserMapping(supabaseUserId, clerkUserId, email) {
  if (DRY_RUN) {
    console.log(`   [DRY RUN] Would save mapping: ${supabaseUserId} -> ${clerkUserId}`);
    return;
  }

  const { error } = await supabase
    .from('clerk_user_mapping')
    .upsert({
      supabase_user_id: supabaseUserId,
      clerk_user_id: clerkUserId,
      email,
      migrated_at: new Date().toISOString(),
    }, {
      onConflict: 'supabase_user_id',
    });

  if (error) {
    console.error(`   ❌ Failed to save mapping for ${email}:`, error.message);
  }
}

/**
 * Main migration function
 */
async function migrateUsers() {
  console.log('🚀 Starting Supabase -> Clerk user migration');
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE'}`);
  console.log('');

  // Ensure mapping table exists
  await ensureMappingTableExists();
  console.log('');

  // Get all Supabase users
  const supabaseUsers = await getSupabaseUsers();
  console.log('');

  // Migrate each user
  console.log('👥 Migrating users to Clerk...');

  const results = {
    success: 0,
    skipped: 0,
    failed: 0,
    alreadyExists: 0,
  };

  for (const supabaseUser of supabaseUsers) {
    const clerkUser = await createClerkUser(supabaseUser);

    if (clerkUser) {
      // Save mapping
      await saveUserMapping(supabaseUser.id, clerkUser.id, supabaseUser.email);

      if (clerkUser.id.startsWith('dry-run-')) {
        results.success++;
      } else if (clerkUser.public_metadata?.migrated_from_supabase) {
        results.alreadyExists++;
      } else {
        results.success++;
      }
    } else if (!supabaseUser.email) {
      results.skipped++;
    } else {
      results.failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('');
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Successfully migrated: ${results.success}`);
  console.log(`   ℹ️ Already existed: ${results.alreadyExists}`);
  console.log(`   ⏭️ Skipped (no email): ${results.skipped}`);
  console.log(`   ❌ Failed: ${results.failed}`);
  console.log('');

  if (!DRY_RUN) {
    console.log('🎉 Migration complete!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Users will need to reset their password when logging in with Clerk');
    console.log('2. They can use "Forgot Password" to set a new password');
    console.log('3. The clerk_user_mapping table maps Supabase IDs to Clerk IDs');
  } else {
    console.log('🔍 Dry run complete - no changes were made');
    console.log('   Run without --dry-run to perform the actual migration');
  }
}

// Run migration
migrateUsers().catch(error => {
  console.error('💥 Migration failed:', error);
  process.exit(1);
});
