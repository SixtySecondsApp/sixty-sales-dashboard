# Relationship Health Monitor - Implementation Plan

## Executive Summary

This implementation extends the existing **Deal Health Monitor** system to create a comprehensive **Relationship Health Monitor** with ghost detection and "permission to close" intervention workflows.

### What Already Exists ✅

The codebase has a sophisticated foundation:

1. **Deal Health Scoring System** (`dealHealthService.ts`)
   - Multi-signal analysis (stage velocity, sentiment, engagement, activity, response time)
   - 0-100 health scoring with weighted calculations
   - Risk factor identification
   - Historical tracking

2. **Alert System** (`dealHealthAlertService.ts`)
   - Rule-based alert generation
   - Template rendering with context
   - Notification integration
   - Alert management (acknowledge, resolve, dismiss)

3. **Database Schema**
   - `deal_health_scores` - Health tracking per deal
   - `deal_health_alerts` - Alert storage
   - `deal_health_rules` - Configurable rules
   - `deal_health_history` - Historical snapshots

4. **React Hooks** (`useDealHealth.ts`)
   - `useDealHealthScore` - Single deal health
   - `useUserDealsHealth` - All deals for user
   - `useActiveAlerts` - Alert management
   - `useContactDealHealth` - Contact-level aggregation
   - `useCompanyDealHealth` - Company-level aggregation

5. **UI Components**
   - `DealHealthDashboard.tsx`
   - `DealHealthAlertsPanel.tsx`
   - `DealHealthBadge.tsx`
   - `ContactDealHealthWidget.tsx`
   - `CompanyDealHealthWidget.tsx`

### What We're Adding 🚀

Based on the feature brief, we need to add:

1. **Ghost Detection Engine**
   - Contact-level relationship health (beyond deal-level)
   - Communication pattern analysis (email frequency, response rates)
   - Ghost-specific detection signals
   - Predictive ghosting alerts

2. **Permission to Close Template System**
   - Template library with master templates
   - AI-powered personalization
   - A/B testing framework
   - Template performance tracking

3. **Intervention Workflow**
   - Detection alert UI
   - AI recommendation engine
   - One-click template deployment
   - Response tracking

4. **Communication Tracking**
   - Email engagement metrics
   - Response time analysis
   - Thread depth tracking
   - Baseline establishment per contact

5. **Analytics Dashboard**
   - Relationship health overview
   - Priority intervention list
   - Success tracking metrics
   - Template performance comparison

---

## Phase 1: Database Schema & Migrations

### New Tables

#### 1. `relationship_health_scores`
Extends health monitoring to contact/company level (not just deals).

```sql
CREATE TABLE relationship_health_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Relationship target (either contact or company)
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('contact', 'company')),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,

  -- Overall health
  overall_health_score INTEGER NOT NULL CHECK (overall_health_score >= 0 AND overall_health_score <= 100),
  health_status TEXT NOT NULL CHECK (health_status IN ('healthy', 'at_risk', 'critical', 'ghost')),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),

  -- Communication metrics
  communication_frequency_score INTEGER,
  response_behavior_score INTEGER,
  engagement_quality_score INTEGER,
  sentiment_score INTEGER,
  meeting_pattern_score INTEGER,

  -- Raw metrics
  days_since_last_contact INTEGER,
  days_since_last_response INTEGER,
  avg_response_time_hours NUMERIC,
  response_rate_percent INTEGER,
  email_open_rate_percent INTEGER,
  meeting_count_30_days INTEGER,
  email_count_30_days INTEGER,
  total_interactions_30_days INTEGER,

  -- Communication baseline (for anomaly detection)
  baseline_response_time_hours NUMERIC,
  baseline_contact_frequency_days NUMERIC,
  baseline_meeting_frequency_days NUMERIC,

  -- Ghost detection
  is_ghost_risk BOOLEAN DEFAULT FALSE,
  ghost_signals JSONB, -- Array of ghost detection signals
  ghost_probability_percent INTEGER,
  days_until_predicted_ghost INTEGER,

  -- Sentiment tracking
  sentiment_trend TEXT CHECK (sentiment_trend IN ('improving', 'stable', 'declining', 'unknown')),
  avg_sentiment_last_3_interactions NUMERIC,

  -- Risk factors
  risk_factors TEXT[],

  -- Metadata
  last_meaningful_interaction JSONB, -- {type, date, topic, concerns_raised, commitments_made}
  related_deals_count INTEGER DEFAULT 0,
  total_deal_value NUMERIC DEFAULT 0,
  at_risk_deal_value NUMERIC DEFAULT 0,

  -- Timestamps
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Constraints
  CONSTRAINT contact_or_company CHECK (
    (relationship_type = 'contact' AND contact_id IS NOT NULL AND company_id IS NULL) OR
    (relationship_type = 'company' AND company_id IS NOT NULL AND contact_id IS NULL)
  ),

  -- Unique constraint
  UNIQUE(user_id, relationship_type, contact_id, company_id)
);

CREATE INDEX idx_relationship_health_user ON relationship_health_scores(user_id);
CREATE INDEX idx_relationship_health_contact ON relationship_health_scores(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_relationship_health_company ON relationship_health_scores(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_relationship_health_status ON relationship_health_scores(health_status);
CREATE INDEX idx_relationship_health_ghost_risk ON relationship_health_scores(is_ghost_risk) WHERE is_ghost_risk = TRUE;
```

