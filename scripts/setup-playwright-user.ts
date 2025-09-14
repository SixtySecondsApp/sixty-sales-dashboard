#!/usr/bin/env node

/**
 * Script to set up the Playwright test user with the same data and permissions
 * as andrew.bryce@sixtyseconds.video
 * 
 * Usage: npm run setup:playwright-user
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const ANDREW_EMAIL = 'andrew.bryce@sixtyseconds.video';
const PLAYWRIGHT_EMAIL = 'playwright@test.com';
const PLAYWRIGHT_PASSWORD = process.env.PLAYWRIGHT_TEST_PASSWORD || 'TestPassword123!';

async function setupPlaywrightUser() {
  console.log('🎭 Setting up Playwright test user...\n');

  try {
    // Step 1: Create Playwright user if it doesn't exist
    console.log('1️⃣ Checking if Playwright user exists...');
    
    const { data: existingUser, error: checkError } = await supabase.auth.admin.getUserByEmail(
      PLAYWRIGHT_EMAIL
    );

    let playwrightUserId: string;

    if (!existingUser || checkError) {
      console.log('   Creating new Playwright user...');
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: PLAYWRIGHT_EMAIL,
        password: PLAYWRIGHT_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: 'Playwright Test User',
          role: 'test_user',
        },
      });

      if (createError) {
        console.error('❌ Error creating user:', createError);
        process.exit(1);
      }

      playwrightUserId = newUser.user.id;
      console.log('   ✅ Playwright user created');
    } else {
      playwrightUserId = existingUser.user.id;
      console.log('   ✅ Playwright user already exists');
    }

    // Step 2: Get Andrew's user data
    console.log('\n2️⃣ Fetching andrew.bryce user data...');
    
    const { data: andrewUser, error: andrewError } = await supabase.auth.admin.getUserByEmail(
      ANDREW_EMAIL
    );

    if (andrewError || !andrewUser) {
      console.error('❌ Could not find andrew.bryce user:', andrewError);
      process.exit(1);
    }

    const andrewUserId = andrewUser.user.id;
    console.log('   ✅ Found andrew.bryce user');

    // Step 3: Copy profile data
    console.log('\n3️⃣ Copying profile data...');
    
    const { data: andrewProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', andrewUserId)
      .single();

    if (andrewProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: playwrightUserId,
          email: PLAYWRIGHT_EMAIL,
          full_name: 'Playwright Test User',
          organization_name: andrewProfile.organization_name,
          is_admin: andrewProfile.is_admin,
          role: andrewProfile.role,
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('⚠️  Warning: Could not update profile:', profileError);
      } else {
        console.log('   ✅ Profile data copied');
      }
    }

    // Step 4: Copy organization memberships
    console.log('\n4️⃣ Copying organization memberships...');
    
    const { data: orgMemberships } = await supabase
      .from('organization_members')
      .select('*')
      .eq('user_id', andrewUserId);

    if (orgMemberships && orgMemberships.length > 0) {
      for (const membership of orgMemberships) {
        await supabase
          .from('organization_members')
          .upsert({
            organization_id: membership.organization_id,
            user_id: playwrightUserId,
            role: membership.role,
            created_at: new Date().toISOString(),
          });
      }
      console.log(`   ✅ Copied ${orgMemberships.length} organization memberships`);
    }

    // Step 5: Copy calendar integration settings (without tokens)
    console.log('\n5️⃣ Setting up calendar integration...');
    
    const { data: calendarIntegration } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('user_id', andrewUserId)
      .single();

    if (calendarIntegration) {
      const { error: calendarError } = await supabase
        .from('calendar_integrations')
        .upsert({
          user_id: playwrightUserId,
          provider: calendarIntegration.provider,
          enabled: true, // Enable for testing
          calendar_id: calendarIntegration.calendar_id,
          settings: calendarIntegration.settings,
          updated_at: new Date().toISOString(),
        });

      if (calendarError) {
        console.error('⚠️  Warning: Could not copy calendar settings:', calendarError);
      } else {
        console.log('   ✅ Calendar integration settings copied');
      }
    }

    // Step 6: Create sample test data
    console.log('\n6️⃣ Creating sample test data...');
    
    // Copy recent deals
    const { data: deals } = await supabase
      .from('deals')
      .select('*')
      .eq('created_by', andrewUserId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (deals && deals.length > 0) {
      for (const deal of deals) {
        await supabase
          .from('deals')
          .insert({
            deal_name: `${deal.deal_name} (Test)`,
            company_name: deal.company_name,
            contact_name: deal.contact_name,
            contact_email: deal.contact_email,
            value: deal.value,
            stage: deal.stage,
            created_by: playwrightUserId,
            assigned_to: playwrightUserId,
            probability: deal.probability,
            expected_close_date: deal.expected_close_date,
            notes: 'Test copy for Playwright testing',
            created_at: new Date().toISOString(),
          });
      }
      console.log(`   ✅ Created ${deals.length} test deals`);
    }

    // Copy recent tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('assigned_to', andrewUserId)
      .order('created_at', { ascending: false })
      .limit(5);

    if (tasks && tasks.length > 0) {
      for (const task of tasks) {
        await supabase
          .from('tasks')
          .insert({
            title: `${task.title} (Test)`,
            description: task.description,
            assigned_to: playwrightUserId,
            created_by: playwrightUserId,
            due_date: task.due_date,
            priority: task.priority,
            status: task.status,
            tags: task.tags,
            created_at: new Date().toISOString(),
          });
      }
      console.log(`   ✅ Created ${tasks.length} test tasks`);
    }

    // Copy recent calendar events
    const { data: events } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', andrewUserId)
      .order('start_time', { ascending: false })
      .limit(10);

    if (events && events.length > 0) {
      for (const event of events) {
        await supabase
          .from('calendar_events')
          .insert({
            user_id: playwrightUserId,
            title: `${event.title} (Test)`,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time,
            location: event.location,
            attendees: event.attendees,
            category: event.category,
            all_day: event.all_day,
            recurring: event.recurring,
            created_at: new Date().toISOString(),
          });
      }
      console.log(`   ✅ Created ${events.length} test calendar events`);
    }

    // Step 7: Create test environment file
    console.log('\n7️⃣ Creating test environment configuration...');
    
    const testEnvContent = `# Playwright Test User Configuration
TEST_USER_EMAIL=${PLAYWRIGHT_EMAIL}
TEST_USER_PASSWORD=${PLAYWRIGHT_PASSWORD}
TEST_USER_ID=${playwrightUserId}

# Add to your .env.local or .env file for testing
`;

    const fs = await import('fs');
    fs.writeFileSync('.env.test', testEnvContent);
    console.log('   ✅ Created .env.test file');

    console.log('\n✨ Playwright test user setup complete!\n');
    console.log('📝 Test user credentials:');
    console.log(`   Email: ${PLAYWRIGHT_EMAIL}`);
    console.log(`   Password: ${PLAYWRIGHT_PASSWORD}`);
    console.log(`   User ID: ${playwrightUserId}`);
    console.log('\n💡 Add the .env.test values to your main .env file for testing');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run the setup
setupPlaywrightUser();