import { executeQuery, handleCORS, apiResponse } from './_db.js';

export default async function handler(request, response) {
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const pathSegments = url.pathname.split('/').filter(segment => segment && segment !== 'api' && segment !== 'activities');
    const activityId = pathSegments[0];
    
    if (request.method === 'GET') {
      if (!activityId) {
        // GET /api/activities - List activities
        return await handleActivitiesList(response, url);
      } else {
        // GET /api/activities/:id - Single activity
        return await handleSingleActivity(response, activityId);
      }
    } else if (request.method === 'POST') {
      // POST /api/activities - Create activity
      return await handleCreateActivity(response, request);
    } else if (request.method === 'PUT' || request.method === 'PATCH') {
      if (activityId) {
        // PUT /api/activities/:id - Update activity
        return await handleUpdateActivity(response, request, activityId);
      }
      return apiResponse(response, null, 'Activity ID required', 400);
    } else if (request.method === 'DELETE') {
      if (activityId) {
        // DELETE /api/activities/:id - Delete activity
        return await handleDeleteActivity(response, activityId);
      }
      return apiResponse(response, null, 'Activity ID required', 400);
    }

    return apiResponse(response, null, 'Method not allowed', 405);
  } catch (error) {
    console.error('Error in activities API:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// List activities
async function handleActivitiesList(response, url) {
  try {
    const { 
      ownerId, 
      contactIdentifier, 
      type, 
      status, 
      limit = '100', 
      offset = '0',
      startDate,
      endDate,
      search
    } = Object.fromEntries(url.searchParams);
    
    let query = `
      SELECT 
        a.*,
        c.name as company_name,
        c.domain as company_domain
      FROM activities a
      LEFT JOIN companies c ON a.company_id = c.id
    `;
    
    const params = [];
    const conditions = [];
    
    if (search) {
      conditions.push(`(a.client_name ILIKE $${params.length + 1} OR a.details ILIKE $${params.length + 1} OR a.contact_identifier ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    if (ownerId) {
      conditions.push(`a.user_id = $${params.length + 1}`);
      params.push(ownerId);
    }
    
    if (contactIdentifier) {
      conditions.push(`a.contact_identifier = $${params.length + 1}`);
      params.push(contactIdentifier);
    }
    
    if (type) {
      conditions.push(`a.type = $${params.length + 1}`);
      params.push(type);
    }
    
    if (status) {
      conditions.push(`a.status = $${params.length + 1}`);
      params.push(status);
    }
    
    if (startDate) {
      conditions.push(`a.date >= $${params.length + 1}`);
      params.push(startDate);
    }
    
    if (endDate) {
      conditions.push(`a.date <= $${params.length + 1}`);
      params.push(endDate);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY a.date DESC`;
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));
    }
    
    if (offset) {
      query += ` OFFSET $${params.length + 1}`;
      params.push(parseInt(offset));
    }

    const result = await executeQuery(query, params);
    return apiResponse(response, result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Single activity by ID
async function handleSingleActivity(response, activityId) {
  try {
    const query = `
      SELECT 
        a.*,
        c.name as company_name,
        c.domain as company_domain
      FROM activities a
      LEFT JOIN companies c ON a.company_id = c.id
      WHERE a.id = $1
    `;

    const result = await executeQuery(query, [activityId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Activity not found', 404);
    }
    
    return apiResponse(response, result.rows[0]);
  } catch (error) {
    console.error('Error fetching activity:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Create activity
async function handleCreateActivity(response, request) {
  try {
    const body = JSON.parse(request.body || '{}');
    const { 
      user_id,
      type,
      client_name,
      contact_identifier,
      details,
      amount,
      priority,
      sales_rep,
      date,
      status = 'completed',
      company_id
    } = body;
    
    if (!user_id || !type || !client_name) {
      return apiResponse(response, null, 'user_id, type, and client_name are required', 400);
    }
    
    const query = `
      INSERT INTO activities (
        user_id, type, client_name, contact_identifier, details, 
        amount, priority, sales_rep, date, status, company_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    
    const params = [
      user_id, type, client_name, contact_identifier, details,
      amount, priority, sales_rep, date || new Date().toISOString(), status, company_id
    ];
    
    const result = await executeQuery(query, params);
    
    return apiResponse(response, result.rows[0], null, 201);
  } catch (error) {
    console.error('Error creating activity:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Update activity
async function handleUpdateActivity(response, request, activityId) {
  try {
    const body = JSON.parse(request.body || '{}');
    const { 
      type,
      client_name,
      contact_identifier,
      details,
      amount,
      priority,
      sales_rep,
      date,
      status,
      company_id
    } = body;
    
    const query = `
      UPDATE activities 
      SET type = COALESCE($1, type),
          client_name = COALESCE($2, client_name),
          contact_identifier = COALESCE($3, contact_identifier),
          details = COALESCE($4, details),
          amount = COALESCE($5, amount),
          priority = COALESCE($6, priority),
          sales_rep = COALESCE($7, sales_rep),
          date = COALESCE($8, date),
          status = COALESCE($9, status),
          company_id = COALESCE($10, company_id),
          updated_at = NOW()
      WHERE id = $11
      RETURNING *
    `;
    
    const params = [
      type, client_name, contact_identifier, details, amount,
      priority, sales_rep, date, status, company_id, activityId
    ];
    
    const result = await executeQuery(query, params);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Activity not found', 404);
    }
    
    return apiResponse(response, result.rows[0]);
  } catch (error) {
    console.error('Error updating activity:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Delete activity
async function handleDeleteActivity(response, activityId) {
  try {
    const query = `DELETE FROM activities WHERE id = $1 RETURNING *`;
    const result = await executeQuery(query, [activityId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Activity not found', 404);
    }
    
    return apiResponse(response, { deleted: true, activity: result.rows[0] });
  } catch (error) {
    console.error('Error deleting activity:', error);
    return apiResponse(response, null, error.message, 500);
  }
} 