#### 2. `ghost_detection_signals`
Tracks specific signals that indicate ghosting risk.

```sql
CREATE TABLE ghost_detection_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_health_id UUID NOT NULL REFERENCES relationship_health_scores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Signal details
  signal_type TEXT NOT NULL CHECK (signal_type IN (
    'email_no_response',
    'response_time_increased',
    'email_opens_declined',
    'meeting_cancelled',
    'meeting_rescheduled_repeatedly',
    'one_word_responses',
    'thread_dropout',
    'attendee_count_decreased',
    'meeting_duration_shortened',
    'sentiment_declining',
    'formal_language_shift'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),

  -- Context
  signal_context TEXT, -- Human-readable description
  signal_data JSONB, -- Raw data that triggered signal

  -- Timestamps
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,

  -- Metadata
  metadata JSONB,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ghost_signals_relationship ON ghost_detection_signals(relationship_health_id);
CREATE INDEX idx_ghost_signals_user ON ghost_detection_signals(user_id);
CREATE INDEX idx_ghost_signals_type ON ghost_detection_signals(signal_type);
CREATE INDEX idx_ghost_signals_detected ON ghost_detection_signals(detected_at DESC);
```

#### 3. `intervention_templates`
Library of "permission to close" templates.

```sql
CREATE TABLE intervention_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for system templates

  -- Template details
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'permission_to_close',
    'value_add',
    'pattern_interrupt',
    'soft_checkin',
    'channel_switch'
  )),
  context_trigger TEXT NOT NULL CHECK (context_trigger IN (
    'after_proposal',
    'after_demo',
    'after_meeting_noshow',
    'multiple_followups_ignored',
    'after_technical_questions',
    'champion_quiet',
    'general_ghosting',
    'meeting_rescheduled'
  )),

  -- Template content
  subject_line TEXT,
  template_body TEXT NOT NULL,

  -- Personalization fields
  personalization_fields JSONB, -- {last_meaningful_interaction, personalized_assumption, reconnect_suggestion}

  -- A/B testing
  is_control_variant BOOLEAN DEFAULT FALSE,
  variant_name TEXT, -- 'control', 'specific', 'vulnerable', 'question', 'competitive', 'time_specific'

  -- Performance metrics
  times_sent INTEGER DEFAULT 0,
  times_opened INTEGER DEFAULT 0,
  times_replied INTEGER DEFAULT 0,
  times_recovered INTEGER DEFAULT 0, -- Led to re-engagement
  avg_response_time_hours NUMERIC,
  response_rate_percent INTEGER,
  recovery_rate_percent INTEGER,

  -- Effectiveness by segment
  best_performing_persona TEXT,
  best_performing_industry TEXT,
  best_performing_deal_stage TEXT,
  performance_by_segment JSONB,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_system_template BOOLEAN DEFAULT FALSE,

  -- Metadata
  description TEXT,
  usage_notes TEXT,
  recommended_timing TEXT, -- e.g., "After 2-3 ignored follow-ups"
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_intervention_templates_user ON intervention_templates(user_id);
CREATE INDEX idx_intervention_templates_type ON intervention_templates(template_type);
CREATE INDEX idx_intervention_templates_context ON intervention_templates(context_trigger);
CREATE INDEX idx_intervention_templates_active ON intervention_templates(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_intervention_templates_system ON intervention_templates(is_system_template) WHERE is_system_template = TRUE;
```

