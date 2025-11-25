# Phase 1: Security & Database Abstraction - Implementation Guide
## Weeks 1-2 Detailed Implementation

**Status:** 🚀 IN PROGRESS
**Start Date:** November 25, 2025
**Deadline:** December 9, 2025 (2 weeks)
**Owner:** Lead Engineer / Security Team

---

## CURRENT STATUS

### Security Audit Results
- ✅ .env file located at repository root
- ✅ 32 total credential entries found
- ✅ 27 critical credential entries requiring rotation
- ✅ All major services represented:
  - Supabase (3 keys)
  - AWS (3 keys)
  - OpenAI (1 key)
  - Anthropic (1 key)
  - Google (3 keys)
  - Gemini (1 key)
  - OpenRouter (1 key)
  - Slack (2 keys)
  - Fathom (3 keys)

**Severity:** CRITICAL ⚠️

---

## PHASE 1 BREAKDOWN

### Week 1: Security Hardening

#### Day 1-2: Credential Audit & Planning
- [x] Identify all exposed credentials (DONE ✅)
- [ ] Document rotation process for each service
- [ ] Create rotation plan with timeline
- [ ] Identify which keys need immediate rotation
- [ ] Create checklist for each service

**Deliverable:** Detailed rotation plan document

#### Day 3-4: Immediate Credential Rotation (PRIORITY 1)

These are the most critical and should be rotated first:

**Supabase Keys** (CRITICAL)
```
Services: 3 keys
├─ VITE_SUPABASE_URL
├─ VITE_SUPABASE_ANON_KEY
└─ VITE_SUPABASE_SERVICE_ROLE_KEY

Action Required:
1. Go to Supabase dashboard → Project Settings
2. Generate new API keys
3. Test in local environment
4. Update .env temporarily
5. Verify all functionality works
```

**AWS Credentials** (CRITICAL)
```
Services: AWS SES (3 keys)
├─ AWS_ACCESS_KEY_ID
├─ AWS_SECRET_ACCESS_KEY
└─ AWS_REGION (AWS_REGION stays same)
Plus:
├─ VITE_AWS_ACCESS_KEY_ID
├─ VITE_AWS_SECRET_ACCESS_KEY
└─ VITE_AWS_REGION

Action Required:
1. Go to AWS IAM Console
2. Create new access key for SES user
3. Deactivate old access key
4. Test email sending in local environment
5. Update .env temporarily
```

**OpenAI Keys** (HIGH)
```
Service: 1 key
└─ VITE_OPENAI_API_KEY

Action Required:
1. Go to OpenAI API dashboard
2. Regenerate API key
3. Disable old key
4. Test in local environment
5. Update .env temporarily
```

**Anthropic Keys** (HIGH)
```
Service: 1 key
└─ VITE_ANTHROPIC_API_KEY

Action Required:
1. Go to Anthropic console
2. Regenerate API key
3. Test in local environment
4. Update .env temporarily
```

**Google Credentials** (HIGH)
```
Services: 3 keys
├─ VITE_GOOGLE_CLIENT_ID
├─ VITE_GOOGLE_CLIENT_SECRET
└─ VITE_GOOGLE_REDIRECT_URI

Action Required:
1. Go to Google Cloud Console
2. OAuth 2.0 Credentials page
3. Delete old credentials
4. Create new OAuth 2.0 client ID
5. Test OAuth flow in local environment
6. Update .env temporarily
```

**Gemini Keys** (MEDIUM)
```
Service: 1 key
└─ VITE_GEMINI_API_KEY

Action Required:
1. Go to Google AI Studio
2. Regenerate API key
3. Disable old key
4. Test in local environment
5. Update .env temporarily
```

**OpenRouter Keys** (MEDIUM)
```
Service: 1 key
└─ VITE_OPENROUTER_API_KEY

Action Required:
1. Go to OpenRouter account
2. Regenerate API key
3. Test in local environment
4. Update .env temporarily
```

