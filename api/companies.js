import { executeQuery, handleCORS, apiResponse } from './_db.js';

export default async function handler(request, response) {
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    if (request.method === 'GET') {
      // Parse query parameters from request.url for Vercel compatibility
      const urlParts = request.url.split('?');
      const queryString = urlParts[1] || '';
      const searchParams = new URLSearchParams(queryString);
      const { search, includeStats, limit, ownerId } = Object.fromEntries(searchParams);
      
      let query = `
        SELECT 
          c.*,
          ${includeStats === 'true' ? `
            COALESCE(contact_counts.contact_count, 0) as "contactCount",
            COALESCE(deal_counts.deal_count, 0) as "dealsCount",
            COALESCE(deal_counts.deal_value, 0) as "dealsValue"
          ` : '0 as "contactCount", 0 as "dealsCount", 0 as "dealsValue"'}
        FROM companies c
        ${includeStats === 'true' ? `
          LEFT JOIN (
            SELECT company_id, COUNT(*) as contact_count
            FROM contacts 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
          ) contact_counts ON c.id = contact_counts.company_idnpm run dev
           
          LEFT JOIN (
            SELECT company_id, COUNT(*) as deal_count, COALESCE(SUM(value), 0) as deal_value
            FROM deals 
            WHERE company_id IS NOT NULL
            GROUP BY company_id
          ) deal_counts ON c.id = deal_counts.company_id
        ` : ''}
      `;
      
      const params = [];
      const conditions = [];
      
      if (search) {
        conditions.push(`(c.name ILIKE $${params.length + 1} OR c.domain ILIKE $${params.length + 1})`);
        params.push(`%${search}%`);
      }
      
      if (ownerId) {
        conditions.push(`c.owner_id = $${params.length + 1}`);
        params.push(ownerId);
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      query += ` ORDER BY c.updated_at DESC`;
      
      if (limit) {
        query += ` LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));
      }

      const result = await executeQuery(query, params);
      return apiResponse(response, result.rows);
    }

    return apiResponse(response, null, 'Method not allowed', 405);
  } catch (error) {
    console.error('Error in companies API:', error);
    return apiResponse(response, null, error.message, 500);
  }
} 