# Link Deals to CRM Data - Step-by-Step Guide

## Problem
Your deals in the pipeline are not showing contact information because they're not linked to your new CRM contacts and companies tables.

## Solution
I've created a comprehensive SQL script that will automatically link your existing deals to your CRM data.

## Steps to Fix

### Step 1: Run the SQL Script
1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste the entire contents of `link-deals-to-crm.sql` into the SQL editor
4. Click **Run** to execute the script

### Step 2: What the Script Does
The script will automatically:

1. **Link existing deals to contacts** by matching email addresses
2. **Link deals to companies** by matching company names
3. **Link deals to companies by domain** (if email domain matches company domain)
4. **Create missing contacts** from deals that don't have matching contacts in CRM
5. **Create missing companies** from deals that don't have matching companies in CRM
6. **Update contact-company relationships** where missing
7. **Create deal-contact relationship records** for proper many-to-many linking
8. **Show a summary** of what was linked

### Step 3: Verify the Results
After running the script, you should see a summary table showing:
- Total deals and how many now have company/contact links
- Total contacts and how many have company links
- Total companies and how many have domains
- Total deal-contact relationship records created

### Step 4: Refresh Your Pipeline
1. Go back to your sales dashboard
2. Navigate to the Pipeline page
3. The deals should now show proper contact and company information

## Expected Results
- **Before**: Deals show "No contact" and basic company names
- **After**: Deals show full contact names, emails, company details, and proper CRM relationships

## Technical Details
The updated `useDeals` hook now fetches:
- `companies` relationship data (name, domain, size, industry, etc.)
- `contacts` relationship data (full_name, email, phone, title, etc.)
- `deal_stages` relationship data (as before)

The `DealCard` component will automatically use this relationship data when available, falling back to the legacy fields when not.

## Troubleshooting
If you encounter any issues:
1. Check the Supabase logs for any SQL errors
2. Verify that your contacts and companies tables exist and have data
3. Make sure the deals table has the `company_id` and `primary_contact_id` columns
4. Contact me if you need help with any specific errors

## Files Modified
- `src/lib/hooks/useDeals.ts` - Updated to fetch CRM relationships
- `link-deals-to-crm.sql` - SQL script to link the data
- `LINK_DEALS_TO_CRM_GUIDE.md` - This guide

Once you run the SQL script, your pipeline should show all the contact and company information from your CRM! 