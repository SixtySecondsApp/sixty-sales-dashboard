import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const JSON_HEADERS = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

interface SavvyCalBooking {
  id: string;
  link_id: string;
  poll_id: string | null;
  state: string;
  summary: string;
  description: string | null;
  start_at: string;
  end_at: string;
  created_at: string;
  location: string | null;
  organizer_display_name: string;
  organizer_email: string;
  scheduler_display_name: string;
  scheduler_email: string;
  scheduler_phone_number: string | null;
  url: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  question_1: string | null;
  answer_1: string | null;
  question_2: string | null;
  answer_2: string | null;
}

interface ImportResult {
  success: boolean;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  testMode: boolean;
  report?: {
    totalRows: number;
    uniqueLinkIds: number;
    unmappedLinkIds: string[];
    contactsCreated: number;
    companiesCreated: number;
    dealsCreated: number;
    activitiesCreated: number;
  };
}

function parseCSV(csvText: string): SavvyCalBooking[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  // Simple CSV parser that handles quoted fields
  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  
  // Parse data rows
  const bookings: SavvyCalBooking[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) continue;

    const booking: any = {};
    headers.forEach((header, index) => {
      const value = values[index] || '';
      // Remove surrounding quotes if present
      booking[header] = value.replace(/^"(.*)"$/, '$1') || null;
    });

    bookings.push(booking as SavvyCalBooking);
  }

  return bookings;
}

async function getSourceMapping(
  supabase: any,
  linkId: string,
  orgId: string
): Promise<{ source: string; sourceId: string | null }> {
  const { data } = await supabase
    .from('savvycal_source_mappings')
    .select('source, source_id')
    .eq('link_id', linkId)
    .eq('org_id', orgId)
    .single();

  return {
    source: data?.source || 'Unknown',
    sourceId: data?.source_id || null,
  };
}