#### 4. `interventions`
Tracks deployed interventions and their outcomes.

```sql
CREATE TABLE interventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Target
  relationship_health_id UUID NOT NULL REFERENCES relationship_health_scores(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Template used
  template_id UUID REFERENCES intervention_templates(id) ON DELETE SET NULL,
  template_type TEXT NOT NULL,
  context_trigger TEXT NOT NULL,

  -- Intervention content (saved copy in case template changes)
  subject_line TEXT,
  intervention_body TEXT NOT NULL,
  personalization_data JSONB, -- What personalizations were applied

  -- Channel
  intervention_channel TEXT NOT NULL CHECK (intervention_channel IN ('email', 'linkedin', 'phone', 'video', 'in_person')),

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'sent',
    'delivered',
    'opened',
    'clicked',
    'replied',
    'recovered',
    'failed'
  )),

  -- Tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  first_open_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  replied_at TIMESTAMP WITH TIME ZONE,
  recovered_at TIMESTAMP WITH TIME ZONE,

  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Response handling
  response_type TEXT CHECK (response_type IN (
    'interested_later',
    'still_interested',
    'not_interested',
    'went_competitor',
    'not_fit',
    'apologetic',
    'ghosted_again'
  )),
  response_text TEXT,
  suggested_reply TEXT, -- AI-generated suggested response

  -- Outcome
  outcome TEXT CHECK (outcome IN (
    'relationship_recovered',
    'moved_to_nurture',
    'deal_closed_won',
    'deal_closed_lost',
    'permanent_ghost',
    'pending'
  )),
  outcome_notes TEXT,

  -- Metadata
  health_score_at_send INTEGER,
  days_since_last_contact INTEGER,
  ai_recommendation_score NUMERIC, -- How confident AI was in this template
  metadata JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_interventions_user ON interventions(user_id);
CREATE INDEX idx_interventions_relationship ON interventions(relationship_health_id);
CREATE INDEX idx_interventions_contact ON interventions(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_interventions_template ON interventions(template_id) WHERE template_id IS NOT NULL;
CREATE INDEX idx_interventions_status ON interventions(status);
CREATE INDEX idx_interventions_sent ON interventions(sent_at DESC) WHERE sent_at IS NOT NULL;
CREATE INDEX idx_interventions_outcome ON interventions(outcome) WHERE outcome IS NOT NULL;
```

#### 5. `communication_events`
Tracks all communication interactions for pattern analysis.

```sql
CREATE TABLE communication_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Target
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL CHECK (event_type IN (
    'email_sent',
    'email_received',
    'email_opened',
    'email_clicked',
    'meeting_scheduled',
    'meeting_held',
    'meeting_cancelled',
    'meeting_rescheduled',
    'call_made',
    'call_received',
    'linkedin_message',
    'linkedin_connection'
  )),

  -- Direction
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound', 'system')),

  -- Content
  subject TEXT,
  body TEXT,
  snippet TEXT, -- First 200 chars for quick reference

  -- Engagement
  was_opened BOOLEAN DEFAULT FALSE,
  was_clicked BOOLEAN DEFAULT FALSE,
  was_replied BOOLEAN DEFAULT FALSE,
  open_count INTEGER DEFAULT 0,
  click_count INTEGER DEFAULT 0,

  -- Timing
  response_time_hours NUMERIC, -- For inbound responses, time since our last outbound

  -- Sentiment
  sentiment_score NUMERIC, -- -1 to 1
  sentiment_label TEXT CHECK (sentiment_label IN ('very_negative', 'negative', 'neutral', 'positive', 'very_positive')),
  tone TEXT, -- 'formal', 'casual', 'enthusiastic', 'concerned', 'hedging'

  -- Thread context
  thread_id TEXT, -- Email thread ID
  is_thread_start BOOLEAN DEFAULT FALSE,
  thread_position INTEGER, -- Position in thread
  previous_event_id UUID REFERENCES communication_events(id) ON DELETE SET NULL,

  -- External IDs
  external_id TEXT, -- Email message ID, LinkedIn message ID, etc.
  external_source TEXT, -- 'gmail', 'outlook', 'linkedin', etc.

  -- Metadata
  metadata JSONB,

  -- Timestamps
  event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_communication_events_user ON communication_events(user_id);
CREATE INDEX idx_communication_events_contact ON communication_events(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_communication_events_company ON communication_events(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX idx_communication_events_deal ON communication_events(deal_id) WHERE deal_id IS NOT NULL;
CREATE INDEX idx_communication_events_type ON communication_events(event_type);
CREATE INDEX idx_communication_events_timestamp ON communication_events(event_timestamp DESC);
CREATE INDEX idx_communication_events_thread ON communication_events(thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX idx_communication_events_external ON communication_events(external_id) WHERE external_id IS NOT NULL;
```

