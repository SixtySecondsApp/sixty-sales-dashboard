# use60 - Pre & Post Meeting Command Centre

Sales intelligence platform that helps teams prepare for meetings and act on insights afterwards. Features meeting AI integration, pipeline tracking, smart task automation, and relationship health scoring.

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
- **Google Calendar**: Manual sync, events stored locally
- **Slack**: Pipeline alerts, win/loss notifications

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
