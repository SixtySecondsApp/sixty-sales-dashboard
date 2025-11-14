/**
 * Check current leads and test the prep function
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

// Use service role to bypass RLS
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkAndTestLeads() {
  console.log('🔍 Checking current leads...\n');

  try {
    // Check all leads
    const { data: allLeads, error: allError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status, enrichment_status, created_at')
      .order('created_at', { ascending: false })
      .limit(20);

    if (allError) {
      throw allError;
    }

    console.log(`📊 Total leads found: ${allLeads?.length || 0}\n`);

    if (allLeads && allLeads.length > 0) {
      console.log('Recent leads:');
      allLeads.forEach((lead, idx) => {
        console.log(`  ${idx + 1}. ${lead.contact_name || lead.contact_email || 'Unnamed'}`);
        console.log(`     Domain: ${lead.domain || 'N/A'}`);
        console.log(`     Prep Status: ${lead.prep_status || 'N/A'}`);
        console.log(`     Enrichment Status: ${lead.enrichment_status || 'N/A'}`);
        console.log(`     Created: ${lead.created_at ? new Date(lead.created_at).toLocaleString() : 'N/A'}`);
        console.log('');
      });
    }

    // Check for leads needing prep
    const { data: pendingLeads, error: pendingError } = await supabase
      .from('leads')
      .select('id, contact_name, contact_email, domain, prep_status')
      .in('prep_status', ['pending', 'failed'])
      .limit(10);

    if (pendingError) {
      throw pendingError;
    }

    console.log(`\n📋 Leads needing prep: ${pendingLeads?.length || 0}\n`);

    if (pendingLeads && pendingLeads.length > 0) {
      console.log('Leads that will be processed:');
      pendingLeads.forEach((lead) => {
        console.log(`  - ${lead.contact_name || lead.contact_email} (${lead.domain || 'no domain'})`);
      });
      console.log('');

      // Invoke the function
      console.log('🚀 Invoking process-lead-prep function...\n');

      const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-lead-prep`;
      const response = await fetch(FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const responseText = await response.text();
      let responseData;
      
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = { raw: responseText };
      }

      console.log(`HTTP Status: ${response.status}`);
      console.log('Response:', JSON.stringify(responseData, null, 2));

      if (response.ok && responseData.processed > 0) {
        console.log(`\n✅ Successfully processed ${responseData.processed} lead(s)!`);
        
        // Check the updated leads
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        const { data: updatedLeads, error: updatedError } = await supabase
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
          .in('id', pendingLeads.map(l => l.id))
          .order('updated_at', { ascending: false });

        if (!updatedError && updatedLeads) {
          console.log('\n📊 Updated leads:');
          updatedLeads.forEach((lead: any) => {
            console.log(`\n  Lead: ${lead.contact_name || lead.contact_email}`);
            console.log(`    Domain: ${lead.domain || 'N/A'}`);
            console.log(`    Prep Status: ${lead.prep_status}`);
            console.log(`    Enrichment Provider: ${lead.enrichment_provider || 'N/A'}`);
            console.log(`    Prep Summary: ${lead.prep_summary?.substring(0, 100) || 'N/A'}...`);
            console.log(`    Prep Notes: ${lead.lead_prep_notes?.length || 0} note(s)`);
            if (lead.lead_prep_notes && lead.lead_prep_notes.length > 0) {
              lead.lead_prep_notes.forEach((note: any) => {
                console.log(`      - [${note.note_type}] ${note.title || 'Untitled'}`);
              });
            }
          });
        }
      } else if (response.ok) {
        console.log('\nℹ️  No leads were processed');
      } else {
        console.log('\n❌ Function returned error');
      }
    } else {
      console.log('ℹ️  No leads need prep. You can:');
      console.log('   1. Create a new lead via SavvyCal webhook');
      console.log('   2. Or manually set a lead\'s prep_status to "pending"');
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('   Details:', error.details);
    }
    process.exit(1);
  }
}

checkAndTestLeads();