#### 6. `relationship_health_history`
Historical snapshots of relationship health for trend analysis.

```sql
CREATE TABLE relationship_health_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  relationship_health_id UUID NOT NULL REFERENCES relationship_health_scores(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot of scores
  overall_health_score INTEGER NOT NULL,
  health_status TEXT NOT NULL,
  communication_frequency_score INTEGER,
  response_behavior_score INTEGER,
  engagement_quality_score INTEGER,
  sentiment_score INTEGER,
  meeting_pattern_score INTEGER,

  -- Snapshot timestamp
  snapshot_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  -- Metadata
  snapshot_reason TEXT, -- 'scheduled', 'intervention_sent', 'major_change', 'alert_triggered'
  changes_from_previous JSONB, -- What changed since last snapshot

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_relationship_history_relationship ON relationship_health_history(relationship_health_id);
CREATE INDEX idx_relationship_history_snapshot ON relationship_health_history(snapshot_at DESC);
```

---

## Phase 2: Services Layer

### 1. `relationshipHealthService.ts`

New service to calculate relationship-level health scores.

**Key Functions:**
- `calculateRelationshipHealth(contactId | companyId)` - Calculate health for a relationship
- `calculateAllRelationshipsHealth(userId)` - Batch calculate for all relationships
- `identifyGhostRisks(userId)` - Find relationships at risk of ghosting
- `analyzeCommun icationPatterns(contactId)` - Analyze communication frequency, response times
- `establishBaseline(contactId)` - Calculate normal communication patterns for anomaly detection
- `detectGhostSignals(contactId)` - Identify specific ghosting indicators
- `calculateGhostProbability(contactId)` - Predict likelihood of ghosting

**Signal Calculations:**
- Communication frequency score (based on interaction frequency vs baseline)
- Response behavior score (response time trends, one-word replies)
- Engagement quality score (email opens, meeting attendance)
- Sentiment score (from meeting transcripts, email tone)
- Meeting pattern score (frequency, duration, attendees)

### 2. `ghostDetectionService.ts`

Service for detecting ghosting patterns and signals.

**Key Functions:**
- `detectGhostingSignals(relationshipHealthId)` - Analyze and detect ghost signals
- `evaluateResponsePattern(contactId, timeWindow)` - Check response degradation
- `analyzeEmailEngagement(contactId)` - Track email open/click patterns
- `analyzeMeetingPatterns(contactId)` - Detect meeting behavior changes
- `evaluateSentimentTrend(contactId)` - Check for sentiment decline
- `calculateGhostRisk(signals[])` - Aggregate signal risk

**Detection Logic:**
- 2+ ignored follow-ups after meaningful interaction
- 7+ days past expected response based on baseline
- Meeting rescheduled 2x without new date
- Email opens dropped to zero after consistent engagement
- Response time increased 3x+ compared to baseline
- One-word responses or thread dropout
- Language becoming more formal/hedging

### 3. `interventionTemplateService.ts`

Service for managing intervention templates.

**Key Functions:**
- `personalizeTemplate(templateId, context)` - AI personalization with Anthropic
- `selectBestTemplate(relationshipHealth, signals)` - AI recommendation
- `trackTemplatePerformance(templateId, outcome)` - Update metrics
- `abTestTemplates(variantA, variantB)` - A/B testing framework
- `getTemplatesByContext(trigger)` - Get relevant templates
- `analyzeTemplateEffectiveness(templateId)` - Performance analytics

