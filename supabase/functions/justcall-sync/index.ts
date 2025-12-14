import { serve } from 'https://deno.land/std@0.190.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { legacyCorsHeaders as corsHeaders } from '../_shared/corsHelper.ts';
import { getJustCallAuthHeaders } from '../_shared/justcall.ts';
import { requireOrgRole, getUserOrgId } from '../_shared/edgeAuth.ts';

type SyncType = 'manual' | 'incremental' | 'webhook' | 'all_time';

type SyncRequest = {
  sync_type?: SyncType;
  org_id?: string;
  limit?: number;
  max_pages?: number;
  process_transcript_queue?: boolean;
};

function parseListResponse(json: any): { items: any[]; next: string | null } {
  const items: any[] =
    (Array.isArray(json?.data) && json.data) ||
    (Array.isArray(json?.calls) && json.calls) ||
    (Array.isArray(json?.items) && json.items) ||
    (Array.isArray(json) && json) ||
    [];

  const next =
    (typeof json?.next_page_link === 'string' && json.next_page_link) ||
    (typeof json?.next === 'string' && json.next) ||
    (typeof json?.links?.next === 'string' && json.links.next) ||
    null;

  return { items, next };
}

function toIsoOrNull(v: any): string | null {
  if (v == null) return null;
  const d = new Date(v);
  const t = d.getTime();
  if (!Number.isFinite(t)) return null;
  return d.toISOString();
}

function mapCall(call: any): {
  external_id: string;
  direction: 'inbound' | 'outbound' | 'internal' | 'unknown';
  status: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  from_number: string | null;
  to_number: string | null;
  agent_email: string | null;
  justcall_agent_id: string | null;
  recording_url: string | null;
  recording_mime: string | null;
} {
  const external_id = String(call?.id ?? call?.call_id ?? call?.sid ?? call?.uuid);
  const rawDir = String(call?.direction ?? call?.call_direction ?? '').toLowerCase();
  const direction =
    rawDir.includes('in') ? 'inbound' : rawDir.includes('out') ? 'outbound' : rawDir.includes('internal') ? 'internal' : 'unknown';

  const durationSecondsRaw = call?.duration ?? call?.duration_seconds ?? null;
  const duration_seconds =
    durationSecondsRaw == null ? null : Number.isFinite(Number(durationSecondsRaw)) ? Math.max(0, Math.floor(Number(durationSecondsRaw))) : null;

  const recording_url = call?.recording_url ?? call?.recording ?? call?.recording_link ?? null;

  return {
    external_id,
    direction,
    status: call?.status ? String(call.status) : null,
    started_at: toIsoOrNull(call?.start_time ?? call?.started_at ?? call?.startedAt),
    ended_at: toIsoOrNull(call?.end_time ?? call?.ended_at ?? call?.endedAt),
    duration_seconds,
    from_number: call?.from ? String(call.from) : call?.from_number ? String(call.from_number) : null,
    to_number: call?.to ? String(call.to) : call?.to_number ? String(call.to_number) : null,
    agent_email: call?.agent_email ? String(call.agent_email) : call?.user_email ? String(call.user_email) : null,
    justcall_agent_id: call?.agent_id ? String(call.agent_id) : null,
    recording_url: recording_url != null ? String(recording_url) : null,
    recording_mime: call?.recording_mime ? String(call.recording_mime) : null,
  };
}

async function resolveOwnerUserId(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  agentEmail: string | null
): Promise<{ owner_user_id: string | null; owner_email: string | null }> {
  if (!agentEmail) return { owner_user_id: null, owner_email: null };

  // Ensure the user belongs to the org (team-wide visibility, but ownership should map within org)
  const { data: profile } = await supabase.from('profiles').select('id, email').eq('email', agentEmail).maybeSingle();
  if (!profile?.id) return { owner_user_id: null, owner_email: agentEmail };

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('user_id')
    .eq('org_id', orgId)
    .eq('user_id', profile.id)
    .maybeSingle();

  if (!membership?.user_id) return { owner_user_id: null, owner_email: agentEmail };
  return { owner_user_id: profile.id, owner_email: profile.email || agentEmail };
}

