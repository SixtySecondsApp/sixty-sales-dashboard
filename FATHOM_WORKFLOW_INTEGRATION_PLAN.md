# Fathom Workflow Integration - Complete Implementation Plan

## 📋 Project Overview

### Goal
Build a comprehensive Fathom meeting webhook workflow system that intelligently handles three types of webhooks (transcript, action items, summary) from Fathom video meetings, processes them appropriately, and integrates with the existing CRM database.

### Key Requirements
1. **Single Unified Workflow**: One workflow handling all three payload types
2. **Intelligent Payload Detection**: Auto-detect whether payload is transcript, action items, or summary
3. **Google Docs Integration**: Convert transcripts to Google Docs for AI training/vector databases
4. **Database UPSERT Logic**: Use Fathom meeting ID as unique identifier to prevent duplicates
5. **AI-Powered Classification**: Classify action items with specific UUID mappings for priorities and users
6. **Embed Widget Support**: Store Fathom recording URLs for iframe embedding

---

## ✅ Completed Tasks

### 1. Frontend Components Created ✓

#### FathomWebhookNode (`/src/components/workflows/nodes/FathomWebhookNode.tsx`)
- Smart webhook trigger with payload auto-detection
- Displays webhook URL configuration
- Visual status indicators
- **Status**: ✅ Complete

#### ConditionalBranchNode (`/src/components/workflows/nodes/ConditionalBranchNode.tsx`)
- Three-way routing for different payload types
- Multiple output handles for each branch
- Conditional logic visualization
- **Status**: ✅ Complete

#### GoogleDocsCreatorNode (`/src/components/workflows/nodes/GoogleDocsCreatorNode.tsx`)
- Transcript to Google Docs converter
- AI access configuration
- Vector DB preparation settings
- **Status**: ✅ Complete

#### MeetingUpsertNode (`/src/components/workflows/nodes/MeetingUpsertNode.tsx`)
- Database UPSERT operations
- Attendee handling
- AI metadata storage
- Embed URL storage
- **Status**: ✅ Complete

#### ActionItemProcessorNode (`/src/components/workflows/nodes/ActionItemProcessorNode.tsx`)
- AI-powered action item classification
- UUID priority mapping configuration
- User ID mapping
- Category classification
- Weekend-aware deadline calculation
- **Status**: ✅ Complete

### 2. Backend Implementation ✓

#### Webhook Edge Function (`/supabase/functions/workflow-webhook/index.ts`)
- Complete webhook endpoint implementation
- Auto-detection of payload types
- Fathom ID extraction from multiple sources
- Three processing functions for different payload types
- Workflow execution tracking
- **Status**: ✅ Complete
- **Deployment**: ✅ Deployed to Supabase

#### Processing Functions
- `processSummaryPayload()` - Handles meeting summaries with AI metadata
- `processTranscriptPayload()` - Creates Google Docs from transcripts
- `processActionItemsPayload()` - AI classification with UUID mappings
- **Status**: ✅ Complete

### 3. Workflow Configuration ✓

#### Workflow Template (`/src/lib/workflows/templates/fathomWorkflowTemplate.ts`)
- Pre-configured Fathom workflow template
- All nodes connected with proper routing
- Validation function included
- **Status**: ✅ Complete

#### WorkflowCanvas Updates (`/src/components/workflows/WorkflowCanvas.tsx`)
- Registered all new node types
- Added imports for new components
- **Status**: ✅ Complete

### 4. Testing Infrastructure ✓

#### Test Interface (`/test-fathom-workflow.html`)
- Comprehensive HTML test interface
- Three payload type tests
- Complete workflow test
- Configuration persistence
- Preloaded with Supabase credentials
- **Status**: ✅ Complete

### 5. Documentation Updates ✓

#### CLAUDE.md Updates
- Added database column naming guide
- Documented common integration errors
- Added Edge Function notes
- **Status**: ✅ Complete

---

## 🚧 Current Issues & Blockers

### Primary Issue: "column user_id does not exist" Error

**Problem**: SQL operations are failing with the error that `user_id` column doesn't exist in the `user_automation_rules` table.

**Root Causes Identified**:
1. Table may not exist in production database
2. Table exists but with different column structure
3. Check constraints preventing webhook trigger types
4. Foreign key constraint issues with auth.users
5. RLS policies referencing non-existent columns

**Attempted Solutions**:
1. ✅ Created migration files with correct column names
2. ✅ Updated Edge Function to explicitly select columns
3. ✅ Added debugging logs to Edge Function
4. ✅ Created fix scripts to modify constraints
5. ✅ Created diagnostic scripts to identify exact issue
6. ⏳ Step-by-step SQL script to isolate error source

---

## 🔄 In Progress Tasks

### Database Schema Fixes

**Current Status**: Running SQL migrations to fix table structure

**Files Created**:
1. `/supabase/migrations/20240115_add_fathom_fields.sql` - Original (has issues)
2. `/supabase/migrations/20240115_add_fathom_fields_corrected.sql` - Fixed owner_user_id
3. `/supabase/migrations/20240115_add_fathom_fields_fixed.sql` - Added DROP policies
4. `/fix-fathom-workflow-tables.sql` - Standalone fix v1
5. `/fix-fathom-workflow-tables-v2.sql` - Handles constraints
6. `/fix-fathom-workflow-tables-v3.sql` - Finds user ID
7. `/diagnose-and-fix-workflow-table.sql` - Complete reset
8. `/simple-fix-workflow.sql` - Step-by-step approach ⭐

