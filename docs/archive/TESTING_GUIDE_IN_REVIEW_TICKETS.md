# Testing Guide - In Review Tickets

**Project:** Sixty v1 (Meetings)  
**Project ID:** `7a62ba1e-74c5-4c57-801b-b15e82ab1ecc`  
**Branch:** `meetings-feature-v1`

---

## 🎯 In Review Tickets Summary

Based on EPIC_COMPLETION_STATUS.md, these tickets are "In Review":

1. **TSK-0218:** Phase 1.1 - Create Onboarding Flow Controller
2. **TSK-0219:** Phase 1.2 - Enhanced Empty States  
3. **TSK-0223:** Phase 2.1 - Create Unified AI Settings Page
4. **TSK-0224:** Phase 2.2 - Add Model Resolution Layer
5. **TSK-0226:** Phase 3.1 - Enhanced Talk Time Visualization
6. **TSK-0227:** Phase 3.2 - Sentiment Dashboard
7. **TSK-0228:** Phase 4.1 - Simplified Proposal Mode
8. **TSK-0229:** Phase 4.2 - Meeting Type Classification ✅ (Just Fixed)

---

## 🚀 Quick Setup

1. **Ensure you're on the correct branch:**
   ```bash
   git checkout meetings-feature-v1
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open browser:** http://localhost:5173

---

## ⚠️ Changes Needed (Not Complete)

These tickets are marked "In Review" but require additional work to be fully functional:

1. **TSK-0226:** Phase 3.1 - Enhanced Talk Time Visualization (Components exist but not integrated)
2. **TSK-0227:** Phase 3.2 - Sentiment Dashboard (Components exist but not integrated)
3. **TSK-0228:** Phase 4.1 - Quick Mode Proposal (Toggle exists but may have visibility issues)

See "Changes Needed" section below for details.

---

## 📋 Testing Instructions by Ticket

### TSK-0218: Phase 1.1 - Onboarding Flow Controller

**Status:** ✅ Implemented  
**URL:** `/onboarding`

#### How to Test:

1. **Option A: New User Signup**
   - Sign up a new account
   - You should be automatically redirected to `/onboarding`

2. **Option B: Reset Onboarding (Existing User)**
   ```sql
   -- Run in Supabase SQL Editor
   UPDATE user_onboarding_progress 
   SET onboarding_completed_at = NULL, 
       onboarding_step = 'welcome',
       skipped_onboarding = false
   WHERE user_id = 'your-user-id';
   ```
   - Then navigate to: `http://localhost:5173/onboarding`

3. **Option C: Direct Navigation**
   - Navigate directly to: `http://localhost:5173/onboarding`
   - (May not work if onboarding is already completed)

#### What to Verify:

- ✅ **Welcome Step** appears first
- ✅ **Fathom Connection Step** with OAuth button
- ✅ **Sync Progress Step** shows sync happening
- ✅ **Completion Step** with success message
- ✅ Navigation between steps works (Next/Back buttons)
- ✅ Skip onboarding button works
- ✅ After completion, redirects to `/meetings`

#### Files to Check:
- `src/pages/onboarding/index.tsx`
- `src/pages/onboarding/WelcomeStep.tsx`
- `src/pages/onboarding/FathomConnectionStep.tsx`
- `src/pages/onboarding/SyncProgressStep.tsx`
- `src/pages/onboarding/CompletionStep.tsx`

---

### TSK-0219: Phase 1.2 - Enhanced Empty States

**Status:** ✅ Implemented  
**URL:** `/meetings`

#### How to Test:

1. **Test Case 1: Fathom Not Connected**
   ```sql
   -- Disconnect Fathom (if connected)
   DELETE FROM fathom_integrations WHERE user_id = 'your-user-id';
   ```
   - Navigate to: `http://localhost:5173/meetings`
   - **Expected:** See connection CTA with "Connect Fathom" button

2. **Test Case 2: Fathom Connected, No Meetings**
   - Ensure Fathom is connected
   - Ensure no meetings exist for your user
   - Navigate to: `http://localhost:5173/meetings`
   - **Expected:** See guidance message + manual sync button

3. **Test Case 3: Syncing**
   - Start a sync (click sync button)
   - **Expected:** See progress indicator

4. **Test Case 4: Meetings Exist**
   - Ensure you have meetings synced
   - Navigate to: `http://localhost:5173/meetings`
   - **Expected:** See normal meetings list (grid or table view)

#### What to Verify:

