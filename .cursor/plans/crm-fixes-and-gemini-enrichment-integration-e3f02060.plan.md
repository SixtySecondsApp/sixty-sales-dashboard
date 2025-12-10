---
name: CRM Fixes and Gemini Enrichment Integration Plan
overview: ""
todos: []
---

# CRM Fixes and Gemini Enrichment Integration Plan

## Overview

This plan addresses all issues found in the QA audit and adds AI-powered enrichment using Google Gemini 2.5 Flash to automatically populate missing contact and company data.

## Phase 1: Critical Bug Fixes

### 1.1 Fix Add Contact Modal Not Opening

**Files:** `src/pages/ElegantCRM.tsx`, `src/components/AddContactModal.tsx`

**Issue:** Modal state updates but modal doesn't render

**Fix:**

- Verify `addContactModalOpen` state is properly initialized
- Check z-index conflicts (modal uses `z-50`, ensure no parent has lower z-index)
- Add debug logging to verify state changes
- Ensure modal portal renders correctly (check if `fixed inset-0` positioning works)
- Verify `isOpen` prop is correctly passed and modal's early return logic works

**Implementation:**

- Add console.log to track state changes
- Check for CSS conflicts in `src/index.css`
- Verify no other modals are blocking (check Dialog components)
- Test with React DevTools to verify state updates

### 1.2 Fix Search Placeholder Text

**Files:** `src/pages/ElegantCRM.tsx`

**Issue:** Search input shows "Search companies..." on Contacts tab

**Fix:**

- Make placeholder dynamic based on `activeTab` state
- Update search input placeholder: `placeholder={activeTab === 'contacts' ? 'Search contacts...' : activeTab === 'companies' ? 'Search companies...' : 'Search...'}`

### 1.3 Fix Contact Edit Form Data Inconsistency

**Files:** `src/components/ContactEditModal.tsx` (or contact detail edit component)

**Issue:** First name shows "John" instead of "Corrina" for Corrina Sheridan

**Fix:**

- Verify contact data fetching in detail page
- Check form initialization logic
- Ensure `first_name` field is correctly mapped from contact object
- Add data validation to prevent incorrect field mapping

### 1.4 Improve Empty State Handling

**Files:** `src/pages/ElegantCRM.tsx`, `src/components/CompanyCard.tsx`, `src/components/ContactCard.tsx`

**Issue:** "Industry not specified", "Size not specified", "No title specified" displayed as-is

**Fix:**

- Replace with better empty states: "—" or "Not set" with muted styling
- Add tooltips explaining missing data
- Consider hiding empty fields or showing "Add industry" action button

## Phase 2: Gemini 2.5 Flash Integration

### 2.1 Create Gemini Enrichment Service

**New File:** `src/lib/services/geminiEnrichmentService.ts`

**Purpose:** Centralized service for Gemini API calls to enrich contacts and companies

**Features:**

- Use existing Gemini integration pattern from `supabase/functions/process-lead-prep/index.ts`
- Support for Gemini 2.5 Flash model (`gemini-2.0-flash-exp`)
- Structured JSON response parsing
- Error handling and retry logic
- Rate limiting and caching

**API Endpoint:** `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent`

**Environment Variables:**

- Add `VITE_GEMINI_API_KEY` to `.env` (or use existing `GEMINI_API_KEY` from edge functions)

### 2.2 Create Contact Enrichment Function

**File:** `src/lib/services/geminiEnrichmentService.ts`

**Function:** `enrichContact(contact: Contact)`

**Enrichment Fields:**

- Job title (if missing)
- Company name (if missing, extract from email domain)
- LinkedIn URL (search and suggest)
- Phone number format validation
- Industry (infer from email domain/company)
- Notes/summary (AI-generated brief)

**Prompt Template:**

```
Given contact: {name}, {email}, {company}, {phone}
Enrich with:
- Accurate job title (if missing)
- Company LinkedIn URL
- Industry classification
- Brief professional summary
Return JSON: {title, linkedin_url, industry, summary, confidence}
```

### 2.3 Create Company Enrichment Function

**File:** `src/lib/services/geminiEnrichmentService.ts`

**Function:** `enrichCompany(company: Company)`

**Enrichment Fields:**

- Industry (standardize to: Technology, Healthcare, Finance, etc.)
- Company size (infer from domain/website: startup, small, medium, large, enterprise)
- Description (AI-generated company overview)
- LinkedIn company URL
- Address (if website provides)
- Phone number (if website provides)
- Recent news/updates (optional, for context)

**Prompt Template:**

```
Given company: {name}, {domain}, {website}
Enrich with:
- Industry classification (Technology, Healthcare, Finance, etc.)
- Company size estimate (startup, small, medium, large, enterprise)
- Professional description
- LinkedIn company URL
- Address if available
Return JSON: {industry, size, description, linkedin_url, address, phone, confidence}
```

### 2.4 Create Enrichment UI Components

#### 2.4.1 Enrichment Button Component

**New File:** `src/components/crm/EnrichButton.tsx`

**Features:**

- "Enrich with AI" button on contact/company detail pages
- Loading state during enrichment
- Success/error toast notifications
- Shows enriched fields preview before saving

#### 2.4.2 Auto-Enrichment on Create

