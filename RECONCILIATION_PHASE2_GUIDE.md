# Sales Reconciliation System - Phase 2: Automatic Reconciliation Engine

## Overview

Phase 2 implements the automatic reconciliation engine with comprehensive manual action capabilities, building upon the analysis infrastructure from Phase 1. The system provides both automated and manual tools for reconciling orphan activities and deals, with full audit trails and rollback capabilities.

## 🚀 Key Features

### Automatic Reconciliation Engine
- **High-confidence automatic linking** (80%+ confidence)
- **Fuzzy name matching** for company variations (e.g., "Viewpoint" vs "Viewpoint VC")
- **Amount matching** with tolerance (±10%)
- **Date proximity matching** (within 3 days)
- **Same-day + client + similar amount** auto-linking
- **Deal creation** from orphan activities
- **Activity creation** from orphan deals (aggressive mode)
- **Comprehensive audit logging** for all actions

### Manual Action APIs
- **Manual linking** of specific activity to deal
- **Create deal from activity** with custom data
- **Create activity from deal** with custom data
- **Mark as duplicate** with reference tracking
- **Split records** into multiple entries
- **Merge records** with data consolidation
- **Undo functionality** for reversible actions

### Progress Monitoring & Management
- **Real-time progress tracking** during execution
- **Batch processing** for large datasets
- **Performance metrics** and success rates
- **Rollback capabilities** for emergency recovery
- **User-specific reconciliation** with proper isolation

## 📁 File Structure

```
├── execute_sales_reconciliation.sql     # Comprehensive SQL reconciliation engine
├── api/reconcile/
│   ├── execute.js                       # Automatic reconciliation API
│   └── actions.js                       # Manual action APIs
├── src/lib/hooks/useReconciliation.ts   # Enhanced React hooks
├── supabase/migrations/
│   └── 20250817000000_create_reconciliation_audit_log.sql
├── test-reconciliation-phase2.js        # Test suite
└── RECONCILIATION_PHASE2_GUIDE.md      # This guide
```

## 🔧 Installation & Setup

### 1. Database Setup

Run the migration to create the audit log table:

```sql
-- Apply the migration
\i supabase/migrations/20250817000000_create_reconciliation_audit_log.sql

-- Install the reconciliation engine
\i execute_sales_reconciliation.sql
```

### 2. API Endpoints

The APIs are automatically available at:
- `POST /api/reconcile/execute` - Automatic reconciliation
- `POST /api/reconcile/actions` - Manual actions
- `GET /api/reconcile/execute` - Progress monitoring

### 3. Frontend Integration

```typescript
import { useReconciliationExecution, useReconciliationActions } from '@/lib/hooks/useReconciliation';

function ReconciliationPanel() {
  const { execute, isExecuting, executionResult } = useReconciliationExecution();
  const { linkManually, createDealFromActivity } = useReconciliationActions();
  
  // Execute safe reconciliation
  const handleReconcile = () => {
    execute({ mode: 'safe', batchSize: 100 });
  };
  
  // Manual linking
  const handleManualLink = (activityId: string, dealId: string) => {
    linkManually(activityId, dealId, 95.0);
  };
}
```

## 📊 Reconciliation Modes

### Safe Mode (Default)
- High-confidence automatic linking (80%+ confidence)
- Create deals from orphan activities
- No duplicate marking
- Conservative approach with minimal false positives

```javascript
// API call
fetch('/api/reconcile/execute', {
  method: 'POST',
  body: JSON.stringify({ mode: 'safe', batchSize: 100 })
});

// React hook
execute({ mode: 'safe', batchSize: 100 });
```

### Aggressive Mode
- All safe mode features
- Create activities from orphan deals
- Mark potential duplicates
- More comprehensive but higher risk of false positives

```javascript
// API call
fetch('/api/reconcile/execute', {
  method: 'POST',
  body: JSON.stringify({ mode: 'aggressive', batchSize: 50 })
});

// React hook
execute({ mode: 'aggressive', batchSize: 50 });
```

### Dry Run Mode
- Test reconciliation logic without making changes
- Full analysis and confidence scoring
- Preview of what would be reconciled
- Safe for testing and validation

```javascript
// API call
fetch('/api/reconcile/execute', {
  method: 'POST',
  body: JSON.stringify({ mode: 'dry_run', batchSize: 25 })
});

// React hook
execute({ mode: 'dry_run', batchSize: 25 });
```

## 🎯 Confidence Scoring Logic

### Automatic Linking Criteria

**High Confidence (80%+ - Auto-link)**
- Same client + same day + similar amount (>90%)
- Exact company name match + date within 1 day
- Viewpoint variations with date proximity

