import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SAVVYCAL_API_TOKEN = Deno.env.get("SAVVYCAL_API_TOKEN") ?? 
                          Deno.env.get("SAVVYCAL_SECRET_KEY") ?? "";

const JSON_HEADERS = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

interface SavvyCalLink {
  id: string;
  slug: string;
  name: string | null;
  private_name: string | null;
  description: string | null;
  url?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!SAVVYCAL_API_TOKEN) {
      return new Response(
        JSON.stringify({ 
          error: "SavvyCal API token not configured. Set SAVVYCAL_API_TOKEN environment variable." 
        }),
        { status: 500, headers: JSON_HEADERS }
      );
    }

    const { link_id } = await req.json();

    if (!link_id) {
      return new Response(
        JSON.stringify({ error: "link_id is required" }),
        { status: 400, headers: JSON_HEADERS }
      );
    }

    // Fetch link details from SavvyCal API
    const response = await fetch(`https://api.savvycal.com/v1/links/${link_id}`, {
      headers: {
        Authorization: `Bearer ${SAVVYCAL_API_TOKEN}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      
      // Handle 404 specifically - link has been deleted
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ 
            success: false,
            error: "Link not found (404)",
            deleted: true,
            message: "This link has been deleted from SavvyCal"
          }),
          { status: 200, headers: JSON_HEADERS } // Return 200 so UI can handle it gracefully
        );
      }
      
      return new Response(
        JSON.stringify({ 
          success: false,
          error: `SavvyCal API error: ${response.status} ${errorText}`,
          deleted: false
        }),
        { status: response.status, headers: JSON_HEADERS }
      );
    }

    const link: SavvyCalLink = await response.json();

    // Return link details including private_name for source matching
    return new Response(
      JSON.stringify({
        success: true,
        link: {
          id: link.id,
          slug: link.slug,
          name: link.name || link.private_name || link.slug,
          private_name: link.private_name,
          description: link.description,
          url: link.url || `https://savvycal.com/${link.slug}`,
        },
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (error: any) {
    console.error("Error fetching SavvyCal link:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Failed to fetch link details" 
      }),
      { status: 500, headers: JSON_HEADERS }
    );
  }
});