async function ensureCommunicationEvent(
  supabase: ReturnType<typeof createClient>,
  args: {
    userId: string;
    orgId: string;
    callExternalId: string;
    direction: 'inbound' | 'outbound' | 'unknown' | 'internal';
    whenIso: string | null;
    fromNumber: string | null;
    toNumber: string | null;
    durationSeconds: number | null;
    hasRecording: boolean;
  }
): Promise<void> {
  const eventType = args.direction === 'inbound' ? 'call_received' : 'call_made';
  const direction = args.direction === 'inbound' ? 'inbound' : 'outbound';

  // Dedupe: if we already logged this external call for this user, skip
  const { data: existing } = await supabase
    .from('communication_events')
    .select('id')
    .eq('user_id', args.userId)
    .eq('external_id', args.callExternalId)
    .eq('external_source', 'justcall')
    .limit(1)
    .maybeSingle();

  if (existing?.id) return;

  await supabase.from('communication_events').insert({
    user_id: args.userId,
    event_type: eventType,
    direction,
    subject: null,
    body: null,
    snippet: null,
    external_id: args.callExternalId,
    external_source: 'justcall',
    metadata: {
      org_id: args.orgId,
      from_number: args.fromNumber,
      to_number: args.toNumber,
      duration_seconds: args.durationSeconds,
      has_recording: args.hasRecording,
    },
    event_timestamp: args.whenIso || new Date().toISOString(),
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const allowServiceRole = serviceKey && authHeader.trim() === `Bearer ${serviceKey}`;

    let userId: string | null = null;
    const body: SyncRequest = await req.json().catch(() => ({} as any));

    if (!allowServiceRole) {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const { data: userData, error: userErr } = await sb.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      userId = userData.user.id;
    }

    // Resolve org
    let orgId: string | null = typeof body.org_id === 'string' ? body.org_id : null;
    if (!orgId && userId) {
      orgId = await getUserOrgId(sb, userId);
    }
    if (!orgId) {
      return new Response(JSON.stringify({ error: 'Missing org_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Only org admins can run sync from the client
    if (userId) {
      await requireOrgRole(sb, orgId, userId, ['owner', 'admin']);
    }

    const syncType: SyncType = body.sync_type || 'manual';
    const limit = Math.min(Math.max(Number(body.limit ?? 200), 1), 2000);
    const maxPages = Math.min(Math.max(Number(body.max_pages ?? 10), 1), 50);
    const processTranscriptQueue = body.process_transcript_queue !== false;

    // Ensure active integration exists
    const { data: integration } = await sb
      .from('justcall_integrations')
      .select('id, org_id, auth_type, is_active, connected_by_user_id')
      .eq('org_id', orgId)
      .eq('is_active', true)
      .maybeSingle();

    if (!integration) {
      return new Response(JSON.stringify({ error: 'JustCall integration not connected for this org' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch calls from JustCall
    const headers = await getJustCallAuthHeaders(sb, orgId);

    const apiBase = (Deno.env.get('JUSTCALL_API_BASE_URL') || 'https://api.justcall.io').replace(/\/$/, '');
    let pageUrl: string | null = `${apiBase}/v2.1/calls?per_page=100&page=1`;

    const calls: any[] = [];
    let pages = 0;

    while (pageUrl && pages < maxPages && calls.length < limit) {
      pages++;
      const resp = await fetch(pageUrl, { headers });
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`JustCall calls fetch failed (${resp.status}): ${txt}`);
      }
      const json = await resp.json().catch(() => ({} as any));
      const { items, next } = parseListResponse(json);
      for (const item of items) {
        calls.push(item);
        if (calls.length >= limit) break;
      }
      pageUrl = next;
    }

    let callsUpserted = 0;
    let eventsLogged = 0;
    let transcriptsQueued = 0;

    for (const c of calls) {
      const mapped = mapCall(c);
      if (!mapped.external_id || mapped.external_id === 'undefined') continue;

      const owner = await resolveOwnerUserId(sb, orgId, mapped.agent_email);
      const hasRecording = Boolean(mapped.recording_url);

      const { data: callRow, error: upsertErr } = await sb
        .from('calls')
        .upsert(
          {
            org_id: orgId,
            provider: 'justcall',
            external_id: mapped.external_id,
            direction: mapped.direction,
            status: mapped.status,
            started_at: mapped.started_at,
            ended_at: mapped.ended_at,
            duration_seconds: mapped.duration_seconds,
            from_number: mapped.from_number,
            to_number: mapped.to_number,
            agent_email: mapped.agent_email,
            justcall_agent_id: mapped.justcall_agent_id,
            owner_user_id: owner.owner_user_id,
            owner_email: owner.owner_email,
            recording_url: mapped.recording_url,
            recording_mime: mapped.recording_mime,
            has_recording: hasRecording,
            transcript_status: hasRecording ? 'queued' : 'missing',
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'org_id,provider,external_id' }
        )
        .select('id, transcript_text')
        .single();

      if (upsertErr || !callRow) continue;
      callsUpserted++;

      // Queue transcript if missing and we have recording
      if (!callRow.transcript_text && hasRecording) {
        const { error: qErr } = await sb
          .from('call_transcript_queue')
          .upsert(
            {
              org_id: orgId,
              call_id: callRow.id,
              priority: 0,
              attempts: 0,
              error_message: null,
              last_attempt_at: null,
            },
            { onConflict: 'call_id' }
          );
        if (!qErr) transcriptsQueued++;
      }

      // Log comm event
      const effectiveUserId = owner.owner_user_id || integration.connected_by_user_id || userId;
      if (effectiveUserId) {
        await ensureCommunicationEvent(sb, {
          userId: effectiveUserId,
          orgId,
          callExternalId: mapped.external_id,
          direction: mapped.direction,
          whenIso: mapped.started_at,
          fromNumber: mapped.from_number,
          toNumber: mapped.to_number,
          durationSeconds: mapped.duration_seconds,
          hasRecording,
        });
        eventsLogged++;
      }
    }

    let transcriptsFetched = 0;
    let transcriptsFailed = 0;

    if (processTranscriptQueue) {
      // Process transcript queue items (best-effort, limited per run)
      const { data: queueItems } = await sb
        .from('call_transcript_queue')
        .select('id, call_id, attempts, max_attempts')
        .eq('org_id', orgId)
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(50);

      for (const qi of queueItems || []) {
        const { data: callRow } = await sb
          .from('calls')
          .select('id, external_id, transcript_text')
          .eq('id', qi.call_id)
          .maybeSingle();

        if (!callRow) continue;
        if (callRow.transcript_text && callRow.transcript_text.trim().length > 0) {
          await sb.from('call_transcript_queue').delete().eq('id', qi.id);
          continue;
        }

        if ((qi.attempts || 0) >= (qi.max_attempts || 10)) {
          transcriptsFailed++;
          continue;
        }

        try {
          const tUrl = `${apiBase}/v1/justcalliq/transcription`;
          const tResp = await fetch(tUrl, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: String(callRow.external_id), platform: 1 }),
          });

          const tText = await tResp.text();
          let tJson: any = null;
          try {
            tJson = JSON.parse(tText);
          } catch {
            tJson = { raw: tText };
          }

          if (!tResp.ok) {
            await sb
              .from('call_transcript_queue')
              .update({
                attempts: (qi.attempts || 0) + 1,
                last_attempt_at: new Date().toISOString(),
                error_message: `transcription_fetch_failed_${tResp.status}`,
              })
              .eq('id', qi.id);
            transcriptsFailed++;
            continue;
          }

          const transcriptText =
            (typeof tJson?.transcription === 'string' && tJson.transcription) ||
            (typeof tJson?.transcript === 'string' && tJson.transcript) ||
            (typeof tJson?.data?.transcription === 'string' && tJson.data.transcription) ||
            null;

          if (!transcriptText || transcriptText.trim().length < 20) {
            // Not ready yet, keep queued
            await sb
              .from('call_transcript_queue')
              .update({
                attempts: (qi.attempts || 0) + 1,
                last_attempt_at: new Date().toISOString(),
                error_message: 'transcript_not_ready',
              })
              .eq('id', qi.id);
            continue;
          }

          await sb
            .from('calls')
            .update({
              transcript_text: transcriptText,
              transcript_json: tJson,
              transcript_status: 'ready',
              transcript_fetch_attempts: (qi.attempts || 0) + 1,
              last_transcript_fetch_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', callRow.id);

          await sb.from('call_transcript_queue').delete().eq('id', qi.id);
          transcriptsFetched++;
        } catch (e) {
          await sb
            .from('call_transcript_queue')
            .update({
              attempts: (qi.attempts || 0) + 1,
              last_attempt_at: new Date().toISOString(),
              error_message: e?.message || 'transcript_fetch_error',
            })
            .eq('id', qi.id);
          transcriptsFailed++;
        }
      }
    }

    await sb
      .from('justcall_integrations')
      .update({ last_sync_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('org_id', orgId);

    return new Response(
      JSON.stringify({
        success: true,
        sync_type: syncType,
        org_id: orgId,
        pages_fetched: pages,
        calls_found: calls.length,
        calls_upserted: callsUpserted,
        communication_events_logged: eventsLogged,
        transcripts_queued: transcriptsQueued,
        transcripts_fetched: transcriptsFetched,
        transcripts_failed: transcriptsFailed,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e?.message || 'Sync failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

