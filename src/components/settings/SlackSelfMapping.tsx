/**
 * SlackSelfMapping Component
 *
 * Allows a user to link ONLY their own Slack account mapping.
 * This is safe to show to non-admin users.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrg } from '@/lib/contexts/OrgContext';
import { supabase } from '@/lib/supabase/clientV2';
import { useSlackSelfMap } from '@/lib/hooks/useSlackSettings';

type MyMapping = {
  slack_user_id: string;
  slack_username: string | null;
  slack_email: string | null;
  sixty_user_id: string | null;
};

export function SlackSelfMapping() {
  const { user } = useAuth();
  const { activeOrgId } = useOrg();
  const selfMap = useSlackSelfMap();
  const [slackUserId, setSlackUserId] = useState('');
  const [myMapping, setMyMapping] = useState<MyMapping | null>(null);
  const [loadingMapping, setLoadingMapping] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const userEmail = ((user as any)?.email as string | undefined) || '';

  const loadMyMapping = async () => {
    if (!activeOrgId || !user?.id) return;
    setLoadingMapping(true);
    setLoadError(null);
    try {
      // Best-effort: if RLS denies, we still allow the edge function flow.
      const { data, error } = await (supabase as any)
        .from('slack_user_mappings')
        .select('slack_user_id, slack_username, slack_email, sixty_user_id')
        .eq('org_id', activeOrgId)
        .eq('sixty_user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        setMyMapping(null);
      } else {
        setMyMapping((data as MyMapping) || null);
      }
    } catch (e: any) {
      setMyMapping(null);
      setLoadError(e?.message || 'Failed to load Slack mapping');
    } finally {
      setLoadingMapping(false);
    }
  };

  useEffect(() => {
    void loadMyMapping();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrgId, user?.id]);

  const status = useMemo(() => {
    if (loadingMapping) return 'loading';
    if (myMapping?.slack_user_id) return 'linked';
    return 'unlinked';
  }, [loadingMapping, myMapping]);

  const handleLink = async () => {
    if (!activeOrgId) return;
    const trimmed = slackUserId.trim();
    const res = await selfMap.mutateAsync({ slackUserId: trimmed ? trimmed : undefined });
    const mapping = (res as any)?.mapping;
    if (mapping?.slackUserId) {
      setMyMapping({
        slack_user_id: mapping.slackUserId,
        slack_username: mapping.slackUsername ?? null,
        slack_email: mapping.slackEmail ?? null,
        sixty_user_id: mapping.sixtyUserId ?? user?.id ?? null,
      });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4" />
              Your Slack Link
            </CardTitle>
            <CardDescription>
              Link your Slack account so the bot can DM you and @mention you correctly.
            </CardDescription>
          </div>
          {status === 'linked' ? (
            <Badge className="bg-green-600">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Linked
            </Badge>
          ) : (
            <Badge variant="secondary">Not linked</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loadError && (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {status === 'linked' && myMapping ? (
          <div className="text-sm space-y-1">
            <div>
              <span className="font-medium">Slack user:</span>{' '}
              <span className="text-muted-foreground">
                @{myMapping.slack_username || myMapping.slack_user_id}
              </span>
            </div>
            {myMapping.slack_email && (
              <div>
                <span className="font-medium">Slack email:</span>{' '}
                <span className="text-muted-foreground">{myMapping.slack_email}</span>
              </div>
            )}
          </div>
        ) : (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                First, DM the Sixty bot in Slack once (so we can see your Slack user). Then click “Link my Slack account”.
                {userEmail ? (
                  <>
                    {' '}We’ll match by email: <span className="font-medium">{userEmail}</span>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Optional: paste your Slack User ID</Label>
              <Input
                placeholder="U0123ABC (optional)"
                value={slackUserId}
                onChange={(e) => setSlackUserId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If you paste a Slack user ID, we’ll require it matches your email (when Slack provides an email).
              </p>
            </div>
          </>
        )}

        <div className="flex items-center gap-2">
          <Button onClick={handleLink} disabled={selfMap.isPending || !activeOrgId}>
            {selfMap.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Linking…
              </>
            ) : (
              'Link my Slack account'
            )}
          </Button>
          <Button variant="outline" onClick={() => void loadMyMapping()} disabled={loadingMapping}>
            {loadingMapping ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Refreshing…
              </>
            ) : (
              'Refresh'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default SlackSelfMapping;











