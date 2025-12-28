/**
 * Script to check and fix duplicate meeting activities
 * Run with: npx tsx scripts/fix-duplicate-activities.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('🔍 Checking for duplicate meeting activities...\n');

  // Fetch ALL meeting activities (including those with null meeting_id)
  // Use pagination to get all records (Supabase default limit is 1000)
  let allActivities: any[] = [];
  let page = 0;
  const pageSize = 1000;

  while (true) {
    const { data: activities, error } = await supabase
      .from('activities')
      .select('id, meeting_id, user_id, type, created_at, client_name, date')
      .eq('type', 'meeting')
      .order('created_at', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (error) {
      console.error('Error fetching activities:', error);
      process.exit(1);
    }

    if (!activities || activities.length === 0) break;

    allActivities = [...allActivities, ...activities];
    console.log(`  Fetched page ${page + 1}: ${activities.length} records (total: ${allActivities.length})`);

    if (activities.length < pageSize) break;
    page++;
  }

  const activities = allActivities;

  console.log(`\nFound ${activities?.length || 0} meeting activities total\n`);

  // Group by composite key:
  // - If meeting_id exists: meeting_id + user_id + type
  // - If meeting_id is null: client_name + date + user_id + type
  const grouped = new Map<string, typeof activities>();
  for (const activity of activities || []) {
    let key: string;
    if (activity.meeting_id) {
      key = `mid:${activity.meeting_id}::${activity.user_id}`;
    } else {
      // For null meeting_id, use client_name + date + user_id
      const dateStr = activity.date ? activity.date.split('T')[0] : 'nodate';
      key = `name:${activity.client_name}::${dateStr}::${activity.user_id}`;
    }

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(activity);
  }

  // Find groups with duplicates
  const duplicateGroups = [...grouped.entries()].filter(([_, items]) => items.length > 1);

  if (duplicateGroups.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }

  console.log(`⚠️  Found ${duplicateGroups.length} group(s) with duplicates:\n`);

  const idsToDelete: string[] = [];

  for (const [key, items] of duplicateGroups) {
    console.log(`Group: ${key}`);
    items.forEach((item, i) => {
      const marker = i === 0 ? '✓ KEEP' : '✗ DELETE';
      console.log(`  ${marker}: ${item.id} - ${item.client_name} (${item.date}) [created: ${item.created_at}]`);
      if (i > 0) {
        idsToDelete.push(item.id);
      }
    });
    console.log('');
  }

  console.log(`\n🗑️  Deleting ${idsToDelete.length} duplicate activities...`);

  // Delete duplicates
  const { error: deleteError, count } = await supabase
    .from('activities')
    .delete()
    .in('id', idsToDelete);

  if (deleteError) {
    console.error('Error deleting duplicates:', deleteError);
    process.exit(1);
  }

  console.log(`✅ Deleted ${count || idsToDelete.length} duplicate activities`);

  // Verify
  const { data: remaining } = await supabase
    .from('activities')
    .select('id')
    .eq('type', 'meeting');

  console.log(`\n📊 Remaining meeting activities: ${remaining?.length || 0}`);
}

main().catch(console.error);