- ✅ Empty state component shows contextual content
- ✅ Connection CTA appears when Fathom not connected
- ✅ Guidance appears when connected but no meetings
- ✅ Manual sync button works
- ✅ Progress indicator shows during sync

#### Files to Check:
- `src/components/meetings/MeetingsEmptyState.tsx`
- `src/components/meetings/MeetingsList.tsx` (uses MeetingsEmptyState)

---

### TSK-0223: Phase 2.1 - Unified AI Settings Page

**Status:** ✅ Implemented  
**URL:** `/settings/ai`

#### How to Test:

1. **Navigate to Settings:**
   - Go to: `http://localhost:5173/settings/ai`
   - Or check if there's a Settings link in navigation

2. **Test Tab 1: API Keys**
   - Click on "API Keys" tab
   - **Expected:** See provider selection (OpenAI, Anthropic, OpenRouter, Gemini)
   - Try adding an API key for one provider
   - Click "Test" button to validate key
   - **Expected:** Key validation feedback

3. **Test Tab 2: Model Selection**
   - Click on "Model Selection" tab
   - **Expected:** See per-feature model dropdowns:
     - Meeting Task Extraction
     - Meeting Sentiment Analysis
     - Proposal Generation
   - Change a model selection
   - Adjust temperature slider
   - Adjust max tokens slider
   - Toggle enable/disable for a feature

4. **Test Tab 3: Extraction Rules**
   - Click on "Extraction Rules" tab
   - **Expected:** Placeholder (Phase 6 feature)

#### What to Verify:

- ✅ All three tabs are accessible
- ✅ API keys can be added and tested
- ✅ Model selections can be changed
- ✅ Settings persist after page refresh
- ✅ Temperature and max tokens sliders work

#### Files to Check:
- `src/pages/settings/AISettings.tsx`
- Route in `src/App.tsx` line 333: `<Route path="/settings/ai" element={<AppLayout><AISettings /></AppLayout>} />`

---

### TSK-0224: Phase 2.2 - Model Resolution Layer

**Status:** ✅ Implemented (Backend)  
**Note:** This is a backend service, not directly visible in UI

#### How to Test:

1. **Set User Model Preference:**
   - Go to `/settings/ai`
   - Set a custom model for "Meeting Task Extraction"
   - Save settings

2. **Test Model Resolution:**
   - The model resolution happens automatically when:
     - Extracting action items from meetings
     - Analyzing sentiment
     - Generating proposals
   - Check browser console/network tab to see which model is being used
   - **Expected:** Your custom model should be used instead of default

3. **Test Fallback Logic:**
   ```sql
   -- Clear user settings to test fallback
   DELETE FROM user_ai_feature_settings WHERE user_id = 'your-user-id';
   ```
   - **Expected:** System default model should be used

#### What to Verify:

- ✅ User model preferences are respected
- ✅ Falls back to system_config when user setting missing
- ✅ Falls back to hardcoded defaults when system_config missing

#### Files to Check:
- `src/lib/services/aiProvider.ts` (method: `resolveModelForFeature`)
- Edge functions that use AI (should call `resolveModelForFeature`)

---

### TSK-0226: Phase 3.1 - Enhanced Talk Time Visualization

**Status:** ❌ **CHANGES NEEDED - NOT COMPLETE**  
**Issue:** Components exist but NOT integrated into MeetingDetail

#### Current State:

- ✅ Components exist: `TalkTimeChart.tsx`, `CoachingInsights.tsx`
- ❌ **NOT integrated** into MeetingDetail.tsx
- ⚠️ Currently shows basic bar chart (lines 877-919)

#### What You'll See Now:

- Basic horizontal bar chart showing rep vs customer talk time
- Simple legend
- AI judgement text (if available)

#### What Should Be Visible (After Integration):

- **TalkTimeChart:** Donut chart + progress bars with ideal range indicators
- **CoachingInsights:** AI-powered recommendations with severity levels
- **TalkTimeTrend:** Trend analysis over time

#### Changes Needed:

**File:** `src/pages/MeetingDetail.tsx` (around line 877)

**Replace this section:**
```typescript
{/* Talk Time Analysis Card */}
{meeting.talk_time_rep_pct !== null && meeting.talk_time_customer_pct !== null && (
  <div className="section-card">
    {/* Basic bar chart - lines 877-919 */}
  </div>
)}
```

