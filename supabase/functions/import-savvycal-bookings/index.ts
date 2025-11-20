import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const JSON_HEADERS = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

function buildLeadMetadata(booking: SavvyCalBooking) {
  const metadata: Record<string, unknown> = {
    import_source: "savvycal_csv",
    csv_imported_at: new Date().toISOString(),
    csv_link_id: booking.link_id,
    csv_poll_id: booking.poll_id,
    location: booking.location,
    scheduler_display_name: booking.scheduler_display_name,
    organizer_display_name: booking.organizer_display_name,
  };

  if (booking.question_1) {
    metadata.question_1 = {
      question: booking.question_1,
      answer: booking.answer_1,
    };
  }

  if (booking.question_2) {
    metadata.question_2 = {
      question: booking.question_2,
      answer: booking.answer_2,
    };
  }

  return metadata;
}

function calculateDurationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) return null;
  const diffMs = endDate.getTime() - startDate.getTime();
  return diffMs > 0 ? Math.round(diffMs / 60000) : null;
}

async function upsertLeadFromBooking(
  supabase: any,
  booking: SavvyCalBooking,
  contactId: string | null,
  companyId: string | null,
  userId: string,
  sourceMapping: { source: string; sourceId: string | null },
  domain: string | null,
  effectiveOrgId: string | null
): Promise<{ leadId: string | null; created: boolean }> {
  const contactEmail = booking.scheduler_email?.toLowerCase() || booking.organizer_email?.toLowerCase() || null;

  const nameParts = booking.scheduler_display_name?.split(" ") || [];
  const firstName = nameParts[0] || null;
  const lastName = nameParts.slice(1).join(" ") || null;

  const { data: existingLead } = await supabase
    .from("leads")
    .select("id")
    .eq("external_source", "savvycal")
    .eq("external_id", booking.id)
    .maybeSingle();

  const createdAt = booking.start_at ?? booking.created_at ?? new Date().toISOString();
  const firstSeenAt = booking.created_at ?? booking.start_at ?? createdAt;

  const basePayload: Record<string, unknown> = {
    external_source: "savvycal",
    external_id: booking.id,
    external_occured_at: booking.start_at ?? booking.created_at ?? new Date().toISOString(),
    booking_link_id: booking.link_id,
    status: "new",
    priority: "normal",
    enrichment_status: "pending",
    prep_status: "pending",
    owner_id: userId,
    created_by: userId,
    company_id: companyId,
    contact_id: contactId,
    contact_name: booking.scheduler_display_name || booking.organizer_display_name || null,
    contact_first_name: firstName,
    contact_last_name: lastName || booking.organizer_display_name || null,
    contact_email: contactEmail,
    contact_phone: booking.scheduler_phone_number,
    scheduler_email: booking.scheduler_email || booking.organizer_email || null,
    scheduler_name: booking.scheduler_display_name || booking.organizer_display_name || null,
    domain,
    meeting_title: booking.summary,
    meeting_description: booking.description,
    meeting_start: booking.start_at,
    meeting_end: booking.end_at,
    meeting_duration_minutes: calculateDurationMinutes(booking.start_at, booking.end_at),
    meeting_url: booking.url,
    utm_source: booking.utm_source,
    utm_medium: booking.utm_medium,
    utm_campaign: booking.utm_campaign,
    utm_term: booking.utm_term,
    utm_content: booking.utm_content,
    metadata: buildLeadMetadata(booking),
    tags: [sourceMapping.source || "Unknown", "SavvyCal CSV Import"].filter(Boolean),
    updated_at: new Date().toISOString(),
    external_attendee_emails: booking.scheduler_email ? [booking.scheduler_email.toLowerCase()] : [],
    booking_link_slug: null,
    booking_link_name: null,
    booking_scope_slug: booking.poll_id,
    meeting_timezone: null,
    conferencing_type: null,
    conferencing_url: booking.url,
    source_id: sourceMapping.sourceId,
    source_channel: sourceMapping.source || null,
    source_campaign: booking.utm_campaign,
    source_medium: booking.utm_medium,
  };

  const insertPayload: Record<string, unknown> = {
    ...basePayload,
    created_at: createdAt,
    first_seen_at: firstSeenAt,
  };

  if (effectiveOrgId) {
    insertPayload.org_id = effectiveOrgId;
  }

  const updatePayload: Record<string, unknown> = {
    ...basePayload,
  };

  if (effectiveOrgId) {
    updatePayload.org_id = effectiveOrgId;
  }

  if (existingLead) {
    const { data: updatedLead, error: updateLeadError } = await supabase
      .from("leads")
      .update(updatePayload)
      .eq("id", existingLead.id)
      .select("id")
      .single();

    if (updateLeadError) {
      throw updateLeadError;
    }

    return { leadId: updatedLead?.id ?? existingLead.id, created: false };
  }

  const { data: newLead, error: insertLeadError } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertLeadError) {
    throw insertLeadError;
  }

  return { leadId: newLead?.id ?? null, created: true };
}

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
    leadsCreated: number;
    leadsUpdated: number;
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
  orgId: string | null
): Promise<{ source: string; sourceId: string | null }> {
  let query = supabase
    .from('savvycal_source_mappings')
    .select('source, source_id')
    .eq('link_id', linkId);
  
  if (orgId) {
    query = query.eq('org_id', orgId);
  }
  
  const { data: mappings } = await query.limit(1);

  const mapping = mappings && mappings.length > 0 ? mappings[0] : null;

  return {
    source: mapping?.source || 'Unknown',
    sourceId: mapping?.source_id || null,
  };
}

