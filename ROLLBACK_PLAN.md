# Dashboard Performance Optimization - Rollback Plan

## Overview
This document outlines the rollback procedures for the dashboard performance optimization deployed on [DATE].

**Optimization Version**: v2.0.0-perf
**Previous Version**: v1.0.0
**Deployment Date**: [TO BE FILLED]
**Rollback Time Estimate**: 5-10 minutes

## Pre-Deployment Checklist

- [ ] Create full database backup
- [ ] Export current performance metrics
- [ ] Tag current git commit
- [ ] Document current Edge Function versions
- [ ] Test rollback in staging environment
- [ ] Notify team of deployment window

## Component Versions

### Frontend Components
| Component | Current Version | New Version | Rollback Method |
|-----------|----------------|-------------|-----------------|
| useDashboard hook | N/A | v2.0.0 | Delete file |
| Dashboard.tsx | v1.0.0 | v2.0.0 | Git revert |
| SmartCache | N/A | v1.0.0 | Delete file |
| ProtectedRoute | v1.0.0 | v1.1.0 | Git revert |

### Backend Components
| Component | Current Version | New Version | Rollback Method |
|-----------|----------------|-------------|-----------------|
| dashboard-metrics Edge Function | N/A | v1.0.0 | Delete function |
| Database indexes | Base | Optimized | Drop indexes |
| Materialized views | N/A | v1.0.0 | Drop views |

## Deployment Steps

### 1. Database Changes (Reversible)
```sql
-- Create rollback script first
CREATE OR REPLACE FUNCTION rollback_dashboard_optimization()
RETURNS void AS $$
BEGIN
  -- Drop new indexes
  DROP INDEX IF EXISTS idx_activities_user_date;
  DROP INDEX IF EXISTS idx_activities_user_type_date;
  DROP INDEX IF EXISTS idx_clients_owner_status;
  
  -- Drop materialized views
  DROP MATERIALIZED VIEW IF EXISTS mv_dashboard_metrics;
  DROP MATERIALIZED VIEW IF EXISTS mv_monthly_summaries;
  
  -- Log rollback
  INSERT INTO deployment_log (action, version, timestamp)
  VALUES ('rollback', 'v1.0.0', NOW());
END;
$$ LANGUAGE plpgsql;

-- Deploy new indexes and views
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_date 
ON activities(user_id, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activities_user_type_date 
ON activities(user_id, type, date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_clients_owner_status 
ON clients(owner_id, status);
```

### 2. Edge Function Deployment
```bash
# Deploy with version tag
supabase functions deploy dashboard-metrics --version v1.0.0

# Keep previous function endpoint active
# Update feature flag to control routing
```

### 3. Frontend Deployment with Feature Flag
```typescript
// src/lib/config/features.ts
export const FEATURES = {
  USE_OPTIMIZED_DASHBOARD: process.env.REACT_APP_USE_OPTIMIZED_DASHBOARD === 'true' || false,
  DASHBOARD_OPTIMIZATION_PERCENTAGE: parseInt(process.env.REACT_APP_DASHBOARD_OPT_PERCENTAGE || '0'),
};

// Progressive rollout control
export function shouldUseOptimizedDashboard(userId: string): boolean {
  if (!FEATURES.USE_OPTIMIZED_DASHBOARD) return false;
  
  // Gradual rollout based on user ID hash
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const userPercentage = hash % 100;
  
  return userPercentage < FEATURES.DASHBOARD_OPTIMIZATION_PERCENTAGE;
}
```

## Monitoring Metrics

### Key Performance Indicators
```typescript
// src/lib/monitoring/dashboardMetrics.ts
export const PERFORMANCE_THRESHOLDS = {
  firstContentfulPaint: 800,    // Alert if > 800ms
  timeToInteractive: 2000,       // Alert if > 2s
  apiResponseTime: 500,          // Alert if > 500ms
  errorRate: 0.01,               // Alert if > 1%
};

export function monitorDashboardPerformance() {
  // Send to monitoring service
  const metrics = {
    fcp: performance.getEntriesByType('paint')[0]?.startTime,
    tti: performance.timing.domInteractive - performance.timing.navigationStart,
    apiCalls: performance.getEntriesByType('resource').filter(r => r.name.includes('/api')),
    errors: window.__errorCount || 0,
  };
  
  // Log to monitoring service (e.g., Sentry, DataDog)
  if (metrics.fcp > PERFORMANCE_THRESHOLDS.firstContentfulPaint) {
    console.error('Performance degradation detected', metrics);
    // Trigger alert
  }
}
```

## Rollback Triggers

