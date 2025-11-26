# Admin Database Setup & Connection Guide

## Overview

The Admin Database is the **SaaS Control Plane** that manages all tenant metadata, subscriptions, API keys, and usage tracking. It's separate from individual customer databases and runs on **port 5433**.

### Architecture

```
┌─────────────────────────────────────────┐
│   Admin Database (SaaS Control Plane)   │
│   postgres://admin_user:admin_password  │
│   @localhost:5433/saas_admin            │
├─────────────────────────────────────────┤
│  ✓ 9 Core Tables                        │
│  ✓ 10 Feature Modules                   │
│  ✓ Complete RLS & Audit Logging         │
│  ✓ API Key Management                   │
│  ✓ Token Consumption Tracking           │
│  ✓ Subscription Management              │
└─────────────────────────────────────────┘
```

---

## Quick Connection Details

### Admin Database

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `5433` |
| **Database** | `saas_admin` |
| **Username** | `admin_user` |
| **Password** | `admin_password` |
| **JDBC URL** | `jdbc:postgresql://localhost:5433/saas_admin` |
| **PostgreSQL URL** | `postgresql://admin_user:admin_password@localhost:5433/saas_admin` |
| **Environment** | Development (change credentials for production) |

### Customer Database (Example)

| Setting | Value |
|---------|-------|
| **Host** | `localhost` |
| **Port** | `5432` |
| **Database** | `saas_dev` |
| **Username** | `dev_user` |
| **Password** | `dev_password` |
| **JDBC URL** | `jdbc:postgresql://localhost:5432/saas_dev` |
| **PostgreSQL URL** | `postgresql://dev_user:dev_password@localhost:5432/saas_dev` |
| **Environment** | Development (template for provisioned customers) |

---

## DBWeaver Connection Setup

### Step 1: Create New Connection in DBWeaver

1. Open DBWeaver
2. Click **"Database" → "New Database Connection"**
3. Select **"PostgreSQL"**

### Step 2: Connection Settings (Admin Database)

Fill in these fields:

```
Connection Name:     Sixty Sales - Admin DB (Dev)
Database:           PostgreSQL
Server Host:        localhost
Port:              5433
Database:          saas_admin
Username:          admin_user
Password:          admin_password
Save password:     ✓ (Optional)
Auto-connect:      ✓ (Optional)
```

### Step 3: Connection URL (Alternative)

If DBWeaver supports direct URL input:

```
jdbc:postgresql://localhost:5433/saas_admin
```

Then provide:
- **Username:** `admin_user`
- **Password:** `admin_password`

### Step 4: Test Connection

Click **"Test Connection"** in DBWeaver. You should see:
```
✓ Connection successful
```

---

## Admin Database Schema Overview

### Core Tables

#### 1. `admin_customers` - Main tenant records
```sql
-- Connect to saas_admin and run:
SELECT id, company_name, company_domain, subscription_plan, subscription_status
FROM admin_customers;
```

**Key Columns:**
- `id` - UUID primary key
- `company_name` - Customer company name
- `company_domain` - Unique domain identifier
- `clerk_org_id` - Link to Clerk organization
- `subscription_plan` - 'starter', 'pro', 'enterprise'
- `subscription_status` - 'active', 'trial', 'suspended', 'canceled'
- `database_host`, `database_port`, `database_name`, `database_user`, `database_password_encrypted` - Customer DB credentials (encrypted)
- `use_customer_ai_keys` - Whether customer provides own AI keys

#### 2. `admin_feature_modules` - Module definitions
```sql
SELECT module_key, module_name, base_price_monthly, enabled_by_default
FROM admin_feature_modules;
```

**Pre-seeded Modules:**
- `crm_core` - Base CRM (free, always enabled)
- `advanced_pipeline` - Custom stages & automation ($29.99/mo)
- `calendar_integration` - Google Calendar sync ($19.99/mo)
- `ai_assistant` - AI-powered features ($49.99/mo)
- `workflow_automation` - Custom workflows ($39.99/mo)
- `analytics_reporting` - Advanced reporting ($59.99/mo)
- `api_access` - REST API access ($79.99/mo)
- `custom_fields` - Custom field creation ($19.99/mo)
- `bulk_operations` - Bulk import/export ($29.99/mo)
- `compliance_audit` - Audit & compliance ($99.99/mo)

