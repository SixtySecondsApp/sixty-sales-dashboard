# Frontend Locations Guide - Completed Features

**Date:** 2025-01-27  
**Branch:** `meetings-feature-v1`

---

## ✅ Completed Features - Where to See Them

### 🎯 TSK-0226: Enhanced Talk Time Visualization

**Status:** ✅ **COMPLETE & INTEGRATED**

**Location:** Meeting Detail Page

**How to Access:**
1. Navigate to: `http://localhost:5173/meetings`
2. Click on any meeting that has talk time data
3. Scroll down to the **"AI Insights Section"**
4. Look for **"Talk Time Distribution"** card with donut chart
5. Below that, see **"Coaching Insights"** card with recommendations

**What You'll See:**
- **TalkTimeChart Component:**
  - Donut chart showing rep vs customer talk time distribution
  - Progress bars for each percentage
  - "Ideal" or "Needs Improvement" badge
  - Ideal range indicator (45-55% for general meetings)

- **CoachingInsights Component:**
  - AI-powered recommendations based on talk time
  - Severity-based insights (critical/warning/info)
  - Color-coded cards:
    - 🔴 Red: Critical issues
    - 🟡 Yellow: Warnings
    - 🔵 Blue: Informational tips
  - Actionable steps for improvement

**Requirements:**
- Meeting must have `talk_time_rep_pct` and `talk_time_customer_pct` data
- If no data, you'll see the basic sentiment analysis card instead

**URL Pattern:**
```
http://localhost:5173/meetings/{meeting-id}
```

**Example:**
```
http://localhost:5173/meetings/123e4567-e89b-12d3-a456-426614174000
```

---

### 🎯 TSK-0227: Sentiment Dashboard

**Status:** ✅ **COMPLETE & INTEGRATED**

**Location:** Insights Page → Sentiment Tab

**How to Access:**
1. Navigate to: `http://localhost:5173/insights`
2. Click on the **"Sentiment"** tab (4th tab in the tab list)
3. You'll see three components:
   - **Sentiment Alerts** (at top)
   - **Sentiment Dashboard** (middle)
   - **Sentiment Trend** (bottom)

**What You'll See:**

1. **SentimentAlerts Component:**
   - Negative sentiment notifications
   - Alert types: negative_meeting, declining_trend, at_risk
   - Severity levels: info, warning, critical
   - Click to view meeting details

2. **SentimentDashboard Component:**
   - Contact-level sentiment aggregation
   - Company-level sentiment aggregation
   - Toggle between "Contact" and "Company" view
   - Shows average sentiment, meeting count, trend indicators
   - Color-coded sentiment badges

3. **SentimentTrend Component:**
   - Historical sentiment chart over time
   - Line chart showing sentiment trends
   - Filter by date range
   - Shows improving/declining/stable trends

**Requirements:**
- Meetings with sentiment scores in database
- If no sentiment data, components will show empty states

**URL Pattern:**
```
http://localhost:5173/insights
```
Then click the "Sentiment" tab

---

### 🎯 TSK-0228: Quick Mode Proposal

**Status:** ✅ **COMPLETE & VISIBLE**

**Location:** Meeting Detail Page → Generate Proposal Button

**How to Access:**
1. Navigate to: `http://localhost:5173/meetings/{meeting-id}`
2. Click the **"Generate Proposal"** button in the header (blue button with FileText icon)
3. The ProposalWizard dialog opens
4. **Look at the top** - you'll see a prominent blue gradient box with:
   - **"Proposal Mode"** heading
   - Description text
   - **Toggle switch** labeled "Quick" / "Advanced"

**What You'll See:**

**Toggle Section:**
- Blue gradient background (very visible)
- "Quick Mode" on the left (default)
- "Advanced Mode" on the right
- Switch in the middle
- Description text explaining each mode

**Quick Mode Flow:**
1. Toggle is set to "Quick" (default)
2. Select one or more meetings
3. Click "Continue"
4. Automatically generates:
   - Summary from meeting goals
   - Follow-up email with:
     - Thank you message
     - Meeting summary
     - Key pain points
     - Proposed solutions
5. Preview page shows:
   - Editable summary textarea
   - Editable email textarea
   - "Copy Email" button

**Advanced Mode Flow:**
1. Toggle switch to "Advanced"
2. Full workflow:
   - Select meetings
   - Analyze focus areas
   - Generate goals
   - Generate SOW
   - Generate HTML proposal
   - Preview and share