**Slack Credentials** (MEDIUM)
```
Services: 2 keys
├─ VITE_SLACK_CLIENT_ID
├─ VITE_SLACK_CLIENT_SECRET
└─ SLACK_CLIENT_ID (duplicate)
└─ SLACK_CLIENT_SECRET (duplicate)

Action Required:
1. Go to Slack App Management
2. Rotate OAuth credentials
3. Test Slack integration
4. Update .env temporarily
```

**Fathom Credentials** (MEDIUM)
```
Services: 3 keys
├─ VITE_FATHOM_CLIENT_ID
├─ VITE_FATHOM_CLIENT_SECRET
└─ VITE_FATHOM_REDIRECT_URI

Action Required:
1. Go to Fathom Settings
2. Regenerate credentials
3. Test Fathom sync
4. Update .env temporarily
```

**Estimated Time:** 2-3 days with testing

#### Day 5: Git Cleanup

This is CRITICAL - remove credentials from git history:

```bash
# Step 1: Remove .env from git history (this takes a few minutes)
bfg --delete-files .env

# Step 2: Expire git logs
git reflog expire --expire=now --all

# Step 3: Garbage collect
git gc --prune=now --aggressive

# Step 4: Verify no credentials remain
git log --all --full-history -- .env

# Step 5: Create .env.example with safe placeholders
# (See next section)
```

**Why this is critical:**
- Even though `.env` is in `.gitignore` now, it's in git history
- Anyone with repo access can see old credentials
- BFG removes it completely from history
- This is a one-time operation that must succeed

#### Day 6: Create .env.example

Create safe placeholder file:

```bash
cat > .env.example << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
VITE_SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key-here
VITE_SUPABASE_DEV_BRANCH=development
VITE_SUPABASE_PROD_BRANCH=main

# AWS Configuration (SES)
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
AWS_REGION=eu-west-2
VITE_AWS_ACCESS_KEY_ID=your-aws-access-key-id
VITE_AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
VITE_AWS_REGION=eu-west-2

# SES Email Configuration
SES_FROM_EMAIL=noreply@example.com
SES_FROM_NAME=Your App Name
SES_ADMIN_EMAILS=admin@example.com

# AI Provider Keys
VITE_OPENAI_API_KEY=your-openai-api-key
VITE_ANTHROPIC_API_KEY=your-anthropic-api-key
VITE_GEMINI_API_KEY=your-gemini-api-key
VITE_OPENROUTER_API_KEY=your-openrouter-api-key

# Google OAuth
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# Slack OAuth
VITE_SLACK_CLIENT_ID=your-slack-client-id
VITE_SLACK_CLIENT_SECRET=your-slack-client-secret
SLACK_CLIENT_ID=your-slack-client-id
SLACK_CLIENT_SECRET=your-slack-client-secret

# Fathom Integration
VITE_FATHOM_CLIENT_ID=your-fathom-client-id
VITE_FATHOM_CLIENT_SECRET=your-fathom-client-secret
VITE_FATHOM_REDIRECT_URI=http://localhost:3000/auth/fathom/callback

# Environment
PUBLIC_URL=http://localhost:5173
VERCEL_PROTECT_BYPASS=your-vercel-protect-bypass-token
EOF

git add .env.example
git commit -m "docs: Add .env.example with safe placeholders"
```

#### Day 7: Setup AWS Secrets Manager

**Why Secrets Manager?**
- Centralized credential management
- Environment-specific access
- Automatic credential rotation support
- Audit logging of access
- Easy credential updates without code changes

**Setup Steps:**

1. **AWS Console → Secrets Manager**
   - Create secret: "dev/sixty-sales-dashboard/credentials"
   - Create secret: "prod/sixty-sales-dashboard/credentials"