async function findOrCreateContact(
  supabase: any,
  email: string,
  firstName: string | null,
  lastName: string | null,
  phone: string | null,
  orgId: string | null,
  userId: string
): Promise<string | null> {
  if (!email) return null;

  // Try to find existing contact
  let query = supabase
    .from('contacts')
    .select('id, phone')
    .eq('email', email.toLowerCase().trim());
  
  if (orgId) {
    query = query.eq('org_id', orgId);
  }
  
  const { data: existingContacts } = await query.limit(1);

  const existing = existingContacts && existingContacts.length > 0 ? existingContacts[0] : null;

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
  const contactData: any = {
    email: email.toLowerCase().trim(),
    first_name: firstName || null,
    last_name: lastName || null,
    phone: phone || null,
    owner_id: userId,
  };
  
  if (orgId) {
    contactData.org_id = orgId;
  }
  
  const { data: newContact, error } = await supabase
    .from('contacts')
    .insert(contactData)
    .select('id')
    .single();

  if (error) {
    return null;
  }

  return newContact.id;
}

async function findOrCreateCompany(
  supabase: any,
  domain: string | null,
  companyName: string | null,
  orgId: string | null,
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
    let query = supabase
      .from('companies')
      .select('id')
      .eq('domain', domain.toLowerCase());
    
    if (orgId) {
      query = query.eq('org_id', orgId);
    }
    
    const { data: existingCompanies } = await query.limit(1);

    if (existingCompanies && existingCompanies.length > 0) {
      companyId = existingCompanies[0].id;
    }
  }

  // Try to find by name if domain search failed
  if (!companyId && companyName) {
    let query = supabase
      .from('companies')
      .select('id')
      .eq('name', companyName.trim());
    
    if (orgId) {
      query = query.eq('org_id', orgId);
    }
    
    const { data: existingCompanies } = await query.limit(1);

    if (existingCompanies && existingCompanies.length > 0) {
      companyId = existingCompanies[0].id;
    }
  }

  // Create new company if not found
  if (!companyId && companyName) {
    const companyData: any = {
      name: companyName.trim(),
      domain: domain ? domain.toLowerCase() : null,
      owner_id: userId,
    };
    
    if (orgId) {
      companyData.org_id = orgId;
    }
    
    const { data: newCompany, error } = await supabase
      .from('companies')
      .insert(companyData)
      .select('id')
      .single();

    if (error) {
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

    if (!csvText || !userId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: csvText, userId" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // orgId is optional - if not provided, we'll use null (for single-tenant mode)
    const effectiveOrgId = orgId || null;

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
        leadsCreated: 0,
        leadsUpdated: 0,
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
        const sourceMapping = await getSourceMapping(supabase, booking.link_id, effectiveOrgId);
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
          effectiveOrgId,
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
          effectiveOrgId,
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
        let isDuplicate = false;
        
        // First, check for existing deal by savvycal_booking_id (most reliable duplicate check)
        let dealQuery = supabase
          .from('deals')
          .select('id')
          .eq('savvycal_booking_id', booking.id);
        
        if (effectiveOrgId) {
          dealQuery = dealQuery.eq('org_id', effectiveOrgId);
        }
        
        const { data: existingDealByBookingId } = await dealQuery.limit(1);

        if (existingDealByBookingId && existingDealByBookingId.length > 0) {
          // This booking has already been imported - skip creating duplicate deal
          dealId = existingDealByBookingId[0].id;
          isDuplicate = true;
          
          // Check if activity already exists for this booking
          let activityQuery = supabase
            .from('activities')
            .select('id')
            .eq('savvycal_booking_id', booking.id);
          
          if (effectiveOrgId) {
            activityQuery = activityQuery.eq('org_id', effectiveOrgId);
          }
          
          const { data: existingActivity } = await activityQuery.limit(1);
          
          if (existingActivity && existingActivity.length > 0) {
            // Both deal and activity exist - fully duplicate, skip entirely
            result.skipped++;
            continue;
          }
          // Deal exists but activity doesn't - we'll create the missing activity below
        } else {
          // No deal found by booking ID, check for existing deal by contact email
          let existingDealQuery = supabase
            .from('deals')
            .select('id')
            .eq('contact_email', booking.scheduler_email.toLowerCase())
            .eq('status', 'active')
            .order('created_at', { ascending: false });
          
          if (effectiveOrgId) {
            existingDealQuery = existingDealQuery.eq('org_id', effectiveOrgId);
          }
          
          const { data: existingDeals, error: dealLookupError } = await existingDealQuery.limit(1);

          if (dealLookupError) {
            result.errors.push(`Failed to lookup deal for ${booking.scheduler_email}: ${dealLookupError.message}`);
          } else if (existingDeals && existingDeals.length > 0) {
            dealId = existingDeals[0].id;
            result.updated++;
          } else {
            // Create new deal in SQL stage
            const dealData: any = {
              name: `${booking.scheduler_display_name} - Meeting`,
              company: domain || 'Unknown',
              contact_email: booking.scheduler_email.toLowerCase(),
              contact_name: booking.scheduler_display_name,
              value: 0,
              stage_id: sqlStageId,
              owner_id: userId,
              status: 'active',
              primary_contact_id: contactId,
              company_id: companyId,
              savvycal_booking_id: booking.id,
              savvycal_link_id: booking.link_id,
              // Note: source_id is stored in savvycal_source_mappings, not directly on deals
            };
            
            if (effectiveOrgId) {
              dealData.org_id = effectiveOrgId;
            }
            
            const { data: newDeal, error: dealError } = await supabase
              .from('deals')
              .insert(dealData)
              .select('id')
              .single();

            if (dealError) {
              result.errors.push(`Failed to create deal for ${booking.scheduler_email}: ${dealError.message}`);
            } else {
              dealId = newDeal.id;
              result.created++;
              if (result.report) result.report.dealsCreated++;
            }
          }
        }

        // Create activity for the meeting (check for duplicates first)
        if (dealId) {
          // Always check if activity already exists for this booking ID
          let activityCheckQuery = supabase
            .from('activities')
            .select('id')
            .eq('savvycal_booking_id', booking.id);
          
          if (effectiveOrgId) {
            activityCheckQuery = activityCheckQuery.eq('org_id', effectiveOrgId);
          }
          
          const { data: existingActivity } = await activityCheckQuery.limit(1);

          if (existingActivity && existingActivity.length > 0) {
            // Activity already exists, skip creating duplicate
            if (!isDuplicate) {
              result.skipped++;
            }
          } else {
            // Create new activity (either new booking or missing activity for existing deal)
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

            const activityData: any = {
              type: 'meeting',
              client_name: booking.scheduler_display_name,
              contact_identifier: booking.scheduler_email.toLowerCase(),
              contact_identifier_type: 'email',
              date: booking.start_at,
              details: activityNotes,
              user_id: userId,
              deal_id: dealId,
              contact_id: contactId,
              company_id: companyId,
              savvycal_booking_id: booking.id,
              savvycal_link_id: booking.link_id,
            };
            
            if (effectiveOrgId) {
              activityData.org_id = effectiveOrgId;
            }
            
            const { error: activityError } = await supabase
              .from('activities')
              .insert(activityData);

            if (activityError) {
              result.errors.push(`Failed to create activity for ${booking.scheduler_email}: ${activityError.message}`);
            } else {
              if (result.report) result.report.activitiesCreated++;
            }
          }
        }

        // Create or update lead record
        const { leadId, created: leadCreated } = await upsertLeadFromBooking(
          supabase,
          booking,
          contactId,
          companyId,
          userId,
          sourceMapping,
          domain,
          effectiveOrgId
        );

        if (leadId && result.report) {
          if (leadCreated) {
            result.report.leadsCreated++;
          } else {
            result.report.leadsUpdated++;
          }
        }

        result.processed++;
      } catch (error: any) {
        result.errors.push(`Error processing ${booking.id}: ${error.message}`);
        result.skipped++;
      }
    }

    // Trigger lead prep if we created new leads
    if ((result.report?.leadsCreated || 0) > 0) {
      const prepUrl = `${SUPABASE_URL}/functions/v1/process-lead-prep`;
      fetch(prepUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({}),
      }).catch(() => {
        // Non-blocking
      });
    }

    // Update report
    if (result.report) {
      result.report.uniqueLinkIds = linkIdSet.size;
      result.report.unmappedLinkIds = Array.from(unmappedLinkIds);
    }

    return new Response(JSON.stringify(result), { headers: JSON_HEADERS });
  } catch (error: any) {
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

