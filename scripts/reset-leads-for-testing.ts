/**
 * Reset leads to pending status and clear prep notes for testing
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

async function resetLeads() {
  try {
    // Get all leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status, enrichment_status')
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
    const leadIds = leads.map(l => l.id);

    // Delete existing prep notes
    const { error: deleteError } = await supabase
      .from('lead_prep_notes')
      .delete()
      .in('lead_id', leadIds)
      .eq('is_auto_generated', true);

    if (deleteError) {
    } else {
    }

    // Reset leads to pending
    // Update each lead individually to handle metadata properly
    for (const leadId of leadIds) {
      // Get current metadata
      const { data: currentLead } = await supabase
        .from('leads')
        .select('metadata')
        .eq('id', leadId)
        .single();

      const metadata = (currentLead?.metadata as Record<string, unknown>) || {};
      // Remove prep-related metadata fields
      delete metadata.prep_generated_at;
      delete metadata.prep_model;
      delete metadata.prep_ai;

      const { error: updateError } = await supabase
        .from('leads')
        .update({
          prep_status: 'pending',
          enrichment_status: 'pending',
          prep_summary: null,
          enrichment_provider: null,
          metadata,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (updateError) {
      }
    }
    // Verify the reset
    const { data: updatedLeads, error: verifyError } = await supabase
      .from('leads')
      .select('id, contact_name, prep_status, enrichment_status')
      .in('id', leadIds);

    if (!verifyError && updatedLeads) {
      updatedLeads.forEach((lead) => {
      });
    }
  } catch (error: any) {
    if (error.details) {
    }
    process.exit(1);
  }
}

resetLeads();

