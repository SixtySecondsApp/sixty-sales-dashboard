# Pipeline Guide - Simplified 4-Stage Sales Workflow

A comprehensive guide to understanding and using the new simplified pipeline system in Sixty Sales Dashboard.

## Table of Contents
1. [Pipeline Overview](#pipeline-overview)
2. [Detailed Stage Explanations](#detailed-stage-explanations)
3. [Stage Transition Rules](#stage-transition-rules)
4. [Proposal Confirmation Modal Workflow](#proposal-confirmation-modal-workflow)
5. [Smart Task Integration](#smart-task-integration)
6. [Migration from Old Pipeline](#migration-from-old-pipeline)
7. [Troubleshooting](#troubleshooting)
8. [Best Practices](#best-practices)

## Pipeline Overview

### The New Simplified System

The Sixty Sales Dashboard has transitioned from a complex multi-stage pipeline to a streamlined **4-stage workflow** designed for maximum efficiency and clarity:

```
SQL → Opportunity → Verbal → Signed
```

### Why This Simplification Benefits Users

**Before**: Complex 8-12 stage pipeline with confusing transitions and unclear definitions
**After**: Clear, intuitive 4-stage system that mirrors natural sales progression

**Key Benefits**:
- **Reduced Complexity**: Less confusion about which stage to use
- **Faster Deal Entry**: Fewer decisions needed when creating/updating deals
- **Clearer Reporting**: Simplified metrics and forecasting
- **Better User Adoption**: Intuitive workflow that sales teams can learn quickly
- **Consistent Data**: Standardized stage definitions across all users

### Stage Probability and Color Coding

| Stage | Color | Probability | Visual Indicator |
|-------|--------|-------------|------------------|
| SQL | #10B981 (Green) | 25% | 🟢 |
| Opportunity | #8B5CF6 (Purple) | 60% | 🟣 |
| Verbal | #F59E0B (Orange) | 80% | 🟠 |
| Signed | #10B981 (Green) | 100% | ✅ |

## Detailed Stage Explanations

### SQL (Sales Qualified Lead)

**Definition**: Initial qualified prospect with validated interest and budget authority

**Stage Details**:
- **Color**: #10B981 (Green)
- **Probability**: 25%
- **Average Duration**: 1-2 weeks

**Entry Triggers**:
- Lead qualification completed
- Discovery meeting scheduled or conducted
- Budget and authority confirmed
- Clear pain point identified

**Automatic Actions When Moving TO This Stage**:
- **Meeting Activity Created**: Automatically logs a meeting activity
- **Activity Details**: 
  - Type: Meeting
  - Description: "Initial discovery meeting - moved to SQL stage"
  - Date: Current date/time

**Typical Next Steps**:
- Conduct discovery meeting
- Identify specific requirements
- Prepare proposal or quote
- Move to Opportunity stage

**Best Practices**:
- Ensure lead qualification is complete before using this stage
- Use this for prospects who have shown genuine interest and have budget
- Not appropriate for cold leads or unqualified prospects

### Opportunity (Proposal Sent)

**Definition**: Formal proposal has been sent to the qualified prospect

**Stage Details**:
- **Color**: #8B5CF6 (Purple)
- **Probability**: 60%
- **Average Duration**: 1-3 weeks

**Special Feature: Proposal Confirmation Modal**

When moving a deal TO the Opportunity stage, users are presented with a confirmation modal:

**Modal Workflow**:
1. **Question**: "Have you sent a proposal to this client?"
2. **Options**: 
   - **"Yes, I've sent a proposal"** → Creates proposal activity + smart task
   - **"No, not yet"** → Only moves stage, no additional actions

**Automatic Actions (When "Yes" Selected)**:
- **Proposal Activity Created**:
  - Type: Outbound Activity (Proposal)
  - Description: "Proposal sent - moved to Opportunity stage"
  - Date: Current date/time
- **Smart Task Generated**:
  - Title: "Follow up on proposal"
  - Due Date: 3 business days from now
  - Priority: Medium
  - Type: Follow-up

**Entry Triggers**:
- Proposal prepared and sent
- Quote provided to client
- Formal offer made

**Typical Next Steps**:
- Follow up on proposal within 3-5 days
- Address client questions or concerns
- Schedule negotiation or closing meeting
- Move to Verbal stage when agreement reached

### Verbal (Agreement Reached)

**Definition**: Verbal agreement reached with the client, pending formal contract

**Stage Details**:
- **Color**: #F59E0B (Orange)
- **Probability**: 80%
- **Average Duration**: 3-7 days

**Automatic Actions When Moving TO This Stage**:
- **No automatic activities created** (by design)
- **Manual tracking encouraged** for agreement details

**Entry Triggers**:
- Verbal commitment received from client
- Terms agreed upon verbally
- Waiting for contract signature or formal approval
- Internal approval processes initiated

**Typical Next Steps**:
- Prepare final contract or agreement
- Send contract for signature
- Handle any final administrative requirements
- Move to Signed stage when contract executed

**Best Practices**:
- Document the verbal agreement details in deal notes
- Set clear expectations for contract timeline
- Maintain regular communication during contract process

### Signed (Deal Closed)

**Definition**: Deal closed successfully, contract signed and executed

**Stage Details**:
- **Color**: #10B981 (Green)
- **Probability**: 100%
- **Status**: Closed Won

**Automatic Actions When Moving TO This Stage**:
- **Sale Activity Created**:
  - Type: Sale
  - Description: "Deal closed - moved to Signed stage"
  - Value: Full deal value (one-off + MRR)
  - Date: Current date/time
- **Smart Task Generated**:
  - Title: "Begin client onboarding process"
  - Due Date: Next business day
  - Priority: High
  - Type: Onboarding
- **Celebration Animation**: Confetti animation displays for 3 seconds

**Entry Triggers**:
- Contract fully executed
- Payment terms confirmed
- All approvals completed
- Project ready to begin

**Post-Closure Actions**:
- Client onboarding initiated
- Success metrics tracked
- Relationship management begins
- Potential for upsell/cross-sell opportunities

## Stage Transition Rules

### Drag and Drop Functionality

**How It Works**:
1. Click and hold any deal card
2. Drag to target stage column
3. Release to initiate stage change
4. Modal confirmations appear when required (Opportunity stage)
5. Automatic activities and tasks created based on destination stage

### Activity Creation Triggers

| Transition | Activity Created | Smart Task Created |
|------------|------------------|-------------------|
| Any → SQL | Meeting | None |
| Any → Opportunity | Proposal (if confirmed) | 3-day follow-up (if confirmed) |
| Any → Verbal | None | None |
| Any → Signed | Sale | Next-day onboarding |

### Modal Confirmations Required

**Opportunity Stage Only**: Proposal confirmation modal appears
- **Purpose**: Ensures data accuracy and proper activity tracking
- **Bypass Option**: None - modal must be addressed
- **Timeout**: Modal remains until user selection made

### Permissions and Ownership Validation

**Standard Users**:
- Can modify their own deals
- Can move deals between any stages
- Cannot modify deals with revenue splits (admin-only)

**Admin Users**:
- Can modify any deal
- Can override stage restrictions
- Can modify revenue split deals

**Validation Rules**:
- Split deals cannot be deleted by non-admins
- Stage changes are logged for audit purposes
- Invalid transitions are prevented (none currently)

## Proposal Confirmation Modal Workflow

### When the Modal Appears
- **Trigger**: Moving any deal TO the Opportunity stage
- **Frequency**: Every time (no "remember my choice" option)
- **Timing**: Immediately after drag-and-drop action

### Modal Interface
```
┌─────────────────────────────────────┐
│  Proposal Confirmation              │
├─────────────────────────────────────┤
│  Have you sent a proposal to        │
│  this client?                       │
│                                     │
│  [Yes, I've sent a proposal]        │
│  [No, not yet]                     │
│                                     │
│  [Cancel]                          │
└─────────────────────────────────────┘
```

### User Options and Outcomes

**Option 1: "Yes, I've sent a proposal"**
- Deal moves to Opportunity stage
- Proposal activity automatically created
- Smart task created for 3-day follow-up
- Success notification displayed

**Option 2: "No, not yet"**
- Deal moves to Opportunity stage
- No additional activities created
- User reminded to send proposal soon
- Manual task creation recommended

**Option 3: "Cancel"**
- Deal remains in original stage
- No changes made
- User can try again later

### Activity and Smart Task Generation

**Proposal Activity Details**:
```json
{
  "type": "outbound_activity",
  "activity_type": "proposal",
  "description": "Proposal sent - moved to Opportunity stage",
  "date": "current_datetime",
  "deal_id": "associated_deal_id",
  "user_id": "current_user_id"
}
```

**Smart Task Details**:
```json
{
  "title": "Follow up on proposal",
  "description": "Contact client to discuss proposal and address any questions",
  "due_date": "current_date + 3_business_days",
  "priority": "medium",
  "type": "follow_up",
  "deal_id": "associated_deal_id",
  "user_id": "current_user_id"
}
```

### Error Handling and Edge Cases

**Network Errors**:
- Modal remains open
- Error message displayed
- User can retry action

**Validation Errors**:
- Deal validation failure prevents stage change
- User notified of specific validation issues
- Modal closes after error acknowledgment

**Concurrent Modifications**:
- Real-time updates prevent conflicts
- User notified if deal modified by another user
- Modal refreshes with current deal state

## Smart Task Integration

### Trigger Activities

Smart tasks are automatically generated based on specific stage transitions:

**SQL Stage**:
- **Trigger**: Deal moved TO SQL stage
- **Task Created**: None (meeting activity created instead)

**Opportunity Stage**:
- **Trigger**: Deal moved TO Opportunity stage AND user confirms proposal sent
- **Task Created**: "Follow up on proposal" (3 business days)

**Verbal Stage**:
- **Trigger**: Deal moved TO Verbal stage
- **Task Created**: None (manual tracking encouraged)

**Signed Stage**:
- **Trigger**: Deal moved TO Signed stage
- **Task Created**: "Begin client onboarding process" (next business day)

### Default Templates

**Follow-up Task Template**:
- **Title**: "Follow up on proposal"
- **Description**: "Contact client to discuss proposal and address any questions"
- **Due Date**: 3 business days
- **Priority**: Medium

**Onboarding Task Template**:
- **Title**: "Begin client onboarding process"
- **Description**: "Initiate client onboarding and project kickoff"
- **Due Date**: Next business day
- **Priority**: High

### Admin Customization Options

**Task Templates**: Admins can customize default task templates
**Due Date Rules**: Modify default due date calculations
**Priority Levels**: Adjust default priority assignments
**Task Types**: Create custom task types for different scenarios

### Task Generation Timing

**Immediate Generation**: Tasks created instantly upon stage transition
**Business Day Calculation**: Excludes weekends and holidays
**Time Zone Awareness**: Respects user's local time zone
**Batch Processing**: Multiple tasks generated efficiently

## Migration from Old Pipeline

### Old Stage to New Stage Mapping

The system automatically migrates existing deals using the following mapping:

| Old Stages | New Stage | Migration Logic |
|------------|-----------|-----------------|
| Lead, Cold Lead, Warm Lead | SQL | Qualified leads move to SQL |
| Discovery, Needs Analysis | SQL | Discovery phase maps to SQL |
| Proposal, Quote Sent | Opportunity | Proposal stages map to Opportunity |
| Negotiation, Decision | Verbal | Negotiation maps to Verbal |
| Contract, Closed Won | Signed | Closed deals map to Signed |
| Closed Lost | Deleted/Archived | Lost deals are archived |

### Automatic Migration Process

**Migration Execution**:
1. **Database Update**: Old stage values updated to new stage values
2. **Activity Preservation**: Existing activities remain unchanged
3. **Note Addition**: Migration note added to deal notes
4. **Audit Trail**: Migration logged in audit system

**Migration Notes Tracking**:
Each migrated deal receives a `stage_migration_notes` field:
```
"Migrated from [Old Stage Name] to [New Stage Name] on [Date]"
```

### Stage History Preservation

**Historical Data**:
- All previous stage changes preserved in audit log
- Reporting remains accurate for historical analysis
- Stage duration calculations adjusted for new system

**Reporting Continuity**:
- Historical reports continue to work with old stage names
- New reports use new stage names
- Transition period reports show both old and new stages

## Troubleshooting

### Common Issues and Solutions

### Modal Not Appearing

**Symptoms**:
- Deal moves to Opportunity stage without modal
- No proposal activity created

**Possible Causes**:
- JavaScript errors in browser
- Browser cache issues
- Network connectivity problems

**Solutions**:
1. **Refresh Browser**: Hard refresh (Ctrl+F5 or Cmd+Shift+R)
2. **Clear Cache**: Clear browser cache and cookies
3. **Check Console**: Open browser developer tools, check for JavaScript errors
4. **Try Different Browser**: Test with alternate browser
5. **Contact Support**: If issue persists, provide browser and error details

### Activities Not Being Created

**Symptoms**:
- Stage changes work but activities not logged
- Missing meeting/proposal/sale activities

**Possible Causes**:
- Database connection issues
- Permission problems
- Activity creation service errors

**Solutions**:
1. **Check Permissions**: Verify user has activity creation permissions
2. **Refresh Data**: Refresh the deals view to see if activities appear
3. **Manual Creation**: Manually create missing activities if needed
4. **Admin Review**: Have admin check activity creation logs
5. **System Status**: Check system status page for known issues

### Stage Transition Failures

**Symptoms**:
- Deal doesn't move to target stage
- Error messages during drag and drop
- Deal reverts to original stage

**Possible Causes**:
- Deal validation errors
- Permission restrictions
- Network connectivity issues
- Concurrent modifications by other users

**Solutions**:
1. **Check Deal Validity**: Ensure all required fields are completed
2. **Verify Permissions**: Confirm user can modify the specific deal
3. **Retry Action**: Wait a moment and try the stage change again
4. **Manual Update**: Use deal edit form to manually change stage
5. **Admin Assistance**: Contact admin for deals with complex permission issues

### Permission Errors

**Symptoms**:
- "Access denied" messages
- Cannot modify certain deals
- Stage change buttons disabled

**Possible Causes**:
- Split deal restrictions (non-admin users)
- Deal ownership issues
- Role permission limitations

**Solutions**:
1. **Check Deal Type**: Verify if deal has revenue splits (admin-only)
2. **Confirm Ownership**: Ensure you own the deal or have appropriate permissions
3. **Contact Admin**: Request admin assistance for protected deals
4. **Role Review**: Have admin review your role permissions
5. **Alternative Actions**: Use available actions within your permission level

## Best Practices

### When to Move Deals Between Stages

### SQL → Opportunity
**Move When**:
- Discovery meeting completed
- Client requirements clearly understood
- Budget and timeline confirmed
- Proposal or quote is ready to send

**Don't Move When**:
- Still gathering basic information
- Budget not yet confirmed
- No clear path to proposal

### Opportunity → Verbal
**Move When**:
- Client has received and reviewed proposal
- Terms have been discussed and negotiated
- Verbal agreement or commitment received
- Contract preparation can begin

**Don't Move When**:
- Proposal still under review
- Major terms still being negotiated
- No clear commitment from client

### Verbal → Signed
**Move When**:
- Contract fully executed by all parties
- Payment terms confirmed and active
- Project ready to begin immediately
- All internal approvals completed

**Don't Move When**:
- Contract still pending signatures
- Payment terms not yet finalized
- Internal approvals still needed

### Using the Proposal Confirmation Effectively

**Best Practices**:
1. **Be Honest**: Only select "Yes" if proposal actually sent
2. **Use Follow-up Tasks**: Leverage the 3-day follow-up task created
3. **Document Details**: Add proposal details to deal notes
4. **Set Expectations**: Clarify next steps with client when sending proposal

**Common Mistakes**:
- Selecting "Yes" when proposal not yet sent
- Ignoring the follow-up task created
- Not documenting proposal contents
- Moving to Opportunity too early in sales process

### Managing Smart Tasks and Follow-ups

**Task Management Tips**:
1. **Review Daily**: Check tasks daily for upcoming due dates
2. **Update Status**: Mark tasks complete when follow-ups done
3. **Add Notes**: Document outcomes of follow-up activities
4. **Snooze When Needed**: Extend due dates if client unavailable

**Follow-up Best Practices**:
- Call within 24-48 hours of proposal sending
- Have specific questions ready for follow-up calls
- Document client feedback and concerns
- Adjust proposal if needed based on feedback

### Reporting and Analytics Considerations

**Pipeline Reporting**:
- **Stage Velocity**: Track average time in each stage
- **Conversion Rates**: Monitor stage-to-stage conversion percentages
- **Bottlenecks**: Identify stages where deals get stuck
- **Forecasting**: Use probability percentages for revenue forecasting

**Activity Reporting**:
- **Activity Volume**: Track activities created per stage transition
- **Response Rates**: Monitor client response to proposals and follow-ups
- **Task Completion**: Ensure follow-up tasks are being completed
- **Success Patterns**: Identify activities that lead to closed deals

**Performance Metrics**:
- **Sales Cycle Length**: Measure total time from SQL to Signed
- **Stage Duration**: Analyze average time spent in each stage
- **Win Rate**: Calculate percentage of SQL deals that close
- **Deal Value**: Track average deal size by stage and source

### Team Training and Adoption

**Training Recommendations**:
1. **Stage Definitions**: Ensure all team members understand each stage
2. **Modal Usage**: Train on proposal confirmation modal workflow
3. **Activity Importance**: Emphasize value of automatic activity creation
4. **Reporting Usage**: Show how to use pipeline reports for insights

**Adoption Strategies**:
- **Gradual Rollout**: Introduce one stage at a time if needed
- **Success Stories**: Share examples of successful pipeline usage
- **Regular Reviews**: Conduct weekly pipeline review meetings
- **Continuous Improvement**: Gather feedback and make adjustments

---

## Support and Additional Resources

For additional questions about the pipeline system:

- **Technical Issues**: Check troubleshooting section above
- **Permission Problems**: Contact system administrator
- **Training Needs**: Review best practices and consider team training
- **Feature Requests**: Submit feedback through system feedback form

**Key Files for Reference**:
- Pipeline component implementation
- Stage transition logic
- Activity creation services
- Smart task generation system

Last Updated: [Current Date]
Version: 2.0 (Simplified 4-Stage System)