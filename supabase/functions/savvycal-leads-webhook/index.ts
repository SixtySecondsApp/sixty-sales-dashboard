import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { extractBusinessDomain, matchOrCreateCompany } from "../_shared/companyMatching.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("SAVVYCAL_WEBHOOK_SECRET") ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration for SavvyCal leads webhook");
}

type Nullable<T> = T | null | undefined;

interface SavvyCalCustomField {
  id: string;
  label: string;
  type: string;
  value: Nullable<string>;
  options: Array<{ label: string; value: string }>;
}

interface SavvyCalAttendee {
  id: string;
  email: string;
  display_name: string;
  first_name: Nullable<string>;
  last_name: Nullable<string>;
  is_organizer: boolean;
  phone_number: Nullable<string>;
  time_zone: Nullable<string>;
  marketing_opt_in: Nullable<boolean>;
  fields?: SavvyCalCustomField[];
}

interface SavvyCalEventPayload {
  id: string;
  state: string;
  summary: string;
  description: Nullable<string>;
  start_at: Nullable<string>;
  end_at: Nullable<string>;
  created_at: Nullable<string>;
  updated_at?: Nullable<string>;
  canceled_at?: Nullable<string>;
  rescheduled_at?: Nullable<string>;
  buffer_before?: number;
  buffer_after?: number;
  duration: number;
  attendees: SavvyCalAttendee[];
  organizer: SavvyCalAttendee;
  scheduler?: SavvyCalAttendee;
  conferencing?: {
    type: Nullable<string>;
    join_url: Nullable<string>;
    meeting_id?: Nullable<string>;
    instructions?: Nullable<string>;
  };
  link?: {
    id: string;
    slug: string;
    name: Nullable<string>;
    private_name: Nullable<string>;
    description: Nullable<string>;
  };
  scope?: {
    id: string;
    name: string;
    slug: string;
  };
  metadata?: Record<string, unknown>;
  location?: Nullable<string>;
  location_settings?: Array<Record<string, unknown>>;
}

interface SavvyCalWebhookEvent {
  id: string;
  occurred_at: string;
  payload: SavvyCalEventPayload;
  type: string;
  version: string;
}

interface LeadSourceDetails {
  sourceKey: string;
  name: string;
  channel?: string;
  medium?: string;
  campaign?: string;
  defaultOwnerId?: string | null;
}

