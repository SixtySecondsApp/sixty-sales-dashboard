/**
 * AI Module - Phase 6: Smart AI & Engagement
 *
 * Central export for AI-related functionality:
 * - Context building (retrieval-first approach)
 * - Confidence-based routing
 * - Learning loop (feedback tracking)
 */

// Types
export * from './types.ts';

// Context Builder
export { buildContextDossier } from './contextBuilder.ts';

// Confidence Router
export {
  routeRecommendation,
  getConfidenceLevel,
  getPrimaryCTA,
  getSecondaryCTAs,
  buildConfidenceIndicator,
} from './confidenceRouter.ts';

// Learning Loop
export {
  recordFeedback,
  recordOutcome,
  calculateEditDelta,
  getUserPreferences,
  getFeedbackAnalytics,
} from './learningLoop.ts';
