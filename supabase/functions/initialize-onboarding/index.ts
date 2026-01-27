import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { userId, email } = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing userId or email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Determine starting step based on email domain
    const domain = email.split("@")[1]?.toLowerCase() || "";
    const personalDomains = [
      "gmail.com",
      "yahoo.com",
      "hotmail.com",
      "outlook.com",
      "icloud.com",
      "aol.com",
      "protonmail.com",
      "proton.me",
      "mail.com",
      "ymail.com",
      "live.com",
      "msn.com",
      "me.com",
      "mac.com",
    ];

    const isPersonalEmail = personalDomains.includes(domain);
    const initialStep = isPersonalEmail ? "website_input" : "enrichment_loading";

    // Insert onboarding progress using service role
    const { data, error } = await supabaseAdmin
      .from("user_onboarding_progress")
      .upsert(
        {
          user_id: userId,
          onboarding_step: initialStep,
          onboarding_completed_at: null,
          skipped_onboarding: false,
        },
        {
          onConflict: "user_id",
        }
      )
      .select();

    if (error) {
      console.error("[initialize-onboarding] Error:", error);
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        onboarding_step: initialStep,
        message: "Onboarding progress initialized",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[initialize-onboarding] Exception:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};
