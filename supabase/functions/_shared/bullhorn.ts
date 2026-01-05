/**
 * Bullhorn API Client
 *
 * API client for Bullhorn REST API with OAuth2 authentication,
 * rate limiting, and automatic retry logic.
 *
 * Bullhorn API specifics:
 * - Uses OAuth2 with additional BhRestToken exchange
 * - REST URL is dynamic per user/corp (provided after auth)
 * - Rate limit: 100 concurrent API calls per user
 * - Swimlane-based URL structure
 */

// =============================================================================
// Types & Errors
// =============================================================================

export type BullhornApiError = {
  status: number
  message: string
  retryAfterMs?: number
  responseBody?: unknown
}

export class BullhornError extends Error {
  status: number
  retryAfterMs?: number
  responseBody?: unknown

  constructor(args: BullhornApiError) {
    super(args.message)
    this.name = 'BullhornError'
    this.status = args.status
    this.retryAfterMs = args.retryAfterMs
    this.responseBody = args.responseBody
  }
}

// =============================================================================
// Entity Types
// =============================================================================

export interface BullhornCandidate {
  id: number
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  mobile?: string
  status?: string
  owner?: { id: number; firstName?: string; lastName?: string }
  dateAdded?: number
  dateLastModified?: number
  [key: string]: unknown
}

export interface BullhornClientContact {
  id: number
  firstName?: string
  lastName?: string
  name?: string
  email?: string
  phone?: string
  mobile?: string
  status?: string
  clientCorporation?: { id: number; name?: string }
  owner?: { id: number; firstName?: string; lastName?: string }
  dateAdded?: number
  dateLastModified?: number
  [key: string]: unknown
}

export interface BullhornJobOrder {
  id: number
  title?: string
  status?: string
  employmentType?: string
  clientContact?: { id: number; firstName?: string; lastName?: string }
  clientCorporation?: { id: number; name?: string }
  owner?: { id: number; firstName?: string; lastName?: string }
  dateAdded?: number
  dateClosed?: number
  [key: string]: unknown
}

export interface BullhornNote {
  id?: number
  action?: string
  comments?: string
  personReference?: { id: number; _subtype?: string }
  jobOrder?: { id: number }
  dateAdded?: number
  [key: string]: unknown
}

export interface BullhornTask {
  id?: number
  subject?: string
  description?: string
  type?: string
  status?: string
  dateBegin?: number
  dateEnd?: number
  isCompleted?: boolean
  owner?: { id: number }
  candidate?: { id: number }
  clientContact?: { id: number }
  jobOrder?: { id: number }
  [key: string]: unknown
}

export interface BullhornPlacement {
  id: number
  status?: string
  dateBegin?: number
  dateEnd?: number
  salary?: number
  payRate?: number
  clientBillRate?: number
  candidate?: { id: number; firstName?: string; lastName?: string }
  jobOrder?: { id: number; title?: string }
  [key: string]: unknown
}

export interface BullhornSearchResponse<T> {
  total: number
  start: number
  count: number
  data: T[]
}

export interface BullhornEntityResponse<T> {
  data: T
}

export interface BullhornCreateResponse {
  changedEntityType: string
  changedEntityId: number
  changeType: string
  data?: unknown
}

export interface BullhornUpdateResponse {
  changedEntityType: string
  changedEntityId: number
  changeType: string
  data?: unknown
}

// =============================================================================
// Auth Types
// =============================================================================

export interface BullhornAuthCodeResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

export interface BullhornRestTokenResponse {
  BhRestToken: string
  restUrl: string
}

export interface BullhornRefreshResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
}

// =============================================================================
// Helper Functions
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Parse Retry-After header value to milliseconds
 */
export function parseRetryAfterMs(headers: Headers): number | undefined {
  const ra = headers.get('retry-after')
  if (!ra) return undefined

  // Try parsing as seconds
  const n = Number(ra)
  if (Number.isFinite(n) && n > 0) return Math.floor(n * 1000)

  // Try parsing as HTTP date
  const t = Date.parse(ra)
  if (Number.isFinite(t)) {
    const ms = t - Date.now()
    return ms > 0 ? ms : undefined
  }

  return undefined
}