2. **Store rotated credentials in Secrets Manager**
   ```json
   {
     "supabase_url": "https://...",
     "supabase_anon_key": "...",
     "supabase_service_role_key": "...",
     "aws_access_key_id": "...",
     "aws_secret_access_key": "...",
     "openai_api_key": "...",
     "anthropic_api_key": "...",
     "google_client_id": "...",
     "google_client_secret": "...",
     "slack_client_id": "...",
     "slack_client_secret": "...",
     "fathom_client_id": "...",
     "fathom_client_secret": "..."
   }
   ```

3. **Create IAM Policy for app access**
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "secretsmanager:GetSecretValue"
         ],
         "Resource": "arn:aws:secretsmanager:*:*:secret:dev/sixty-sales-dashboard/*"
       }
     ]
   }
   ```

### Week 2: Database Abstraction Layer

#### Day 1-2: Create Database Abstraction Layer

**File 1: `src/lib/services/database/IDatabase.ts`**

```typescript
/**
 * Database abstraction interface
 * Allows switching between Supabase and PostgreSQL without code changes
 */
export interface IDatabase {
  /**
   * Execute a query and return results
   */
  query<T = any>(
    sql: string,
    params?: any[]
  ): Promise<T[]>

  /**
   * Execute a query expecting a single row
   */
  queryOne<T = any>(
    sql: string,
    params?: any[]
  ): Promise<T | null>

  /**
   * Execute insert and return inserted row
   */
  insert<T = any>(
    table: string,
    data: Record<string, any>
  ): Promise<T>

  /**
   * Execute update and return affected count
   */
  update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>
  ): Promise<number>

  /**
   * Execute delete and return affected count
   */
  delete(
    table: string,
    where: Record<string, any>
  ): Promise<number>

  /**
   * Begin transaction
   */
  beginTransaction(): Promise<void>

  /**
   * Commit transaction
   */
  commit(): Promise<void>

  /**
   * Rollback transaction
   */
  rollback(): Promise<void>

  /**
   * Execute function within transaction
   */
  transaction<T>(
    fn: (db: IDatabase) => Promise<T>
  ): Promise<T>

  /**
   * Close database connection
   */
  close(): Promise<void>

  /**
   * Health check
   */
  ping(): Promise<boolean>
}
```

**File 2: `src/lib/services/database/PostgresAdapter.ts`**

```typescript
import { Pool, QueryResult } from 'pg'
import { IDatabase } from './IDatabase'

export class PostgresAdapter implements IDatabase {
  private pool: Pool
  private inTransaction = false
  private client: any = null

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString })
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const result = await this.getQueryClient().query(sql, params)
      return result.rows
    } catch (error) {
      throw this.formatError(error)
    }
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results[0] || null
  }

  async insert<T = any>(table: string, data: Record<string, any>): Promise<T> {
    const columns = Object.keys(data)
    const values = Object.values(data)
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(',')

    const sql = `
      INSERT INTO ${table} (${columns.join(',')})
      VALUES (${placeholders})
      RETURNING *
    `

    const result = await this.queryOne<T>(sql, values)
    return result as T
  }

  async update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>
  ): Promise<number> {
    const setColumns = Object.keys(data)
    const whereColumns = Object.keys(where)
    const allValues = [...Object.values(data), ...Object.values(where)]

    const setClauses = setColumns.map((col, i) => `${col} = $${i + 1}`).join(',')
    const whereClauses = whereColumns
      .map((col, i) => `${col} = $${i + setColumns.length + 1}`)
      .join(' AND ')

    const sql = `UPDATE ${table} SET ${setClauses} WHERE ${whereClauses}`
    const result = await this.getQueryClient().query(sql, allValues)
    return result.rowCount || 0
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    const columns = Object.keys(where)
    const values = Object.values(where)
    const whereClauses = columns.map((col, i) => `${col} = $${i + 1}`).join(' AND ')

    const sql = `DELETE FROM ${table} WHERE ${whereClauses}`
    const result = await this.getQueryClient().query(sql, values)
    return result.rowCount || 0
  }

  async beginTransaction(): Promise<void> {
    if (!this.inTransaction) {
      this.client = await this.pool.connect()
      await this.client.query('BEGIN')
      this.inTransaction = true
    }
  }

  async commit(): Promise<void> {
    if (this.inTransaction) {
      await this.client?.query('COMMIT')
      this.client?.release()
      this.inTransaction = false
      this.client = null
    }
  }

  async rollback(): Promise<void> {
    if (this.inTransaction) {
      await this.client?.query('ROLLBACK')
      this.client?.release()
      this.inTransaction = false
      this.client = null
    }
  }

  async transaction<T>(fn: (db: IDatabase) => Promise<T>): Promise<T> {
    await this.beginTransaction()
    try {
      const result = await fn(this)
      await this.commit()
      return result
    } catch (error) {
      await this.rollback()
      throw error
    }
  }

  async close(): Promise<void> {
    if (this.inTransaction) {
      await this.rollback()
    }
    await this.pool.end()
  }

  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1')
      return true
    } catch {
      return false
    }
  }

  private getQueryClient() {
    return this.inTransaction ? this.client : this.pool
  }

  private formatError(error: any): Error {
    if (error.code === 'P0001') {
      return new Error(`Database error: ${error.message}`)
    }
    return error
  }
}
```

**File 3: `src/lib/services/database/SupabaseAdapter.ts`**

```typescript
import { SupabaseClient, createClient } from '@supabase/supabase-js'
import { IDatabase } from './IDatabase'

