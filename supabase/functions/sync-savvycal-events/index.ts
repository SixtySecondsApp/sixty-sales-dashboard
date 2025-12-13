/**
 * sync-savvycal-events - Cron-compatible Edge Function
 *
 * Polls SavvyCal API and syncs any events not already in the database.
 * Designed to run every 15 minutes as a backup to the webhook.
 *
 * Usage:
 * - Trigger via pg_cron: SELECT net.http_post(...)
 * - Or external cron: POST /functions/v1/sync-savvycal-events
 *
 * Query params:
 * - since_hours: How far back to check (default: 1 hour)
 * - dry_run: If true, just report what would be synced
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SAVVYCAL_API_TOKEN = Deno.env.get("SAVVYCAL_API_TOKEN") ?? "";

interface SavvyCalEvent {
  id: string;
  state: string;
  summary: string;
  description: string | null;
  start_at: string;
  end_at: string;
  created_at: string;
  duration: number;
  url: string;
  location: string | null;
  organizer: {
    id: string;
    email: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    is_organizer: boolean;
    phone_number: string | null;
    time_zone: string | null;
  };
  scheduler?: {
    id: string;
    email: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    is_organizer: boolean;
    phone_number: string | null;
    time_zone: string | null;
  };
  attendees: Array<{
    id: string;
    email: string;
    display_name: string;
    first_name: string | null;
    last_name: string | null;
    is_organizer: boolean;
    phone_number: string | null;
    time_zone: string | null;
    fields?: Array<{ id: string; label: string; value: string | null }>;
  }>;
  link?: {
    id: string;
    slug: string;
    name: string | null;
  };
  scope?: {
    id: string;
    name: string;
    slug: string;
  };
  metadata?: Record<string, unknown>;
  conferencing?: {
    type: string | null;
    join_url: string | null;
  };
}

interface SavvyCalAPIResponse {
  entries: SavvyCalEvent[];
  metadata: {
    after: string | null;
    before: string | null;
    limit: number;
  };
}

async function fetchSavvyCalEvents(sinceDate: Date): Promise<SavvyCalEvent[]> {
  const allEvents: SavvyCalEvent[] = [];
  let cursor: string | null = null;
  let page = 0;
  const maxPages = 10; // Safety limit

  // Format date for API (events with start_at >= sinceDate)
  const sinceISO = sinceDate.toISOString();

  while (page < maxPages) {
    const params = new URLSearchParams({
      limit: "50",
      // Fetch events starting from sinceDate onwards
      "start_at[gte]": sinceISO,
    });

    if (cursor) {
      params.set("after", cursor);
    }

    const url = `https://api.savvycal.com/v1/events?${params}`;
    console.log(`[SavvyCal] Fetching page ${page + 1}: ${url}`);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SAVVYCAL_API_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`SavvyCal API error: ${response.status} - ${text}`);
    }

    const data: SavvyCalAPIResponse = await response.json();
    allEvents.push(...data.entries);

    console.log(`[SavvyCal] Page ${page + 1}: ${data.entries.length} events`);

    // Check for more pages
    if (data.metadata.after) {
      cursor = data.metadata.after;
      page++;
    } else {
      break;
    }
  }

  return allEvents;
}

async function getExistingEventIds(
  supabase: ReturnType<typeof createClient>,
  eventIds: string[]
): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();

  const { data, error } = await supabase
    .from("leads")
    .select("external_id")
    .in("external_id", eventIds);

  if (error) {
    console.error("[DB] Error checking existing events:", error);
    return new Set();
  }

  return new Set(data?.map((row) => row.external_id) || []);
}

function eventToWebhookPayload(event: SavvyCalEvent) {
  return {
    event: "event.confirmed",
    payload: {
      id: event.id,
      state: event.state,
      summary: event.summary,
      description: event.description,
      start_at: event.start_at,
      end_at: event.end_at,
      created_at: event.created_at,
      duration: event.duration,
      location: event.location,
      url: event.url,
      organizer: event.organizer,
      scheduler: event.scheduler,
      attendees: event.attendees,
      link: event.link,
      scope: event.scope,
      metadata: event.metadata,
      conferencing: event.conferencing,
    },
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate environment
    if (!SAVVYCAL_API_TOKEN) {
      throw new Error("SAVVYCAL_API_TOKEN not configured");
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials not configured");
    }

    // Parse parameters
    const url = new URL(req.url);
    const sinceHours = parseInt(url.searchParams.get("since_hours") || "24", 10);
    const dryRun = url.searchParams.get("dry_run") === "true";

    const sinceDate = new Date();
    sinceDate.setHours(sinceDate.getHours() - sinceHours);

    console.log(`[Sync] Starting sync for events since ${sinceDate.toISOString()}`);
    console.log(`[Sync] Dry run: ${dryRun}`);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch events from SavvyCal
    const events = await fetchSavvyCalEvents(sinceDate);
    console.log(`[Sync] Fetched ${events.length} events from SavvyCal`);

    // Filter to only confirmed events
    const confirmedEvents = events.filter((e) => e.state === "confirmed");
    console.log(`[Sync] ${confirmedEvents.length} confirmed events`);

    if (confirmedEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No confirmed events found",
          stats: { fetched: events.length, confirmed: 0, new: 0, synced: 0 },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which events already exist
    const eventIds = confirmedEvents.map((e) => e.id);
    const existingIds = await getExistingEventIds(supabase, eventIds);
    console.log(`[Sync] ${existingIds.size} events already in database`);

    // Filter to new events only
    const newEvents = confirmedEvents.filter((e) => !existingIds.has(e.id));
    console.log(`[Sync] ${newEvents.length} new events to sync`);

    if (newEvents.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "All events already synced",
          stats: {
            fetched: events.length,
            confirmed: confirmedEvents.length,
            existing: existingIds.size,
            new: 0,
            synced: 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If dry run, just report what would be synced
    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          message: `Dry run: ${newEvents.length} events would be synced`,
          dry_run: true,
          events: newEvents.map((e) => ({
            id: e.id,
            email: e.scheduler?.email || e.attendees.find((a) => !a.is_organizer)?.email,
            name: e.scheduler?.display_name || e.attendees.find((a) => !a.is_organizer)?.display_name,
            created_at: e.created_at,
            start_at: e.start_at,
          })),
          stats: {
            fetched: events.length,
            confirmed: confirmedEvents.length,
            existing: existingIds.size,
            new: newEvents.length,
            synced: 0,
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sync new events by calling the webhook handler
    const webhookUrl = `${SUPABASE_URL}/functions/v1/savvycal-leads-webhook`;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const event of newEvents) {
      const payload = eventToWebhookPayload(event);

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify(payload),
        });

        const text = await response.text();

        if (response.ok) {
          results.push({ id: event.id, success: true });
          console.log(`[Sync] ✅ Synced event ${event.id}`);
        } else {
          results.push({ id: event.id, success: false, error: text });
          console.error(`[Sync] ❌ Failed to sync event ${event.id}: ${text}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        results.push({ id: event.id, success: false, error: errorMsg });
        console.error(`[Sync] ❌ Error syncing event ${event.id}: ${errorMsg}`);
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    const syncedCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${syncedCount}/${newEvents.length} events`,
        stats: {
          fetched: events.length,
          confirmed: confirmedEvents.length,
          existing: existingIds.size,
          new: newEvents.length,
          synced: syncedCount,
          failed: failedCount,
        },
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Sync] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