**With:**
```typescript
{/* Enhanced Talk Time Analytics */}
{meeting.talk_time_rep_pct !== null && meeting.talk_time_customer_pct !== null && (
  <div className="section-card space-y-4">
    <TalkTimeChart 
      repPercentage={meeting.talk_time_rep_pct}
      customerPercentage={meeting.talk_time_customer_pct}
      meetingType={meeting.meeting_type}
    />
    <CoachingInsights 
      meetingId={meeting.id}
      talkTimeRep={meeting.talk_time_rep_pct}
      talkTimeCustomer={meeting.talk_time_customer_pct}
      sentimentScore={meeting.sentiment_score}
    />
  </div>
)}
```

**Add imports at top:**
```typescript
import { TalkTimeChart } from '@/components/meetings/analytics/TalkTimeChart';
import { CoachingInsights } from '@/components/meetings/analytics/CoachingInsights';
```

#### Files to Check:
- `src/components/meetings/analytics/TalkTimeChart.tsx` ✅ Exists
- `src/components/meetings/analytics/CoachingInsights.tsx` ✅ Exists
- `src/pages/MeetingDetail.tsx` ❌ **NEEDS INTEGRATION**

---

### TSK-0227: Phase 3.2 - Sentiment Dashboard

**Status:** ❌ **CHANGES NEEDED - NOT COMPLETE**  
**Issue:** Components exist but NOT integrated into any page

#### Current State:

- ✅ Components exist: `SentimentDashboard.tsx`, `SentimentTrend.tsx`, `SentimentAlerts.tsx`
- ❌ **NOT integrated** into Insights page or any route
- ⚠️ No way to access these components in the UI

#### What You'll See Now:

- Nothing - components exist but aren't displayed anywhere

#### What Should Be Visible (After Integration):

- **SentimentDashboard:** Contact/company sentiment overview
- **SentimentTrend:** Historical sentiment chart
- **SentimentAlerts:** Negative sentiment notifications

#### Changes Needed:

**Option 1: Add to Existing Insights Page**

**File:** `src/pages/Insights.tsx`

Add Sentiment Dashboard section:
```typescript
import { SentimentDashboard } from '@/components/insights/SentimentDashboard';
import { SentimentTrend } from '@/components/insights/SentimentTrend';
import { SentimentAlerts } from '@/components/insights/SentimentAlerts';

// Add to Insights page JSX:
<div className="space-y-6">
  <SentimentAlerts />
  <SentimentDashboard />
  <SentimentTrend />
</div>
```

**Option 2: Create New Route**

**File:** `src/App.tsx`

Add route:
```typescript
<Route path="/insights/sentiment" element={<AppLayout><SentimentInsightsPage /></AppLayout>} />
```

**Create:** `src/pages/insights/SentimentInsightsPage.tsx`
```typescript
import { SentimentDashboard } from '@/components/insights/SentimentDashboard';
import { SentimentTrend } from '@/components/insights/SentimentTrend';
import { SentimentAlerts } from '@/components/insights/SentimentAlerts';

export default function SentimentInsightsPage() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Sentiment Analytics</h1>
      <SentimentAlerts />
      <SentimentDashboard />
      <SentimentTrend />
    </div>
  );
}
```

#### Files to Check:
- `src/components/insights/SentimentDashboard.tsx` ✅ Exists
- `src/components/insights/SentimentTrend.tsx` ✅ Exists
- `src/components/insights/SentimentAlerts.tsx` ✅ Exists
- `src/pages/Insights.tsx` ❌ **NEEDS INTEGRATION** (or create new page)

---

### TSK-0228: Phase 4.1 - Simplified Proposal Mode

**Status:** ❌ **CHANGES NEEDED - VISIBILITY ISSUE**  
**Issue:** Quick Mode toggle exists but may not be visible or working correctly

#### Current State:

- ✅ Quick Mode code exists in ProposalWizard.tsx (lines 1196-1234)
- ⚠️ Toggle only shows when `step === 'select_meetings'` AND `!showResumeDialog`
- ⚠️ Default mode is `'advanced'` (line 284)
- ⚠️ User reports not seeing the toggle

#### What You Should See:

1. **Open Proposal Wizard:**
   - Go to any meeting detail page: `http://localhost:5173/meetings/{meeting-id}`
   - Click "Generate Proposal" button

2. **Look for Quick Mode Toggle:**
   - Should appear at the top of the dialog
   - Switch labeled "Quick" / "Advanced"
   - Description text below

#### Potential Issues:

