# UI Changes Guide - Meetings Feature V1

## 🚀 Quick Start

1. **Ensure you're on the correct branch:**
   ```bash
   git checkout meetings-feature-v1
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser:** http://localhost:5173 (or the port shown in terminal)

---

## 📍 Where to See the UI Changes

### Phase 1: Onboarding & Empty States

#### 1. Onboarding Flow
**URL:** `/onboarding`

**How to access:**
- After signup, you'll be redirected here automatically
- Or navigate directly to: `http://localhost:5173/onboarding`

**What you'll see:**
- Welcome step with value proposition
- Fathom Connection step (OAuth integration)
- Sync Progress step (shows sync happening)
- Completion step (success + redirect)

**To test:**
1. Sign up a new account OR
2. Clear your onboarding progress in database OR
3. Navigate directly to `/onboarding`

#### 2. Enhanced Empty States
**URL:** `/meetings`

**What you'll see:**
- If Fathom not connected → Connection CTA
- If Fathom connected but no meetings → Guidance + manual sync button
- If syncing → Progress indicator
- If meetings exist → Normal meetings list

**To test:**
- Disconnect Fathom → See connection CTA
- Connect Fathom but have no meetings → See guidance
- Start a sync → See progress indicator

---

### Phase 2: Unified AI Settings

**URL:** `/settings/ai`

**How to access:**
- Navigate to: `http://localhost:5173/settings/ai`
- Or from Settings menu (if available)

**What you'll see:**
- **Tab 1: API Keys**
  - Provider selection (OpenAI, Anthropic, OpenRouter, Gemini)
  - API key input fields
  - Test connection buttons
  - Key validation

- **Tab 2: Model Selection**
  - Per-feature model dropdowns:
    - Meeting Task Extraction
    - Meeting Sentiment Analysis
    - Proposal Generation
  - Temperature and Max Tokens sliders
  - Enable/Disable toggles for each feature

- **Tab 3: Extraction Rules**
  - Placeholder (coming in Phase 3)

**To test:**
1. Navigate to `/settings/ai`
2. Try adding API keys
3. Switch between tabs
4. Change model selections
5. Adjust temperature/max tokens

---

### Phase 3: Talk Time & Coaching Analytics

**URL:** `/meetings/:id` (Meeting Detail Page)

**How to access:**
1. Go to `/meetings`
2. Click on any meeting that has talk time data
3. Scroll down to see the **Analytics & Coaching** section

**What you'll see:**
- **Talk Time Chart** (Donut chart + progress bars)
  - Visual representation of rep vs customer talk time
  - Ideal range indicator
  - "Ideal" or "Needs Improvement" badge

- **Coaching Insights** (AI-powered recommendations)
  - Severity-based insights (critical/warning/info)
  - Actionable steps
  - Color-coded cards

**Note:** Analytics section only appears if the meeting has `talk_time_rep_pct` and `talk_time_customer_pct` data.

**To test:**
1. Find a meeting with talk time data
2. If no meetings have talk time data, you may need to:
   - Sync meetings from Fathom that have talk time metrics
   - Or manually add talk time data to a meeting in the database

---

### Phase 3: Sentiment Dashboard

**URL:** `/insights` (if route exists) OR components can be added to a dashboard

**Components created:**
- `SentimentDashboard.tsx` - Contact/company sentiment overview
- `SentimentTrend.tsx` - Historical sentiment chart
- `SentimentAlerts.tsx` - Negative sentiment notifications

**Note:** These components are created but may need to be integrated into a page. Check if there's an Insights page or dashboard where these should appear.

**To test:**
- These components may need to be added to an existing page
- Or create a new page to showcase them

---

### Phase 4: Proposal Integration

**URL:** Meeting Detail Page → Click "Generate Proposal" button

**How to access:**
1. Go to `/meetings/:id`
2. Look for "Generate Proposal" button (usually in the header or action area)
3. Click it to open ProposalWizard

