# Deal Health Monitoring - Integration Guide

## ✅ What Has Been Integrated

The Deal Health Monitoring system is now fully integrated into your application. Here's where to find everything:

---

## 📍 Where to See the UI Elements

### 1. **Deal Detail Pages** (`/crm/deals/:id`)
**Location**: Badge appears below the deal title, next to the stage badge

**What You'll See**:
- Health badge with color coding:
  - 🟢 **Green** (80-100): Healthy
  - 🟡 **Yellow** (60-79): Warning
  - 🟠 **Orange** (40-59): Critical
  - 🔴 **Red** (0-39): Stalled
- Badge shows the overall health score (e.g., "Healthy 85")

**Example**:
```
Deal Title: Big Enterprise Deal
[Opportunity Stage] [Healthy 85] [Active]
```

**How to Test**:
1. Navigate to any deal: `/crm/deals/{deal-id}`
2. The health badge will appear automatically if health data exists
3. If no badge appears, the deal hasn't been analyzed yet

---

### 2. **Contact Pages** (`/contacts/:id`)
**Location**: Right sidebar panel

**What You'll See**:
- ContactDealHealthWidget showing:
  - Average health score across all contact's deals
  - Status distribution (healthy/warning/critical/stalled)
  - Active alert count
  - Individual deal health indicators

**How to Test**:
1. Navigate to any contact: `/contacts/{contact-id}`
2. Look in the right sidebar for "Deal Health" section
3. Widget displays aggregated health across all deals

---

### 3. **Company Pages** (`/companies/:id`)
**Location**: Right sidebar panel

**What You'll See**:
- CompanyDealHealthWidget showing:
  - Total deal value
  - At-risk value (deals in warning/critical/stalled states)
  - Average health score
  - Alert counts by severity

**How to Test**:
1. Navigate to any company: `/companies/{company-id}`
2. Look in the right sidebar for "Deal Health" section
3. Widget displays company-wide health metrics

---

### 4. **Health Monitoring Dashboard** (NEW - `/crm/health`)
**Location**: New dedicated page

**What You'll See**:
- Overall health statistics across all deals
- Stats cards for:
  - Average health score
  - Healthy deals count
  - At-risk deals count
  - Critical deals count
  - Stalled deals count
- Filterable list of all deals with health scores
- Sorting options:
  - Health score (low to high / high to low)
  - Days in stage
  - Risk level
- "Recalculate All" button to refresh health scores manually

**How to Access**:
1. Navigate to: **`http://localhost:5173/crm/health`**
2. Or add a navigation link to your CRM menu

**Example Filter Options**:
- All Deals (57)
- Healthy (32)
- At Risk (15)
- Critical (8)
- Stalled (2)

---

### 5. **Admin: Health Rules Configuration** (NEW - `/admin/health-rules`)
**Location**: Admin settings page

**What You'll See**:
- List of health monitoring rules
- Configure alert thresholds:
  - Stage velocity rules (days in stage)
  - Sentiment drop alerts
  - Activity/engagement rules
  - Response time thresholds
- Alert message templates
- Suggested action templates

**Default Rules**:
1. **Stage Stall Warning (14 days)** - Warning when deal hasn't progressed
2. **Stage Stall Critical (30 days)** - Critical alert for prolonged stalls
3. **Sentiment Drop Alert** - Alert on 20%+ sentiment decline
4. **No Recent Activity (7 days)** - Warning for inactive deals
5. **No Recent Activity Critical (14 days)** - Critical for extended inactivity
6. **Low Meeting Frequency** - Less than 1 meeting per month
7. **Slow Response Time** - Response time >48 hours
8. **Close Date Approaching** - Alert when close date is within 7 days

**How to Access**:
1. Navigate to: **`http://localhost:5173/admin/health-rules`**
2. Configure thresholds and alert templates
3. Enable/disable specific rules

---

## 🔄 How It Works (Current State)

### ⚠️ **IMPORTANT: Currently MANUAL Calculation**

The system does NOT automatically watch for new data yet. Health scores are calculated:
- **On Demand**: When you click "Recalculate All" in the dashboard
- **On Page Load**: When a component fetches health data
- **Real-time Updates**: When health scores change in the database, UI updates automatically

