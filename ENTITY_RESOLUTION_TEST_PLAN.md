# Entity Resolution System - Comprehensive Test Plan

## 🎯 Testing Objectives

1. **Migration Success**: Verify ≥90% of deals have entity relationships
2. **Data Integrity**: Ensure companies and contacts are correctly linked
3. **Fuzzy Matching**: Confirm duplicate prevention is working
4. **Frontend Integration**: Test DealWizard and QuickAdd workflows
5. **Admin Interface**: Verify manual review functionality
6. **Performance**: Ensure entity resolution is fast (<2s)

---

## 📊 Phase 1: Migration Verification (DATABASE)

### Test 1.1: Overall Entity Coverage
**Purpose**: Verify migration success rate

```sql
SELECT
  COUNT(*) as total_deals,
  COUNT(company_id) as with_company,
  COUNT(primary_contact_id) as with_contact,
  ROUND(100.0 * COUNT(company_id) / COUNT(*), 1) as company_pct,
  ROUND(100.0 * COUNT(primary_contact_id) / COUNT(*), 1) as contact_pct,
  COUNT(*) FILTER (WHERE company_id IS NULL OR primary_contact_id IS NULL) as needs_attention
FROM deals;
```

**Success Criteria**:
- ✅ `company_pct` ≥ 90%
- ✅ `contact_pct` ≥ 90%
- ✅ `needs_attention` ≤ 60 deals

---

### Test 1.2: Flagged Deals Breakdown
**Purpose**: Verify flagging logic is working correctly

```sql
SELECT
  status,
  reason,
  COUNT(*) as count
FROM deal_migration_reviews
GROUP BY status, reason
ORDER BY COUNT(*) DESC;
```

**Success Criteria**:
- ✅ Total flagged deals < 60 (vs. 1,078 before fix)
- ✅ No `entity_creation_failed` errors (or very few <5)
- ✅ Flags are legitimate: `no_email`, `invalid_email`, `fuzzy_match_uncertainty`

---

### Test 1.3: Company Creation from Domains
**Purpose**: Verify domain extraction and company creation

```sql
-- Check companies created from email domains
SELECT
  c.name,
  c.domain,
  COUNT(d.id) as deal_count,
  MIN(d.contact_email) as sample_email
FROM companies c
JOIN deals d ON d.company_id = c.id
WHERE c.created_at >= NOW() - INTERVAL '1 hour'  -- Created during migration
GROUP BY c.id, c.name, c.domain
ORDER BY deal_count DESC
LIMIT 10;
```

**Success Criteria**:
- ✅ Company names match domain (e.g., `dlrsearch.com` → "DLR Search")
- ✅ Multiple deals from same domain share one company
- ✅ No duplicate companies for same domain

---

### Test 1.4: Contact Deduplication (Fuzzy Matching)
**Purpose**: Verify fuzzy matching prevents duplicate contacts

```sql
-- Check for potential duplicate contacts within same company
SELECT
  c.company_id,
  comp.name as company_name,
  c.email,
  c.full_name,
  COUNT(*) OVER (PARTITION BY c.company_id, c.email) as email_duplicates,
  similarity(c.full_name, LAG(c.full_name) OVER (PARTITION BY c.company_id ORDER BY c.full_name)) as name_similarity
FROM contacts c
JOIN companies comp ON c.company_id = comp.id
WHERE c.created_at >= NOW() - INTERVAL '1 hour'
ORDER BY c.company_id, c.email;
```

**Success Criteria**:
- ✅ No duplicate emails within same company (`email_duplicates` = 1)
- ✅ Similar names (>80% similarity) share same contact record
- ✅ Fuzzy matching prevented unnecessary duplicates

---

### Test 1.5: Sample Migrated Deals
**Purpose**: Spot-check quality of migrated data

```sql
SELECT
  d.id,
  d.company as original_company,
  d.contact_name as original_contact,
  d.contact_email,
  c.name as resolved_company,
  c.domain,
  ct.full_name as resolved_contact,
  ct.email as resolved_email,
  ct.is_primary
FROM deals d
JOIN companies c ON d.company_id = c.id
JOIN contacts ct ON d.primary_contact_id = ct.id
WHERE d.company_id IS NOT NULL
  AND d.created_at < NOW() - INTERVAL '1 week'  -- Legacy deals
ORDER BY RANDOM()
LIMIT 20;
```

