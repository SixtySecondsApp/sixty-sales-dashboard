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
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testLeadPrep() {
  console.log('🧪 Testing process-lead-prep edge function...\n');

  try {
    // Check for leads that need prep
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status, enrichment_status')
      .in('prep_status', ['pending', 'failed'])
      .limit(5);

    if (leadsError) {
      console.warn('⚠️  Could not check existing leads (RLS may block):', leadsError.message);
    }

    if (!leads || leads.length === 0) {
      console.log('ℹ️  No leads found with prep_status "pending" or "failed"');
      console.log('   The function will process any pending leads when invoked.\n');
    } else {
      console.log(`📋 Found ${leads.length} lead(s) needing prep:`);
      leads.forEach((lead) => {
        console.log(`   - ${lead.contact_name || lead.contact_email} (${lead.domain || 'no domain'})`);
        console.log(`     Status: prep=${lead.prep_status}, enrichment=${lead.enrichment_status}`);
      });
      console.log('');
    }

    // Invoke the edge function
    console.log('🚀 Invoking process-lead-prep function...\n');

    let data, error;
    try {
      const result = await supabase.functions.invoke('process-lead-prep', {
        method: 'POST',
        body: {},
      });
      data = result.data;
      error = result.error;
    } catch (err: any) {
      console.error('❌ Function invocation exception:', err);
      if (err.response) {
        try {
          const errorBody = await err.response.json();
          console.error('   Error response body:', JSON.stringify(errorBody, null, 2));
        } catch {
          const errorText = await err.response.text();
          console.error('   Error response text:', errorText);
        }
      }
      throw err;
    }

    if (error) {
      console.error('❌ Function invocation error:', error);
      if (error.message) {
        console.error('   Message:', error.message);
      }
      if (error.context) {
        console.error('   Context:', JSON.stringify(error.context, null, 2));
      }
      // Try to get response body if available
      if ((error as any).response) {
        try {
          const errorBody = await (error as any).response.json();
          console.error('   Error response body:', JSON.stringify(errorBody, null, 2));
        } catch {
          const errorText = await (error as any).response.text();
          console.error('   Error response text:', errorText);
        }
      }
      throw error;
    }

    console.log('✅ Function executed successfully!');
    console.log(`   Processed: ${data?.processed || 0} lead(s)\n`);

    if (data?.processed > 0) {
      console.log('✅ Function processed leads successfully!');
      console.log('   Check the Supabase dashboard or Leads Inbox UI to see the generated prep notes.\n');
      
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
        console.log('ℹ️  Could not fetch updated leads (RLS may block):', fetchError.message);
        console.log('   Check the Leads Inbox UI to verify prep notes were created.\n');
      } else if (updatedLeads && updatedLeads.length > 0) {
        console.log('📊 Recent processed leads:\n');
        updatedLeads.forEach((lead: any) => {
          console.log(`   Lead: ${lead.contact_name || lead.contact_email}`);
          console.log(`   Domain: ${lead.domain || 'N/A'}`);
          console.log(`   Enrichment Provider: ${lead.enrichment_provider || 'N/A'}`);
          console.log(`   Prep Summary: ${lead.prep_summary?.substring(0, 100) || 'N/A'}...`);
          console.log(`   Prep Notes: ${lead.lead_prep_notes?.length || 0} note(s)`);
          if (lead.lead_prep_notes && lead.lead_prep_notes.length > 0) {
            lead.lead_prep_notes.forEach((note: any) => {
              console.log(`     - [${note.note_type}] ${note.title || 'Untitled'}`);
            });
          }
          console.log('');
        });
      }
    } else {
      console.log('ℹ️  No leads were processed (may need leads with prep_status="pending" or "failed")');
    }

    console.log('✅ Test completed successfully!');
  } catch (error: any) {
    console.error('❌ Test failed:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
    process.exit(1);
  }
}

testLeadPrep();

