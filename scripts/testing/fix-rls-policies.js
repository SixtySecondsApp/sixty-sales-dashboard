#!/usr/bin/env node

// Fix RLS policies to allow proper access
import { config } from 'dotenv';
config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

async function executeSQL(sql, description) {
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    });

    if (response.ok) {
      return true;
    } else {
      const error = await response.text();
      return false;
    }
  } catch (error) {
    return false;
  }
}

async function checkCurrentPolicies() {
  const tables = ['deals', 'contacts', 'activities', 'deal_stages', 'profiles'];
  
  for (const table of tables) {
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/pg_policies?select=*&tablename=eq.${table}`, {
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const policies = await response.json();
        if (policies.length > 0) {
          policies.forEach(policy => {
          });
        }
      }
    } catch (error) {
    }
  }
}

async function createPermissivePolicies() {
  // Create permissive policies for authenticated users
  const policies = [
    {
      table: 'deals',
      policy: `CREATE POLICY "deals_authenticated_access" ON public.deals FOR ALL TO authenticated USING (true) WITH CHECK (true);`
    },
    {
      table: 'contacts', 
      policy: `CREATE POLICY "contacts_authenticated_access" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);`
    },
    {
      table: 'activities',
      policy: `CREATE POLICY "activities_authenticated_access" ON public.activities FOR ALL TO authenticated USING (true) WITH CHECK (true);`
    },
    {
      table: 'deal_stages',
      policy: `CREATE POLICY "deal_stages_authenticated_access" ON public.deal_stages FOR ALL TO authenticated USING (true) WITH CHECK (true);`
    },
    {
      table: 'profiles',
      policy: `CREATE POLICY "profiles_authenticated_access" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);`
    }
  ];

  for (const { table, policy } of policies) {
    // First drop existing policy if it exists
    await executeSQL(
      `DROP POLICY IF EXISTS "${table}_authenticated_access" ON public.${table};`,
      `Dropping existing policy for ${table}`
    );
    
    // Create new permissive policy
    await executeSQL(policy, `Creating permissive policy for ${table}`);
  }
}

async function enableRLS() {
  const tables = ['deals', 'contacts', 'activities', 'deal_stages', 'profiles'];
  
  for (const table of tables) {
    await executeSQL(
      `ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`,
      `Enabling RLS for ${table}`
    );
  }
}

async function testAccessWithAuth() {
  // Try to access data with anon key (should still fail without auth)
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/deals?select=count`, {
      headers: {
        'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
        'apikey': process.env.VITE_SUPABASE_ANON_KEY,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
  } catch (error) {
  }
}

async function showNextSteps() {
}

async function main() {
  await checkCurrentPolicies();
  await createPermissivePolicies();
  await enableRLS();
  await testAccessWithAuth();
  await showNextSteps();
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  process.exit(1);
}

main(); 