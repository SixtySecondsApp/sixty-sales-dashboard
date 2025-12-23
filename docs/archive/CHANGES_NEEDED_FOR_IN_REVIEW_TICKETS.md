# Changes Needed for In Review Tickets

**Project:** Sixty v1 (Meetings)  
**Date:** 2025-01-27

---

## ⚠️ Status Summary

Three tickets marked "In Review" require additional work before they can be tested:

1. **TSK-0226** - Enhanced Talk Time Visualization (Components not integrated)
2. **TSK-0227** - Sentiment Dashboard (Components not integrated)  
3. **TSK-0228** - Quick Mode Proposal (Toggle visibility issue)

---

## 🔧 TSK-0226: Enhanced Talk Time Visualization

### Current State
- ✅ Components exist: `TalkTimeChart.tsx`, `CoachingInsights.tsx`
- ❌ **NOT integrated** into MeetingDetail.tsx
- ⚠️ Currently shows basic bar chart instead

### Required Changes

**File:** `src/pages/MeetingDetail.tsx`

**Location:** Around line 877-919

**Action:** Replace the basic talk time bar chart with enhanced components

**Current Code (to replace):**
```typescript
{/* Talk Time Analysis Card */}
{meeting.talk_time_rep_pct !== null && meeting.talk_time_customer_pct !== null && (
  <div className="section-card">
    <div className="font-semibold mb-3">Talk Time Analysis</div>
    {/* Basic bar chart - lines 882-917 */}
  </div>
)}
```

**New Code (to add):**
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

**Add imports at top of file:**
```typescript
import { TalkTimeChart } from '@/components/meetings/analytics/TalkTimeChart';
import { CoachingInsights } from '@/components/meetings/analytics/CoachingInsights';
```

**Files to modify:**
- `src/pages/MeetingDetail.tsx` (lines ~877-919, add imports at top)

**Files that exist (no changes needed):**
- `src/components/meetings/analytics/TalkTimeChart.tsx` ✅
- `src/components/meetings/analytics/CoachingInsights.tsx` ✅

---

## 🔧 TSK-0227: Sentiment Dashboard

### Current State
- ✅ Components exist: `SentimentDashboard.tsx`, `SentimentTrend.tsx`, `SentimentAlerts.tsx`
- ❌ **NOT integrated** into any page
- ⚠️ No route or UI to access these components

### Required Changes

**Option 1: Add to Existing Insights Page** (Recommended)

**File:** `src/pages/Insights.tsx`

**Action:** Import and add Sentiment components to the Insights page

**Add imports:**
```typescript
import { SentimentDashboard } from '@/components/insights/SentimentDashboard';
import { SentimentTrend } from '@/components/insights/SentimentTrend';
import { SentimentAlerts } from '@/components/insights/SentimentAlerts';
```

**Add to JSX (in appropriate section):**
```typescript
<div className="space-y-6">
  <h2 className="text-2xl font-bold">Sentiment Analytics</h2>
  <SentimentAlerts />
  <SentimentDashboard />
  <SentimentTrend />
</div>
```

**Option 2: Create New Route** (Alternative)

**File:** `src/App.tsx`

**Add route:**
```typescript
const SentimentInsightsPage = lazyWithRetry(() => import('@/pages/insights/SentimentInsightsPage'));

// In routes:
<Route path="/insights/sentiment" element={<AppLayout><SentimentInsightsPage /></AppLayout>} />
```

**Create new file:** `src/pages/insights/SentimentInsightsPage.tsx`
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

**Files to modify:**
- `src/pages/Insights.tsx` (Option 1) OR
- `src/App.tsx` + create `src/pages/insights/SentimentInsightsPage.tsx` (Option 2)

**Files that exist (no changes needed):**
- `src/components/insights/SentimentDashboard.tsx` ✅
- `src/components/insights/SentimentTrend.tsx` ✅
- `src/components/insights/SentimentAlerts.tsx` ✅

---

## 🔧 TSK-0228: Quick Mode Proposal Toggle

### Current State
- ✅ Quick Mode code exists in ProposalWizard.tsx
- ⚠️ Toggle only visible when `step === 'select_meetings'` AND `!showResumeDialog`
- ⚠️ Default mode is `'advanced'`
- ❌ **User reports not seeing the toggle**

### Required Changes

**File:** `src/components/proposals/ProposalWizard.tsx`

**Change 1: Make Toggle More Visible**

**Location:** Lines 1196-1234

**Current:**
```typescript
{!showResumeDialog && step === 'select_meetings' && (
  <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
    {/* Toggle here */}
  </div>
)}
```

**Suggested:**
```typescript
{step === 'select_meetings' && (
  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <h3 className="text-sm font-semibold mb-1 text-gray-900 dark:text-gray-100">
          Proposal Mode
        </h3>
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
)}
```

**Change 2: Default to Quick Mode** (Optional but recommended)

**Location:** Line 284

**Current:**
```typescript
const [proposalMode, setProposalMode] = useState<'quick' | 'advanced'>('advanced');
```

**Suggested:**
```typescript
const [proposalMode, setProposalMode] = useState<'quick' | 'advanced'>('quick');
```

**Change 3: Ensure Toggle Shows on Dialog Open**

**Check:** When ProposalWizard opens, ensure `step` is set to `'select_meetings'`

**Location:** Check dialog open handler and initial state

**Files to modify:**
- `src/components/proposals/ProposalWizard.tsx` (lines 284, 1196-1234)

---

## ✅ Testing After Changes

### TSK-0226 Testing
1. Navigate to any meeting with talk time data
2. Scroll to analytics section
3. Verify TalkTimeChart donut chart appears
4. Verify CoachingInsights recommendations appear

### TSK-0227 Testing
1. Navigate to `/insights` (or `/insights/sentiment` if new route)
2. Verify SentimentAlerts component appears
3. Verify SentimentDashboard component appears
4. Verify SentimentTrend chart appears

### TSK-0228 Testing
1. Open Proposal Wizard from any meeting
2. Verify toggle is visible at top of dialog
3. Switch between Quick and Advanced modes
4. Test Quick Mode: Select meeting → Continue → See summary + email
5. Test Advanced Mode: Full workflow still works

---

## 📝 Implementation Priority

1. **TSK-0228** (Quick Mode Toggle) - High priority - Blocks proposal testing
2. **TSK-0226** (Talk Time Visualization) - Medium priority - Enhances meeting detail
3. **TSK-0227** (Sentiment Dashboard) - Medium priority - New feature page

---

## 🎯 Estimated Time

- **TSK-0226:** ~15 minutes (import + replace code)
- **TSK-0227:** ~20 minutes (add to page or create route)
- **TSK-0228:** ~10 minutes (improve toggle visibility)

**Total:** ~45 minutes to complete all changes

---

**Last Updated:** 2025-01-27

