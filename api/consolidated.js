// Consolidated API Router - Handles multiple routes in one function
// Reduces serverless function count from 19 to 1 for common endpoints

import { executeQuery, handleCORS, apiResponse } from './_db.js';

export default async function handler(request, response) {
  // Handle CORS preflight
  const corsResponse = handleCORS(request, response);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(request.url, `https://${request.headers.host}`);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: /api/consolidated/[endpoint]
    if (pathParts.length < 3 || pathParts[0] !== 'api' || pathParts[1] !== 'consolidated') {
      return apiResponse(response, null, 'Invalid route format. Use /api/consolidated/[endpoint]', 400);
    }

    const endpoint = pathParts[2];
    const method = request.method;

    switch (endpoint) {
      case 'activities':
        return await handleActivities(request, response, url, pathParts.slice(3));
        
      case 'companies':
        return await handleCompanies(request, response, url, pathParts.slice(3));
        
      case 'contacts':
        return await handleContacts(request, response, url, pathParts.slice(3));
        
      case 'owners':
        return await handleOwners(request, response, url, pathParts.slice(3));
        
      case 'stages':
        return await handleStages(request, response, url, pathParts.slice(3));
        
      case 'roadmap':
        return await handleRoadmap(request, response, url, pathParts.slice(3));
        
      case 'roadmap-votes':
        return await handleRoadmapVotes(request, response, url, pathParts.slice(3));
        
      case 'user':
        return await handleUser(request, response, url, pathParts.slice(3));
        
      default:
        return apiResponse(response, null, `Endpoint '${endpoint}' not found`, 404);
    }
  } catch (error) {
    console.error('Consolidated API error:', error);
    return apiResponse(response, null, 'Internal server error', 500);
  }
}

// Simplified handlers for each endpoint
async function handleActivities(request, response, url, pathParts) {
  const method = request.method;
  
  if (method === 'GET') {
    const query = `SELECT * FROM activities ORDER BY created_at DESC LIMIT 100`;
    const result = await executeQuery(query);
    return apiResponse(response, result.rows, null, 200);
  }
  
  if (method === 'POST') {
    const body = JSON.parse(request.body || '{}');
    const query = `INSERT INTO activities (type, description, deal_id, created_at) 
                   VALUES ($1, $2, $3, NOW()) RETURNING *`;
    const result = await executeQuery(query, [body.type, body.description, body.deal_id]);
    return apiResponse(response, result.rows[0], null, 201);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}

async function handleCompanies(request, response, url, pathParts) {
  if (request.method === 'GET') {
    const query = `SELECT * FROM companies ORDER BY name`;
    const result = await executeQuery(query);
    return apiResponse(response, result.rows, null, 200);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}

async function handleContacts(request, response, url, pathParts) {
  if (request.method === 'GET') {
    const query = `SELECT * FROM contacts ORDER BY name`;
    const result = await executeQuery(query);
    return apiResponse(response, result.rows, null, 200);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}

async function handleOwners(request, response, url, pathParts) {
  if (request.method === 'GET') {
    const query = `SELECT DISTINCT owner FROM deals WHERE owner IS NOT NULL ORDER BY owner`;
    const result = await executeQuery(query);
    return apiResponse(response, result.rows, null, 200);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}

async function handleStages(request, response, url, pathParts) {
  if (request.method === 'GET') {
    const query = `SELECT * FROM stages ORDER BY position`;
    const result = await executeQuery(query);
    return apiResponse(response, result.rows, null, 200);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}

async function handleRoadmap(request, response, url, pathParts) {
  if (request.method === 'GET') {
    const query = `SELECT * FROM roadmap_items ORDER BY priority DESC`;
    const result = await executeQuery(query);
    return apiResponse(response, result.rows, null, 200);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}

async function handleRoadmapVotes(request, response, url, pathParts) {
  if (request.method === 'GET') {
    const query = `SELECT * FROM roadmap_votes ORDER BY created_at DESC`;
    const result = await executeQuery(query);
    return apiResponse(response, result.rows, null, 200);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}

async function handleUser(request, response, url, pathParts) {
  if (request.method === 'GET') {
    // Simple user info endpoint
    return apiResponse(response, { user: 'authenticated', timestamp: new Date().toISOString() }, null, 200);
  }
  
  return apiResponse(response, null, 'Method not allowed', 405);
}