**What you'll see:**

#### Quick Mode Toggle
- At the top of ProposalWizard, you'll see a toggle:
  - **Quick Mode** (left) - Simple summary + follow-up email
  - **Advanced Mode** (right) - Full Goals → SOW → HTML workflow

#### Quick Mode Flow:
1. Select meetings
2. Click Continue
3. Automatically generates summary + follow-up email
4. Preview/edit both summary and email
5. Copy email button available

#### Advanced Mode Flow:
- Same as before (existing workflow)

**To test:**
1. Open ProposalWizard from a meeting
2. Toggle between Quick and Advanced modes
3. In Quick Mode, select a meeting and click Continue
4. See the auto-generated summary and email
5. Try editing them
6. Test the copy email button

---

## 🧪 Testing Checklist

### Phase 1 Testing
- [ ] Navigate to `/onboarding` - See onboarding flow
- [ ] Go to `/meetings` with no Fathom connection - See connection CTA
- [ ] Go to `/meetings` with Fathom but no meetings - See guidance

### Phase 2 Testing
- [ ] Navigate to `/settings/ai` - See AI Settings page
- [ ] Switch between tabs (API Keys, Model Selection, Extraction Rules)
- [ ] Add an API key
- [ ] Change model selection
- [ ] Adjust temperature/max tokens

### Phase 3 Testing
- [ ] Go to `/meetings/:id` for a meeting with talk time data
- [ ] Scroll down - See "Analytics & Coaching" section
- [ ] See Talk Time Chart with donut chart
- [ ] See Coaching Insights with recommendations
- [ ] Check if insights are relevant to the talk time data

### Phase 4 Testing
- [ ] Open ProposalWizard from a meeting
- [ ] See Quick/Advanced Mode toggle at top
- [ ] Select Quick Mode
- [ ] Select a meeting and click Continue
- [ ] See auto-generated summary and email
- [ ] Edit the summary
- [ ] Edit the email
- [ ] Click "Copy Email" button

---

## 🔍 Troubleshooting

### "I don't see the onboarding flow"
- Check if you're logged in (onboarding only shows for new users)
- Check database for `user_onboarding_progress` - if `onboarding_completed_at` is set, you won't see it
- Navigate directly to `/onboarding`

### "I don't see analytics in meeting detail"
- Analytics only shows if meeting has `talk_time_rep_pct` and `talk_time_customer_pct` data
- Check database: `SELECT talk_time_rep_pct, talk_time_customer_pct FROM meetings WHERE id = 'your-meeting-id'`
- If NULL, sync meetings from Fathom that have talk time metrics

### "I don't see the Quick Mode toggle"
- Make sure you're on the `meetings-feature-v1` branch
- Check if ProposalWizard component was updated
- Try refreshing the page (hard refresh: Cmd+Shift+R)

### "Settings page doesn't load"
- Check browser console for errors
- Verify route exists in `App.tsx`: `/settings/ai`
- Check if `AISettings.tsx` file exists in `src/pages/settings/`

---

## 📝 Notes

- **Navigation:** On the `meetings-feature-v1` branch, navigation is restricted to only "Dashboard" and "Meetings" (see `AppLayout.tsx`)
- **Database:** Some features require database migrations to be run:
  - `20251127000001_create_user_onboarding_progress.sql`
  - `20251127000002_create_user_ai_settings.sql`
  - `20251127000003_create_sentiment_alerts.sql`
  - `20251127000004_add_meeting_classification.sql`

- **Data Requirements:**
  - Analytics need meetings with talk time data
  - Sentiment dashboard needs meetings with sentiment scores
  - Proposal generation needs meetings with transcripts

---

## 🎯 Quick Links

- **Onboarding:** http://localhost:5173/onboarding
- **AI Settings:** http://localhost:5173/settings/ai
- **Meetings List:** http://localhost:5173/meetings
- **Meeting Detail:** http://localhost:5173/meetings/{meeting-id}






