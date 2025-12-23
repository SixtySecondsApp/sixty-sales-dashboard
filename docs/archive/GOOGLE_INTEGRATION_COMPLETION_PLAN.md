# Google Workspace Integration - Completion Plan

## 🎯 Current Status
✅ **Completed:**
- Database schema with all Google integration tables
- OAuth initiate Edge Function with PKCE security
- OAuth callback Edge Function for token exchange
- Migration made idempotent (handles existing tables)

## 📋 Remaining Implementation Tasks

### Phase 1: Frontend Foundation (Priority 1)

#### 1.1 Create Integrations Page
```typescript
// src/pages/Integrations.tsx
- Main integrations hub page
- Route: /integrations
- Add to navigation menu between "Insights" and "Admin"
```

#### 1.2 Build Core Components
```
src/components/integrations/
├── GoogleIntegrationCard.tsx    // Main Google connection UI
├── ServiceToggle.tsx            // Toggle individual services
├── ConnectionStatus.tsx         // Show connection health
├── IntegrationActivity.tsx     // Recent activity feed
└── ErrorRecovery.tsx           // Handle connection errors
```

#### 1.3 Create API Client
```typescript
// src/lib/api/googleIntegration.ts
export const googleApi = {
  // OAuth flow (no secrets in frontend!)
  initiateOAuth: async () => {
    const { data } = await supabase.functions.invoke('google-oauth-initiate');
    window.location.href = data.authUrl;
  },
  
  // Check connection status
  getStatus: async () => {
    const { data } = await supabase
      .from('google_integrations')
      .select('email, is_active, expires_at')
      .single();
    return data;
  },
  
  // Disconnect integration
  disconnect: async () => {
    const { error } = await supabase
      .from('google_integrations')
      .delete()
      .eq('user_id', userId);
    return { error };
  }
};
```

### Phase 2: Service Proxy Edge Functions (Priority 2)

#### 2.1 Gmail Edge Function
```typescript
// supabase/functions/google-gmail/index.ts
- Send emails from CRM
- Read email threads
- Manage labels
- Search emails
```

#### 2.2 Calendar Edge Function
```typescript
// supabase/functions/google-calendar/index.ts
- Create/update events
- Check availability
- Sync calendars
- Meeting scheduling
```

#### 2.3 Drive Edge Function (Limited Scope)
```typescript
// supabase/functions/google-drive/index.ts
- List folders
- Upload files
- Share documents
- Search files
```

**Note: NO Google Docs integration in Deal pages per requirement**

### Phase 3: CRM Integration Points (Priority 3)

#### 3.1 Contact Page Integration
```typescript
// In ContactRecord.tsx
<QuickActions>
  <button onClick={() => sendEmail(contact)}>
    <GmailIcon /> Send Email
  </button>
  <button onClick={() => scheduleCall(contact)}>
    <CalendarIcon /> Schedule Call
  </button>
</QuickActions>
```

#### 3.2 Activity Page Integration
```typescript
// In ActivityLog.tsx
<ActivityActions>
  <button onClick={() => logToCalendar(activity)}>
    <CalendarIcon /> Add to Calendar
  </button>
  <button onClick={() => sendFollowUp(activity)}>
    <GmailIcon /> Send Follow-up
  </button>
</ActivityActions>
```

#### 3.3 Dashboard Widgets
```typescript
// In Dashboard.tsx
<GoogleIntegrationWidget>
  - Today's calendar events
  - Recent emails from prospects
  - Quick compose email
</GoogleIntegrationWidget>
```

### Phase 4: State Management (Priority 2)

#### 4.1 Zustand Store
```typescript
// src/lib/stores/integrationStore.ts
interface IntegrationState {
  google: {
    isConnected: boolean;
    email: string | null;
    services: {
      gmail: boolean;
      calendar: boolean;
      drive: boolean;
    };
    lastSync: Date | null;
    status: 'connected' | 'disconnected' | 'error' | 'refreshing';
  };
  
  // Actions
  checkGoogleConnection: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  toggleService: (service: keyof services) => Promise<void>;
  syncGoogle: () => Promise<void>;
}
```

#### 4.2 React Query Hooks
```typescript
// src/hooks/useGoogleIntegration.ts
export const useGoogleIntegration = () => {
  return useQuery({
    queryKey: ['google-integration'],
    queryFn: googleApi.getStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useGoogleCalendarEvents = (enabled: boolean) => {
  return useQuery({
    queryKey: ['google-calendar-events'],
    queryFn: () => supabase.functions.invoke('google-calendar', {
      body: { action: 'list-events' }
    }),
    enabled,
    staleTime: 60 * 1000, // 1 minute
  });
};
```

