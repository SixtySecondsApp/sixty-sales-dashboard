# Next-Best-Action Engine Implementation Guide

**Status**: ✅ Phase 1-4 Complete | 📋 Phase 5 Pending
**Date**: October 31, 2025
**Version**: 1.2.0

## 🎯 Overview

Automated Next-Best-Action Engine that uses **Claude Haiku 4.5** to analyze sales activities (meetings, calls, emails, proposals) and generate intelligent, context-aware action suggestions with reasoning.

### Key Features Implemented

✅ **AI-Powered Analysis**: Full transcript analysis using Claude Haiku 4.5
✅ **Auto-Generation**: Database triggers automatically create suggestions after activities
✅ **Real-Time Updates**: WebSocket subscriptions for live suggestion updates
✅ **Smart UI Components**: Badge indicators, detailed cards, slide-in panel
✅ **One-Click Actions**: Create tasks instantly or edit before accepting
✅ **Multi-Display**: Suggestions shown on meeting cards (grid & list views)
✅ **Urgency Classification**: High/Medium/Low priority with confidence scores
✅ **Contextual Reasoning**: AI explains why each action is recommended

---

## 📁 Files Created

### Backend (Phase 1)

#### Edge Function
```
supabase/functions/suggest-next-actions/index.ts
```
- Claude Haiku 4.5 integration for AI analysis
- Full transcript analysis for meetings
- Context-aware recommendations based on deal stage, company data
- Returns 2-4 prioritized suggestions with reasoning

#### Database Migrations
```
supabase/migrations/20251031120000_create_next_action_suggestions.sql
supabase/migrations/20251031120001_create_next_actions_triggers.sql
```

**Tables Created**:
- `next_action_suggestions` - Stores AI-generated suggestions
- Added columns to `meetings` and `activities` for tracking

**Functions Created**:
- `auto_populate_suggestion_user_id()` - Auto-assign user ID
- `update_next_actions_count()` - Track suggestion counts
- `accept_next_action_suggestion()` - Accept and create task
- `dismiss_next_action_suggestion()` - Dismiss with feedback
- `get_pending_suggestions_count()` - Get user's pending count
- `call_suggest_next_actions_async()` - Async Edge Function calls
- `regenerate_next_actions_for_activity()` - Manual regeneration
- `backfill_next_actions_for_meetings()` - Batch processing

**Triggers Created**:
- `trigger_auto_suggest_next_actions_meeting` - Auto-generate for meetings
- `trigger_auto_suggest_next_actions_activity` - Auto-generate for activities

### Service Layer (Phase 2)

#### Service
```
src/lib/services/nextActionsService.ts
```
- Complete API for suggestion management
- Generate, fetch, accept, dismiss, bulk operations
- Type-safe interfaces for all operations

#### React Hook
```
src/lib/hooks/useNextActions.ts
```
- Real-time subscription support
- Filtering and grouping utilities
- Computed values (pending count, high urgency count)
- usePendingSuggestionsCount hook for lightweight count tracking

### UI Components (Phase 3)

```
src/components/next-actions/
├── NextActionBadge.tsx          # Compact badge indicator
├── NextActionCard.tsx            # Individual suggestion card
├── NextActionPanel.tsx           # Slide-in panel with all suggestions
├── CreateTaskFromSuggestionModal.tsx  # Task creation modal
└── index.ts                      # Component exports
```

#### Component Features

**NextActionBadge**:
- Urgency-based color coding (red/emerald/blue)
- Animated appearance
- Click to open suggestions panel
- Compact mode for space-constrained areas

**NextActionCard**:
- AI reasoning display
- Confidence score (0-100%)
- Recommended deadline with countdown
- Company/deal context
- One-click "Create Task" button
- Edit button (opens modal)
- Dismiss button with feedback

**NextActionPanel**:
- Slide-in from right
- Filter by urgency
- Urgency count badges
- Bulk actions (Accept All, Dismiss All)
- Regenerate suggestions button
- Real-time updates

**CreateTaskFromSuggestionModal**:
- Pre-filled with AI suggestion
- Editable fields: title, description, due date, priority
- Company/deal context display
- One-click task creation

### Integration (Phase 3)

```
src/components/MeetingCard.tsx (✅ UPDATED)
```

