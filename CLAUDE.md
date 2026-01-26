# use60 - Pre & Post Meeting Command Centre

Sales intelligence platform that helps teams prepare for meetings and act on insights afterwards. Features meeting AI integration, pipeline tracking, smart task automation, and relationship health scoring.

---

## Product Vision: Proactive AI Sales Teammate

> **See full PRD**: [`docs/PRD_PROACTIVE_AI_TEAMMATE.md`](docs/PRD_PROACTIVE_AI_TEAMMATE.md)

### The Goal

Transform the 60 Copilot from a reactive AI assistant into a **proactive AI sales teammate** — a dedicated team member who knows your company inside-out, acts autonomously to help senior sales reps be more successful, and communicates regularly via Slack.

### Core Principles

1. **Team Member, Not Chatbot** — Addresses users by name, references their deals, speaks like a colleague
2. **Company-Specific Knowledge** — Products, competitors, pain points, brand voice (from onboarding)
3. **Proactive, Not Just Reactive** — Daily pipeline analysis, pre-meeting prep, task reminders via Slack
4. **HITL for External Actions** — Preview → Confirm pattern for emails, tasks, Slack posts
5. **Superpowers via Skills & Sequences** — Meeting prep in 30s, deal rescue plans, follow-up drafts
6. **Clarifying Questions** — When ambiguous, ask for clarification before executing

### The Transformation

```
BEFORE (Generic AI):
  User: "Help me with my meeting"
  AI:   "I'd be happy to help! What meeting would you like assistance with?"

AFTER (Your Team Member):
  [Slack, 2 hours before meeting]
  🤖: "Hey Sarah! Your TechCorp meeting is in 2 hours.
       I've prepared a brief with talking points.
       They're evaluating us against WidgetCo — I have positioning ready.
       [View Brief] [Add Notes]
       Good luck! 🎯"
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Specialized Persona** | After onboarding, copilot knows company inside-out |
| **Proactive Slack** | Daily pipeline summary, pre-meeting briefs, task reminders |
| **Clarifying Questions** | Detects ambiguity, offers options, then executes |
| **HITL Confirmation** | Preview external actions before executing |
| **Engagement Tracking** | Measure value delivered, optimize outreach |
| **Copilot Lab** | World-class testing platform for skills/sequences |

### Active Development

**Execution Plan**: `.sixty/plan-copilot-lab-specialized.json` (24 stories across 7 phases)

| Phase | Focus | Status |
|-------|-------|--------|
| 1 | Specialized Team Member Persona | Pending |
| 2 | Proactive Agent Workflows | Pending |
| 3 | Engagement Tracking | Pending |
| 4 | Enhanced Personalization | Pending |
| 5 | Periodic Re-Enrichment | Pending |
| 6-7 | Copilot Lab Improvements | Pending |

---

## URLs & Ports

| Environment | Main App | Landing Pages |
|-------------|----------|---------------|
| **Production** | app.use60.com | www.use60.com |
| **Development** | localhost:5175 | localhost:5173 |

## Tech Stack

**Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Framer Motion
**State**: Zustand (client) + React Query (server)
**Backend**: Supabase (PostgreSQL, Edge Functions, RLS, Realtime)
**Auth**: Dual support - Supabase Auth or Clerk
**Structure**: Monorepo with `/packages/landing` for marketing site

## Critical Rules

### Always Do
- Read files before editing - never modify blind
- Use absolute paths for all file operations
- Follow existing patterns in the codebase
- Use `maybeSingle()` when record might not exist
- Explicit column selection in edge functions (not `select('*')`)
- Async/await over `.then()` chains
- Handle errors with toast feedback to users

### Never Do
- Expose service role key to frontend
- Use `single()` when record might not exist (throws PGRST116)
- Auto-commit without explicit user request
- Skip TypeScript strict mode

## Database Column Gotchas

**CRITICAL**: Different tables use different column names for user ownership!

| Table | User Column | Notes |
|-------|-------------|-------|
| `meetings` | `owner_user_id` | **NOT `user_id`** - common error! |
| `contacts` | `user_id` | Standard |
| `deals` | `user_id` | Standard |
| `activities` | `user_id` | Standard |
| `tasks` | `user_id` | Standard |
| `calendar_events` | `user_id` | Standard |
| `workflow_executions` | `user_id` | Standard |

**Always verify column names before writing migrations or queries!**

## Query Patterns

```typescript
// When record might not exist - use maybeSingle()
const { data } = await supabase
  .from('calendar_events')
  .select('id')
  .eq('external_id', eventId)
  .maybeSingle();  // Returns null gracefully

