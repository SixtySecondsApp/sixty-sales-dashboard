import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, RefreshCw, ExternalLink, HeartPulse, Ghost, AlertOctagon, Inbox, Calendar, CheckSquare } from 'lucide-react';
import { supabase } from '@/lib/supabase/clientV2';

type HealthRow = {
  key: string;
  title: string;
  description: string;
  table: string;
  icon: React.ComponentType<{ className?: string }>;
  link?: { label: string; href: string };
};

type PanelResult = {
  ok: boolean;
  count: number | null;
  lastAt?: string | null;
  message?: string;
};

async function safeCount(table: string, filters: Array<[string, string, any]> = []) {
  let q: any = supabase.from(table).select('id', { count: 'exact', head: true });
  for (const [op, col, val] of filters) {
    if (op === 'eq') q = q.eq(col, val);
    if (op === 'neq') q = q.neq(col, val);
    if (op === 'is') q = q.is(col, val);
    if (op === 'in') q = q.in(col, val);
  }
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

async function safeLatestTimestamp(table: string, column: string, filters: Array<[string, string, any]> = []) {
  let q: any = supabase.from(table).select(column).not(column, 'is', null).order(column, { ascending: false }).limit(1);
  for (const [op, col, val] of filters) {
    if (op === 'eq') q = q.eq(col, val);
    if (op === 'neq') q = q.neq(col, val);
    if (op === 'is') q = q.is(col, val);
    if (op === 'in') q = q.in(col, val);
  }
  const { data, error } = await q;
  if (error) throw error;
  const row = (data && data[0]) as any;
  return row ? (row[column] as string) : null;
}

type SalesIntelligenceHealthPanelProps = {
  orgId: string;
  userId?: string;
  onTest?: (key: string) => void;
};

export function SalesIntelligenceHealthPanel(props: SalesIntelligenceHealthPanelProps): JSX.Element {
  const { orgId, onTest } = props;
  const rows: HealthRow[] = useMemo(
    () => [
      {
        key: 'deal-health',
        title: 'Deal Health Scoring',
        description: 'Deal-level risk + stall detection with interventions',
        table: 'deal_health_scores',
        icon: HeartPulse,
        link: { label: 'Open Health Monitoring', href: '/crm/health' },
      },
      {
        key: 'relationship-health',
        title: 'Relationship Health',
        description: 'Contact/company health trends across all comms',
        table: 'relationship_health_scores',
        icon: HeartPulse,
        link: { label: 'Open Relationship Health', href: '/crm/relationship-health' },
      },
      {
        key: 'ghost',
        title: 'Ghosting Signals',
        description: 'Early-warning ghost detection from comm patterns',
        table: 'ghost_detection_signals',
        icon: Ghost,
      },
      {
        key: 'deal-risk',
        title: 'Deal Risk Signals',
        description: 'Risk signals + aggregates for deals',
        table: 'deal_risk_signals',
        icon: AlertOctagon,
      },
      {
        key: 'next-actions',
        title: 'Next Actions',
        description: 'AI-generated follow-up suggestions',
        table: 'next_action_suggestions',
        icon: CheckSquare,
      },
      {
        key: 'email-cats',
        title: 'Email Categorization',
        description: 'Fyxer-style categories + sales signals',
        table: 'email_categorizations',
        icon: Inbox,
      },
      {
        key: 'calendar',
        title: 'Calendar Context',
        description: 'Upcoming meetings synced every 15 minutes',
        table: 'calendar_events',
        icon: Calendar,
      },
    ],
    []
  );

  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<Record<string, PanelResult>>({});

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const settled = await Promise.allSettled(
        rows.map(async (r) => {
          // Prefer org_id filtering when present; fall back if column missing.
          const orgFilter: Array<[string, string, any]> = [['eq', 'org_id', orgId]];

          const result: PanelResult = { ok: true, count: null, lastAt: null };

          try {
            result.count = await safeCount(r.table, orgFilter);
          } catch (e: any) {
            // fallback without org_id
            result.count = await safeCount(r.table, []);
            result.message = 'No org_id filter (table may not be org-scoped)';
          }

          // best-effort latest timestamps (varies by table)
          const tsColCandidates = ['updated_at', 'last_calculated_at', 'detected_at', 'created_at', 'event_timestamp', 'start_time', 'meeting_start'];
          for (const col of tsColCandidates) {
            try {
              const last = await safeLatestTimestamp(r.table, col, orgFilter);
              if (last) {
                result.lastAt = last;
                break;
              }
            } catch {
              // ignore
            }
          }

          return [r.key, result] as const;
        })
      );

      const next: Record<string, PanelResult> = {};
      for (const s of settled) {
        if (s.status === 'fulfilled') {
          const [key, val] = s.value;
          next[key] = val;
        }
      }
      setResults(next);
    } finally {
      setLoading(false);
    }
  }, [orgId, rows]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Health & Signals</h3>
          <p className="text-sm text-muted-foreground">Live snapshots of all intelligence systems in your org</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rows.map((r) => {
          const Icon = r.icon;
          const res = results[r.key];
          return (
            <Card key={r.key}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {r.title}
                </CardTitle>
                <CardDescription>{r.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Records</span>
                  <Badge variant="secondary">
                    {loading ? '…' : res?.count ?? '—'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Latest</span>
                  <Badge variant="outline" className="max-w-[180px] truncate">
                    {loading ? '…' : res?.lastAt ? new Date(res.lastAt).toLocaleString() : '—'}
                  </Badge>
                </div>

                {res?.message && (
                  <p className="text-xs text-muted-foreground">{res.message}</p>
                )}

                {r.link && (
                  <>
                    <Separator />
                    <Button asChild size="sm" variant="outline" className="w-full">
                      <a href={r.link.href}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {r.link.label}
                      </a>
                    </Button>
                  </>
                )}

                {onTest && (
                  <>
                    <Separator />
                    <Button
                      size="sm"
                      variant="default"
                      className="w-full"
                      onClick={() => onTest(r.key)}
                    >
                      Test this feature
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

