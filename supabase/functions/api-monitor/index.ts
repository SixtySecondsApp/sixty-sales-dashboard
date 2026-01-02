/**
 * api-monitor - API Monitoring and Analysis
 *
 * Fetches and aggregates Supabase REST API logs, identifies errors, bursts, and generates AI review prompts.
 * Platform admin only.
 *
 * Endpoints:
 * - GET /api-monitor?from=...&to=... - Get aggregated metrics for time range
 * - POST /api-monitor/snapshot - Create a snapshot (writes to api_monitor_snapshots)
 * - GET /api-monitor/improvements - List improvements with deltas
 * - POST /api-monitor/improvements - Create/update improvement record
 * - GET /api-monitor/ai-review?from=...&to=... - Generate AI review JSON prompt
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { getAuthContext } from "../_shared/edgeAuth.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SUPABASE_ACCESS_TOKEN = Deno.env.get("SUPABASE_ACCESS_TOKEN") ?? ""; // Management API token (optional)

interface ApiSnapshot {
  snapshot_time: string;
  time_bucket_start: string;
  time_bucket_end: string;
  bucket_type: "5m" | "1h" | "1d";
  total_requests: number;
  total_errors: number;
  error_rate: number;
  top_endpoints: Array<{
    endpoint: string;
    method: string;
    count: number;
    errors: number;
  }>;
  top_errors: Array<{
    status: number;
    endpoint: string;
    count: number;
    sample_message?: string;
  }>;
  top_callers: Array<{
    ip?: string;
    user_agent?: string;
    count: number;
  }>;
  suspected_bursts: Array<{
    endpoint: string;
    requests_per_minute: number;
    time_window: string;
  }>;
}

/**
 * Redact sensitive values from headers/query strings
 */
function redactSensitive(data: any): any {
  if (typeof data !== "object" || data === null) return data;
  if (Array.isArray(data)) return data.map(redactSensitive);

  const sensitiveKeys = ["authorization", "apikey", "api_key", "token", "password", "secret"];
  const redacted: any = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sk) => lowerKey.includes(sk))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      redacted[key] = redactSensitive(value);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Fetch Supabase logs via Management API (if available)
 * Falls back to aggregating from audit_logs if Management API is not configured
 */
