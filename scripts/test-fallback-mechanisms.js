import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testDirectDataAccess() {
  try {
    // Test deals query (like our fallback)
    const { data: deals, error: dealsError } = await supabase
      .from('deals')
      .select(`
        *,
        deal_stages:deal_stages(id, name, color, order_position, default_probability)
      `)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (dealsError) {
      if (dealsError.message.includes('JWT')) {
      }
    } else {
    }
    
    // Test deal stages
    const { data: stages, error: stagesError } = await supabase
      .from('deal_stages')
      .select('*')
      .order('order_position');
    
    if (stagesError) {
    } else {
      stages.forEach(stage => undefined);
    }
    
    // Test contacts
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (contactsError) {
      if (contactsError.message.includes('JWT')) {
      }
    } else {
    }
    
    // Test companies (should fail since table doesn't exist)
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .limit(1);
    
    if (companiesError) {
      if (companiesError.message.includes('does not exist')) {
      } else {
      }
    } else {
    }
    
  } catch (error) {
  }
}

async function simulateUserLogin() {
  // Note: In a real scenario, user would log in through the UI
  // This just demonstrates what would happen with an authenticated session
  
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (session) {
    // Test RLS-protected query
    const { data: userDeals, error: userDealsError } = await supabase
      .from('deals')
      .select('id, name, value')
      .limit(3);
    
    if (userDealsError) {
    } else {
    }
  } else {
  }
}

await testDirectDataAccess();
await simulateUserLogin(); 