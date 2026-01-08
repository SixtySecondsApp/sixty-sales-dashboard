/**
 * Data Migration Script: Production to Staging
 *
 * Copies all business data from production to staging Supabase project.
 * Uses service role keys for admin access.
 */

import { createClient } from '@supabase/supabase-js';

import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load production env
const prodEnv = dotenv.parse(fs.readFileSync('.env'));
// Load staging env
const stagingEnv = dotenv.parse(fs.readFileSync('.env.staging'));

// Production
const PROD_URL = 'https://ygdpgliavpxeugaajgrb.supabase.co';
const PROD_SERVICE_KEY = prodEnv.SUPABASE_SERVICE_ROLE_KEY;

// Staging
const STAGING_URL = 'https://idurpiwkzxkzccifnrsu.supabase.co';
const STAGING_SERVICE_KEY = stagingEnv.SUPABASE_SERVICE_ROLE_KEY;

const prodClient = createClient(PROD_URL, PROD_SERVICE_KEY);
const stagingClient = createClient(STAGING_URL, STAGING_SERVICE_KEY);

const BATCH_SIZE = 100;

interface TableConfig {
  name: string;
  orderBy?: string;
}

// Tables to migrate in order (respecting foreign keys)
// Reference tables (already inserted manually: calendar_calendars, org_call_types, deal_stages)
const TABLES: TableConfig[] = [
  // First: companies (need remaining ~40 migrated)
  { name: 'companies', orderBy: 'created_at' },
  // Then: contacts (need remaining ~200 migrated)
  { name: 'contacts', orderBy: 'created_at' },
  // Then deals (depends on contacts, companies, deal_stages)
  { name: 'deals', orderBy: 'created_at' },
  // Then meetings (depends on deals, contacts, org_call_types)
  { name: 'meetings', orderBy: 'created_at' },
  // Then tasks (depends on deals)
  { name: 'tasks', orderBy: 'created_at' },
  // Then activities (depends on deals, contacts, meetings)
  { name: 'activities', orderBy: 'created_at' },
  // Finally calendar_events (depends on calendar_calendars)
  { name: 'calendar_events', orderBy: 'created_at' },
];

async function migrateTable(config: TableConfig) {
  const { name, orderBy = 'id' } = config;
  console.log(`\n📦 Migrating ${name}...`);

  // Get total count from production
  const { count } = await prodClient
    .from(name)
    .select('*', { count: 'exact', head: true });

  console.log(`   Found ${count} records in production`);

  if (!count || count === 0) {
    console.log(`   ⏭️  Skipping (empty table)`);
    return;
  }

  // Skip clearing - use upsert to add missing records
  console.log(`   📝 Upserting records (not clearing existing data)...`);

  // Migrate in batches
  let offset = 0;
  let migrated = 0;

  while (offset < count) {
    // Fetch batch from production
    const { data: batch, error: fetchError } = await prodClient
      .from(name)
      .select('*')
      .order(orderBy)
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      console.error(`   ❌ Error fetching batch: ${fetchError.message}`);
      break;
    }

    if (!batch || batch.length === 0) break;

    // Insert into staging
    const { error: insertError } = await stagingClient
      .from(name)
      .upsert(batch, { onConflict: 'id' });

    if (insertError) {
      console.error(`   ❌ Error inserting batch: ${insertError.message}`);
      // Log the first record that failed for debugging
      console.error(`   First record in batch: ${JSON.stringify(batch[0], null, 2).slice(0, 200)}...`);
    } else {
      migrated += batch.length;
      process.stdout.write(`   ✅ Migrated ${migrated}/${count} records\r`);
    }

    offset += BATCH_SIZE;
  }

  console.log(`\n   ✅ ${name}: ${migrated} records migrated`);
}

async function main() {
  console.log('🚀 Starting Production → Staging Migration');
  console.log('==========================================\n');

  // Verify connections
  console.log('Verifying connections...');

  const { data: prodTest } = await prodClient.from('organizations').select('id').limit(1);
  if (!prodTest) {
    console.error('❌ Cannot connect to production');
    process.exit(1);
  }
  console.log('✅ Production connected');

  const { data: stagingTest } = await stagingClient.from('organizations').select('id').limit(1);
  if (!stagingTest) {
    console.error('❌ Cannot connect to staging');
    process.exit(1);
  }
  console.log('✅ Staging connected');

  // Migrate each table
  for (const table of TABLES) {
    try {
      await migrateTable(table);
    } catch (error) {
      console.error(`❌ Failed to migrate ${table.name}:`, error);
    }
  }

  console.log('\n==========================================');
  console.log('✅ Migration complete!');
}

main().catch(console.error);