### What It Analyzes

When health calculation runs, it analyzes:

1. **Stage Velocity** (30% weight)
   - How long the deal has been in current stage
   - Compares against optimal timeframes:
     - SQL: 7 days optimal
     - Opportunity: 14 days optimal
     - Verbal: 7 days optimal
     - Signed: 0 days

2. **Sentiment Score** (25% weight)
   - Average sentiment from last 3 Fathom meetings
   - Converts -1 to 1 scale → 0-100 scale
   - Detects improving or declining trends

3. **Engagement Score** (20% weight)
   - Meeting frequency in last 30 days
   - More meetings = higher engagement

4. **Activity Score** (15% weight)
   - Days since last activity
   - Recent activity = higher score

5. **Response Time** (10% weight)
   - Average response time in hours
   - Faster responses = higher score

### Health Score Calculation
```
Overall Health = (Stage Velocity × 0.30) +
                 (Sentiment × 0.25) +
                 (Engagement × 0.20) +
                 (Activity × 0.15) +
                 (Response Time × 0.10)
```

### Health Status Classification
- **80-100**: 🟢 Healthy (on track, good momentum)
- **60-79**: 🟡 Warning (some concerns, needs attention)
- **40-59**: 🟠 Critical (significant risks, urgent action)
- **0-39**: 🔴 Stalled (deal at risk of being lost)

---

## 🚀 Making It Automatic (Next Steps)

To make the system automatically watch for new meetings, activities, and deal changes, you need to add triggers. Here are your options:

### Option 1: **Client-Side Triggers** (Quick Implementation)

Add health recalculation calls after key events:

**A. After Meeting Sync**
In `src/lib/services/calendarService.ts` or meeting sync completion:
```typescript
import { calculateAllDealsHealth } from '@/lib/services/dealHealthService';
import { generateAlertsForAllDeals } from '@/lib/services/dealHealthAlertService';

// After successful meeting sync
const userId = user.id;
await calculateAllDealsHealth(userId);
await generateAlertsForAllDeals(userId);
```

**B. After Deal Stage Change**
In your pipeline/deal update handlers:
```typescript
import { calculateDealHealth } from '@/lib/services/dealHealthService';
import { generateAlertsForDeal } from '@/lib/services/dealHealthAlertService';

// After deal.stage is updated
const healthScore = await calculateDealHealth(dealId);
if (healthScore) {
  await generateAlertsForDeal(dealId, healthScore);
}
```

**C. After Activity Creation**
In activity creation handlers:
```typescript
// After new activity is created
const dealsToUpdate = [activity.deal_id]; // Get affected deals
for (const dealId of dealsToUpdate) {
  await calculateDealHealth(dealId);
  const score = await getDealHealthScore(dealId);
  if (score) await generateAlertsForDeal(dealId, score);
}
```

### Option 2: **Scheduled Background Job** (Recommended for Production)

Create a Supabase Edge Function that runs periodically:

```typescript
// supabase/functions/calculate-health-scores/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, user_id')
    .is('closed_at', null);

  // Calculate health for each deal
  let processed = 0;
  for (const deal of deals || []) {
    await calculateDealHealth(deal.id);
    const score = await getDealHealthScore(deal.id);
    if (score) {
      await generateAlertsForDeal(deal.id, score);
      processed++;
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed,
      message: `Calculated health for ${processed} deals`
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

**Schedule with cron**:
```bash
supabase functions schedule calculate-health-scores --cron "0 */6 * * *"
# Runs every 6 hours
```

### Option 3: **Database Triggers** (Most Robust)

Create PostgreSQL triggers on key tables:

```sql
-- Trigger on meetings table
CREATE OR REPLACE FUNCTION trigger_health_calculation_on_meeting()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function or set flag for background processing
  PERFORM net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/calculate-health-scores',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}',
    body := json_build_object('deal_id', NEW.deal_id)::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER meeting_health_trigger
