# Smart Pipeline Automation System

User-configurable automation system that executes custom actions when deals move between pipeline stages.

## 🎯 Overview

The Smart Pipeline Automation system allows users to create custom rules that automatically execute actions when deals transition between pipeline stages. This gives users full control over their workflow automations.

### Key Features

- **User-Configurable Rules**: Create custom automation rules via admin interface
- **Multiple Action Types**: Support for activities, tasks, notifications, and field updates
- **Stage-Specific Triggers**: Rules can trigger on specific stage transitions or any transition to a target stage
- **Execution Order Control**: Rules execute in configurable order
- **Audit Trail**: Complete logging of all rule executions
- **Admin Control**: Full CRUD interface for managing automation rules

## 🏗️ System Architecture

### Components

1. **Database Schema**: `pipeline_automation_rules` and `pipeline_automation_executions` tables
2. **Admin Interface**: `PipelineAutomationAdmin.tsx` for rule management
3. **Execution Engine**: `pipelineAutomationEngine.ts` for rule processing
4. **Database Trigger**: PostgreSQL trigger for automatic execution
5. **Client-Side Fallback**: Backup execution in case database trigger fails

### Data Flow

```
Deal Stage Change → Database Trigger → Find Matching Rules → Execute Actions → Log Results
                                                         ↓
                               Client Fallback (if trigger fails) → Execute Actions → Log Results
```

## 🚀 Getting Started

### Access the Interface

1. Navigate to `/admin` 
2. Click on the **Pipeline Automation** tab
3. Admin privileges required (`is_admin = true`)

### Creating Your First Rule

1. Click **"New Automation Rule"**
2. Configure the rule:
   - **Rule Name**: Descriptive name (e.g., "Auto-create proposal activity")
   - **From Stage**: Optional source stage (leave blank for "any stage")
   - **To Stage**: Required target stage
   - **Action Type**: Choose from activity, task, notification, or field update
   - **Action Details**: Configure the specific action parameters
   - **Status**: Set to Active to enable the rule

3. Click **"Create"** to save

### Example Rules

#### Auto-Create Proposal Activity
- **From Stage**: SQL
- **To Stage**: Opportunity  
- **Action**: Create Activity
- **Activity Type**: Proposal
- **Title**: "Proposal sent"
- **Amount Source**: Use Deal Value

#### Follow-Up Task After Verbal Agreement
- **From Stage**: Opportunity
- **To Stage**: Verbal
- **Action**: Create Task
- **Title**: "Follow up on verbal agreement"
- **Days After**: 3
- **Priority**: High

## 📊 Action Types

### 1. Create Activity

Creates a new activity record when the rule triggers.

**Parameters**:
- **Activity Type**: proposal, meeting, call, demo, email, follow_up
- **Activity Title**: Display name for the activity
- **Activity Details**: Optional description
- **Amount Source**: 
  - None: No monetary value
  - Deal Value: Use the deal's value
  - Fixed Amount: Set a specific amount

**Use Cases**:
- Auto-log proposal activities when moving to Opportunity stage
- Create meeting activities when moving to SQL stage
- Log completion activities when deals are won

### 2. Create Task

Creates a follow-up task for the deal owner.

**Parameters**:
- **Task Title**: Name of the task
- **Task Description**: Detailed instructions
- **Task Type**: follow_up, onboarding, check_in, reminder, action
- **Priority**: low, medium, high, urgent
- **Days After**: Number of days from stage transition to set as due date

**Use Cases**:
- Schedule follow-up calls after proposals
- Create onboarding tasks for signed deals
- Set reminders for contract renewals

### 3. Send Notification

Displays notifications to users (can be extended for email/Slack).

**Parameters**:
- **Message**: Notification content
- **Type**: info, success, warning, error (affects display style)

**Use Cases**:
- Alert when high-value deals move to final stages
- Notify about deals requiring urgent attention
- Celebrate deal closures

### 4. Update Field

Updates specific fields on the deal record (future enhancement).

**Parameters**:
- **Field Name**: Database field to update
- **Field Value**: New value to set

**Use Cases**:
- Auto-set probability based on stage
- Update expected close dates
- Apply tags or labels

## 🔧 Rule Configuration

### Execution Order

Rules are executed in order of their `execution_order` value (ascending). Use this to:

- Ensure activities are created before tasks
- Set up dependencies between rules
- Control the sequence of actions

### Stage Matching

