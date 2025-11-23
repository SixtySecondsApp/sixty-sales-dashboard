<!-- 785ab6fa-da88-441c-895b-b76b9e6254d4 1b47919f-f60f-4db7-a443-231d2a61f59d -->
# Email Sync and Automated Health Score System

## Current Problems

- Health monitoring page loads very slowly (10+ seconds)
- Missing email communication data in health scores
- Only meetings analyzed, ignoring emails, calendar, and activities
- No automated refresh of health scores

## Solution

Build comprehensive email sync with AI analysis (Claude Haiku 4.5) for CRM contacts only, automated daily health refresh, and optimized database storage.

## Phase 1: Email AI Analysis Service

### 1.1 Create Email AI Analysis Service

**Create: `src/lib/services/emailAIAnalysis.ts`**

Claude Haiku 4.5 analysis for CRM emails only:

```typescript
export interface EmailAnalysis {
  sentiment_score: number; // -1 to 1
  key_topics: string[];
  action_items: string[];
  urgency: 'low' | 'medium' | 'high';
  response_required: boolean;
}

export async function analyzeEmailWithClaude(
  emailSubject: string,
  emailBody: string
): Promise<EmailAnalysis> {
  // Use existing AI provider with Claude Haiku 4.5
  // Prompt: Extract sentiment, topics, action items, urgency
}
```

Analysis Prompt for Claude Haiku 4.5:

```
Analyze this sales email for CRM health tracking.

Subject: {subject}
Body: {body}

Extract:
1. Sentiment (-1 to 1): How positive/negative is the tone?
2. Key topics (max 3): Main discussion points
3. Action items: Any tasks or follow-ups mentioned
4. Urgency (low/medium/high): How urgent is this communication?
5. Response required (yes/no): Does this need a response?

Return JSON format.
```

### 1.2 Create Email Sync Service

**Create: `src/lib/services/emailSyncService.ts`**

```typescript
export type SyncPeriod = '30days' | '60days' | '90days' | 'all_time';

export async function performEmailSync(
  userId: string, 
  period: SyncPeriod
): Promise<SyncResult> {
  // 1. Get CRM contacts for this user
  const crmContacts = await getCRMContactEmails(userId);
  
  // 2. Fetch emails from Gmail API for period
  const emails = await fetchGmailEmails(userId, period);
  
  // 3. Filter: Only emails matching CRM contacts
  const crmEmails = emails.filter(email => 
    matchesCRMContact(email, crmContacts)
  );
  
  // 4. For each CRM email:
  //    - Run Claude Haiku 4.5 analysis
  //    - Link to contact and deal
  //    - Store in communication_events
  
  // 5. Return stats: total emails, CRM matches, analyses run
}

async function getCRMContactEmails(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('contacts')
    .select('email')
    .eq('user_id', userId);
  return new Set(data.map(c => c.email.toLowerCase()));
}
```

### 1.3 Communication Events Migration

**Create: `supabase/migrations/20251123000001_enhance_communication_events.sql`**

```sql
-- Add email-specific fields
ALTER TABLE communication_events
ADD COLUMN IF NOT EXISTS email_thread_id TEXT,
ADD COLUMN IF NOT EXISTS email_subject TEXT,
ADD COLUMN IF NOT EXISTS email_body_preview TEXT,
ADD COLUMN IF NOT EXISTS response_time_hours NUMERIC,
ADD COLUMN IF NOT EXISTS sentiment_score NUMERIC CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_model TEXT, -- 'claude-haiku-4.5'
ADD COLUMN IF NOT EXISTS key_topics JSONB,
ADD COLUMN IF NOT EXISTS action_items JSONB,
ADD COLUMN IF NOT EXISTS urgency TEXT CHECK (urgency IN ('low', 'medium', 'high')),
ADD COLUMN IF NOT EXISTS response_required BOOLEAN,
ADD COLUMN IF NOT EXISTS external_id TEXT, -- Gmail message ID
ADD COLUMN IF NOT EXISTS sync_source TEXT CHECK (sync_source IN ('gmail', 'manual', 'calendar', 'fathom'));

-- Unique index for Gmail message deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_communication_events_gmail_id 
ON communication_events(external_id, user_id) 
WHERE external_id IS NOT NULL AND sync_source = 'gmail';

-- Index for incremental sync
CREATE INDEX IF NOT EXISTS idx_communication_events_sync_date 
ON communication_events(user_id, communication_date DESC, sync_source);

-- Index for AI analysis status
CREATE INDEX IF NOT EXISTS idx_communication_events_ai_pending 
ON communication_events(user_id, ai_analyzed) 
WHERE ai_analyzed = false AND sync_source = 'gmail';

COMMENT ON COLUMN communication_events.ai_analyzed IS 'Whether Claude Haiku 4.5 has analyzed this email';
COMMENT ON COLUMN communication_events.ai_model IS 'AI model used for analysis (e.g., claude-haiku-4.5)';
```

## Phase 2: Email Sync UI

### 2.1 Email Sync Panel Component

**Create: `src/components/health/EmailSyncPanel.tsx`**

User interface for email sync in Settings or Admin:

```typescript
export function EmailSyncPanel() {
  const [selectedPeriod, setSelectedPeriod] = useState<SyncPeriod>('30days');
  const { performSync, syncStatus, loading, progress } = useEmailSync();
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
      <h2>Email Sync for Health Monitoring</h2>
      
      {/* Period Selector */}
      <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
        <option value="30days">Last 30 Days</option>
        <option value="60days">Last 60 Days</option>
        <option value="90days">Last 90 Days</option>
        <option value="all_time">All Time</option>
      </select>
      
      {/* Sync Button */}
      <button onClick={() => performSync(selectedPeriod)}>
        Sync Emails
      </button>
      
      {/* Progress Indicator */}
      {loading && (
        <div>
          Analyzing: {progress.analyzed} / {progress.total} CRM emails
        </div>
      )}
      
      {/* Sync Status */}
      {syncStatus && (
        <div>
          Last sync: {syncStatus.lastSyncTime}
          CRM contacts: {syncStatus.crmContactCount}
          Emails synced: {syncStatus.emailsSynced}
          AI analyses: {syncStatus.aiAnalyses}
        </div>
      )}
    </div>
  );
}
```

### 2.2 Email Sync Hook

**Create: `src/lib/hooks/useEmailSync.ts`**

```typescript
export function useEmailSync() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ analyzed: 0, total: 0 });
  const [syncStatus, setSyncStatus] = useState(null);
  
  const performSync = async (period: SyncPeriod) => {
    setLoading(true);
    try {
      const result = await performEmailSync(user.id, period);
      setSyncStatus(result);
      // Refresh health scores after email sync
      await calculateAllHealth();
    } finally {
      setLoading(false);
    }
  };
  
  return { performSync, syncStatus, loading, progress };
}
```

## Phase 3: Enhanced Health Calculations

### 3.1 Update Deal Health Service

**File: `src/lib/services/dealHealthService.ts`**

Update `fetchDealMetrics()` around line 380 to include email data:

```typescript
// 4. Get email communications from communication_events
const { data: emails } = await supabase
  .from('communication_events')
  .select('*')
  .eq('deal_id', dealId)
  .eq('event_type', 'email')
  .gte('communication_date', thirtyDaysAgo);

const emailCount30Days = emails?.length || 0;
const emailSentiment = emails
  ?.filter(e => e.sentiment_score !== null)
  .reduce((sum, e) => sum + e.sentiment_score, 0) / emails.length || null;
```

Update engagement score calculation to include emails.

### 3.2 Update Relationship Health Service

**File: `src/lib/services/relationshipHealthService.ts`**

Similar updates to include email analysis in relationship health scores.

## Phase 4: Automated Refresh

### 4.1 Track Last Login

**Migration: `supabase/migrations/20251123000002_add_last_login_tracking.sql`**

```sql
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_last_login 
ON profiles(last_login_at DESC) WHERE last_login_at IS NOT NULL;

CREATE OR REPLACE FUNCTION update_last_login()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET last_login_at = NOW() WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_login ON auth.users;
CREATE TRIGGER on_auth_user_login
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION update_last_login();
```

### 4.2 Health Refresh Edge Function

**Create: `supabase/functions/scheduled-health-refresh/index.ts`**

Refreshes health scores for active users (logged in last 7 days).

### 4.3 Email Sync Edge Function

**Create: `supabase/functions/scheduled-email-sync/index.ts`**

Daily incremental email sync for active users.

### 4.4 GitHub Actions Cron

**Create: `.github/workflows/scheduled-jobs.yml`**

Triggers at 7am London time daily.

## Phase 5: Remove On-Load Calculations

**File: `src/components/DealHealthDashboard.tsx`** - Remove smartRefresh() in useEffect

**File: `src/components/relationship-health/RelationshipHealthDashboard.tsx`** - Remove auto-calculation

## Phase 6: Performance Indexes

**Migration: `supabase/migrations/20251123000003_health_score_performance_indexes.sql`**

Indexes for fast health score queries and email lookups.

## Key Features

- AI analysis ONLY for emails matching CRM contacts
- Claude Haiku 4.5 for fast, cost-effective analysis
- User selects sync period: 30/60/90 days or All Time
- Daily incremental sync (last 24 hours)
- Active users only (logged in last 7 days)
- Instant page loading (database reads only)

## Files to Create

1. `src/lib/services/emailAIAnalysis.ts`
2. `src/lib/services/emailSyncService.ts`  
3. `src/lib/hooks/useEmailSync.ts`
4. `src/components/health/EmailSyncPanel.tsx`
5. `supabase/functions/scheduled-email-sync/index.ts`
6. `supabase/functions/scheduled-health-refresh/index.ts`
7. `supabase/migrations/20251123000001_enhance_communication_events.sql`
8. `supabase/migrations/20251123000002_add_last_login_tracking.sql`
9. `supabase/migrations/20251123000003_health_score_performance_indexes.sql`
10. `.github/workflows/scheduled-jobs.yml`

## Files to Modify

1. `src/components/DealHealthDashboard.tsx`
2. `src/components/relationship-health/RelationshipHealthDashboard.tsx`
3. `src/lib/services/dealHealthService.ts`
4. `src/lib/services/relationshipHealthService.ts`

### To-dos

- [ ] Create HealthMonitoring.tsx page with tabbed interface for Deal Health and Relationship Health
- [ ] Create dealHealthInterventionAdapter.ts to convert deal health data to intervention context
- [ ] Add 'Send Intervention' buttons and InterventionModal to DealHealthDashboard
- [ ] Extend PersonalizationContext and selectBestTemplate to support deal health
- [ ] Update routing to use unified HealthMonitoring page with tab support