**Requirements:**
- Meeting must have transcript or summary for Quick Mode
- For best results, meeting should have been classified

**URL Pattern:**
```
http://localhost:5173/meetings/{meeting-id}
```
Then click "Generate Proposal" button

---

## 🗺️ Complete Navigation Map

### Main Routes

```
/meetings
├── /meetings/{id}                    ← TSK-0226 (Talk Time), TSK-0228 (Quick Mode)
│   └── Click "Generate Proposal"    ← Opens ProposalWizard with Quick Mode toggle
│
/insights
└── Click "Sentiment" tab             ← TSK-0227 (Sentiment Dashboard)

/settings/ai                          ← TSK-0223, TSK-0224 (AI Settings)

/onboarding                           ← TSK-0218, TSK-0219 (Onboarding)
```

---

## 🧪 Quick Test Checklist

### TSK-0226: Talk Time Visualization
- [ ] Go to `/meetings`
- [ ] Click any meeting with talk time data
- [ ] Scroll down - see "Talk Time Distribution" donut chart
- [ ] See "Coaching Insights" card below it
- [ ] Verify insights are relevant to talk time percentages

### TSK-0227: Sentiment Dashboard
- [ ] Go to `/insights`
- [ ] Click "Sentiment" tab (4th tab)
- [ ] See SentimentAlerts at top
- [ ] See SentimentDashboard in middle (contact/company view)
- [ ] See SentimentTrend chart at bottom
- [ ] Toggle between Contact and Company views

### TSK-0228: Quick Mode Proposal
- [ ] Go to `/meetings/{any-meeting-id}`
- [ ] Click "Generate Proposal" button (blue, in header)
- [ ] **See prominent blue gradient box at top** with toggle
- [ ] Verify toggle defaults to "Quick" mode
- [ ] Select a meeting
- [ ] Click Continue
- [ ] See auto-generated summary + email
- [ ] Test editing both fields
- [ ] Test "Copy Email" button
- [ ] Switch to Advanced mode - verify full workflow still works

---

## 🎨 Visual Indicators

### Talk Time Visualization (TSK-0226)
- **Donut Chart:** Blue (rep) and Green (customer) segments
- **Badge:** "Ideal" (green) or "Needs Improvement" (gray)
- **Coaching Cards:** Color-coded by severity (red/yellow/blue)

### Sentiment Dashboard (TSK-0227)
- **Tab:** "Sentiment" tab in Insights page (Activity icon)
- **Alerts:** Red/yellow badges for negative sentiment
- **Dashboard:** Contact/Company cards with sentiment scores
- **Trend Chart:** Line chart showing sentiment over time

### Quick Mode Toggle (TSK-0228)
- **Location:** Top of ProposalWizard dialog
- **Style:** Blue gradient background, very prominent
- **Default:** "Quick" mode selected
- **Toggle:** Switch between Quick/Advanced

---

## 🔍 Troubleshooting

### "I don't see Talk Time chart"
- Check if meeting has `talk_time_rep_pct` and `talk_time_customer_pct` data
- Query: `SELECT talk_time_rep_pct, talk_time_customer_pct FROM meetings WHERE id = 'meeting-id'`
- If NULL, sync meetings from Fathom that have talk time metrics

### "I don't see Sentiment tab"
- Make sure you're on `/insights` page
- Look for 4 tabs: Sales Funnel, Activity Heatmap, Lead Analytics, **Sentiment**
- If only 3 tabs, check browser console for errors

### "I don't see Quick Mode toggle"
- Make sure ProposalWizard dialog is open
- Toggle only shows when step is "select_meetings"
- Look for blue gradient box at top of dialog
- If not visible, try refreshing page (hard refresh: Cmd+Shift+R)
- Check browser console for errors

---

## 📸 Expected Screenshots Locations

1. **Talk Time Chart:** Meeting Detail → Scroll to AI Insights Section
2. **Coaching Insights:** Meeting Detail → Below Talk Time Chart
3. **Sentiment Dashboard:** Insights Page → Sentiment Tab
4. **Quick Mode Toggle:** ProposalWizard Dialog → Top of dialog (blue gradient box)

---

**Last Updated:** 2025-01-27  
**All features are now integrated and ready for testing!**