1. **Toggle Hidden by Condition:**
   - Toggle only shows when `step === 'select_meetings'`
   - If dialog opens to a different step, toggle won't be visible
   - Check: Is the dialog starting at the correct step?

2. **Resume Dialog Hiding Toggle:**
   - If `showResumeDialog` is true, toggle is hidden
   - Check: Is saved state causing resume dialog to show?

3. **Default Mode:**
   - Defaults to 'advanced' mode
   - User might not notice the toggle if they expect Quick Mode by default

#### Changes Needed:

**File:** `src/components/proposals/ProposalWizard.tsx`

**Issue 1: Toggle Visibility**
The toggle is conditionally rendered. Consider making it always visible or moving it to a more prominent location:

```typescript
// Current (line 1197):
{!showResumeDialog && step === 'select_meetings' && (
  // Toggle here
)}

// Suggested: Make toggle always visible in select_meetings step
{step === 'select_meetings' && (
  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
    {/* Make toggle more prominent */}
  </div>
)}
```

**Issue 2: Default Mode**
Consider defaulting to Quick Mode for better UX:

```typescript
// Current (line 284):
const [proposalMode, setProposalMode] = useState<'quick' | 'advanced'>('advanced');

// Suggested:
const [proposalMode, setProposalMode] = useState<'quick' | 'advanced'>('quick');
```

**Issue 3: Toggle Styling**
Make the toggle more visible with better styling:

