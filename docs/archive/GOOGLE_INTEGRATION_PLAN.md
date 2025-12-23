# Google Workspace Integration - Implementation Plan

## Executive Summary
Implementing secure Google Workspace integration (Docs, Gmail, Calendar) using Supabase Edge Functions for OAuth and API proxying, ensuring no sensitive credentials are exposed to the frontend.

## Architecture Overview

### Key Principles (Learning from Previous Failure)
1. **NO OAuth in Frontend** - All OAuth handled by Edge Functions
2. **NO Secrets in Browser** - Client ID/Secret only in Edge Functions
3. **Token Security** - Encrypted storage in database, never exposed to frontend
4. **API Proxy Pattern** - All Google API calls through Edge Functions
5. **User-Specific Integration** - Each user connects their own Google account

## Database Schema (Already Created)
```sql
- google_integrations: OAuth tokens with encryption
- google_calendars: Cached calendar data
- google_drive_folders: Drive folder structure
- google_email_labels: Gmail labels
- google_docs_templates: Document templates
- google_service_logs: API activity logging
```

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

#### 1.1 Edge Functions Setup
Create the following Edge Functions (similar to Slack pattern):

```typescript
// supabase/functions/google-oauth-initiate/index.ts
- Generate OAuth URL with PKCE
- Store state in database
- Return authorization URL to frontend

// supabase/functions/google-oauth-callback/index.ts
- Handle OAuth callback
- Exchange code for tokens
- Encrypt and store tokens in google_integrations
- Return success/failure to frontend

// supabase/functions/google-token-refresh/index.ts
- Automatic token refresh
- Update expires_at timestamp
- Handle refresh failures
```

#### 1.2 API Proxy Functions
```typescript
// supabase/functions/google-docs/index.ts
- Create documents from templates
- Update existing documents
- Share documents

// supabase/functions/google-gmail/index.ts
- Send emails
- Read email threads
- Manage labels

// supabase/functions/google-calendar/index.ts
- Create/update events
- Fetch calendar list
- Check availability
```

### Phase 2: Frontend Implementation (Week 1-2)

#### 2.1 Integrations Page Structure
```
/src/pages/Integrations.tsx
/src/components/integrations/
  ├── GoogleIntegrationCard.tsx
  ├── ServiceToggle.tsx
  ├── ConnectionStatus.tsx
  ├── ActivityFeed.tsx
  └── ErrorRecovery.tsx
```

#### 2.2 State Management
```typescript
// /src/lib/stores/integrationStore.ts
interface IntegrationStore {
  googleConnection: {
    isConnected: boolean;
    email: string | null;
    services: {
      docs: boolean;
      gmail: boolean;
      calendar: boolean;
    };
    lastSync: Date | null;
  };
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  toggleService: (service: string) => Promise<void>;
}
```

#### 2.3 API Client
```typescript
// /src/lib/api/googleIntegration.ts
export const googleIntegrationApi = {
  // OAuth flow
  initiateOAuth: async () => {
    const { data } = await supabase.functions.invoke('google-oauth-initiate');
    window.location.href = data.authUrl;
  },
  
  // Service APIs (all through Edge Functions)
  docs: {
    createFromTemplate: (templateId: string, data: any) => 
      supabase.functions.invoke('google-docs', { body: { action: 'create', templateId, data } })
  },
  
  gmail: {
    sendEmail: (to: string, subject: string, body: string) =>
      supabase.functions.invoke('google-gmail', { body: { action: 'send', to, subject, body } })
  },
  
  calendar: {
    createEvent: (event: CalendarEvent) =>
      supabase.functions.invoke('google-calendar', { body: { action: 'create', event } })
  }
};
```

### Phase 3: Service Integration (Week 2)

#### 3.1 CRM Integration Points
- **Deals Page**: "Create Proposal" → Google Docs template
- **Contact Page**: "Send Email" → Gmail integration
- **Activity Page**: "Schedule Meeting" → Calendar integration