**AI Personalization:**
- Extract last_meaningful_interaction from history
- Generate personalized_assumption from signals/context
- Craft reconnect_suggestion based on deal stage/concerns
- Adapt tone to match relationship formality

### 4. `interventionService.ts`

Service for deploying and tracking interventions.

**Key Functions:**
- `deployIntervention(relationshipHealthId, templateId)` - Send intervention
- `trackInterventionOutcome(interventionId, outcome)` - Record results
- `generateAIResponse(interventionId, response)` - AI-suggested reply
- `analyzeInterventionEffectiveness(userId)` - Performance metrics
- `getActiveInterventions(userId)` - In-flight interventions
- `handleResponse(interventionId, responseType, text)` - Response processing

**Workflow:**
1. Select template
2. Personalize with AI
3. Present to user for review
4. Send via chosen channel
5. Track engagement (opens, clicks)
6. Monitor for response
7. Suggest AI reply
8. Update outcome

### 5. `communicationTrackingService.ts`

Service for tracking all communication events.

**Key Functions:**
- `recordCommunicationEvent(event)` - Log communication
- `analyzeResponsePatterns(contactId)` - Response time trends
- `calculateResponseBaseline(contactId)` - Normal response behavior
- `trackEmailEngagement(contactId)` - Opens, clicks, replies
- `identifyThreadDropoff(threadId)` - Detect mid-thread ghosting
- `analyzeSentiment(text)` - Basic sentiment analysis
- `getRecentCommunications(contactId, days)` - Communication history

**Integration Points:**
- Email API (Gmail, Outlook)
- LinkedIn
- Phone/call tracking
- Meeting systems (Fathom, Google Calendar)

---

## Phase 3: React Hooks

### 1. `useRelationshipHealth.ts`

**Hooks:**
- `useRelationshipHealth(contactId | companyId)` - Get relationship health
- `useAllRelationshipsHealth()` - All relationships for user
- `useGhostRisks()` - Relationships at risk of ghosting
- `useInterventionRecommendations(relationshipHealthId)` - AI suggestions

### 2. `useInterventions.ts`

**Hooks:**
- `useInterventions(contactId)` - Intervention history for contact
- `useActiveInterventions()` - In-flight interventions
- `useInterventionTemplates(context)` - Get relevant templates
- `useTemplatePerformance()` - Template analytics

### 3. `useCommunicationTracking.ts`

**Hooks:**
- `useCommunicationHistory(contactId)` - Communication timeline
- `useResponsePatterns(contactId)` - Response behavior analysis
- `useEmailEngagement(contactId)` - Email tracking metrics

---

## Phase 4: UI Components

### 1. Relationship Health Dashboard (`RelationshipHealthDashboard.tsx`)

**Sections:**
- Health score distribution chart
- Priority intervention list (cards with ghost risk contacts)
- Success tracking metrics
- Template performance comparison

**Features:**
- Real-time health score updates
- One-click intervention deployment
- Filtering by health tier (healthy/at risk/critical/ghost)
- Drill-down to contact/company details

### 2. Intervention Alert Card (`InterventionAlertCard.tsx`)

**Display:**
- Contact name, company, deal value
- Health score with trend arrow
- Specific warning (e.g., "No response to 2 follow-ups after proposal")
- Last interaction context
- Suggested action

**Actions:**
- "Send Template" - Opens intervention modal
- "Snooze" - Delay alert
- "Mark as Handled" - Dismiss

### 3. Intervention Modal (`InterventionModal.tsx`)

**Step 1: Detection Alert**
- Show ghost risk detected
- Display warning signs
- Show last meaningful interaction

**Step 2: AI Recommendation**
- Show suggested template
- Preview personalized content
- Edit before sending
- Alternative template options

**Step 3: Send & Track**
- Send via chosen channel
- Real-time engagement tracking
- Auto-follow-up scheduling

**Step 4: Response Handling**
- Show response when received
- AI-suggested reply
- Quick action buttons

### 4. Template Library (`TemplateLibrary.tsx`)

**Features:**
- Browse templates by context trigger
- Create/edit custom templates
- View performance metrics per template
- A/B test variant management
- Template preview with sample personalization

### 5. Relationship Timeline (`RelationshipTimeline.tsx`)

**Display:**
- Visual timeline of all interactions
- Meetings, emails, calls, deals
- Health score changes over time
- Intervention deployments
- Response patterns