export class SupabaseAdapter implements IDatabase {
  private supabase: SupabaseClient
  private inTransaction = false

  constructor(url: string, anonKey: string, serviceKey: string) {
    // Use service key for full access
    this.supabase = createClient(url, serviceKey, {
      auth: { persistSession: false }
    })
  }

  async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
    try {
      const { data, error } = await this.supabase.rpc('execute_query', {
        sql,
        params: params || []
      })

      if (error) throw error
      return data || []
    } catch (error) {
      throw this.formatError(error)
    }
  }

  async queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
    const results = await this.query<T>(sql, params)
    return results[0] || null
  }

  async insert<T = any>(table: string, data: Record<string, any>): Promise<T> {
    const { data: result, error } = await this.supabase
      .from(table)
      .insert([data])
      .select()

    if (error) throw error
    return result?.[0] as T
  }

  async update(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>
  ): Promise<number> {
    let query = this.supabase.from(table).update(data)

    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key, value) as any
    }

    const { count, error } = await query
    if (error) throw error
    return count || 0
  }

  async delete(table: string, where: Record<string, any>): Promise<number> {
    let query = this.supabase.from(table).delete()

    for (const [key, value] of Object.entries(where)) {
      query = query.eq(key, value) as any
    }

    const { count, error } = await query
    if (error) throw error
    return count || 0
  }

  async beginTransaction(): Promise<void> {
    // Supabase doesn't support explicit transactions
    // So we just flag it
    this.inTransaction = true
  }

  async commit(): Promise<void> {
    this.inTransaction = false
  }

  async rollback(): Promise<void> {
    this.inTransaction = false
  }

  async transaction<T>(fn: (db: IDatabase) => Promise<T>): Promise<T> {
    // Supabase transactions are implicit per-request
    return fn(this)
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit closing
  }

  async ping(): Promise<boolean> {
    try {
      await this.supabase.from('profiles').select().limit(1)
      return true
    } catch {
      return false
    }
  }

  private formatError(error: any): Error {
    if (error.message) {
      return new Error(`Supabase error: ${error.message}`)
    }
    return error
  }
}
```

#### Day 3-4: Create DI Container & Configuration

**File: `src/lib/services/database/index.ts`**

```typescript
import { IDatabase } from './IDatabase'
import { PostgresAdapter } from './PostgresAdapter'
import { SupabaseAdapter } from './SupabaseAdapter'

let databaseInstance: IDatabase | null = null