// When record MUST exist - use single()
const { data } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', userId)
  .single();  // Throws PGRST116 if not found
```

## Key Architecture

### Service Locator Pattern
Central DI container at `/src/lib/services/ServiceLocator.tsx`:
```typescript
const { dealService, activityService } = useServices();
```

### Data Flow
```
User Action → React Component
    → useQuery/useMutation (React Query)
    → Service Layer
    → Supabase Client
    → PostgreSQL (with RLS)
```

### State Management
- **Zustand**: UI state, user preferences, active org
- **React Query**: Server data, caching, real-time sync
- **URL State**: Filters, pagination, search

## File Structure

```
src/
├── components/        # React components
│   └── ui/           # Radix UI primitives
├── lib/
│   ├── hooks/        # Custom React hooks
│   ├── services/     # API service classes
│   ├── stores/       # Zustand stores
│   └── utils/        # Utility functions
├── pages/            # Route components
supabase/
├── functions/        # Edge functions (Deno)
└── migrations/       # SQL migrations
packages/
└── landing/          # Marketing site (Vite)
```

## Common Commands

```bash
npm run dev           # Start main app (port 5175)
npm run build         # Production build
npm run test          # Run tests
npm run playwright    # E2E tests

# Landing pages
cd packages/landing
npm run dev           # Start landing (port 5173)
```

## Key Integrations

- **Fathom**: Meeting transcripts → auto-indexed for AI search
- **60 Notetaker (MeetingBaaS)**: Bot-based meeting recording with S3 storage
- **Google Calendar**: Manual sync, events stored locally
- **Slack**: Pipeline alerts, win/loss notifications
- **Google Gemini**: AI copilot powered by Gemini Flash (function calling)

## Cursor Rules

See `.cursor/rules/` for detailed patterns:

| File | Purpose |
|------|---------|
| `index.mdc` | Project overview, critical rules (always applies) |
| `architecture.mdc` | System design, Service Locator pattern |
| `conventions.mdc` | Code style, naming conventions |
| `patterns.mdc` | React Query, Zustand, forms |
| `api.mdc` | Edge functions, error handling |
| `database.mdc` | Schema, RLS, migrations |
| `components.mdc` | UI patterns, modals, wizards |
| `integrations.mdc` | External services (Calendar, Fathom, Slack) |
| `slack-blocks.mdc` | Slack Block Kit reference |

## Authorization

```typescript
import { isUserAdmin, canEditDeal } from '@/lib/utils/adminUtils';

// Check admin status
if (isUserAdmin(userData)) { /* admin actions */ }

// Check deal permissions
if (canEditDeal(deal, userData)) { /* edit allowed */ }
```

## UI Components

use60 uses Radix UI primitives:

```tsx
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { toast } from 'sonner';
```

## Copilot System

> **Full PRD**: [`docs/PRD_PROACTIVE_AI_TEAMMATE.md`](docs/PRD_PROACTIVE_AI_TEAMMATE.md)

The AI Copilot is powered by **Google Gemini Flash** with function calling. The goal is to transform it into a **proactive AI sales teammate** that acts like a dedicated team member.

### Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│  PROACTIVE AI SALES TEAMMATE                                   │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  REACTIVE MODE (User Asks)                                     │
│  └── User message → Skill/Sequence → HITL → Response          │
│                                                                │
│  PROACTIVE MODE (Agent Initiates)                              │
│  └── Cron analysis → Opportunity → Execute → Slack notify     │
│                                                                │
│  CLARIFYING MODE (Ambiguous Request)                           │
│  └── Detect ambiguity → Offer options → Execute selection     │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 4-Tool Architecture
The copilot exposes exactly 4 tools to the AI model:

| Tool | Purpose |
|------|---------|
| `list_skills` | Lists available skills for the organization |
| `get_skill` | Retrieves a compiled skill document |
| `execute_action` | Executes CRM actions and runs skills/sequences |
| `resolve_entity` | Resolves ambiguous person references (first-name-only) |

### Key Files
- `supabase/functions/api-copilot/index.ts` - Main edge function (~14,000 lines)
- `supabase/functions/_shared/salesCopilotPersona.ts` - Persona compilation (planned)
- `supabase/functions/proactive-pipeline-analysis/` - Daily analysis cron (planned)
- `src/lib/contexts/CopilotContext.tsx` - State management
- `src/components/copilot/CopilotRightPanel.tsx` - Right panel UI
- `src/components/copilot/responses/` - 48 structured response components

### Specialized Persona (from Onboarding)

After onboarding, a specialized persona is compiled from enrichment data:

```
You are {rep_name}'s dedicated sales analyst at {company_name}.
Think of yourself as their brilliant junior colleague who has superpowers.

