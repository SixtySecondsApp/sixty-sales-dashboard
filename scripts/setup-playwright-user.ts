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
  try {
    // Step 1: Create Playwright user if it doesn't exist
    const { data: existingUser, error: checkError } = await supabase.auth.admin.getUserByEmail(
      PLAYWRIGHT_EMAIL
    );

    let playwrightUserId: string;

    if (!existingUser || checkError) {
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
        process.exit(1);
      }

      playwrightUserId = newUser.user.id;
    } else {
      playwrightUserId = existingUser.user.id;
    }

    // Step 2: Get Andrew's user data
    const { data: andrewUser, error: andrewError } = await supabase.auth.admin.getUserByEmail(
      ANDREW_EMAIL
    );

    if (andrewError || !andrewUser) {
      process.exit(1);
    }

    const andrewUserId = andrewUser.user.id;
    // Step 3: Copy profile data
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
      } else {
      }
    }

    // Step 4: Copy organization memberships
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
    }

    // Step 5: Copy calendar integration settings (without tokens)
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
      } else {
      }
    }

    // Step 6: Create sample test data
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
    }

    // Step 7: Create test environment file
    const testEnvContent = `# Playwright Test User Configuration
TEST_USER_EMAIL=${PLAYWRIGHT_EMAIL}
TEST_USER_PASSWORD=${PLAYWRIGHT_PASSWORD}
TEST_USER_ID=${playwrightUserId}

# Add to your .env.local or .env file for testing
`;

    const fs = await import('fs');
    fs.writeFileSync('.env.test', testEnvContent);
  } catch (error) {
    process.exit(1);
  }
}

// Run the setup
setupPlaywrightUser();