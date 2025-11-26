# Customer Provisioning System

**Status:** ✅ **PHASE 2 COMPLETE - Customer Provisioning Working**

**Date:** November 26, 2025

---

## Overview

The customer provisioning system is now fully functional! You can provision new customers via API endpoint, and all customer metadata, API keys, and feature modules are automatically created and configured.

---

## What's Implemented

### ✅ Provisioning API Endpoint

**Endpoint:** `POST /api/provision`

**Purpose:** Create a new customer in the Admin database with all associated data

**Request:**
```json
{
  "customerId": "acme-corp",
  "customerName": "ACME Corporation",
  "customerEmail": "admin@acme.com",
  "plan": "pro",
  "modules": ["crm_core", "advanced_pipeline", "ai_assistant"],
  "timezone": "America/New_York"
}
```

**Response:**
```json
{
  "success": true,
  "customerId": "acme-corp",
  "customerUuid": "fec9dcc7-d8eb-4a87-996c-8d4ff042843d",
  "apiKey": {
    "key": "sk_dba251053e92d77ed8cd3a72fb2896114f05d481386e37f7f080bea622cd7796",
    "keyId": "d8c5154d-4957-423e-9162-990d62861003",
    "prefix": "sk_dba251053e92d77ed"
  },
  "enabledModules": ["crm_core", "advanced_pipeline", "ai_assistant"],
  "message": "Customer 'ACME Corporation' provisioned successfully with plan 'pro'"
}
```

### ✅ Provisioning Status Endpoint

**Endpoint:** `GET /api/provision/:customerId`

**Purpose:** Retrieve customer information, enabled modules, and API keys

**Response:**
```json
{
  "success": true,
  "customer": {
    "id": "fec9dcc7-d8eb-4a87-996c-8d4ff042843d",
    "name": "ACME Corporation",
    "domain": "acme-corp",
    "plan": "pro",
    "status": "trial",
    "createdAt": "2025-11-26T10:30:08.519Z"
  },
  "modules": [
    { "name": "AI Assistant", "enabled": true },
    { "name": "Advanced Pipeline", "enabled": true },
    { "name": "CRM Core", "enabled": true }
  ],
  "apiKeys": [
    {
      "id": "d8c5154d-4957-423e-9162-990d62861003",
      "prefix": "sk_dba251053e92d77ed",
      "name": "default",
      "status": "active"
    }
  ]
}
```

### ✅ Validation & Error Handling

**Validates:**
- Customer ID format (lowercase alphanumeric, hyphens, underscores only)
- Customer name (non-empty)
- Email format (valid email)
- Plan selection (starter, pro, enterprise)
- Duplicate customer ID prevention

**Error Responses:**

```bash
# Invalid customer ID
400 {
  "success": false,
  "message": "Invalid customer ID. Must contain only lowercase letters, numbers, hyphens, and underscores"
}

# Customer already exists
409 {
  "success": false,
  "message": "Customer with ID 'acme-corp' already exists"
}

# Server error
500 {
  "success": false,
  "message": "Failed to provision customer",
  "error": "error details"
}
```

### ✅ Automatic Data Creation

When a customer is provisioned, the system automatically creates:

1. **Customer Record** (`admin_customers`)
   - Unique UUID for the customer
   - Company metadata (name, domain, timezone)
   - Subscription plan (starter/pro/enterprise)
   - Trial period (14 days)
   - Clerk organization ID placeholder
   - Database connection info

2. **Feature Module Assignments** (`admin_customer_modules`)
   - Links customer to enabled modules
   - Modules assigned based on plan or custom selection
   - Default modules by plan:
     - **Starter:** CRM Core, Advanced Pipeline
     - **Pro:** CRM Core, Advanced Pipeline, Calendar Integration, Workflow Automation
     - **Enterprise:** All 10 modules

3. **API Key** (`admin_api_keys`)
   - Cryptographically secure key generated
   - SHA256 hashed for storage (plain key only shown once)
   - Default permissions: read:*, write:*, execute:workflows
   - Rate limit: 1000 requests/month
   - Status: active

4. **Audit Log Entry** (`admin_audit_logs`)
   - Records customer creation event
   - Stores creation metadata
   - Tracks provisioning source

---

## Files Created/Modified

### New Files

| File | Purpose | Size |
|------|---------|------|
| `scripts/provision-customer-v2.sh` | Bash script for customer provisioning | 650+ lines |
| `scripts/provision-customer.sh` | Wrapper script for ease of use | 50 lines |
| `scripts/init-customer-db.sql` | Customer database schema | 550+ lines |
| `src/lib/adminDb.js` | Admin DB utilities (JavaScript) | 400+ lines |
| `CUSTOMER_PROVISIONING.md` | This guide | 500+ lines |