/**
 * Check if HTTP status code is retryable
 */
export function isRetryableError(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600)
}

/**
 * Build Bullhorn API URL with query parameters
 */
export function buildBullhornUrl(
  restUrl: string,
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>
): string {
  // Ensure restUrl ends with /
  const baseUrl = restUrl.endsWith('/') ? restUrl : `${restUrl}/`
  // Ensure path doesn't start with /
  const cleanPath = path.startsWith('/') ? path.slice(1) : path

  const url = new URL(baseUrl + cleanPath)

  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue
      url.searchParams.set(k, String(v))
    }
  }

  return url.toString()
}

/**
 * Check if token is expired (with buffer)
 * @param expiresAt - Timestamp when token expires (ms since epoch)
 * @param bufferMs - Buffer time before expiry to consider expired (default 5 minutes)
 */
export function isTokenExpired(expiresAt: number, bufferMs = 300000): boolean {
  return Date.now() >= expiresAt - bufferMs
}

// =============================================================================
// Auth Functions
// =============================================================================

const BULLHORN_AUTH_URL = 'https://auth.bullhornstaffing.com/oauth'
const BULLHORN_REST_LOGIN_URL = 'https://rest.bullhornstaffing.com/rest-services/login'

/**
 * Exchange authorization code for access token
 */
export async function exchangeAuthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<BullhornAuthCodeResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  })

  const resp = await fetch(`${BULLHORN_AUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const text = await resp.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text ? { message: text } : null
  }

  if (!resp.ok) {
    const msg =
      (json as Record<string, unknown>)?.error_description ||
      (json as Record<string, unknown>)?.error ||
      `Bullhorn auth error (${resp.status})`
    throw new BullhornError({
      status: resp.status,
      message: String(msg),
      responseBody: json,
    })
  }

  return json as BullhornAuthCodeResponse
}

/**
 * Exchange access token for BhRestToken and REST URL
 * This is required after obtaining an access token to make API calls
 */
export async function exchangeAccessTokenForRestToken(
  accessToken: string,
  version = '*'
): Promise<BullhornRestTokenResponse> {
  const params = new URLSearchParams({
    version,
    access_token: accessToken,
  })

  const resp = await fetch(`${BULLHORN_REST_LOGIN_URL}?${params.toString()}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  const text = await resp.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text ? { message: text } : null
  }

  if (!resp.ok) {
    const msg =
      (json as Record<string, unknown>)?.errorMessage ||
      (json as Record<string, unknown>)?.message ||
      `Bullhorn REST login error (${resp.status})`
    throw new BullhornError({
      status: resp.status,
      message: String(msg),
      responseBody: json,
    })
  }

  return json as BullhornRestTokenResponse
}

/**
 * Refresh expired tokens using refresh token
 */
