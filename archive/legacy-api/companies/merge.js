const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Company merge API endpoint
 * Handles preview, execute, and rollback operations
 */
async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { operation } = req.query;

    switch (operation) {
      case 'preview':
        return await handlePreview(req, res);
      case 'execute':
        return await handleExecute(req, res);
      case 'history':
        return await handleHistory(req, res);
      case 'validate':
        return await handleValidate(req, res);
      default:
        return res.status(400).json({
          error: 'Invalid operation. Supported operations: preview, execute, history, validate'
        });
    }
  } catch (error) {
    console.error('Merge API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

/**
 * Preview merge operation
 */
async function handlePreview(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sourceCompanyIds, targetCompanyId } = req.body;

  if (!sourceCompanyIds || !Array.isArray(sourceCompanyIds) || sourceCompanyIds.length === 0) {
    return res.status(400).json({ error: 'sourceCompanyIds must be a non-empty array' });
  }

  if (!targetCompanyId) {
    return res.status(400).json({ error: 'targetCompanyId is required' });
  }

  try {
    // Call the database function to get merge preview
    const { data, error } = await supabase.rpc('get_company_merge_preview', {
      source_company_ids: sourceCompanyIds,
      target_company_id: targetCompanyId
    });

    if (error) {
      console.error('Database error in preview:', error);
      return res.status(400).json({ 
        error: 'Failed to generate merge preview',
        details: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      data: data[0] || {}
    });

  } catch (error) {
    console.error('Preview error:', error);
    return res.status(500).json({
      error: 'Failed to preview merge',
      message: error.message
    });
  }
}

/**
 * Execute merge operation
 */
async function handleExecute(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sourceCompanyIds, targetCompanyId, mergeData = {} } = req.body;

  if (!sourceCompanyIds || !Array.isArray(sourceCompanyIds) || sourceCompanyIds.length === 0) {
    return res.status(400).json({ error: 'sourceCompanyIds must be a non-empty array' });
  }

  if (!targetCompanyId) {
    return res.status(400).json({ error: 'targetCompanyId is required' });
  }

  // Validate that source and target are different
  if (sourceCompanyIds.includes(targetCompanyId)) {
    return res.status(400).json({ error: 'Cannot merge a company into itself' });
  }

  try {
    // Check if companies exist and are not already merged
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, is_merged')
      .in('id', [...sourceCompanyIds, targetCompanyId]);

    if (companiesError) {
      return res.status(400).json({ 
        error: 'Failed to validate companies',
        details: companiesError.message 
      });
    }

    // Validate companies exist
    const foundIds = companies.map(c => c.id);
    const missingIds = [...sourceCompanyIds, targetCompanyId].filter(id => !foundIds.includes(id));
    
    if (missingIds.length > 0) {
      return res.status(400).json({ 
        error: 'Some companies not found',
        missing_ids: missingIds 
      });
    }

    // Check if any companies are already merged
    const mergedCompanies = companies.filter(c => c.is_merged);
    if (mergedCompanies.length > 0) {
      return res.status(400).json({ 
        error: 'Some companies are already merged',
        merged_companies: mergedCompanies.map(c => ({ id: c.id, name: c.name }))
      });
    }

    // Execute the merge
    const { data, error } = await supabase.rpc('execute_company_merge', {
      source_company_ids: sourceCompanyIds,
      target_company_id: targetCompanyId,
      merge_data: mergeData
    });

    if (error) {
      console.error('Database error in merge execution:', error);
      return res.status(400).json({ 
        error: 'Failed to execute merge',
        details: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Companies merged successfully',
      data: data
    });

  } catch (error) {
    console.error('Execute merge error:', error);
    return res.status(500).json({
      error: 'Failed to execute merge',
      message: error.message
    });
  }
}

/**
 * Get merge history for a company
 */
async function handleHistory(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyId } = req.query;

  if (!companyId) {
    return res.status(400).json({ error: 'companyId is required' });
  }

  try {
    const { data, error } = await supabase
      .from('company_merges')
      .select(`
        *,
        source_company:companies!source_company_id(id, name),
        target_company:companies!target_company_id(id, name)
      `)
      .or(`source_company_id.eq.${companyId},target_company_id.eq.${companyId}`)
      .order('merged_at', { ascending: false });

    if (error) {
      return res.status(400).json({ 
        error: 'Failed to get merge history',
        details: error.message 
      });
    }

    return res.status(200).json({
      success: true,
      data: data || []
    });

  } catch (error) {
    console.error('History error:', error);
    return res.status(500).json({
      error: 'Failed to get merge history',
      message: error.message
    });
  }
}

/**
 * Validate merge permissions and feasibility
 */
async function handleValidate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { companyIds } = req.body;

  if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
    return res.status(400).json({ error: 'companyIds must be a non-empty array' });
  }

  try {
    const errors = [];
    const warnings = [];

    // Check if companies exist and get their status
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id, name, is_merged, status, owner_id')
      .in('id', companyIds);

    if (companiesError) {
      return res.status(400).json({ 
        error: 'Failed to validate companies',
        details: companiesError.message 
      });
    }

    // Check for missing companies
    const foundIds = companies.map(c => c.id);
    const missingIds = companyIds.filter(id => !foundIds.includes(id));
    
    if (missingIds.length > 0) {
      errors.push(`Companies not found: ${missingIds.join(', ')}`);
    }

    // Check for already merged companies
    const mergedCompanies = companies.filter(c => c.is_merged);
    if (mergedCompanies.length > 0) {
      errors.push(`Already merged companies: ${mergedCompanies.map(c => c.name).join(', ')}`);
    }

    // Check for different owners (warning, not error)
    const owners = [...new Set(companies.map(c => c.owner_id))];
    if (owners.length > 1) {
      warnings.push('Companies have different owners - ensure you have permission to merge all companies');
    }

    // Check for inactive companies (warning)
    const inactiveCompanies = companies.filter(c => c.status !== 'active');
    if (inactiveCompanies.length > 0) {
      warnings.push(`Some companies are not active: ${inactiveCompanies.map(c => c.name).join(', ')}`);
    }

    return res.status(200).json({
      success: true,
      valid: errors.length === 0,
      errors,
      warnings,
      companies: companies.map(c => ({
        id: c.id,
        name: c.name,
        is_merged: c.is_merged,
        status: c.status
      }))
    });

  } catch (error) {
    console.error('Validation error:', error);
    return res.status(500).json({
      error: 'Failed to validate merge',
      message: error.message
    });
  }
}

module.exports = handler;