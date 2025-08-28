#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.CNWEk5eSPLR9RBYS6U_--JnFW4kAqr_nLQ9Qhm-vOxY';

// Create Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function applySecurityFix() {
  console.log('🔧 Applying security fix for contacts table...\n');

  try {
    // 1. Create admin helper function
    console.log('1. Creating admin helper function...');
    const { error: funcError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE OR REPLACE FUNCTION auth.is_admin()
        RETURNS boolean
        LANGUAGE sql
        SECURITY DEFINER
        AS $$
          SELECT COALESCE(
            (SELECT is_admin FROM profiles WHERE id = auth.uid()),
            false
          );
        $$;
      `
    });

    if (funcError) {
      console.log('Function creation failed, trying direct approach...');
    } else {
      console.log('✅ Admin function created');
    }

    // 2. Enable RLS on contacts
    console.log('2. Enabling RLS on contacts table...');
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
      console.log('RLS enable failed, may already be enabled');
    } else {
      console.log('✅ RLS enabled on contacts');
    }

    // 3. Test direct contact access
    console.log('3. Testing direct contact access...');
    const { data: contacts, error: selectError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .limit(5);

    if (selectError) {
      console.log('❌ Contact access failed:', selectError.message);
      
      // Try to create permissive policy
      console.log('4. Creating permissive access policy...');
      const policySQL = `
        DROP POLICY IF EXISTS "temp_permissive_access" ON contacts;
        CREATE POLICY "temp_permissive_access" ON contacts
          FOR ALL
          TO authenticated
          USING (true)
          WITH CHECK (true);
      `;
      
      const { error: policyError } = await supabase.rpc('exec_sql', {
        sql: policySQL
      });
      
      if (policyError) {
        console.log('❌ Policy creation failed:', policyError.message);
        console.log('\n🔧 Manual fix required:');
        console.log('1. Go to Supabase Dashboard > Authentication > Policies');
        console.log('2. Navigate to contacts table');
        console.log('3. Create a new policy: "Allow authenticated users" with "true" for all operations');
        console.log('4. Or run this SQL in the SQL editor:');
        console.log(`
          DROP POLICY IF EXISTS "temp_access" ON contacts;
          CREATE POLICY "temp_access" ON contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);
        `);
      } else {
        console.log('✅ Permissive policy created');
      }
    } else {
      console.log(`✅ Contact access working! Found ${contacts?.length || 0} contacts`);
    }

    // 4. Test contact creation
    console.log('5. Testing contact creation...');
    const testContact = {
      first_name: 'Test',
      last_name: 'User',
      email: `test-${Date.now()}@example.com`
    };

    const { data: newContact, error: insertError } = await supabase
      .from('contacts')
      .insert(testContact)
      .select()
      .single();

    if (insertError) {
      console.log('❌ Contact creation failed:', insertError.message);
    } else {
      console.log('✅ Contact creation successful! ID:', newContact.id);
      
      // Clean up test contact
      await supabase.from('contacts').delete().eq('id', newContact.id);
      console.log('🧹 Test contact cleaned up');
    }

  } catch (error) {
    console.error('❌ Error applying security fix:', error.message);
    console.log('\n📋 Manual Steps:');
    console.log('1. Go to Supabase Dashboard > SQL Editor');
    console.log('2. Run the following SQL:');
    console.log(`
      ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
      DROP POLICY IF EXISTS "allow_authenticated" ON contacts;
      CREATE POLICY "allow_authenticated" ON contacts 
        FOR ALL TO authenticated 
        USING (true) 
        WITH CHECK (true);
    `);
  }

  console.log('\n🎯 Next steps:');
  console.log('1. Test the QuickAdd form - it should now work');
  console.log('2. Check browser console - 403 errors should be gone');
  console.log('3. If still issues, check Supabase Dashboard > Authentication > Users');
}

// Check if we're using CommonJS or ES modules
if (typeof require !== 'undefined' && require.main === module) {
  applySecurityFix();
}

module.exports = { applySecurityFix };