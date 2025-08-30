# CRM Owner Filtering - Database & System Changes

## Overview
This document outlines all changes made to implement comprehensive owner/sales rep filtering across the CRM system. The changes enable users to filter companies, deals, and contacts by specific sales representatives.

## Database Schema Requirements

### Existing Tables Used
The implementation leverages existing database tables with the following key columns:

#### `companies` table
- `owner_id` (UUID) - References the sales rep who owns the company
- Other existing columns remain unchanged

#### `deals` table  
- `owner_id` (UUID) - References the sales rep who owns the deal
- Other existing columns remain unchanged

#### `contacts` table
- `owner_id` (UUID) - References the sales rep who owns the contact
- Other existing columns remain unchanged

#### `profiles` table
- `id` (UUID) - Primary key, used as owner_id in other tables
- `first_name` (VARCHAR)
- `last_name` (VARCHAR) 
- `email` (VARCHAR)
- `stage` (VARCHAR) - Role/seniority level
- Other existing columns remain unchanged

#### `deal_stages` table
- No schema changes required
- Existing columns: `id`, `name`, `color`, `default_probability`, `created_at`, `updated_at`

### No Schema Changes Required
All required columns already exist in the database. No ALTER TABLE statements needed.

## API Endpoint Changes

### New Endpoints Added

#### 1. `/api/owners` (GET)
**Purpose**: Retrieve list of all sales representatives
**Query**: 
```sql
SELECT DISTINCT
  p.id,
  p.first_name,
  p.last_name,
  p.stage,
  p.email,
  (p.first_name || ' ' || p.last_name) as full_name
FROM profiles p
WHERE p.id IN (
  SELECT DISTINCT owner_id FROM companies WHERE owner_id IS NOT NULL
  UNION
  SELECT DISTINCT owner_id FROM deals WHERE owner_id IS NOT NULL
  UNION
  SELECT DISTINCT owner_id FROM contacts WHERE owner_id IS NOT NULL
)
ORDER BY p.first_name, p.last_name
```

**Response Format**:
```json
{
  "data": [
    {
      "id": "ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459",
      "first_name": "Andrew",
      "last_name": "Bryce", 
      "stage": "Director",
      "email": "andrew.bryce@sixtyseconds.video",
      "full_name": "Andrew Bryce"
    }
  ],
  "error": null,
  "count": 6
}
```

### Modified Endpoints

#### 1. `/api/companies` (GET)
**New Parameter**: `ownerId` (optional UUID)
**Example**: `/api/companies?ownerId=ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459&includeStats=true`

**Updated Query Logic**:
```sql
-- Base query with conditional WHERE clause
SELECT c.*, [stats columns] FROM companies c
LEFT JOIN [stats joins]
WHERE 1=1
  AND (c.name ILIKE $search OR c.domain ILIKE $search) -- if search provided
  AND c.owner_id = $ownerId -- if ownerId provided
ORDER BY c.updated_at DESC
```

#### 2. `/api/deals` (GET) 
**New Parameter**: `ownerId` (optional UUID)
**Example**: `/api/deals?ownerId=ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459`

**Updated Query Logic**:
```sql
SELECT d.*, [relationship columns] FROM deals d
LEFT JOIN [relationship joins]
WHERE 1=1
  AND d.owner_id = $ownerId -- if ownerId provided
ORDER BY d.updated_at DESC
```

#### 3. `/api/contacts` (GET)
**New Parameter**: `ownerId` (optional UUID) 
**Example**: `/api/contacts?ownerId=ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459&includeCompany=true`

**Updated Query Logic**:
```sql
SELECT ct.*, [company columns] FROM contacts ct
LEFT JOIN [company joins]
WHERE 1=1
  AND (ct.first_name ILIKE $search OR ct.last_name ILIKE $search OR ct.email ILIKE $search) -- if search provided
  AND ct.company_id = $companyId -- if companyId provided
  AND ct.owner_id = $ownerId -- if ownerId provided
ORDER BY ct.updated_at DESC
```

#### 4. `/api/user` (GET)
**Updated Response**: Fixed to return correct UUID format
**Before**:
```json
{
  "id": "andrew-bryce-123", // Invalid UUID format
  "email": "andrew@example.com"
}
```

**After**:
```json
{
  "id": "ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459", // Valid UUID from database
  "email": "andrew.bryce@sixtyseconds.video",
  "first_name": "Andrew",
  "last_name": "Bryce",
  "stage": "Director"
}
```

## Frontend Changes

### New Components Added