```typescript
// Enhance the toggle section with better visual hierarchy
<div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-sm font-semibold mb-1">Proposal Mode</h3>
      <p className="text-xs text-gray-600 dark:text-gray-400">
        {proposalMode === 'quick' 
          ? 'Quick Mode: Generate a simple summary and follow-up email'
          : 'Advanced Mode: Full Goals → SOW → HTML workflow'}
      </p>
    </div>
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium ${proposalMode === 'quick' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
        Quick
      </span>
      <Switch
        id="proposal-mode"
        checked={proposalMode === 'advanced'}
        onCheckedChange={(checked) => {
          setProposalMode(checked ? 'advanced' : 'quick');
          if (!checked) {
            setQuickModeSummary('');
            setQuickModeEmail('');
          }
        }}
      />
      <span className={`text-sm font-medium ${proposalMode === 'advanced' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
        Advanced
      </span>
    </div>
  </div>
</div>
```

#### Testing Steps:

1. Clear any saved proposal state:
   ```javascript
   // In browser console:
   localStorage.removeItem('proposal-wizard-state-*');
   ```

2. Open Proposal Wizard fresh
3. Check if toggle appears at top
4. Test switching between modes
5. Verify Quick Mode generates summary + email

#### Files to Check:
- `src/components/proposals/ProposalWizard.tsx` ✅ Code exists but may need visibility fixes
- Lines 1196-1234: Toggle implementation
- Lines 640-679: Quick Mode logic
- Lines 1914-1963: Quick Mode preview

---

### TSK-0229: Phase 4.2 - Meeting Type Classification ✅ **JUST FIXED**

**Status:** ✅ **IMPLEMENTED & DISPLAYED**

#### How to Test:

1. **Check Meeting Type Badge:**
   - Go to any meeting detail page: `http://localhost:5173/meetings/{meeting-id}`
   - **Expected:** Meeting type badge in header (e.g., "Discovery", "Demo", "Negotiation")
   - **Expected:** Confidence percentage shown if available (e.g., "Discovery (85%)")

2. **Check Meetings List:**
   - Go to: `http://localhost:5173/meetings`
   - **Expected:** Meeting type badge in grid view cards
   - **Expected:** "Type" column in table view showing meeting type

3. **Test Classification:**
   ```sql
   -- Check if meetings have classification
   SELECT id, title, meeting_type, classification_confidence 
   FROM meetings 
   WHERE owner_user_id = 'your-user-id' 
   LIMIT 5;
   ```

4. **If No Classification:**
   - Meetings need to be classified using the classification service
   - Classification happens automatically or can be triggered manually
   - Check: `src/lib/services/meetingClassificationService.ts`

#### What to Verify:

- ✅ Meeting type badge appears in MeetingDetail header
- ✅ Meeting type appears in MeetingsList (grid and table views)
- ✅ Badge styling is correct (blue color scheme)
- ✅ Confidence percentage shows when available

#### Files to Check:
- `src/pages/MeetingDetail.tsx` ✅ Updated (lines 807-816)
- `src/components/meetings/MeetingsList.tsx` ✅ Updated (lines 470-477, 581-586)
- `src/lib/services/meetingClassificationService.ts` ✅ Exists

---

## 🔍 Troubleshooting

### "I don't see the onboarding flow"
- Check if you're logged in
- Check database: `SELECT * FROM user_onboarding_progress WHERE user_id = 'your-user-id'`
- If `onboarding_completed_at` is set, reset it (see TSK-0218 instructions)
- Navigate directly to `/onboarding`

### "I don't see analytics in meeting detail"
- Analytics only shows if meeting has `talk_time_rep_pct` and `talk_time_customer_pct` data
- Check database: `SELECT talk_time_rep_pct, talk_time_customer_pct FROM meetings WHERE id = 'meeting-id'`
- If NULL, sync meetings from Fathom that have talk time metrics
- **Note:** Enhanced components (TalkTimeChart, CoachingInsights) may need integration

### "I don't see meeting type badge"
- Check if meeting has `meeting_type` set: `SELECT meeting_type FROM meetings WHERE id = 'meeting-id'`
- If NULL, classification may not have run yet
- Classification can be triggered manually or happens automatically during sync

### "Settings page doesn't load"
- Check browser console for errors
- Verify route exists: `http://localhost:5173/settings/ai`
- Check if `AISettings.tsx` file exists
- Try hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

### "I don't see Quick Mode toggle"
- Make sure you're on `meetings-feature-v1` branch
- Check ProposalWizard component
- Try refreshing the page (hard refresh)
- Check browser console for errors

---

## 📊 Testing Checklist

### Phase 1 (TSK-0218, TSK-0219) ✅ COMPLETE
- [x] Onboarding flow accessible at `/onboarding`
- [x] All 4 steps work (Welcome → Fathom → Sync → Complete)
- [x] Empty states show correctly based on Fathom connection status
- [x] Manual sync button works

### Phase 2 (TSK-0223, TSK-0224) ✅ COMPLETE
- [x] AI Settings page accessible at `/settings/ai`
- [x] All 3 tabs work (API Keys, Model Selection, Extraction Rules)
- [x] Can add and test API keys
- [x] Can change model selections
- [x] Settings persist after refresh
- [x] Model resolution uses user preferences

### Phase 3 (TSK-0226, TSK-0227) ❌ CHANGES NEEDED
- [x] Talk time visualization shows in meeting detail (basic bar chart)
- [ ] ❌ **Enhanced TalkTimeChart component needs integration**
- [ ] ❌ **CoachingInsights component needs integration**
- [ ] ❌ **Sentiment dashboard components need page integration**

### Phase 4 (TSK-0228, TSK-0229) ⚠️ PARTIAL
- [ ] ❌ **Quick Mode toggle visibility issue - needs fix**
- [ ] Quick Mode generates summary + email (if toggle visible)
- [x] Meeting type badge shows in MeetingDetail header ✅
- [x] Meeting type shows in MeetingsList ✅

---

## 🔧 Summary of Changes Needed

### High Priority (Blocks Testing)

1. **TSK-0226: Integrate TalkTimeChart & CoachingInsights**
   - File: `src/pages/MeetingDetail.tsx`
   - Replace basic bar chart (lines 877-919) with enhanced components
   - Add imports for TalkTimeChart and CoachingInsights

2. **TSK-0227: Integrate Sentiment Dashboard**
   - Option A: Add to `src/pages/Insights.tsx`
   - Option B: Create new route `/insights/sentiment`
   - Import and render SentimentDashboard, SentimentTrend, SentimentAlerts

3. **TSK-0228: Fix Quick Mode Toggle Visibility**
   - File: `src/components/proposals/ProposalWizard.tsx`
   - Make toggle more prominent/visible
   - Consider defaulting to Quick Mode
   - Ensure toggle shows when dialog opens

---

## 🎯 Next Steps

1. **For Missing UI Elements:**
   - Integrate TalkTimeChart and CoachingInsights into MeetingDetail
   - Integrate SentimentDashboard components into Insights page
   - Verify Quick Mode toggle is visible in ProposalWizard

2. **For Testing:**
   - Ensure you have test data (meetings with talk time, sentiment scores)
   - Ensure Fathom is connected for onboarding testing
   - Check database migrations are applied

3. **For Issues:**
   - Check browser console for errors
   - Verify you're on the correct branch
   - Hard refresh the page (Cmd+Shift+R)
   - Check database for required data

---

**Last Updated:** 2025-01-27  
**Branch:** `meetings-feature-v1`

