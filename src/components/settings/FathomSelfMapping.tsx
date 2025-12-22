/**
 * FathomSelfMapping Component
 *
 * Allows a user to link ONLY their own Fathom email mapping.
 * This is safe to show to non-admin users.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, CheckCircle2, Info, Mail } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useOrg } from '@/lib/contexts/OrgContext';
import { supabase } from '@/lib/supabase/clientV2';
import { useFathomSelfMap, type FathomUserMapping } from '@/lib/hooks/useFathomSettings';
import { toast } from 'sonner';

export function FathomSelfMapping() {
  const { user } = useAuth();
  const { activeOrgId } = useOrg();
  const selfMap = useFathomSelfMap();
  const [fathomEmail, setFathomEmail] = useState('');
  const [myMapping, setMyMapping] = useState<FathomUserMapping | null>(null);
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
        .from('fathom_user_mappings')
        .select('*')
        .eq('org_id', activeOrgId)
        .eq('sixty_user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (error) {
        setMyMapping(null);
      } else {
        setMyMapping((data as FathomUserMapping) || null);
      }
    } catch (e: any) {
      setMyMapping(null);
      setLoadError(e?.message || 'Failed to load Fathom mapping');
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
    if (myMapping?.fathom_user_email && myMapping?.sixty_user_id) return 'linked';
    return 'unlinked';
  }, [loadingMapping, myMapping]);

  const handleLink = async () => {
    if (!activeOrgId) return;
    try {
      const trimmed = fathomEmail.trim().toLowerCase();
      const res = await selfMap.mutateAsync({ fathomUserEmail: trimmed ? trimmed : undefined });
      const mapping = (res as any)?.mapping;
      if (mapping?.fathomUserEmail) {
        setMyMapping({
          id: mapping.id,
          org_id: activeOrgId,
          fathom_user_email: mapping.fathomUserEmail,
          fathom_user_name: null,
          sixty_user_id: mapping.sixtyUserId ?? user?.id ?? null,
          is_auto_matched: mapping.isAutoMatched ?? false,
          last_seen_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        const backfilled = (res as any)?.meetingsBackfilled || 0;
        toast.success(`Fathom email linked successfully${backfilled > 0 ? ` (${backfilled} meetings updated)` : ''}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Failed to link Fathom email');
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Your Fathom Link
            </CardTitle>
            <CardDescription>
              Link your Fathom email so meetings are correctly attributed to you.
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
              <span className="font-medium">Fathom email:</span>{' '}
              <span className="text-muted-foreground">{myMapping.fathom_user_email}</span>
            </div>
            {myMapping.fathom_user_name && (
              <div>
                <span className="font-medium">Name:</span>{' '}
                <span className="text-muted-foreground">{myMapping.fathom_user_name}</span>
              </div>
            )}
            {myMapping.is_auto_matched && (
              <div className="text-xs text-green-600 dark:text-green-400">
                ✓ Auto-matched because your Sixty email matches your Fathom email
              </div>
            )}
          </div>
        ) : (
          <>
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Enter the email you use in Fathom to ensure meetings are correctly attributed to you.
                {userEmail ? (
                  <>
                    {' '}If left empty, we'll use your Sixty email: <span className="font-medium">{userEmail}</span>
                  </>
                ) : null}
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Fathom email address</Label>
              <Input
                type="email"
                placeholder={userEmail || 'your.email@company.com'}
                value={fathomEmail}
                onChange={(e) => setFathomEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty to auto-match with your Sixty account email.
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
            ) : status === 'linked' ? (
              'Update link'
            ) : (
              'Link my Fathom email'
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

export default FathomSelfMapping;