COMPANY KNOWLEDGE:
- Products: {products}
- Competitors: {competitors}
- Pain points: {pain_points}
- Brand voice: {brand_tone}

HITL (always confirm external actions):
- Preview emails → wait for Confirm → then send
```

### Proactive Workflows (Slack-First)

| Workflow | Trigger | Action |
|----------|---------|--------|
| Pipeline Analysis | Daily 9am | Analyze → Slack summary |
| Pre-Meeting Prep | 2hrs before | Auto-prep → Slack brief |
| Task Reminders | Daily | Find overdue → Slack with actions |
| Deal Stall Alert | 7+ days inactive | Alert → Offer follow-up |

### Skill-first execution (not prompt-by-prompt)

Copilot should behave like: **user intent → skill/sequence selection → tool execution → structured response panel**.

- **Backend (edge function)**: emits `tool_executions` telemetry + (when applicable) a `structuredResponse` that the UI can render as a rich, clickable card.
- **Frontend**: shows a “working story” while tools run (stepper/progress), then swaps in the structured panel when the response arrives.

#### Deterministic (skill/sequence-driven) workflows

For high-frequency flows we want consistent behavior (and consistent UX), we treat them as deterministic workflows:

- **Search meetings (today/tomorrow)**: runs `execute_action(get_meetings_for_period)` and returns a `meeting_list` structured response.
- **Prep for next meeting**: runs `execute_action(run_sequence)` with `seq-next-meeting-command-center` in simulation mode first (preview), then renders `next_meeting_command_center`.
- **Create follow-ups**: runs `execute_action(run_sequence)` with `seq-post-meeting-followup-pack` in simulation mode first (preview), then renders `post_meeting_followup_pack`.

#### Confirmation pattern (preview → confirm)

When a sequence is run in `is_simulation: true`, the assistant message stores `pending_action` so a user reply like “Confirm” can execute the same sequence with `is_simulation: false`.

This is the standard pattern for “create task / post Slack / send email” flows: **preview first, then confirm**.

### Copilot UI contracts (critical)

#### 1) Clickable actions contract (do not ad-hoc window.location)

Structured response components should emit these actions via `onActionClick` (handled centrally):

- **In-app**: `open_contact`, `open_deal`, `open_meeting`, `open_task`
- **External**: `open_external_url` (always new tab)

Handler: `src/components/assistant/AssistantShell.tsx`

Backwards-compatible legacy aliases (`open_meeting_url`, `view_meeting`, `view_task`) exist but new work should use the standard names above.

#### 2) “Working story” stepper

While Copilot is processing, we show a stepper (and the right-panel progress) based on a `ToolCall.steps[]` list.

- Placeholder steps are created client-side using `detectToolType()` and `createToolCall()` (`src/lib/contexts/CopilotContext.tsx`)
- Real tool telemetry from the backend (`tool_executions`) replaces the placeholder once the response arrives

Tool UI components:
- `src/components/copilot/ToolCallIndicator.tsx`
- `src/components/copilot/ChatMessage.tsx`
- `src/components/copilot/CopilotRightPanel.tsx` (derives progress steps)

### Template Variables Pattern
```typescript
// Backend: Use resolvePath() for nested paths with array indices
resolvePath(context, 'outputs.leads[0].contact.name');

// Backend: resolveExpression() handles both full and embedded variables
resolveExpression('${foo}', context);           // Full replacement
resolveExpression('Hello ${foo}!', context);    // Embedded interpolation

// UI Fallback: Clean unresolved variables for legacy data
import { cleanUnresolvedVariables } from '@/lib/utils/templateUtils';
cleanUnresolvedVariables('Task for ${name}'); // → "Task for contact"
```

### Email Generation Pattern
Always include current date context in email prompts:
```typescript
const currentDateStr = new Date().toLocaleDateString('en-US', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
});
// Add to prompt: "TODAY'S DATE: ${currentDateStr}"
// Add instruction: "Use this date when making any date references"
```

### Calendar Events Pattern
Filter for real meetings (exclude solo blocks):
```typescript
// attendees_count > 1 means user + at least one other person
const { data } = await supabase
  .from('calendar_events')
  .select('*')
  .gt('attendees_count', 1)  // Excludes focus time, reminders
  .gte('start_time', new Date().toISOString())
  .order('start_time')
  .limit(5);  // Fetch more when filtering
