import { createClient } from '@supabase/supabase-js';

const DEV_SUPABASE_URL = 'https://jczngsvpywgrlgdwzjbr.supabase.co';
const DEV_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDc2MjEzNywiZXhwIjoyMDgwMzM4MTM3fQ.2KWy3kixEgdW34pSdc3HVRCT4Zrp5z45fbTfDyarpdc';

const supabase = createClient(DEV_SUPABASE_URL, DEV_SERVICE_ROLE_KEY);

async function check() {
  console.log('=== USER ID MISMATCH DIAGNOSIS ===\n');

  // Get Andrew's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .eq('email', 'andrew.bryce@sixtyseconds.video')
    .single();

  console.log("Andrew's Profile:");
  console.log('  ID:', profile ? profile.id : 'NOT FOUND');
  console.log('  Email:', profile ? profile.email : 'N/A');
  console.log('  Name:', profile ? `${profile.first_name} ${profile.last_name}` : 'N/A');
  console.log();

  // Get Andrew's auth user
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const users = authUsers ? authUsers.users : [];
  const andrewAuth = users.find(u => u.email === 'andrew.bryce@sixtyseconds.video');
  console.log("Andrew's Auth User:");
  console.log('  ID:', andrewAuth ? andrewAuth.id : 'NOT FOUND');
  console.log('  Email:', andrewAuth ? andrewAuth.email : 'N/A');
  console.log();

  // Check if they match
  const profileId = profile ? profile.id : null;
  const authId = andrewAuth ? andrewAuth.id : null;
  console.log('IDs Match:', profileId === authId ? 'YES' : 'NO');
  console.log();

  // Count data by owner column (different tables use different column names)
  const tableOwnerColumns = {
    'activities': 'user_id',
    'deals': 'owner_id',
    'meetings': 'owner_user_id',
    'contacts': 'owner_id',
    'companies': 'owner_id',
    'tasks': 'user_id'
  };

  console.log('=== DATA OWNERSHIP BY OWNER COLUMN ===\n');

  for (const [table, ownerCol] of Object.entries(tableOwnerColumns)) {
    const { data, error } = await supabase
      .from(table)
      .select(ownerCol)
      .limit(1000);

    if (error) {
      console.log(`${table}.${ownerCol}: Error - ${error.message}`);
      continue;
    }

    const rows = data || [];
    const userIdCounts = {};
    rows.forEach(row => {
      const uid = row[ownerCol] || 'NULL';
      userIdCounts[uid] = (userIdCounts[uid] || 0) + 1;
    });

    console.log(`${table}.${ownerCol} (${rows.length} rows):`);
    for (const [uid, count] of Object.entries(userIdCounts)) {
      let marker = '';
      if (uid === profileId) marker = ' <-- Andrew (current user)';
      console.log(`  ${uid}: ${count} rows${marker}`);
    }
    console.log();
  }

  // Get all profiles to identify the production Andrew
  console.log('=== ALL PROFILES ===\n');
  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, email, first_name, last_name')
    .order('email');

  if (allProfiles) {
    allProfiles.forEach(p => {
      const isCurrent = p.id === profileId ? ' <-- CURRENT USER' : '';
      console.log(`  ${p.id}: ${p.email} (${p.first_name} ${p.last_name})${isCurrent}`);
    });
  }
  console.log();

  // Summary
  console.log('=== SUMMARY ===');
  console.log('Current User Profile ID:', profileId);
  console.log('Current User Auth ID:', authId);

  // Identify the most common owner (likely Andrew from production)
  const ownerCounts = {};
  const { data: acts } = await supabase.from('activities').select('user_id').limit(5000);
  const { data: dls } = await supabase.from('deals').select('owner_id').limit(5000);
  const { data: mtgs } = await supabase.from('meetings').select('owner_user_id').limit(5000);
  const { data: ctcs } = await supabase.from('contacts').select('owner_id').limit(5000);

  if (acts) acts.forEach(r => { ownerCounts[r.user_id] = (ownerCounts[r.user_id] || 0) + 1; });
  if (dls) dls.forEach(r => { ownerCounts[r.owner_id] = (ownerCounts[r.owner_id] || 0) + 1; });
  if (mtgs) mtgs.forEach(r => { ownerCounts[r.owner_user_id] = (ownerCounts[r.owner_user_id] || 0) + 1; });
  if (ctcs) ctcs.forEach(r => { if (r.owner_id) ownerCounts[r.owner_id] = (ownerCounts[r.owner_id] || 0) + 1; });

  const sorted = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1]);
  console.log('\nMost common data owner IDs:');
  sorted.slice(0, 5).forEach(([uid, count]) => {
    const profile = allProfiles ? allProfiles.find(p => p.id === uid) : null;
    const name = profile ? `${profile.first_name} ${profile.last_name} (${profile.email})` : 'Unknown profile';
    console.log(`  ${uid}: ${count} records - ${name}`);
  });

  console.log('\nRECOMMENDATION:');
  console.log('Update all data owner columns to use the current user ID:', profileId);
}

check().catch(console.error);