### 6. Ghost Detection Panel (`GhostDetectionPanel.tsx`)

**Display:**
- List of detected ghost signals
- Signal severity and context
- Timeline of signal detection
- Risk probability meter
- Days until predicted ghost

---

## Phase 5: AI Integration (Anthropic Claude)

### Edge Function: `ai-intervention-personalizer`

**Input:**
```typescript
{
  template_id: string,
  contact_id: string,
  relationship_health: RelationshipHealthScore,
  ghost_signals: GhostDetectionSignal[],
  communication_history: CommunicationEvent[]
}
```

**AI Prompt:**
```
You are an expert sales coach helping personalize a "permission to close" template.

Contact Context:
- Name: {contact_name}
- Company: {company_name}
- Last interaction: {last_interaction}
- Ghost signals: {signals}
- Concerns raised: {concerns}

Template to personalize:
{template_body}

Instructions:
1. Replace {last_meaningful_interaction} with specific reference from history
2. Generate {personalized_assumption} based on ghost signals and context
3. Craft {reconnect_suggestion} appropriate for their situation
4. Maintain the template's psychology (remove pressure, assume rejection)
5. Keep tone authentic and conversational

Return only the personalized template text.
```

**Output:**
```typescript
{
  personalized_template: string,
  personalization_data: {
    last_meaningful_interaction: string,
    personalized_assumption: string,
    reconnect_suggestion: string
  },
  confidence_score: number // 0-1
}
```

### Edge Function: `ai-response-suggester`

**Input:**
```typescript
{
  intervention_id: string,
  response_text: string,
  response_type: 'interested_later' | 'still_interested' | 'not_interested' | etc.
}
```

**AI Prompt:**
```
The prospect responded to our "permission to close" template with:
"{response_text}"

Response type: {response_type}

Generate a brief, friendly reply that:
1. Acknowledges their response without pressure
2. Provides a simple next step (if interested)
3. Maintains the low-pressure approach
4. Keeps relationship warm for future

Keep reply under 4 sentences.
```

**Output:**
```typescript
{
  suggested_reply: string,
  next_action: string,
  confidence_score: number
}
```

### Edge Function: `ai-template-selector`

**Input:**
```typescript
{
  relationship_health: RelationshipHealthScore,
  ghost_signals: GhostDetectionSignal[],
  communication_history: CommunicationEvent[],
  available_templates: InterventionTemplate[]
}
```

**AI Analysis:**
- What context trigger matches best (after_proposal, after_demo, etc.)
- Which template variant historically performed best for this persona
- Confidence in template effectiveness
- Alternative template recommendations

**Output:**
```typescript
{
  recommended_template_id: string,
  confidence_score: number,
  reasoning: string,
  alternative_templates: string[]
}
```

---

## Phase 6: Analytics & Reporting

### Metrics to Track

**Ghost Prevention:**
- Interventions sent
- Response rate (% who replied)
- Recovery rate (% who re-engaged)
- Deal value saved
- Average time to response

**Early Detection:**
- Average warning time (days before ghost)
- False positive rate
- Contacts flagged
- Signal accuracy

**Template Performance:**
- Response rate by template
- Recovery rate by template
- Best performing by persona/industry/stage
- A/B test results
- Average response time

**Business Impact:**
- Time saved per rep
- Pipeline at risk
- Pipeline recovered
- Average health score trend
- Relationships saved vs lost

### Dashboard Views

**1. Overview Dashboard**
- 30-day summary
- Health score distribution
- Intervention effectiveness
- Template performance

**2. Template Analytics**
- Performance comparison table
- A/B test results
- Persona/industry breakdowns
- Historical trends

**3. Relationship Insights**
- At-risk relationships
- Recovery success stories
- Communication pattern analysis
- Sentiment trends

---

## Phase 7: Integration Points

### Email Integration
- **Gmail API**: Track sends, opens, clicks, responses
- **Outlook API**: Same as Gmail
- **Parsing**: Extract sentiment, tone, response time

### Calendar Integration
- **Google Calendar**: Meeting patterns, cancellations
- **Already exists**: Leverage existing `calendarService.ts`

### Meeting Intelligence
- **Fathom**: Already integrated for sentiment, transcripts
- **Leverage**: Existing sentiment scoring

