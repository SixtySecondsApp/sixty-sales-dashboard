import { executeQuery, handleCORS, apiResponse } from './_db.js';

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
    
    const pathSegments = pathname.split('/').filter(segment => segment && segment !== 'api' && segment !== 'stages');
    const stageId = pathSegments[0];
    
    if (request.method === 'GET') {
      if (!stageId) {
        // GET /api/stages - List all stages
        return await handleStagesList(response, searchParams);
      } else {
        // GET /api/stages/:id - Single stage
        return await handleSingleStage(response, stageId);
      }
    } else if (request.method === 'POST') {
      // POST /api/stages - Create stage
      return await handleCreateStage(response, request);
    } else if (request.method === 'PUT' || request.method === 'PATCH') {
      if (stageId) {
        // PUT /api/stages/:id - Update stage
        return await handleUpdateStage(response, request, stageId);
      }
      return apiResponse(response, null, 'Stage ID required', 400);
    } else if (request.method === 'DELETE') {
      if (stageId) {
        // DELETE /api/stages/:id - Delete stage
        return await handleDeleteStage(response, stageId);
      }
      return apiResponse(response, null, 'Stage ID required', 400);
    }

    return apiResponse(response, null, 'Method not allowed', 405);
  } catch (error) {
    console.error('Error in stages API:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// List all stages
async function handleStagesList(response, searchParams) {
  try {
    const { ownerId } = Object.fromEntries(searchParams);
    
    let query = `
      SELECT 
        ds.*,
        COALESCE(deal_counts.deal_count, 0) as deal_count,
        COALESCE(deal_counts.total_value, 0) as total_value
      FROM deal_stages ds
      LEFT JOIN (
        SELECT 
          stage_id,
          COUNT(*) as deal_count,
          COALESCE(SUM(value), 0) as total_value
        FROM deals
        ${ownerId ? 'WHERE owner_id = $1' : ''}
        GROUP BY stage_id
      ) deal_counts ON ds.id = deal_counts.stage_id
      ORDER BY ds.order_position ASC, ds.created_at ASC
    `;
    
    const params = ownerId ? [ownerId] : [];
    
    const result = await executeQuery(query, params);
    return apiResponse(response, result.rows);
  } catch (error) {
    console.error('Error fetching stages:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Single stage by ID
async function handleSingleStage(response, stageId) {
  try {
    const query = `
      SELECT 
        ds.*,
        COALESCE(deal_counts.deal_count, 0) as deal_count,
        COALESCE(deal_counts.total_value, 0) as total_value
      FROM deal_stages ds
      LEFT JOIN (
        SELECT 
          stage_id,
          COUNT(*) as deal_count,
          COALESCE(SUM(value), 0) as total_value
        FROM deals
        WHERE stage_id = $1
        GROUP BY stage_id
      ) deal_counts ON ds.id = deal_counts.stage_id
      WHERE ds.id = $1
    `;

    const result = await executeQuery(query, [stageId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Stage not found', 404);
    }
    
    return apiResponse(response, result.rows[0]);
  } catch (error) {
    console.error('Error fetching stage:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Create stage
async function handleCreateStage(response, request) {
  try {
    const body = await request.json();
    const { 
      name,
      color = '#3b82f6',
      default_probability = 50,
      order_position,
      is_final = false,
      description
    } = body;
    
    if (!name) {
      return apiResponse(response, null, 'Stage name is required', 400);
    }
    
    // If no order_position provided, set it to the highest + 1
    let finalOrderPosition = order_position;
    if (finalOrderPosition === undefined) {
      const maxOrderQuery = `SELECT COALESCE(MAX(order_position), 0) + 10 as next_order FROM deal_stages`;
      const maxOrderResult = await executeQuery(maxOrderQuery, []);
      finalOrderPosition = maxOrderResult.rows[0].next_order;
    }
    
    const query = `
      INSERT INTO deal_stages (name, color, default_probability, order_position, is_final, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const params = [name, color, default_probability, finalOrderPosition, is_final, description];
    const result = await executeQuery(query, params);
    
    return apiResponse(response, result.rows[0], null, 201);
  } catch (error) {
    console.error('Error creating stage:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Update stage
async function handleUpdateStage(response, request, stageId) {
  try {
    const body = await request.json();
    const { 
      name,
      color,
      default_probability,
      order_position,
      is_final,
      description
    } = body;
    
    const query = `
      UPDATE deal_stages 
      SET name = COALESCE($1, name),
          color = COALESCE($2, color),
          default_probability = COALESCE($3, default_probability),
          order_position = COALESCE($4, order_position),
          is_final = COALESCE($5, is_final),
          description = COALESCE($6, description),
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `;
    
    const params = [name, color, default_probability, order_position, is_final, description, stageId];
    const result = await executeQuery(query, params);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Stage not found', 404);
    }
    
    return apiResponse(response, result.rows[0]);
  } catch (error) {
    console.error('Error updating stage:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// Delete stage
async function handleDeleteStage(response, stageId) {
  try {
    // Check if there are any deals in this stage
    const dealsCheckQuery = `SELECT COUNT(*) as count FROM deals WHERE stage_id = $1`;
    const dealsCheckResult = await executeQuery(dealsCheckQuery, [stageId]);
    
    if (parseInt(dealsCheckResult.rows[0].count) > 0) {
      return apiResponse(response, null, 'Cannot delete stage with existing deals. Move deals to another stage first.', 400);
    }
    
    const query = `DELETE FROM deal_stages WHERE id = $1 RETURNING *`;
    const result = await executeQuery(query, [stageId]);
    
    if (result.rows.length === 0) {
      return apiResponse(response, null, 'Stage not found', 404);
    }
    
    return apiResponse(response, { deleted: true, stage: result.rows[0] });
  } catch (error) {
    console.error('Error deleting stage:', error);
    return apiResponse(response, null, error.message, 500);
  }
} 