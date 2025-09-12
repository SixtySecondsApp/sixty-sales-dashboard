import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; // Fixed variable name

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  console.log('URL:', supabaseUrl ? 'Found' : 'Missing');
  console.log('Service Key:', supabaseServiceKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAndFixProfile() {
  try {
    // Check auth user
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    if (authError) throw authError;
    
    const andrewAuth = authUsers.users.find(u => u.email === 'andrew.bryce@sixtyseconds.video');
    if (!andrewAuth) {
      console.log('❌ No auth user found for andrew.bryce@sixtyseconds.video');
      process.exit(1);
    }
    
    console.log('✅ Auth user found:', { id: andrewAuth.id, email: andrewAuth.email });
    
    // Check profile by email
    const { data: profileByEmail, error: emailError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', 'andrew.bryce@sixtyseconds.video')
      .maybeSingle();
    
    if (profileByEmail) {
      console.log('\n✅ Profile found by email:', {
        id: profileByEmail.id,
        email: profileByEmail.email,
        name: `${profileByEmail.first_name} ${profileByEmail.last_name}`,
        stage: profileByEmail.stage,
        is_admin: profileByEmail.is_admin
      });
      
      // Check if ID matches
      if (profileByEmail.id !== andrewAuth.id) {
        console.log('\n⚠️ WARNING: Profile ID does not match auth ID!');
        console.log('Profile ID:', profileByEmail.id);
        console.log('Auth ID:', andrewAuth.id);
        console.log('This is why ID-based lookup fails. Using email-based lookup instead.');
      }
    } else {
      console.log('\n❌ No profile found by email - CREATING ONE');
      
      // Create profile
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: andrewAuth.id,
          email: 'andrew.bryce@sixtyseconds.video',
          first_name: 'Andrew',
          last_name: 'Bryce',
          stage: 'Director',
          is_admin: true,
          role: 'Senior',
          department: 'Sales'
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Failed to create profile:', createError);
      } else {
        console.log('✅ Profile created successfully:', newProfile);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

checkAndFixProfile();
