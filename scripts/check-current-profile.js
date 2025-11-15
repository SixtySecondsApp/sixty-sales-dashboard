#!/usr/bin/env node

/**
 * Script to check current user profiles and their data
 * Usage: node scripts/check-current-profile.js
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProfiles() {
  try {
    // Get all profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('email');

    if (profilesError) {
      return;
    }
    profiles.forEach(profile => {
    });

    // Check specifically for Andrew Bryce
    const andrewEmails = [
      'andrew.bryce@sixtyseconds.video',
      'andrewbryce@sixtyseconds.video',
      'andrew@sixtyseconds.video'
    ];

    for (const email of andrewEmails) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .single();

      if (profile) {
        break;
      } else if (error && error.code !== 'PGRST116') {
      } else {
      }
    }

    // Also check auth users
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
    
    if (usersError) {
      return;
    }

    const sixtySUsers = users?.filter(u => u.email?.includes('sixtyseconds')) || [];
    
    sixtySUsers.forEach(user => {
      // Check if this user has a profile
      const profile = profiles.find(p => p.id === user.id);
      if (profile) {
      } else {
      }
    });

  } catch (error) {
  }
}

// Run the script
checkProfiles();