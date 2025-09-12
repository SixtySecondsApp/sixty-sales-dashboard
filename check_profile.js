const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProfile() {
  try {
    // Check auth user
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;
    
    const andrewAuth = authUsers.users.find(u => u.email === 'andrew.bryce@sixtyseconds.video');
    console.log('Auth user:', andrewAuth ? { id: andrewAuth.id, email: andrewAuth.email } : 'NOT FOUND');
    
    // Check profile by email
    const { data: profileByEmail, error: emailError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'andrew.bryce@sixtyseconds.video')
      .maybeSingle();
    
    console.log('\nProfile by email lookup:', profileByEmail ? {
      id: profileByEmail.id,
      email: profileByEmail.email,
      name: `${profileByEmail.first_name} ${profileByEmail.last_name}`,
      stage: profileByEmail.stage,
      is_admin: profileByEmail.is_admin
    } : 'NOT FOUND');
    
    // Check profile by ID if we have auth user
    if (andrewAuth) {
      const { data: profileById, error: idError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', andrewAuth.id)
        .maybeSingle();
      
      console.log('\nProfile by ID lookup:', profileById ? {
        id: profileById.id,
        email: profileById.email,
        name: `${profileById.first_name} ${profileById.last_name}`,
        stage: profileById.stage,
        is_admin: profileById.is_admin
      } : 'NOT FOUND');
      
      // Check if IDs match
      if (profileByEmail && profileById) {
        console.log('\n⚠️ ID Match:', profileByEmail.id === profileById.id ? '✅ YES' : '❌ NO - THIS IS THE PROBLEM!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkProfile();
