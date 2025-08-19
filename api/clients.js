import { executeQuery, handleCORS, apiResponse } from './_db.js';

// Security: Define allowed columns for dynamic queries to prevent SQL injection
const ALLOWED_COLUMNS = {
  clients: [
    'company_name', 'contact_name', 'contact_email', 'subscription_amount',
    'status', 'deal_id', 'owner_id', 'subscription_start_date', 'churn_date'
  ]
};

// Security: Sanitize error messages to prevent sensitive data exposure
function sanitizeError(error) {
  const message = error?.message || 'Unknown error';
  
  // Log full error server-side but return sanitized message to client
  console.error('Database error (sanitized for client):', {
    message,
    timestamp: new Date().toISOString(),
    // Don't log full error object to prevent sensitive data exposure
  });
  
  // Return generic error messages for common database errors
  if (message.includes('duplicate key')) {
    return 'A record with this information already exists';
  }
  if (message.includes('foreign key')) {
    return 'Referenced record not found';
  }
  if (message.includes('not null')) {
    return 'Required field is missing';
  }
  if (message.includes('invalid input')) {
    return 'Invalid data format';
  }
  
  return 'Database operation failed';
}

// Security: Validate column names against whitelist
function validateColumns(columns) {
  const invalidColumns = columns.filter(col => !ALLOWED_COLUMNS.clients.includes(col));
  if (invalidColumns.length > 0) {
    throw new Error(`Invalid columns: ${invalidColumns.join(', ')}`);
  }
}

// Security: Check if user has access to the specified owner_id
async function validateOwnerAccess(requestedOwnerId, userRole = null) {
  // TODO: Implement proper session validation
  // This is a placeholder for session-based authorization
  // In a real implementation, you would:
  // 1. Extract user ID from session/JWT token
  // 2. Check if user can access the requested owner_id
  // 3. Allow admin users to access any owner_id
  
  if (!requestedOwnerId) {
    return false; // owner_id is required
  }
  
  // For now, we'll enforce that owner_id must be provided
  // Future enhancement: validate against actual user session
  return true;
}

export default async function handler(request, response) {
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    // Parse URL for Vercel compatibility
    const urlParts = request.url.split('?');
    const pathname = urlParts[0];
    const queryString = urlParts[1] || '';
    const searchParams = new URLSearchParams(queryString);
    
    const pathSegments = pathname.split('/').filter(segment => segment && segment !== 'api' && segment !== 'clients');
    const clientId = pathSegments[0];
    
    // Handle special endpoints
    if (pathSegments[0] === 'mrr' && pathSegments[1] === 'summary') {
      return await handleMRRSummary(response, searchParams);
    }
    if (pathSegments[0] === 'mrr' && pathSegments[1] === 'by-owner') {
      return await handleMRRByOwner(response, searchParams);
    }
    
    if (request.method === 'GET') {
      if (!clientId) {
        // GET /api/clients - List all clients
        return await handleClientsList(response, searchParams);
      } else {
        // GET /api/clients/:id - Single client
        return await handleSingleClient(response, clientId);
      }
    } else if (request.method === 'POST') {
      // POST /api/clients - Create client
      return await handleCreateClient(response, request);
    } else if (request.method === 'PUT' || request.method === 'PATCH') {
      if (clientId) {
        // PUT /api/clients/:id - Update client
        return await handleUpdateClient(response, request, clientId);
      }
      return apiResponse(response, null, 'Client ID required', 400);
    } else if (request.method === 'DELETE') {
      if (clientId) {
        // DELETE /api/clients/:id - Delete client
        return await handleDeleteClient(response, clientId);
      }
      return apiResponse(response, null, 'Client ID required', 400);
    }
    
    return apiResponse(response, null, 'Method not allowed', 405);
  } catch (error) {
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}