### Modified Files

| File | Changes |
|------|---------|
| `server.js` | Added admin DB import, initialization, and provisioning endpoints |
| `docker-compose.local.yml` | (No changes - already set up) |

---

## Testing

### Test with curl

```bash
# Provision a customer
curl -X POST http://localhost:3000/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "acme-corp",
    "customerName": "ACME Corporation",
    "customerEmail": "admin@acme.com",
    "plan": "pro",
    "modules": ["crm_core", "advanced_pipeline", "ai_assistant"],
    "timezone": "America/New_York"
  }'

# Get provisioning status
curl http://localhost:3000/api/provision/acme-corp

# Try duplicated customer ID (should fail)
curl -X POST http://localhost:3000/api/provision \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "acme-corp",
    "customerName": "Another Company",
    "customerEmail": "other@example.com",
    "plan": "starter"
  }'
```

### Verify in Admin Database

```bash
# View created customer
docker compose -f docker-compose.local.yml exec -T admin-db psql -U admin_user -d saas_admin -c \
  "SELECT company_name, subscription_plan, subscription_status FROM admin_customers WHERE company_domain = 'acme-corp';"

# View enabled modules
docker compose -f docker-compose.local.yml exec -T admin-db psql -U admin_user -d saas_admin -c \
  "SELECT afm.module_name FROM admin_customer_modules acm
   JOIN admin_feature_modules afm ON acm.module_id = afm.id
   WHERE acm.customer_id = (SELECT id FROM admin_customers WHERE company_domain = 'acme-corp');"

# View API keys
docker compose -f docker-compose.local.yml exec -T admin-db psql -U admin_user -d saas_admin -c \
  "SELECT key_prefix, rate_limit_requests, status FROM admin_api_keys
   WHERE customer_id = (SELECT id FROM admin_customers WHERE company_domain = 'acme-corp');"
```

---

## Architecture

### Provisioning Flow

```
┌─────────────────────────────────────────┐
│  POST /api/provision                    │
│  (Customer Data)                        │
└──────────────┬──────────────────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Validation Middleware    │
    │ - Format checks          │
    │ - Email validation       │
    │ - Plan verification      │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Check Admin DB           │
    │ - Verify not duplicate   │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Insert admin_customers   │
    │ - Create customer record │
    │ - Generate UUID          │
    │ - Set trial period       │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Assign Modules           │
    │ - Link to feature modules│
    │ - Set enabled status     │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Generate API Key         │
    │ - Create random key      │
    │ - Hash with SHA256       │
    │ - Store in admin_api_keys│
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Log Audit Event          │
    │ - Record provisioning    │
    │ - Store metadata         │
    └──────────┬───────────────┘
               │
               ▼
    ┌──────────────────────────┐
    │ Return Success Response  │
    │ - Customer UUID          │
    │ - API key (once only)    │
    │ - Enabled modules        │
    └──────────────────────────┘
```

### Data Model

```
admin_customers
├── id (UUID)
├── company_name
├── company_domain (unique)
├── subscription_plan (starter/pro/enterprise)
├── subscription_status (trial/active/suspended)
├── billing_email
├── database_host, database_port, database_name, database_user
├── use_customer_ai_keys
├── clerk_org_id
└── trial_started_at, trial_ends_at

  ↓ (references)

admin_customer_modules
├── id (UUID)
├── customer_id
├── module_id
├── enabled
└── usage_count, usage_limit

  ↓ (references)

admin_feature_modules
├── id (UUID)
├── module_key
├── module_name
└── base_price_monthly, base_price_annual

admin_api_keys
├── id (UUID)
├── customer_id
├── key_hash (SHA256)
├── key_prefix (for display)
├── permissions (JSON array)
├── rate_limit_requests, rate_limit_period
└── status (active/revoked/expired)

admin_audit_logs
├── id (UUID)
├── customer_id
├── action ('customer_created')
├── new_values (JSON)
└── created_at
```

---

## API Key Security

### How API Keys Work

1. **Generation:**
   - Random 32-byte key generated with cryptographic randomness
   - Prefixed with `sk_` for identifiability
   - Full key returned **ONLY ONCE** at creation (user must save)

2. **Storage:**
   - Plain key is SHA256 hashed
   - Hash is stored in `admin_api_keys.key_hash`
   - Plain key never stored in database

3. **Validation:**
   - When request comes with API key
   - Backend computes SHA256 hash of provided key
   - Looks up hash in database
   - If found, key is valid

