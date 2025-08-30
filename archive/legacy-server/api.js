#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import db from './connection-pooling.js';

const app = express();
const PORT = 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection is handled by the connection pooling module
// The old client connection code has been replaced
/*
let client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_p29ezkLxYgqh@ep-divine-heart-abzonafv-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require',
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  connectionTimeoutMillis: 30000,
  query_timeout: 30000,
  statement_timeout: 30000,
  idle_in_transaction_session_timeout: 30000
});
*/

// User endpoint - Andrew Bryce's profile
app.get('/api/user', (req, res) => {
  res.json({
    id: 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // Andrew's actual UUID from the database
    email: 'andrew.bryce@sixtyseconds.video',
    first_name: 'Andrew',
    last_name: 'Bryce',
    stage: 'Director',
    is_admin: true,
    avatar_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
});

// Companies with stats endpoint
app.get('/api/companies', async (req, res) => {
  try {
    const { search, includeStats, limit, ownerId } = req.query;
    
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
        ) contact_counts ON c.id = contact_counts.company_id
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

    const result = await db.query(query, params);
    
    res.json({
      data: result.rows,
      error: null,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: error.message });
  }
});

// Deals with relationships endpoint
app.get('/api/deals', async (req, res) => {
  try {
    const { includeRelationships, limit, ownerId } = req.query;
    
    let query = `
      SELECT 
        d.*,
        ${includeRelationships === 'true' ? `
          c.name as company_name,
          c.domain as company_domain,
          c.size as company_size,
          c.industry as company_industry,
          ct.full_name as contact_name,
          ct.email as contact_email,
          ct.title as contact_title,
          ds.name as stage_name,
          ds.color as stage_color,
          ds.default_probability as stage_probability
        ` : 'null as company_name, null as company_domain, null as contact_name, null as contact_email'}
      FROM deals d
      ${includeRelationships === 'true' ? `
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
        LEFT JOIN deal_stages ds ON d.stage_id = ds.id
      ` : ''}
    `;
    
    const params = [];
    const conditions = [];
    
    if (ownerId) {
      conditions.push(`d.owner_id = $${params.length + 1}`);
      params.push(ownerId);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY d.updated_at DESC`;
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));
    }

    const result = await db.query(query, params);
    
    res.json({
      data: result.rows,
      error: null,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create deal endpoint
app.post('/api/deals', async (req, res) => {
  try {
    const dealData = req.body;
    
    // Set default values if not provided
    const {
      name,
      company = name, // Default company to name if not provided
      value = 0,
      company_id = null,
      primary_contact_id = null,
      stage_id,
      probability = 50,
      expected_close_date = null,
      description = '',
      owner_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459', // Default to Andrew's ID
      contact_identifier = null,
      contact_identifier_type = 'unknown',
      contact_name = ''
    } = dealData;
    
    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Deal name is required' });
    }
    
    // If no stage_id provided, get the first stage
    let finalStageId = stage_id;
    if (!finalStageId) {
      const stageResult = await db.query(
        'SELECT id FROM deal_stages ORDER BY order_position ASC LIMIT 1'
      );
      if (stageResult.rows.length > 0) {
        finalStageId = stageResult.rows[0].id;
      }
    }
    
    const query = `
      INSERT INTO deals (
        name, company, value, company_id, primary_contact_id, stage_id,
        probability, expected_close_date, description, owner_id,
        contact_identifier, contact_identifier_type, contact_name,
        stage_changed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      ) RETURNING *
    `;
    
    const params = [
      name, company, value, company_id, primary_contact_id, finalStageId,
      probability, expected_close_date, description, owner_id,
      contact_identifier, contact_identifier_type, contact_name
    ];
    
    const result = await db.query(query, params);
    
    res.status(201).json({
      data: result.rows[0],
      error: null
    });
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update deal endpoint
app.put('/api/deals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Build dynamic update query
    const updateFields = [];
    const params = [];
    let paramCount = 1;
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && updates[key] !== undefined) {
        updateFields.push(`${key} = $${paramCount}`);
        params.push(updates[key]);
        paramCount++;
      }
    });
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add updated_at timestamp
    updateFields.push(`updated_at = NOW()`);
    
    // If stage_id is being updated, also update stage_changed_at
    if (updates.stage_id) {
      updateFields.push(`stage_changed_at = NOW()`);
    }
    
    params.push(id);
    
    const query = `
      UPDATE deals 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;
    
    const result = await db.query(query, params);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    res.json({
      data: result.rows[0],
      error: null
    });
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete deal endpoint
app.delete('/api/deals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = 'DELETE FROM deals WHERE id = $1 RETURNING *';
    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    
    res.json({
      data: { deleted: true, deal: result.rows[0] },
      error: null
    });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Contacts with relationships endpoint
app.get('/api/contacts', async (req, res) => {
  try {
    const { id, search, companyId, includeCompany, limit, ownerId, stats, deals, activities, owner, tasks } = req.query;
    
    // If ID is provided, handle individual contact requests
    if (id && id.trim() !== '') {
      console.log('Express: Contact ID detected:', id);
      
      // Handle sub-resource requests
      if (stats === 'true') {
        return handleContactStatsExpress(res, id);
      } else if (deals === 'true') {
        return handleContactDealsExpress(res, id);
      } else if (activities === 'true') {
        return handleContactActivitiesExpress(res, id, req.query);
      } else if (owner === 'true') {
        return handleContactOwnerExpress(res, id);
      } else if (tasks === 'true') {
        return handleContactTasksExpress(res, id);
      } else {
        // Single contact
        console.log('Express: Routing to single contact with ID:', id);
        return handleSingleContactExpress(res, id, req.query);
      }
    }
    
    // List all contacts (existing logic)
    let query = `
      SELECT 
        ct.*,
        ${includeCompany === 'true' ? `
          c.id as company_id,
          c.name as company_name,
          c.domain as company_domain,
          c.size as company_size,
          c.industry as company_industry,
          c.website as company_website
        ` : 'null as company_id, null as company_name, null as company_domain, null as company_size, null as company_industry, null as company_website'}
      FROM contacts ct
      ${includeCompany === 'true' ? 'LEFT JOIN companies c ON ct.company_id = c.id' : ''}
    `;
    
    const params = [];
    const conditions = [];
    
    if (search) {
      conditions.push(`(ct.first_name ILIKE $${params.length + 1} OR ct.last_name ILIKE $${params.length + 1} OR ct.full_name ILIKE $${params.length + 1} OR ct.email ILIKE $${params.length + 1})`);
      params.push(`%${search}%`);
    }
    
    if (companyId) {
      conditions.push(`ct.company_id = $${params.length + 1}`);
      params.push(companyId);
    }
    
    if (ownerId) {
      conditions.push(`ct.owner_id = $${params.length + 1}`);
      params.push(ownerId);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY ct.updated_at DESC`;
    
    if (limit) {
      query += ` LIMIT $${params.length + 1}`;
      params.push(parseInt(limit));
    }

    const result = await db.query(query, params);
    
    const data = result.rows.map(row => ({
      ...row,
      // Company relationship if included
      companies: (includeCompany === 'true' && row.company_id) ? {
        id: row.company_id,
        name: row.company_name,
        domain: row.company_domain,
        size: row.company_size,
        industry: row.company_industry,
        website: row.company_website
      } : null
    }));

    res.json({
      data,
      error: null,
      count: data.length
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: error.message });
  }
});

// Single contact by ID endpoint
app.get('/api/contacts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeCompany } = req.query;
    
    let query = `
      SELECT 
        ct.*,
        ${includeCompany === 'true' ? `
          c.id as company_id,
          c.name as company_name,
          c.domain as company_domain,
          c.size as company_size,
          c.industry as company_industry,
          c.website as company_website
        ` : 'null as company_id, null as company_name, null as company_domain, null as company_size, null as company_industry, null as company_website'}
      FROM contacts ct
      ${includeCompany === 'true' ? 'LEFT JOIN companies c ON ct.company_id = c.id' : ''}
      WHERE ct.id = $1
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Contact not found',
        data: null 
      });
    }
    
    const row = result.rows[0];
    const data = {
      ...row,
      // Company relationship if included
      companies: (includeCompany === 'true' && row.company_id) ? {
        id: row.company_id,
        name: row.company_name,
        domain: row.company_domain,
        size: row.company_size,
        industry: row.company_industry,
        website: row.company_website
      } : null
    };

    res.json({
      data,
      error: null
    });
  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({ error: error.message });
  }
});

// Contact deals endpoint
app.get('/api/contacts/:id/deals', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        d.*,
        ds.name as stage_name,
        ds.color as stage_color,
        ds.default_probability
      FROM deals d
      LEFT JOIN deal_stages ds ON d.stage_id = ds.id
      WHERE d.primary_contact_id = $1 OR d.id IN (
        SELECT deal_id FROM deal_contacts WHERE contact_id = $1
      )
      ORDER BY d.updated_at DESC
    `;

    const result = await db.query(query, [id]);
    
    res.json({
      data: result.rows,
      error: null,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching contact deals:', error);
    res.status(500).json({ error: error.message });
  }
});

// Contact activities endpoint
app.get('/api/contacts/:id/activities', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;
    
    const query = `
      SELECT 
        a.*,
        c.name as company_name
      FROM activities a
      LEFT JOIN companies c ON a.company_id = c.id
      WHERE a.contact_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(query, [id, parseInt(limit)]);
    
    res.json({
      data: result.rows,
      error: null,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching contact activities:', error);
    res.status(500).json({ error: error.message });
  }
});

// Contact stats endpoint
app.get('/api/contacts/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get activity counts
    const activityQuery = `
      SELECT 
        type,
        COUNT(*) as count
      FROM activities 
      WHERE contact_id = $1
      GROUP BY type
    `;
    
    // Get deals data
    const dealsQuery = `
      SELECT 
        COUNT(*) as total_deals,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_deals,
        COALESCE(SUM(value), 0) as total_value
      FROM deals 
      WHERE primary_contact_id = $1 OR id IN (
        SELECT deal_id FROM deal_contacts WHERE contact_id = $1
      )
    `;
    
    const [activityResult, dealsResult] = await Promise.all([
      client.query(activityQuery, [id]),
      client.query(dealsQuery, [id])
    ]);
    
    // Process activity counts
    const activityCounts = {};
    activityResult.rows.forEach(row => {
      activityCounts[row.type] = parseInt(row.count);
    });
    
    const dealsData = dealsResult.rows[0] || {};
    
    const stats = {
      meetings: activityCounts.meeting || 0,
      emails: activityCounts.email || 0,
      calls: activityCounts.call || 0,
      totalDeals: parseInt(dealsData.total_deals) || 0,
      activeDeals: parseInt(dealsData.active_deals) || 0,
      totalDealsValue: parseFloat(dealsData.total_value) || 0,
      // Calculate engagement score based on activity
      engagementScore: Math.min(100, Math.max(0, 
        (activityCounts.meeting || 0) * 15 + 
        (activityCounts.email || 0) * 5 + 
        (activityCounts.call || 0) * 10
      )),
      recentActivities: activityResult.rows
    };
    
    res.json({
      data: stats,
      error: null
    });
  } catch (error) {
    console.error('Error fetching contact stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get contact owner (sales rep) info
app.get('/api/contacts/:id/owner', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        p.id,
        p.first_name,
        p.last_name,
        p.stage,
        p.email,
        p.avatar_url,
        c.created_at as assigned_date
      FROM contacts c
      LEFT JOIN profiles p ON c.owner_id = p.id
      WHERE c.id = $1
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Contact or owner not found',
        data: null 
      });
    }
    
    const row = result.rows[0];
    const ownerData = {
      id: row.id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      first_name: row.first_name,
      last_name: row.last_name,
      title: row.stage,
      email: row.email,
      avatar_url: row.avatar_url,
      assigned_date: row.assigned_date
    };

    res.json({
      data: ownerData,
      error: null
    });
  } catch (error) {
    console.error('Error fetching contact owner:', error);
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy', 
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Performance monitoring endpoints
app.get('/api/performance/stats', (req, res) => {
  const stats = db.getStats();
  res.json(stats);
});

app.post('/api/performance/clear-cache', (req, res) => {
  const { tier = 'all', pattern = null } = req.body;
  db.clearCache(tier, pattern);
  res.json({ message: `Cache cleared for tier: ${tier}${pattern ? ` with pattern: ${pattern}` : ''}` });
});

// Deal stages endpoint
app.get('/api/stages', async (req, res) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        color,
        default_probability,
        order_position,
        created_at,
        updated_at
      FROM deal_stages
      ORDER BY order_position ASC, created_at ASC
    `;

    const result = await db.query(query);
    
    res.json({
      data: result.rows,
      error: null,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching deal stages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Owners/Sales Reps endpoint - Return ALL active sales reps
app.get('/api/owners', async (req, res) => {
  try {
    const query = `
      SELECT DISTINCT
        p.id,
        p.first_name,
        p.last_name,
        p.stage,
        p.email,
        (p.first_name || ' ' || p.last_name) as full_name,
        COALESCE(deal_counts.deal_count, 0) as deal_count,
        COALESCE(deal_counts.total_value, 0) as total_value
      FROM profiles p
      LEFT JOIN (
        SELECT 
          owner_id,
          COUNT(*) as deal_count,
          COALESCE(SUM(value), 0) as total_value
        FROM deals
        GROUP BY owner_id
      ) deal_counts ON p.id = deal_counts.owner_id
      WHERE p.id IS NOT NULL
        AND (p.first_name IS NOT NULL OR p.last_name IS NOT NULL OR p.email IS NOT NULL)
      ORDER BY p.first_name, p.last_name
    `;

    const result = await db.query(query);
    
    res.json({
      data: result.rows,
      error: null,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching owners:', error);
    res.status(500).json({ error: error.message });
  }
});

// Contact tasks endpoint (simplified - can be enhanced later with real tasks table)
app.get('/api/contacts/:id/tasks', async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, we'll create simple tasks based on activities and deals
    const tasksQuery = `
      SELECT 
        'activity' as source,
        a.id::text as id,
        a.type || ' follow-up' as title,
        'Follow up on ' || a.type || ' activity' as description,
        'medium' as priority,
        a.created_at + INTERVAL '3 days' as due_date,
        false as completed
      FROM activities a 
      WHERE a.contact_id = $1
      AND a.created_at > NOW() - INTERVAL '30 days'
      
      UNION ALL
      
      SELECT 
        'deal' as source,
        d.id::text as id,
        'Follow up on deal' as title,
        'Check progress on deal worth £' || COALESCE(d.value::text, 'unknown') as description,
        CASE 
          WHEN d.value > 10000 THEN 'high'
          WHEN d.value > 5000 THEN 'medium'
          ELSE 'low'
        END as priority,
        d.updated_at + INTERVAL '7 days' as due_date,
        CASE WHEN d.status = 'won' THEN true ELSE false END as completed
      FROM deals d 
      WHERE (d.primary_contact_id = $1 OR d.id IN (
        SELECT deal_id FROM deal_contacts WHERE contact_id = $1
      ))
      AND d.status != 'lost'
      
      ORDER BY due_date DESC
      LIMIT 10
    `;

    const result = await db.query(tasksQuery, [id]);
    
    res.json({
      data: result.rows,
      error: null,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching contact tasks:', error);
    res.status(500).json({ error: error.message });
  }
});

// Single deal by ID endpoint
app.get('/api/deals/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeRelationships } = req.query;
    
    let query = `
      SELECT 
        d.*,
        ${includeRelationships === 'true' ? `
          c.name as company_name,
          c.domain as company_domain,
          c.size as company_size,
          c.industry as company_industry,
          ct.full_name as contact_name,
          ct.email as contact_email,
          ct.title as contact_title,
          ds.name as stage_name,
          ds.color as stage_color,
          ds.default_probability as default_probability
        ` : 'null as company_name, null as company_domain, null as contact_name, null as contact_email, null as stage_name, null as stage_color, null as default_probability'}
      FROM deals d
      ${includeRelationships === 'true' ? `
        LEFT JOIN companies c ON d.company_id = c.id
        LEFT JOIN contacts ct ON d.primary_contact_id = ct.id
        LEFT JOIN deal_stages ds ON d.stage_id = ds.id
      ` : ''}
      WHERE d.id = $1
    `;

    const result = await db.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Deal not found',
        data: null 
      });
    }
    
    res.json({
      data: result.rows[0],
      error: null
    });
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
// Express helper functions for contact sub-resources
async function handleSingleContactExpress(res, contactId, query) {
  try {
    const { includeCompany } = query;
    
    let querySQL = `
      SELECT 
        ct.*,
        ${includeCompany === 'true' ? `
          c.id as company_id,
          c.name as company_name,
          c.domain as company_domain,
          c.size as company_size,
          c.industry as company_industry,
          c.website as company_website
        ` : 'null as company_id, null as company_name, null as company_domain, null as company_size, null as company_industry, null as company_website'}
      FROM contacts ct
      ${includeCompany === 'true' ? 'LEFT JOIN companies c ON ct.company_id = c.id' : ''}
      WHERE ct.id = $1
    `;

    const result = await db.query(querySQL, [contactId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: 'Contact not found',
        data: null 
      });
    }
    
    const row = result.rows[0];
    const data = {
      ...row,
      companies: (includeCompany === 'true' && row.company_id) ? {
        id: row.company_id,
        name: row.company_name,
        domain: row.company_domain,
        size: row.company_size,
        industry: row.company_industry,
        website: row.company_website
      } : null
    };

    res.json({ data, error: null });
  } catch (error) {
    console.error('Error fetching single contact:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleContactDealsExpress(res, contactId) {
  try {
    const query = `
      SELECT d.*, ds.name as stage_name, ds.color as stage_color, ds.default_probability
      FROM deals d
      LEFT JOIN deal_stages ds ON d.stage_id = ds.id
      WHERE d.primary_contact_id = $1 OR d.id IN (
        SELECT deal_id FROM deal_contacts WHERE contact_id = $1
      )
      ORDER BY d.updated_at DESC
    `;

    const result = await db.query(query, [contactId]);
    res.json({ data: result.rows, error: null, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching contact deals:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleContactActivitiesExpress(res, contactId, query) {
  try {
    const { limit = 10 } = query;
    
    const querySQL = `
      SELECT a.*, c.name as company_name
      FROM activities a
      LEFT JOIN companies c ON a.company_id = c.id
      WHERE a.contact_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2
    `;

    const result = await db.query(querySQL, [contactId, parseInt(limit)]);
    res.json({ data: result.rows, error: null, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching contact activities:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleContactStatsExpress(res, contactId) {
  try {
    const activityQuery = `SELECT type, COUNT(*) as count FROM activities WHERE contact_id = $1 GROUP BY type`;
    const dealsQuery = `
      SELECT COUNT(*) as total_deals, COUNT(CASE WHEN status = 'active' THEN 1 END) as active_deals, COALESCE(SUM(value), 0) as total_value
      FROM deals WHERE primary_contact_id = $1 OR id IN (SELECT deal_id FROM deal_contacts WHERE contact_id = $1)
    `;
    
    const [activityResult, dealsResult] = await Promise.all([
      client.query(activityQuery, [contactId]),
      client.query(dealsQuery, [contactId])
    ]);
    
    const activityCounts = {};
    activityResult.rows.forEach(row => {
      activityCounts[row.type] = parseInt(row.count);
    });
    
    const dealsData = dealsResult.rows[0] || {};
    const stats = {
      meetings: activityCounts.meeting || 0,
      emails: activityCounts.email || 0,
      calls: activityCounts.call || 0,
      totalDeals: parseInt(dealsData.total_deals) || 0,
      activeDeals: parseInt(dealsData.active_deals) || 0,
      totalDealsValue: parseFloat(dealsData.total_value) || 0,
      engagementScore: Math.min(100, Math.max(0, 
        (activityCounts.meeting || 0) * 15 + 
        (activityCounts.email || 0) * 5 + 
        (activityCounts.call || 0) * 10
      )),
      recentActivities: activityResult.rows
    };
    
    res.json({ data: stats, error: null });
  } catch (error) {
    console.error('Error fetching contact stats:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleContactOwnerExpress(res, contactId) {
  try {
    const query = `
      SELECT p.id, p.first_name, p.last_name, p.stage, p.email, p.avatar_url, c.created_at as assigned_date
      FROM contacts c LEFT JOIN profiles p ON c.owner_id = p.id WHERE c.id = $1
    `;

    const result = await db.query(query, [contactId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contact or owner not found', data: null });
    }
    
    const row = result.rows[0];
    const ownerData = {
      id: row.id,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
      first_name: row.first_name,
      last_name: row.last_name,
      title: row.stage,
      email: row.email,
      avatar_url: row.avatar_url,
      assigned_date: row.assigned_date
    };

    res.json({ data: ownerData, error: null });
  } catch (error) {
    console.error('Error fetching contact owner:', error);
    res.status(500).json({ error: error.message });
  }
}

async function handleContactTasksExpress(res, contactId) {
  try {
    const tasksQuery = `
      SELECT 'activity' as source, a.id::text as id, a.type || ' follow-up' as title,
             'Follow up on ' || a.type || ' activity' as description, 'medium' as priority,
             a.created_at + INTERVAL '3 days' as due_date, false as completed
      FROM activities a WHERE a.contact_id = $1 AND a.created_at > NOW() - INTERVAL '30 days'
      UNION ALL
      SELECT 'deal' as source, d.id::text as id, 'Follow up on deal' as title,
             'Check progress on deal worth £' || COALESCE(d.value::text, 'unknown') as description,
             CASE WHEN d.value > 10000 THEN 'high' WHEN d.value > 5000 THEN 'medium' ELSE 'low' END as priority,
             d.updated_at + INTERVAL '7 days' as due_date,
             CASE WHEN d.status = 'won' THEN true ELSE false END as completed
      FROM deals d WHERE (d.primary_contact_id = $1 OR d.id IN (SELECT deal_id FROM deal_contacts WHERE contact_id = $1))
      AND d.status != 'lost'
      ORDER BY due_date DESC LIMIT 10
    `;

    const result = await db.query(tasksQuery, [contactId]);
    res.json({ data: result.rows, error: null, count: result.rows.length });
  } catch (error) {
    console.error('Error fetching contact tasks:', error);
    res.status(500).json({ error: error.message });
  }
}

// Start server directly - database connection pool initializes automatically
app.listen(PORT, '127.0.0.1', () => {
  console.log(`🚀 API Server running on http://127.0.0.1:${PORT}`);
  console.log(`📊 Companies API: http://127.0.0.1:${PORT}/api/companies`);
  console.log(`👥 Contacts API: http://127.0.0.1:${PORT}/api/contacts`);
  console.log(`📋 Deals API: http://127.0.0.1:${PORT}/api/deals`);
  console.log(`❤️ Health Check: http://127.0.0.1:${PORT}/api/health`);
  console.log(`📈 Performance Stats: http://127.0.0.1:${PORT}/api/performance/stats`);
}); 