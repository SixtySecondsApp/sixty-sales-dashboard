// supabase/functions/create-checkout-session/index.ts
// Creates a Stripe Checkout Session for subscription purchase

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getStripeClient, getOrCreateStripeCustomer, getSiteUrl } from "../_shared/stripe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface CheckoutRequest {
  org_id: string;
  plan_id: string;
  billing_cycle?: "monthly" | "yearly";
  success_url?: string;
  cancel_url?: string;
}

interface CheckoutResponse {
  url: string;
  session_id: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get user from auth token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body: CheckoutRequest = await req.json();
    const { org_id, plan_id, billing_cycle = "monthly", success_url, cancel_url } = body;

    if (!org_id || !plan_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: org_id, plan_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has permission to manage this org's billing (owner or admin)
    const { data: membership, error: membershipError } = await supabase
      .from("organization_memberships")
      .select("role")
      .eq("org_id", org_id)
      .eq("user_id", user.id)
      .single();

    if (membershipError || !membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(
        JSON.stringify({ error: "You do not have permission to manage billing for this organization" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the plan details
    const { data: plan, error: planError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", plan_id)
      .eq("is_active", true)
      .single();

    if (planError || !plan) {
      return new Response(
        JSON.stringify({ error: "Plan not found or inactive" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the Stripe price ID based on billing cycle
    const priceId = billing_cycle === "yearly"
      ? plan.stripe_price_id_yearly
      : plan.stripe_price_id_monthly;

    if (!priceId) {
      return new Response(
        JSON.stringify({ error: "No Stripe price configured for this plan" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get organization details
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .select("id, name")
      .eq("id", org_id)
      .single();

    if (orgError || !org) {
      return new Response(
        JSON.stringify({ error: "Organization not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check for existing subscription
    const { data: existingSub } = await supabase
      .from("organization_subscriptions")
      .select("stripe_customer_id")
      .eq("org_id", org_id)
      .single();

    // Initialize Stripe
    const stripe = getStripeClient();

    // Get or create Stripe customer
    const customer = await getOrCreateStripeCustomer(
      stripe,
      org_id,
      user.email ?? "",
      org.name,
      existingSub?.stripe_customer_id
    );

    // Build checkout session options
    const siteUrl = getSiteUrl();
    const checkoutOptions: Parameters<typeof stripe.checkout.sessions.create>[0] = {
      customer: customer.id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: success_url || `${siteUrl}/team/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${siteUrl}/team/billing/cancel`,
      subscription_data: {
        trial_period_days: plan.trial_days ?? 14,
        metadata: {
          org_id,
          plan_id,
          plan_slug: plan.slug,
        },
      },
      metadata: {
        org_id,
        plan_id,
        plan_slug: plan.slug,
        user_id: user.id,
      },
      // No card required during trial
      payment_method_collection: "if_required",
      // Allow customer to enter promo codes
      allow_promotion_codes: true,
      // Customer email for receipts
      customer_email: customer.email ?? user.email ?? undefined,
      // Billing address collection
      billing_address_collection: "required",
    };

    // Create checkout session
    const session = await stripe.checkout.sessions.create(checkoutOptions);

    if (!session.url) {
      throw new Error("Failed to create checkout session URL");
    }

    // Update or create subscription record to link with Stripe customer
    const { error: upsertError } = await supabase
      .from("organization_subscriptions")
      .upsert(
        {
          org_id,
          plan_id,
          stripe_customer_id: customer.id,
          status: "trialing",
          billing_cycle,
          trial_ends_at: new Date(Date.now() + (plan.trial_days ?? 14) * 24 * 60 * 60 * 1000).toISOString(),
          trial_start_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "org_id" }
      );

    if (upsertError) {
      console.error("Error creating/updating subscription record:", upsertError);
      // Don't fail - the checkout can still proceed
    }

    const response: CheckoutResponse = {
      url: session.url,
      session_id: session.id,
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error creating checkout session:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
