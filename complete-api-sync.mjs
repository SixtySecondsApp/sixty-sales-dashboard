import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('🚀 Complete API-Based Sync: Production → Development-v2\n');

// Production (source)
const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs'
);

// Development-v2 (destination)
const devSupabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc'
);

// Step 1: Apply migrations via SQL execution
console.log('📦 Step 1: Applying migrations to development-v2...\n');

const migrationsDir = './supabase/migrations';
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(f => f.endsWith('.sql'))
  .sort();

for (const file of migrationFiles) {
  console.log(`📝 Applying ${file}...`);
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');

  try {
    // Execute migration SQL via RPC
    const { error } = await devSupabase.rpc('exec_sql', { query: sql });

    if (error && !error.message.includes('already exists')) {
      console.log(`   ⚠️  Warning: ${error.message}`);
    } else {
      console.log(`   ✅ Applied successfully`);
    }
  } catch (err) {
    console.log(`   ⚠️  Error: ${err.message}`);
  }
}

console.log('\n✅ Migrations applied\n');

// Step 2: Sync data
console.log('📦 Step 2: Syncing data from Production...\n');

const tables = [
  'profiles',
  'organizations',
  'contacts',
  'deals',
  'activities',
  'tasks',
  'meetings',
  'communication_events',
  'workflow_definitions',
  'workflow_executions'
];

for (const table of tables) {
  try {
    console.log(`📦 Syncing ${table}...`);

    // Fetch ALL data with pagination
    let allData = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const { data: prodData, error: fetchError } = await prodSupabase
        .from(table)
        .select('*')
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (fetchError) {
        console.log(`   ⚠️  Could not fetch: ${fetchError.message}`);
        break;
      }

      if (!prodData || prodData.length === 0) {
        hasMore = false;
        break;
      }

      allData = allData.concat(prodData);
      if (prodData.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (allData.length === 0) {
      console.log(`   ℹ️  0 records (empty)`);
      continue;
    }

    console.log(`   📊 Fetched ${allData.length} records`);

    // Insert in batches
    const batchSize = 1000;
    for (let i = 0; i < allData.length; i += batchSize) {
      const batch = allData.slice(i, i + batchSize);
      const { error: insertError } = await devSupabase
        .from(table)
        .upsert(batch, { onConflict: 'id' });

      if (insertError) {
        console.log(`   ❌ Batch ${Math.floor(i / batchSize) + 1} error: ${insertError.message}`);
      } else {
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records`);
      }
    }

  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  }
}

// Step 3: Verify
console.log('\n🔍 Step 3: Verifying...\n');

for (const table of tables) {
  const { count } = await devSupabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  console.log(`✅ ${table}: ${count || 0} records`);
}

const { data: { users } } = await devSupabase.auth.admin.listUsers();
console.log(`✅ auth.users: ${users?.length || 0} users`);

console.log('\n✅ Complete sync finished!');
