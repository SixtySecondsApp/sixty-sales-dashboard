import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing Supabase configuration for reset-lead-prep function");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const body = await req.json().catch(() => ({}));
    const leadId = body?.lead_id as string | undefined;

    // Build filters
    const noteFilter = leadId ? (q: any) => q.eq("lead_id", leadId) : (q: any) => q;
    const leadFilter = leadId ? (q: any) => q.eq("id", leadId) : (q: any) => q;

    // Delete auto-generated prep notes
    const { error: delErr } = await noteFilter(
      supabase.from("lead_prep_notes").delete().eq("is_auto_generated", true),
    );
    if (delErr) throw delErr;

    // Reset leads to pending for reprocessing
    const { data: updated, error: updErr } = await leadFilter(
      supabase.from("leads").update({
        prep_status: "pending",
        enrichment_status: "pending",
        prep_summary: null,
        updated_at: new Date().toISOString(),
      }).select("id"),
    );
    if (updErr) throw updErr;

    return new Response(
      JSON.stringify({ success: true, reset_count: updated?.length ?? 0, lead_id: leadId ?? null }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("reset-lead-prep error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
