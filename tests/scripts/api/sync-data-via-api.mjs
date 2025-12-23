import { createClient } from '@supabase/supabase-js';

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

console.log('🔄 Syncing data from Production to Development-v2 via API...\n');

for (const table of tables) {
  try {
    console.log(`📦 Syncing ${table}...`);

    // Fetch ALL data from production using pagination
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
        console.log(`   ⚠️  Could not fetch from ${table}: ${fetchError.message}`);
        break;
      }

      if (!prodData || prodData.length === 0) {
        hasMore = false;
        break;
      }

      allData = allData.concat(prodData);
      console.log(`   📥 Fetched page ${page + 1}: ${prodData.length} records (total: ${allData.length})`);

      // If we got less than pageSize, we're done
      if (prodData.length < pageSize) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (allData.length === 0) {
      console.log(`   ℹ️  ${table}: 0 records (empty in production)`);
      continue;
    }

    console.log(`   📊 Total fetched: ${allData.length} records`);

    // Insert into development-v2 in batches
    const batchSize = 1000;
    for (let i = 0; i < allData.length; i += batchSize) {
      const batch = allData.slice(i, i + batchSize);
      const { error: insertError } = await devSupabase
        .from(table)
        .upsert(batch, { onConflict: 'id' });

      if (insertError) {
        console.log(`   ❌ Error inserting batch ${Math.floor(i / batchSize) + 1}: ${insertError.message}`);
      } else {
        console.log(`   ✅ Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} records inserted`);
      }
    }

    console.log(`   ✅ ${table}: ${allData.length} total records synced`);

  } catch (err) {
    console.log(`   ❌ Error with ${table}: ${err.message}`);
  }
}

console.log('\n🔍 Verifying development-v2 data...\n');

for (const table of tables) {
  const { count, error } = await devSupabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (!error) {
    console.log(`✅ ${table}: ${count} records`);
  }
}

// Check auth.users
const { data: { users }, error: authError } = await devSupabase.auth.admin.listUsers();
console.log(`✅ auth.users: ${users?.length || 0} users`);

console.log('\n✅ Sync complete!');
