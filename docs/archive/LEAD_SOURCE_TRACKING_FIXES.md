# Lead Source Tracking - Fixes for Blank Screen & Missing Data

## 🔧 Issues Fixed

### 1. **Blank Screen When Filtering**
**Problem**: Clicking on analytics numbers showed a blank screen at `/crm/leads?source=LinkedIn+Ads`

**Root Cause**:
- Page tried to auto-select first lead when array was empty
- No empty state message for filtered results

**Fixes Applied**:
1. Added safety check before auto-selecting lead:
   ```typescript
   if (filteredAndSortedLeads.length > 0) {
     setSelectedLeadId(filteredAndSortedLeads[0].id);
   }
   ```

2. Added empty state message when filters return no results:
   - Shows filter values that are active
   - Provides "Clear all filters" button
   - Displays helpful emoji and message

### 2. **No Data in Stage Columns**
**Likely Cause**: Leads don't have `converted_deal_id` set

This happens because:
- Leads are imported but not converted to deals yet
- The `converted_deal_id` field is only populated when a lead status is set to 'converted'
- Stage tracking only works for leads that have been converted to deals

## 🔍 Debugging Steps

Run the queries in `DEBUG_LEAD_SOURCE_TRACKING.sql` to diagnose:

### Quick Check Queries:

```sql
-- 1. Check if view has any stage data
SELECT source_name, total_leads, sql_stage, opportunity_stage, verbal_stage, signed_stage
FROM lead_source_summary
ORDER BY total_leads DESC
LIMIT 5;

-- 2. Check lead -> deal linkage
SELECT
  COUNT(*) as total_leads,
  COUNT(converted_deal_id) as leads_with_deals,
  COUNT(DISTINCT converted_deal_id) as unique_deals
FROM leads
WHERE deleted_at IS NULL;

-- 3. Check LinkedIn Ads specifically
SELECT
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'converted' THEN 1 END) as converted_status,
  COUNT(CASE WHEN converted_deal_id IS NOT NULL THEN 1 END) as with_deal_id
FROM leads
WHERE deleted_at IS NULL
  AND (
    booking_link_id = 'link_01JBH7K597B546RDY6VW39RFCK'
    OR utm_source ILIKE '%linkedin%'
  );
```

## 💡 Understanding the Data Flow

### Lead Lifecycle:
1. **Lead Created** → `status = 'new'`
2. **Lead Prepped** → `status = 'prepping'` or `status = 'ready'`
3. **Lead Converted** → `status = 'converted'` + `converted_deal_id` set
4. **Deal Created** → Has `stage_id` pointing to deal_stages

### Why Stage Columns Are Empty:

```
Lead Import (1,957 leads)
    ↓
Lead Status = 'new' or 'ready' or 'prepping'
    ↓
converted_deal_id = NULL
    ↓
No deals to count stages from
    ↓
Stage columns show 0
```

### To Get Stage Data:

You need to either:

**Option A: Convert Existing Leads to Deals**
```sql
-- Example: Convert ready leads to deals at SQL stage
DO $$
DECLARE
  lead_record RECORD;
  new_deal_id UUID;
  sql_stage_id UUID;
BEGIN
  -- Get SQL stage ID
  SELECT id INTO sql_stage_id FROM deal_stages WHERE name = 'SQL' LIMIT 1;

  -- Loop through ready leads from LinkedIn Ads
  FOR lead_record IN
    SELECT l.*
    FROM leads l
    LEFT JOIN savvycal_link_mappings slm ON slm.link_id = l.booking_link_id
    WHERE l.status = 'ready'
      AND l.converted_deal_id IS NULL
      AND slm.source_name = 'LinkedIn Ads'
    LIMIT 10  -- Test with 10 first
  LOOP
    -- Create deal
    INSERT INTO deals (
      name,
      company,
      contact_name,
      contact_email,
      value,
      stage_id,
      owner_id
    ) VALUES (
      COALESCE(lead_record.contact_name, 'LinkedIn Lead'),
      lead_record.domain,
      lead_record.contact_name,
      lead_record.contact_email,
      0,  -- Initial value
      sql_stage_id,
      lead_record.owner_id
    )
    RETURNING id INTO new_deal_id;

    -- Link lead to deal
    UPDATE leads
    SET
      converted_deal_id = new_deal_id,
      status = 'converted'
    WHERE id = lead_record.id;
  END LOOP;
END $$;
```

**Option B: Wait for Natural Lead Conversion**
- As you work with leads, manually convert them to deals
- The stage tracking will populate naturally over time

## 🎯 Expected Behavior After Fix

### When Filtering Works:
1. Click "Total Leads" number → See all leads from that source
2. Click stage number → See leads from that source at that stage
3. Filter badges appear showing active filters
4. Can clear filters individually or all at once

### When No Results Found:
- Friendly empty state message appears
- Shows which filters are active
- Provides "Clear all filters" button
- Page doesn't crash or show blank screen

## 📊 Testing Checklist

- [ ] Navigate to Lead Source Performance table
- [ ] Verify stage columns appear (may be 0 if no deals yet)
- [ ] Click a total leads number → Should navigate to filtered view
- [ ] If 0 results → Should see empty state message (not blank screen)
- [ ] Filter badges should appear at top
- [ ] Click "×" on badge → Should remove that filter
- [ ] Click "Clear all" → Should remove all filters
- [ ] Run debug queries to check data structure

## 🔄 Next Steps

1. **Run debug queries** to understand your data
2. **Decide conversion strategy**:
   - Convert existing leads to deals (Option A)
   - Or wait for natural conversion (Option B)
3. **Test filtering** with the fixed blank screen issue
4. **Monitor stage data** as leads convert to deals

## 📝 Files Modified

1. `src/pages/leads/LeadsInbox.tsx`
   - Added empty state for filtered results
   - Added safety check for auto-select
   - Fixed potential array access error

2. `src/lib/services/leadService.ts`
   - Added converted_deal with stage to query
   - Now fetches deal stage information with leads

3. `DEBUG_LEAD_SOURCE_TRACKING.sql`
   - Comprehensive debugging queries
   - Helps identify data issues
