// Reconciliation Engine API - Execute Automatic Reconciliation
// Phase 2: Automatic reconciliation with progress tracking and audit trail

import { supabase } from '../lib/supabase.js';

export default async function handler(req, res) {
  // Handle different HTTP methods
  if (req.method === 'GET') {
    return handleProgress(req, res);
  } else if (req.method === 'POST') {
    const { action } = req.body;
    
    if (action === 'batch') {
      return handleBatchReconciliation(req, res);
    } else if (action === 'rollback') {
      return handleRollback(req, res);
    } else {
      return handleSingleReconciliation(req, res);
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Single reconciliation execution
async function handleSingleReconciliation(req, res) {
  try {
    const {
      mode = 'safe', // 'safe', 'aggressive', 'dry_run'
      userId = null,
      batchSize = 100,
      progressCallback = null
    } = req.body;

    // Validate mode parameter
    if (!['safe', 'aggressive', 'dry_run'].includes(mode)) {
      return res.status(400).json({ 
        error: 'Invalid mode. Must be safe, aggressive, or dry_run' 
      });
    }

    // Validate batch size
    if (batchSize < 1 || batchSize > 1000) {
      return res.status(400).json({ 
        error: 'Batch size must be between 1 and 1000' 
      });
    }

    console.log(`Starting reconciliation execution: mode=${mode}, userId=${userId}, batchSize=${batchSize}`);

    // Execute the reconciliation stored procedure
    const { data: reconciliationResult, error: executionError } = await supabase
      .rpc('execute_sales_reconciliation', {
        p_mode: mode,
        p_user_id: userId,
        p_batch_size: batchSize
      });

    if (executionError) {
      console.error('Reconciliation execution error:', executionError);
      return res.status(500).json({ 
        error: 'Failed to execute reconciliation',
        details: executionError.message 
      });
    }

    // Get updated reconciliation status
    const { data: statusData, error: statusError } = await supabase
      .from('reconciliation_status')
      .select('*')
      .eq('owner_id', userId || 'all');

    if (statusError) {
      console.warn('Failed to fetch updated status:', statusError);
    }

    // Get recent audit log entries for this execution
    const { data: auditData, error: auditError } = await supabase
      .from('reconciliation_audit_log')
      .select(`
        id,
        action_type,
        source_table,
        source_id,
        target_table,
        target_id,
        confidence_score,
        metadata,
        executed_at
      `)
      .gte('executed_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes
      .order('executed_at', { ascending: false })
      .limit(100);

    if (auditError) {
      console.warn('Failed to fetch audit log:', auditError);
    }

    const response = {
      success: true,
      mode,
      userId,
      batchSize,
      execution: reconciliationResult,
      updatedStatus: statusData || [],
      recentActions: auditData || [],
      summary: {
        totalProcessed: reconciliationResult.total_processed || 0,
        highConfidenceLinks: reconciliationResult.high_confidence_links || 0,
        dealsCreated: reconciliationResult.deals_created || 0,
        activitiesCreated: reconciliationResult.activities_created || 0,
        duplicatesMarked: reconciliationResult.duplicates_marked || 0,
        errors: reconciliationResult.errors || 0,
        successRate: reconciliationResult.success_rate || 100,
        orphanActivitiesFound: reconciliationResult.orphan_activities_found || 0,
        orphanDealsFound: reconciliationResult.orphan_deals_found || 0
      },
      executedAt: new Date().toISOString()
    };

    console.log('Reconciliation completed successfully:', response.summary);

    return res.status(200).json(response);

  } catch (error) {
    console.error('Reconciliation API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Batch processing endpoint for large datasets
async function handleBatchReconciliation(req, res) {

  try {
    const {
      mode = 'safe',
      userId = null,
      batchSize = 50,
      maxBatches = 10,
      delayBetweenBatches = 1000 // ms
    } = req.body;

    console.log(`Starting batch reconciliation: ${maxBatches} batches of ${batchSize}`);

    const results = [];
    let totalProcessed = 0;
    let totalErrors = 0;

    for (let batch = 0; batch < maxBatches; batch++) {
      console.log(`Processing batch ${batch + 1}/${maxBatches}`);

      try {
        // Execute one batch
        const { data: batchResult, error: batchError } = await supabase
          .rpc('execute_sales_reconciliation', {
            p_mode: mode,
            p_user_id: userId,
            p_batch_size: batchSize
          });

        if (batchError) {
          console.error(`Batch ${batch + 1} error:`, batchError);
          totalErrors++;
          results.push({
            batch: batch + 1,
            success: false,
            error: batchError.message
          });
          continue;
        }

        results.push({
          batch: batch + 1,
          success: true,
          processed: batchResult.total_processed || 0,
          linked: batchResult.high_confidence_links || 0,
          created: (batchResult.deals_created || 0) + (batchResult.activities_created || 0),
          errors: batchResult.errors || 0
        });

        totalProcessed += batchResult.total_processed || 0;

        // If no records were processed, we're likely done
        if ((batchResult.total_processed || 0) === 0) {
          console.log(`No more records to process after batch ${batch + 1}`);
          break;
        }

        // Delay between batches to prevent overload
        if (batch < maxBatches - 1 && delayBetweenBatches > 0) {
          await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
        }

      } catch (batchError) {
        console.error(`Batch ${batch + 1} exception:`, batchError);
        totalErrors++;
        results.push({
          batch: batch + 1,
          success: false,
          error: batchError.message
        });
      }
    }

    return res.status(200).json({
      success: true,
      mode,
      userId,
      batchSize,
      maxBatches,
      batchesExecuted: results.length,
      totalProcessed,
      totalErrors,
      results,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch reconciliation API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Rollback endpoint for emergency recovery
async function handleRollback(req, res) {

  try {
    const {
      auditLogIds = null, // Array of specific audit log IDs to rollback
      timeThreshold = null, // ISO string - rollback all actions after this time
      confirmRollback = false
    } = req.body;

    if (!confirmRollback) {
      return res.status(400).json({ 
        error: 'Rollback confirmation required. Set confirmRollback: true' 
      });
    }

    console.log(`Starting rollback: auditLogIds=${auditLogIds}, timeThreshold=${timeThreshold}`);

    // Convert time threshold to timestamp if provided
    let thresholdTimestamp = null;
    if (timeThreshold) {
      thresholdTimestamp = new Date(timeThreshold).toISOString();
    }

    // Execute the rollback stored procedure
    const { data: rollbackResult, error: rollbackError } = await supabase
      .rpc('rollback_reconciliation', {
        p_audit_log_ids: auditLogIds,
        p_time_threshold: thresholdTimestamp
      });

    if (rollbackError) {
      console.error('Rollback execution error:', rollbackError);
      return res.status(500).json({ 
        error: 'Failed to execute rollback',
        details: rollbackError.message 
      });
    }

    console.log('Rollback completed successfully:', rollbackResult);

    return res.status(200).json({
      success: true,
      rollback: rollbackResult,
      executedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Rollback API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Progress monitoring endpoint
async function handleProgress(req, res) {

  try {
    const { userId } = req.query;

    // Get current reconciliation status
    let statusQuery = supabase
      .from('reconciliation_status')
      .select('*');

    if (userId) {
      statusQuery = statusQuery.eq('owner_id', userId);
    }

    const { data: statusData, error: statusError } = await statusQuery;

    if (statusError) {
      console.error('Failed to fetch reconciliation status:', statusError);
      return res.status(500).json({ 
        error: 'Failed to fetch status',
        details: statusError.message 
      });
    }

    // Get recent reconciliation activity
    let auditQuery = supabase
      .from('reconciliation_audit_log')
      .select(`
        id,
        action_type,
        source_table,
        source_id,
        confidence_score,
        executed_at,
        user_id
      `)
      .gte('executed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
      .order('executed_at', { ascending: false })
      .limit(50);

    if (userId) {
      auditQuery = auditQuery.eq('user_id', userId);
    }

    const { data: auditData, error: auditError } = await auditQuery;

    if (auditError) {
      console.warn('Failed to fetch audit data:', auditError);
    }

    // Calculate summary statistics
    const summary = {
      totalOrphanActivities: 0,
      totalOrphanDeals: 0,
      totalLinkedRecords: 0,
      recentActions: auditData ? auditData.length : 0,
      lastReconciliation: auditData && auditData.length > 0 ? auditData[0].executed_at : null
    };

    if (statusData) {
      statusData.forEach(row => {
        switch (row.category) {
          case 'orphan_activities':
            summary.totalOrphanActivities += row.count;
            break;
          case 'orphan_deals':
            summary.totalOrphanDeals += row.count;
            break;
          case 'linked_records':
            summary.totalLinkedRecords += row.count;
            break;
        }
      });
    }

    return res.status(200).json({
      success: true,
      userId,
      status: statusData || [],
      recentActivity: auditData || [],
      summary,
      fetchedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Progress monitoring API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}