**Success Criteria**:
- ✅ Resolved companies match original company names
- ✅ Resolved contacts match original contact names/emails
- ✅ Domains extracted correctly from emails
- ✅ Primary contacts flagged appropriately

---

## 🧪 Phase 2: Frontend Integration Testing (UI)

### Test 2.1: DealWizard - New Deal Creation
**Purpose**: Verify entity resolution in deal creation workflow

**Steps**:
1. Navigate to DealWizard
2. Enter deal details:
   - **Company**: "Test Company XYZ"
   - **Contact Name**: "John Smith"
   - **Contact Email**: "john.smith@testxyz.com"
   - **Deal Value**: $10,000
3. Complete wizard and create deal

**Verify in Database**:
```sql
SELECT
  d.name as deal_name,
  d.company_id,
  d.primary_contact_id,
  c.name as company_name,
  c.domain,
  ct.full_name as contact_name,
  ct.email
FROM deals d
JOIN companies c ON d.company_id = c.id
JOIN contacts ct ON d.primary_contact_id = ct.id
WHERE d.created_at >= NOW() - INTERVAL '5 minutes'
ORDER BY d.created_at DESC
LIMIT 1;
```

**Success Criteria**:
- ✅ Deal has `company_id` and `primary_contact_id` populated
- ✅ Company created with name "Test Company XYZ" and domain "testxyz.com"
- ✅ Contact created with name "John Smith" and email "john.smith@testxyz.com"
- ✅ User receives toast notification: "Created company Test Company XYZ"
- ✅ User receives toast notification: "Created contact John Smith"

---

### Test 2.2: DealWizard - Duplicate Prevention
**Purpose**: Verify fuzzy matching prevents duplicate entities

**Steps**:
1. Create first deal:
   - Company: "Test Company XYZ"
   - Contact: "John Smith" / "john.smith@testxyz.com"
2. Create second deal with slight variation:
   - Company: "Test Company XYZ"
   - Contact: "Jon Smith" / "john.smith@testxyz.com" (same email, similar name)

**Verify in Database**:
```sql
SELECT
  company_id,
  COUNT(DISTINCT id) as deal_count
FROM deals
WHERE company_id IN (
  SELECT id FROM companies WHERE name LIKE '%Test Company XYZ%'
)
GROUP BY company_id;
```

**Success Criteria**:
- ✅ Only ONE company created for "Test Company XYZ"
- ✅ Only ONE contact created (fuzzy matched "Jon Smith" to "John Smith")
- ✅ Both deals share same `company_id` and `primary_contact_id`
- ✅ Second deal shows toast: "Found existing company Test Company XYZ"

---

### Test 2.3: QuickAdd - Meeting Activity
**Purpose**: Verify entity resolution in QuickAdd workflow

**Steps**:
1. Open QuickAdd modal
2. Select "Meeting" activity
3. Enter:
   - **Company**: "QuickAdd Test Inc"
   - **Contact Name**: "Jane Doe"
   - **Contact Email**: "jane@quickaddtest.com"
4. Submit

**Verify in Database**:
```sql
SELECT
  a.activity_type,
  a.notes,
  d.company_id,
  d.primary_contact_id,
  c.name as company_name,
  ct.full_name as contact_name
FROM activities a
JOIN deals d ON a.deal_id = d.id
JOIN companies c ON d.company_id = c.id
JOIN contacts ct ON d.primary_contact_id = ct.id
WHERE a.created_at >= NOW() - INTERVAL '5 minutes'
  AND a.activity_type = 'meeting'
ORDER BY a.created_at DESC
LIMIT 1;
```

**Success Criteria**:
- ✅ Activity created with associated deal
- ✅ Deal has entities: company "QuickAdd Test Inc" and contact "Jane Doe"
- ✅ Company domain extracted: "quickaddtest.com"
- ✅ No errors in console

---

### Test 2.4: QuickAdd - Personal Email Handling
**Purpose**: Verify personal email domains don't create company domains

**Steps**:
1. Create deal via QuickAdd with:
   - Company: "Freelancer Services"
   - Contact Email: "freelancer@gmail.com"

**Verify in Database**:
```sql
SELECT
  c.name,
  c.domain
FROM companies c
WHERE c.name = 'Freelancer Services';
```

**Success Criteria**:
- ✅ Company created with name "Freelancer Services"
- ✅ Company `domain` is NULL (gmail.com ignored)
- ✅ Contact created with email "freelancer@gmail.com"

