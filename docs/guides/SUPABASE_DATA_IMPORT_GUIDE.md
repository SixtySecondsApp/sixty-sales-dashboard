# Supabase Data Import Guide

## Overview
Your Neon database contains complete CRM data, but your Supabase database is missing critical information. This guide explains what's missing and how to import it.

## Missing Data Analysis

### 📞 Contact Information (348 contacts)
- **100% missing**: Phone numbers, job titles, LinkedIn URLs
- **28% missing**: First names (96 contacts)
- **76% missing**: Last names (263 contacts)
- **3% missing**: Company relationships (11 contacts)

### 🏢 Company Information (316 companies)
- **100% missing**: Industry, company size, websites, addresses, phone numbers, descriptions, LinkedIn URLs
- **99% have**: Names and domains (313 with domains)

### 📊 Activity Relationships (3,521 activities)
- **79% unmapped**: 2,781 activities not linked to contacts
- **81% unmapped**: 2,850 activities not linked to deals
- **Many activities have client names** but no contact mapping

### 💼 Deal Relationships (354 deals)
- **13% missing**: 47 deals without company relationships
- **13% missing**: 47 deals without primary contact relationships
- **These deals have contact emails** that can be used to create relationships

### 🔄 Recoverable Data
From the original Neon database, we can recover:
1. **Contact information** from activities table (`client_name`, `contact_identifier`)
2. **Deal relationships** using contact emails to match existing contacts
3. **Company details** that may exist in other fields
4. **Contact details** from deals table (names, phones)

## Import Scripts

I've created 3 scripts to import the missing data:

### 1. `scripts/import-missing-data-to-supabase.js`
**Purpose**: Import and enhance company/contact data
- Imports all companies from Neon to Supabase
- Imports all contacts from Neon to Supabase  
- Creates new contacts from unmapped activities
- Fixes deal relationships using email matching
- Populates missing contact details from deals

### 2. `scripts/import-deals-activities-to-supabase.js`
**Purpose**: Import deals and activities
- Imports deal stages/pipeline stages
- Imports all deals with full details
- Imports all activities with relationships

### 3. `scripts/verify-supabase-import.js`
**Purpose**: Verify import results
- Counts records in all tables
- Shows sample data with relationships
- Identifies remaining data quality issues
- Health check for missing relationships

## Step-by-Step Import Process

### Prerequisites
1. Ensure your `.env` file has these variables:
   ```
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Make sure Supabase tables exist (companies, contacts, deals, activities, deal_stages)

### Step 1: Check Current State
```bash
node scripts/verify-supabase-import.js
```
This will show what's currently in Supabase (probably empty or minimal).

### Step 2: Import Companies and Contacts
```bash
node scripts/import-missing-data-to-supabase.js
```
This will:
- Import 316 companies from Neon
- Import 348 contacts from Neon
- Create additional contacts from activity data
- Fix deal-contact relationships
- Populate missing contact details

### Step 3: Import Deals and Activities
```bash
node scripts/import-deals-activities-to-supabase.js
```
This will:
- Import deal stages/pipeline stages
- Import 354 deals with all fields
- Import 3,521 activities with relationships

### Step 4: Verify Results
```bash
node scripts/verify-supabase-import.js
```
This will show:
- Record counts for all tables
- Sample data with relationships
- Any remaining data quality issues

## Expected Results

After running all scripts, your Supabase database should have:
- **316 companies** with names and domains
- **348+ contacts** (original + new from activities)
- **Deal stages** for your pipeline
- **354 deals** with proper company/contact relationships
- **3,521 activities** with improved contact/deal linking

## Data Quality Improvements

The import will:
1. **Link activities to contacts** using client names and contact identifiers
2. **Connect deals to contacts** using email matching
3. **Populate missing contact info** from deals table data
4. **Create proper company relationships** for contacts and deals
5. **Maintain data integrity** with proper foreign key relationships

## Troubleshooting

### Common Issues:
1. **Table doesn't exist**: Ensure Supabase tables are created first
2. **Permission denied**: Check your service role key has proper permissions
3. **Duplicate key errors**: The scripts use `upsert` to handle duplicates safely
4. **Connection timeout**: Large imports may take time, scripts include batching

### If Import Fails:
1. Check the error message for specific table/field issues
2. Verify your Supabase schema matches expected structure
3. Run verification script to see what was imported
4. Re-run specific import scripts as needed

## Manual Verification

After import, check your Supabase dashboard:
1. **Companies table**: Should have 316 records with names/domains
2. **Contacts table**: Should have 348+ records with company relationships
3. **Deals table**: Should have 354 records with contact/company links
4. **Activities table**: Should have 3,521 records with improved relationships

## Next Steps

Once imported:
1. Your CRM application should work with complete data
2. Contact records will have proper company relationships
3. Activities will be linked to the right contacts and deals
4. Deal pipeline will have proper stage relationships

The import preserves all existing data while filling in the missing relationships and details that weren't properly migrated initially. 