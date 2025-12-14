import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase/clientV2';
import { useAuth } from '@/lib/contexts/AuthContext';
import logger from '@/lib/utils/logger';

export interface IntegrationVoteState {
  /** True if current user has upvoted this integration */
  hasVoted: boolean;
  /** Current total votes count (best-effort; ultimately canonical in DB) */
  votesCount: number;
  /** Backing roadmap_suggestion row id (if exists) */
  suggestionId?: string;
  /** Is a request currently in-flight for this integration id */
  isLoading?: boolean;
}

function integrationKey(integrationId: string) {
  return `integration:${integrationId}`;
}

function isNotFoundError(error: any): boolean {
  const msg = String(error?.message || '').toLowerCase();
  // PostgREST not found can surface differently depending on query style.
  return (
    error?.code === 'PGRST116' || // "Results contain 0 rows" (single())
    error?.code === 'PGRST107' || // "No rows" variants
    msg.includes('0 rows') ||
    msg.includes('results contain 0 rows')
  );
}

function isMissingRoadmapTableError(error: any): boolean {
  // When the table isn't deployed/exposed in the current Supabase project, PostgREST returns 404.
  const msg = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  const hint = String(error?.hint || '').toLowerCase();
  const code = String(error?.code || '').toLowerCase();
  const status = Number(error?.status || error?.statusCode || error?.response?.status || 0);

  if (status === 404) return true;
  if (code.includes('pgrst')) {
    // These messages vary between PostgREST versions.
    return (
      msg.includes('could not find the table') ||
      msg.includes('schema cache') ||
      msg.includes('not found in the schema cache') ||
      details.includes('schema cache') ||
      hint.includes('schema cache')
    );
  }

  // Fallback: look for common text
  return msg.includes('roadmap_suggestions') && msg.includes('not found');
}

/**
 * Upvotes for integrations, backed by existing roadmap tables:
 * - `roadmap_suggestions` row per integration (keyed by `hub_task_code = integration:<id>`)
 * - `roadmap_votes` row per (user, suggestion)
 */