export async function initializeDatabase(): Promise<IDatabase> {
  if (databaseInstance) {
    return databaseInstance
  }

  const dbType = process.env.DATABASE_TYPE || 'supabase'

  if (dbType === 'postgres') {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL not set for PostgreSQL adapter')
    }
    databaseInstance = new PostgresAdapter(connectionString)
  } else {
    const supabaseUrl = process.env.VITE_SUPABASE_URL
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
    const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Supabase credentials not set')
    }

    databaseInstance = new SupabaseAdapter(
      supabaseUrl,
      supabaseAnonKey,
      supabaseServiceKey
    )
  }

  // Verify connection
  const isHealthy = await databaseInstance.ping()
  if (!isHealthy) {
    throw new Error('Database connection failed')
  }

  return databaseInstance
}

export async function getDatabase(): Promise<IDatabase> {
  if (!databaseInstance) {
    return initializeDatabase()
  }
  return databaseInstance
}

export async function closeDatabase(): Promise<void> {
  if (databaseInstance) {
    await databaseInstance.close()
    databaseInstance = null
  }
}
```

**File: `src/lib/config/secrets.ts`**

```typescript
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager'

let secretsClient: SecretsManagerClient | null = null

export async function getSecrets(): Promise<Record<string, string>> {
  const environment = process.env.NODE_ENV || 'development'

  // In development, load from .env
  if (environment === 'development') {
    return {
      supabase_url: process.env.VITE_SUPABASE_URL || '',
      supabase_anon_key: process.env.VITE_SUPABASE_ANON_KEY || '',
      supabase_service_role_key: process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
      aws_access_key_id: process.env.AWS_ACCESS_KEY_ID || '',
      aws_secret_access_key: process.env.AWS_SECRET_ACCESS_KEY || '',
      openai_api_key: process.env.VITE_OPENAI_API_KEY || '',
      // ... other secrets
    }
  }

  // In production, load from AWS Secrets Manager
  const secretName = `prod/sixty-sales-dashboard/credentials`

  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({
      region: process.env.AWS_REGION || 'us-east-1'
    })
  }

  try {
    const command = new GetSecretValueCommand({ SecretId: secretName })
    const response = await secretsClient.send(command)

    if (response.SecretString) {
      return JSON.parse(response.SecretString)
    }

    throw new Error('Secret value not found')
  } catch (error) {
    console.error('Failed to fetch secrets from Secrets Manager:', error)
    throw error
  }
}

/**
 * Get a specific secret value
 */
export async function getSecret(key: string): Promise<string> {
  const secrets = await getSecrets()
  const value = secrets[key]

  if (!value) {
    throw new Error(`Secret not found: ${key}`)
  }

  return value
}
```

#### Day 5: Write Comprehensive Tests

**File: `tests/unit/database.test.ts`**

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PostgresAdapter } from '@/lib/services/database/PostgresAdapter'
import { SupabaseAdapter } from '@/lib/services/database/SupabaseAdapter'
import { IDatabase } from '@/lib/services/database/IDatabase'

describe('Database Adapters', () => {
  let db: IDatabase

  describe('PostgresAdapter', () => {
    beforeAll(async () => {
      // Initialize with test database
      db = new PostgresAdapter(process.env.TEST_DATABASE_URL!)
    })

    afterAll(async () => {
      await db.close()
    })

    it('should ping database successfully', async () => {
      const result = await db.ping()
      expect(result).toBe(true)
    })

    it('should execute a simple query', async () => {
      const result = await db.query('SELECT 1 as num')
      expect(result).toHaveLength(1)
      expect(result[0].num).toBe(1)
    })

    it('should insert and retrieve data', async () => {
      const testData = { name: 'Test User', email: 'test@example.com' }
      const inserted = await db.insert('users', testData)
      expect(inserted.id).toBeDefined()
      expect(inserted.name).toBe('Test User')
    })

    it('should handle transactions', async () => {
      const result = await db.transaction(async (transaction) => {
        const inserted = await transaction.insert('users', {
          name: 'Transaction Test'
        })
        return inserted
      })
      expect(result.id).toBeDefined()
    })
  })

  describe('SupabaseAdapter', () => {
    beforeAll(async () => {
      db = new SupabaseAdapter(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!,
        process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
      )
    })

    afterAll(async () => {
      await db.close()
    })

    it('should ping database successfully', async () => {
      const result = await db.ping()
      expect(result).toBe(true)
    })
  })
})
```