export async function refreshTokens(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<BullhornRefreshResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  })

  const resp = await fetch(`${BULLHORN_AUTH_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  })

  const text = await resp.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text ? { message: text } : null
  }

  if (!resp.ok) {
    const msg =
      (json as Record<string, unknown>)?.error_description ||
      (json as Record<string, unknown>)?.error ||
      `Bullhorn refresh error (${resp.status})`
    throw new BullhornError({
      status: resp.status,
      message: String(msg),
      responseBody: json,
    })
  }

  return json as BullhornRefreshResponse
}

// =============================================================================
// Bullhorn Client
// =============================================================================

export class BullhornClient {
  private bhRestToken: string
  private restUrl: string
  private maxRetries: number
  private baseDelayMs: number
  private maxDelayMs: number

  // Concurrency tracking (Bullhorn limit: 100 concurrent calls)
  private static concurrentCalls = 0
  private static readonly MAX_CONCURRENT_CALLS = 100
  private static concurrencyQueue: Array<() => void> = []

  constructor(args: {
    bhRestToken: string
    restUrl: string
    maxRetries?: number
    baseDelayMs?: number
    maxDelayMs?: number
  }) {
    this.bhRestToken = args.bhRestToken
    this.restUrl = args.restUrl
    this.maxRetries = args.maxRetries ?? 3
    this.baseDelayMs = args.baseDelayMs ?? 1000
    this.maxDelayMs = args.maxDelayMs ?? 30000
  }

  /**
   * Wait for concurrency slot to become available
   */
  private async acquireConcurrencySlot(): Promise<void> {
    if (BullhornClient.concurrentCalls < BullhornClient.MAX_CONCURRENT_CALLS) {
      BullhornClient.concurrentCalls++
      return
    }

    // Wait for a slot to become available
    return new Promise((resolve) => {
      BullhornClient.concurrencyQueue.push(() => {
        BullhornClient.concurrentCalls++
        resolve()
      })
    })
  }

  /**
   * Release concurrency slot
   */
  private releaseConcurrencySlot(): void {
    BullhornClient.concurrentCalls--
    const next = BullhornClient.concurrencyQueue.shift()
    if (next) next()
  }

  /**
   * Make a request to the Bullhorn API
   */
  async request<T>(args: {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE'
    path: string
    query?: Record<string, string | number | boolean | undefined | null>
    body?: unknown
  }): Promise<T> {
    await this.acquireConcurrencySlot()

    try {
      let attempt = 0
      let lastError: unknown = null

      while (attempt <= this.maxRetries) {
        try {
          const url = buildBullhornUrl(this.restUrl, args.path, {
            ...args.query,
            BhRestToken: this.bhRestToken,
          })

          const resp = await fetch(url, {
            method: args.method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: args.body !== undefined ? JSON.stringify(args.body) : undefined,
          })

          const retryAfterMs = parseRetryAfterMs(resp.headers)

          if (resp.status === 204) return undefined as T

          const text = await resp.text()
          let json: unknown = null
          try {
            json = text ? JSON.parse(text) : null
          } catch {
            json = text ? { message: text } : null
          }

          if (!resp.ok) {
            const jsonObj = json as Record<string, unknown> | null
            const msg =
              jsonObj?.errorMessage ||
              jsonObj?.message ||
              jsonObj?.error ||
              `Bullhorn API error (${resp.status})`
            throw new BullhornError({
              status: resp.status,
              message: String(msg),
              retryAfterMs,
              responseBody: json,
            })
          }

          return json as T
        } catch (err: unknown) {
          lastError = err
          const status = (err as BullhornError)?.status

          // Check if retryable
          if (typeof status === 'number' && isRetryableError(status) && attempt < this.maxRetries) {
            const errObj = err as BullhornError
            const exp = this.baseDelayMs * Math.pow(2, attempt)
            const waitMs = Math.min(this.maxDelayMs, errObj?.retryAfterMs ?? exp)
            await sleep(waitMs)
            attempt++
            continue
          }

          throw err
        }
      }

      throw lastError || new Error('Bullhorn request failed')
    } finally {
      this.releaseConcurrencySlot()
    }
  }

  // ===========================================================================
  // Candidate Methods
  // ===========================================================================

  /**
   * Get a candidate by ID
   */
  async getCandidate(
    id: number,
    fields = 'id,firstName,lastName,name,email,phone,mobile,status,owner,dateAdded,dateLastModified'
  ): Promise<BullhornCandidate> {
    const response = await this.request<BullhornEntityResponse<BullhornCandidate>>({
      method: 'GET',
      path: `entity/Candidate/${id}`,
      query: { fields },
    })
    return response.data
  }

  /**
   * Search candidates using Lucene query syntax
   */
  async searchCandidates(
    query: string,
    fields = 'id,firstName,lastName,name,email,phone,mobile,status,owner,dateAdded,dateLastModified',
    count = 20,
    start = 0
  ): Promise<BullhornSearchResponse<BullhornCandidate>> {
    return this.request<BullhornSearchResponse<BullhornCandidate>>({
      method: 'GET',
      path: 'search/Candidate',
      query: { query, fields, count, start },
    })
  }

  // ===========================================================================
  // ClientContact Methods
  // ===========================================================================

  /**
   * Get a client contact by ID
   */
  async getClientContact(
    id: number,
    fields = 'id,firstName,lastName,name,email,phone,mobile,status,clientCorporation,owner,dateAdded,dateLastModified'
  ): Promise<BullhornClientContact> {
    const response = await this.request<BullhornEntityResponse<BullhornClientContact>>({
      method: 'GET',
      path: `entity/ClientContact/${id}`,
      query: { fields },
    })
    return response.data
  }

  /**
   * Search client contacts using Lucene query syntax
   */
  async searchClientContacts(
    query: string,
    fields = 'id,firstName,lastName,name,email,phone,mobile,status,clientCorporation,owner,dateAdded,dateLastModified',
    count = 20,
    start = 0
  ): Promise<BullhornSearchResponse<BullhornClientContact>> {
    return this.request<BullhornSearchResponse<BullhornClientContact>>({
      method: 'GET',
      path: 'search/ClientContact',
      query: { query, fields, count, start },
    })
  }

  // ===========================================================================
  // JobOrder Methods
  // ===========================================================================

  /**
   * Get a job order by ID
   */
  async getJobOrder(
    id: number,
    fields = 'id,title,status,employmentType,clientContact,clientCorporation,owner,dateAdded,dateClosed'
  ): Promise<BullhornJobOrder> {
    const response = await this.request<BullhornEntityResponse<BullhornJobOrder>>({
      method: 'GET',
      path: `entity/JobOrder/${id}`,
      query: { fields },
    })
    return response.data
  }

  // ===========================================================================
  // Note Methods
  // ===========================================================================

  /**
   * Create a note
   */
  async createNote(note: Omit<BullhornNote, 'id'>): Promise<BullhornCreateResponse> {
    return this.request<BullhornCreateResponse>({
      method: 'PUT',
      path: 'entity/Note',
      body: note,
    })
  }

  // ===========================================================================
  // Task Methods
  // ===========================================================================

  /**
   * Create a task
   */
  async createTask(task: Omit<BullhornTask, 'id'>): Promise<BullhornCreateResponse> {
    return this.request<BullhornCreateResponse>({
      method: 'PUT',
      path: 'entity/Task',
      body: task,
    })
  }

  /**
   * Update a task
   */
  async updateTask(id: number, task: Partial<BullhornTask>): Promise<BullhornUpdateResponse> {
    return this.request<BullhornUpdateResponse>({
      method: 'POST',
      path: `entity/Task/${id}`,
      body: task,
    })
  }

  // ===========================================================================
  // Placement Methods
  // ===========================================================================

  /**
   * Get a placement by ID
   */
  async getPlacement(
    id: number,
    fields = 'id,status,dateBegin,dateEnd,salary,payRate,clientBillRate,candidate,jobOrder'
  ): Promise<BullhornPlacement> {
    const response = await this.request<BullhornEntityResponse<BullhornPlacement>>({
      method: 'GET',
      path: `entity/Placement/${id}`,
      query: { fields },
    })
    return response.data
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Get multiple entities by IDs
   * Bullhorn supports fetching multiple entities in one call
   */
  async getEntities<T>(
    entityType: string,
    ids: number[],
    fields: string
  ): Promise<BullhornSearchResponse<T>> {
    if (ids.length === 0) {
      return { total: 0, start: 0, count: 0, data: [] }
    }

    // Bullhorn's multi-entity endpoint
    const idsParam = ids.join(',')
    return this.request<BullhornSearchResponse<T>>({
      method: 'GET',
      path: `entity/${entityType}/${idsParam}`,
      query: { fields },
    })
  }
}