---

## 👨‍💼 Phase 3: Admin Interface Testing (MANUAL)

### Test 3.1: Access Admin Review Interface
**Purpose**: Verify admin interface is accessible

**Steps**:
1. Navigate to `/admin/deal-migration-review`
2. Verify interface loads without errors

**Success Criteria**:
- ✅ Page loads successfully
- ✅ Shows list of flagged deals (if any)
- ✅ Shows filters: "Pending", "All"
- ✅ Search box functional

---

### Test 3.2: Review Flagged Deal
**Purpose**: Test manual deal resolution workflow

**Steps**:
1. Select a flagged deal from the list
2. Review original data (company, contact, email)
3. Create or select company
4. Create or select contact
5. Add resolution notes
6. Click "Resolve"

**Verify in Database**:
```sql
SELECT
  dmr.status,
  dmr.reason,
  dmr.resolution_notes,
  dmr.resolved_at,
  d.company_id,
  d.primary_contact_id
FROM deal_migration_reviews dmr
JOIN deals d ON dmr.deal_id = d.id
WHERE dmr.status = 'resolved'
ORDER BY dmr.resolved_at DESC
LIMIT 1;
```

**Success Criteria**:
- ✅ Review marked as `status = 'resolved'`
- ✅ Deal updated with `company_id` and `primary_contact_id`
- ✅ Resolution notes saved
- ✅ `resolved_at` timestamp populated
- ✅ Deal removed from pending list

---

### Test 3.3: Archive Invalid Deal
**Purpose**: Test archiving workflow for invalid deals

**Steps**:
1. Select a deal that should be archived (e.g., test data)
2. Click "Archive" button
3. Confirm archival

**Verify in Database**:
```sql
SELECT
  status,
  reason
FROM deal_migration_reviews
WHERE status = 'archived'
ORDER BY created_at DESC
LIMIT 1;
```

**Success Criteria**:
- ✅ Review marked as `status = 'archived'`
- ✅ Deal removed from pending list
- ✅ Deal still visible in "All" filter

---

## ⚡ Phase 4: Performance Testing

### Test 4.1: Entity Resolution Speed
**Purpose**: Measure entity resolution performance

**Test Script** (Run in browser console on DealWizard page):
```javascript
// Time entity resolution
const startTime = performance.now();

// Create test deal
await fetch('/api/deals', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    company: 'Performance Test Co',
    contact_name: 'Test User',
    contact_email: 'test@perftest.com',
    value: 5000
  })
});

const endTime = performance.now();
console.log(`Entity resolution took ${endTime - startTime}ms`);
```

**Success Criteria**:
- ✅ Total time < 2000ms (target: <2s)
- ✅ No console errors
- ✅ Deal created with entities

---

### Test 4.2: Concurrent Deal Creation
**Purpose**: Test performance under concurrent load

**Test Script**:
```javascript
// Create 10 deals concurrently
const promises = Array.from({ length: 10 }, (_, i) =>
  fetch('/api/deals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: `Concurrent Test ${i}`,
      contact_name: `User ${i}`,
      contact_email: `user${i}@concurrent.com`,
      value: 1000
    })
  })
);

const startTime = performance.now();
await Promise.all(promises);
const endTime = performance.now();

console.log(`Created 10 deals in ${endTime - startTime}ms`);
console.log(`Average: ${(endTime - startTime) / 10}ms per deal`);
```

**Success Criteria**:
- ✅ All 10 deals created successfully
- ✅ Average time < 2000ms per deal
- ✅ No duplicate companies/contacts created
- ✅ No database errors

---

## 🔍 Phase 5: Edge Case Testing

### Test 5.1: Missing Email
**Purpose**: Verify handling of deals without contact email

**Create Test Data**:
```sql
INSERT INTO deals (name, company, contact_name, owner_id, stage_id, created_at, updated_at)
VALUES (
  'Test Deal - No Email',
  'No Email Company',
  'No Email Contact',
  (SELECT id FROM auth.users LIMIT 1),
  (SELECT id FROM deal_stages WHERE name = 'SQL' LIMIT 1),
  NOW(),
  NOW()
);
```

**Verify**:
```sql
SELECT
  reason,
  original_company,
  original_contact_name,
  original_contact_email
FROM deal_migration_reviews
WHERE deal_id = (SELECT id FROM deals WHERE name = 'Test Deal - No Email');
```

