#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifySync() {
  console.log('🔍 Verifying Data Sync Completion\n');
  console.log('Branch: development-v2');
  console.log('URL:', process.env.VITE_SUPABASE_URL);
  console.log('');

  const checks = [
    { table: 'profiles', critical: true },
    { table: 'deals', critical: true },
    { table: 'activities', critical: true },
    { table: 'meetings', critical: false },
    { table: 'tasks', critical: true },
    { table: 'organizations', critical: false },
    { table: 'contacts', critical: true }
  ];

  let allGood = true;

  for (const check of checks) {
    const { count, error } = await supabase
      .from(check.table)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${check.table}: Error - ${error.message}`);
      if (check.critical) allGood = false;
    } else if (count === 0 && check.critical) {
      console.log(`⚠️  ${check.table}: 0 records (expected data)`);
      allGood = false;
    } else {
      console.log(`✅ ${check.table}: ${count} records`);
    }
  }

  console.log('');
  if (allGood) {
    console.log('🎉 Sync verification complete - all systems ready!');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your dev server: npm run dev');
    console.log('2. Log in with your production credentials');
    console.log('3. Start developing! 🚀');
  } else {
    console.log('⚠️  Some issues detected - check the sync workflow logs');
  }
}

verifySync().catch(console.error);
