/**
 * Customer Provisioning API Endpoint
 *
 * POST /api/provision
 *
 * Creates a new customer and registers them in the Admin database.
 * This endpoint should be protected with authentication.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import adminDb from '../../lib/adminDb';

const router = express.Router();

// ============================================================================
// TYPES
// ============================================================================

interface ProvisionRequest {
  customerId: string;
  customerName: string;
  customerEmail: string;
  plan: 'starter' | 'pro' | 'enterprise';
  modules?: string[];
  timezone?: string;
}

interface ProvisionResponse {
  success: boolean;
  customerId: string;
  customerUuid?: string;
  apiKey?: {
    key: string;
    keyId: string;
    prefix: string;
  };
  enabledModules?: string[];
  message: string;
  error?: string;
}

// ============================================================================
// VALIDATION MIDDLEWARE
// ============================================================================

function validateProvisionRequest(
  req: Request<any, any, ProvisionRequest>,
  res: Response,
  next: NextFunction
) {
  const { customerId, customerName, customerEmail, plan } = req.body;

  // Validate customer ID
  if (!customerId || !/^[a-z0-9_-]+$/.test(customerId)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid customer ID. Must contain only lowercase letters, numbers, hyphens, and underscores',
    });
  }

  // Validate name
  if (!customerName || customerName.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Customer name is required',
    });
  }

  // Validate email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!customerEmail || !emailRegex.test(customerEmail)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email address',
    });
  }

  // Validate plan
  if (!['starter', 'pro', 'enterprise'].includes(plan)) {
    return res.status(400).json({
      success: false,
      message: 'Plan must be one of: starter, pro, enterprise',
    });
  }

  next();
}

// ============================================================================
// GET DEFAULT MODULES BY PLAN
// ============================================================================

function getDefaultModulesByPlan(plan: string): string[] {
  switch (plan) {
    case 'starter':
      return ['crm_core', 'advanced_pipeline'];
    case 'pro':
      return ['crm_core', 'advanced_pipeline', 'calendar_integration', 'workflow_automation'];
    case 'enterprise':
      return [
        'crm_core',
        'advanced_pipeline',
        'calendar_integration',
        'ai_assistant',
        'workflow_automation',
        'analytics_reporting',
        'api_access',
      ];
    default:
      return ['crm_core'];
  }
}

// ============================================================================
// GENERATE API KEY
// ============================================================================

function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `sk_${crypto.randomBytes(32).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 20);

  return { key, hash, prefix };
}

// ============================================================================
// PROVISION CUSTOMER ENDPOINT
// ============================================================================

router.post('/provision', validateProvisionRequest, async (req: Request<any, any, ProvisionRequest>, res: Response) => {
  const { customerId, customerName, customerEmail, plan, modules, timezone = 'UTC' } = req.body;

  try {
    const pool = adminDb.getAdminPool();

    // 1. Check if customer already exists
    const existingCustomer = await pool.query(
      `SELECT id FROM admin_customers WHERE company_domain = $1 AND deleted_at IS NULL`,
      [customerId]
    );

    if (existingCustomer.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Customer with ID '${customerId}' already exists`,
      });
    }

    // 2. Determine modules
    const modulesToEnable = modules || getDefaultModulesByPlan(plan);

    // 3. Generate credentials
    const dbPassword = crypto.randomBytes(32).toString('base64');
    const jwtSecret = crypto.randomBytes(64).toString('base64');

    // 4. Insert customer into admin database
    const insertCustomerResult = await pool.query(
      `INSERT INTO admin_customers (
        company_name, company_domain, subscription_plan, subscription_status,
        billing_email, database_host, database_port, database_name,
        database_user, database_password_encrypted,
        clerk_org_id, clerk_admin_user_id,
        use_customer_ai_keys, timezone,
        trial_started_at, trial_ends_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW()
      ) RETURNING id`,
      [
        customerName,
        customerId,
        plan,
        'trial',
        customerEmail,
        'localhost', // For local dev; would be RDS endpoint in production
        5432,
        `${customerId}_db`,
        `${customerId}_user`,
        dbPassword,
        `clerk_org_${customerId}`,
        `clerk_user_${customerId}`,
        false,
        timezone,
        new Date(),
        new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      ]
    );

    const customerUuid = insertCustomerResult.rows[0].id;
    console.log(`[PROVISION] Customer created: ${customerId} (${customerUuid})`);

    // 5. Assign feature modules
    const moduleResults = await pool.query(`SELECT id, module_key FROM admin_feature_modules WHERE module_key = ANY($1)`, [
      modulesToEnable,
    ]);

    for (const moduleRow of moduleResults.rows) {
      await pool.query(
        `INSERT INTO admin_customer_modules (customer_id, module_id, enabled) VALUES ($1, $2, true)`,
        [customerUuid, moduleRow.id]
      );
    }

    console.log(`[PROVISION] Assigned ${moduleResults.rows.length} modules to ${customerId}`);

    // 6. Create initial API key
    const { key, hash, prefix } = generateApiKey();

    const apiKeyResult = await pool.query(
      `INSERT INTO admin_api_keys (
        customer_id, key_hash, key_prefix, name, description,
        permissions, rate_limit_requests, rate_limit_period,
        status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id`,
      [
        customerUuid,
        hash,
        prefix,
        'default',
        'Default API key generated during provisioning',
        JSON.stringify(['read:*', 'write:*', 'execute:workflows']),
        1000, // 1000 requests per month
        'month',
        'active',
      ]
    );

    const apiKeyId = apiKeyResult.rows[0].id;
    console.log(`[PROVISION] API key created for ${customerId}: ${apiKeyId}`);

    // 7. Log to audit log
    await pool.query(
      `INSERT INTO admin_audit_logs (
        customer_id, action, resource_type, resource_id,
        new_values, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())`,
      [
        customerUuid,
        'customer_created',
        'customer',
        customerUuid,
        JSON.stringify({
          name: customerName,
          email: customerEmail,
          plan,
          provisioned_by: 'api_endpoint',
        }),
      ]
    );

    console.log(`[PROVISION] Audit log created for ${customerId}`);

    // 8. Return success response
    const response: ProvisionResponse = {
      success: true,
      customerId,
      customerUuid,
      apiKey: {
        key,
        keyId: apiKeyId,
        prefix,
      },
      enabledModules: modulesToEnable,
      message: `Customer '${customerName}' provisioned successfully with plan '${plan}'`,
    };

    return res.status(201).json(response);
  } catch (error) {
    console.error('[PROVISION ERROR]', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error during provisioning';

    return res.status(500).json({
      success: false,
      message: 'Failed to provision customer',
      error: errorMessage,
    });
  }
});

// ============================================================================
// GET PROVISIONING STATUS
// ============================================================================

router.get('/provision/:customerId', async (req: Request, res: Response) => {
  const { customerId } = req.params;

  try {
    const customer = await adminDb.getCustomerByDomain(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: `Customer '${customerId}' not found`,
      });
    }

    const modules = await adminDb.getCustomerEnabledModules(customer.id);
    const apiKeys = await adminDb.getCustomerApiKeys(customer.id);

    return res.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.company_name,
        domain: customer.company_domain,
        plan: customer.subscription_plan,
        status: customer.subscription_status,
        createdAt: customer.created_at,
      },
      modules: modules.map((m) => ({ name: m.module_name, enabled: m.enabled })),
      apiKeys: apiKeys.map((k) => ({ id: k.id, prefix: k.key_prefix, name: k.name, status: k.status })),
    });
  } catch (error) {
    console.error('[PROVISION GET ERROR]', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve provisioning status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