AFTER INSERT ON meetings
FOR EACH ROW
EXECUTE FUNCTION trigger_health_calculation_on_meeting();
```

---

## 🧪 Testing the System

### Manual Testing Checklist

1. **Start Development Server**
   ```bash
   npm run dev
   ```

2. **Test Deal Detail Page**
   - Navigate to `/crm/deals/{any-deal-id}`
   - ✅ Verify health badge appears (if health score exists)
   - ✅ Check badge color matches health status

3. **Test Contact Page**
   - Navigate to `/contacts/{any-contact-id}`
   - ✅ Look for health widget in right sidebar
   - ✅ Verify aggregated health metrics display

4. **Test Company Page**
   - Navigate to `/companies/{any-company-id}`
   - ✅ Look for health widget in right sidebar
   - ✅ Verify company-wide health metrics

5. **Test Health Dashboard**
   - Navigate to `/crm/health`
   - ✅ Verify dashboard loads with stats
   - ✅ Click "Recalculate All" to compute health scores
   - ✅ Test filters (healthy, warning, critical, stalled)
   - ✅ Test sorting options

6. **Test Admin Health Rules**
   - Navigate to `/admin/health-rules`
   - ✅ Verify default rules display
   - ✅ Test rule configuration interface
   - ✅ Modify thresholds and save

### Initial Health Score Generation

If no health scores exist yet:

1. **Navigate to**: `/crm/health`
2. **Click**: "Recalculate All" button
3. **Wait**: System calculates health for all active deals
4. **Result**: Dashboard populates with health scores
5. **Then**: Navigate to any deal/contact/company to see widgets

---

## 📊 Understanding Health Indicators

### Risk Factors

When health scores are low, you'll see risk factors like:
- `sentiment_declining` - Meeting sentiment trending negative
- `no_recent_meetings` - No meetings in significant period
- `stage_stall` - Deal stuck in current stage too long
- `low_engagement` - Insufficient contact frequency
- `slow_response` - Response times above threshold

### Suggested Actions

Based on risk factors, the system suggests actions like:
- "Schedule follow-up meeting to advance conversation"
- "Review recent meeting recordings for concerns"
- "Contact immediately to re-engage"
- "Verify close date is realistic or update timeline"

---

## 🎯 Next Steps

1. ✅ **Test in Browser**: Follow manual testing checklist above
2. ⚙️ **Configure Rules**: Customize thresholds in `/admin/health-rules`
3. 🔄 **Add Automatic Triggers**: Choose and implement one of the trigger options
4. 📈 **Monitor Performance**: Watch for deals entering warning/critical states
5. 📊 **Add Navigation**: Add link to `/crm/health` in your main CRM menu

---

## 🐛 Troubleshooting

### "No Health Badge on Deal Page"
- **Cause**: Deal hasn't been analyzed yet
- **Solution**: Go to `/crm/health` and click "Recalculate All"

### "Empty Health Dashboard"
- **Cause**: No health scores calculated yet
- **Solution**: Click "Recalculate All" button to generate initial scores

### "Contact/Company Widget Empty"
- **Cause**: Related deals haven't been analyzed
- **Solution**: Calculate health scores first via dashboard

### "Admin Health Rules Not Loading"
- **Cause**: Migration may not be applied
- **Solution**: Verify `deal_health_rules` table exists in database

### "TypeScript Errors in Console"
- **Cause**: Pre-existing issues in Calendar/Tasks integration
- **Solution**: These are non-blocking; health monitoring works independently

---

## 📝 Summary

**Routes Added**:
- ✅ `/crm/health` - Health monitoring dashboard
- ✅ `/admin/health-rules` - Admin rule configuration

**Components Integrated**:
- ✅ `DealHealthBadge` → Deal detail pages
- ✅ `ContactDealHealthWidget` → Contact right panels
- ✅ `CompanyDealHealthWidget` → Company right panels
- ✅ `DealHealthDashboard` → Dedicated dashboard page

**Database Tables**:
- ✅ `deal_health_scores` - Health metrics storage
- ✅ `deal_health_alerts` - Alert management
- ✅ `deal_health_rules` - Admin configuration
- ✅ `deal_health_history` - Time-series tracking

**Current State**:
- ✅ All UI components integrated and routed
- ✅ Manual calculation via dashboard
- ⚠️ Automatic triggers not yet implemented
- ✅ Real-time updates when scores change

---

**Ready to Test!** Navigate to `/crm/health` and click "Recalculate All" to see the system in action.
