import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkData() {
  console.log('🔍 Checking Development Branch Data\n');
  console.log(`URL: ${process.env.VITE_SUPABASE_URL}\n`);
  
  // Check auth.users
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
  console.log('👥 Auth Users:', authData?.users?.length || 0);
  if (authError) console.log('   Error:', authError.message);
  
  // Check profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
    .limit(5);
  console.log('📋 Profiles:', profiles?.length || 0);
  if (profilesError) console.log('   Error:', profilesError.message);
  
  // Check if current user can authenticate
  console.log('\n🔐 Testing Authentication...');
  const { data: session, error: sessionError } = await supabase.auth.getSession();
  console.log('Session:', session ? 'Active' : 'None');
  if (sessionError) console.log('   Error:', sessionError.message);
  
  // List all tables
  console.log('\n📊 Checking table schemas...');
  const tables = ['profiles', 'deals', 'activities', 'meetings', 'tasks', 'organizations', 'contacts'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.log(`   ❌ ${table}: ${error.message}`);
    } else {
      console.log(`   ✅ ${table}: exists`);
    }
  }
}

checkData();
