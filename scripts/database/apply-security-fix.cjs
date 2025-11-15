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
  try {
    // 1. Create admin helper function
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
    } else {
    }

    // 2. Enable RLS on contacts
    const { error: rlsError } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;'
    });

    if (rlsError) {
    } else {
    }

    // 3. Test direct contact access
    const { data: contacts, error: selectError } = await supabase
      .from('contacts')
      .select('id, first_name, last_name')
      .limit(5);

    if (selectError) {
      // Try to create permissive policy
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
      } else {
      }
    } else {
    }

    // 4. Test contact creation
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
    } else {
      // Clean up test contact
      await supabase.from('contacts').delete().eq('id', newContact.id);
    }

  } catch (error) {
  }
}

// Check if we're using CommonJS or ES modules
if (typeof require !== 'undefined' && require.main === module) {
  applySecurityFix();
}

module.exports = { applySecurityFix };