#### 3. `admin_customer_modules` - Feature enablement per customer
```sql
SELECT acm.*, afm.module_name
FROM admin_customer_modules acm
JOIN admin_feature_modules afm ON acm.module_id = afm.id
WHERE acm.customer_id = 'customer-uuid';
```

#### 4. `admin_api_keys` - API key management
```sql
SELECT id, customer_id, key_prefix, name, rate_limit_requests, status
FROM admin_api_keys
WHERE customer_id = 'customer-uuid' AND status = 'active';
```

**Security Note:** Plain API keys are never stored. Only hashes are saved in `key_hash`.

#### 5. `admin_api_usage` - API request tracking
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_requests,
  AVG(response_time_ms) as avg_response_time
FROM admin_api_usage
WHERE customer_id = 'customer-uuid'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

#### 6. `admin_customer_ai_keys` - Customer's own AI keys (encrypted)
```sql
SELECT customer_id, ai_provider, is_active
FROM admin_customer_ai_keys
WHERE customer_id = 'customer-uuid';
```

#### 7. `admin_ai_key_usage` - Token consumption tracking
```sql
SELECT
  ai_provider,
  key_owner,
  DATE(period_start) as date,
  SUM(total_tokens) as tokens_used,
  SUM(estimated_cost_usd) as estimated_cost
FROM admin_ai_key_usage
WHERE customer_id = 'customer-uuid'
GROUP BY ai_provider, key_owner, DATE(period_start)
ORDER BY date DESC;
```

#### 8. `admin_audit_logs` - Complete action history
```sql
SELECT action, resource_type, admin_user_id, created_at
FROM admin_audit_logs
WHERE customer_id = 'customer-uuid'
ORDER BY created_at DESC
LIMIT 50;
```

#### 9. `admin_subscription_invoices` - Billing records
```sql
SELECT invoice_number, invoice_date, total, status
FROM admin_subscription_invoices
WHERE customer_id = 'customer-uuid'
ORDER BY invoice_date DESC;
```

---

## Database Views (Ready to Use)

The Admin DB includes 3 pre-built views for common queries:

### 1. `admin_customer_summary`

Quick overview of all customers with metrics:

```sql
SELECT
  company_name,
  subscription_plan,
  subscription_status,
  enabled_module_count,
  api_key_count,
  ai_key_count
FROM admin_customer_summary
ORDER BY created_at DESC;
```

### 2. `admin_api_usage_summary`

Daily API usage statistics:

```sql
SELECT
  customer_id,
  usage_date,
  total_requests,
  successful_requests,
  failed_requests,
  avg_response_time_ms
FROM admin_api_usage_summary
WHERE usage_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY usage_date DESC;
```

### 3. `admin_token_usage_summary`

Daily token consumption by AI provider:

```sql
SELECT
  customer_id,
  ai_provider,
  key_owner,
  usage_date,
  total_tokens,
  total_estimated_cost
FROM admin_token_usage_summary
WHERE usage_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY usage_date DESC;
```

---

## Common Queries

### Find a Customer

```sql
-- By domain
SELECT * FROM admin_customers WHERE company_domain = 'acme-corp.com';

-- By clerk_org_id
SELECT * FROM admin_customers WHERE clerk_org_id = 'org_123456';

-- All active customers
SELECT * FROM admin_customers
WHERE subscription_status = 'active' AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### View Customer's Enabled Modules

```sql
SELECT
  c.company_name,
  afm.module_name,
  acm.enabled,
  acm.usage_count,
  acm.usage_limit
FROM admin_customers c
JOIN admin_customer_modules acm ON c.id = acm.customer_id
JOIN admin_feature_modules afm ON acm.module_id = afm.id
WHERE c.id = 'customer-uuid'
ORDER BY afm.module_name;
```

### Check Customer's API Usage (Last 30 days)

```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as requests,
  COUNT(CASE WHEN status_code < 400 THEN 1 END) as successful,
  COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed,
  AVG(response_time_ms) as avg_response_ms
FROM admin_api_usage
WHERE customer_id = 'customer-uuid'
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Monitor API Key Usage

```sql
SELECT
  aak.name,
  aak.rate_limit_requests,
  aak.rate_limit_period,
  COUNT(aau.id) as requests_made,
  aak.last_used_at
FROM admin_api_keys aak
LEFT JOIN admin_api_usage aau ON aak.id = aau.api_key_id
WHERE aak.customer_id = 'customer-uuid' AND aak.status = 'active'
GROUP BY aak.id, aak.name, aak.rate_limit_requests, aak.rate_limit_period, aak.last_used_at;
```

