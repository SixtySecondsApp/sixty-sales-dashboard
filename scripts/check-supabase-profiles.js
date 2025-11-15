#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSupabaseProfiles() {
  try {
    // Check profiles table
    const { data: profiles, error: profilesError, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact' })
      .limit(5);
    
    if (profilesError) {
    } else {
      if (profiles && profiles.length > 0) {
      }
    }
    
    // Check if we can create companies without owner_id requirement
    const { error: testInsert } = await supabase
      .from('companies')
      .insert({
        name: 'Test Company',
        domain: 'test.com'
      });
    
    if (testInsert) {
      // Try creating a dummy profile first
      const { data: newProfile, error: createProfileError } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          first_name: 'System',
          last_name: 'User',
          email: 'system@example.com'
        })
        .select()
        .single();
      
      if (createProfileError) {
      } else {
      }
    } else {
    }
    
  } catch (error) {
  }
}

checkSupabaseProfiles(); 