### Notification Channels
- **In-app**: Already exists via `notificationService.ts`
- **Email**: Alert emails for critical ghost risks
- **Slack**: Webhook notifications (if configured)

---

## Implementation Timeline

### Week 1: Database & Core Services
- [ ] Create database migrations
- [ ] Build `relationshipHealthService.ts`
- [ ] Build `ghostDetectionService.ts`
- [ ] Build `communicationTrackingService.ts`
- [ ] Test health calculation logic

### Week 2: Template System
- [ ] Build `interventionTemplateService.ts`
- [ ] Build `interventionService.ts`
- [ ] Create AI edge functions
- [ ] Seed default templates
- [ ] Test template personalization

### Week 3: React Hooks & Components
- [ ] Build `useRelationshipHealth.ts`
- [ ] Build `useInterventions.ts`
- [ ] Build `useCommunicationTracking.ts`
- [ ] Create `RelationshipHealthDashboard.tsx`
- [ ] Create `InterventionModal.tsx`
- [ ] Create `TemplateLibrary.tsx`

### Week 4: UI Polish & Integration
- [ ] Build `InterventionAlertCard.tsx`
- [ ] Build `RelationshipTimeline.tsx`
- [ ] Build `GhostDetectionPanel.tsx`
- [ ] Integrate with existing navigation
- [ ] Add to `/crm` route

### Week 5: Analytics & Testing
- [ ] Build analytics dashboard
- [ ] Build template performance tracking
- [ ] Comprehensive testing
- [ ] User acceptance testing
- [ ] Performance optimization

### Week 6: Deployment & Documentation
- [ ] Production deployment
- [ ] User documentation
- [ ] Training materials
- [ ] Monitor and iterate

---

## Success Criteria

### Technical
- [ ] All health scores calculate in < 1 second
- [ ] Ghost detection runs in real-time
- [ ] Template personalization completes in < 2 seconds
- [ ] No N+1 query problems
- [ ] Real-time updates working via Supabase subscriptions

### Functional
- [ ] 60%+ response rate on permission to close templates
- [ ] 4-7 days early warning before ghost
- [ ] 2x win rate on early-intervened vs late-detected
- [ ] 5+ hours/week saved per rep
- [ ] < 15% false positive rate on ghost detection

### User Experience
- [ ] One-click intervention deployment
- [ ] Real-time engagement tracking
- [ ] Clear action priorities
- [ ] Mobile-responsive
- [ ] Intuitive workflow

---

## Database Migration Files Needed

1. `001_create_relationship_health_scores.sql`
2. `002_create_ghost_detection_signals.sql`
3. `003_create_intervention_templates.sql`
4. `004_create_interventions.sql`
5. `005_create_communication_events.sql`
6. `006_create_relationship_health_history.sql`
7. `007_seed_default_templates.sql`
8. `008_create_indexes_and_rls_policies.sql`

---

## Row Level Security (RLS) Policies

All tables must have RLS policies:

```sql
-- Example for relationship_health_scores
ALTER TABLE relationship_health_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own relationship health"
  ON relationship_health_scores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship health"
  ON relationship_health_scores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationship health"
  ON relationship_health_scores FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationship health"
  ON relationship_health_scores FOR DELETE
  USING (auth.uid() = user_id);
```

Similar policies for all other tables.

---

## Next Steps

1. **Review this plan** with stakeholders
2. **Create database migrations** (Phase 1)
3. **Build core services** (Phase 2)
4. **Develop React hooks** (Phase 3)
5. **Create UI components** (Phase 4)
6. **Integrate AI** (Phase 5)
7. **Build analytics** (Phase 6)
8. **Test and deploy** (Weeks 5-6)

---

## Questions for Clarification

1. **Email Integration**: Which email provider should we prioritize? (Gmail, Outlook, both?)
2. **AI Budget**: What's the budget for Anthropic API calls? (affects personalization frequency)
3. **Template Sending**: Should we integrate with email API or just copy to clipboard?
4. **Automatic vs Manual**: Should ghost detection auto-send templates or always require approval?
5. **Admin Controls**: Should there be admin settings to configure ghost detection thresholds?

---

**Document Version**: 1.0
**Created**: 2025-11-22
**Status**: Ready for Implementation