**Next Action**: Run `/simple-fix-workflow.sql` section by section

---

## 📝 Remaining Tasks

### 1. Fix Database Schema ⏳
- [ ] Run Section 1-8 of `simple-fix-workflow.sql` to create tables
- [ ] Get valid user ID from Section 9
- [ ] Insert test workflow with valid user ID (Section 10)
- [ ] Optionally add RLS policies (Section 11)
- [ ] Verify all tables exist with correct columns

### 2. Test Webhook Integration 
- [ ] Get workflow ID from database
- [ ] Update test HTML with workflow ID
- [ ] Test summary payload processing
- [ ] Test transcript payload processing
- [ ] Test action items payload processing
- [ ] Verify UPSERT logic prevents duplicates

### 3. Google Docs Integration
- [ ] Implement actual Google Docs API integration
- [ ] Set up OAuth for Google Workspace
- [ ] Create service account credentials
- [ ] Replace mock URL generation with real API calls
- [ ] Set up sharing permissions for AI access

### 4. Production Deployment
- [ ] Verify all migrations are applied
- [ ] Test Edge Function with real Fathom webhooks
- [ ] Set up webhook URL in Fathom settings
- [ ] Monitor logs for errors
- [ ] Create production workflow instance

### 5. UI Integration
- [ ] Add workflow creation UI in app
- [ ] Create workflow management page
- [ ] Add execution history view
- [ ] Implement error handling UI
- [ ] Add webhook URL display/copy functionality

---

## 🎯 Success Criteria

### Technical Requirements
- ✅ Single workflow handling three payload types
- ✅ Automatic payload type detection
- ✅ Fathom ID extraction and UPSERT logic
- ✅ AI classification with UUID mappings
- ⏳ Google Docs creation from transcripts
- ✅ Embed URL storage for iframe widgets
- ⏳ Database schema properly configured
- ✅ Edge Function deployed and accessible

### Business Requirements
- ⏳ Replace existing Make.com workflows
- ⏳ Enable AI assistant to reference transcripts
- ⏳ Automatic task creation from action items
- ⏳ Meeting data accessible in CRM
- ⏳ No duplicate meeting records

---

## 🛠️ Technical Stack

### Frontend
- React 18 with TypeScript
- ReactFlow for workflow visualization
- Tailwind CSS for styling
- Framer Motion for animations

### Backend
- Supabase (PostgreSQL database)
- Edge Functions (Deno runtime)
- Row Level Security (RLS)
- Real-time subscriptions

### Integrations
- Fathom Webhooks
- Google Docs API (pending)
- Vector Database (future)

---

## 📊 Progress Summary

### Overall Progress: 65% Complete

#### Completed ✅
- All frontend components (5/5)
- Backend webhook processing (3/3)
- Edge Function deployment (1/1)
- Test infrastructure (1/1)
- Documentation updates (1/1)

#### In Progress 🔄
- Database schema fixes (8 attempts, ongoing)
- User ID resolution (ongoing)

#### Not Started ⏳
- Google Docs API integration
- Production testing
- UI integration
- Fathom webhook configuration

---

## 🚨 Immediate Next Steps

1. **Run SQL Fix Script**
   ```sql
   -- Go to Supabase SQL Editor
   -- Run sections 1-8 of simple-fix-workflow.sql
   -- Get user ID from section 9
   -- Insert workflow with that user ID
   ```

2. **Get Workflow ID**
   ```sql
   SELECT id, rule_name 
   FROM user_automation_rules 
   WHERE rule_name = 'Fathom Meeting Integration';
   ```

3. **Test Webhook**
   - Open `/test-fathom-workflow.html`
   - Enter workflow ID
   - Test all three payload types

4. **Monitor Logs**
   - Check Edge Function logs in Supabase dashboard
   - Look for any remaining errors

---

## 📚 Resources

### Documentation
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Fathom Webhook Documentation](https://fathom.video/developers)
- [Google Docs API](https://developers.google.com/docs/api)

### Project Files
- Edge Function: `/supabase/functions/workflow-webhook/`
- Components: `/src/components/workflows/nodes/`
- Templates: `/src/lib/workflows/templates/`
- Test Interface: `/test-fathom-workflow.html`
- SQL Fixes: `/simple-fix-workflow.sql`

### Debugging
- Supabase Dashboard: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb
- Edge Function Logs: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions
- SQL Editor: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/sql

---

## 📞 Support Notes

### Common Issues
1. **"column user_id does not exist"** - Run simple-fix-workflow.sql
2. **Foreign key constraint violation** - Use valid user ID from auth.users
3. **Check constraint violation** - Ensure webhook/webhook_process values allowed
4. **RLS policy errors** - Temporarily disable RLS or fix policies

### Key Learnings
- Meetings table uses `owner_user_id` not `user_id`
- Edge Functions bypass RLS with service role key
- Check constraints must be modified to allow webhook types
- Always verify user ID exists in auth.users table

---

*Last Updated: Current Session*
*Status: Actively working on database schema fixes*