/**
 * Reset leads to pending status and clear prep notes for testing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Need: SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Use service role to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetLeads() {
  console.log('🔄 Resetting leads for testing...\n');

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
      console.log('ℹ️  No leads found');
      return;
    }

    console.log(`📋 Found ${leads.length} lead(s) to reset:\n`);
    leads.forEach((lead) => {
      console.log(`  - ${lead.contact_name || lead.contact_email} (${lead.domain || 'no domain'})`);
      console.log(`    Current: prep=${lead.prep_status}, enrichment=${lead.enrichment_status}`);
    });
    console.log('');

    const leadIds = leads.map(l => l.id);

    // Delete existing prep notes
    console.log('🗑️  Deleting existing prep notes...');
    const { error: deleteError } = await supabase
      .from('lead_prep_notes')
      .delete()
      .in('lead_id', leadIds)
      .eq('is_auto_generated', true);

    if (deleteError) {
      console.warn('⚠️  Error deleting prep notes:', deleteError.message);
    } else {
      console.log('✅ Prep notes deleted\n');
    }

    // Reset leads to pending
    console.log('🔄 Resetting leads to pending status...');
    
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
        console.warn(`⚠️  Failed to update lead ${leadId}:`, updateError.message);
      }
    }

    console.log('✅ Leads reset to pending status\n');

    // Verify the reset
    const { data: updatedLeads, error: verifyError } = await supabase
      .from('leads')
      .select('id, contact_name, prep_status, enrichment_status')
      .in('id', leadIds);

    if (!verifyError && updatedLeads) {
      console.log('📊 Verification - Updated leads:');
      updatedLeads.forEach((lead) => {
        console.log(`  - ${lead.contact_name || 'Unnamed'}: prep=${lead.prep_status}, enrichment=${lead.enrichment_status}`);
      });
    }

    console.log('\n✅ Reset complete! You can now test the enhanced prep generation.');
    console.log('   Go to the Leads Inbox and click "Generate Prep" to see the new enhanced output.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
    process.exit(1);
  }
}

resetLeads();

