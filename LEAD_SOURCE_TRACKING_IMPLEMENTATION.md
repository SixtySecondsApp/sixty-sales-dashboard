# Lead Source Tracking Implementation Summary

## Overview
Enhanced lead source tracking system with deal stage monitoring and clickable analytics for SavvyCal imported leads.

## Problem Statement
- 1,957 imported SavvyCal leads showed "Unknown" source
- Need accurate source attribution (LinkedIn Ads, Facebook Ads, etc.)
- Need to track deal pipeline stages (SQL, Opportunity, Verbal, Signed, Lost)
- Need clickable analytics to drill down into filtered lead lists

## Solution Implemented

### 1. Database Changes

#### Migration: `20251125000002_create_savvycal_link_mappings.sql`
**Purpose**: Map SavvyCal link IDs to human-readable source names

**Table Structure**:
```sql
CREATE TABLE savvycal_link_mappings (
  id UUID PRIMARY KEY,
  link_id TEXT NOT NULL UNIQUE,
  source_name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'direct',
  medium TEXT,
  description TEXT,
  default_owner_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Pre-populated Data**:
- 17 known link mappings including:
  - `link_01JBH7K597B546RDY6VW39RFCK` → LinkedIn Ads (573 leads)
  - `link_01JBKF8K31JXM7E4SWCAJZ41Z1` → Meta Ads (79 leads)
  - Personal calendar links (432+ leads)

#### Migration: `20251125000003_backfill_lead_sources_from_links.sql`
**Purpose**: Backfill existing leads with source tracking

**Key Features**:
- Updates leads with `booking_link_id` but missing source info
- Creates/updates `lead_sources` entries based on UTM patterns
- Links leads to `lead_sources` entries
- Recreates `lead_source_summary` view with enhanced columns

**UTM Pattern Recognition**:
- Facebook/Instagram → `paid_social` channel
- LinkedIn → `paid_social` channel
- Google Ads → `paid_search` channel
- Email outreach → `email` channel

#### Migration: `20251125000004_add_deal_stages_to_lead_source_view.sql`
**Purpose**: Add deal stage tracking to lead source performance view

**New Columns Added**:
```sql
-- Lead status counts
new_leads
prepping_leads
ready_leads
converted_leads
cancelled_leads

-- Deal stage counts (for converted leads)
sql_stage
opportunity_stage
verbal_stage
signed_stage
lost_stage

-- Revenue metrics
total_one_off_revenue
total_monthly_revenue
total_ltv

-- Performance metrics
conversion_rate  -- (Converted / Non-Cancelled) %
win_rate         -- (Signed / Total Converted) %
```

**View Logic**:
- Joins `leads` with `deals` via `converted_deal_id`
- Aggregates by source name and channel
- Filters deals by stage using PostgreSQL FILTER clauses
- Calculates LTV as `(MRR × 3) + One-off Revenue`

### 2. Type System Updates

#### File: `src/lib/database.types.ts`
Updated `lead_source_summary` view type to include:
- All new lead status columns
- All deal stage tracking columns
- Revenue metric columns (one-off, monthly, LTV)
- Performance metric columns (conversion_rate, win_rate)

### 3. UI Components

#### Component: `src/components/leads/LeadAnalyticsCard.tsx`
**Enhanced Features**:

1. **New Columns Displayed**:
   - Total Leads (clickable)
   - SQL Stage (clickable)
   - Opportunity Stage (clickable)
   - Verbal Stage (clickable)
   - Signed Stage (clickable)
   - Lost Stage (clickable)
   - LTV (formatted currency)
   - Conversion % (calculated from view)
   - Win % (calculated from view)

2. **Clickable Navigation**:
   - Click on any number to filter leads by source
   - Click on stage numbers to filter by source + stage
   - Hover effects show interactivity
   - Navigation uses URL parameters: `/crm/leads?source=X&stage=Y`

3. **Data Aggregation**:
   - Consolidates duplicate sources (case-insensitive)
   - Aggregates all metrics across duplicate entries
   - Sorts by total leads descending

4. **Responsive Design**:
   - Sticky first column (source name)
   - Horizontal scroll for small screens
   - Abbreviated column headers on mobile

#### Page: `src/pages/leads/LeadsInbox.tsx`
**Enhanced Features**:

1. **URL-Based Filtering**:
   ```typescript
   const sourceFilter = searchParams.get('source');
   const stageFilter = searchParams.get('stage');
   ```

2. **Filter Logic**:
   - **Source Filter**: Matches against `source.name`, `utm_source`, or `external_source`
   - **Stage Filter**: Matches against `converted_deal.stage`
   - Filters are case-insensitive and support partial matching

3. **Visual Filter Indicators**:
   - Blue badges for active source filters
   - Purple badges for active stage filters
   - Click "×" to remove individual filters
   - "Clear all" button to remove all filters
   - Responsive layout with flex-wrap

4. **Filter Persistence**:
   - Filters persist in URL
   - Can share filtered views via URL
   - Browser back/forward navigation works

## Data Flow

```
SavvyCal Import
    ↓
