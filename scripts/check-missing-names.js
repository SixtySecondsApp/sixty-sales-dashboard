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
    console.log('📊 Checking contacts without names in Supabase...\n');

    // Get contacts without names
    const { data: contactsWithoutNames, error } = await supabase
      .from('contacts')
      .select('id, email, first_name, last_name, created_at')
      .or('first_name.is.null,last_name.is.null,and(first_name.eq.,last_name.eq.)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    console.log(`Found ${contactsWithoutNames.length} contacts without proper names:\n`);
    
    contactsWithoutNames.forEach(contact => {
      console.log(`Email: ${contact.email}`);
      console.log(`  First: ${contact.first_name || 'NULL'}, Last: ${contact.last_name || 'NULL'}`);
      console.log(`  Created: ${contact.created_at}\n`);
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
    

    console.log('\n📊 Summary:');
    console.log(`   Total contacts: ${allContacts?.length || 0}`);
    console.log(`   Contacts with names: ${namedContacts?.length || 0}`);

  } catch (error) {
    console.error('❌ Check failed:', error);
  }
}

checkMissingNames().catch(console.error);