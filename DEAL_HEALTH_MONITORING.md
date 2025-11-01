# Deal Health Monitoring & Risk Alerts

## Overview

The AI-Powered Deal Health Monitoring & Risk Alerts system continuously analyzes all deal signals to proactively identify at-risk deals and alert sales reps with actionable recommendations.

### Key Features

- **Multi-Signal Analysis**: Tracks call sentiment, response times, engagement drops, stage velocity
- **Proactive Alerts**: Automatic notifications when deals show warning signs
- **Configurable Rules**: Admin-managed thresholds and alert conditions
- **Health Scores**: 0-100 composite scores with individual signal breakdowns
- **Action Recommendations**: AI-suggested next steps for each risk scenario
- **Real-time Updates**: Live health score updates and instant alerts

---

## Architecture

### Database Tables

#### 1. `deal_health_scores`
Stores calculated health metrics for each deal:
- **Overall health score** (0-100)
- **Health status**: healthy, warning, critical, stalled
- **Individual signal scores**: stage velocity, sentiment, engagement, activity, response time
- **Raw metrics**: days in stage, meeting counts, sentiment trends
- **Risk factors**: array of identified risks
- **Predictions**: close probability, predicted days to close

#### 2. `deal_health_alerts`
Active and historical alerts:
- **Alert types**: stage_stall, sentiment_drop, engagement_decline, no_activity, etc.
- **Severity levels**: info, warning, critical
- **Suggested actions**: AI-generated recommendations
- **Alert status**: active, acknowledged, resolved, dismissed
- **Notification tracking**: links to notification system

#### 3. `deal_health_rules`
Admin-configurable thresholds:
- **Rule types**: stage_velocity, sentiment, engagement, activity, response_time
- **Thresholds**: configurable values with operators
- **Alert templates**: customizable message and action templates
- **Conditions**: JSONB for complex rule matching (stage, deal value, etc.)

#### 4. `deal_health_history`
Historical snapshots for trending:
- Time-series health score data
- Enables trend analysis and visualization

### Services

#### `dealHealthService.ts`
Core health calculation engine:
- Fetches metrics from deals, meetings, activities
- Calculates individual signal scores (0-100 scale each)
- Computes weighted overall health score
- Identifies risk factors
- Stores scores and historical snapshots

**Signal Scoring Logic:**

1. **Stage Velocity Score** (30% weight)
   - Optimal progression: 7-14 days depending on stage
   - Warning: 14-21 days
   - Critical: 30+ days
   - Score decreases as time in stage increases

2. **Sentiment Score** (25% weight)
   - Based on last 3 Fathom meeting sentiment scores (-1 to 1)
   - Trend modifier: +10 for improving, -15 for declining
   - Converted to 0-100 scale

3. **Engagement Score** (20% weight)
   - Meeting frequency: optimal 2-4/month
   - Activity count: optimal 8+/month
   - Recency: bonus for recent meetings

4. **Activity Score** (15% weight)
   - Volume: 10+ activities = excellent
   - Recency: < 3 days = bonus, > 14 days = penalty

5. **Response Time Score** (10% weight)
   - < 4 hours = 100
   - < 24 hours = 80
   - < 48 hours = 50
   - > 48 hours = low score

#### `dealHealthAlertService.ts`
Alert generation and management:
- Evaluates health scores against configured rules
- Generates alerts with templated messages
- Prevents duplicate alerts
- Sends notifications via `notificationService`
- Provides alert lifecycle management (acknowledge, resolve, dismiss)

### React Hooks

#### `useDealHealthScore(dealId)`
- Get health score for specific deal
- Calculate/refresh health on demand
- Real-time updates via Supabase subscriptions

#### `useUserDealsHealth()`
- Get all health scores for current user
- Bulk health calculation
- Real-time subscription to all changes

#### `useDealHealthAlerts(dealId)`
- Get alerts for specific deal
- Real-time alert updates

#### `useActiveAlerts()`
- Get all active alerts for current user
- Alert statistics
- Acknowledge/resolve/dismiss actions

### UI Components

#### `DealHealthBadge`
Visual indicator showing:
- Health status with color coding
- Numeric score
- Risk level
- Variants: full badge, dot indicator, progress bar

