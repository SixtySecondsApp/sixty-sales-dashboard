/**
 * Test lead prep function directly using service role key
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

async function testLeadPrep() {
  console.log('🧪 Testing lead prep function...\n');

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
      console.log('ℹ️  No leads found');
      return;
    }

    console.log(`📋 Found ${leads.length} lead(s):\n`);
    leads.forEach((lead) => {
      console.log(`  - ${lead.contact_name || 'Unnamed'} (${lead.id})`);
      console.log(`    Status: prep=${lead.prep_status}, enrichment=${lead.enrichment_status}`);
      console.log(`    Owner: ${lead.owner_id}\n`);
    });

    // Reset leads to pending using service role
    console.log('🔄 Resetting leads to pending status...');
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

    console.log('✅ Leads reset to pending\n');

    // Wait a moment
    await new Promise(r => setTimeout(r, 1000));

    // Verify reset
    const { data: updatedLeads } = await supabase
      .from('leads')
      .select('id, prep_status, enrichment_status')
      .in('id', leads.map(l => l.id));

    console.log('📊 Verification - Updated leads:');
    updatedLeads?.forEach((lead) => {
      console.log(`  - ${lead.id}: prep=${lead.prep_status}, enrichment=${lead.enrichment_status}`);
    });
    console.log('');

    // Invoke the function
    console.log('🚀 Invoking process-lead-prep function...\n');
    const { data, error } = await supabase.functions.invoke('process-lead-prep', {
      method: 'POST',
      body: {},
    });

    if (error) {
      console.error('❌ Function error:', error);
      throw error;
    }

    console.log('✅ Function response:', JSON.stringify(data, null, 2));

    // Wait a bit for processing
    await new Promise(r => setTimeout(r, 5000));

    // Check final status
    const { data: finalLeads } = await supabase
      .from('leads')
      .select('id, contact_name, prep_status, enrichment_status, prep_summary, enrichment_provider')
      .in('id', leads.map(l => l.id));

    console.log('\n📊 Final lead status:');
    finalLeads?.forEach((lead) => {
      console.log(`  - ${lead.contact_name || 'Unnamed'}:`);
      console.log(`    prep=${lead.prep_status}, enrichment=${lead.enrichment_status}`);
      console.log(`    provider=${lead.enrichment_provider || 'none'}`);
      console.log(`    summary=${lead.prep_summary ? lead.prep_summary.substring(0, 50) + '...' : 'none'}\n`);
    });

    // Check prep notes
    const { data: prepNotes } = await supabase
      .from('lead_prep_notes')
      .select('*')
      .in('lead_id', leads.map(l => l.id))
      .order('created_at', { ascending: false });

    console.log(`📝 Prep notes created: ${prepNotes?.length || 0}`);
    if (prepNotes && prepNotes.length > 0) {
      prepNotes.forEach((note) => {
        console.log(`  - ${note.title} (${note.category || 'none'})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

testLeadPrep();