### Automatic Rollback Conditions
1. **Error Rate > 5%**: Automatic rollback initiated
2. **Load Time > 5 seconds**: Alert team, prepare rollback
3. **API Failures > 10%**: Immediate rollback
4. **User Reports > 3**: Investigate and consider rollback

### Manual Rollback Decision Matrix
| Metric | Threshold | Action |
|--------|-----------|--------|
| FCP | > 2s | Monitor closely |
| FCP | > 5s | Initiate rollback |
| Error Rate | > 2% | Investigate immediately |
| Error Rate | > 5% | Rollback |
| API Response | > 1s | Check Edge Function |
| API Response | > 3s | Rollback Edge Function |

## Rollback Procedures

### Quick Rollback (< 5 minutes)
```bash
# 1. Disable feature flag immediately
export REACT_APP_USE_OPTIMIZED_DASHBOARD=false

# 2. Revert frontend changes
git revert --no-commit HEAD~3..HEAD
git commit -m "Emergency rollback: Dashboard optimization"
git push origin main

# 3. Deploy
npm run build
npm run deploy

# 4. Verify
curl https://your-app.com/api/health
```

### Full Rollback (< 10 minutes)
```bash
# 1. Revert database changes
psql $DATABASE_URL -c "SELECT rollback_dashboard_optimization();"

# 2. Remove Edge Function
supabase functions delete dashboard-metrics

# 3. Revert all code changes
git checkout v1.0.0
git checkout -b rollback/dashboard-optimization
git push origin rollback/dashboard-optimization

# 4. Deploy previous version
npm ci
npm run build
npm run deploy

# 5. Clear caches
npm run cache:clear

# 6. Verify system health
npm run test:production
```

## Communication Plan

### Stakeholder Notification
```markdown
Subject: Dashboard Performance Optimization - [Status]

Team,

We are [deploying/monitoring/rolling back] the dashboard performance optimization.

Current Status:
- Deployment started: [TIME]
- Current phase: [PHASE]
- Performance metrics: [METRICS]
- Next update: [TIME]

Impact:
- Expected downtime: None
- Affected users: [PERCENTAGE]%
- Rollback ready: Yes

[If rollback needed]
Reason for rollback: [REASON]
Rollback ETA: [TIME]
```

## Post-Rollback Actions

1. **Root Cause Analysis**
   - Collect all logs and metrics
   - Review error patterns
   - Identify failure points
   - Document lessons learned

2. **Fix and Retest**
   - Address identified issues
   - Test in staging environment
   - Load test with production data
   - Gradual rollout plan v2

3. **Documentation Updates**
   - Update this rollback plan
   - Document new failure scenarios
   - Update monitoring thresholds
   - Share learnings with team

## Recovery Verification

### Health Checks After Rollback
```typescript
// scripts/verify-rollback.ts
async function verifyRollback() {
  const checks = [
    { name: 'API Health', endpoint: '/api/health' },
    { name: 'Dashboard Load', endpoint: '/dashboard' },
    { name: 'Database Connection', endpoint: '/api/db-check' },
    { name: 'Cache Status', endpoint: '/api/cache-status' },
  ];
  
  for (const check of checks) {
    const response = await fetch(check.endpoint);
    console.log(`${check.name}: ${response.ok ? '✅' : '❌'}`);
  }
  
  // Check metrics are back to baseline
  const metrics = await getProductionMetrics();
  console.log('Load Time:', metrics.loadTime);
  console.log('Error Rate:', metrics.errorRate);
  console.log('API Response:', metrics.apiResponse);
}
```

## Emergency Contacts

- **DevOps Lead**: [NAME] - [PHONE]
- **Backend Lead**: [NAME] - [PHONE]
- **Database Admin**: [NAME] - [PHONE]
- **On-Call Engineer**: [PHONE]

## Rollback Log

| Date | Version | Reason | Duration | Outcome |
|------|---------|--------|----------|---------|
| [DATE] | v2.0.0 | Testing | N/A | Success |
| | | | | |

## Appendix

### A. Database Backup Commands
```bash
# Full backup before deployment
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
psql $DATABASE_URL < backup_20240101_120000.sql
```

### B. Feature Flag Configuration
```env
# .env.production
REACT_APP_USE_OPTIMIZED_DASHBOARD=true
REACT_APP_DASHBOARD_OPT_PERCENTAGE=10  # Start with 10% rollout
```

### C. Monitoring Queries
```sql
-- Check current performance
SELECT 
  avg(load_time) as avg_load_time,
  max(load_time) as max_load_time,
  count(*) as total_loads
FROM performance_logs
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check error rates
SELECT 
  count(*) FILTER (WHERE error IS NOT NULL) * 100.0 / count(*) as error_rate
FROM dashboard_loads
WHERE created_at > NOW() - INTERVAL '1 hour';
```