type LeadProcessingResult = {
  success: boolean;
  external_event_id: string;
  lead_id?: string;
  reason?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const rawBody = await req.text();

  try {
    await verifySignature(req.headers, rawBody);
  } catch (error) {
    console.error("SavvyCal signature verification failed:", error);
    return new Response(
      JSON.stringify({ error: "Invalid webhook signature" }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let events: SavvyCalWebhookEvent[] = [];

  try {
    const parsed = JSON.parse(rawBody);
    events = Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    console.error("Failed to parse SavvyCal webhook payload:", error);
    return new Response(
      JSON.stringify({ error: "Invalid JSON payload" }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const results: LeadProcessingResult[] = [];
  for (const event of events) {
    try {
      const result = await processSavvyCalEvent(supabase, event);
      results.push(result);
    } catch (error) {
      console.error("Failed to process SavvyCal event", {
        error,
        eventId: event?.id,
      });
      results.push({
        success: false,
        external_event_id: event?.id ?? "unknown",
        reason: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return new Response(
    JSON.stringify({
      success: results.every((result) => result.success),
      results,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});

async function verifySignature(headers: Headers, rawBody: string): Promise<void> {
  if (!WEBHOOK_SECRET) {
    console.warn("SAVVYCAL_WEBHOOK_SECRET not configured; skipping signature validation");
    return;
  }

  const signatureHeader =
    headers.get("savvycal-signature") ||
    headers.get("x-savvycal-signature") ||
    headers.get("SavvyCal-Signature");

  if (!signatureHeader) {
    throw new Error("Missing SavvyCal signature header");
  }

  const parsedSignature = parseSignature(signatureHeader);
  const expected = await generateSignature(rawBody);

  if (!timingSafeEqual(parsedSignature, expected)) {
    throw new Error("Signature mismatch");
  }
}

function parseSignature(signatureHeader: string): string {
  const trimmed = signatureHeader.trim();
  if (trimmed.includes("=")) {
    const [, signature] = trimmed.split("=", 2);
    return signature;
  }
  return trimmed;
}

async function generateSignature(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  return bufferToHex(signatureBuffer);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.length !== bBytes.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < aBytes.length; i++) {
    mismatch |= aBytes[i] ^ bBytes[i];
  }
  return mismatch === 0;
}

async function processSavvyCalEvent(
  supabase: SupabaseClient,
  event: SavvyCalWebhookEvent,
): Promise<LeadProcessingResult> {
  if (!event?.payload?.id) {
    throw new Error("Event payload missing meeting id");
  }

  const externalEventId = event.id;
  const meetingId = event.payload.id;

  // Skip duplicate webhook deliveries
  const { data: existingEvent, error: selectEventError } = await supabase
    .from("lead_events")
    .select("id, lead_id")
    .eq("external_source", "savvycal")
    .eq("external_id", externalEventId)
    .maybeSingle();

  if (selectEventError) {
    throw selectEventError;
  }

  if (existingEvent) {
    return {
      success: true,
      external_event_id: externalEventId,
      lead_id: existingEvent.lead_id ?? null,
      reason: "duplicate",
    };
  }

  const organizer = getOrganizer(event.payload);
  const leadCandidate = getLeadCandidate(event.payload);

  const scheduler = event.payload.scheduler;
  const schedulerEmail = scheduler?.email ?? leadCandidate?.email ?? null;
  const schedulerName = scheduler?.display_name ?? leadCandidate?.display_name ?? null;

  const attendeeEmails = (event.payload.attendees || [])
    .filter((attendee) => !attendee.is_organizer && attendee.email)
    .map((attendee) => attendee.email.toLowerCase());

  const contactEmail = leadCandidate?.email?.toLowerCase() ?? schedulerEmail?.toLowerCase() ?? null;
  if (!contactEmail) {
    throw new Error("Unable to determine lead contact email");
  }

  const leadName = leadCandidate?.display_name ?? schedulerName ?? "";
  const [contactFirstName, contactLastName] = splitName(
    leadCandidate?.first_name,
    leadCandidate?.last_name,
    leadName,
  );

  const ownerProfileId = await resolveLeadOwnerId(supabase, organizer?.email);

  const sourceDetails = resolveLeadSource(event.payload);
  const leadSource = await ensureLeadSource(
    supabase,
    sourceDetails,
    ownerProfileId,
  );

  let companyId: string | null = null;
  let contactId: string | null = null;
  let isNewCompany = false;

  const businessDomain = contactEmail ? extractBusinessDomain(contactEmail) : null;

  if (ownerProfileId && businessDomain) {
    const { company, isNew } = await matchOrCreateCompany(
      supabase,
      contactEmail,
      ownerProfileId,
      leadName,
    );
    companyId = company?.id ?? null;
    isNewCompany = isNew;
  }

  contactId = await upsertContact(
    supabase,
    {
      email: contactEmail,
      first_name: contactFirstName,
      last_name: contactLastName,
      phone: leadCandidate?.phone_number,
      owner_id: ownerProfileId ?? leadSource?.default_owner_id ?? null,
      company_id: companyId,
    },
  );

  const leadMetadata = buildLeadMetadata(event.payload, leadCandidate, scheduler);
  const payloadHash = await hashPayload(event.payload);

  const status = determineLeadStatus(event);

  // Build tags array: "Meeting Booked", source name, owner name
  const tags: string[] = ["Meeting Booked"];
  
  // Add source name if available
  if (leadSource?.name) {
    tags.push(leadSource.name);
  } else if (sourceDetails.name) {
    tags.push(sourceDetails.name);
  }
  
  // Add owner name if available
  if (ownerProfileId) {
    const { data: ownerProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", ownerProfileId)
      .maybeSingle();
    
    if (ownerProfile) {
      const ownerName = [ownerProfile.first_name, ownerProfile.last_name]
        .filter(Boolean)
        .join(" ");
      if (ownerName) {
        tags.push(ownerName);
      }
    }
  }

  const leadRecord = {
    external_source: "savvycal",
    external_id: meetingId,
    external_occured_at: event.occurred_at,
    source_id: leadSource?.id ?? null,
    source_channel: sourceDetails.channel ?? null,
    source_campaign: sourceDetails.campaign ?? null,
    source_medium: sourceDetails.medium ?? null,
    booking_link_id: event.payload.link?.id ?? null,
    booking_link_slug: event.payload.link?.slug ?? null,
    booking_link_name: event.payload.link?.private_name ?? event.payload.link?.name ?? null,
    booking_scope_slug: event.payload.scope?.slug ?? null,
    status,
    priority: "normal" as const,
    enrichment_status: "pending" as const,
    enrichment_provider: null,
    prep_status: "pending" as const,
    prep_summary: null,
    owner_id: ownerProfileId ?? leadSource?.default_owner_id ?? null,
    created_by: ownerProfileId ?? null,
    converted_deal_id: null,
    company_id: companyId,
    contact_id: contactId,
    contact_name: leadName || null,
    contact_first_name: contactFirstName || null,
    contact_last_name: contactLastName || null,
    contact_email: contactEmail,
    contact_phone: leadCandidate?.phone_number ?? null,
    contact_timezone: leadCandidate?.time_zone ?? scheduler?.time_zone ?? null,
    contact_marketing_opt_in: leadCandidate?.marketing_opt_in ?? null,
    scheduler_email: schedulerEmail ?? null,
    scheduler_name: schedulerName ?? null,
    domain: businessDomain ?? null,
    meeting_title: event.payload.summary ?? null,
    meeting_description: event.payload.description ?? null,
    meeting_start: event.payload.start_at ?? null,
    meeting_end: event.payload.end_at ?? null,
    meeting_duration_minutes: event.payload.duration ?? null,
    meeting_timezone: scheduler?.time_zone ?? null,
    meeting_url: event.payload.conferencing?.join_url ?? event.payload.location ?? null,
    conferencing_type: event.payload.conferencing?.type ?? null,
    conferencing_url: event.payload.conferencing?.join_url ?? null,
    attendee_count: attendeeEmails.length,
    external_attendee_emails: attendeeEmails,
    utm_source: event.payload.metadata?.utm_source as string ?? sourceDetails.sourceKey,
    utm_medium: event.payload.metadata?.utm_medium as string ?? sourceDetails.medium ?? null,
    utm_campaign: event.payload.metadata?.utm_campaign as string ?? sourceDetails.campaign ?? null,
    utm_term: event.payload.metadata?.utm_term as string ?? null,
    utm_content: event.payload.metadata?.utm_content as string ?? null,
    metadata: leadMetadata,
    tags,
    first_seen_at: event.occurred_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: leadData, error: upsertLeadError } = await supabase
    .from("leads")
    .upsert(leadRecord, { onConflict: "external_id" })
    .select("id")
    .single();

  if (upsertLeadError) {
    throw upsertLeadError;
  }

  const { error: insertEventError } = await supabase
    .from("lead_events")
    .insert({
      lead_id: leadData.id,
      external_source: "savvycal",
      external_id: externalEventId,
      event_type: event.type,
      payload: event.payload,
      payload_hash: payloadHash,
      external_occured_at: event.occurred_at ?? null,
      received_at: new Date().toISOString(),
    });

  if (insertEventError) {
    console.error("Failed to insert lead event record", insertEventError);
  }

  // Trigger company enrichment if this is a new company
  if (isNewCompany && companyId) {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const enrichUrl = `${SUPABASE_URL}/functions/v1/enrich-company`;
    
    // Fire and forget - don't wait for enrichment to complete
    fetch(enrichUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ company_id: companyId }),
    }).catch((error) => {
      console.error("Failed to trigger company enrichment:", error);
      // Non-blocking - enrichment failure shouldn't fail lead creation
    });
    
    console.log(`✅ Triggered enrichment for new company: ${companyId}`);
  }

  return {
    success: true,
    external_event_id: externalEventId,
    lead_id: leadData.id,
  };
}

function getOrganizer(payload: SavvyCalEventPayload): SavvyCalAttendee | null {
  if (!payload.attendees?.length) return null;
  return payload.attendees.find((attendee) => attendee.is_organizer) ?? payload.organizer ?? null;
}

function getLeadCandidate(payload: SavvyCalEventPayload): SavvyCalAttendee | null {
  if (!payload.attendees?.length) return payload.scheduler ?? null;
  const externalAttendees = payload.attendees.filter((attendee) => !attendee.is_organizer);
  if (externalAttendees.length > 0) {
    return externalAttendees[0];
  }
  return payload.scheduler ?? null;
}

function splitName(
  firstName: Nullable<string>,
  lastName: Nullable<string>,
  fallback: string,
): [string | null, string | null] {
  if (firstName || lastName) {
    return [firstName || null, lastName || null];
  }
  if (!fallback) return [null, null];
  const parts = fallback.split(" ");
  if (parts.length === 1) {
    return [parts[0], null];
  }
  return [parts[0], parts.slice(1).join(" ") || null];
}

async function resolveLeadOwnerId(
  supabase: SupabaseClient,
  organizerEmail: Nullable<string>,
): Promise<string | null> {
  if (!organizerEmail) return null;

  const normalizedEmail = organizerEmail.toLowerCase();

  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch organizer profile", error);
    return null;
  }

  return data?.id ?? null;
}

function resolveLeadSource(payload: SavvyCalEventPayload): LeadSourceDetails {
  const privateName = payload.link?.private_name ?? "";
  const publicName = payload.link?.name ?? "";
  const scopeName = payload.scope?.name ?? "";

  const normalized = `${privateName} ${publicName} ${scopeName}`.toLowerCase();

  if (normalized.includes("linkedin") || normalized.includes("linkedin ads")) {
    return {
      sourceKey: "linkedin_ads",
      name: "LinkedIn Ads",
      channel: "paid_social",
      medium: "linkedin",
      campaign: payload.metadata?.utm_campaign as string ?? undefined,
    };
  }

  if (normalized.includes("website") || normalized.includes("homepage")) {
    return {
      sourceKey: "website",
      name: "Marketing Website",
      channel: "website",
      medium: "organic",
      campaign: payload.metadata?.utm_campaign as string ?? undefined,
    };
  }

  if (normalized.includes("personal") || normalized.includes("direct")) {
    return {
      sourceKey: "personal_savvycal",
      name: "Personal SavvyCal",
      channel: "direct",
      medium: "calendaring",
      campaign: payload.metadata?.utm_campaign as string ?? undefined,
    };
  }

  return {
    sourceKey: "unknown",
    name: "Unknown Source",
    channel: payload.metadata?.utm_channel as string ?? undefined,
    medium: payload.metadata?.utm_medium as string ?? undefined,
    campaign: payload.metadata?.utm_campaign as string ?? undefined,
  };
}

async function ensureLeadSource(
  supabase: SupabaseClient,
  details: LeadSourceDetails,
  preferredOwnerId: string | null,
): Promise<{ id: string; default_owner_id: string | null } | null> {
  const payload = {
    source_key: details.sourceKey,
    name: details.name,
    channel: details.channel ?? null,
    utm_medium: details.medium ?? null,
    utm_campaign: details.campaign ?? null,
    default_owner_id: preferredOwnerId ?? details.defaultOwnerId ?? undefined,
  };

  const { data, error } = await supabase
    .from("lead_sources")
    .upsert(payload, { onConflict: "source_key" })
    .select("id, default_owner_id")
    .single();

  if (error) {
    console.error("Failed to upsert lead source", error, details);
    return null;
  }

  return data;
}

async function upsertContact(
  supabase: SupabaseClient,
  params: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
    owner_id: string | null;
    company_id: string | null;
  },
): Promise<string | null> {
  const normalizedEmail = params.email.toLowerCase();

  const { data: existing, error: fetchError } = await supabase
    .from("contacts")
    .select("id, company_id, owner_id")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to fetch existing contact", fetchError);
    return null;
  }

  if (existing) {
    if (!existing.company_id && params.company_id) {
      await supabase
        .from("contacts")
        .update({
          company_id: params.company_id,
          owner_id: params.owner_id ?? existing.owner_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    }
    return existing.id;
}

  const [insertFirstName, insertLastName] = [
    params.first_name,
    params.last_name,
  ];

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      email: normalizedEmail,
      first_name: insertFirstName,
      last_name: insertLastName,
      phone: params.phone,
      company_id: params.company_id,
      owner_id: params.owner_id,
      is_primary: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create contact", error);
    return null;
  }

  return data?.id ?? null;
}

function buildLeadMetadata(
  payload: SavvyCalEventPayload,
  leadCandidate: SavvyCalAttendee | null,
  scheduler: SavvyCalAttendee | undefined,
): Record<string, unknown> {
  return {
    savvycal: {
      link: {
        id: payload.link?.id,
        slug: payload.link?.slug,
        name: payload.link?.name,
        private_name: payload.link?.private_name,
      },
      scope: payload.scope,
      fields: {
        scheduler: scheduler?.fields ?? [],
        attendee: leadCandidate?.fields ?? [],
      },
      buffer_before: payload.buffer_before ?? 0,
      buffer_after: payload.buffer_after ?? 0,
    },
    attendees: (payload.attendees || []).map((attendee) => ({
      email: attendee.email,
      name: attendee.display_name,
      is_organizer: attendee.is_organizer,
      time_zone: attendee.time_zone,
      marketing_opt_in: attendee.marketing_opt_in,
      custom_fields: attendee.fields ?? [],
    })),
    conferencing: payload.conferencing,
    location_settings: payload.location_settings,
  };
}

async function hashPayload(payload: unknown): Promise<string> {
  const serialized = JSON.stringify(payload ?? {});
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(serialized),
  );
  return bufferToHex(digest);
}

function determineLeadStatus(event: SavvyCalWebhookEvent): "new" | "prepping" | "ready" | "converted" | "archived" {
  const state = event.payload.state?.toLowerCase();
  if (state === "cancelled" || state === "canceled") {
    return "archived";
  }
  return "new";
}