**Changes Made**:
1. Imported NextActionBadge and NextActionPanel
2. Added useNextActions hook to fetch suggestions
3. Added state for panel visibility
4. **List View**: Badge next to meeting title
5. **Grid View**: Badge in top-right corner with recent indicator
6. Panel component at component end

---

## 🔧 Configuration Required

### 1. Database Configuration

Set the following in Supabase dashboard or via SQL:

```sql
-- Set Supabase URL
ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';

-- Set Service Role Key
ALTER DATABASE postgres SET app.settings.service_role_key = 'your-service-role-key';
```

Or set at runtime in Edge Functions:
```typescript
SELECT set_config('app.settings.supabase_url', 'https://your-project.supabase.co', false);
SELECT set_config('app.settings.service_role_key', 'your-key', false);
```

### 2. Environment Variables

Ensure these are set in Supabase Edge Functions:

```bash
ANTHROPIC_API_KEY=your-anthropic-api-key
CLAUDE_MODEL=claude-haiku-4-5-20251001  # Optional, defaults to Haiku 4.5
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
```

### 3. Deploy Edge Function

```bash
# Deploy the suggest-next-actions function
supabase functions deploy suggest-next-actions
```

### 4. Run Migrations

```bash
# Apply database migrations
supabase db push

# Or manually run migrations in order:
# 1. 20251031120000_create_next_action_suggestions.sql
# 2. 20251031120001_create_next_actions_triggers.sql
```

---

## 📊 Database Schema

### next_action_suggestions Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `activity_id` | UUID | Source activity ID |
| `activity_type` | TEXT | meeting, activity, email, proposal, call |
| `deal_id` | UUID | Related deal (nullable) |
| `company_id` | UUID | Related company (nullable) |
| `contact_id` | UUID | Related contact (nullable) |
| `user_id` | UUID | Owner user ID |
| `action_type` | TEXT | Action category (e.g., send_roi_calculator) |
| `title` | TEXT | Suggestion title |
| `reasoning` | TEXT | AI explanation |
| `urgency` | TEXT | low, medium, high |
| `recommended_deadline` | TIMESTAMPTZ | Suggested due date |
| `confidence_score` | NUMERIC(3,2) | AI confidence (0.00-1.00) |
| `status` | TEXT | pending, accepted, dismissed, completed |
| `user_feedback` | TEXT | User feedback on suggestion |
| `created_task_id` | UUID | Created task reference |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `dismissed_at` | TIMESTAMPTZ | Dismissal timestamp |
| `accepted_at` | TIMESTAMPTZ | Acceptance timestamp |
| `completed_at` | TIMESTAMPTZ | Completion timestamp |
| `ai_model` | TEXT | AI model used |
| `context_quality` | NUMERIC(3,2) | Context quality score |

**Indexes**:
- `idx_next_actions_user_status` - User + status queries
- `idx_next_actions_activity` - Activity lookups
- `idx_next_actions_deal` - Deal-based queries
- `idx_next_actions_company` - Company-based queries
- `idx_next_actions_urgency_status` - Urgency filtering
- `idx_next_actions_deadline` - Deadline sorting

---

## 🚀 Usage Examples

### In React Components

```tsx
import { useNextActions } from '@/lib/hooks/useNextActions'
import { NextActionBadge, NextActionPanel } from '@/components/next-actions'

function MyComponent() {
  const [showPanel, setShowPanel] = useState(false)

  const {
    suggestions,
    pendingCount,
    highUrgencyCount,
    acceptSuggestion,
    dismissSuggestion
  } = useNextActions({
    activityId: meeting.id,
    activityType: 'meeting',
    status: 'pending'
  })

  return (
    <>
      {/* Show badge */}
      {pendingCount > 0 && (
        <NextActionBadge
          count={pendingCount}
          urgency={highUrgencyCount > 0 ? 'high' : 'medium'}
          onClick={() => setShowPanel(true)}
        />
      )}

      {/* Panel for all suggestions */}
      <NextActionPanel
        activityId={meeting.id}
        activityType="meeting"
        isOpen={showPanel}
        onClose={() => setShowPanel(false)}
      />
    </>
  )
}
```

### Manual Generation

```typescript
import { nextActionsService } from '@/lib/services/nextActionsService'

// Generate suggestions manually
const result = await nextActionsService.generateSuggestions(
  meetingId,
  'meeting',
  true // force regenerate
)

console.log(`Generated ${result.count} suggestions`)
```

### Database Functions

