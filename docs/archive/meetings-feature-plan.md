# Meetings Feature V1 - Product Audit & Implementation Plan

## Executive Summary

Transform the internal Meetings feature into a productized V1 offering focused on:
- **Fathom Integration** with guided onboarding
- **Customizable AI** (task extraction, sentiment analysis, content generation)
- **Talk Time Coaching** with actionable insights
- **Proposal Generation** from meeting transcripts
- **User API Key Management** for AI providers
- **Google File Search RAG** for conversational querying of meeting history

**Target**: Single-user product with system AI keys (user override optional), individual coaching + team dashboards, simple-to-advanced proposal workflows.

---

## Part 1: Current State Audit

### What Exists (Functional)
| Feature | Status | Location |
|---------|--------|----------|
| Fathom OAuth | ✅ Complete | `useFathomIntegration.ts`, `fathom-oauth-*` functions |
| Meeting sync | ✅ Complete | `fathomApiService.ts`, `fathom_integrations` table |
| Sentiment scoring | ✅ Basic | `meetings.sentiment_score` (-1 to 1) |
| Talk time metrics | ✅ Basic | `meetings.talk_time_rep_pct`, `talk_time_customer_pct` |
| Action items | ✅ Complete | `meeting_action_items` table, sync to tasks |
| Proposal generation | ✅ Complete | `ProposalWizard.tsx`, Goals→SOW→HTML workflow |
| AI providers | ✅ Complete | `AIProviderService` (OpenAI, Anthropic, OpenRouter, Gemini) |
| User API keys | ✅ Partial | `user_settings.ai_provider_keys` storage exists |

### What's Missing (Gaps)
| Gap | Priority | Impact |
|-----|----------|--------|
| Guided onboarding flow | P0 | Users don't know where to start |
| Enhanced empty states | P0 | No guidance when no meetings exist |
| Unified AI Settings page | P1 | Settings scattered across pages |
| Per-feature model selection | P1 | Models hardcoded in edge functions |
| Task extraction customization | P1 | No user control over extraction rules |
| Talk time coaching UI | P1 | Data exists but no actionable insights |
| Sentiment drill-down | P2 | Can't see sentiment over time or per-topic |
| Meeting type classification | P2 | No auto-classification for content generation |
| Team analytics dashboard | P2 | No manager visibility |

---

## Part 2: Implementation Plan

### Phase 1: Onboarding & Empty States (Week 1)

#### 1.1 Create Onboarding Flow

**New Files:**
```
src/pages/onboarding/
├── index.tsx              # Main flow controller
├── WelcomeStep.tsx        # Value prop + CTA
├── FathomConnectionStep.tsx # Simplified OAuth
├── SyncProgressStep.tsx   # Shows sync happening
└── CompletionStep.tsx     # Success + redirect
```

