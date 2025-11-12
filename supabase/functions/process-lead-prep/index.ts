import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration for process-lead-prep function");
}

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

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: leads, error } = await supabase
      .from("leads")
      .select(`
        id,
        contact_name,
        contact_first_name,
        contact_last_name,
        contact_email,
        company_id,
        owner_id,
        domain,
        meeting_title,
        meeting_start,
        meeting_description,
        enrichment_status,
        prep_status,
        prep_summary,
        metadata,
        created_at
      `)
      .in("prep_status", ["pending", "in_progress"])
      .order("created_at", { ascending: true })
      .limit(25);

    if (error) {
      throw error;
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "No leads requiring prep" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let processed = 0;
    const now = new Date().toISOString();

    for (const lead of leads) {
      try {
        const summary = buildPrepSummary(lead);
        const prepNotes = buildPrepNotes(lead, summary);

        // Remove previous auto-generated notes to avoid duplicates
        await supabase
          .from("lead_prep_notes")
          .delete()
          .eq("lead_id", lead.id)
          .eq("is_auto_generated", true);

        if (prepNotes.length > 0) {
          await supabase
            .from("lead_prep_notes")
            .insert(
              prepNotes.map((note, index) => ({
                ...note,
                lead_id: lead.id,
                created_at: now,
                updated_at: now,
                sort_order: index,
              })),
            );
        }

        await supabase
          .from("leads")
          .update({
            enrichment_status: "completed",
            prep_status: "completed",
            prep_summary: summary.overview,
            metadata: {
              ...(lead.metadata ?? {}),
              prep_generated_at: now,
            },
            updated_at: now,
          })
          .eq("id", lead.id);

        processed += 1;
      } catch (leadError) {
        console.error("Failed to process lead prep", {
          leadId: lead.id,
          error: leadError,
        });

        await supabase
          .from("leads")
          .update({
            prep_status: "failed",
            updated_at: now,
          })
          .eq("id", lead.id);
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("process-lead-prep error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

function buildPrepSummary(lead: any) {
  const contact = lead.contact_name ||
    [lead.contact_first_name, lead.contact_last_name].filter(Boolean).join(" ") ||
    lead.contact_email;

  const company = lead.domain ? lead.domain.replace(/^www\./, "") : "the prospect";
  const meetingWhen = lead.meeting_start
    ? new Date(lead.meeting_start).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    })
    : "TBD";

  const overview = `Prep ready for ${contact} (${company}). Meeting scheduled ${meetingWhen}.`;

  return {
    overview,
    company,
    contact,
    meetingWhen,
    meetingTitle: lead.meeting_title ?? "Discovery Call",
  };
}

function buildPrepNotes(lead: any, summary: ReturnType<typeof buildPrepSummary>) {
  const baseNotes = [
    {
      note_type: "summary",
      title: "Lead Overview",
      body: `${summary.contact} booked via SavvyCal for "${summary.meetingTitle}". Confirm goals and current tooling.`,
      created_by: lead.owner_id,
      is_auto_generated: true,
      is_pinned: true,
      metadata: {
        type: "overview",
        generated_from: "process-lead-prep",
      },
    },
    {
      note_type: "question",
      title: "Discovery Questions",
      body: [
        `• What triggered ${summary.company} to explore solutions now?`,
        `• Which metrics will define success for this initiative?`,
        "• Who else joins the decision process after this call?",
      ].join("\n"),
      created_by: lead.owner_id,
      is_auto_generated: true,
      is_pinned: false,
      metadata: {
        type: "discovery_questions",
      },
    },
  ];

  if (lead.domain) {
    baseNotes.push({
      note_type: "insight",
      title: "Company Research Focus",
      body: `Review ${lead.domain} for recent announcements, headcount changes, and product positioning. Align demo narrative to their messaging.`,
      created_by: lead.owner_id,
      is_auto_generated: true,
      is_pinned: false,
      metadata: {
        type: "company_research",
      },
    });
  }

  baseNotes.push({
    note_type: "task",
    title: "Prep Checklist",
    body: [
      "☑️ Confirm agenda and stakeholders 24h before call.",
      "☑️ Prepare relevant case studies from similar industries.",
      "☑️ Draft follow-up email template tailored to their needs.",
    ].join("\n"),
    created_by: lead.owner_id,
    is_auto_generated: true,
    is_pinned: false,
    metadata: {
      type: "prep_checklist",
    },
  });

  return baseNotes;
}