**Files:** `src/components/AddContactModal.tsx`, `src/components/AddCompanyModal.tsx`

**Features:**

- "Enrich with AI" button in create modals
- Auto-suggest fields as user types (debounced)
- One-click enrichment after entering email/domain
- Preview enriched data before saving

#### 2.4.3 Bulk Enrichment

**File:** `src/pages/ElegantCRM.tsx`

**Features:**

- "Enrich Selected" button in select mode
- Batch enrichment for multiple contacts/companies
- Progress indicator
- Error handling per record

### 2.5 Create Edge Function for Server-Side Enrichment

**New File:** `supabase/functions/enrich-crm-record/index.ts`

**Purpose:** Server-side enrichment to avoid exposing API key in client

**Endpoints:**

- `POST /enrich-crm-record` with body: `{type: 'contact' | 'company', id: string}`

**Features:**

- Uses service role key for database access
- Calls Gemini API server-side
- Updates database directly
- Returns enriched data
- Handles rate limiting

**Security:**

- Validate user permissions (RLS)
- Rate limit per user
- Log all enrichment requests

## Phase 3: Data Quality Improvements

### 3.1 Add Data Validation Rules

**Files:** `src/lib/services/apiContactService.ts`, `src/lib/services/companyService.ts`

**Validations:**

- Email format validation (already exists, enhance)
- Phone number format normalization
- Prevent email addresses as contact names
- Company name uniqueness check (per owner)
- Domain format validation

### 3.2 Add Data Migration Script

**New File:** `scripts/migrate-crm-data-quality.ts`

**Purpose:** Clean up existing bad data

**Tasks:**

- Fix contacts with email addresses as names
- Standardize industry values
- Infer missing company sizes
- Link contacts to companies by domain
- Normalize phone number formats

### 3.3 Improve Growth Calculation

**Files:** Company metrics calculation logic

**Issue:** All companies show -50% growth

**Fix:**

- Review growth calculation formula
- Add proper baseline comparison
- Handle new companies (no growth data) gracefully
- Show "New" badge instead of negative growth for new companies

## Phase 4: UI/UX Enhancements

### 4.1 Fix Pagination Count Discrepancy

**Files:** `src/pages/ElegantCRM.tsx`

**Issue:** Shows "520 companies" in pagination but "20" in tab

**Fix:**

- Use consistent data source for both counts
- Verify filtered vs. total count logic
- Update tab count to show filtered count when filters active

### 4.2 Add Loading States

**Files:** All CRM components

**Features:**

- Skeleton loaders for list views
- Loading spinners for enrichment
- Optimistic updates for better UX

### 4.3 Add Error Boundaries

**New File:** `src/components/crm/CRMErrorBoundary.tsx`

**Purpose:** Graceful error handling in CRM module

## Phase 5: Testing & Validation

### 5.1 Unit Tests

- Test Gemini enrichment service
- Test data validation rules
- Test modal state management

### 5.2 Integration Tests

- Test enrichment flow end-to-end
- Test bulk enrichment
- Test error handling

### 5.3 Manual QA

- Verify all bugs fixed
- Test enrichment accuracy
- Test performance with large datasets

## Implementation Order

1. **Week 1: Critical Fixes**

   - Fix Add Contact modal (1.1)
   - Fix search placeholder (1.2)
   - Fix edit form data (1.3)
   - Improve empty states (1.4)

2. **Week 2: Gemini Integration**

   - Create enrichment service (2.1-2.3)
   - Create edge function (2.5)
   - Add enrichment buttons (2.4.1)
   - Test enrichment accuracy

3. **Week 3: Auto-Enrichment & Bulk**

   - Add auto-enrichment on create (2.4.2)
   - Add bulk enrichment (2.4.3)
   - Add data migration script (3.2)

4. **Week 4: Polish & Testing**

   - Fix growth calculation (3.3)
   - Fix pagination (4.1)
   - Add loading states (4.2)
   - Comprehensive testing (5)

## Files to Create/Modify

**New Files:**

- `src/lib/services/geminiEnrichmentService.ts`
- `src/components/crm/EnrichButton.tsx`
- `src/components/crm/CRMErrorBoundary.tsx`
- `supabase/functions/enrich-crm-record/index.ts`
- `scripts/migrate-crm-data-quality.ts`

**Modified Files:**

- `src/pages/ElegantCRM.tsx` (fixes + enrichment UI)
- `src/components/AddContactModal.tsx` (auto-enrichment)
- `src/components/AddCompanyModal.tsx` (auto-enrichment)
- `src/components/ContactEditModal.tsx` (data fix)
- `src/lib/services/apiContactService.ts` (validation)
- `src/lib/services/companyService.ts` (validation)
- `.env.example` (add GEMINI_API_KEY)

## Success Criteria

1. ✅ Add Contact modal opens reliably
2. ✅ Search placeholder is context-aware
3. ✅ Contact edit form shows correct data
4. ✅ Gemini enrichment populates 80%+ of missing fields accurately
5. ✅ Enrichment completes in <3 seconds per record
6. ✅ Data quality issues resolved (no email-as-name, proper industry/size)
7. ✅ Growth calculation shows accurate percentages
8. ✅ Pagination counts are consistent