### Phase 5: Testing & Security (Priority 1)

#### 5.1 Environment Configuration
```bash
# Supabase Dashboard Secrets (NOT in .env files!)
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://xxx.supabase.co/functions/v1/google-oauth-callback
FRONTEND_URL=https://yourdomain.com
```

#### 5.2 Security Checklist
- [ ] Verify no Google secrets in frontend code
- [ ] Test token refresh mechanism
- [ ] Verify RLS policies work correctly
- [ ] Test rate limiting on Edge Functions
- [ ] Validate CORS configuration
- [ ] Check error handling for expired tokens

#### 5.3 Testing Plan
```typescript
// tests/integration/google-oauth.test.ts
describe('Google OAuth Flow', () => {
  test('initiates OAuth with PKCE', async () => {
    // Test OAuth initiation
  });
  
  test('handles callback correctly', async () => {
    // Test callback processing
  });
  
  test('refreshes expired tokens', async () => {
    // Test token refresh
  });
});
```

## 🚀 Implementation Order

### Week 1: Frontend & Basic Integration
1. ✅ Database migration (DONE)
2. ✅ OAuth Edge Functions (DONE)
3. **Build Integrations page UI**
4. **Create frontend API client**
5. **Add state management**

### Week 2: Service Integration
6. **Create Gmail Edge Function**
7. **Create Calendar Edge Function**
8. **Create Drive Edge Function**
9. **Add service-specific UI components**

### Week 3: CRM Integration & Testing
10. **Add Gmail to Contact pages**
11. **Add Calendar to Activity pages**
12. **Add Dashboard widgets**
13. **Complete E2E testing**
14. **Security audit**

## 📊 Success Metrics
- OAuth connection success rate >95%
- Token refresh success rate >99%
- API response time <500ms
- Zero security incidents
- User adoption >60% in 30 days

## ⚠️ Important Notes

### What We're NOT Building
- ❌ Google Docs integration in Deal pages (per requirement)
- ❌ Automatic document generation from deals
- ❌ Deal proposal templates in Google Docs

### What We ARE Building
- ✅ Gmail integration for sending emails from contacts
- ✅ Calendar integration for scheduling meetings
- ✅ Drive integration for file storage (but not Docs editing)
- ✅ Standalone Integrations page for all connections

## 🔐 Security Architecture

```
Frontend                    Edge Functions              Database
--------                    --------------              --------
Integrations Page   ---->   google-oauth-initiate  ---> google_oauth_states
     |                           |                           |
     v                           v                           v
  API Client        ---->   google-oauth-callback  ---> google_integrations
     |                           |                           |
     v                           v                           v
  UI Components     ---->   google-gmail          ---> google_service_logs
                    ---->   google-calendar
                    ---->   google-drive
```

## 🎨 UI Flow

```
1. User navigates to /integrations
2. Sees Google Workspace card (disconnected)
3. Clicks "Connect Google Workspace"
4. Redirected to Google OAuth consent
5. Returns to /integrations?status=connected
6. Can now toggle individual services
7. Services appear in relevant CRM pages
```

## 🧪 Testing Requirements

### Unit Tests
- [ ] Component rendering tests
- [ ] API client function tests
- [ ] State management tests
- [ ] Edge Function logic tests

### Integration Tests
- [ ] Complete OAuth flow
- [ ] Service API calls
- [ ] Token refresh mechanism
- [ ] Error recovery flows

### E2E Tests
- [ ] User connects Google account
- [ ] User sends email from Contact page
- [ ] User schedules meeting from Activity
- [ ] User disconnects integration

## 📝 Documentation Needed

### For Developers
- Edge Function deployment guide
- Environment variable setup
- Testing instructions
- Troubleshooting guide

### For Users
- How to connect Google Workspace
- Using Gmail integration
- Using Calendar integration
- Privacy and security FAQ

## ✅ Definition of Done

- [ ] All Edge Functions deployed and tested
- [ ] Integrations page fully functional
- [ ] Gmail integration working in Contact pages
- [ ] Calendar integration working in Activity pages
- [ ] All tests passing (>80% coverage)
- [ ] Security audit completed
- [ ] Documentation complete
- [ ] Code reviewed and approved
- [ ] Deployed to production

## 🚦 Go/No-Go Criteria

### Ready for Production When:
1. OAuth flow works end-to-end
2. Token refresh works automatically
3. All security checks pass
4. Performance meets targets (<500ms)
5. Error handling is comprehensive
6. User documentation is complete

This plan ensures a secure, user-friendly Google Workspace integration while explicitly excluding Google Docs from the Deal pages as requested.