```sql
-- Get pending count for user
SELECT get_pending_suggestions_count();

-- Accept suggestion and create task
SELECT accept_next_action_suggestion(
  'suggestion-uuid'::UUID,
  '{"priority": "high"}'::JSONB
);

-- Dismiss suggestion
SELECT dismiss_next_action_suggestion(
  'suggestion-uuid'::UUID,
  'Not relevant to current priorities'
);

-- Regenerate for specific meeting
SELECT regenerate_next_actions_for_activity(
  'meeting-uuid'::UUID,
  'meeting'
);

-- Backfill recent meetings
SELECT backfill_next_actions_for_meetings(10);
```

---

## 🔄 Automatic Generation Flow

1. **Meeting/Activity Created** → Database trigger fires
2. **Trigger calls Edge Function** → Async via pg_net
3. **Edge Function analyzes context**:
   - Fetches meeting transcript
   - Gets company/deal/contact data
   - Retrieves recent activity history (last 30 days)
4. **Claude Haiku 4.5 generates suggestions**:
   - Analyzes full transcript
   - Identifies buying signals, concerns, objections
   - Recommends 2-4 specific actions with reasoning
5. **Suggestions stored in database**
6. **Real-time updates** → React components receive new suggestions
7. **Badge appears** → User sees count on meeting card

---

## 🎨 UI Integration Points

### ✅ Implemented

1. **Meeting Cards (Grid View)**:
   - Badge in top-right corner
   - Click opens suggestion panel

2. **Meeting Cards (List View)**:
   - Badge next to meeting title
   - Click opens suggestion panel

3. **Deal Cards in Pipeline**:
   - Badge below deal value
   - Shows aggregated suggestions for all deal-related activities
   - Click opens suggestion panel
   - Supports both split and non-split deals

4. **Company Detail Page** (Right Panel):
   - AI Suggestions card with badge
   - Shows aggregated suggestions for all company-related activities
   - "View All Suggestions" button opens panel
   - Positioned after Quick Actions section

5. **Contact Detail Page** (Right Panel):
   - AI Suggestions card with badge
   - Shows aggregated suggestions for all contact-related interactions
   - "View All Suggestions" button opens panel
   - Positioned after Active Deals section

6. **Next Action Panel**:
   - Accessible from any card badge
   - Filter by urgency
   - Bulk actions
   - Individual card actions
   - Supports activity, deal, company, and contact-level filtering

### 📋 Pending Implementation

1. **Dedicated AI Suggestions Page**:
   - `/ai-suggestions` route
   - Filterable list of all pending suggestions
   - Dashboard widgets

2. **Navigation Badge**:
   - Global pending count in nav
   - Link to dedicated page

---

## 🧪 Testing

### Manual Testing

1. **Create a meeting** with transcript/summary
2. **Wait ~30 seconds** for AI analysis
3. **Check meeting card** for badge
4. **Click badge** to open panel
5. **Accept suggestion** → Verify task created
6. **Dismiss suggestion** → Verify removed

### Database Testing

```sql
-- Check suggestions table
SELECT * FROM next_action_suggestions ORDER BY created_at DESC LIMIT 10;

-- Check meeting counts
SELECT id, title, next_actions_count FROM meetings WHERE next_actions_count > 0;

-- Test manual generation
SELECT regenerate_next_actions_for_activity(
  (SELECT id FROM meetings LIMIT 1),
  'meeting'
);
```

### API Testing

```bash
# Test Edge Function directly
curl -X POST https://your-project.supabase.co/functions/v1/suggest-next-actions \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "activityId": "meeting-uuid",
    "activityType": "meeting"
  }'
```

---

## 📈 Success Metrics

### Target KPIs

- **Suggestion Acceptance Rate**: >30%
- **Task Creation from Suggestions**: >50% of acceptances
- **User Feedback Rating**: >4/5
- **Suggestion Generation Latency**: <3 seconds
- **UI Responsiveness**: <100ms for all interactions

### Monitoring Queries

```sql
-- Acceptance rate
SELECT
  COUNT(*) FILTER (WHERE status = 'accepted') * 100.0 / COUNT(*) as acceptance_rate
FROM next_action_suggestions;

-- Average confidence score
SELECT AVG(confidence_score) FROM next_action_suggestions;

-- Suggestions by urgency
SELECT urgency, COUNT(*) FROM next_action_suggestions GROUP BY urgency;

-- Top action types
SELECT action_type, COUNT(*) FROM next_action_suggestions
GROUP BY action_type ORDER BY COUNT(*) DESC LIMIT 10;
```