```

## 60 Notetaker (MeetingBaaS) Integration

Bot-based meeting recording system that joins Zoom/Meet/Teams calls.

### Key Files
- `supabase/functions/auto-join-scheduler/` - Cron job deploys bots
- `supabase/functions/deploy-recording-bot/` - Bot deployment
- `supabase/functions/meetingbaas-webhook/` - Webhook handler
- `supabase/functions/generate-s3-video-thumbnail/` - Thumbnail generation
- `supabase/functions/process-recording/` - AI analysis

### Recording Flow
1. `auto-join-scheduler` (cron every 2 min) finds upcoming meetings
2. `deploy-recording-bot` sends bot to meeting via MeetingBaaS API
3. `meetingbaas-webhook` receives status updates and completion
4. Recording uploaded to S3: `meeting-recordings/{org_id}/{user_id}/{recording_id}/`
5. `process-recording` generates AI summary, highlights, action items
6. `generate-s3-video-thumbnail` creates thumbnail via Lambda

### Thumbnail Generation Pattern
Uses existing Fathom Lambda with presigned S3 URLs:
```typescript
// Generate presigned URL for private S3 video
const signedUrl = await getSignedUrl(s3Client, new GetObjectCommand({
  Bucket: bucketName,
  Key: s3Key,
}), { expiresIn: 60 * 15 }); // 15 min

// Call Lambda with presigned URL (Lambda accepts any video URL)
const response = await fetch(lambdaUrl, {
  method: 'POST',
  body: JSON.stringify({ fathom_url: signedUrl }),
});
// Returns: { http_url, s3_location }
```

### Required Secrets (Edge Functions)
- `MEETINGBAAS_API_KEY` - API access
- `MEETINGBAAS_WEBHOOK_SECRET` - Signature verification
- `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

### Required Vault Secret (for cron)
- Name: `service_role_key`
- Value: Supabase service role key
- Used by: `call_auto_join_scheduler()` SQL function

### Source Type Column
```sql
-- meetings.source_type can be:
-- 'fathom' (default), '60_notetaker', 'manual'
WHERE source_type = '60_notetaker'
```

## Security Architecture

> **Full Documentation**: [`docs/SECURITY_HARDENING_GUIDE.md`](docs/SECURITY_HARDENING_GUIDE.md)
> **Implementation Summary**: [`docs/SECURITY_IMPLEMENTATION_SUMMARY.md`](docs/SECURITY_IMPLEMENTATION_SUMMARY.md)

### Defense-in-Depth Security Model

use60 implements a comprehensive security architecture to protect user data, learned from Clawdbot vulnerability analysis where exposed AI control interfaces led to credential theft, conversation history exfiltration, and perception manipulation attacks.

**Key Achievement**: Multi-layered defense system that protects user data even if the edge function is compromised.

### Security Layers

```
┌────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                              │
│  - User authentication via JWT                                 │
└────────────┬───────────────────────────────────────────────────┘
             │ JWT token
             ↓
┌────────────────────────────────────────────────────────────────┐
│  Edge Function (api-copilot)                                   │
│  - User-scoped client (default) ← Layer 1: Minimal Permissions│
│  - Service role (justified only, audited)                      │
└────────────┬───────────────────────────────────────────────────┘
             │ User JWT
             ↓
┌────────────────────────────────────────────────────────────────┐
│  Row Level Security (RLS) ← Layer 2: Database Enforcement      │
│  - User isolation enforced                                     │
│  - Org sharing configurable (admin-controlled)                 │
│  - Copilot conversations ALWAYS private                        │
└────────────┬───────────────────────────────────────────────────┘
             │ Filtered query
             ↓
┌────────────────────────────────────────────────────────────────┐
│  Database (Supabase) ← Layer 3: Data Isolation                 │
│  - Only user's data returned                                   │
│  - Audit logs preserved                                        │
└────────────┬───────────────────────────────────────────────────┘
             │
             ↓
┌────────────────────────────────────────────────────────────────┐
│  Security Monitoring ← Layer 4: Threat Detection               │
│  - Anomaly detection active (credential harvesting, exfiltration)│
│  - Real-time alerting                                          │
│  - Automated incident response                                 │
└────────────────────────────────────────────────────────────────┘
```

### Dynamic Data Sharing Model

**Org Settings Table**: Admin-configurable data sharing preferences