**Medium Confidence (60-79% - Manual review)**
- Similar company names (>80% similarity) + date within 3 days
- Exact company match with date within 3 days
- Amount similarity with company fuzzy match

**Low Confidence (<60% - Flag for review)**
- Fuzzy company match only
- Date proximity only
- Amount similarity only

### Confidence Score Calculation

```sql
-- Overall confidence formula
(name_confidence * 0.5 + date_confidence * 0.3 + amount_confidence * 0.2) as overall_confidence

-- Name confidence scoring
CASE 
    WHEN LOWER(TRIM(activity.company_name)) = LOWER(TRIM(deal.company_name)) THEN 100
    WHEN similarity(LOWER(activity.company_name), LOWER(deal.company_name)) > 0.8 THEN 90
    WHEN (LOWER(activity.company_name) LIKE '%viewpoint%' AND LOWER(deal.company_name) LIKE '%viewpoint%') THEN 85
    ELSE similarity(LOWER(activity.company_name), LOWER(deal.company_name)) * 100
END

-- Date confidence scoring
CASE 
    WHEN activity.activity_date = deal.close_date THEN 100
    WHEN ABS(EXTRACT(EPOCH FROM (activity.activity_date - deal.close_date))/86400) <= 1 THEN 90
    WHEN ABS(EXTRACT(EPOCH FROM (activity.activity_date - deal.close_date))/86400) <= 3 THEN 70
    ELSE 0
END

-- Amount confidence scoring
CASE 
    WHEN activity.amount IS NULL OR deal.amount IS NULL THEN 50
    WHEN activity.amount = deal.amount THEN 100
    WHEN ABS(activity.amount - deal.amount) / GREATEST(activity.amount, deal.amount) <= 0.1 THEN 90
    WHEN ABS(activity.amount - deal.amount) / GREATEST(activity.amount, deal.amount) <= 0.3 THEN 70
    ELSE 30
END
```

## 🔄 Manual Actions API

### 1. Manual Linking

Link a specific activity to a specific deal:

```javascript
// API call
fetch('/api/reconcile/actions', {
  method: 'POST',
  body: JSON.stringify({
    action: 'link_manual',
    activityId: '123',
    dealId: '456',
    confidence: 95.0,
    metadata: { reason: 'User verified match' }
  })
});

// React hook
linkManually('123', '456', 95.0);
```

### 2. Create Deal from Activity

Convert an orphan activity into a new deal:

```javascript
// API call
fetch('/api/reconcile/actions', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_deal_from_activity',
    activityId: '123',
    dealData: {
      stage: 'Closed Won',
      closeDate: '2025-08-17',
      additionalFields: { source: 'manual_creation' }
    }
  })
});

// React hook
createDealFromActivity('123', { stage: 'Closed Won' });
```

### 3. Create Activity from Deal

Generate an activity for an orphan deal:

```javascript
// API call
fetch('/api/reconcile/actions', {
  method: 'POST',
  body: JSON.stringify({
    action: 'create_activity_from_deal',
    dealId: '456',
    activityData: {
      activityType: 'Sale - Manual Creation',
      activityDate: '2025-08-17'
    }
  })
});

// React hook
createActivityFromDeal('456', { activityType: 'Sale - Manual Creation' });
```

### 4. Mark as Duplicate

Mark a record as duplicate with reference to the original:

```javascript
// API call
fetch('/api/reconcile/actions', {
  method: 'POST',
  body: JSON.stringify({
    action: 'mark_duplicate',
    recordType: 'sales_activities',
    recordId: '123',
    keepRecordId: '124'
  })
});

// React hook
markAsDuplicate('sales_activities', '123', '124');
```

### 5. Undo Actions

Reverse a previous reconciliation action:

```javascript
// API call
fetch('/api/reconcile/actions', {
  method: 'POST',
  body: JSON.stringify({
    action: 'undo_action',
    auditLogId: 789
  })
});

// React hook
undoAction(789);
```

## 📈 Progress Monitoring

### Real-time Progress Tracking

```javascript
// Get current reconciliation status
fetch('/api/reconcile/execute?userId=123')
  .then(response => response.json())
  .then(data => {
    console.log('Orphan activities:', data.summary.totalOrphanActivities);
    console.log('Orphan deals:', data.summary.totalOrphanDeals);
    console.log('Linked records:', data.summary.totalLinkedRecords);
    console.log('Recent actions:', data.summary.recentActions);
  });

// React hook with automatic polling
const { progress, isExecuting } = useReconciliationExecution();
// Automatically polls every 5 seconds during execution
```

### Batch Processing

For large datasets, use batch processing:

```javascript
// API call
fetch('/api/reconcile/execute', {
  method: 'POST',
  body: JSON.stringify({
    action: 'batch',
    mode: 'safe',
    batchSize: 50,
    maxBatches: 10,
    delayBetweenBatches: 1000
  })
});

// React hook
executeBatch({
  mode: 'safe',
  batchSize: 50,
  maxBatches: 10,
  delayBetweenBatches: 1000
});
```

## 🛡️ Error Handling & Rollback

### Emergency Rollback

Rollback all reconciliation actions within a time window:

```javascript
// Rollback all actions from the last hour
fetch('/api/reconcile/execute', {
  method: 'POST',
  body: JSON.stringify({
    action: 'rollback',
    timeThreshold: new Date(Date.now() - 60*60*1000).toISOString(),
    confirmRollback: true
  })
});

// React hook
rollback({
  timeThreshold: new Date(Date.now() - 60*60*1000).toISOString(),
  confirmRollback: true
});
```

### Selective Rollback

Rollback specific audit log entries:

```javascript
// Rollback specific actions
fetch('/api/reconcile/execute', {
  method: 'POST',
  body: JSON.stringify({
    action: 'rollback',
    auditLogIds: [123, 124, 125],
    confirmRollback: true
  })
});
```

## 📊 Audit & Monitoring

### Audit Log Structure

All reconciliation actions are logged in the `reconciliation_audit_log` table:

```sql
-- View recent reconciliation activity
SELECT * FROM reconciliation_recent_activity 
WHERE executed_at >= NOW() - INTERVAL '24 hours'
ORDER BY executed_at DESC;

-- View action statistics
SELECT * FROM reconciliation_action_stats;

-- View performance metrics
SELECT * FROM reconciliation_performance_metrics
WHERE date >= CURRENT_DATE - INTERVAL '30 days';
```

### Monitoring Views

- **`reconciliation_recent_activity`** - Recent actions with user context
- **`reconciliation_action_stats`** - Statistics by action type
- **`reconciliation_performance_metrics`** - Daily performance metrics
- **`reconciliation_status`** - Current orphan/linked record counts

## 🧪 Testing

Run the comprehensive test suite:

```bash
node test-reconciliation-phase2.js
```

The test suite validates:
- ✅ Database schema and permissions
- ✅ API endpoint functionality
- ✅ SQL function accessibility
- ✅ Audit logging system
- ✅ Progress monitoring
- ✅ Error handling
- ✅ View accessibility

## ⚡ Performance Optimization

### Batch Size Recommendations

- **Small datasets (<1000 records)**: batchSize: 100
- **Medium datasets (1000-10000 records)**: batchSize: 50-75
- **Large datasets (>10000 records)**: batchSize: 25-50

### Index Optimization

The system includes optimized indexes:
- `idx_reconciliation_audit_user_id`
- `idx_reconciliation_audit_action_type`
- `idx_reconciliation_audit_executed_at`
- `idx_reconciliation_audit_source`
- `idx_reconciliation_audit_target`
- `idx_reconciliation_audit_metadata_gin`

### Memory Management

- Use batch processing for large operations
- Enable delays between batches to prevent overload
- Monitor audit log growth and archive old entries

## 🔒 Security Features

### User Isolation
- All operations respect owner_id constraints
- RLS policies enforce data access controls
- Audit logs track user attribution

### Input Validation
- Comprehensive parameter validation
- SQL injection protection
- Type checking and sanitization

### Action Verification
- Ownership verification before operations
- Existence checks for all referenced records
- Transaction-based operations for consistency

## 🚀 Next Steps

1. **Frontend Dashboard**: Build UI components for reconciliation management
2. **Scheduled Reconciliation**: Implement automated daily/weekly reconciliation
3. **Advanced Matching**: Add machine learning-based matching algorithms
4. **Notification System**: Alert users about reconciliation results
5. **Reporting**: Generate reconciliation reports and analytics
6. **API Rate Limiting**: Add rate limiting for production use
7. **Backup Integration**: Integrate with backup systems for safety

## 📞 Support

For issues or questions about the reconciliation system:

1. Check the test results: `node test-reconciliation-phase2.js`
2. Review audit logs: `SELECT * FROM reconciliation_audit_log WHERE executed_at >= NOW() - INTERVAL '1 hour'`
3. Monitor performance: `SELECT * FROM reconciliation_performance_metrics ORDER BY date DESC LIMIT 7`
4. Validate data integrity: Run Phase 1 analysis to verify system state

## 🏆 Success Metrics

- **Data Quality Score**: >90% linkage rate between activities and deals
- **Automation Rate**: >80% of reconciliations handled automatically
- **Processing Speed**: <5 seconds per 100 records in safe mode
- **Error Rate**: <1% failed operations
- **User Satisfaction**: Seamless manual override capabilities