async function fetchSupabaseLogs(
  from: Date,
  to: Date,
  supabase: ReturnType<typeof createClient>
): Promise<ApiSnapshot> {
  // Try Management API first (requires SUPABASE_ACCESS_TOKEN)
  if (SUPABASE_ACCESS_TOKEN) {
    try {
      const projectRef = SUPABASE_URL.split("//")[1]?.split(".")[0];
      if (projectRef) {
        // Note: Supabase Management API endpoint for logs
        // This is a placeholder - actual endpoint may vary
        const logsUrl = `https://api.supabase.com/v1/projects/${projectRef}/logs?from=${from.toISOString()}&to=${to.toISOString()}`;
        
        const response = await fetch(logsUrl, {
          headers: {
            Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const logs = await response.json();
          return aggregateLogs(logs, from, to);
        }
      }
    } catch (error) {
      console.warn("[api-monitor] Management API fetch failed, falling back to audit_logs:", error);
    }
  }

  // Fallback: Aggregate from audit_logs (has request metadata)
  return aggregateFromAuditLogs(from, to, supabase);
}

/**
 * Aggregate logs into snapshot format
 */
function aggregateLogs(logs: any[], from: Date, to: Date): ApiSnapshot {
  const endpointCounts: Map<string, { method: string; count: number; errors: number }> = new Map();
  const errorCounts: Map<string, { status: number; count: number; sample?: string }> = new Map();
  const callerCounts: Map<string, number> = new Map();
  const timeSeries: Map<number, number> = new Map(); // timestamp -> request count

  let totalRequests = 0;
  let totalErrors = 0;

  for (const log of logs) {
    const endpoint = log.path || log.endpoint || "unknown";
    const method = log.method || "GET";
    const status = log.status_code || log.status || 200;
    const ip = log.ip || log.client_ip;
    const userAgent = log.user_agent || log.agent;
    const timestamp = new Date(log.timestamp || log.created_at).getTime();

    const key = `${method} ${endpoint}`;
    const existing = endpointCounts.get(key) || { method, count: 0, errors: 0 };
    existing.count++;
    if (status >= 400) existing.errors++;
    endpointCounts.set(key, existing);

    totalRequests++;
    if (status >= 400) {
      totalErrors++;
      const errorKey = `${status}:${endpoint}`;
      const errorExisting = errorCounts.get(errorKey) || { status, count: 0 };
      errorExisting.count++;
      if (!errorExisting.sample && log.error_message) {
        errorExisting.sample = log.error_message.substring(0, 200);
      }
      errorCounts.set(errorKey, errorExisting);
    }

    if (ip || userAgent) {
      const callerKey = `${ip || "unknown"}:${userAgent || "unknown"}`;
      callerCounts.set(callerKey, (callerCounts.get(callerKey) || 0) + 1);
    }

    // Track time series for burst detection
    const minuteBucket = Math.floor(timestamp / 60000) * 60000;
    timeSeries.set(minuteBucket, (timeSeries.get(minuteBucket) || 0) + 1);
  }

  // Build top endpoints
  const topEndpoints = Array.from(endpointCounts.entries())
    .map(([key, data]) => ({
      endpoint: key.split(" ")[1],
      method: data.method,
      count: data.count,
      errors: data.errors,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // Build top errors
  const topErrors = Array.from(errorCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((e) => ({
      status: e.status,
      endpoint: e.sample?.split(":")[1] || "unknown",
      count: e.count,
      sample_message: e.sample,
    }));

  // Build top callers
  const topCallers = Array.from(callerCounts.entries())
    .map(([key, count]) => {
      const [ip, userAgent] = key.split(":");
      return { ip: ip !== "unknown" ? ip : undefined, user_agent: userAgent !== "unknown" ? userAgent : undefined, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Detect bursts (requests_per_minute > 60)
  const suspectedBursts: ApiSnapshot["suspected_bursts"] = [];
  for (const [timestamp, count] of timeSeries.entries()) {
    if (count > 60) {
      const endpoint = topEndpoints[0]?.endpoint || "unknown";
      suspectedBursts.push({
        endpoint,
        requests_per_minute: count,
        time_window: new Date(timestamp).toISOString(),
      });
    }
  }

  const durationMs = to.getTime() - from.getTime();
  const durationMinutes = durationMs / 60000;
  const bucketType: "5m" | "1h" | "1d" = durationMinutes <= 5 ? "5m" : durationMinutes <= 60 ? "1h" : "1d";

  return {
    snapshot_time: new Date().toISOString(),
    time_bucket_start: from.toISOString(),
    time_bucket_end: to.toISOString(),
    bucket_type: bucketType,
    total_requests: totalRequests,
    total_errors: totalErrors,
    error_rate: totalRequests > 0 ? Number(((totalErrors / totalRequests) * 100).toFixed(2)) : 0,
    top_endpoints: topEndpoints,
    top_errors: topErrors,
    top_callers: topCallers,
    suspected_bursts: suspectedBursts,
  };
}

/**
 * Aggregate from audit_logs table (fallback when Management API unavailable)
 */
async function aggregateFromAuditLogs(
  from: Date,
  to: Date,
  supabase: ReturnType<typeof createClient>
): Promise<ApiSnapshot> {
  // Query audit_logs for request metadata
  const { data: auditLogs, error } = await supabase
    .from("audit_logs")
    .select("request_method, request_endpoint, response_status, request_duration, changed_at")
    .gte("changed_at", from.toISOString())
    .lte("changed_at", to.toISOString())
    .not("request_endpoint", "is", null)
    .limit(10000); // Reasonable limit

  if (error) {
    console.error("[api-monitor] Error fetching audit_logs:", error);
    throw error;
  }

  // Convert to log format
  const logs = (auditLogs || []).map((log) => ({
    path: log.request_endpoint,
    method: log.request_method || "GET",
    status_code: log.response_status || 200,
    timestamp: log.changed_at,
  }));

  return aggregateLogs(logs, from, to);
}

/**
 * Generate AI review JSON prompt
 */
function generateAIReview(snapshot: ApiSnapshot, from: Date, to: Date): any {
  const hypotheses: string[] = [];
  const recommendations: string[] = [];
  const codePointers: string[] = [];

  // Analyze errors
  if (snapshot.error_rate > 5) {
    hypotheses.push(`High error rate (${snapshot.error_rate}%) suggests client-side validation issues or retry loops`);
    recommendations.push("Review error patterns and add client-side validation to prevent invalid requests");
  }

  // Analyze bursts
  if (snapshot.suspected_bursts.length > 0) {
    hypotheses.push(`${snapshot.suspected_bursts.length} burst(s) detected - possible polling loops or missing caching`);
    recommendations.push("Implement request deduplication and caching for frequently accessed endpoints");
    codePointers.push("src/lib/services/*.ts - Check for polling intervals");
    codePointers.push("src/lib/hooks/use*.ts - Check for useEffect dependencies causing re-fetches");
  }

  // Analyze top endpoints
  const topEndpoint = snapshot.top_endpoints[0];
  if (topEndpoint && topEndpoint.count > snapshot.total_requests * 0.3) {
    hypotheses.push(`Single endpoint accounts for ${Math.round((topEndpoint.count / snapshot.total_requests) * 100)}% of requests - optimization opportunity`);
    recommendations.push(`Consider caching or batching requests to ${topEndpoint.endpoint}`);
  }

  return {
    timeframe: {
      from: from.toISOString(),
      to: to.toISOString(),
      duration_hours: (to.getTime() - from.getTime()) / (1000 * 60 * 60),
    },
    totals: {
      total_requests: snapshot.total_requests,
      total_errors: snapshot.total_errors,
      error_rate: snapshot.error_rate,
    },
    top_endpoints: snapshot.top_endpoints.slice(0, 10),
    top_errors: snapshot.top_errors.slice(0, 10),
    suspected_sources: {
      browser: snapshot.top_callers.filter((c) => c.user_agent?.includes("Mozilla")).length,
      edge_functions: snapshot.top_callers.filter((c) => c.user_agent?.includes("Deno")).length,
      cron: snapshot.top_callers.filter((c) => !c.user_agent).length,
    },
    hypotheses,
    recommended_next_changes: recommendations,
    code_pointers: codePointers,
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1] || "api-monitor";

    // Verify platform admin access
    const authHeader = req.headers.get("Authorization");
    const authContext = await getAuthContext(req, supabase, SUPABASE_SERVICE_ROLE_KEY);

    if (!authContext.isPlatformAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: Platform admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse time range (default: last 24 hours)
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const from = fromParam ? new Date(fromParam) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = toParam ? new Date(toParam) : new Date();

    // Route handling
    switch (action) {
      case "api-monitor": {
        // GET - Get aggregated metrics
        if (req.method === "GET") {
          const snapshot = await fetchSupabaseLogs(from, to, supabase);
          return new Response(
            JSON.stringify({ success: true, snapshot }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      case "snapshot": {
        // POST - Create and save snapshot
        if (req.method === "POST") {
          const snapshot = await fetchSupabaseLogs(from, to, supabase);
          
          const { data, error } = await supabase
            .from("api_monitor_snapshots")
            .insert({
              snapshot_time: snapshot.snapshot_time,
              time_bucket_start: snapshot.time_bucket_start,
              time_bucket_end: snapshot.time_bucket_end,
              bucket_type: snapshot.bucket_type,
              total_requests: snapshot.total_requests,
              total_errors: snapshot.total_errors,
              error_rate: snapshot.error_rate,
              top_endpoints: snapshot.top_endpoints,
              top_errors: snapshot.top_errors,
              top_callers: snapshot.top_callers,
              suspected_bursts: snapshot.suspected_bursts,
              source: "supabase_logs",
            })
            .select()
            .single();

          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, snapshot: data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      case "improvements": {
        // GET - List improvements
        if (req.method === "GET") {
          const { data, error } = await supabase
            .from("api_monitor_improvements")
            .select("*")
            .order("shipped_at", { ascending: false })
            .limit(50);

          if (error) throw error;

          // Compute actual deltas for each
          const improvementsWithDeltas = await Promise.all(
            (data || []).map(async (imp) => {
              try {
                const { data: deltas } = await supabase.rpc("compute_improvement_deltas", {
                  p_improvement_id: imp.id,
                });
                if (deltas && deltas.length > 0) {
                  return {
                    ...imp,
                    actual_delta_requests_per_day: deltas[0].actual_delta_requests_per_day,
                    actual_delta_error_rate: deltas[0].actual_delta_error_rate,
                    actual_delta_requests_per_user_per_day: deltas[0].actual_delta_requests_per_user_per_day,
                  };
                }
              } catch (err) {
                console.warn(`[api-monitor] Failed to compute deltas for improvement ${imp.id}:`, err);
              }
              return imp;
            })
          );

          return new Response(
            JSON.stringify({ success: true, improvements: improvementsWithDeltas }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // POST - Create/update improvement
        if (req.method === "POST") {
          const body = await req.json();
          const {
            id,
            title,
            description,
            shipped_at,
            expected_delta_requests_per_day,
            expected_delta_error_rate,
            code_changes,
            before_window_start,
            before_window_end,
            after_window_start,
            after_window_end,
          } = body;

          if (!title || !description) {
            return new Response(
              JSON.stringify({ error: "title and description are required" }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const improvementData: any = {
            title,
            description,
            shipped_at: shipped_at || new Date().toISOString(),
            expected_delta_requests_per_day,
            expected_delta_error_rate,
            code_changes: code_changes || [],
            before_window_start,
            before_window_end,
            after_window_start,
            after_window_end,
            updated_at: new Date().toISOString(),
          };

          let data, error;
          if (id) {
            // Update
            ({ data, error } = await supabase
              .from("api_monitor_improvements")
              .update(improvementData)
              .eq("id", id)
              .select()
              .single());
          } else {
            // Insert
            ({ data, error } = await supabase
              .from("api_monitor_improvements")
              .insert(improvementData)
              .select()
              .single());
          }

          if (error) throw error;

          return new Response(
            JSON.stringify({ success: true, improvement: data }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      case "ai-review": {
        // GET - Generate AI review JSON
        if (req.method === "GET") {
          const snapshot = await fetchSupabaseLogs(from, to, supabase);
          const review = generateAIReview(snapshot, from, to);
          
          return new Response(
            JSON.stringify({ success: true, review }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[api-monitor] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