async function findOrCreateContact(
  supabase: any,
  email: string,
  firstName: string | null,
  lastName: string | null,
  phone: string | null,
  orgId: string,
  userId: string
): Promise<string | null> {
  if (!email) return null;

  // Try to find existing contact
  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('email', email.toLowerCase().trim())
    .eq('org_id', orgId)
    .single();

  if (existing) {
    // Update phone if provided and missing
    if (phone && !existing.phone) {
      await supabase
        .from('contacts')
        .update({ phone })
        .eq('id', existing.id);
    }
    return existing.id;
  }

  // Create new contact
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert({
      email: email.toLowerCase().trim(),
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
      owner_id: userId,
      org_id: orgId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('Error creating contact:', error);
    return null;
  }

  return newContact.id;
}

async function findOrCreateCompany(
  supabase: any,
  domain: string | null,
  companyName: string | null,
  orgId: string,
  userId: string
): Promise<string | null> {
  // Extract domain from email if not provided
  if (!domain && companyName) {
    // Try to infer from company name (basic)
    return null; // We'll create by name
  }

  let companyId: string | null = null;

  // Try to find by domain first
  if (domain) {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('domain', domain.toLowerCase())
      .eq('org_id', orgId)
      .single();

    if (existing) {
      companyId = existing.id;
    }
  }

  // Try to find by name if domain search failed
  if (!companyId && companyName) {
    const { data: existing } = await supabase
      .from('companies')
      .select('id')
      .eq('name', companyName.trim())
      .eq('org_id', orgId)
      .single();

    if (existing) {
      companyId = existing.id;
    }
  }

  // Create new company if not found
  if (!companyId && companyName) {
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert({
        name: companyName.trim(),
        domain: domain ? domain.toLowerCase() : null,
        owner_id: userId,
        org_id: orgId,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error creating company:', error);
      return null;
    }

    companyId = newCompany.id;
  }

  return companyId;
}

async function extractDomain(email: string): Promise<string | null> {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase();
}

async function getSQLStageId(supabase: any): Promise<string | null> {
  const { data } = await supabase
    .from('deal_stages')
    .select('id')
    .eq('name', 'SQL')
    .single();

  return data?.id || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: JSON_HEADERS }
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { csvText, userId, orgId, testMode = false } = await req.json();

    if (!csvText || !userId || !orgId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: csvText, userId, orgId" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // Parse CSV
    const bookings = parseCSV(csvText);
    
    if (bookings.length === 0) {
      return new Response(
        JSON.stringify({ error: "No bookings found in CSV" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // Test mode: limit to 100 rows
    const bookingsToProcess = testMode ? bookings.slice(0, 100) : bookings;

    const result: ImportResult = {
      success: true,
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [],
      testMode,
      report: {
        totalRows: bookings.length,
        uniqueLinkIds: 0,
        unmappedLinkIds: [],
        contactsCreated: 0,
        companiesCreated: 0,
        dealsCreated: 0,
        activitiesCreated: 0,
      },
    };

    // Get SQL stage ID
    const sqlStageId = await getSQLStageId(supabase);
    if (!sqlStageId) {
      result.errors.push('SQL stage not found in deal_stages');
      result.success = false;
      return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
    }

    // Track unique link IDs for report
    const linkIdSet = new Set<string>();
    const unmappedLinkIds = new Set<string>();

    // Process each booking
    for (const booking of bookingsToProcess) {
      try {
        linkIdSet.add(booking.link_id);

        // Get source mapping
        const sourceMapping = await getSourceMapping(supabase, booking.link_id, orgId);
        if (sourceMapping.source === 'Unknown') {
          unmappedLinkIds.add(booking.link_id);
        }

        // Skip canceled bookings
        if (booking.state === 'canceled') {
          result.skipped++;
          continue;
        }

        // Extract domain from scheduler email
        const domain = await extractDomain(booking.scheduler_email);

        // Find or create company
        const companyId = await findOrCreateCompany(
          supabase,
          domain,
          null, // We don't have company name in CSV
          orgId,
          userId
        );
        if (companyId && result.report) {
          // Check if it was just created
          const { data: company } = await supabase
            .from('companies')
            .select('created_at')
            .eq('id', companyId)
            .single();
          if (company && new Date(company.created_at) > new Date(Date.now() - 60000)) {
            result.report.companiesCreated++;
          }
        }

        // Parse scheduler name
        const nameParts = booking.scheduler_display_name?.split(' ') || [];
        const firstName = nameParts[0] || null;
        const lastName = nameParts.slice(1).join(' ') || null;

        // Find or create contact
        const contactId = await findOrCreateContact(
          supabase,
          booking.scheduler_email,
          firstName,
          lastName,
          booking.scheduler_phone_number,
          orgId,
          userId
        );
        if (contactId && result.report) {
          // Check if it was just created
          const { data: contact } = await supabase
            .from('contacts')
            .select('created_at')
            .eq('id', contactId)
            .single();
          if (contact && new Date(contact.created_at) > new Date(Date.now() - 60000)) {
            result.report.contactsCreated++;
          }
        }

        // Update contact's company if we found one
        if (contactId && companyId) {
          await supabase
            .from('contacts')
            .update({ company_id: companyId })
            .eq('id', contactId)
            .is('company_id', null); // Only update if company_id is null
        }

        // Find or create deal
        let dealId: string | null = null;
        
        // Check for existing deal by contact email
        const { data: existingDeal } = await supabase
          .from('deals')
          .select('id')
          .eq('contact_email', booking.scheduler_email.toLowerCase())
          .eq('org_id', orgId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingDeal) {
          dealId = existingDeal.id;
          result.updated++;
        } else {
          // Create new deal in SQL stage
          const { data: newDeal, error: dealError } = await supabase
            .from('deals')
            .insert({
              name: `${booking.scheduler_display_name} - Meeting`,
              company: domain || 'Unknown',
              contact_email: booking.scheduler_email.toLowerCase(),
              contact_name: booking.scheduler_display_name,
              value: 0,
              stage_id: sqlStageId,
              owner_id: userId,
              org_id: orgId,
              status: 'active',
              primary_contact_id: contactId,
              company_id: companyId,
              savvycal_booking_id: booking.id,
              savvycal_link_id: booking.link_id,
              // Note: source_id is stored in savvycal_source_mappings, not directly on deals
            })
            .select('id')
            .single();

          if (dealError) {
            console.error('Error creating deal:', dealError);
            result.errors.push(`Failed to create deal for ${booking.scheduler_email}: ${dealError.message}`);
          } else {
            dealId = newDeal.id;
            result.created++;
            if (result.report) result.report.dealsCreated++;
          }
        }

        // Create activity for the meeting
        if (dealId) {
          const activityNotes = [
            `Meeting: ${booking.summary}`,
            booking.description ? `Description: ${booking.description}` : null,
            booking.location ? `Location: ${booking.location}` : null,
            booking.question_1 && booking.answer_1 ? `Q: ${booking.question_1}\nA: ${booking.answer_1}` : null,
            booking.question_2 && booking.answer_2 ? `Q: ${booking.question_2}\nA: ${booking.answer_2}` : null,
            booking.utm_source ? `UTM Source: ${booking.utm_source}` : null,
            booking.utm_campaign ? `UTM Campaign: ${booking.utm_campaign}` : null,
            `Source: ${sourceMapping.source}`,
          ].filter(Boolean).join('\n\n');

          const { error: activityError } = await supabase
            .from('activities')
            .insert({
              type: 'meeting',
              client_name: booking.scheduler_display_name,
              contact_identifier: booking.scheduler_email.toLowerCase(),
              contact_identifier_type: 'email',
              date: booking.start_at,
              details: activityNotes,
              user_id: userId,
              org_id: orgId,
              deal_id: dealId,
              contact_id: contactId,
              company_id: companyId,
              savvycal_booking_id: booking.id,
              savvycal_link_id: booking.link_id,
            });

          if (activityError) {
            console.error('Error creating activity:', activityError);
            result.errors.push(`Failed to create activity for ${booking.scheduler_email}: ${activityError.message}`);
          } else {
            if (result.report) result.report.activitiesCreated++;
          }
        }

        result.processed++;
      } catch (error: any) {
        console.error('Error processing booking:', error);
        result.errors.push(`Error processing ${booking.id}: ${error.message}`);
        result.skipped++;
      }
    }

    // Update report
    if (result.report) {
      result.report.uniqueLinkIds = linkIdSet.size;
      result.report.unmappedLinkIds = Array.from(unmappedLinkIds);
    }

    return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
  } catch (error: any) {
    console.error('Error in import-savvycal-bookings:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        processed: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        errors: [error.message],
        testMode: false,
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});

