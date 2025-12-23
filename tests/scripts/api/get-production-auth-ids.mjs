import { createClient } from '@supabase/supabase-js';

// Production (main branch)
const prodSupabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMTQ0MTI4OCwiZXhwIjoyMDQ3MDE3Mjg4fQ.wqULbhfOz7f7kKlbjXnwBLfBSx8zl-SnW5gMTrUTW28'
);

console.log('🔍 Fetching production auth user IDs...\n');

const { data: { users }, error } = await prodSupabase.auth.admin.listUsers();

if (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}

console.log(`✅ Found ${users.length} production auth users\n`);
console.log('-- SQL to insert into link-to-production-auth.sql:\n');
console.log('INSERT INTO prod_auth_mapping (email, prod_auth_id) VALUES');

const values = users
  .sort((a, b) => a.email.localeCompare(b.email))
  .map((u, i) => {
    const isLast = i === users.length - 1;
    return `('${u.email}', '${u.id}')${isLast ? ';' : ','}`;
  });

console.log(values.join('\n'));

console.log('\n\nCopy the above SQL and paste it into link-to-production-auth.sql');
