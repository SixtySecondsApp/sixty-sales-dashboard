/**
 * Check current leads and test the prep function
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

async function checkAndTestLeads() {
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
    if (allLeads && allLeads.length > 0) {
      allLeads.forEach((lead, idx) => {
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
    if (pendingLeads && pendingLeads.length > 0) {
      pendingLeads.forEach((lead) => {
      });
      // Invoke the function
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
      if (response.ok && responseData.processed > 0) {
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
          updatedLeads.forEach((lead: any) => {
            if (lead.lead_prep_notes && lead.lead_prep_notes.length > 0) {
              lead.lead_prep_notes.forEach((note: any) => {
              });
            }
          });
        }
      } else if (response.ok) {
      } else {
      }
    } else {
    }

  } catch (error: any) {
    if (error.details) {
    }
    process.exit(1);
  }
}

checkAndTestLeads();