4. **Example:**
   ```
   User provides:  "sk_abc123..."
   Backend hashes: SHA256("sk_abc123...") = "abc123hash..."
   Database has:   key_hash = "abc123hash..."
   Result:         ✓ Valid key
   ```

### Rate Limiting

Each API key has:
- **Rate Limit:** Number of requests per period (default: 1000/month)
- **Period:** minute, hour, day, or month
- **Tracking:** Logged in `admin_api_usage` table

---

## Plan-Based Module Defaults

| Feature | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| CRM Core | ✅ | ✅ | ✅ |
| Advanced Pipeline | ✅ | ✅ | ✅ |
| Calendar Integration | ❌ | ✅ | ✅ |
| AI Assistant | ❌ | ❌ | ✅ |
| Workflow Automation | ❌ | ✅ | ✅ |
| Analytics & Reporting | ❌ | ❌ | ✅ |
| API Access | ❌ | ❌ | ✅ |
| Custom Fields | ❌ | ❌ | ✅ |
| Bulk Operations | ❌ | ❌ | ✅ |
| Compliance & Audit | ❌ | ❌ | ✅ |

---

## Next Steps

### Phase 3: Customer Database Provisioning

The provisioning system currently creates customer metadata in the Admin DB. Next phase will:

1. **Create Customer Database Instance**
   - Provision actual PostgreSQL database for customer
   - Could be:
     - Docker container (local dev)
     - AWS RDS (production)
     - Cloud SQL (Google Cloud)

2. **Initialize Customer Database Schema**
   - Run `init-customer-db.sql` on new database
   - Creates CRM schema (deals, contacts, activities, tasks, etc.)
   - Sets up RLS policies for multi-organization support

3. **Update Admin DB with Connection Info**
   - Store customer DB connection details
   - Encrypt database password
   - Store in `admin_customers` table

4. **Create Clerk Integration**
   - Link Clerk organization to customer
   - Sync admin user to customer system
   - Set up authentication context

### Phase 4: API Middleware

1. **Authentication Middleware**
   - Validate API key or JWT token
   - Load customer context
   - Check module access permissions

2. **Rate Limiting Middleware**
   - Track API usage
   - Enforce rate limits
   - Return 429 when limit exceeded

3. **Module Access Control**
   - Check if module enabled for customer
   - Return 403 if not enabled
   - Log unauthorized attempts

### Phase 5: Admin Dashboard

Build UI for:
- Customer management (CRUD)
- Usage analytics (API calls, token consumption)
- API key management
- Feature module configuration
- Subscription management
- Billing & invoices

---

## Troubleshooting

### API key not working in validation

**Issue:** API key appears valid but validation fails

**Solution:**
- Verify key is being hashed correctly: `SHA256(provided_key)`
- Check database `key_hash` field matches
- Ensure key hasn't been revoked
- Check rate limits haven't been exceeded

### Customer provisioning fails

**Issue:** POST /api/provision returns 500 error

**Solution:**
```bash
# Check Admin DB is running
docker compose -f docker-compose.local.yml ps admin-db

# Check app logs
docker compose -f docker-compose.local.yml logs app | tail -50

# Verify Admin DB connection from app
docker compose -f docker-compose.local.yml logs app | grep "READY"
```

### Duplicate customer ID error

**Issue:** Getting 409 "Customer already exists" when creating new customer

**Solution:**
- Use unique customer ID
- Or soft-delete existing customer first:
  ```sql
  UPDATE admin_customers SET deleted_at = NOW() WHERE company_domain = 'acme-corp';
  ```

---

## Summary Stats

### Files
- **650+ lines** of provisioning bash script
- **550+ lines** of customer DB schema
- **400+ lines** of Admin DB utilities
- **200+ lines** of Express endpoints
- **500+ lines** of documentation

### Database Tables Used
- `admin_customers` - Customer metadata
- `admin_feature_modules` - Feature definitions
- `admin_customer_modules` - Module enablement
- `admin_api_keys` - API key management
- `admin_api_usage` - Usage tracking
- `admin_audit_logs` - Audit trail

### Features Working
✅ Customer provisioning via API
✅ Automatic API key generation & hashing
✅ Feature module assignment
✅ Plan-based default modules
✅ Input validation & error handling
✅ Audit logging
✅ Customer status retrieval
✅ Module list retrieval
✅ API key list retrieval

---

**Last Updated:** November 26, 2025
**Status:** ✅ Phase 2 Complete - Provisioning API Working
**Next Phase:** Phase 3 - Customer Database Creation
**Est. Completion:** After customer DB provisioning implementation