**Success Criteria**:
- ✅ Deal flagged with reason `'no_email'`
- ✅ Deal appears in admin review interface
- ✅ Original data preserved in review record

---

### Test 5.2: Invalid Email Format
**Purpose**: Verify handling of malformed emails

**Create Test Data**:
```sql
UPDATE deals
SET contact_email = 'invalid-email-format'
WHERE name = 'Test Deal - Invalid Email';
```

**Run Migration Function**:
```sql
SELECT migrate_deal_entities(ROW(
  id,
  company,
  contact_name,
  'invalid-email-format',
  owner_id
)::RECORD)
FROM deals
WHERE name = 'Test Deal - Invalid Email';
```

**Success Criteria**:
- ✅ Returns `{"success": false}`
- ✅ Deal flagged with reason `'invalid_email'`

---

### Test 5.3: Very Similar Names (Fuzzy Matching Boundary)
**Purpose**: Test fuzzy matching at 80% similarity threshold

**Test Cases**:
```sql
-- Should match (>80% similar)
SELECT similarity('John Smith', 'Jon Smith');  -- ~0.83
SELECT similarity('Robert Johnson', 'Bob Johnson');  -- ~0.82

-- Should NOT match (<80% similar)
SELECT similarity('John Smith', 'Jane Doe');  -- ~0.30
SELECT similarity('Michael Brown', 'Michelle Brown');  -- ~0.78
```

**Create Test Deals**:
1. Deal 1: "John Smith" / john@test.com
2. Deal 2: "Jon Smith" / john@test.com (same email, similar name)
3. Deal 3: "Jane Doe" / jane@test.com (different email, different name)

**Success Criteria**:
- ✅ Deals 1 & 2 share same contact (fuzzy matched)
- ✅ Deal 3 has separate contact
- ✅ No false positive matches

---

## 📝 Test Results Summary Template

```markdown
# Entity Resolution Test Results

**Date**: [DATE]
**Tester**: [NAME]
**Environment**: [Production/Staging]

## Phase 1: Migration Verification
- [ ] Test 1.1: Overall Coverage - PASS/FAIL
  - Company Coverage: XX%
  - Contact Coverage: XX%
- [ ] Test 1.2: Flagged Deals - PASS/FAIL
  - Total Flagged: XX
- [ ] Test 1.3: Company Creation - PASS/FAIL
- [ ] Test 1.4: Fuzzy Matching - PASS/FAIL
- [ ] Test 1.5: Sample Deals - PASS/FAIL

## Phase 2: Frontend Integration
- [ ] Test 2.1: DealWizard Creation - PASS/FAIL
- [ ] Test 2.2: Duplicate Prevention - PASS/FAIL
- [ ] Test 2.3: QuickAdd Meeting - PASS/FAIL
- [ ] Test 2.4: Personal Email - PASS/FAIL

## Phase 3: Admin Interface
- [ ] Test 3.1: Access Interface - PASS/FAIL
- [ ] Test 3.2: Resolve Deal - PASS/FAIL
- [ ] Test 3.3: Archive Deal - PASS/FAIL

## Phase 4: Performance
- [ ] Test 4.1: Resolution Speed - PASS/FAIL
  - Time: XXXms
- [ ] Test 4.2: Concurrent Load - PASS/FAIL
  - Time: XXXms avg

## Phase 5: Edge Cases
- [ ] Test 5.1: Missing Email - PASS/FAIL
- [ ] Test 5.2: Invalid Email - PASS/FAIL
- [ ] Test 5.3: Fuzzy Matching - PASS/FAIL

## Issues Found
[List any issues discovered during testing]

## Overall Status
✅ PASSED / ❌ FAILED / ⚠️ PARTIAL

## Recommendations
[Any recommendations for improvements]
```

---

## 🚀 Quick Start Testing

**Minimal Test Set** (Run these first):
1. ✅ Migration verification queries (Phase 1.1, 1.2)
2. ✅ Create one deal via DealWizard (Phase 2.1)
3. ✅ Check admin interface loads (Phase 3.1)
4. ✅ Verify performance <2s (Phase 4.1)

**Full Test Suite** (Complete validation):
- Run all phases sequentially
- Document results in summary template
- Report any failures or anomalies

---

**Next Step**: Start with the migration verification queries from Phase 1! 🎯
