import { createClient } from '@supabase/supabase-js';

// Directly connect to development-v2 branch
const supabase = createClient(
  'https://jczngsvpywgrlgdwzjbr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impjem5nc3ZweXdncmxnZHd6amJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3NjIxMzcsImV4cCI6MjA4MDMzODEzN30.vcVeZLHCIIUI2WG70sqBK-ecdFnHoRzq4kbkeZsB9Wo'
);

async function checkSync() {
  console.log('🔍 Checking development-v2 Branch Data\n');
  console.log('Branch: https://jczngsvpywgrlgdwzjbr.supabase.co\n');

  const tables = [
    'profiles', 'deals', 'activities', 'meetings',
    'tasks', 'organizations', 'contacts', 'communication_events'
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      const icon = count > 0 ? '✅' : '⚠️ ';
      console.log(`${icon} ${table}: ${count} records`);
    }
  }
}

checkSync().catch(console.error);