export function useIntegrationUpvotes(integrationIds: string[]) {
  // IMPORTANT: In Clerk auth mode, Supabase sessions are disabled and `useUser()` can be null.
  // `useAuth()` provides a stable mapped Supabase user id across auth implementations.
  const { userId, isAuthenticated, loading: authLoading } = useAuth();

  const uniqueIds = useMemo(() => Array.from(new Set(integrationIds)).filter(Boolean), [integrationIds]);

  const [stateByIntegrationId, setStateByIntegrationId] = useState<Record<string, IntegrationVoteState>>({});
  const [loading, setLoading] = useState(false);
  const [roadmapSchemaAvailable, setRoadmapSchemaAvailable] = useState(true);
  const hasLoggedSchemaMissingRef = useRef(false);

  // Use ref to always have access to current state in callbacks (avoids stale closure)
  const stateRef = useRef(stateByIntegrationId);
  stateRef.current = stateByIntegrationId;

  const ensureDefaults = useCallback(() => {
    setStateByIntegrationId((prev) => {
      const next = { ...prev };
      for (const id of uniqueIds) {
        if (!next[id]) {
          next[id] = { hasVoted: false, votesCount: 0 };
        }
      }
      return next;
    });
  }, [uniqueIds]);

  const refresh = useCallback(async () => {
    ensureDefaults();
    if (!uniqueIds.length) return;
    if (!roadmapSchemaAvailable) return;

    setLoading(true);
    try {
      const codes = uniqueIds.map(integrationKey);

      // Load suggestion rows for these integrations
      const { data: suggestions, error: suggestionsError } = await supabase
        .from('roadmap_suggestions')
        .select('id, hub_task_code, votes_count')
        .in('hub_task_code', codes);

      if (suggestionsError) throw suggestionsError;

      const suggestionByCode = new Map<string, { id: string; votes_count: number | null }>();
      (suggestions || []).forEach((s: any) => {
        if (s?.hub_task_code) {
          suggestionByCode.set(String(s.hub_task_code), { id: String(s.id), votes_count: s.votes_count ?? 0 });
        }
      });

      // Load current user's votes for these suggestions (if user known)
      let userVoteSuggestionIds = new Set<string>();
      const suggestionIds = Array.from(suggestionByCode.values()).map((s) => s.id);

      if (userId && suggestionIds.length) {
        const { data: votes, error: votesError } = await supabase
          .from('roadmap_votes')
          .select('suggestion_id')
          .eq('user_id', userId)
          .in('suggestion_id', suggestionIds);

        if (votesError) throw votesError;
        userVoteSuggestionIds = new Set((votes || []).map((v: any) => String(v.suggestion_id)));
      }

      setStateByIntegrationId((prev) => {
        const next: Record<string, IntegrationVoteState> = { ...prev };
        for (const integrationId of uniqueIds) {
          const code = integrationKey(integrationId);
          const suggestion = suggestionByCode.get(code);
          const suggestionId = suggestion?.id;
          next[integrationId] = {
            ...(next[integrationId] || { hasVoted: false, votesCount: 0 }),
            suggestionId,
            votesCount: suggestion?.votes_count ?? next[integrationId]?.votesCount ?? 0,
            hasVoted: suggestionId ? userVoteSuggestionIds.has(suggestionId) : false,
          };
        }
        return next;
      });
    } catch (err) {
      if (isMissingRoadmapTableError(err)) {
        setRoadmapSchemaAvailable(false);
        if (!hasLoggedSchemaMissingRef.current) {
          hasLoggedSchemaMissingRef.current = true;
          logger.warn(
            'Integration upvotes disabled: roadmap tables not found in this Supabase project. Did you run the roadmap migrations?',
            err
          );
        }
        return;
      }
      logger.error('Failed to refresh integration upvotes', err);
    } finally {
      setLoading(false);
    }
  }, [ensureDefaults, uniqueIds, userId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uniqueIds.join('|'), userId]);

  const toggleUpvote = useCallback(
    async (params: { integrationId: string; integrationName: string; description?: string }) => {
      const { integrationId, integrationName, description } = params;

      if (!integrationId) return;
      if (!roadmapSchemaAvailable) {
        throw new Error('Voting is not configured in this environment yet.');
      }
      if (authLoading) {
        throw new Error('Finishing sign-in… try again in a second.');
      }
      if (!isAuthenticated || !userId) {
        throw new Error('Please sign in to upvote integrations.');
      }

      // Read current state from ref to avoid stale closure
      const currentState = stateRef.current[integrationId] || { hasVoted: false, votesCount: 0 };

      // Mark loading for this integration
      setStateByIntegrationId((prev) => ({
        ...prev,
        [integrationId]: { ...currentState, isLoading: true },
      }));

      try {
        const code = integrationKey(integrationId);

        // Ensure we have a suggestion row
        let suggestionId = currentState.suggestionId;

        if (!suggestionId) {
          const { data: existing, error: existingError } = await supabase
            .from('roadmap_suggestions')
            .select('id, votes_count')
            .eq('hub_task_code', code)
            .maybeSingle();

          if (existingError) throw existingError;
          if (existing?.id) {
            suggestionId = String(existing.id);
            setStateByIntegrationId((prev) => ({
              ...prev,
              [integrationId]: {
                ...(prev[integrationId] || { hasVoted: false, votesCount: 0 }),
                suggestionId,
                votesCount: existing.votes_count ?? prev[integrationId]?.votesCount ?? 0,
              },
            }));
          }
        }

        if (!suggestionId) {
          const { data: created, error: createError } = await supabase
            .from('roadmap_suggestions')
            .insert({
              title: `Integration: ${integrationName}`,
              description:
                (description?.trim()
                  ? `${description.trim()}\n\n`
                  : '') +
                `Requested integration: ${integrationName}\n\n` +
                `Source: /integrations\n` +
                `Integration ID: ${integrationId}`,
              type: 'feature',
              priority: 'medium',
              status: 'submitted',
              submitted_by: userId,
              hub_task_code: code,
            })
            .select('id, votes_count')
            .single();

          if (createError) throw createError;
          suggestionId = String(created.id);
          setStateByIntegrationId((prev) => ({
            ...prev,
            [integrationId]: {
              ...(prev[integrationId] || { hasVoted: false, votesCount: 0 }),
              suggestionId,
              votesCount: created.votes_count ?? prev[integrationId]?.votesCount ?? 0,
            },
          }));
        }

        // Re-read current state after potential DB updates
        const latestState = stateRef.current[integrationId] || { hasVoted: false, votesCount: 0 };
        const hasVoted = !!latestState.hasVoted;

        // Optimistic UI
        setStateByIntegrationId((prev) => ({
          ...prev,
          [integrationId]: {
            ...(prev[integrationId] || { hasVoted: false, votesCount: 0 }),
            hasVoted: !hasVoted,
            votesCount: Math.max(0, (prev[integrationId]?.votesCount ?? 0) + (hasVoted ? -1 : 1)),
          },
        }));

        if (!hasVoted) {
          const { error: voteError } = await supabase.from('roadmap_votes').insert({
            suggestion_id: suggestionId,
            user_id: userId,
          });

          if (voteError) {
            // Revert optimistic update on error (e.g., unique constraint)
            setStateByIntegrationId((prev) => ({
              ...prev,
              [integrationId]: {
                ...(prev[integrationId] || { hasVoted: false, votesCount: 0 }),
                hasVoted: hasVoted,
                votesCount: Math.max(0, (prev[integrationId]?.votesCount ?? 0) - 1),
              },
            }));
            throw voteError;
          }
        } else {
          const { error: deleteError } = await supabase
            .from('roadmap_votes')
            .delete()
            .eq('suggestion_id', suggestionId)
            .eq('user_id', userId);

          if (deleteError) {
            // Revert optimistic update on error
            setStateByIntegrationId((prev) => ({
              ...prev,
              [integrationId]: {
                ...(prev[integrationId] || { hasVoted: false, votesCount: 0 }),
                hasVoted: hasVoted,
                votesCount: Math.max(0, (prev[integrationId]?.votesCount ?? 0) + 1),
              },
            }));
            throw deleteError;
          }
        }

        // Best-effort refresh to get canonical votes_count (trigger-updated)
        // (Don't block UX on this.)
        refresh();
      } catch (err: any) {
        // If vote failed because suggestion was missing, fallback to refetch (rare edge-case)
        if (isNotFoundError(err)) {
          await refresh();
        }
        if (isMissingRoadmapTableError(err)) {
          setRoadmapSchemaAvailable(false);
        }
        throw err;
      } finally {
        setStateByIntegrationId((prev) => ({
          ...prev,
          [integrationId]: { ...(prev[integrationId] || { hasVoted: false, votesCount: 0 }), isLoading: false },
        }));
      }
    },
    [authLoading, isAuthenticated, refresh, roadmapSchemaAvailable, userId]
  );

  const getVoteState = useCallback(
    (integrationId: string): IntegrationVoteState => stateByIntegrationId[integrationId] || { hasVoted: false, votesCount: 0 },
    [stateByIntegrationId]
  );

  return {
    loading,
    roadmapSchemaAvailable,
    getVoteState,
    toggleUpvote,
    refresh,
    userId,
  };
}