#### 3.2 Smart Actions
```typescript
// Quick Actions in Deal view
<QuickActions>
  <button onClick={() => createProposal(deal)}>
    <GoogleDocsIcon /> Create Proposal
  </button>
  <button onClick={() => scheduleFollowUp(deal)}>
    <CalendarIcon /> Schedule Follow-up
  </button>
  <button onClick={() => sendEmail(deal.contact)}>
    <GmailIcon /> Send Email
  </button>
</QuickActions>
```

### Phase 4: Testing & Security (Week 2-3)

#### 4.1 Security Checklist
- [ ] Verify no secrets in frontend code
- [ ] Test token encryption/decryption
- [ ] Verify RLS policies work correctly
- [ ] Test rate limiting on Edge Functions
- [ ] Audit logging for all API calls
- [ ] CORS configuration correct

#### 4.2 Testing Strategy
```typescript
// E2E Tests with Playwright
describe('Google Integration', () => {
  test('OAuth flow completes successfully', async ({ page }) => {
    await page.goto('/integrations');
    await page.click('[data-testid=connect-google]');
    // Mock OAuth flow
    await expect(page).toHaveURL('/integrations?status=connected');
  });
  
  test('Service toggles work correctly', async ({ page }) => {
    await page.click('[data-testid=toggle-gmail]');
    await expect(page.locator('[data-testid=gmail-status]')).toHaveText('Enabled');
  });
});
```

## Environment Configuration

### Required Environment Variables (Edge Functions only)
```env
# In Supabase Dashboard (NOT in .env files)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://xxx.supabase.co/functions/v1/google-oauth-callback
ENCRYPTION_KEY=xxx # For token encryption
```

### Frontend Configuration
```env
# .env.local (safe for frontend)
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
# NO Google credentials here!
```

## File Structure

```
sixty-sales-dashboard/
├── supabase/
│   ├── functions/
│   │   ├── google-oauth-initiate/
│   │   ├── google-oauth-callback/
│   │   ├── google-token-refresh/
│   │   ├── google-docs/
│   │   ├── google-gmail/
│   │   └── google-calendar/
│   └── migrations/
│       └── 20250110_google_integration_tables.sql
├── src/
│   ├── pages/
│   │   └── Integrations.tsx
│   ├── components/
│   │   └── integrations/
│   │       ├── GoogleIntegrationCard.tsx
│   │       ├── ServiceToggle.tsx
│   │       └── ConnectionStatus.tsx
│   ├── lib/
│   │   ├── api/
│   │   │   └── googleIntegration.ts
│   │   ├── stores/
│   │   │   └── integrationStore.ts
│   │   └── types/
│   │       └── google.types.ts
│   └── hooks/
│       └── useGoogleIntegration.ts
```

## Success Metrics
- OAuth success rate > 95%
- API response time < 500ms
- Token refresh success > 99%
- Zero security incidents
- User adoption > 60% in 30 days

## Risk Mitigation
1. **Token Exposure**: All tokens encrypted, never sent to frontend
2. **Rate Limiting**: Implement per-user quotas
3. **Scope Creep**: Start with MVP (basic operations only)
4. **API Changes**: Version lock Google API client
5. **User Confusion**: Clear UI with help tooltips

## Timeline
- **Week 1**: Edge Functions + OAuth flow
- **Week 2**: Frontend UI + Basic integration
- **Week 3**: Testing + Security audit
- **Week 4**: Launch to users

## Next Steps
1. Create Edge Functions for OAuth flow
2. Build Integrations page UI
3. Implement service-specific Edge Functions
4. Add integration points in CRM
5. Comprehensive testing
6. Security review
7. Deploy to production

## Key Differences from Failed Attempt
| Old (Failed) Approach | New (Correct) Approach |
|----------------------|------------------------|
| OAuth in frontend | OAuth in Edge Functions |
| Secrets in .env | Secrets in Supabase Dashboard |
| Direct Google API calls | All calls through Edge Functions |
| Tokens in localStorage | Tokens encrypted in database |
| Complex service classes | Simple API proxy pattern |

This plan ensures a secure, scalable implementation that avoids all the pitfalls of the previous attempt.