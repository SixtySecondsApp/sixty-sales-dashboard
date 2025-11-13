import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

// Load environment variables from .env file
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function resetAndRegenerate() {
  console.log('🔄 Resetting lead enrichment and regenerating prep...\n');

  try {
    // Get all leads with completed prep
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status, enrichment_status')
      .in('prep_status', ['completed', 'in_progress'])
      .order('created_at', { ascending: false });

    if (leadsError) {
      throw leadsError;
    }

    if (!leads || leads.length === 0) {
      console.log('ℹ️  No leads with completed prep found');
      return;
    }

    console.log(`📋 Found ${leads.length} lead(s) to reset:\n`);
    leads.forEach((lead) => {
      console.log(`  - ${lead.contact_name || lead.contact_email} (${lead.domain || 'no domain'})`);
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
    
    for (const leadId of leadIds) {
      const { data: currentLead } = await supabase
        .from('leads')
        .select('metadata')
        .eq('id', leadId)
        .single();

      const metadata = (currentLead?.metadata as Record<string, unknown>) || {};
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

    // Wait a moment
    await new Promise(r => setTimeout(r, 1000));

    // Trigger the process-lead-prep function
    console.log('🚀 Triggering lead prep regeneration...');
    const functionUrl = `${SUPABASE_URL}/functions/v1/process-lead-prep`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Function call failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Lead prep function triggered');
    console.log(`   Processed: ${result.processed || 0} lead(s)\n`);

    console.log('✅ Complete! Check the leads in your dashboard to see the updated prep notes.');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
    process.exit(1);
  }
}

resetAndRegenerate();