leads.booking_link_id
    ↓
savvycal_link_mappings.link_id
    ↓
source_name + channel
    ↓
lead_source_summary view
    ↓
LeadAnalyticsCard (clickable)
    ↓
LeadsInbox (filtered by source/stage)
```

## Key Insights

### LinkedIn Ads Link Analysis
**Link ID**: `link_01JBH7K597B546RDY6VW39RFCK`
- **Total Leads**: 573
- **With UTM Tags**: 188 (linkedin,paid)
- **Without UTM Tags**: 384 (organic traffic on paid link)
- **Conclusion**: All 573 should be attributed to LinkedIn Ads
- **Description**: "Cold Audience Recruitment & Real Estate"

## Usage Examples

### Scenario 1: View All LinkedIn Ads Leads
1. Navigate to analytics page
2. Click on "573" in LinkedIn Ads row
3. System navigates to: `/crm/leads?source=LinkedIn Ads`
4. Leads page shows all 573 LinkedIn Ads leads
5. Filter badge displays: "Source: LinkedIn Ads [×]"

### Scenario 2: View LinkedIn Ads Leads at SQL Stage
1. Navigate to analytics page
2. Click on SQL number in LinkedIn Ads row
3. System navigates to: `/crm/leads?source=LinkedIn Ads&stage=SQL`
4. Leads page shows only SQL stage leads from LinkedIn Ads
5. Filter badges display: "Source: LinkedIn Ads [×]" + "Stage: SQL [×]"

### Scenario 3: Clear Filters
- Click "×" on individual badge to remove that filter
- Click "Clear all" to remove all filters at once
- Browser back button also removes filters step-by-step

## Performance Considerations

1. **View Aggregation**: PostgreSQL handles aggregation efficiently
2. **Clickable Navigation**: Client-side routing with URL params
3. **Filter Application**: useMemo ensures efficient re-filtering
4. **Sticky Columns**: CSS-based, no JavaScript overhead
5. **Responsive Design**: Mobile-first with progressive enhancement

## Future Enhancements

1. **Date Range Filtering**: Add date pickers to filter by lead creation date
2. **Export Functionality**: Export filtered lead lists to CSV
3. **Advanced Filters**: Multi-select for sources/stages
4. **Saved Filter Sets**: Save commonly used filter combinations
5. **Real-time Updates**: Live subscription to lead source changes

## Testing Checklist

- [ ] Run migration `20251125000004_add_deal_stages_to_lead_source_view.sql`
- [ ] Verify view columns in database: `SELECT * FROM lead_source_summary LIMIT 1;`
- [ ] Check TypeScript compilation: `npm run build:check`
- [ ] Test clickable analytics navigation
- [ ] Test source filter functionality
- [ ] Test stage filter functionality
- [ ] Test filter badges display
- [ ] Test filter clearing (individual and all)
- [ ] Test mobile responsiveness
- [ ] Test dark mode styling
- [ ] Verify LTV calculations: `(MRR × 3) + One-off`
- [ ] Verify conversion rate: `(Converted / Non-Cancelled) %`
- [ ] Verify win rate: `(Signed / Total Deals) %`

## Files Modified

1. `supabase/migrations/20251125000004_add_deal_stages_to_lead_source_view.sql` (NEW)
2. `src/lib/database.types.ts` (UPDATED - view type)
3. `src/components/leads/LeadAnalyticsCard.tsx` (UPDATED - UI enhancement)
4. `src/pages/leads/LeadsInbox.tsx` (UPDATED - filtering logic)

## Database Schema

### Tables Created/Modified
- `savvycal_link_mappings` (NEW - migration 20251125000002)

### Views Modified
- `lead_source_summary` (ENHANCED - migration 20251125000004)

### Relationships
```
leads.booking_link_id → savvycal_link_mappings.link_id
leads.converted_deal_id → deals.id
leads.source_id → lead_sources.id
```

## Notes

- The migration fixes the "cannot drop columns from view" error by using `DROP VIEW IF EXISTS` before `CREATE VIEW`
- All numbers in the analytics table are clickable when > 0
- Stage filtering only works for converted leads (those with `converted_deal_id`)
- The view automatically aggregates metrics by source and owner
- Revenue metrics (LTV) are formatted as currency with no decimal places
- Conversion and win rates are displayed with 1 decimal place precision
