import { executeQuery, handleCORS, apiResponse } from './_db.js';

export default async function handler(request, response) {
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    if (request.method === 'GET') {
      // GET /api/owners - List all owners (from profiles table)
      return await handleOwnersList(response);
    }

    return apiResponse(response, null, 'Method not allowed', 405);
  } catch (error) {
    console.error('Error in owners API:', error);
    return apiResponse(response, null, error.message, 500);
  }
}

// List all owners - Return ALL active sales reps, not just those with existing data
async function handleOwnersList(response) {
  try {
    const query = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.email,
        p.stage,
        p.is_admin,
        p.avatar_url,
        CONCAT(p.first_name, ' ', p.last_name) as full_name,
        COALESCE(deal_counts.deal_count, 0) as deal_count,
        COALESCE(deal_counts.total_value, 0) as total_value,
        COALESCE(activity_counts.activity_count, 0) as activity_count
      FROM profiles p
      LEFT JOIN (
        SELECT 
          owner_id,
          COUNT(*) as deal_count,
          COALESCE(SUM(value), 0) as total_value
        FROM deals
        GROUP BY owner_id
      ) deal_counts ON p.id = deal_counts.owner_id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as activity_count
        FROM activities
        GROUP BY user_id
      ) activity_counts ON p.id = activity_counts.user_id
      WHERE p.id IS NOT NULL
        AND (p.first_name IS NOT NULL OR p.last_name IS NOT NULL OR p.email IS NOT NULL)
      ORDER BY p.first_name ASC, p.last_name ASC
    `;

    const result = await executeQuery(query, []);
    return apiResponse(response, result.rows);
  } catch (error) {
    console.error('Error fetching owners:', error);
    return apiResponse(response, null, error.message, 500);
  }
} 