```sql
-- org_settings table
enable_crm_sharing: true       -- Contacts, deals (default: shared)
enable_meeting_sharing: true   -- Meetings (default: shared)
enable_task_sharing: false     -- Tasks (default: private)
enable_email_sharing: false    -- Emails (default: private)
enable_copilot_sharing: false  -- ALWAYS false (enforced by CHECK constraint)
```

**Dynamic RLS**: Policies check org settings at runtime

```typescript
// Example: Contacts policy
// User can see own contacts OR (if CRM sharing enabled) org members' contacts
SELECT * FROM contacts WHERE
  owner_id = auth.uid()
  OR (is_crm_sharing_enabled() AND user_in_same_org(owner_id))
```

### Copilot Conversation Privacy

**Strict Isolation**: Conversations are ALWAYS user-private, never shared

- ✅ User can read own conversations
- ❌ Org admins CANNOT read conversations (even with admin role)
- ❌ Service role CANNOT bypass (RLS enforced)
- ✅ Export rate limiting: Max 10 exports/hour (prevents bulk exfiltration)
- ✅ Access logging: Every read logged to security_audit_log
- ✅ Retention policies: Auto-archive after 365 days, GDPR right to erasure

**Why Strict**: Conversation history contains strategic intelligence:
- Months of context about deals, contacts, planning
- User's thinking patterns and decision-making
- Competitive intelligence and business strategy

### Service Role Minimization

**Current State** (needs refactoring):
```typescript
// ❌ DANGEROUS: Service role bypasses ALL security
const client = createClient(url, SERVICE_ROLE_KEY)
const { data } = await client.from('copilot_conversations').select('*')
// Returns ALL users' conversations! Compromised function = game over
```

**Target State**:
```typescript
// ✅ SAFE: User-scoped client respects RLS
const userClient = createClient(url, ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
})
const { data } = await userClient.from('copilot_conversations').select('*')
// Returns ONLY current user's conversations (RLS enforced)

// Service role ONLY for justified cases (documented and audited)
const serviceClient = createClient(url, SERVICE_ROLE_KEY)
// Use ONLY for: org-wide persona compilation, cross-user analytics
```

**Refactoring Guide**: `supabase/functions/api-copilot/SERVICE_ROLE_REFACTOR.md`

### Security Monitoring

**Real-time Dashboard** (for org admins):
- **Health Score**: 0-100 based on incidents, suspicious activity, RLS coverage
- **Anomaly Detection**:
  - Credential harvesting: >50 accesses/hour = critical threat
  - Conversation exfiltration: >5 exports in 10min = critical threat
- **GDPR Compliance**: Automated checks for retention policies, access logging, right to erasure

**Key Functions**:
```sql
-- Daily monitoring
SELECT * FROM get_security_health_score(org_id);
SELECT * FROM detect_credential_harvesting();
SELECT * FROM detect_conversation_exfiltration();

-- Compliance reporting
SELECT * FROM generate_gdpr_compliance_report(org_id);
```

**Automated Incident Response**:
- Critical events trigger: System warnings, audit logs, Slack alerts (TODO)
- Rate limiting: Automatic enforcement on suspicious activity
- Access logs: Comprehensive audit trail for forensic analysis

### Key Migrations

| Migration | Purpose |
|-----------|---------|
| `20260126000000_comprehensive_security_hardening.sql` | RLS policies, org_settings, audit logging |
| `20260126000001_copilot_conversation_protection.sql` | Retention policies, export limits, GDPR compliance |
| `20260126000002_security_monitoring_dashboard.sql` | Health score, anomaly detection, compliance reporting |

### Security Best Practices

**Always Do**:
- Use user-scoped client by default (respects RLS)
- Log all privileged operations to security_audit_log
- Validate RLS policies before deployment: `SELECT * FROM check_missing_rls_policies()`
- Monitor security dashboard daily: `SELECT * FROM security_dashboard`

**Never Do**:
- Use service role without justification and documentation
- Share copilot conversations (enforced by CHECK constraint)
- Skip RLS validation before deploying migrations
- Ignore security alerts from anomaly detection

### Maintenance Schedule

| Frequency | Task |
|-----------|------|
| **Daily** | Review security dashboard, check critical events |
| **Weekly** | Review audit logs, verify automated maintenance |
| **Monthly** | GDPR compliance report, update org settings |
| **Quarterly** | Rotate API keys, test incident response |
| **Annually** | Rotate service role keys, penetration testing |

## Supabase Project References

| Environment | Project Ref | Usage |
|-------------|-------------|-------|
| **Production** | `ygdpgliavpxeugaajgrb` | app.use60.com |
| **Staging** | `caerqjzvuerejfrdtygb` | Testing |
