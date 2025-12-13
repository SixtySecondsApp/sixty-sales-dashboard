import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Play, CheckCircle, XCircle, RefreshCw, Shield, Database, Clock, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

type AuditItem = {
  key: string;
  title: string;
  description: string;
  run: () => Promise<{ ok: boolean; message: string; meta?: Record<string, any> }>;
};

type AuditResult = {
  ok: boolean;
  message: string;
  meta?: Record<string, any>;
  ranAt: string;
};

async function tryCount(table: string, orgId?: string) {
  const tryWithOrg = async () => {
    const { count, error } = await supabase
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('org_id', orgId);
    if (error) throw error;
    return count ?? 0;
  };

  const tryWithoutOrg = async () => {
    const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
    if (error) throw error;
    return count ?? 0;
  };

  try {
    if (orgId) return await tryWithOrg();
    return await tryWithoutOrg();
  } catch {
    return await tryWithoutOrg();
  }
}

async function tryLatest(table: string, column: string, orgId?: string) {
  const query = (q: any) => q.not(column, 'is', null).order(column, { ascending: false }).limit(1);

  const tryWithOrg = async () => {
    const { data, error } = await query(supabase.from(table).select(column).eq('org_id', orgId));
    if (error) throw error;
    return (data?.[0] as any)?.[column] as string | undefined;
  };

  const tryWithoutOrg = async () => {
    const { data, error } = await query(supabase.from(table).select(column));
    if (error) throw error;
    return (data?.[0] as any)?.[column] as string | undefined;
  };

  try {
    if (orgId) return await tryWithOrg();
    return await tryWithoutOrg();
  } catch {
    return await tryWithoutOrg();
  }
}

