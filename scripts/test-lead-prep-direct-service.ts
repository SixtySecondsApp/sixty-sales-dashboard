/**
 * Test lead prep function directly using service role key
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  process.exit(1);
}

// Use service role to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function testLeadPrep() {
  try {
    // Get all leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, prep_status, enrichment_status, owner_id')
      .order('created_at', { ascending: false })
      .limit(10);

    if (leadsError) {
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      return;
    }
    leads.forEach((lead) => {
    });

    // Reset leads to pending using service role
    const { error: resetError } = await supabase
      .from('leads')
      .update({
        prep_status: 'pending',
        enrichment_status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .in('id', leads.map(l => l.id));

    if (resetError) {
      throw resetError;
    }
    // Wait a moment
    await new Promise(r => setTimeout(r, 1000));

    // Verify reset
    const { data: updatedLeads } = await supabase
      .from('leads')
      .select('id, prep_status, enrichment_status')
      .in('id', leads.map(l => l.id));
    updatedLeads?.forEach((lead) => {
    });
    // Invoke the function
    const { data, error } = await supabase.functions.invoke('process-lead-prep', {
      method: 'POST',
      body: {},
    });

    if (error) {
      throw error;
    }
    // Wait a bit for processing
    await new Promise(r => setTimeout(r, 5000));

    // Check final status
    const { data: finalLeads } = await supabase
      .from('leads')
      .select('id, contact_name, prep_status, enrichment_status, prep_summary, enrichment_provider')
      .in('id', leads.map(l => l.id));
    finalLeads?.forEach((lead) => {
    });

    // Check prep notes
    const { data: prepNotes } = await supabase
      .from('lead_prep_notes')
      .select('*')
      .in('lead_id', leads.map(l => l.id))
      .order('created_at', { ascending: false });
    if (prepNotes && prepNotes.length > 0) {
      prepNotes.forEach((note) => {
      });
    }

  } catch (error: any) {
    if (error.details) {
    }
    if (error.stack) {
    }
    process.exit(1);
  }
}

testLeadPrep();






