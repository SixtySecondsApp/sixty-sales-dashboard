# CRM API Reference

Complete REST API documentation for the Sixty Sales Dashboard CRM system.

## Base URL

```
https://your-project.supabase.co/functions/v1
```

## Authentication

All API requests require authentication using API keys via the `X-API-Key` header.

```http
X-API-Key: sk_your_api_key_here
```

### Getting an API Key

API keys can be generated through the web interface or programmatically:

```sql
-- Create a new API key
SELECT * FROM create_api_key(
  'My API Key',                    -- name
  auth.uid(),                      -- user_id (optional, defaults to current user)
  '{"read": true, "write": true}'::jsonb,  -- permissions
  1000,                           -- rate_limit (requests per hour)
  30                              -- expires_days (optional)
);
```

### Rate Limiting

- Default: 1000 requests per hour per API key
- Rate limit headers included in responses:
  - `X-RateLimit-Limit`: Total rate limit
  - `X-RateLimit-Remaining`: Remaining requests in current window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

## Standard Response Format

All endpoints return responses in this format:

```json
{
  "data": {},           // Response data (null on error)
  "error": null,        // Error message (null on success)
  "count": 50,          // Total count (list endpoints only)
  "pagination": {       // Pagination info (list endpoints only)
    "limit": 50,
    "offset": 0,
    "total": 150,
    "hasMore": true,
    "page": 1,
    "totalPages": 3
  }
}
```

## Standard Query Parameters

### Pagination
- `limit` - Number of records to return (max 1000, default 50)
- `offset` - Number of records to skip (default 0)

### Filtering
- `search` - Text search across relevant fields
- `sort` - Field to sort by
- `order` - Sort order: `asc` or `desc` (default `desc`)

### Date Ranges
- `date_from` - Start date (ISO 8601 format)
- `date_to` - End date (ISO 8601 format)

## Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `API_KEY_MISSING` | 401 | X-API-Key header required |
| `API_KEY_INVALID` | 401 | Invalid API key |
| `API_KEY_EXPIRED` | 401 | API key has expired |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INSUFFICIENT_PERMISSIONS` | 403 | Missing required permission |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Contacts API

Manage customer and prospect contact information.

### List Contacts

```http
GET /api-v1-contacts
```

**Query Parameters:**
- `company_id` - Filter by company ID
- `is_primary` - Filter by primary contact status (`true`/`false`)

**Example Request:**
```bash
curl -X GET "https://your-project.supabase.co/functions/v1/api-v1-contacts?limit=10&search=john" \
  -H "X-API-Key: sk_your_api_key_here"
```

**Example Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "first_name": "John",
      "last_name": "Doe",
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "+1-555-0123",
      "title": "CEO",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "is_primary": true,
      "company_id": "456e7890-e89b-12d3-a456-426614174000",
      "company_name": "Acme Corp",
      "company_website": "https://acme.com",
      "owner_id": "789e0123-e89b-12d3-a456-426614174000",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "error": null
}
```

### Get Single Contact

```http
GET /api-v1-contacts/{id}
```

### Create Contact

```http
POST /api-v1-contacts
```

**Required Fields:**
- `first_name` (string)
- `email` (string, valid email format)

**Example Request:**
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-v1-contacts" \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "phone": "+1-555-0124",
    "title": "CTO",
    "company_id": "456e7890-e89b-12d3-a456-426614174000"
  }'
