/**
 * Script to recategorize lead sources for specific leads
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

interface LeadSourceUpdate {
  domain: string;
  contactName?: string;
  newSourceKey: string;
  newSourceName: string;
  channel?: string;
  medium?: string;
}

const updates: LeadSourceUpdate[] = [
  {
    domain: 'plantec.io',
    contactName: 'Kelston Smith',
    newSourceKey: 'email_outreach',
    newSourceName: 'Email Outreach',
    channel: 'email',
    medium: 'email',
  },
  // Add more updates as needed
];

async function recategorizeLeads() {
  console.log('🔄 Starting lead source recategorization...\n');

  const functionUrl = `${SUPABASE_URL}/functions/v1/update-lead-sources`;

  try {
    const { data, error } = await supabase.functions.invoke('update-lead-sources', {
      method: 'POST',
      body: updates,
    });

    if (error) {
      console.error('❌ Error calling edge function:', error);
      throw error;
    }

    if (data) {
      console.log('\n📊 Results:');
      console.log(JSON.stringify(data, null, 2));
      
      if (data.success) {
        console.log(`\n✅ Successfully updated ${data.totalUpdated} lead(s)`);
      }
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

recategorizeLeads();

