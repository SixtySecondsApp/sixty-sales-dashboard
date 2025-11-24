/**
 * React Hooks for Relationship Health Monitoring
 *
 * Provides hooks for accessing relationship health scores, ghost detection,
 * interventions, and communication tracking.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { supabase } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';

import {
  calculateRelationshipHealth,
  calculateAllContactsHealth,
  getRelationshipHealthScore,
  getUserRelationshipHealthScores,
  getGhostRiskRelationships,
  type RelationshipHealthScore,
} from '@/lib/services/relationshipHealthService';

import {
  detectGhostingSignals,
  assessGhostRisk,
  getActiveGhostSignals,
  resolveGhostSignal,
  resolveAllSignalsForRelationship,
  type GhostDetectionSignal,
  type GhostRiskAssessment,
} from '@/lib/services/ghostDetectionService';

import {
  getAllTemplates,
  getTemplatesByContext,
  selectBestTemplate,
  personalizeTemplate,
  personalizeTemplateWithAI,
  getTemplatePerformance,
  compareTemplatePerformance,
  type InterventionTemplate,
  type TemplateRecommendation,
  type PersonalizedTemplate,
} from '@/lib/services/interventionTemplateService';

import {
  deployIntervention,
  markInterventionAsSent,
  trackInterventionOpened,
  trackInterventionReplied,
  markInterventionRecovered,
  getContactInterventions,
  getActiveInterventions,
  getInterventionSuccessRate,
  getInterventionAnalytics,
  type Intervention,
} from '@/lib/services/interventionService';

import {
  analyzeContactCommunicationPattern,
  getContactCommunications,
  getRecentCommunications,
  type CommunicationEvent,
  type CommunicationPattern,
} from '@/lib/services/communicationTrackingService';

// =====================================================
// useRelationshipHealthScore Hook
// =====================================================

/**
 * Manage and subscribe to the health score for a specific contact or company relationship.
 *
 * @returns An object containing:
 * - `healthScore`: the current RelationshipHealthScore or `null`
 * - `loading`: `true` while a fetch or calculation is in progress
 * - `error`: an error message string or `null`
 * - `refresh`: function to re-fetch the health score
 * - `calculateHealth`: function to recalculate and update the health score
 */