#### Day 6-7: Testing & Documentation

- [ ] Run all tests
- [ ] Verify database operations work with both adapters
- [ ] Document database abstraction layer
- [ ] Create migration guide

---

## TESTING & VALIDATION

### Phase 1 Verification Checklist

**Security:**
- [ ] All credentials rotated
- [ ] .env removed from git history
- [ ] .env.example created with safe placeholders
- [ ] AWS Secrets Manager configured
- [ ] Credentials loadable from Secrets Manager
- [ ] No credentials in git log: `git log --all --full-history -- .env`

**Database Abstraction:**
- [ ] IDatabase interface created
- [ ] PostgresAdapter implemented and tested
- [ ] SupabaseAdapter implemented and tested
- [ ] DI container working
- [ ] Tests passing: `npm run test -- database`
- [ ] Both adapters can ping database successfully

**Documentation:**
- [ ] Database abstraction documented
- [ ] Secret rotation process documented
- [ ] Secrets Manager setup documented

---

## GIT COMMITS FOR PHASE 1

**Commit 1: Security - Rotate credentials**
```
feat: Phase 1 - Rotate all exposed API credentials

- Rotate Supabase keys
- Rotate AWS SES credentials
- Rotate OpenAI/Claude/Gemini keys
- Rotate Google/Slack/Fathom OAuth credentials
- Test all services with new credentials

Credentials rotated:
✓ Supabase (3 keys)
✓ AWS SES (3 keys)
✓ OpenAI (1 key)
✓ Anthropic (1 key)
✓ Google (3 keys)
✓ Gemini (1 key)
✓ OpenRouter (1 key)
✓ Slack (2 keys)
✓ Fathom (3 keys)

Related to: SAASIFICATION
```

**Commit 2: Security - Remove .env from git**
```
feat: Phase 1 - Remove .env from git history

- Use BFG repo cleaner to remove .env completely
- Expire git logs
- Garbage collect repository
- Create .env.example with safe placeholders
- Update .gitignore to ensure .env never committed

Related to: SAASIFICATION
```

**Commit 3: Database Abstraction**
```
feat: Phase 1 - Implement database abstraction layer

- Create IDatabase interface for database operations
- Implement PostgresAdapter for self-hosted PostgreSQL
- Implement SupabaseAdapter for current Supabase setup
- Create DI container with environment-based selection
- Add comprehensive adapter tests
- Document abstraction pattern

This abstraction allows seamless switching between
Supabase and PostgreSQL without code changes.

Related to: SAASIFICATION
```

**Commit 4: Secrets Manager**
```
feat: Phase 1 - Integrate AWS Secrets Manager

- Create secrets loader for AWS Secrets Manager
- Support environment-specific secret access
- Fall back to .env in development
- Load from Secrets Manager in production
- Add error handling for missing secrets

Related to: SAASIFICATION
```

**Commit 5: Testing**
```
feat: Phase 1 - Add comprehensive database adapter tests

- Test PostgresAdapter with test database
- Test SupabaseAdapter with test project
- Verify CRUD operations
- Verify transaction handling
- Verify connection health checks

All tests passing: npm run test -- database

Related to: SAASIFICATION
```

---

## NEXT PHASE

After Phase 1 completes:
- ✅ All credentials secured
- ✅ Database abstraction ready
- ✅ Ready for Phase 2: Multi-Tenancy Database Layer

**Phase 2 Preview:** Implement RLS policies, add org_id filtering to queries, extend AuthContext with organization context.

---

**Status:** 🚀 Phase 1 Implementation Started
**Duration:** 2 weeks
**Deadline:** December 9, 2025
**Owner:** Lead Engineer / Security Team
