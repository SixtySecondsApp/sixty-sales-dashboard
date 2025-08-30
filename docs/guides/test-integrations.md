# Integration Testing Guide

## ✅ Step 1: Run SQL Fix (COMPLETED)
I've created `fix-duplicate-deals-sql.sql` that will:
- Separate Viewpoint deals into unique deal IDs
- Link all deals to proper company records
- Maintain data integrity

**To run**: Copy the SQL script into your Supabase SQL Editor and execute it.

## 🧪 Step 2: Test CRM Companies Page Deal Counts

### What to test:
1. Navigate to `/crm/companies`
2. Look for companies with deal counts > 0
3. Click on the deal count number (should be blue and clickable)
4. Verify CompanyDealsModal opens showing all deals for that company

### Expected behavior:
- Deal counts are clickable (blue text with hover effects)
- Modal shows all deals for the selected company
- Each deal shows:
  - Deal name with date
  - Deal type (Subscription/One-off/Standard)
  - Revenue breakdown (Total Value, MRR, One-off)
  - Status and stage
  - View button to open deal details

### Test companies:
- Viewpoint (should show 2 deals after fix)
- Any other companies with multiple deals

## 🏢 Step 3: Test Building Icons Next to Client Names

### What to test:
1. Navigate to `/subscriptions` (Clients page)
2. Look for building icons next to client names
3. Click the building icon next to any client name
4. Verify it opens CRM companies page with that company pre-searched

### Expected behavior:
- Building icon appears next to each client name
- Clicking opens `/crm/companies?search=ClientName` in new tab
- Companies page shows filtered results for that client
- Can see the company record and all its deals

### Test clients:
- Viewpoint
- Viewpoint VC  
- Any other clients in the list

## 🔧 Step 4: Verify Independent Deal Editing

### What to test (after running SQL fix):
1. Go to Clients page (`/subscriptions`)
2. Find the two Viewpoint entries (should have different dates)
3. Click the £ edit button on the first Viewpoint deal
4. Change the MRR value (e.g., set to £1000)
5. Save and verify only that deal is updated
6. Click the £ edit button on the second Viewpoint deal  
7. Change the MRR value to a different amount (e.g., £2000)
8. Save and verify both deals now have different MRR values

### Expected behavior:
- Each deal has its own unique deal ID after the fix
- Editing one deal doesn't affect the other
- MRR changes are reflected immediately in the table
- Dashboard MRR stats update accordingly
- Click "Linked 🔗" to view each deal's unique details

## 🔗 Step 5: Test Deal Details Modal

### What to test:
1. Click "Linked 🔗" next to any client in the Clients table
2. Verify DealDetailsModal opens with complete deal information
3. Test with multiple different deals to ensure each shows unique data

### Expected behavior:
- Modal opens with deal-specific information
- Shows correct deal name, company, contact info
- Displays proper revenue breakdown
- Shows status, stage, and timeline information
- No "Deal not found" errors

## 📊 Step 6: End-to-End Workflow Test

### Complete workflow:
1. **Clients Page**: View all clients and their deals
2. **Edit Deal**: Change revenue for a specific deal
3. **View Deal**: Click "Linked 🔗" to see deal details
4. **CRM Integration**: Click building icon to see company page
5. **Company Deals**: Click deal count to see all company deals
6. **Verify Independence**: Confirm each deal is unique and editable

### Success criteria:
- ✅ Each client activity has unique deal ID
- ✅ Multiple deals per company work correctly  
- ✅ Deal editing is independent
- ✅ CRM integration shows all deals per company
- ✅ No "deal not found" errors
- ✅ MRR calculations update correctly

## 🎯 Expected Results After All Tests

**Data Structure:**
```
Company: Viewpoint
├── Deal 1: "Viewpoint - Jul 31, 2025" (Viewpoint VC)
└── Deal 2: "Viewpoint - Aug 2, 2025" (Viewpoint)

Activities:
├── Activity 1 → Deal 1 (unique ID)
└── Activity 2 → Deal 2 (unique ID)
```

**Functional Results:**
- Two separate Viewpoint entries in Clients table
- Each editable independently via £ button
- Each has "Linked 🔗" button showing unique deal details
- Building icons open CRM company page showing both deals
- Company page shows "2" in deals column (clickable)
- Clicking "2" shows modal with both Viewpoint deals listed