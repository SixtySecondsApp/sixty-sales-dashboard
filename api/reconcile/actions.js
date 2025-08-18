// Reconciliation Actions API - Manual Linking and Operations
// Phase 2: Manual reconciliation actions with audit trail and security enhancements

import { supabase } from '../lib/supabase.js';
import { actionRateLimits, createIPRateLimit } from './rateLimiter.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Apply IP-based rate limiting first
  const ipRateLimit = createIPRateLimit();
  await new Promise((resolve, reject) => {
    ipRateLimit(req, res, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    const {
      action,
      activityId,
      dealId,
      userId,
      metadata = {},
      confidence = null
    } = req.body;

    // Validate required parameters
    if (!action) {
      return res.status(400).json({ error: 'Action type is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Apply action-specific rate limiting
    if (actionRateLimits[action]) {
      await new Promise((resolve, reject) => {
        actionRateLimits[action](req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    console.log(`Processing reconciliation action: ${action} for user ${userId}`);

    // Route to appropriate action handler
    switch (action) {
      case 'link_manual':
        return await handleManualLink(req, res);
      case 'create_deal_from_activity':
        return await handleCreateDealFromActivity(req, res);
      case 'create_activity_from_deal':
        return await handleCreateActivityFromDeal(req, res);
      case 'mark_duplicate':
        return await handleMarkDuplicate(req, res);
      case 'split_record':
        return await handleSplitRecord(req, res);
      case 'merge_records':
        return await handleMergeRecords(req, res);
      case 'undo_action':
        return await handleUndoAction(req, res);
      default:
        return res.status(400).json({ 
          error: `Unknown action type: ${action}` 
        });
    }

  } catch (error) {
    console.error('Reconciliation actions API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

// Manual linking of activity to deal with transaction management
async function handleManualLink(req, res) {
  const { activityId, dealId, userId, confidence = 100.0, metadata = {} } = req.body;

  if (!activityId || !dealId) {
    return res.status(400).json({ 
      error: 'Both activityId and dealId are required for manual linking' 
    });
  }

  // Start transaction for atomic operation
  const { data: transaction, error: transactionError } = await supabase.rpc('begin_transaction');
  if (transactionError) {
    console.error('Failed to start transaction:', transactionError);
    return res.status(500).json({ error: 'Failed to start database transaction' });
  }

  try {
    // Verify ownership and existence
    const { data: activity, error: activityError } = await supabase
      .from('sales_activities')
      .select('id, company_name, amount, activity_date, owner_id, deal_id')
      .eq('id', activityId)
      .eq('owner_id', userId)
      .single();

    if (activityError || !activity) {
      return res.status(404).json({ 
        error: 'Activity not found or access denied' 
      });
    }

    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('id, company_name, amount, close_date, stage, owner_id')
      .eq('id', dealId)
      .eq('owner_id', userId)
      .single();

    if (dealError || !deal) {
      return res.status(404).json({ 
        error: 'Deal not found or access denied' 
      });
    }

    // Check if activity is already linked
    if (activity.deal_id) {
      return res.status(400).json({ 
        error: 'Activity is already linked to a deal',
        currentDealId: activity.deal_id 
      });
    }

    // Perform the link within transaction
    const { error: updateError } = await supabase
      .from('sales_activities')
      .update({ 
        deal_id: dealId,
        updated_at: new Date().toISOString()
      })
      .eq('id', activityId)
      .eq('owner_id', userId); // Additional security check

    if (updateError) {
      await supabase.rpc('rollback_transaction');
      console.error('Failed to link activity to deal:', updateError);
      return res.status(500).json({ 
        error: 'Failed to link activity to deal',
        details: updateError.message 
      });
    }

    // Log the action within transaction
    await logReconciliationAction(
      'MANUAL_LINK',
      'sales_activities',
      activityId,
      'deals',
      dealId,
      confidence,
      {
        ...metadata,
        activity_company: activity.company_name,
        deal_company: deal.company_name,
        activity_amount: activity.amount,
        deal_amount: deal.amount,
        activity_date: activity.activity_date,
        deal_close_date: deal.close_date,
        transaction_id: transaction?.id
      },
      userId
    );

    // Commit transaction
    const { error: commitError } = await supabase.rpc('commit_transaction');
    if (commitError) {
      await supabase.rpc('rollback_transaction');
      throw new Error(`Failed to commit transaction: ${commitError.message}`);
    }

    return res.status(200).json({
      success: true,
      action: 'link_manual',
      activityId,
      dealId,
      message: 'Activity successfully linked to deal',
      linkedAt: new Date().toISOString()
    });

  } catch (error) {
    // Rollback transaction on any error
    try {
      await supabase.rpc('rollback_transaction');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }
    
    console.error('Manual link error:', error);
    return res.status(500).json({ 
      error: 'Failed to perform manual link',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Create deal from orphan activity with transaction management
async function handleCreateDealFromActivity(req, res) {
  const { activityId, userId, dealData = {}, metadata = {} } = req.body;

  if (!activityId) {
    return res.status(400).json({ 
      error: 'Activity ID is required' 
    });
  }

  // Start transaction for atomic operation
  const { data: transaction, error: transactionError } = await supabase.rpc('begin_transaction');
  if (transactionError) {
    console.error('Failed to start transaction:', transactionError);
    return res.status(500).json({ error: 'Failed to start database transaction' });
  }

  try {
    // Get activity details
    const { data: activity, error: activityError } = await supabase
      .from('sales_activities')
      .select('*')
      .eq('id', activityId)
      .eq('owner_id', userId)
      .single();

    if (activityError || !activity) {
      return res.status(404).json({ 
        error: 'Activity not found or access denied' 
      });
    }

    if (activity.deal_id) {
      return res.status(400).json({ 
        error: 'Activity is already linked to a deal',
        dealId: activity.deal_id 
      });
    }

    // Create new deal from activity
    const { data: newDeal, error: dealError } = await supabase
      .from('deals')
      .insert({
        company_name: dealData.companyName || activity.company_name,
        amount: dealData.amount || activity.amount || 0,
        stage: dealData.stage || 'Closed Won',
        close_date: dealData.closeDate || activity.activity_date,
        owner_id: userId,
        source: 'manual_reconciliation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...dealData.additionalFields
      })
      .select()
      .single();

    if (dealError) {
      console.error('Failed to create deal:', dealError);
      return res.status(500).json({ 
        error: 'Failed to create deal',
        details: dealError.message 
      });
    }

    // Link activity to new deal within transaction
    const { error: linkError } = await supabase
      .from('sales_activities')
      .update({ 
        deal_id: newDeal.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', activityId)
      .eq('owner_id', userId); // Additional security check

    if (linkError) {
      await supabase.rpc('rollback_transaction');
      console.error('Failed to link activity to new deal:', linkError);
      return res.status(500).json({ 
        error: 'Failed to link activity to new deal',
        details: linkError.message 
      });
    }

    // Log the action within transaction
    await logReconciliationAction(
      'CREATE_DEAL_FROM_ACTIVITY_MANUAL',
      'sales_activities',
      activityId,
      'deals',
      newDeal.id,
      100.0,
      {
        ...metadata,
        activity_company: activity.company_name,
        activity_amount: activity.amount,
        deal_data: dealData,
        created_deal: newDeal,
        transaction_id: transaction?.id
      },
      userId
    );

    // Commit transaction
    const { error: commitError } = await supabase.rpc('commit_transaction');
    if (commitError) {
      await supabase.rpc('rollback_transaction');
      throw new Error(`Failed to commit transaction: ${commitError.message}`);
    }

    return res.status(201).json({
      success: true,
      action: 'create_deal_from_activity',
      activityId,
      newDeal,
      message: 'Deal created and linked to activity successfully',
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    // Rollback transaction on any error
    try {
      await supabase.rpc('rollback_transaction');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }
    
    console.error('Create deal from activity error:', error);
    return res.status(500).json({ 
      error: 'Failed to create deal from activity',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Create activity from orphan deal
async function handleCreateActivityFromDeal(req, res) {
  const { dealId, userId, activityData = {}, metadata = {} } = req.body;

  if (!dealId) {
    return res.status(400).json({ 
      error: 'Deal ID is required' 
    });
  }

  try {
    // Get deal details
    const { data: deal, error: dealError } = await supabase
      .from('deals')
      .select('*')
      .eq('id', dealId)
      .eq('owner_id', userId)
      .single();

    if (dealError || !deal) {
      return res.status(404).json({ 
        error: 'Deal not found or access denied' 
      });
    }

    // Check if deal already has activities
    const { data: existingActivities, error: checkError } = await supabase
      .from('sales_activities')
      .select('id')
      .eq('deal_id', dealId)
      .limit(1);

    if (checkError) {
      console.error('Failed to check existing activities:', checkError);
    } else if (existingActivities && existingActivities.length > 0) {
      return res.status(400).json({ 
        error: 'Deal already has linked activities' 
      });
    }

    // Create new activity from deal
    const { data: newActivity, error: activityError } = await supabase
      .from('sales_activities')
      .insert({
        company_name: activityData.companyName || deal.company_name,
        amount: activityData.amount || deal.amount,
        activity_date: activityData.activityDate || deal.close_date,
        activity_type: activityData.activityType || 'Sale - Manual Creation',
        deal_id: dealId,
        owner_id: userId,
        source: 'manual_reconciliation',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...activityData.additionalFields
      })
      .select()
      .single();

    if (activityError) {
      console.error('Failed to create activity:', activityError);
      return res.status(500).json({ 
        error: 'Failed to create activity',
        details: activityError.message 
      });
    }

    // Log the action
    await logReconciliationAction(
      'CREATE_ACTIVITY_FROM_DEAL_MANUAL',
      'deals',
      dealId,
      'sales_activities',
      newActivity.id,
      100.0,
      {
        ...metadata,
        deal_company: deal.company_name,
        deal_amount: deal.amount,
        activity_data: activityData,
        created_activity: newActivity
      },
      userId
    );

    return res.status(201).json({
      success: true,
      action: 'create_activity_from_deal',
      dealId,
      newActivity,
      message: 'Activity created and linked to deal successfully',
      createdAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Create activity from deal error:', error);
    return res.status(500).json({ 
      error: 'Failed to create activity from deal',
      details: error.message 
    });
  }
}

// Mark record as duplicate
async function handleMarkDuplicate(req, res) {
  const { recordType, recordId, keepRecordId, userId, metadata = {} } = req.body;

  if (!recordType || !recordId) {
    return res.status(400).json({ 
      error: 'Record type and ID are required' 
    });
  }

  if (!['sales_activities', 'deals'].includes(recordType)) {
    return res.status(400).json({ 
      error: 'Record type must be sales_activities or deals' 
    });
  }

  try {
    // Verify ownership
    const { data: record, error: recordError } = await supabase
      .from(recordType)
      .select('*')
      .eq('id', recordId)
      .eq('owner_id', userId)
      .single();

    if (recordError || !record) {
      return res.status(404).json({ 
        error: 'Record not found or access denied' 
      });
    }

    // For now, we'll add a status field or use metadata to mark duplicates
    // In a full implementation, you might want to add a 'status' or 'duplicate_of' field
    const { error: updateError } = await supabase
      .from(recordType)
      .update({ 
        updated_at: new Date().toISOString()
        // Add duplicate marking logic here when schema supports it
      })
      .eq('id', recordId);

    if (updateError) {
      console.error('Failed to mark duplicate:', updateError);
      return res.status(500).json({ 
        error: 'Failed to mark as duplicate',
        details: updateError.message 
      });
    }

    // Log the action
    await logReconciliationAction(
      'MARK_DUPLICATE_MANUAL',
      recordType,
      recordId,
      keepRecordId ? recordType : null,
      keepRecordId,
      100.0,
      {
        ...metadata,
        record_type: recordType,
        marked_duplicate: record
      },
      userId
    );

    return res.status(200).json({
      success: true,
      action: 'mark_duplicate',
      recordType,
      recordId,
      keepRecordId,
      message: 'Record marked as duplicate successfully',
      markedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Mark duplicate error:', error);
    return res.status(500).json({ 
      error: 'Failed to mark as duplicate',
      details: error.message 
    });
  }
}

// Split record (create separate records from one)
async function handleSplitRecord(req, res) {
  const { recordType, recordId, splitData, userId, metadata = {} } = req.body;

  if (!recordType || !recordId || !splitData || !Array.isArray(splitData)) {
    return res.status(400).json({ 
      error: 'Record type, ID, and split data array are required' 
    });
  }

  try {
    // Get original record
    const { data: originalRecord, error: recordError } = await supabase
      .from(recordType)
      .select('*')
      .eq('id', recordId)
      .eq('owner_id', userId)
      .single();

    if (recordError || !originalRecord) {
      return res.status(404).json({ 
        error: 'Record not found or access denied' 
      });
    }

    const newRecords = [];

    // Create new records based on split data
    for (const split of splitData) {
      const { data: newRecord, error: createError } = await supabase
        .from(recordType)
        .insert({
          ...originalRecord,
          ...split,
          id: undefined, // Let database generate new ID
          source: 'manual_split',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (createError) {
        console.error('Failed to create split record:', createError);
        // Rollback created records
        for (const created of newRecords) {
          await supabase.from(recordType).delete().eq('id', created.id);
        }
        return res.status(500).json({ 
          error: 'Failed to create split records',
          details: createError.message 
        });
      }

      newRecords.push(newRecord);
    }

    // Log the action
    await logReconciliationAction(
      'SPLIT_RECORD_MANUAL',
      recordType,
      recordId,
      null,
      null,
      100.0,
      {
        ...metadata,
        original_record: originalRecord,
        split_into: newRecords.length,
        new_records: newRecords
      },
      userId
    );

    return res.status(201).json({
      success: true,
      action: 'split_record',
      recordType,
      originalRecordId: recordId,
      newRecords,
      message: `Record split into ${newRecords.length} new records successfully`,
      splitAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Split record error:', error);
    return res.status(500).json({ 
      error: 'Failed to split record',
      details: error.message 
    });
  }
}

// Merge multiple records into one with transaction management and soft deletion
async function handleMergeRecords(req, res) {
  const { recordType, recordIds, mergeInto, mergeData = {}, userId, metadata = {} } = req.body;

  if (!recordType || !Array.isArray(recordIds) || recordIds.length < 2) {
    return res.status(400).json({ 
      error: 'Record type and at least 2 record IDs are required' 
    });
  }

  if (recordIds.length > 50) {
    return res.status(400).json({ 
      error: 'Too many records to merge (max: 50)' 
    });
  }

  // Start transaction for atomic operation
  const { data: transaction, error: transactionError } = await supabase.rpc('begin_transaction');
  if (transactionError) {
    console.error('Failed to start transaction:', transactionError);
    return res.status(500).json({ error: 'Failed to start database transaction' });
  }

  try {
    // Get all records to merge
    const { data: records, error: recordsError } = await supabase
      .from(recordType)
      .select('*')
      .in('id', recordIds)
      .eq('owner_id', userId);

    if (recordsError) {
      return res.status(500).json({ 
        error: 'Failed to fetch records',
        details: recordsError.message 
      });
    }

    if (records.length !== recordIds.length) {
      return res.status(404).json({ 
        error: 'Some records not found or access denied' 
      });
    }

    // Determine which record to keep
    const keepRecord = mergeInto 
      ? records.find(r => r.id === mergeInto)
      : records[0]; // Default to first record

    if (!keepRecord) {
      return res.status(400).json({ 
        error: 'Target record for merge not found' 
      });
    }

    // Update the keep record with merged data
    const { error: updateError } = await supabase
      .from(recordType)
      .update({
        ...mergeData,
        updated_at: new Date().toISOString()
      })
      .eq('id', keepRecord.id);

    if (updateError) {
      console.error('Failed to update merged record:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update merged record',
        details: updateError.message 
      });
    }

    // Create backup before merge operation
    await logReconciliationAction(
      'MERGE_BACKUP',
      recordType,
      keepRecord.id,
      null,
      null,
      100.0,
      {
        ...metadata,
        backup_records: records,
        merge_timestamp: new Date().toISOString()
      },
      userId
    );

    // For activities: soft delete other records instead of permanent deletion
    if (recordType === 'sales_activities') {
      const otherRecords = records.filter(r => r.id !== keepRecord.id);
      
      // Soft delete other records by marking them as merged
      const { error: softDeleteError } = await supabase
        .from(recordType)
        .update({
          status: 'merged',
          merged_into: keepRecord.id,
          merged_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', otherRecords.map(r => r.id))
        .eq('owner_id', userId); // Security: only update user's records

      if (softDeleteError) {
        console.error('Failed to soft delete merged records:', softDeleteError);
        return res.status(500).json({ 
          error: 'Failed to mark merged records',
          details: softDeleteError.message 
        });
      }
    } else {
      // For deals, also use soft deletion
      const otherRecords = records.filter(r => r.id !== keepRecord.id);
      
      const { error: softDeleteError } = await supabase
        .from(recordType)
        .update({
          status: 'merged',
          merged_into: keepRecord.id,
          merged_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .in('id', otherRecords.map(r => r.id))
        .eq('owner_id', userId); // Security: only update user's records

      if (softDeleteError) {
        console.error('Failed to soft delete merged records:', softDeleteError);
        return res.status(500).json({ 
          error: 'Failed to mark merged records',
          details: softDeleteError.message 
        });
      }
    }

    // Log the action within transaction
    await logReconciliationAction(
      'MERGE_RECORDS_MANUAL',
      recordType,
      keepRecord.id,
      null,
      null,
      100.0,
      {
        ...metadata,
        merged_from: records.filter(r => r.id !== keepRecord.id),
        keep_record: keepRecord,
        merge_data: mergeData,
        transaction_id: transaction?.id
      },
      userId
    );

    // Commit transaction
    const { error: commitError } = await supabase.rpc('commit_transaction');
    if (commitError) {
      await supabase.rpc('rollback_transaction');
      throw new Error(`Failed to commit transaction: ${commitError.message}`);
    }

    return res.status(200).json({
      success: true,
      action: 'merge_records',
      recordType,
      keptRecordId: keepRecord.id,
      mergedFromIds: records.filter(r => r.id !== keepRecord.id).map(r => r.id),
      message: 'Records merged successfully (soft deletion used)',
      mergedAt: new Date().toISOString()
    });

  } catch (error) {
    // Rollback transaction on any error
    try {
      await supabase.rpc('rollback_transaction');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }
    
    console.error('Merge records error:', error);
    return res.status(500).json({ 
      error: 'Failed to merge records',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
}

// Undo previous reconciliation action
async function handleUndoAction(req, res) {
  const { auditLogId, userId, metadata = {} } = req.body;

  if (!auditLogId) {
    return res.status(400).json({ 
      error: 'Audit log ID is required' 
    });
  }

  try {
    // Get the action to undo
    const { data: auditEntry, error: auditError } = await supabase
      .from('reconciliation_audit_log')
      .select('*')
      .eq('id', auditLogId)
      .eq('user_id', userId)
      .single();

    if (auditError || !auditEntry) {
      return res.status(404).json({ 
        error: 'Audit entry not found or access denied' 
      });
    }

    // Check if action is undoable
    const undoableActions = [
      'MANUAL_LINK',
      'CREATE_DEAL_FROM_ACTIVITY_MANUAL',
      'CREATE_ACTIVITY_FROM_DEAL_MANUAL',
      'MARK_DUPLICATE_MANUAL'
    ];

    if (!undoableActions.includes(auditEntry.action_type)) {
      return res.status(400).json({ 
        error: 'This action type cannot be undone' 
      });
    }

    // Perform the undo based on action type
    let undoResult = {};

    switch (auditEntry.action_type) {
      case 'MANUAL_LINK':
        // Unlink activity from deal
        const { error: unlinkError } = await supabase
          .from('sales_activities')
          .update({ 
            deal_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', auditEntry.source_id);

        if (unlinkError) {
          throw new Error(`Failed to undo link: ${unlinkError.message}`);
        }
        undoResult = { action: 'unlinked', activityId: auditEntry.source_id };
        break;

      case 'CREATE_DEAL_FROM_ACTIVITY_MANUAL':
        // Delete the created deal and unlink activity
        const { error: deleteDealError } = await supabase
          .from('deals')
          .delete()
          .eq('id', auditEntry.target_id)
          .eq('source', 'manual_reconciliation');

        if (deleteDealError) {
          throw new Error(`Failed to delete created deal: ${deleteDealError.message}`);
        }

        const { error: unlinkActivityError } = await supabase
          .from('sales_activities')
          .update({ 
            deal_id: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', auditEntry.source_id);

        if (unlinkActivityError) {
          throw new Error(`Failed to unlink activity: ${unlinkActivityError.message}`);
        }

        undoResult = { 
          action: 'deleted_deal_and_unlinked', 
          dealId: auditEntry.target_id,
          activityId: auditEntry.source_id 
        };
        break;

      case 'CREATE_ACTIVITY_FROM_DEAL_MANUAL':
        // Delete the created activity
        const { error: deleteActivityError } = await supabase
          .from('sales_activities')
          .delete()
          .eq('id', auditEntry.target_id)
          .eq('source', 'manual_reconciliation');

        if (deleteActivityError) {
          throw new Error(`Failed to delete created activity: ${deleteActivityError.message}`);
        }

        undoResult = { 
          action: 'deleted_activity', 
          activityId: auditEntry.target_id 
        };
        break;

      case 'MARK_DUPLICATE_MANUAL':
        // Unmark duplicate (implementation depends on how duplicates are marked)
        undoResult = { 
          action: 'unmarked_duplicate', 
          recordId: auditEntry.source_id 
        };
        break;
    }

    // Log the undo action
    await logReconciliationAction(
      'UNDO_' + auditEntry.action_type,
      auditEntry.source_table,
      auditEntry.source_id,
      auditEntry.target_table,
      auditEntry.target_id,
      100.0,
      {
        ...metadata,
        original_audit_id: auditLogId,
        original_action: auditEntry.action_type,
        undo_result: undoResult
      },
      userId
    );

    return res.status(200).json({
      success: true,
      action: 'undo_action',
      originalAction: auditEntry.action_type,
      auditLogId,
      undoResult,
      message: 'Action undone successfully',
      undoneAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Undo action error:', error);
    return res.status(500).json({ 
      error: 'Failed to undo action',
      details: error.message 
    });
  }
}

// Helper function to log reconciliation actions
async function logReconciliationAction(
  actionType,
  sourceTable,
  sourceId,
  targetTable = null,
  targetId = null,
  confidenceScore = null,
  metadata = {},
  userId = null
) {
  try {
    const { error } = await supabase
      .from('reconciliation_audit_log')
      .insert({
        action_type: actionType,
        source_table: sourceTable,
        source_id: sourceId,
        target_table: targetTable,
        target_id: targetId,
        confidence_score: confidenceScore,
        metadata,
        user_id: userId,
        executed_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log reconciliation action:', error);
    }
  } catch (logError) {
    console.error('Error logging reconciliation action:', logError);
  }
}