#### `DealHealthAlertsPanel`
Alert management interface:
- Active alerts grouped by severity
- Expandable details with suggested actions
- Quick actions: acknowledge, resolve, dismiss
- Empty state when no alerts

#### `DealHealthDashboard`
Comprehensive health overview:
- Stats cards (average health, healthy, at-risk, critical, stalled)
- Filter by health status
- Sort by health score, days in stage, risk level
- Individual deal cards with signal breakdowns
- Bulk health recalculation

#### `HealthRulesPage` (Admin)
Rule configuration interface:
- List all rules with status
- Toggle active/inactive
- Create/edit/delete custom rules
- System rules protected from deletion

---

## Default Health Rules

The system includes 8 pre-configured rules:

1. **Stage Stall Warning (14 days)** - Warning when deal stalled 14+ days
2. **Stage Stall Critical (30 days)** - Critical when stalled 30+ days
3. **Sentiment Drop Alert** - Warning when sentiment drops 20%+
4. **No Recent Activity (7 days)** - Warning for 7+ days without activity
5. **No Recent Activity Critical (14 days)** - Critical for 14+ days inactive
6. **Low Meeting Frequency** - Warning for < 1 meeting/month
7. **Slow Response Time** - Info alert for > 48 hour avg response
8. **Close Date Approaching** - Warning when close date near but deal not advancing

All rules are configurable by admins.

---

## Integration Guide

### 1. Apply Database Migration

```bash
# Apply the migration to create tables and default rules
psql $DATABASE_URL < supabase/migrations/20251101000001_create_deal_health_monitoring.sql
```

### 2. Add Routes

Add to your router configuration:

```typescript
// Main health dashboard (for sales reps)
import DealHealthDashboard from '@/components/DealHealthDashboard';
<Route path="/health" element={<DealHealthDashboard />} />

// Admin rule configuration
import HealthRulesPage from '@/pages/admin/HealthRules';
<Route path="/admin/health-rules" element={<HealthRulesPage />} />
```

### 3. Integrate with Existing Pipeline

Add health badges to deal cards:

```typescript
import { useDealHealthScore } from '@/lib/hooks/useDealHealth';
import { DealHealthBadge } from '@/components/DealHealthBadge';

function DealCard({ deal }) {
  const { healthScore } = useDealHealthScore(deal.id);

  return (
    <div className="deal-card">
      <h3>{deal.name}</h3>
      <DealHealthBadge healthScore={healthScore} />
      {/* rest of card */}
    </div>
  );
}
```

### 4. Add Alerts Panel to Dashboard

```typescript
import { DealHealthAlertsPanel } from '@/components/DealHealthAlertsPanel';

function Dashboard() {
  return (
    <div>
      <DealHealthAlertsPanel />
      {/* rest of dashboard */}
    </div>
  );
}
```

### 5. Set Up Automated Calculation

Create a cron job or scheduled task to calculate health scores:

**Option A: Supabase Edge Function (Recommended)**

Create `supabase/functions/calculate-deal-health/index.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';
import { calculateDealHealth } from './dealHealthService';

Deno.serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Get all active deals
  const { data: deals } = await supabase
    .from('deals')
    .select('id, owner_id')
    .not('stage_id', 'in', '(signed,lost)');

  let calculated = 0;
  for (const deal of deals || []) {
    await calculateDealHealth(deal.id);
    calculated++;
  }

  return new Response(
    JSON.stringify({ success: true, calculated }),
    { headers: { 'Content-Type': 'application/json' } }
  );
});
```

Schedule via Supabase cron or external scheduler (every 6 hours recommended).

**Option B: Client-Side Trigger**

Trigger health calculation on key events:

```typescript
// When deal stage changes
const handleStageChange = async (dealId) => {
  await calculateDealHealth(dealId);
  await generateAlertsForDeal(dealId, healthScore);
};

// After meeting sync
const handleMeetingSync = async (userId) => {
  await calculateAllDealsHealth(userId);
  await generateAlertsForAllDeals(userId);
};
```

### 6. Navigation Updates

Add to main navigation:

```typescript
const navItems = [
  // ... existing items
  {
    name: 'Deal Health',
    path: '/health',
    icon: Activity,
    badge: activeAlertCount, // Optional alert count badge
  }
];
```

---

## Usage Examples

