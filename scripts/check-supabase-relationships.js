import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSupabaseRelationships() {
  try {
    // Step 1: Test basic contact fetch
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .limit(3);
    
    if (contactsError) {
      return;
    }
    if (contacts && contacts.length > 0) {
    }
    
    // Step 2: Test companies table
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('*')
      .limit(3);
    
    if (companiesError) {
    } else {
      if (companies && companies.length > 0) {
      }
    }
    
    // Step 3: Test the problematic relationship query
    try {
      const { data: contactWithCompany, error: relationshipError } = await supabase
        .from('contacts')
        .select(`
          *,
          companies(*)
        `)
        .limit(1)
        .single();
      
      if (relationshipError) {
      } else {
      }
    } catch (err) {
    }
    
    // Step 4: Test the manual join approach (our workaround)
    if (contacts && contacts.length > 0) {
      const sampleContact = contacts[0];
      
      if (sampleContact.company_id) {
        const { data: company, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', sampleContact.company_id)
          .single();
        
        if (companyError) {
        } else {
        }
      } else {
        const { data: contactWithCompanyId, error: searchError } = await supabase
          .from('contacts')
          .select('*')
          .not('company_id', 'is', null)
          .limit(1)
          .single();
        
        if (!searchError && contactWithCompanyId) {
          const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('*')
            .eq('id', contactWithCompanyId.company_id)
            .single();
          
          if (!companyError && company) {
          }
        } else {
        }
      }
    }
    
    // Step 5: Summary and recommendations
  } catch (error) {
  }
}

// Run the check
checkSupabaseRelationships(); 