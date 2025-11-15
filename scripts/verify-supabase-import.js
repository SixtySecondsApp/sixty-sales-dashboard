#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client with service role (admin permissions)
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifySupabaseImport() {
  try {
    // Check companies
    const { data: companies, error: companiesError, count: companiesCount } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (companiesError) {
    } else {
      // Check sample data
      const { data: sampleCompanies } = await supabase
        .from('companies')
        .select('name, domain, industry, phone')
        .limit(3);
      
      if (sampleCompanies && sampleCompanies.length > 0) {
      }
    }
    
    // Check contacts
    const { data: contacts, error: contactsError, count: contactsCount } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true });
    
    if (contactsError) {
    } else {
      // Check sample data
      const { data: sampleContacts } = await supabase
        .from('contacts')
        .select('full_name, email, phone, title')
        .limit(3);
      
      if (sampleContacts && sampleContacts.length > 0) {
      }
    }
    
    // Check deal stages
    const { data: stages, error: stagesError, count: stagesCount } = await supabase
      .from('deal_stages')
      .select('*', { count: 'exact', head: true });
    
    if (stagesError) {
    } else {
      // Show all stages
      const { data: allStages } = await supabase
        .from('deal_stages')
        .select('name, position, is_closed')
        .order('position');
      
      if (allStages && allStages.length > 0) {
      }
    }
    
    // Check deals
    const { data: deals, error: dealsError, count: dealsCount } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true });
    
    if (dealsError) {
    } else {
      // Check relationships
      const { data: dealsWithRelationships } = await supabase
        .from('deals')
        .select(`
          name,
          value,
          companies(name),
          contacts(full_name, email)
        `)
        .limit(3);
      
      if (dealsWithRelationships && dealsWithRelationships.length > 0) {
      }
    }
    
    // Check activities
    const { data: activities, error: activitiesError, count: activitiesCount } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true });
    
    if (activitiesError) {
    } else {
      // Check activity relationships
      const { data: activitiesWithRelationships } = await supabase
        .from('activities')
        .select(`
          client_name,
          type,
          status,
          contacts(full_name, email),
          deals(name)
        `)
        .not('contact_id', 'is', null)
        .limit(3);
      
      if (activitiesWithRelationships && activitiesWithRelationships.length > 0) {
      }
    }
    
    // Summary
    const summary = {
      companies: companiesCount || 0,
      contacts: contactsCount || 0,
      deal_stages: stagesCount || 0,
      deals: dealsCount || 0,
      activities: activitiesCount || 0
    };
    // Check for missing relationships
    // Contacts without companies
    const { count: contactsWithoutCompanies } = await supabase
      .from('contacts')
      .select('*', { count: 'exact', head: true })
      .is('company_id', null);
    
    // Deals without contacts
    const { count: dealsWithoutContacts } = await supabase
      .from('deals')
      .select('*', { count: 'exact', head: true })
      .is('primary_contact_id', null);
    
    // Activities without contacts
    const { count: activitiesWithoutContacts } = await supabase
      .from('activities')
      .select('*', { count: 'exact', head: true })
      .is('contact_id', null);
    
    const healthCheck = {
      'Contacts without companies': contactsWithoutCompanies || 0,
      'Deals without primary contacts': dealsWithoutContacts || 0,
      'Activities without contact links': activitiesWithoutContacts || 0
    };
  } catch (error) {
  }
}

verifySupabaseImport(); 