**Database Migration:**
```sql
-- 20251127000001_create_user_onboarding_progress.sql
CREATE TABLE user_onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_step TEXT DEFAULT 'welcome',
  onboarding_completed_at TIMESTAMPTZ,
  skipped_onboarding BOOLEAN DEFAULT false,
  fathom_connected BOOLEAN DEFAULT false,
  first_meeting_synced BOOLEAN DEFAULT false,
  first_proposal_generated BOOLEAN DEFAULT false,
  features_discovered JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

**Hook:**
```typescript
// src/lib/hooks/useOnboardingProgress.ts
interface OnboardingProgress {
  needsOnboarding: boolean;
  currentStep: 'welcome' | 'fathom_connect' | 'sync' | 'complete';
  completeStep: (step: string) => Promise<void>;
  skipOnboarding: () => Promise<void>;
}
```

**Files to Modify:**
- `src/pages/auth/signup.tsx` → Redirect to `/onboarding` after signup
- `src/App.tsx` → Add `/onboarding/*` routes

#### 1.2 Enhanced Empty States

**New Component:**
```typescript
// src/components/meetings/MeetingsEmptyState.tsx
// Shows contextual content based on:
// - Fathom not connected → Connection CTA
// - Fathom connected, no meetings → Guidance + manual sync
// - Syncing → Progress indicator
```

**Files to Modify:**
- `src/components/meetings/MeetingsList.tsx` → Use `MeetingsEmptyState`

---

### Phase 2: Unified AI Settings (Week 2)

#### 2.1 Consolidated AI Settings Page

**New Page:** `src/pages/settings/AISettings.tsx`

**Tabs:**
1. **API Keys** - Provider key management with validation
2. **Model Selection** - Per-feature model dropdowns
3. **Extraction Rules** - Custom task extraction patterns (Phase 3)

**Database Migration:**
```sql
-- 20251127000002_create_user_ai_settings.sql
CREATE TABLE user_ai_feature_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_key TEXT NOT NULL, -- 'meeting_task_extraction', 'meeting_sentiment', etc.
  provider TEXT NOT NULL,    -- 'openai', 'anthropic', 'openrouter', 'gemini'
  model TEXT NOT NULL,
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 2048,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature_key)
);

-- Default feature keys
INSERT INTO system_config (key, value, description) VALUES
  ('ai_meeting_task_model', 'anthropic/claude-haiku-4-5-20250514', 'Default task extraction model'),
  ('ai_meeting_sentiment_model', 'anthropic/claude-haiku-4-5-20250514', 'Default sentiment model'),
  ('ai_proposal_model', 'anthropic/claude-3-5-sonnet-20241022', 'Default proposal model')
ON CONFLICT (key) DO NOTHING;
```

#### 2.2 Model Resolution Layer

**Add to AIProviderService:**
```typescript
// src/lib/services/aiProvider.ts
async resolveModelForFeature(userId: string, featureKey: string): Promise<ModelConfig> {
  // 1. Check user_ai_feature_settings
  // 2. Fall back to system_config
  // 3. Fall back to hardcoded defaults
}
```

**Update Edge Functions:**
- `supabase/functions/analyze-email/index.ts`
- `supabase/functions/fathom-sync/aiAnalysis.ts`
- `supabase/functions/generate-proposal/index.ts`

---

### Phase 3: Talk Time & Coaching (Week 3)

#### 3.1 Enhanced Talk Time Visualization

**New Components:**
```
src/components/meetings/analytics/
├── TalkTimeChart.tsx       # Donut chart + timeline
├── TalkTimeTrend.tsx       # Trend over last N meetings
└── CoachingInsights.tsx    # AI-powered recommendations
```

**Coaching Rules Engine:**
```typescript
// src/lib/services/coachingService.ts
const COACHING_RULES = [
  { condition: 'talk_time_rep > 65', message: 'Consider more open-ended questions' },
  { condition: 'talk_time_rep < 35', message: 'You may be losing control of the conversation' },
  { condition: 'high_talk_time && low_sentiment', message: 'High talking correlates with negative sentiment' }
];
```

**Files to Modify:**
- `src/components/meetings/MeetingDetail.tsx` → Add analytics section

#### 3.2 Sentiment Dashboard

**New Components:**
```
src/components/insights/
├── SentimentDashboard.tsx  # Company/contact sentiment overview
├── SentimentTrend.tsx      # Historical sentiment chart
└── SentimentAlerts.tsx     # Negative sentiment notifications
```

**Database Migration:**
```sql
-- 20251127000003_create_sentiment_alerts.sql
CREATE TABLE sentiment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  meeting_id UUID REFERENCES meetings(id),
  contact_id UUID REFERENCES contacts(id),
  alert_type TEXT CHECK (alert_type IN ('negative_meeting', 'declining_trend', 'at_risk')),
  severity TEXT CHECK (severity IN ('info', 'warning', 'critical')),
  sentiment_score NUMERIC,
  message TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Phase 4: Proposal Integration (Week 4)

#### 4.1 Simplified Proposal Mode

**Add to ProposalWizard.tsx:**
- "Quick Mode" toggle for simple summary + follow-up email
- "Advanced Mode" for full Goals → SOW → HTML workflow
- Auto-populated goals from meeting transcript

**New Service Function:**
```typescript
// src/lib/services/proposalService.ts
async extractGoalsFromMeeting(meetingId: string): Promise<{
  goals: string;
  painPoints: string[];
  proposedSolutions: string[];
}>
```

#### 4.2 Meeting Type Classification

**Database Migration:**
```sql
-- 20251127000004_add_meeting_classification.sql
ALTER TABLE meetings ADD COLUMN meeting_type TEXT CHECK (
  meeting_type IN ('discovery', 'demo', 'negotiation', 'closing', 'follow_up', 'general')
);
ALTER TABLE meetings ADD COLUMN classification_confidence NUMERIC;
```

**Classification Service:**
```typescript
// src/lib/services/meetingClassificationService.ts
const TYPE_INDICATORS = {
  discovery: ['pain points', 'challenges', 'current process', 'goals'],
  demo: ['show you', 'demonstration', 'walkthrough', 'feature'],
  negotiation: ['pricing', 'contract', 'terms', 'discount'],
  closing: ['sign', 'agreement', 'start date', 'onboarding']
};
```

---

### Phase 5: Team Analytics (Week 5)

#### 5.1 Team Dashboard

**New Page:** `src/pages/insights/TeamAnalytics.tsx`

**Features:**
- Aggregate metrics across team
- Talk time leaderboard
- Sentiment rankings
- Meeting volume tracking

**Database View:**
```sql
CREATE VIEW team_meeting_analytics AS
SELECT
  p.id as user_id,
  p.full_name,
  COUNT(m.id) as total_meetings,
  AVG(m.sentiment_score) as avg_sentiment,
  AVG(m.talk_time_rep_pct) as avg_talk_time,
  AVG(m.coach_rating) as avg_coach_rating
FROM profiles p
LEFT JOIN meetings m ON m.owner_user_id = p.id
WHERE m.meeting_start >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.full_name;
```

#### 5.2 Individual Rep Scorecards

**New Component:** `src/components/insights/RepScorecard.tsx`
- Personal metrics vs team average
- Trend indicators
- Personalized coaching recommendations

---

### Phase 6: Extraction Customization (Week 6)

#### 6.1 Custom Extraction Rules

**Database Migration:**
```sql
-- 20251127000005_create_extraction_rules.sql
CREATE TABLE task_extraction_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  trigger_phrases TEXT[] NOT NULL,
  task_category TEXT NOT NULL,
  default_priority TEXT DEFAULT 'medium',
  default_deadline_days INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE meeting_type_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  meeting_type TEXT NOT NULL,
  extraction_template JSONB,
  content_templates JSONB,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, meeting_type)
);
```

**New UI:** `src/pages/settings/ExtractionRules.tsx`
- Rule builder with trigger phrases
- Category mapping
- Priority/deadline defaults

---

### Phase 7: Google File Search RAG System (Week 7)

#### 7.1 Google File Search Integration

**Overview:**
Implement Retrieval Augmented Generation (RAG) using Google's File Search API to enable conversational querying of meeting transcripts and analyses. Users can ask questions like "How many calls did I forget to mention X?" or "Am I getting better over time?" and get intelligent answers based on their entire meeting history.

**Reference:** [Google File Search Documentation](https://ai.google.dev/gemini-api/docs/file-search)

**New Service:**
```typescript
// src/lib/services/googleFileSearchService.ts
import { GoogleGenAI } from '@google/genai';

interface FileSearchStore {
  name: string;
  displayName: string;
}

interface FileSearchDocument {
  name: string;
  displayName: string;
  mimeType: string;
}

class GoogleFileSearchService {
  private client: GoogleGenAI;
  
  async createFileSearchStore(userId: string, displayName: string): Promise<FileSearchStore>
  async uploadMeetingTranscript(storeName: string, transcript: string, meetingId: string): Promise<FileSearchDocument>
  async queryMeetingHistory(storeName: string, query: string): Promise<string>
  async deleteDocument(storeName: string, documentName: string): Promise<void>
}
```

**Database Migration:**
```sql
-- 20251127000006_create_file_search_stores.sql
CREATE TABLE file_search_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL, -- Google File Search store name (format: fileSearchStores/xxxxxxx)
  display_name TEXT NOT NULL,
  total_size_bytes BIGINT DEFAULT 0,
  document_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- One store per user
);

CREATE TABLE file_search_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  document_name TEXT NOT NULL, -- Google File Search document name
  display_name TEXT NOT NULL,
  meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
  mime_type TEXT DEFAULT 'text/plain',
  size_bytes BIGINT,
  upload_status TEXT CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_name)
);

CREATE INDEX idx_file_search_documents_meeting ON file_search_documents(meeting_id);
CREATE INDEX idx_file_search_documents_user ON file_search_documents(user_id);
```

#### 7.2 RAG Query Interface

**New Component:**
```typescript
// src/components/meetings/RAGQueryInterface.tsx
// Conversational interface for querying meeting history
// Features:
// - Natural language query input
// - Context-aware suggestions
// - Citation display (which meetings were referenced)
// - Query history
```

**New Page:**
```typescript
// src/pages/meetings/RAGQuery.tsx
// Dedicated page for RAG queries with:
// - Query input with examples
// - Results display with citations
// - Query history sidebar
// - Export results option
```

#### 7.3 Automatic Transcript Indexing

**Service Function:**
```typescript
// src/lib/services/meetingRAGService.ts
async indexMeetingTranscript(meetingId: string): Promise<void> {
  // 1. Fetch meeting transcript from database
  // 2. Format transcript with metadata (date, participants, etc.)
  // 3. Upload to user's File Search store
  // 4. Update file_search_documents table
  // 5. Handle errors and retries
}

async indexAllUserMeetings(userId: string): Promise<void> {
  // Batch index all existing meetings for a user
  // Useful for initial setup or re-indexing
}
```

**Integration Points:**
- Hook into Fathom sync: Auto-index new meetings as they sync
- Manual re-index: Button in settings to re-index all meetings
- Background job: Periodic sync to catch any missed meetings

#### 7.4 Supported Models & File Types

**Supported Gemini Models:**
- `gemini-3-pro-preview`
- `gemini-2.5-pro`
- `gemini-2.5-flash` (recommended for cost/performance)
- `gemini-2.5-flash-lite`

**File Format:**
- Store transcripts as `text/plain` or `text/markdown`
- Include metadata in transcript header:
  ```
  Meeting Date: 2025-11-26
  Participants: John Doe, Jane Smith
  Duration: 45 minutes
  Meeting Type: Discovery
  
  [Transcript content]
  ```

#### 7.5 Rate Limits & Pricing

**Rate Limits:**
- Maximum file size: 100 MB per document
- Free tier: 1 GB total store size
- Tier 1: 10 GB total store size
- Tier 2: 100 GB total store size
- Tier 3: 1 TB total store size
- Recommendation: Keep stores under 20 GB for optimal latency

**Pricing:**
- Embeddings at indexing: $0.15 per 1M tokens
- Storage: Free
- Query time embeddings: Free
- Retrieved document tokens: Charged as regular context tokens

**Files to Create:**
- `src/lib/services/googleFileSearchService.ts` - Core File Search API client
- `src/lib/services/meetingRAGService.ts` - Meeting-specific RAG operations
- `src/components/meetings/RAGQueryInterface.tsx` - Query UI component
- `src/pages/meetings/RAGQuery.tsx` - RAG query page
- `src/lib/hooks/useRAGQuery.ts` - React hook for RAG queries

**Files to Modify:**
- `src/lib/services/fathomApiService.ts` - Add auto-indexing on sync
- `src/pages/settings/AISettings.tsx` - Add File Search store management tab
- `src/components/meetings/MeetingDetail.tsx` - Add "Query this meeting" button

**Database Migrations:**
- `20251127000006_create_file_search_stores.sql` - File Search store tables

---

## Part 3: Critical Files Reference

### Files to Create
| File | Purpose | Phase |
|------|---------|-------|
| `src/pages/onboarding/index.tsx` | Onboarding flow controller | 1 |
| `src/lib/hooks/useOnboardingProgress.ts` | Onboarding state management | 1 |
| `src/components/meetings/MeetingsEmptyState.tsx` | Contextual empty states | 1 |
| `src/pages/settings/AISettings.tsx` | Unified AI settings page | 2 |
| `src/components/meetings/analytics/TalkTimeChart.tsx` | Talk time visualization | 3 |
| `src/components/meetings/analytics/CoachingInsights.tsx` | AI coaching recommendations | 3 |
| `src/components/insights/SentimentDashboard.tsx` | Sentiment overview | 3 |
| `src/pages/insights/TeamAnalytics.tsx` | Team performance dashboard | 5 |

### Files to Modify
| File | Changes | Phase |
|------|---------|-------|
| `src/pages/auth/signup.tsx` | Redirect to onboarding | 1 |
| `src/App.tsx` | Add onboarding routes | 1 |
| `src/components/meetings/MeetingsList.tsx` | Use MeetingsEmptyState | 1 |
| `src/lib/services/aiProvider.ts` | Add resolveModelForFeature() | 2 |
| `supabase/functions/analyze-email/index.ts` | Use configurable models | 2 |
| `src/components/meetings/MeetingDetail.tsx` | Add analytics section | 3 |
| `src/components/proposals/ProposalWizard.tsx` | Add Quick Mode, auto-populate | 4 |
| `src/lib/services/proposalService.ts` | Add extractGoalsFromMeeting() | 4 |

### Database Migrations
| Migration | Tables/Changes | Phase |
|-----------|----------------|-------|
| `20251127000001_*.sql` | `user_onboarding_progress` | 1 |
| `20251127000002_*.sql` | `user_ai_feature_settings` | 2 |
| `20251127000003_*.sql` | `sentiment_alerts` | 3 |
| `20251127000004_*.sql` | `meetings.meeting_type` column | 4 |
| `20251127000005_*.sql` | `task_extraction_rules`, `meeting_type_templates` | 6 |
| `20251127000006_*.sql` | `file_search_stores`, `file_search_documents` | 7 |

---

## Part 4: API Key Architecture

### Storage Strategy
```
Priority Order:
1. User's personal keys (user_settings.ai_provider_keys)
2. System/environment keys (edge function secrets)
3. Fallback error with setup instructions
```

### Supported Providers
| Provider | Models | Key Format |
|----------|--------|------------|
| OpenAI | gpt-4o, gpt-4o-mini, o1 | sk-... |
| Anthropic | claude-3-5-sonnet, claude-haiku | sk-ant-... |
| OpenRouter | Any model via routing | sk-or-... |
| Google Gemini | gemini-2.5-flash, gemini-3-pro | AIza... |
| Google File Search | gemini-2.5-flash, gemini-2.5-pro, gemini-3-pro | AIza... (uses Gemini API key) |

### UI Flow
1. User visits `/settings/ai` → API Keys tab
2. Enters keys for desired providers
3. Click "Test" validates key with provider
4. Keys stored encrypted in `user_settings.ai_provider_keys`
5. Per-feature model selection in "Model Selection" tab

---

## Part 5: Success Metrics

### User Adoption
- Time to first synced meeting: < 5 minutes
- Onboarding completion rate: > 80%
- Feature discovery rate: > 60% use coaching insights

### Business Value
- Proposal generation time: 30min → 5min
- Talk time in target range (45-55%): Track improvement
- Sentiment score improvement: +10% over 3 months

### Technical
- AI cost per user per month
- Model response times
- Sync reliability (Fathom → DB)

---

## Part 6: Implementation Order Summary

| Week | Focus | Key Deliverables |
|------|-------|------------------|
| **1** | Onboarding | Guided flow (Signup → Fathom → Sync), enhanced empty states |
| **2** | AI Settings | Unified settings page, API key management, model selection |
| **3** | Coaching | Talk time visualization, sentiment dashboards, coaching AI |
| **4** | Proposals | Quick mode, auto-populated goals from transcripts |
| **5** | Team Analytics | Team dashboard, rep scorecards |
| **6** | Customization | Extraction rules builder, meeting type templates |
| **7** | RAG System | Google File Search integration, conversational querying, transcript indexing |

---

## Part 7: Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Fathom API changes | Abstract API calls, version pin |
| AI cost overruns | Token limits per feature, user quotas |
| Data quality | Validate sentiment/talk time from Fathom |
| Privacy concerns | Clear consent in onboarding, data retention policy |
| Performance | Cache AI results, batch processing |

---

## Part 8: User Journey Flows

### New User Onboarding
```
Signup → Welcome Screen → Connect Fathom (OAuth) → Sync Progress → First Meeting View
         ↓ (skip)
         Dashboard with "Connect Fathom" CTA
```

### Meeting → Proposal Flow
```
View Meeting → See Summary + Action Items → Click "Generate Proposal"
                                                    ↓
                                            Quick Mode: Summary + Follow-up Email
                                            Advanced Mode: Goals → SOW → HTML Proposal
```

### AI Model Configuration
```
Settings → AI Settings → API Keys Tab (enter/test keys)
                      → Model Selection Tab (choose models per feature)
                      → Extraction Rules Tab (customize task extraction)
```

---

## Appendix: Existing Infrastructure Reference

### Key Services
- `src/lib/services/aiProvider.ts` - Multi-provider AI service
- `src/lib/services/fathomApiService.ts` - Fathom API client
- `src/lib/services/proposalService.ts` - Proposal generation
- `src/lib/hooks/useFathomIntegration.ts` - Fathom state management

### Key Components
- `src/components/meetings/MeetingDetail.tsx` - Full meeting view
- `src/components/meetings/MeetingsList.tsx` - Meeting grid/list
- `src/components/proposals/ProposalWizard.tsx` - Proposal workflow

### Database Tables
- `meetings` - Core meeting data with Fathom fields
- `meeting_action_items` - Extracted tasks
- `meeting_attendees` - Participants
- `meeting_metrics` - Talk time, words spoken
- `fathom_integrations` - OAuth tokens
- `fathom_sync_state` - Sync progress