```

### Update Contact

```http
PUT /api-v1-contacts/{id}
```

### Delete Contact

```http
DELETE /api-v1-contacts/{id}
```

---

## Companies API

Manage company records and relationships.

### List Companies

```http
GET /api-v1-companies
```

**Query Parameters:**
- `industry` - Filter by industry
- `size` - Filter by company size

**Example Response:**
```json
{
  "data": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174000",
      "name": "Acme Corp",
      "website": "https://acme.com",
      "industry": "Technology",
      "size": "50-100",
      "description": "Leading software company",
      "linkedin_url": "https://linkedin.com/company/acme",
      "contact_count": 5,
      "deal_count": 3,
      "owner_id": "789e0123-e89b-12d3-a456-426614174000",
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "error": null
}
```

### Get Single Company

```http
GET /api-v1-companies/{id}
```

Includes related contacts, deals, and notes.

### Create Company

```http
POST /api-v1-companies
```

**Required Fields:**
- `name` (string)

### Update Company

```http
PUT /api-v1-companies/{id}
```

### Delete Company

```http
DELETE /api-v1-companies/{id}
```

⚠️ **Note:** Cannot delete companies with associated contacts or deals.

---

## Deals API

Manage sales opportunities and pipeline.

### List Deals

```http
GET /api-v1-deals
```

**Query Parameters:**
- `stage_id` - Filter by pipeline stage
- `owner_id` - Filter by deal owner
- `status` - Filter by deal status
- `priority` - Filter by priority level
- `min_value` - Minimum deal value
- `max_value` - Maximum deal value

**Example Response:**
```json
{
  "data": [
    {
      "id": "789e0123-e89b-12d3-a456-426614174000",
      "name": "Acme Enterprise License",
      "company": "Acme Corp",
      "contact_name": "John Doe",
      "contact_email": "john@example.com",
      "value": 50000,
      "one_off_revenue": 10000,
      "monthly_mrr": 2000,
      "annual_value": 34000,
      "ltv": 16000,
      "stage_id": "abc123-stage-id",
      "stage_name": "Proposal",
      "stage_color": "#3B82F6",
      "owner_id": "user123",
      "owner_name": "Jane Smith",
      "probability": 75,
      "expected_close_date": "2025-02-15",
      "days_in_stage": 5,
      "is_overdue": false,
      "has_splits": false,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "error": null
}
```

### Get Single Deal

```http
GET /api-v1-deals/{id}
```

Includes stage information, owner details, and revenue splits if applicable.

### Create Deal

```http
POST /api-v1-deals
```

**Required Fields:**
- `name` (string)
- `value` (number, ≥ 0)
- `stage_id` (UUID)

**Example Request:**
```bash
curl -X POST "https://your-project.supabase.co/functions/v1/api-v1-deals" \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Enterprise Deal",
    "company": "Tech Startup Inc",
    "value": 25000,
    "one_off_revenue": 5000,
    "monthly_mrr": 1000,
    "stage_id": "abc123-stage-id",
    "expected_close_date": "2025-03-01",
    "probability": 50
  }'
```

### Update Deal

```http
PUT /api-v1-deals/{id}
```

⚠️ **Permission Rules:**
- Non-admins can only edit their own deals
- Deals with revenue splits can only be modified by admins
- Financial data on split deals is protected

### Delete Deal

```http
DELETE /api-v1-deals/{id}
```

⚠️ **Permission Rules:**
- Non-admins can only delete their own non-split deals
- Deals with revenue splits can only be deleted by admins

---

## Tasks API

Manage tasks and to-do items.

### List Tasks

```http
GET /api-v1-tasks
```

**Query Parameters:**
- `status` - Filter by status (`todo`, `in_progress`, `completed`, `cancelled`)
- `priority` - Filter by priority (`low`, `medium`, `high`, `urgent`)
- `assigned_to` - Filter by assigned user ID
- `deal_id` - Filter by associated deal
- `due_before` - Tasks due before date
- `due_after` - Tasks due after date
- `overdue` - Show only overdue tasks (`true`)

**Example Response:**
```json
{
  "data": [
    {
      "id": "task123",
      "title": "Follow up with Acme Corp",
      "description": "Send proposal follow-up email",
      "status": "todo",
      "priority": "high",
      "due_date": "2025-01-15T09:00:00Z",
      "assigned_to": "user123",
      "assigned_user_name": "Jane Smith",
      "created_by": "user456",
      "creator_name": "John Doe",
      "deal_id": "deal123",
      "deal_name": "Acme Enterprise License",
      "is_overdue": true,
      "days_until_due": -2,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "error": null
}
```

### Create Task

```http
POST /api-v1-tasks
```

**Required Fields:**
- `title` (string)

**Valid Values:**
- `status`: `todo`, `in_progress`, `completed`, `cancelled`
- `priority`: `low`, `medium`, `high`, `urgent`

### Update Task

```http
PUT /api-v1-tasks/{id}
```

⚠️ **Permission Rules:**
- Non-admins can only edit tasks they created or are assigned to

### Delete Task

```http
DELETE /api-v1-tasks/{id}
```

⚠️ **Permission Rules:**
- Non-admins can only delete tasks they created

---

## Meetings API

Manage meetings and appointments.

### List Meetings

```http
GET /api-v1-meetings
```

**Query Parameters:**
- `meeting_type` - Filter by type (`discovery`, `demo`, `proposal`, etc.)
- `status` - Filter by status (`scheduled`, `completed`, `cancelled`, etc.)
- `today` - Show today's meetings (`true`)
- `upcoming` - Show upcoming meetings (`true`)
- `past` - Show past meetings (`true`)
- `start_after` - Meetings starting after date
- `start_before` - Meetings starting before date

**Example Response:**
```json
{
  "data": [
    {
      "id": "meeting123",
      "title": "Product Demo - Acme Corp",
      "description": "Demonstrate key product features",
      "meeting_type": "demo",
      "status": "scheduled",
      "start_time": "2025-01-15T14:00:00Z",
      "end_time": "2025-01-15T15:00:00Z",
      "duration_minutes": 60,
      "attendees": ["john@acme.com", "jane@ourcompany.com"],
      "attendee_count": 2,
      "location": "Zoom",
      "meeting_url": "https://zoom.us/j/123456789",
      "deal_id": "deal123",
      "deal_name": "Acme Enterprise License",
      "is_upcoming": true,
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "count": 1,
  "error": null
}
```

### Create Meeting

```http
POST /api-v1-meetings
```

**Required Fields:**
- `title` (string)
- `start_time` (ISO 8601 datetime)

**Valid Values:**
- `meeting_type`: `discovery`, `demo`, `proposal`, `negotiation`, `onboarding`, `check_in`, `other`
- `status`: `scheduled`, `in_progress`, `completed`, `cancelled`, `no_show`

---

## Activities API

Track sales activities and interactions.

### List Activities

```http
GET /api-v1-activities
```

**Query Parameters:**
- `type` - Filter by activity type (`call`, `email`, `meeting`, etc.)
- `status` - Filter by status (`completed`, `pending`, `cancelled`)
- `outcome` - Filter by outcome (`positive`, `neutral`, `negative`)
- `date_from` - Activities from date
- `date_to` - Activities to date
- `this_week` - This week's activities (`true`)
- `this_month` - This month's activities (`true`)
- `min_amount` - Minimum activity amount
- `max_amount` - Maximum activity amount

**Example Response:**
```json
{
  "data": [
    {
      "id": "activity123",
      "type": "call",
      "subject": "Discovery call with John Doe",
      "details": "Discussed requirements and next steps",
      "amount": 0,
      "date": "2025-01-10T10:00:00Z",
      "status": "completed",
      "outcome": "positive",
      "owner_id": "user123",
      "owner_name": "Jane Smith",
      "deal_id": "deal123",
      "deal_name": "Acme Enterprise License",
      "contact_name": "John Doe",
      "days_ago": 5,
      "created_at": "2025-01-10T10:30:00Z"
    }
  ],
  "count": 1,
  "error": null
}
```

### Create Activity

```http
POST /api-v1-activities
```

**Required Fields:**
- `type` (string)
- `subject` (string)
- `date` (ISO 8601 datetime)

**Valid Values:**
- `type`: `call`, `email`, `meeting`, `task`, `proposal`, `sale`, `note`, `other`
- `status`: `completed`, `pending`, `cancelled`
- `outcome`: `positive`, `neutral`, `negative`

---

## Webhooks

### API Usage Webhook

Receive real-time notifications of API usage:

```json
{
  "event": "api_usage",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": {
    "api_key_id": "key123",
    "endpoint": "/api-v1-deals",
    "method": "POST",
    "status_code": 201,
    "response_time_ms": 150,
    "user_id": "user123",
    "ip_address": "192.168.1.1"
  }
}
```

### Rate Limit Warning

Get notified when approaching rate limits:

```json
{
  "event": "rate_limit_warning",
  "timestamp": "2025-01-01T12:00:00Z",
  "data": {
    "api_key_id": "key123",
    "current_usage": 800,
    "limit": 1000,
    "percentage_used": 80
  }
}
```

---

## SDKs and Libraries

### JavaScript/TypeScript

```bash
npm install @sixty-sales/api-client
```

```javascript
import { SixtySalesAPI } from '@sixty-sales/api-client';

const api = new SixtySalesAPI({
  apiKey: 'sk_your_api_key_here',
  baseURL: 'https://your-project.supabase.co/functions/v1'
});

// List contacts
const contacts = await api.contacts.list({
  limit: 10,
  search: 'john'
});

// Create a deal
const deal = await api.deals.create({
  name: 'New Enterprise Deal',
  value: 50000,
  stage_id: 'stage123'
});
```

### Python

```bash
pip install sixty-sales-api
```

```python
from sixty_sales_api import SixtySalesAPI

api = SixtySalesAPI(
    api_key='sk_your_api_key_here',
    base_url='https://your-project.supabase.co/functions/v1'
)

# List deals
deals = api.deals.list(
    limit=10,
    stage_id='stage123'
)

# Create a contact
contact = api.contacts.create({
    'first_name': 'Jane',
    'last_name': 'Smith',
    'email': 'jane@example.com'
})
```

---

## API Limits

| Resource | Limit |
|----------|--------|
| Requests per hour | 1000 (configurable per API key) |
| Maximum page size | 1000 records |
| Request timeout | 30 seconds |
| Payload size | 10 MB |
| API key expiration | Configurable (default: no expiration) |

## Support

For API support and questions:
- Documentation: [API Reference](https://docs.sixty-sales.com/api)
- Support Email: api-support@sixty-sales.com
- Status Page: [status.sixty-sales.com](https://status.sixty-sales.com)

## Changelog

### v1.0.0 (2025-01-01)
- Initial API release
- Complete CRUD operations for all entities
- API key authentication
- Rate limiting
- Comprehensive filtering and pagination