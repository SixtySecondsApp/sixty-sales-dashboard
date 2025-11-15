/**
 * Test script for process-lead-prep edge function
 * Tests the enhanced lead intelligence with Gemini Flash enrichment
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

async function testLeadPrep() {
  try {
    // Check for leads that need prep
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status, enrichment_status')
      .in('prep_status', ['pending', 'failed'])
      .limit(5);

    if (leadsError) {
    }

    if (!leads || leads.length === 0) {
    } else {
      leads.forEach((lead) => {
      });
    }

    // Invoke the edge function
    let data, error;
    try {
      const result = await supabase.functions.invoke('process-lead-prep', {
        method: 'POST',
        body: {},
      });
      data = result.data;
      error = result.error;
    } catch (err: any) {
      if (err.response) {
        try {
          const errorBody = await err.response.json();
        } catch {
          const errorText = await err.response.text();
        }
      }
      throw err;
    }

    if (error) {
      if (error.message) {
      }
      if (error.context) {
      }
      // Try to get response body if available
      if ((error as any).response) {
        try {
          const errorBody = await (error as any).response.json();
        } catch {
          const errorText = await (error as any).response.text();
        }
      }
      throw error;
    }
    if (data?.processed > 0) {
      // Try to fetch updated leads (may be blocked by RLS)
      const { data: updatedLeads, error: fetchError } = await supabase
        .from('leads')
        .select(`
          id,
          contact_name,
          contact_email,
          domain,
          prep_status,
          enrichment_status,
          enrichment_provider,
          prep_summary,
          lead_prep_notes (
            id,
            note_type,
            title,
            body,
            is_auto_generated
          )
        `)
        .in('prep_status', ['completed'])
        .order('updated_at', { ascending: false })
        .limit(3);

      if (fetchError) {
      } else if (updatedLeads && updatedLeads.length > 0) {
        updatedLeads.forEach((lead: any) => {
          if (lead.lead_prep_notes && lead.lead_prep_notes.length > 0) {
            lead.lead_prep_notes.forEach((note: any) => {
            });
          }
        });
      }
    } else {
    }
  } catch (error: any) {
    if (error.details) {
    }
    process.exit(1);
  }
}

testLeadPrep();

