/**
 * Script to recategorize lead sources for specific leads
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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
  const functionUrl = `${SUPABASE_URL}/functions/v1/update-lead-sources`;

  try {
    const { data, error } = await supabase.functions.invoke('update-lead-sources', {
      method: 'POST',
      body: updates,
    });

    if (error) {
      throw error;
    }

    if (data) {
      if (data.success) {
      }
    }
  } catch (error: any) {
    process.exit(1);
  }
}

recategorizeLeads();