#### 1. `OwnerFilter.tsx`
**Purpose**: Reusable dropdown component for owner selection
**Features**:
- "All Sales Reps" option
- "👤 My Items" option (current user's data)
- Individual sales rep options with role display
- Visual indicators for selected owner

#### 2. New Hooks Added

**`useOwners.ts`**:
```typescript
export function useOwners() {
  // Fetches owners from /api/owners endpoint
}
```

**`useContactsWithFilters.ts`**:
```typescript
export function useContactsWithFilters(options: {
  ownerId?: string;
  search?: string; 
  companyId?: string;
}) {
  // Fetches contacts with owner filtering
}
```

### Modified Components

#### 1. `CompaniesTable.tsx`
- Added OwnerFilter component to toolbar
- Updated state to track `selectedOwnerId`
- Modified API calls to include `ownerId` parameter

#### 2. `Pipeline.tsx` & `PipelineContext.tsx`
- Added owner filtering to pipeline context
- Updated `useDeals` hook to accept `ownerId` parameter
- Added OwnerFilter component to pipeline controls

#### 3. Updated Hooks

**`useDeals.ts`**:
- Updated signature: `useDeals(ownerId?: string)`
- Modified API calls to include owner filtering

**`useCompanies.ts`**:
- Updated signature: `useCompanies(ownerId?: string, search?: string)`
- Modified API calls to include owner filtering

## Current Sales Team Data

Based on the database query, the following sales representatives are available:

| Name | Role | Email | UUID |
|------|------|-------|------|
| Andrew Bryce | Director | andrew.bryce@sixtyseconds.video | ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459 |
| James Lord | Trainee | james.lord@sixtyseconds.video | bf9c3ec4-70ba-43aa-95d9-4308898b60dc |
| Nick du | Trainee | nick@sixtyseconds.video | 0069cfdb-dd87-4ea2-93d5-fd87dba36885 |
| Phil O'Brien | Trainee | phil@sixtyseconds.video | e783d627-bbc6-4fac-b7d0-3913cb45b4b8 |
| Steve Gibson | Junior | steve.gibson@sixtyseconds.video | e4bb01b1-51ea-425a-ac74-0e5b5fd585c1 |

## Deployment Steps

### 1. Database Verification
Verify that all required tables and columns exist:
```sql
-- Check companies table has owner_id
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'companies' AND column_name = 'owner_id';

-- Check deals table has owner_id  
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'deals' AND column_name = 'owner_id';

-- Check contacts table has owner_id
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'contacts' AND column_name = 'owner_id';

-- Verify profiles table structure
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name IN ('id', 'first_name', 'last_name', 'email', 'stage');
```

### 2. Data Validation
Ensure owner relationships are properly established:
```sql
-- Check for orphaned owner_id references
SELECT 'companies' as table_name, COUNT(*) as orphaned_count
FROM companies c
WHERE c.owner_id IS NOT NULL 
AND c.owner_id NOT IN (SELECT id FROM profiles)

UNION

SELECT 'deals' as table_name, COUNT(*) as orphaned_count  
FROM deals d
WHERE d.owner_id IS NOT NULL
AND d.owner_id NOT IN (SELECT id FROM profiles)

UNION

SELECT 'contacts' as table_name, COUNT(*) as orphaned_count
FROM contacts ct  
WHERE ct.owner_id IS NOT NULL
AND ct.owner_id NOT IN (SELECT id FROM profiles);
```

### 3. API Server Deployment
Deploy updated `server/api.js` with:
- New `/api/owners` endpoint
- Updated filtering logic for existing endpoints
- Corrected `/api/user` endpoint returning proper UUIDs

### 4. Frontend Deployment  
Deploy updated React components:
- New OwnerFilter component
- Updated hooks with owner filtering
- Modified pages (Companies, Pipeline)

## Testing Checklist

### API Testing
- [ ] `/api/owners` returns list of sales reps
- [ ] `/api/companies?ownerId=UUID` filters correctly
- [ ] `/api/deals?ownerId=UUID` filters correctly  
- [ ] `/api/contacts?ownerId=UUID` filters correctly
- [ ] `/api/user` returns valid UUID format

### Frontend Testing
- [ ] OwnerFilter dropdown populates with sales reps
- [ ] "My Items" option filters to current user's data
- [ ] Companies page filtering works
- [ ] Pipeline page filtering works
- [ ] Filter state persists during navigation
- [ ] No console errors with UUID format

### Performance Testing
- [ ] Owner filtering queries execute efficiently
- [ ] Large datasets filter within acceptable time
- [ ] No N+1 query issues with relationship data

## Rollback Plan

If issues arise, rollback steps:

1. **API Rollback**: Revert `server/api.js` to remove owner filtering parameters
2. **Frontend Rollback**: Disable OwnerFilter components, revert to non-filtered API calls  
3. **Database**: No schema changes were made, so no database rollback needed

## Future Enhancements

Potential improvements for the owner filtering system:

1. **Role-based filtering**: Filter by sales rep roles (Director, Junior, Trainee)
2. **Team-based filtering**: Group sales reps into teams for filtering
3. **Historical ownership**: Track ownership changes over time
4. **Bulk ownership transfer**: Tools to reassign ownership en masse
5. **Advanced permissions**: Restrict data visibility based on user role

## Security Considerations

- Owner filtering relies on valid UUID format to prevent SQL injection
- Frontend validates user permissions before showing "My Items" option
- API endpoints validate owner_id parameter format before querying
- No sensitive data exposed in owner filtering responses

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Authors**: AI Assistant  
**Review Status**: Ready for deployment 