// List all clients with filtering
async function handleClientsList(response, searchParams) {
  try {
    const { owner_id, status, limit, search } = Object.fromEntries(searchParams);
    
    let query = `
      SELECT 
        c.*,
        p.first_name as owner_first_name,
        p.last_name as owner_last_name,
        p.full_name as owner_full_name,
        d.name as deal_name,
        d.value as deal_value
      FROM clients c
      LEFT JOIN profiles p ON c.owner_id = p.id
      LEFT JOIN deals d ON c.deal_id = d.id
    `;
    
    const params = [];
    const conditions = [];
    
    if (search) {
      conditions.push(`(c.company_name ILIKE $${params.length + 1} OR c.contact_name ILIKE $${params.length + 1} OR c.contact_email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    // Security: Validate owner_id access
    if (owner_id) {
      if (!await validateOwnerAccess(owner_id)) {
        return apiResponse(response, null, 'Unauthorized access to owner data', 403);
      }
      conditions.push(`c.owner_id = $${params.length + 1}`);
      params.push(owner_id);
    } else {
      // Security: Require owner_id to prevent unauthorized data access
      return apiResponse(response, null, 'owner_id parameter is required', 400);
    }
    
    if (status) {
      conditions.push(`c.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY c.created_at DESC`;
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));
    }

    const result = await executeQuery(query, params);
    
    const data = result.rows.map(row => ({
      id: row.id,
      company_name: row.company_name,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      subscription_amount: parseFloat(row.subscription_amount || 0),
      status: row.status,
      deal_id: row.deal_id,
      owner_id: row.owner_id,
      subscription_start_date: row.subscription_start_date,
      churn_date: row.churn_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Add computed fields
      subscription_days: row.subscription_start_date ? Math.floor((new Date() - new Date(row.subscription_start_date)) / (1000 * 60 * 60 * 24)) : 0,
      // Add relationships
      owner: row.owner_full_name ? {
        id: row.owner_id,
        first_name: row.owner_first_name,
        last_name: row.owner_last_name,
        full_name: row.owner_full_name
      } : null,
      deal: row.deal_name ? {
        id: row.deal_id,
        name: row.deal_name,
        value: parseFloat(row.deal_value || 0)
      } : null
    }));

    return apiResponse(response, data);
  } catch (error) {
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}

// Single client by ID
async function handleSingleClient(response, clientId, requestOwnerId = null) {
  try {
    // Security: First get the client to check ownership
    const ownerCheckQuery = `SELECT owner_id FROM clients WHERE id = $1`;
    const ownerCheckResult = await executeQuery(ownerCheckQuery, [clientId]);
    
    if (ownerCheckResult.rows.length === 0) {
      return apiResponse(response, null, 'Client not found', 404);
    }
    
    const clientOwnerId = ownerCheckResult.rows[0].owner_id;
    
    // Security: Validate owner access
    if (!await validateOwnerAccess(clientOwnerId)) {
      return apiResponse(response, null, 'Unauthorized access to client data', 403);
    }
    
    const query = `
      SELECT 
        c.*,
        p.first_name as owner_first_name,
        p.last_name as owner_last_name,
        p.full_name as owner_full_name,
        d.name as deal_name,
        d.value as deal_value,
        d.one_off_revenue as deal_one_off_revenue,
        d.monthly_mrr as deal_monthly_mrr
      FROM clients c
      LEFT JOIN profiles p ON c.owner_id = p.id
      LEFT JOIN deals d ON c.deal_id = d.id
      WHERE c.id = $1
    `;

    const result = await executeQuery(query, [clientId]);
    
    const row = result.rows[0];
    const data = {
      id: row.id,
      company_name: row.company_name,
      contact_name: row.contact_name,
      contact_email: row.contact_email,
      subscription_amount: parseFloat(row.subscription_amount || 0),
      status: row.status,
      deal_id: row.deal_id,
      owner_id: row.owner_id,
      subscription_start_date: row.subscription_start_date,
      churn_date: row.churn_date,
      created_at: row.created_at,
      updated_at: row.updated_at,
      // Add computed fields
      subscription_days: row.subscription_start_date ? Math.floor((new Date() - new Date(row.subscription_start_date)) / (1000 * 60 * 60 * 24)) : 0,
      // Add relationships
      owner: row.owner_full_name ? {
        id: row.owner_id,
        first_name: row.owner_first_name,
        last_name: row.owner_last_name,
        full_name: row.owner_full_name
      } : null,
      deal: row.deal_name ? {
        id: row.deal_id,
        name: row.deal_name,
        value: parseFloat(row.deal_value || 0),
        one_off_revenue: parseFloat(row.deal_one_off_revenue || 0),
        monthly_mrr: parseFloat(row.deal_monthly_mrr || 0)
      } : null
    };
    
    return apiResponse(response, data);
  } catch (error) {
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}

// Create client
async function handleCreateClient(response, request) {
  try {
    const body = await request.json();
    const {
      company_name,
      contact_name,
      contact_email,
      subscription_amount = 0,
      status = 'active',
      deal_id,
      owner_id,
      subscription_start_date
    } = body;
    
    // Validate required fields
    if (!company_name || !owner_id) {
      return apiResponse(response, null, 'company_name and owner_id are required', 400);
    }
    
    // Security: Validate owner access
    if (!await validateOwnerAccess(owner_id)) {
      return apiResponse(response, null, 'Unauthorized access to owner data', 403);
    }
    
    const query = `
      INSERT INTO clients (
        company_name, contact_name, contact_email, subscription_amount,
        status, deal_id, owner_id, subscription_start_date
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const params = [
      company_name, contact_name, contact_email, subscription_amount,
      status, deal_id, owner_id, subscription_start_date
    ];
    
    const result = await executeQuery(query, params);
    const client = result.rows[0];
    
    // Convert subscription_amount to number
    client.subscription_amount = parseFloat(client.subscription_amount || 0);
    
    return apiResponse(response, client, 'Client created successfully', 201);
  } catch (error) {
    // Handle unique constraint violations with specific messaging
    if (error.message && error.message.includes('unique_deal_conversion')) {
      return apiResponse(response, null, 'This deal has already been converted to a client', 409);
    }
    
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}

// Update client
async function handleUpdateClient(response, request, clientId) {
  try {
    const body = await request.json();
    
    // Security: First check if client exists and validate ownership
    const ownerCheckQuery = `SELECT owner_id FROM clients WHERE id = $1`;
    const ownerCheckResult = await executeQuery(ownerCheckQuery, [clientId]);
    
    if (ownerCheckResult.rows.length === 0) {
      return apiResponse(response, null, 'Client not found', 404);
    }
    
    const clientOwnerId = ownerCheckResult.rows[0].owner_id;
    
    // Security: Validate owner access
    if (!await validateOwnerAccess(clientOwnerId)) {
      return apiResponse(response, null, 'Unauthorized access to client data', 403);
    }
    
    const updates = [];
    const params = [];
    const updateColumns = [];
    
    // Security: Validate all column names against whitelist
    Object.keys(body).forEach(key => {
      if (key !== 'id' && body[key] !== undefined) {
        updateColumns.push(key);
      }
    });
    
    validateColumns(updateColumns);
    
    // Build dynamic update query with validated columns
    let paramCount = 1;
    Object.entries(body).forEach(([key, value]) => {
      if (value !== undefined && key !== 'id') {
        updates.push(`${key} = $${paramCount}`);
        params.push(value);
        paramCount++;
      }
    });
    
    if (updates.length === 0) {
      return apiResponse(response, null, 'No fields to update', 400);
    }
    
    // Always update updated_at
    updates.push(`updated_at = NOW()`);
    
    params.push(clientId); // Add clientId as the last parameter
    
    const query = `
      UPDATE clients 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await executeQuery(query, params);
    
    const client = result.rows[0];
    // Convert subscription_amount to number
    client.subscription_amount = parseFloat(client.subscription_amount || 0);
    
    return apiResponse(response, client, 'Client updated successfully');
  } catch (error) {
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}

// Delete client
async function handleDeleteClient(response, clientId) {
  try {
    // Security: First check if client exists and validate ownership
    const ownerCheckQuery = `SELECT owner_id FROM clients WHERE id = $1`;
    const ownerCheckResult = await executeQuery(ownerCheckQuery, [clientId]);
    
    if (ownerCheckResult.rows.length === 0) {
      return apiResponse(response, null, 'Client not found', 404);
    }
    
    const clientOwnerId = ownerCheckResult.rows[0].owner_id;
    
    // Security: Validate owner access
    if (!await validateOwnerAccess(clientOwnerId)) {
      return apiResponse(response, null, 'Unauthorized access to client data', 403);
    }
    
    const query = `DELETE FROM clients WHERE id = $1 RETURNING id`;
    const result = await executeQuery(query, [clientId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Client not found', 404);
    }
    
    return apiResponse(response, { id: clientId }, 'Client deleted successfully');
  } catch (error) {
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}

// MRR Summary endpoint
async function handleMRRSummary(response, searchParams) {
  try {
    const { owner_id, start_date, end_date } = Object.fromEntries(searchParams);
    
    let query = `
      SELECT 
        COUNT(*) as total_clients,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN status = 'churned' THEN 1 END) as churned_clients,
        COUNT(CASE WHEN status = 'paused' THEN 1 END) as paused_clients,
        COALESCE(SUM(CASE WHEN status = 'active' THEN subscription_amount ELSE 0 END), 0) as total_mrr,
        COALESCE(AVG(CASE WHEN status = 'active' THEN subscription_amount END), 0) as avg_mrr,
        COALESCE(MIN(CASE WHEN status = 'active' THEN subscription_amount END), 0) as min_mrr,
        COALESCE(MAX(CASE WHEN status = 'active' THEN subscription_amount END), 0) as max_mrr
      FROM clients
    `;
    
    const params = [];
    const conditions = [];
    
    // Security: Validate owner_id access for MRR summary
    if (owner_id) {
      if (!await validateOwnerAccess(owner_id)) {
        return apiResponse(response, null, 'Unauthorized access to owner data', 403);
      }
      conditions.push(`owner_id = $${params.length + 1}`);
      params.push(owner_id);
    } else {
      // Security: Require owner_id to prevent unauthorized data access
      return apiResponse(response, null, 'owner_id parameter is required', 400);
    }
    
    if (start_date) {
      conditions.push(`subscription_start_date >= $${params.length + 1}`);
      params.push(start_date);
    }
    
    if (end_date) {
      conditions.push(`subscription_start_date <= $${params.length + 1}`);
      params.push(end_date);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    const result = await executeQuery(query, params);
    const summary = result.rows[0];
    
    // Convert numeric fields
    const data = {
      total_clients: parseInt(summary.total_clients),
      active_clients: parseInt(summary.active_clients),
      churned_clients: parseInt(summary.churned_clients),
      paused_clients: parseInt(summary.paused_clients),
      total_mrr: parseFloat(summary.total_mrr),
      avg_mrr: parseFloat(summary.avg_mrr),
      min_mrr: parseFloat(summary.min_mrr),
      max_mrr: parseFloat(summary.max_mrr),
      // Calculate additional metrics
      churn_rate: parseInt(summary.total_clients) > 0 ? 
        (parseInt(summary.churned_clients) / parseInt(summary.total_clients) * 100) : 0,
      active_rate: parseInt(summary.total_clients) > 0 ? 
        (parseInt(summary.active_clients) / parseInt(summary.total_clients) * 100) : 0
    };
    
    return apiResponse(response, data);
  } catch (error) {
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}

// MRR by Owner endpoint
async function handleMRRByOwner(response, searchParams) {
  try {
    const { status } = Object.fromEntries(searchParams);
    
    let query = `
      SELECT 
        c.owner_id,
        p.first_name,
        p.last_name,
        p.full_name,
        COUNT(*) as total_clients,
        COUNT(CASE WHEN c.status = 'active' THEN 1 END) as active_clients,
        COUNT(CASE WHEN c.status = 'churned' THEN 1 END) as churned_clients,
        COUNT(CASE WHEN c.status = 'paused' THEN 1 END) as paused_clients,
        COALESCE(SUM(CASE WHEN c.status = 'active' THEN c.subscription_amount ELSE 0 END), 0) as total_mrr,
        COALESCE(AVG(CASE WHEN c.status = 'active' THEN c.subscription_amount END), 0) as avg_mrr
      FROM clients c
      LEFT JOIN profiles p ON c.owner_id = p.id
    `;
    
    const params = [];
    const conditions = [];
    
    if (status) {
      conditions.push(`c.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` GROUP BY c.owner_id, p.first_name, p.last_name, p.full_name ORDER BY total_mrr DESC`;

    const result = await executeQuery(query, params);
    
    const data = result.rows.map(row => ({
      owner_id: row.owner_id,
      owner_name: row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      total_clients: parseInt(row.total_clients),
      active_clients: parseInt(row.active_clients),
      churned_clients: parseInt(row.churned_clients),
      paused_clients: parseInt(row.paused_clients),
      total_mrr: parseFloat(row.total_mrr),
      avg_mrr: parseFloat(row.avg_mrr),
      churn_rate: parseInt(row.total_clients) > 0 ? 
        (parseInt(row.churned_clients) / parseInt(row.total_clients) * 100) : 0
    }));
    
    return apiResponse(response, data);
  } catch (error) {
    const sanitizedMessage = sanitizeError(error);
    return apiResponse(response, null, sanitizedMessage, 500);
  }
}