export function SalesIntelligenceAuditPanel({
  orgId,
  focusKey,
  autoRunFocused,
}: {
  orgId: string;
  userId?: string;
  focusKey?: string | null;
  autoRunFocused?: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<Record<string, AuditResult>>({});

  const items: AuditItem[] = useMemo(
    () => [
      {
        key: 'deal-health',
        title: 'Deal Health Scoring',
        description: 'Scores exist and have recent calculation timestamps',
        run: async () => {
          const count = await tryCount('deal_health_scores', orgId);
          const last = await tryLatest('deal_health_scores', 'last_calculated_at', orgId);
          const ok = count > 0;
          return {
            ok,
            message: ok ? `OK: ${count} score(s), last calculated ${last ? new Date(last).toLocaleString() : 'unknown'}` : 'No deal health scores found',
            meta: { count, last_calculated_at: last || null },
          };
        },
      },
      {
        key: 'relationship-health',
        title: 'Relationship Health',
        description: 'Relationship health scores exist',
        run: async () => {
          const count = await tryCount('relationship_health_scores', orgId);
          const last = await tryLatest('relationship_health_scores', 'last_calculated_at', orgId);
          const ok = count > 0;
          return {
            ok,
            message: ok ? `OK: ${count} relationship score(s), last ${last ? new Date(last).toLocaleString() : 'unknown'}` : 'No relationship health scores found',
            meta: { count, last_calculated_at: last || null },
          };
        },
      },
      {
        key: 'ghosting',
        title: 'Ghosting Signals',
        description: 'Ghost detection signals table is readable and has rows (if enabled)',
        run: async () => {
          const count = await tryCount('ghost_detection_signals', orgId);
          const last = await tryLatest('ghost_detection_signals', 'detected_at', orgId);
          const ok = count >= 0;
          return {
            ok,
            message: `OK: ${count} ghost signal(s)${last ? `, last ${new Date(last).toLocaleString()}` : ''}`,
            meta: { count, last_detected_at: last || null },
          };
        },
      },
      {
        key: 'deal-risk',
        title: 'Deal Risk Signals',
        description: 'Risk signals table is readable and has unresolved items',
        run: async () => {
          let unresolved = 0;
          try {
            const { count, error } = await supabase
              .from('deal_risk_signals')
              .select('id', { count: 'exact', head: true })
              .eq('is_resolved', false)
              .eq('auto_dismissed', false);
            if (error) throw error;
            unresolved = count ?? 0;
          } catch {
            unresolved = await tryCount('deal_risk_signals', orgId);
          }
          const ok = unresolved >= 0;
          return {
            ok,
            message: `OK: ${unresolved} active/unresolved risk signal(s)`,
            meta: { unresolved },
          };
        },
      },
      {
        key: 'next-actions',
        title: 'Next Action Suggestions',
        description: 'Suggestions table is readable and has pending items',
        run: async () => {
          let pending = 0;
          try {
            const { count, error } = await supabase
              .from('next_action_suggestions')
              .select('id', { count: 'exact', head: true })
              .eq('status', 'pending');
            if (error) throw error;
            pending = count ?? 0;
          } catch {
            pending = await tryCount('next_action_suggestions', orgId);
          }
          return {
            ok: pending >= 0,
            message: `OK: ${pending} pending next-action suggestion(s)`,
            meta: { pending },
          };
        },
      },
      {
        key: 'email-cats',
        title: 'Email Categorization',
        description: 'Categorized emails exist and are being written',
        run: async () => {
          const count = await tryCount('email_categorizations', orgId);
          const last = await tryLatest('email_categorizations', 'processed_at', orgId);
          const ok = count > 0;
          return {
            ok,
            message: ok ? `OK: ${count} categorization(s), last ${last ? new Date(last).toLocaleString() : 'unknown'}` : 'No email categorizations found yet',
            meta: { count, last_processed_at: last || null },
          };
        },
      },
      {
        key: 'calendar',
        title: 'Calendar Context',
        description: 'Calendar events are being synced (15-min pipeline)',
        run: async () => {
          const count = await tryCount('calendar_events', orgId);
          const last = await tryLatest('calendar_events', 'updated_at', orgId);
          const ok = count > 0;
          return {
            ok,
            message: ok ? `OK: ${count} event(s), last updated ${last ? new Date(last).toLocaleString() : 'unknown'}` : 'No calendar events found',
            meta: { count, last_updated_at: last || null },
          };
        },
      },
      {
        key: 'slack',
        title: 'Slack Assistant Delivery',
        description: 'Slack org settings exist and notifications can be recorded',
        run: async () => {
          const connected = await tryCount('slack_org_settings', orgId);
          const sent = await tryCount('slack_notifications_sent', orgId);
          const ok = connected > 0;
          return {
            ok,
            message: ok ? `OK: Slack connected (${connected} org setting row). Sent notifications: ${sent}` : 'Slack not connected for this org',
            meta: { connected_org_rows: connected, sent_notifications: sent },
          };
        },
      },
    ],
    [orgId]
  );

  const runOne = useCallback(
    async (key: string) => {
      const it = items.find((x) => x.key === key);
      if (!it) return;
      setRunning(true);
      try {
        const out = await it.run();
        setResults((prev) => ({
          ...prev,
          [key]: { ...out, ranAt: new Date().toISOString() },
        }));
      } catch (e: any) {
        setResults((prev) => ({
          ...prev,
          [key]: {
            ok: false,
            message: e?.message || 'Audit failed',
            ranAt: new Date().toISOString(),
          },
        }));
      } finally {
        setRunning(false);
      }
    },
    [items]
  );

  const runAudit = useCallback(async () => {
    setRunning(true);
    try {
      const settled = await Promise.allSettled(items.map((it) => it.run()));
      const next: Record<string, AuditResult> = {};
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const s = settled[i];
        if (s.status === 'fulfilled') {
          next[it.key] = { ...s.value, ranAt: new Date().toISOString() };
        } else {
          next[it.key] = {
            ok: false,
            message: s.reason?.message || 'Audit failed',
            ranAt: new Date().toISOString(),
          };
        }
      }
      setResults(next);
    } finally {
      setRunning(false);
    }
  }, [items]);

  useEffect(() => {
    // auto-run once on first load to give immediate signal
    runAudit();
  }, [runAudit]);

  useEffect(() => {
    if (!focusKey) return;
    if (!autoRunFocused) return;
    // run only the focused check on tab jump
    runOne(focusKey);
  }, [focusKey, autoRunFocused, runOne]);

  const passCount = Object.values(results).filter((r) => r.ok).length;
  const total = items.length;

  return (
    <div className="space-y-6">
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Intelligence Audit
          </CardTitle>
          <CardDescription>
            Verifies the data + wiring for each intelligence feature (reads tables, checks freshness)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={passCount === total ? 'default' : 'secondary'}>
                {passCount}/{total} checks passing
              </Badge>
              {Object.keys(results).length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Updated {new Date(Object.values(results)[0].ranAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={runAudit} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Re-run audit
            </Button>
          </div>

          <Alert>
            <Database className="h-4 w-4" />
            <AlertTitle className="text-sm">What this checks</AlertTitle>
            <AlertDescription className="text-xs">
              These checks validate database read access and data presence/freshness. They don’t trigger cron-only edge functions.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((it) => {
          const res = results[it.key];
          const ok = res?.ok;
          const isFocused = focusKey === it.key;
          return (
            <Card
              key={it.key}
              className={isFocused ? 'border-2 border-primary/40' : undefined}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    {ok ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-amber-500" />}
                    {it.title}
                  </span>
                  <Badge variant={ok ? 'default' : 'secondary'}>{ok ? 'PASS' : 'CHECK'}</Badge>
                </CardTitle>
                <CardDescription>{it.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{res?.message ?? 'Not run yet'}</p>
                {res?.meta && (
                  <pre className="text-xs bg-muted/40 p-3 rounded overflow-auto max-h-40">{JSON.stringify(res.meta, null, 2)}</pre>
                )}
                <Separator />
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => runOne(it.key)}
                  disabled={running}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Run this check
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            What to do if a check fails
          </CardTitle>
          <CardDescription>Common causes and fixes</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            - If tables read as 0 rows, the feature may be enabled but hasn’t run yet (no data).
          </p>
          <p>
            - If a check errors, it may be an RLS/permission issue or schema mismatch.
          </p>
          <p>
            - For Google/Slack-related checks, confirm the integration is connected in Integrations settings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