export function useRelationshipHealthScore(
  relationshipType: 'contact' | 'company',
  relationshipId: string | null
) {
  const { user } = useAuth();
  const [healthScore, setHealthScore] = useState<RelationshipHealthScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch health score
  const fetchHealthScore = useCallback(async () => {
    if (!relationshipId || !user) {
      setHealthScore(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const score = await getRelationshipHealthScore(relationshipType, relationshipId);
      setHealthScore(score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health score');
    } finally {
      setLoading(false);
    }
  }, [relationshipType, relationshipId, user]);

  // Calculate health score (refresh)
  const calculateHealth = useCallback(async () => {
    if (!relationshipId || !user) return;

    try {
      setLoading(true);
      setError(null);

      const score = await calculateRelationshipHealth(relationshipType, relationshipId, user.id);
      setHealthScore(score);

      toast.success('Health score updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate health score');
      toast.error('Failed to update health score');
    } finally {
      setLoading(false);
    }
  }, [relationshipType, relationshipId, user]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!relationshipId || !user) return;

    fetchHealthScore();

    const channel = supabase
      .channel(`relationship_health:${relationshipId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'relationship_health_scores',
          filter: relationshipType === 'contact'
            ? `contact_id=eq.${relationshipId}`
            : `company_id=eq.${relationshipId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setHealthScore(null);
          } else {
            setHealthScore(payload.new as RelationshipHealthScore);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [relationshipType, relationshipId, user, fetchHealthScore]);

  return {
    healthScore,
    loading,
    error,
    refresh: fetchHealthScore,
    calculateHealth,
  };
}

// =====================================================
// useAllRelationshipsHealth Hook
// =====================================================

/**
 * Manage and provide health scores for all relationships of the current user.
 *
 * Provides reactive state for the user's relationship health scores, a loading flag, an optional error message,
 * a `refresh` function to re-fetch scores, and a `calculateAllHealth` function to trigger recalculation for all contacts
 * and refresh the stored scores.
 *
 * @returns An object containing:
 *  - `healthScores`: the array of relationship health scores
 *  - `loading`: `true` while an operation is in progress, `false` otherwise
 *  - `error`: an error message string when a fetch or calculation fails, or `null`
 *  - `refresh`: a function to re-fetch the user's relationship health scores
 *  - `calculateAllHealth`: a function to recalculate health for all contacts and refresh the scores
 */
export function useAllRelationshipsHealth() {
  const { user } = useAuth();
  const [healthScores, setHealthScores] = useState<RelationshipHealthScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch health scores
  const fetchHealthScores = useCallback(async () => {
    if (!user) {
      setHealthScores([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const scores = await getUserRelationshipHealthScores(user.id);
      setHealthScores(scores);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health scores');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Calculate health for all contacts
  const calculateAllHealth = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const scores = await calculateAllContactsHealth(user.id);
      await fetchHealthScores(); // Refresh

      toast.success(`Health calculated for ${scores.length} relationships`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate health scores');
      toast.error('Failed to calculate health scores');
    } finally {
      setLoading(false);
    }
  }, [user, fetchHealthScores]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!user) return;

    fetchHealthScores();

    const channel = supabase
      .channel(`user_relationships_health:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'relationship_health_scores',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchHealthScores(); // Refresh all scores
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user, fetchHealthScores]);

  return {
    healthScores,
    loading,
    error,
    refresh: fetchHealthScores,
    calculateAllHealth,
  };
}

// =====================================================
// useGhostRisks Hook
// =====================================================

/**
 * Provides relationships at risk of ghosting for the current user along with loading and error state and a refresh function.
 *
 * @returns An object containing:
 * - `ghostRisks` — the list of relationship health scores identified as ghosting risks
 * - `loading` — `true` while the risks are being fetched, `false` otherwise
 * - `error` — an error message when fetching fails, or `null` when there is no error
 * - `refresh` — a function to re-fetch the ghost risk relationships
 */
export function useGhostRisks() {
  const { user } = useAuth();
  const [ghostRisks, setGhostRisks] = useState<RelationshipHealthScore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGhostRisks = useCallback(async () => {
    if (!user) {
      setGhostRisks([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const risks = await getGhostRiskRelationships(user.id);
      setGhostRisks(risks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ghost risks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchGhostRisks();
  }, [fetchGhostRisks]);

  return {
    ghostRisks,
    loading,
    error,
    refresh: fetchGhostRisks,
  };
}

// =====================================================
// useGhostDetection Hook
// =====================================================

/**
 * Detects ghosting signals and computes a risk assessment for a specific relationship, and provides actions to resolve those signals.
 *
 * @param relationshipHealthId - The identifier of the relationship's health record to analyze.
 * @param contactId - The contact identifier associated with the relationship.
 * @param healthScore - The current health score for the relationship used as input to detection and assessment.
 * @returns An object containing:
 *  - `signals`: the list of detected ghosting signals,
 *  - `riskAssessment`: the computed ghost risk assessment or `null` if unavailable,
 *  - `loading`: whether detection/assessment is in progress,
 *  - `refresh`: a function to re-run detection and assessment,
 *  - `resolveSignal`: a function to resolve a single signal by id,
 *  - `resolveAllSignals`: a function to resolve all signals for the relationship.
 */
export function useGhostDetection(
  relationshipHealthId: string | null,
  contactId: string | null,
  healthScore: RelationshipHealthScore | null
) {
  const { user } = useAuth();
  const [signals, setSignals] = useState<GhostDetectionSignal[]>([]);
  const [riskAssessment, setRiskAssessment] = useState<GhostRiskAssessment | null>(null);
  const [loading, setLoading] = useState(false);

  const detectSignals = useCallback(async () => {
    if (!relationshipHealthId || !contactId || !user || !healthScore) return;

    try {
      setLoading(true);

      const detectedSignals = await detectGhostingSignals(
        relationshipHealthId,
        contactId,
        user.id,
        healthScore
      );

      const assessment = await assessGhostRisk(
        relationshipHealthId,
        contactId,
        user.id,
        healthScore
      );

      setSignals(detectedSignals);
      setRiskAssessment(assessment);
    } catch (error) {
      console.error('Error detecting ghost signals:', error);
    } finally {
      setLoading(false);
    }
  }, [relationshipHealthId, contactId, user, healthScore]);

  const resolveSignal = useCallback(async (signalId: string) => {
    const success = await resolveGhostSignal(signalId);
    if (success) {
      toast.success('Signal resolved');
      detectSignals();
    }
  }, [detectSignals]);

  const resolveAllSignals = useCallback(async () => {
    if (!relationshipHealthId) return;

    const success = await resolveAllSignalsForRelationship(relationshipHealthId);
    if (success) {
      toast.success('All signals resolved');
      detectSignals();
    }
  }, [relationshipHealthId, detectSignals]);

  useEffect(() => {
    detectSignals();
  }, [detectSignals]);

  return {
    signals,
    riskAssessment,
    loading,
    refresh: detectSignals,
    resolveSignal,
    resolveAllSignals,
  };
}

// =====================================================
// useInterventionTemplates Hook
// =====================================================

/**
 * Provides intervention templates for the current user, optionally scoped to a specific context, and a way to refresh them.
 *
 * @param contextTrigger - Optional context identifier used to filter templates (for example, a trigger name or event)
 * @returns An object with `templates` — the retrieved InterventionTemplate array, `loading` — `true` while templates are being fetched, and `refresh` — a function to re-fetch templates
 */
export function useInterventionTemplates(contextTrigger?: string) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<InterventionTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const data = contextTrigger
        ? await getTemplatesByContext(contextTrigger, user.id)
        : await getAllTemplates(user.id);

      setTemplates(data);
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  }, [user, contextTrigger]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    refresh: fetchTemplates,
  };
}

// =====================================================
// useInterventions Hook
// =====================================================

/**
 * Manage interventions for a specific contact or the current user's active interventions.
 *
 * @param contactId - Optional contact ID to fetch interventions for a single contact; when omitted, the hook returns the user's active interventions.
 * @returns An object containing:
 *  - `interventions`: interventions for the specified contact (empty if `contactId` is not provided),
 *  - `activeInterventions`: the user's active interventions (empty if `contactId` is provided),
 *  - `loading`: `true` while data is being fetched,
 *  - `refresh`: function to re-fetch the current list,
 *  - `markAsSent`: function that marks an intervention as sent by ID,
 *  - `markAsRecovered`: function that marks an intervention as recovered by ID
 */
export function useInterventions(contactId?: string) {
  const { user } = useAuth();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [activeInterventions, setActiveInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchInterventions = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      if (contactId) {
        const data = await getContactInterventions(contactId);
        setInterventions(data);
      } else {
        const active = await getActiveInterventions(user.id);
        setActiveInterventions(active);
      }
    } catch (error) {
      console.error('Error fetching interventions:', error);
    } finally {
      setLoading(false);
    }
  }, [user, contactId]);

  const markAsSent = useCallback(async (interventionId: string) => {
    const success = await markInterventionAsSent(interventionId);
    if (success) {
      toast.success('Intervention marked as sent');
      fetchInterventions();
    }
  }, [fetchInterventions]);

  const markAsRecovered = useCallback(async (interventionId: string) => {
    const success = await markInterventionRecovered(interventionId);
    if (success) {
      toast.success('Relationship recovered!');
      fetchInterventions();
    }
  }, [fetchInterventions]);

  useEffect(() => {
    fetchInterventions();
  }, [fetchInterventions]);

  return {
    interventions,
    activeInterventions,
    loading,
    refresh: fetchInterventions,
    markAsSent,
    markAsRecovered,
  };
}

// =====================================================
// useInterventionAnalytics Hook
// =====================================================

/**
 * Fetches intervention analytics and success rate for the current user over a recent time window.
 *
 * @param days - Number of past days to include in the analytics window (default: 30)
 * @returns An object with:
 *  - `analytics`: analytics data for the specified window,
 *  - `successRate`: overall intervention success rate,
 *  - `loading`: `true` while data is being fetched, `false` otherwise,
 *  - `refresh`: function to re-fetch the analytics
 */
export function useInterventionAnalytics(days: number = 30) {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState<any>(null);
  const [successRate, setSuccessRate] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const [analyticsData, rateData] = await Promise.all([
        getInterventionAnalytics(user.id, days),
        getInterventionSuccessRate(user.id),
      ]);

      setAnalytics(analyticsData);
      setSuccessRate(rateData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [user, days]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    successRate,
    loading,
    refresh: fetchAnalytics,
  };
}

// =====================================================
// useCommunicationPattern Hook
// =====================================================

/**
 * Provides communication pattern analysis and recent communications for a specified contact.
 *
 * @param contactId - The contact's ID to analyze; if `null`, no analysis or fetch is performed.
 * @returns An object with:
 *  - `pattern`: The analyzed `CommunicationPattern` for the contact, or `null` if unavailable.
 *  - `communications`: An array of recent `CommunicationEvent` objects (up to 50).
 *  - `loading`: `true` while the pattern and communications are being fetched, `false` otherwise.
 *  - `refresh`: A function to re-run the analysis and refresh communications.
 */
export function useCommunicationPattern(contactId: string | null) {
  const { user } = useAuth();
  const [pattern, setPattern] = useState<CommunicationPattern | null>(null);
  const [communications, setCommunications] = useState<CommunicationEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPattern = useCallback(async () => {
    if (!contactId || !user) return;

    setLoading(true);
    try {
      const [patternData, commsData] = await Promise.all([
        analyzeContactCommunicationPattern(contactId, user.id),
        getContactCommunications(contactId, 50),
      ]);

      setPattern(patternData);
      setCommunications(commsData);
    } catch (error) {
      console.error('Error fetching communication pattern:', error);
    } finally {
      setLoading(false);
    }
  }, [contactId, user]);

  useEffect(() => {
    fetchPattern();
  }, [fetchPattern]);

  return {
    pattern,
    communications,
    loading,
    refresh: fetchPattern,
  };
}