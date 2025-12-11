#!/usr/bin/env node
/**
 * Check for any remaining references to old Supabase project
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ygdpgliavpxeugaajgrb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZHBnbGlhdnB4ZXVnYWFqZ3JiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTE4OTQ2MSwiZXhwIjoyMDgwNzY1NDYxfQ.n9MVawseoWgWSu7H48-lgpvl3dUFMqofI7lWlbqmEfI'
);

const OLD_URL = 'ewtuefzeogytgmsnkpmb';

// Tables and columns that might have URL fields
const tablesToCheck = [
  { table: 'profiles', columns: ['avatar_url'] },
  { table: 'contacts', columns: ['avatar_url', 'linkedin_photo_url', 'photo_url', 'image_url'] },
  { table: 'companies', columns: ['logo_url', 'logo', 'image_url'] },
  { table: 'activities', columns: ['avatar_url', 'attachment_url'] },
  { table: 'meetings', columns: ['thumbnail_url', 'video_url', 'recording_url'] },
  { table: 'tasks', columns: ['attachment_url'] },
  { table: 'deals', columns: ['attachment_url'] },
  { table: 'attachments', columns: ['url', 'file_url', 'storage_path'] },
  { table: 'files', columns: ['url', 'path', 'storage_url'] },
  { table: 'documents', columns: ['url', 'file_url'] },
  { table: 'images', columns: ['url', 'src'] },
  { table: 'media', columns: ['url', 'src'] },
  { table: 'uploads', columns: ['url', 'path'] },
];

async function main() {
  console.log('🔍 Searching for old Supabase URLs across all tables...');
  console.log(`   Looking for: ${OLD_URL}\n`);

  let totalFound = 0;

  for (const { table, columns } of tablesToCheck) {
    for (const col of columns) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('id, ' + col, { count: 'exact' })
          .like(col, '%' + OLD_URL + '%')
          .limit(5);

        if (error) {
          // Skip non-existent tables/columns
          continue;
        }

        if (data && data.length > 0) {
          console.log(`❗ ${table}.${col}: Found ${count} records`);
          totalFound += count;
          data.forEach(row => {
            const value = row[col];
            console.log(`   - ID: ${row.id}`);
            if (value) {
              console.log(`     Value: ${value.length > 100 ? value.substring(0, 100) + '...' : value}`);
            }
          });
          console.log('');
        }
      } catch (e) {
        // Skip errors
      }
    }
  }

  if (totalFound === 0) {
    console.log('✅ No references to old project found in checked tables!');
  } else {
    console.log(`\n⚠️  Total records with old URLs: ${totalFound}`);
  }

  // Also check storage buckets
  console.log('\n📦 Checking storage buckets in new project...');
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets) {
    console.log('   Buckets:', buckets.map(b => b.name).join(', '));
  }
}

main().catch(console.error);