---

## 💰 Cost Management

### Claude Haiku 4.5 Pricing
- **Input**: ~$1 per million tokens
- **Output**: ~$5 per million tokens

### Estimated Costs
- Average transcript: ~2,000 tokens input
- Average analysis: ~500 tokens output
- **Cost per analysis**: ~$0.005 (half a cent)
- **1,000 meetings/month**: ~$5/month

### Cost Controls
1. **Rate Limiting**: Max 100 suggestions/user/day
2. **Caching**: 24-hour cache on suggestions
3. **Cooldown**: 1-hour minimum between regenerations
4. **Context Quality**: Skip low-quality transcripts

---

## 🔒 Security & Permissions

### Row Level Security (RLS)

All policies enforce user ownership:

```sql
-- Users can only see their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON next_action_suggestions FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update their own suggestions
CREATE POLICY "Users can update own suggestions"
  ON next_action_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

-- Service role can insert (from Edge Function)
CREATE POLICY "Service role can insert suggestions"
  ON next_action_suggestions FOR INSERT
  WITH CHECK (true);
```

### Data Privacy

- All analysis respects RLS policies
- No data leaves Supabase except to Anthropic API
- Transcripts sent to Claude are not stored by Anthropic
- User feedback is stored for quality improvement

---

## 🐛 Troubleshooting

### No Suggestions Appearing

1. **Check Edge Function logs**:
   ```bash
   supabase functions logs suggest-next-actions
   ```

2. **Verify ANTHROPIC_API_KEY** is set

3. **Check database triggers**:
   ```sql
   SELECT * FROM pg_trigger WHERE tgname LIKE '%next_actions%';
   ```

4. **Verify meeting has transcript**:
   ```sql
   SELECT id, title, transcript_text FROM meetings WHERE transcript_text IS NOT NULL;
   ```

### Suggestions Not Real-Time

1. **Check WebSocket connection** in browser console
2. **Verify Supabase Realtime** is enabled for table
3. **Check React Query** cache settings

### Database Errors

1. **Check pg_net extension**:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. **Verify configuration**:
   ```sql
   SHOW app.settings.supabase_url;
   SHOW app.settings.service_role_key;
   ```

---

## 🚧 Remaining Implementation

### Phase 4: Additional Integrations (Complete)

- [x] Integrate into DealCard component
- [x] Add to Company detail page
- [x] Add to Contact detail page
- [ ] Create activity timeline integration (optional)

### Phase 5: Dedicated Page & Nav (Pending)

- [ ] Create `/ai-suggestions` page
- [ ] Add navigation menu item
- [ ] Add global badge counter
- [ ] Create dashboard widgets
- [ ] Build filtering/sorting interface

### Phase 6: Testing & Polish (Pending)

- [ ] E2E tests with Playwright
- [ ] Unit tests for service layer
- [ ] Performance optimization
- [ ] Error handling improvements
- [ ] User feedback collection

---

## 📚 Additional Resources

### Documentation
- [Anthropic Claude API](https://docs.anthropic.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Query](https://tanstack.com/query/latest)

### Related Files
- `/src/lib/hooks/useNextActions.ts` - React hook
- `/src/lib/services/nextActionsService.ts` - Service layer
- `/src/components/next-actions/` - UI components
- `/supabase/functions/suggest-next-actions/` - Edge Function
- `/supabase/migrations/202510311200*.sql` - Database schema

---

## ✅ Quick Start Checklist

- [ ] Set ANTHROPIC_API_KEY in Supabase
- [ ] Configure database settings (supabase_url, service_role_key)
- [ ] Run database migrations
- [ ] Deploy Edge Function
- [ ] Test with a meeting that has a transcript
- [ ] Verify badge appears on meeting card
- [ ] Test accept/dismiss functionality
- [ ] Monitor Claude API usage and costs

---

**Implementation Status**:
- **Phase 1-3**: ✅ Complete (Backend, Service Layer, UI Components)
- **Phase 4**: ✅ Complete (DealCard, Company page, Contact page integrations)
- **Phase 5**: 📋 Pending (Dedicated page and navigation)

**Current Status**: All core integrations complete. System is fully functional across meetings, deals, companies, and contacts. Ready for dedicated AI suggestions page and global navigation.
