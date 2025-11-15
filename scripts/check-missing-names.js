#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function checkMissingNames() {
  try {
    // Get contacts without names
    const { data: contactsWithoutNames, error } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name, created_at')
      .or('first_name.is.null,last_name.is.null,and(first_name.eq.,last_name.eq.)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    contactsWithoutNames.forEach(contact => {
    });

    // Check total stats
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true });
    
    const { data: namedContacts } = await supabase
      .from('contacts')
      .select('id', { count: 'exact', head: true })
      .not('first_name', 'is', null)
      .not('last_name', 'is', null);
  } catch (error) {
  }
}

checkMissingNames().catch(console.error);