**From Stage (Optional)**:
- Specify a source stage to only trigger when moving FROM that specific stage
- Leave blank to trigger when moving from ANY stage to the target stage

**To Stage (Required)**:
- The destination stage that triggers the rule
- Must be specified for every rule

### Rule Status

- **Active**: Rule will execute automatically
- **Inactive**: Rule is disabled and will not execute

## 📈 Monitoring & Audit

### Execution Logs

All rule executions are logged in the `pipeline_automation_executions` table:

- **Success**: Rule executed without errors
- **Failed**: Rule execution encountered an error
- **Skipped**: Rule was skipped due to conditions not being met

### Viewing Logs

Access logs through:
1. Database queries for detailed analysis
2. Future: Admin interface log viewer (planned enhancement)

### Performance Metrics

- Database triggers typically execute in <5ms
- Client fallback adds ~100-200ms to stage transitions
- Minimal impact on user experience

## 🛡️ Security & Permissions

### Access Control

- **Admin Management**: Only admins can create/edit/delete rules
- **Rule Viewing**: All users can view active rules
- **Execution Logs**: Users can view logs for their own deals, admins see all

### Data Safety

- Rule execution failures don't block stage transitions
- Duplicate prevention for activities and tasks
- Comprehensive error handling and logging

## 🔄 Integration with Existing Systems

### Smart Tasks Compatibility

Pipeline Automation complements the existing Smart Tasks system:

- **Smart Tasks**: Activity-triggered (create task when activity is logged)
- **Pipeline Automation**: Stage-triggered (create activity/task when stage changes)
- Both systems work together seamlessly

### Proposal Confirmation Modal

The existing proposal confirmation modal continues to work:
- User-driven proposal activities still use the modal
- Automated proposal activities bypass the modal
- Both approaches create the same activity records

## 🚨 Troubleshooting

### Rules Not Executing

1. **Check Rule Status**: Ensure rule is Active
2. **Verify Stage Matching**: Confirm From/To stages match the transition
3. **Review Error Logs**: Check execution_logs for error messages
4. **Database Trigger**: Verify trigger is enabled

### Common Issues

**Duplicate Activities**:
- System prevents duplicates automatically
- Check activity type matching in rules

**Missing Tasks**:
- Verify task parameters are complete
- Check due date calculations

**Performance Impact**:
- Review number of active rules
- Consider execution order optimization

## 🔮 Future Enhancements

### Planned Features

1. **Log Viewer Interface**: Admin UI for viewing execution logs
2. **Rule Testing**: Test rules before activation
3. **Conditional Logic**: More complex rule conditions
4. **External Integrations**: Email, Slack, webhooks
5. **Rule Templates**: Pre-built rule templates for common scenarios

### API Extensions

- REST endpoints for rule management
- Webhook support for external integrations
- Bulk rule operations

## 📚 Technical Reference

### Database Schema

```sql
-- Main rules table
CREATE TABLE pipeline_automation_rules (
  id UUID PRIMARY KEY,
  rule_name TEXT NOT NULL,
  from_stage_id UUID REFERENCES deal_stages(id),
  to_stage_id UUID NOT NULL REFERENCES deal_stages(id),
  action_type TEXT NOT NULL,
  -- Action-specific parameters...
  is_active BOOLEAN DEFAULT true,
  execution_order INTEGER DEFAULT 0
);

-- Execution audit log
CREATE TABLE pipeline_automation_executions (
  id UUID PRIMARY KEY,
  rule_id UUID REFERENCES pipeline_automation_rules(id),
  deal_id UUID REFERENCES deals(id),
  execution_status TEXT NOT NULL,
  execution_details JSONB,
  executed_at TIMESTAMP DEFAULT NOW()
);
```

### API Endpoints

- `GET /pipeline_automation_rules` - List rules (admin)
- `POST /pipeline_automation_rules` - Create rule (admin)
- `PUT /pipeline_automation_rules/:id` - Update rule (admin)
- `DELETE /pipeline_automation_rules/:id` - Delete rule (admin)
- `GET /pipeline_automation_executions` - View execution logs

### Configuration Files

- `src/pages/PipelineAutomationAdmin.tsx` - Admin interface
- `src/lib/utils/pipelineAutomationEngine.ts` - Execution engine
- `supabase/migrations/20250903170000_create_pipeline_automation_rules.sql` - Database schema

---

**Need Help?** Contact your system administrator or check the execution logs for detailed error information.