### Track AI Token Consumption

```sql
SELECT
  ai_provider,
  key_owner,
  SUM(total_tokens) as total_tokens_used,
  SUM(prompt_tokens) as prompt_tokens,
  SUM(completion_tokens) as completion_tokens,
  SUM(estimated_cost_usd) as estimated_cost
FROM admin_ai_key_usage
WHERE customer_id = 'customer-uuid'
  AND period_start >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY ai_provider, key_owner;
```

### View Audit Log (Recent Changes)

```sql
SELECT
  action,
  resource_type,
  resource_id,
  old_values,
  new_values,
  admin_user_id,
  created_at
FROM admin_audit_logs
WHERE customer_id = 'customer-uuid'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Local Development Access

### From Command Line

```bash
# Connect to Admin DB
psql -h localhost -p 5433 -U admin_user -d saas_admin

# Connect to Customer DB (dev)
psql -h localhost -p 5432 -U dev_user -d saas_dev

# Both databases from Docker
docker compose -f docker-compose.local.yml exec admin-db psql -U admin_user -d saas_admin
docker compose -f docker-compose.local.yml exec db psql -U dev_user -d saas_dev
```

### From Docker Container Shell

```bash
# Access admin-db container
docker compose -f docker-compose.local.yml exec admin-db /bin/sh

# Then inside container
psql -U admin_user -d saas_admin
```

---

## Data Security Notes

### What's Encrypted in Production

The following fields should be encrypted in production:
- `admin_customers.database_password_encrypted` - Customer DB password
- `admin_customer_ai_keys.api_key_encrypted` - Customer's own AI keys

Use **pgcrypto** extension for encryption:

```sql
-- Encrypt on insert
INSERT INTO admin_customer_ai_keys (customer_id, ai_provider, api_key_encrypted)
VALUES (
  'customer-uuid',
  'openai',
  pgp_sym_encrypt('sk-...actual-key...', 'encryption-key')
);

-- Decrypt on select
SELECT
  ai_provider,
  pgp_sym_decrypt(api_key_encrypted::bytea, 'encryption-key') as api_key
FROM admin_customer_ai_keys;
```

### Development vs Production

**Current (Development):**
- Plain text credentials in docker-compose.local.yml
- No encryption for sensitive data
- All credentials visible in environment variables

**Production Setup Needed:**
- Use AWS Secrets Manager or HashiCorp Vault for credentials
- Encrypt sensitive fields with pgcrypto
- Rotate API keys regularly
- Use separate read-only connections for analytics queries
- Enable SSL/TLS for all database connections

---

## Next Steps

1. ✅ **Admin DB Created** - All 9 tables initialized with feature modules
2. ⏳ **Customer Provisioning** - Will create new customer databases via script
3. ⏳ **API Integration** - Connect Express backend to track usage
4. ⏳ **Admin Dashboard** - Build UI for viewing customers and consumption
5. ⏳ **Clerk Integration** - Link customer authentication to admin records

---

## Troubleshooting

### Can't Connect to Admin DB

```bash
# Verify container is running
docker compose -f docker-compose.local.yml ps

# Check logs
docker compose -f docker-compose.local.yml logs admin-db

# Test from Docker
docker compose -f docker-compose.local.yml exec admin-db pg_isready -U admin_user -d saas_admin
```

### Database Lock Issues

```sql
-- Kill blocking queries
SELECT pid, usename, query FROM pg_stat_activity
WHERE datname = 'saas_admin' AND state != 'idle';

-- Then cancel if needed
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = 'saas_admin' AND pid != pg_backend_pid();
```

### Table Not Found

```bash
# Verify schema was initialized
docker compose -f docker-compose.local.yml exec admin-db psql -U admin_user -d saas_admin -c "\dt"

# Manually run init script if needed
docker compose -f docker-compose.local.yml exec admin-db psql -U admin_user -d saas_admin -f /docker-entrypoint-initdb.d/01-admin-init.sql
```

---

## References

- Admin DB Schema: `/scripts/init-admin-db.sql`
- Docker Compose Config: `/docker-compose.local.yml`
- Customer Provisioning: `scripts/provision-customer.sh` (coming soon)
- API Integration: `server.js` (coming soon)