### Calculate Health for Single Deal

```typescript
import { calculateDealHealth } from '@/lib/services/dealHealthService';
import { generateAlertsForDeal } from '@/lib/services/dealHealthAlertService';

async function refreshDealHealth(dealId: string) {
  const healthScore = await calculateDealHealth(dealId);
  if (healthScore) {
    await generateAlertsForDeal(dealId, healthScore);
  }
}
```

### Get Health Score in Component

```typescript
function DealDetailView({ dealId }) {
  const { healthScore, loading, calculateHealth } = useDealHealthScore(dealId);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <DealHealthBadge healthScore={healthScore} />
      <DealHealthProgress healthScore={healthScore} />

      <button onClick={calculateHealth}>
        Refresh Health Score
      </button>

      {healthScore && (
        <div className="health-details">
          <h3>Health Breakdown</h3>
          <div>Stage Velocity: {healthScore.stage_velocity_score}/100</div>
          <div>Sentiment: {healthScore.sentiment_score}/100</div>
          <div>Engagement: {healthScore.engagement_score}/100</div>

          {healthScore.risk_factors.length > 0 && (
            <div className="risk-factors">
              <h4>Risk Factors:</h4>
              {healthScore.risk_factors.map(factor => (
                <span key={factor}>{factor}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Manage Alerts

```typescript
function MyAlerts() {
  const { alerts, stats, acknowledge, resolve, dismiss } = useActiveAlerts();

  return (
    <div>
      <h2>Active Alerts ({stats.total})</h2>
      <div>
        <span>{stats.critical} Critical</span>
        <span>{stats.warning} Warning</span>
      </div>

      {alerts.map(alert => (
        <div key={alert.id}>
          <h3>{alert.title}</h3>
          <p>{alert.message}</p>

          <div className="actions">
            <button onClick={() => acknowledge(alert.id)}>
              Acknowledge
            </button>
            <button onClick={() => resolve(alert.id)}>
              Resolve
            </button>
            <button onClick={() => dismiss(alert.id)}>
              Dismiss
            </button>
          </div>

          {alert.suggested_actions.map((action, i) => (
            <div key={i} className="suggested-action">
              {action}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Create Custom Health Rule (Admin)

```typescript
import { supabase } from '@/lib/supabase/clientV2';

async function createCustomRule() {
  const { data, error } = await supabase
    .from('deal_health_rules')
    .insert({
      rule_name: 'High-Value Deal Stall',
      rule_type: 'stage_velocity',
      description: 'Alert for high-value deals stalled > 7 days',
      threshold_value: 7,
      threshold_operator: '>=',
      threshold_unit: 'days',
      alert_severity: 'critical',
      alert_message_template: 'High-value deal "{{deal_name}}" stalled for {{days_in_stage}} days',
      suggested_action_template: 'Immediate executive involvement required',
      conditions: {
        deal_value_min: 50000
      },
      is_active: true,
    });

  return data;
}
```

---

## Customization

### Adding New Signal Types

1. **Update Database Enum** (if needed):
```sql
ALTER TYPE rule_type ADD VALUE 'custom_signal';
```

2. **Add Calculation Logic**:
```typescript
// In dealHealthService.ts
function calculateCustomSignalScore(dealMetrics: DealHealthMetrics): number {
  // Your custom logic
  return score; // 0-100
}

// Add to overall calculation with weight
const weighted =
  scores.stageVelocity * 0.25 +  // Adjust weights
  scores.sentiment * 0.20 +
  scores.engagement * 0.15 +
  scores.activity * 0.15 +
  scores.responseTime * 0.10 +
  scores.customSignal * 0.15;
```

3. **Update UI**:
```typescript
// Add to signal score display
<SignalScore label="Custom Signal" score={healthScore.custom_signal_score} />
```

### Custom Alert Templates

Templates support the following variables:
- `{{deal_name}}` - Deal name
- `{{stage}}` - Current stage name
- `{{days_in_stage}}` - Days in current stage
- `{{days_inactive}}` - Days since last activity
- `{{sentiment_change}}` - Sentiment change percentage
- `{{current_sentiment}}` - Current sentiment score
- `{{meeting_count}}` - Meetings in last 30 days
- `{{avg_response_hours}}` - Average response time
- `{{days_until_close}}` - Days until expected close date
- `{{company}}` - Company name

Example:
```
"Deal {{deal_name}} at {{company}} has been in {{stage}} for {{days_in_stage}} days with {{meeting_count}} meetings. Last sentiment: {{current_sentiment}}%."
```

---

## Performance Considerations

### Optimization Tips

1. **Batch Calculations**: Use `calculateAllDealsHealth()` for bulk updates
2. **Caching**: Health scores are cached in database, refresh every 6-24 hours
3. **Indexing**: All key fields indexed for fast queries
4. **Real-time Updates**: Use Supabase subscriptions for live updates
5. **Historical Data**: Archive old health snapshots after 90 days

### Recommended Calculation Schedule

- **On-demand**: When user views deal or dashboard
- **Automated**: Every 6 hours via cron job
- **Event-triggered**: After meeting sync, stage change, or new activity

---

## Monitoring & Analytics

### Key Metrics to Track

- Average health score across all deals
- Distribution of health statuses
- Alert resolution time
- Most common risk factors
- Health score correlation with close rate

### Example Analytics Query

```sql
-- Average health by stage
SELECT
  ds.name as stage,
  AVG(dhs.overall_health_score) as avg_health,
  COUNT(*) as deal_count
FROM deal_health_scores dhs
JOIN deals d ON d.id = dhs.deal_id
JOIN deal_stages ds ON ds.id = d.stage_id
GROUP BY ds.name
ORDER BY avg_health DESC;

-- Most common risk factors
SELECT
  unnest(risk_factors) as risk_factor,
  COUNT(*) as occurrence_count
FROM deal_health_scores
WHERE risk_level IN ('high', 'critical')
GROUP BY risk_factor
ORDER BY occurrence_count DESC
LIMIT 10;
```

---

## Troubleshooting

### Health Score Not Calculating

1. Check deal has required data (stage_changed_at, owner_id)
2. Verify meetings table has sentiment_score data
3. Check RLS policies allow user access
4. Review browser console for errors

### Alerts Not Generating

1. Verify health rules are active
2. Check threshold values match deal conditions
3. Confirm notifications table permissions
4. Review alert generation logs

### Performance Issues

1. Add database indexes if missing
2. Reduce calculation frequency
3. Archive old health history data
4. Optimize signal calculation queries

---

## Future Enhancements

### Planned Features

1. **ML-Powered Predictions**: Train models on historical close rates
2. **Custom Signals**: Plugin architecture for custom health factors
3. **Trend Visualization**: Charts showing health over time
4. **Benchmarking**: Compare deal health to similar deals
5. **Automated Actions**: Trigger workflows based on health alerts
6. **Mobile Push Notifications**: Alert delivery to mobile apps
7. **Slack/Teams Integration**: Send alerts to team channels
8. **Health Forecasting**: Predict future health trajectory

---

## Support & Maintenance

### Regular Maintenance Tasks

- Review and update default rules quarterly
- Archive health history data older than 90 days
- Monitor alert noise (too many alerts = threshold adjustment needed)
- Collect feedback from sales reps on alert usefulness
- Adjust signal weights based on close rate correlation

### Best Practices

- Start with default rules, customize based on your sales process
- Review alert resolution rates to identify ineffective rules
- Train sales team on interpreting health scores
- Use health data in pipeline reviews and forecasting
- Regularly validate sentiment analysis accuracy

---

## Technical Reference

### Database Schema

See `supabase/migrations/20251101000001_create_deal_health_monitoring.sql`

### Service APIs

- `dealHealthService.ts` - Health calculation functions
- `dealHealthAlertService.ts` - Alert management functions

### React Components

- `DealHealthBadge.tsx` - Visual indicators
- `DealHealthAlertsPanel.tsx` - Alert management UI
- `DealHealthDashboard.tsx` - Main health dashboard
- `HealthRulesPage.tsx` - Admin configuration

### React Hooks

- `useDealHealth.ts` - All health-related hooks

---

## License & Credits

Part of the Sixty Sales Dashboard CRM platform.

**Contributors:**
- AI-Powered health scoring algorithm
- Multi-signal risk detection engine
- Proactive alert generation system
- Configurable rule engine

For questions or support, refer to the main CLAUDE.md documentation.
