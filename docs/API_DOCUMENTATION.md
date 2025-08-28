# Sixty Sales Dashboard - REST API Documentation

The Sixty Sales Dashboard REST API provides programmatic access to your CRM data including contacts, companies, deals, tasks, meetings, and activities. This API follows RESTful principles and uses JSON for data exchange.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Request/Response Format](#requestresponse-format)
4. [Rate Limiting](#rate-limiting)
5. [Endpoints](#endpoints)
6. [Code Examples](#code-examples)
7. [Error Reference](#error-reference)
8. [Webhooks](#webhooks)
9. [Best Practices](#best-practices)

## Overview

### Base URL
```
https://your-project.supabase.co/functions/v1/
```

### API Version
Current version: `v1`

### Available Resources
- **Contacts** - Manage individual contacts and their information
- **Companies** - Manage company records and relationships
- **Deals** - Handle sales opportunities and pipeline management
- **Tasks** - Track activities and to-do items
- **Meetings** - Meeting management and recordings
- **Activities** - Log sales activities and interactions

### Content Type
All API requests should use `application/json` content type.

## Authentication

### API Key Authentication

The API uses API key authentication via the `X-API-Key` header. API keys are generated through the dashboard and provide secure, token-based access to your data.

#### Obtaining an API Key

1. Log into your Sixty Sales Dashboard
2. Navigate to Settings > API Keys
3. Click "Create New API Key"
4. Choose permissions and expiration settings
5. Copy the generated key (shown only once)

#### Using API Keys

Include your API key in every request:

```http
X-API-Key: sk_your_api_key_here
```

### Permission Scopes

API keys support granular permissions:

- **read** - Read access to resources
- **write** - Create and update resources  
- **delete** - Delete resources
- **admin** - Administrative access to all data

### Security Notes

- API keys are hashed using SHA-256 and stored securely
- Keys can be set to expire automatically
- Failed authentication attempts are logged
- Unused keys can be revoked at any time

## Request/Response Format

### Standard Request Headers

```http
Content-Type: application/json
X-API-Key: sk_your_api_key_here
```

### Response Format

All API responses follow a consistent JSON structure:

```json
{
  "data": [...] | {...} | null,
  "error": null | "error message",
  "count": 100,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 100,
    "hasMore": true,
    "page": 1,
    "totalPages": 2
  }
}
```

#### Response Fields

- **data** - The requested data (array for lists, object for single items, null on error)
- **error** - Error message if the request failed, null on success
- **count** - Total number of items available (for list endpoints)
- **pagination** - Pagination metadata (for list endpoints)

### Pagination Parameters

All list endpoints support pagination:

- **limit** - Number of items per page (default: 50, max: 1000)
- **offset** - Number of items to skip (default: 0)

```http
GET /api-v1-contacts?limit=25&offset=100
```

### Filtering and Sorting

#### Search
Use the `search` parameter for text-based searches:

```http
GET /api-v1-contacts?search=john.doe@example.com
```

#### Sorting
Control sorting with `sort` and `order` parameters:

```http
GET /api-v1-deals?sort=created_at&order=desc
```

#### Filtering
Resource-specific filters are available:

```http
GET /api-v1-contacts?company_id=123e4567-e89b-12d3-a456-426614174000
GET /api-v1-deals?stage=proposal&priority=high
```

### Error Response Format

```json
{
  "data": null,
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Invalid email format"
  }
}
```

## Rate Limiting

### Rate Limit Tiers

- **Standard**: 1,000 requests per hour
- **Premium**: 5,000 requests per hour
- **Enterprise**: 10,000 requests per hour

Rate limits are enforced per API key and reset every hour.

### Rate Limit Headers

Response headers indicate current rate limit status:

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

### Handling Rate Limits

When rate limit is exceeded:

```json
{
  "data": null,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "details": {
    "current_usage": 1000,
    "limit": 1000,
    "reset_time": "2025-01-01T15:00:00Z"
  }
}
```

## Endpoints

### Contacts

Manage individual contacts and their information.

#### List Contacts
```http
GET /api-v1-contacts
```

**Query Parameters:**
- `limit` - Number of results (default: 50, max: 1000)
- `offset` - Pagination offset (default: 0)
- `search` - Search in name and email fields
- `company_id` - Filter by company UUID
- `is_primary` - Filter by primary contact status (true/false)
- `sort` - Sort field (default: created_at)
- `order` - Sort order: asc/desc (default: desc)

**Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "first_name": "John",
      "last_name": "Doe",
      "full_name": "John Doe",
      "email": "john.doe@example.com",
      "phone": "+1-555-0123",
      "title": "VP of Sales",
      "linkedin_url": "https://linkedin.com/in/johndoe",
      "is_primary": true,
      "company_id": "456e7890-e12f-34g5-h678-901234567890",
      "company_name": "Acme Corp",
      "company_website": "https://acme.com",
      "owner_id": "789e0123-e45g-67h8-i901-234567890123",
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": "2025-01-01T10:00:00Z"
    }
  ],
  "error": null,
  "count": 1,
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 1,
    "hasMore": false,
    "page": 1,
    "totalPages": 1
  }
}
```

#### Get Single Contact
```http
GET /api-v1-contacts/{id}
```

**Response:**
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "first_name": "John",
    "last_name": "Doe",
    "full_name": "John Doe",
    "email": "john.doe@example.com",
    "phone": "+1-555-0123",
    "title": "VP of Sales",
    "linkedin_url": "https://linkedin.com/in/johndoe",
    "is_primary": true,
    "company_id": "456e7890-e12f-34g5-h678-901234567890",
    "companies": {
      "id": "456e7890-e12f-34g5-h678-901234567890",
      "name": "Acme Corp",
      "website": "https://acme.com",
      "industry": "Technology",
      "size": "100-500"
    },
    "owner_id": "789e0123-e45g-67h8-i901-234567890123",
    "created_at": "2025-01-01T10:00:00Z",
    "updated_at": "2025-01-01T10:00:00Z"
  },
  "error": null
}
```

#### Create Contact
```http
POST /api-v1-contacts
```

**Required Permission:** `write`

**Request Body:**
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john.doe@example.com",
  "phone": "+1-555-0123",
  "title": "VP of Sales",
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "is_primary": true,
  "company_id": "456e7890-e12f-34g5-h678-901234567890"
}
```

**Required Fields:**
- `first_name`
- `email`

**Response:** Returns created contact with 201 status code.

#### Update Contact
```http
PUT /api-v1-contacts/{id}
```

**Required Permission:** `write`

**Request Body:** Same as create, all fields optional except validation requirements.

**Response:** Returns updated contact.

#### Delete Contact
```http
DELETE /api-v1-contacts/{id}
```

**Required Permission:** `delete`

**Response:**
```json
{
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "deleted": true
  },
  "error": null
}
```

### Companies

Manage company records and relationships.

#### List Companies
```http
GET /api-v1-companies
```

**Query Parameters:**
- Standard pagination and search parameters
- `industry` - Filter by industry
- `size` - Filter by company size
- `website` - Filter by website domain

**Response:**
```json
{
  "data": [
    {
      "id": "456e7890-e12f-34g5-h678-901234567890",
      "name": "Acme Corp",
      "website": "https://acme.com",
      "industry": "Technology",
      "size": "100-500",
      "description": "Leading software company",
      "linkedin_url": "https://linkedin.com/company/acme",
      "owner_id": "789e0123-e45g-67h8-i901-234567890123",
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": "2025-01-01T10:00:00Z"
    }
  ],
  "error": null,
  "count": 1,
  "pagination": { ... }
}
```

#### Get Single Company
```http
GET /api-v1-companies/{id}
```

#### Create Company
```http
POST /api-v1-companies
```

**Required Permission:** `write`

**Request Body:**
```json
{
  "name": "Acme Corp",
  "website": "https://acme.com",
  "industry": "Technology",
  "size": "100-500",
  "description": "Leading software company",
  "linkedin_url": "https://linkedin.com/company/acme"
}
```

**Required Fields:**
- `name`

#### Update Company
```http
PUT /api-v1-companies/{id}
```

#### Delete Company
```http
DELETE /api-v1-companies/{id}
```

### Deals

Handle sales opportunities and pipeline management.

#### List Deals
```http
GET /api-v1-deals
```

**Query Parameters:**
- Standard pagination and search parameters
- `stage` - Filter by deal stage
- `priority` - Filter by priority (low, medium, high, critical)
- `company_id` - Filter by company
- `expected_close_date_from` - Filter deals closing after date
- `expected_close_date_to` - Filter deals closing before date
- `value_min` - Minimum deal value
- `value_max` - Maximum deal value

**Response:**
```json
{
  "data": [
    {
      "id": "789e0123-e45g-67h8-i901-234567890123",
      "title": "Acme Corp - Software License",
      "description": "Annual software license renewal",
      "value": 50000,
      "stage": "proposal",
      "priority": "high",
      "expected_close_date": "2025-02-15",
      "probability": 75,
      "deal_size": "large",
      "lead_source": "website",
      "next_steps": "Follow up on technical requirements",
      "company_id": "456e7890-e12f-34g5-h678-901234567890",
      "primary_contact_id": "123e4567-e89b-12d3-a456-426614174000",
      "owner_id": "789e0123-e45g-67h8-i901-234567890123",
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": "2025-01-01T10:00:00Z"
    }
  ],
  "error": null,
  "count": 1,
  "pagination": { ... }
}
```

#### Get Single Deal
```http
GET /api-v1-deals/{id}
```

#### Create Deal
```http
POST /api-v1-deals
```

**Required Permission:** `write`

**Request Body:**
```json
{
  "title": "Acme Corp - Software License",
  "description": "Annual software license renewal",
  "value": 50000,
  "stage": "opportunity",
  "priority": "high",
  "expected_close_date": "2025-02-15",
  "probability": 75,
  "deal_size": "large",
  "lead_source": "website",
  "next_steps": "Follow up on technical requirements",
  "company_id": "456e7890-e12f-34g5-h678-901234567890",
  "primary_contact_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Required Fields:**
- `title`
- `value`
- `expected_close_date`

#### Update Deal
```http
PUT /api-v1-deals/{id}
```

#### Delete Deal
```http
DELETE /api-v1-deals/{id}
```

### Tasks

Track activities and to-do items.

#### List Tasks
```http
GET /api-v1-tasks
```

**Query Parameters:**
- Standard pagination and search parameters
- `status` - Filter by status (pending, in_progress, completed, cancelled)
- `priority` - Filter by priority (low, medium, high, critical)
- `due_date_from` - Tasks due after date
- `due_date_to` - Tasks due before date
- `assignee_id` - Filter by assigned user

**Response:**
```json
{
  "data": [
    {
      "id": "abc1234d-e56f-78g9-h012-345678901234",
      "title": "Follow up with Acme Corp",
      "description": "Discuss implementation timeline",
      "status": "pending",
      "priority": "high",
      "due_date": "2025-01-15",
      "assignee_id": "789e0123-e45g-67h8-i901-234567890123",
      "deal_id": "789e0123-e45g-67h8-i901-234567890123",
      "contact_id": "123e4567-e89b-12d3-a456-426614174000",
      "completed_at": null,
      "owner_id": "789e0123-e45g-67h8-i901-234567890123",
      "created_at": "2025-01-01T10:00:00Z",
      "updated_at": "2025-01-01T10:00:00Z"
    }
  ],
  "error": null,
  "count": 1,
  "pagination": { ... }
}
```

#### Get Single Task
```http
GET /api-v1-tasks/{id}
```

#### Create Task
```http
POST /api-v1-tasks
```

**Required Permission:** `write`

**Request Body:**
```json
{
  "title": "Follow up with Acme Corp",
  "description": "Discuss implementation timeline",
  "status": "pending",
  "priority": "high",
  "due_date": "2025-01-15",
  "assignee_id": "789e0123-e45g-67h8-i901-234567890123",
  "deal_id": "789e0123-e45g-67h8-i901-234567890123",
  "contact_id": "123e4567-e89b-12d3-a456-426614174000"
}
```

**Required Fields:**
- `title`
- `due_date`

#### Update Task
```http
PUT /api-v1-tasks/{id}
```

#### Delete Task
```http
DELETE /api-v1-tasks/{id}
```

### Meetings

Meeting management and recordings (with Fathom integration).

#### List Meetings
```http
GET /api-v1-meetings
```

**Query Parameters:**
- Standard pagination and search parameters
- `meeting_start_from` - Meetings after date
- `meeting_start_to` - Meetings before date
- `team_name` - Filter by team
- `has_summary` - Filter meetings with/without AI summary

**Response:**
```json
{
  "data": [
    {
      "id": "def5678e-f90g-12h3-i456-789012345678",
      "fathom_recording_id": "abc123def456",
      "title": "Acme Corp Discovery Call",
      "share_url": "https://fathom.video/share/abc123def456",
      "calls_url": "https://fathom.video/calls/123456",
      "transcript_doc_url": "https://docs.google.com/document/d/abc123",
      "meeting_start": "2025-01-15T14:00:00Z",
      "meeting_end": "2025-01-15T15:00:00Z",
      "duration_minutes": 60,
      "summary": "Discovery call to understand technical requirements...",
      "owner_user_id": "789e0123-e45g-67h8-i901-234567890123",
      "owner_email": "sales@company.com",
      "team_name": "Sales",
      "created_at": "2025-01-15T14:05:00Z",
      "updated_at": "2025-01-15T15:05:00Z"
    }
  ],
  "error": null,
  "count": 1,
  "pagination": { ... }
}
```

#### Get Single Meeting
```http
GET /api-v1-meetings/{id}
```

Includes related data:
- Meeting attendees
- Action items
- Meeting metrics (sentiment, talk time, etc.)

#### Create Meeting
```http
POST /api-v1-meetings
```

**Note:** Meetings are typically created automatically via Fathom webhooks.

#### Update Meeting
```http
PUT /api-v1-meetings/{id}
```

#### Delete Meeting
```http
DELETE /api-v1-meetings/{id}
```

### Activities

Log sales activities and interactions.

#### List Activities
```http
GET /api-v1-activities
```

**Query Parameters:**
- Standard pagination and search parameters
- `activity_type` - Filter by type (call, email, meeting, demo, proposal, etc.)
- `date_from` - Activities after date
- `date_to` - Activities before date
- `deal_id` - Filter by related deal
- `contact_id` - Filter by related contact

**Response:**
```json
{
  "data": [
    {
      "id": "ghi9012f-g34h-56i7-j890-123456789012",
      "activity_type": "call",
      "description": "Discovery call with technical team",
      "date": "2025-01-15",
      "duration_minutes": 45,
      "outcome": "positive",
      "notes": "Identified key pain points and requirements",
      "deal_id": "789e0123-e45g-67h8-i901-234567890123",
      "contact_id": "123e4567-e89b-12d3-a456-426614174000",
      "company_id": "456e7890-e12f-34g5-h678-901234567890",
      "owner_id": "789e0123-e45g-67h8-i901-234567890123",
      "created_at": "2025-01-15T14:00:00Z",
      "updated_at": "2025-01-15T14:00:00Z"
    }
  ],
  "error": null,
  "count": 1,
  "pagination": { ... }
}
```

#### Get Single Activity
```http
GET /api-v1-activities/{id}
```

#### Create Activity
```http
POST /api-v1-activities
```

**Required Permission:** `write`

**Request Body:**
```json
{
  "activity_type": "call",
  "description": "Discovery call with technical team",
  "date": "2025-01-15",
  "duration_minutes": 45,
  "outcome": "positive",
  "notes": "Identified key pain points and requirements",
  "deal_id": "789e0123-e45g-67h8-i901-234567890123",
  "contact_id": "123e4567-e89b-12d3-a456-426614174000",
  "company_id": "456e7890-e12f-34g5-h678-901234567890"
}
```

**Required Fields:**
- `activity_type`
- `description`
- `date`

#### Update Activity
```http
PUT /api-v1-activities/{id}
```

#### Delete Activity
```http
DELETE /api-v1-activities/{id}
```

## Code Examples

### JavaScript/TypeScript

#### Basic Setup
```typescript
class SixtyAPIClient {
  private baseURL = 'https://your-project.supabase.co/functions/v1'
  private apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}/${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...options.headers,
      },
    })

    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'API request failed')
    }
    
    return data
  }

  // Contact methods
  async getContacts(params?: Record<string, any>) {
    const query = new URLSearchParams(params).toString()
    const endpoint = `api-v1-contacts${query ? `?${query}` : ''}`
    return this.request(endpoint)
  }

  async getContact(id: string) {
    return this.request(`api-v1-contacts/${id}`)
  }

  async createContact(contactData: any) {
    return this.request('api-v1-contacts', {
      method: 'POST',
      body: JSON.stringify(contactData),
    })
  }

  async updateContact(id: string, updates: any) {
    return this.request(`api-v1-contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  async deleteContact(id: string) {
    return this.request(`api-v1-contacts/${id}`, {
      method: 'DELETE',
    })
  }
}

// Usage
const client = new SixtyAPIClient('sk_your_api_key_here')

// List contacts with search
const contacts = await client.getContacts({
  search: 'john@example.com',
  limit: 25,
  offset: 0
})

// Create a new contact
const newContact = await client.createContact({
  first_name: 'Jane',
  last_name: 'Smith',
  email: 'jane.smith@example.com',
  title: 'CTO'
})
```

### Python

#### Basic Setup
```python
import requests
from typing import Dict, Any, Optional
import json

class SixtyAPIClient:
    def __init__(self, api_key: str, base_url: str = None):
        self.api_key = api_key
        self.base_url = base_url or 'https://your-project.supabase.co/functions/v1'
        self.session = requests.Session()
        self.session.headers.update({
            'Content-Type': 'application/json',
            'X-API-Key': self.api_key
        })

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        url = f"{self.base_url}/{endpoint}"
        response = self.session.request(method, url, **kwargs)
        
        try:
            data = response.json()
        except ValueError:
            data = {'error': 'Invalid JSON response'}
        
        if not response.ok:
            raise Exception(f"API Error {response.status_code}: {data.get('error', 'Unknown error')}")
        
        return data

    # Contact methods
    def get_contacts(self, **params) -> Dict[str, Any]:
        return self._request('GET', 'api-v1-contacts', params=params)

    def get_contact(self, contact_id: str) -> Dict[str, Any]:
        return self._request('GET', f'api-v1-contacts/{contact_id}')

    def create_contact(self, contact_data: Dict[str, Any]) -> Dict[str, Any]:
        return self._request('POST', 'api-v1-contacts', json=contact_data)

    def update_contact(self, contact_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        return self._request('PUT', f'api-v1-contacts/{contact_id}', json=updates)

    def delete_contact(self, contact_id: str) -> Dict[str, Any]:
        return self._request('DELETE', f'api-v1-contacts/{contact_id}')

# Usage
client = SixtyAPIClient('sk_your_api_key_here')

# List contacts with search
contacts = client.get_contacts(search='john@example.com', limit=25)

# Create a new contact
new_contact = client.create_contact({
    'first_name': 'Jane',
    'last_name': 'Smith',
    'email': 'jane.smith@example.com',
    'title': 'CTO'
})
```

### cURL Examples

#### List Contacts
```bash
curl -X GET \
  'https://your-project.supabase.co/functions/v1/api-v1-contacts?limit=10&search=acme' \
  -H 'X-API-Key: sk_your_api_key_here' \
  -H 'Content-Type: application/json'
```

#### Create Contact
```bash
curl -X POST \
  'https://your-project.supabase.co/functions/v1/api-v1-contacts' \
  -H 'X-API-Key: sk_your_api_key_here' \
  -H 'Content-Type: application/json' \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "title": "VP of Sales"
  }'
```

#### Update Deal
```bash
curl -X PUT \
  'https://your-project.supabase.co/functions/v1/api-v1-deals/123e4567-e89b-12d3-a456-426614174000' \
  -H 'X-API-Key: sk_your_api_key_here' \
  -H 'Content-Type: application/json' \
  -d '{
    "stage": "proposal",
    "probability": 80,
    "next_steps": "Send technical proposal"
  }'
```

### Using the Testing Interface

The dashboard includes a built-in API testing interface accessible at `/api-testing`. This interface allows you to:

- Test all API endpoints interactively
- View request/response examples
- Generate code snippets
- Monitor API usage and performance
- Manage API keys

## Error Reference

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request data or parameters |
| 401 | Unauthorized | Invalid or missing API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate email) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `INVALID_API_KEY` | API key is invalid | Check your API key format |
| `API_KEY_EXPIRED` | API key has expired | Generate a new API key |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Wait for rate limit reset |
| `INSUFFICIENT_PERMISSIONS` | Missing required permissions | Check API key permissions |
| `VALIDATION_ERROR` | Request data validation failed | Check required fields and formats |
| `DUPLICATE_EMAIL` | Email already exists | Use a different email address |
| `INVALID_ID_FORMAT` | UUID format is invalid | Ensure ID is a valid UUID |
| `RESOURCE_NOT_FOUND` | Requested resource not found | Verify the resource ID exists |
| `METHOD_NOT_ALLOWED` | HTTP method not supported | Use the correct HTTP method |

### Common Error Scenarios

#### Authentication Errors
```json
{
  "data": null,
  "error": "API key required in X-API-Key header",
  "code": "INVALID_API_KEY"
}
```

#### Validation Errors
```json
{
  "data": null,
  "error": "Field 'email' is required",
  "code": "VALIDATION_ERROR",
  "details": {
    "field": "email",
    "message": "Field 'email' is required"
  }
}
```

#### Resource Not Found
```json
{
  "data": null,
  "error": "Contact not found",
  "code": "CONTACT_NOT_FOUND"
}
```

## Webhooks

The API supports webhooks for real-time notifications of events, particularly for meeting integrations.

### Meeting Webhooks (Fathom Integration)

The system automatically receives webhooks from Fathom for meeting events:

#### Webhook Endpoint
```
POST /functions/v1/meetings-webhook
```

#### Supported Topics

**Summary Webhook**
- **Topic:** `summary`
- **Triggered:** When meeting AI summary is generated
- **Data:** Meeting details, attendees, and AI-generated summary

**Action Items Webhook**  
- **Topic:** `action_items`
- **Triggered:** When action items are detected in meeting
- **Data:** Action item details, assignees, deadlines

**Transcript Webhook**
- **Topic:** `transcript`  
- **Triggered:** When meeting transcript is available
- **Data:** Transcript document URL and meeting reference

#### Example Payload

**Summary Webhook:**
```json
{
  "topic": "summary",
  "shareId": "abc123def456",
  "meeting": {
    "title": "Acme Corp Discovery Call",
    "scheduled_start_time": "2025-01-15T14:00:00Z",
    "scheduled_end_time": "2025-01-15T15:00:00Z",
    "invitees": [
      {
        "name": "John Doe",
        "email": "john.doe@company.com"
      }
    ]
  },
  "recording": {
    "recording_share_url": "https://fathom.video/share/abc123def456",
    "recording_url": "https://fathom.video/calls/123456",
    "recording_duration_in_minutes": 60
  },
  "ai_summary": "Discovery call to understand technical requirements...",
  "sentiment_score": 0.8,
  "coach_rating": 4.5,
  "talk_time_rep_pct": 40,
  "talk_time_customer_pct": 60
}
```

#### Webhook Security

- Webhooks use HTTP POST with JSON payloads
- Consider implementing webhook signature verification for production
- Webhooks are idempotent and can be safely retried

## Best Practices

### Efficient API Usage

#### Pagination Strategy
```javascript
// Efficient pagination with cursor-based approach
async function getAllContacts() {
  let allContacts = []
  let offset = 0
  const limit = 100

  while (true) {
    const response = await client.getContacts({ limit, offset })
    
    if (!response.data || response.data.length === 0) break
    
    allContacts.push(...response.data)
    offset += limit
    
    // Break if we've retrieved all records
    if (!response.pagination.hasMore) break
  }
  
  return allContacts
}
```

#### Efficient Filtering
```javascript
// Use specific filters instead of client-side filtering
const recentHighPriorityDeals = await client.getDeals({
  priority: 'high',
  expected_close_date_from: '2025-01-01',
  sort: 'expected_close_date',
  order: 'asc'
})
```

### Caching Strategies

#### Client-Side Caching
```javascript
class CachedAPIClient extends SixtyAPIClient {
  private cache = new Map()
  private cacheTTL = 5 * 60 * 1000 // 5 minutes

  async getContactCached(id: string) {
    const cacheKey = `contact:${id}`
    const cached = this.cache.get(cacheKey)
    
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data
    }
    
    const data = await this.getContact(id)
    this.cache.set(cacheKey, { data, timestamp: Date.now() })
    
    return data
  }
}
```

#### Rate Limit Management
```javascript
class RateLimitedClient extends SixtyAPIClient {
  private requestQueue: Array<() => Promise<any>> = []
  private processing = false
  private requestsThisHour = 0
  private hourStart = Date.now()

  async queuedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await requestFn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })
      
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.processing) return
    this.processing = true

    while (this.requestQueue.length > 0) {
      // Check rate limit
      if (Date.now() - this.hourStart > 3600000) {
        this.requestsThisHour = 0
        this.hourStart = Date.now()
      }

      if (this.requestsThisHour >= 900) { // Leave some buffer
        await new Promise(resolve => setTimeout(resolve, 1000))
        continue
      }

      const request = this.requestQueue.shift()
      if (request) {
        await request()
        this.requestsThisHour++
      }
    }

    this.processing = false
  }
}
```

### Bulk Operations

#### Batch Creates
```javascript
async function bulkCreateContacts(contacts: ContactData[]) {
  const batchSize = 10
  const results = []

  for (let i = 0; i < contacts.length; i += batchSize) {
    const batch = contacts.slice(i, i + batchSize)
    
    const batchPromises = batch.map(contact => 
      client.createContact(contact).catch(error => ({
        error: error.message,
        data: contact
      }))
    )
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < contacts.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}
```

### Error Handling Best Practices

#### Comprehensive Error Handling
```javascript
async function robustAPICall<T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry on certain errors
      if (error.message.includes('VALIDATION_ERROR') || 
          error.message.includes('INSUFFICIENT_PERMISSIONS')) {
        throw error
      }
      
      // Exponential backoff for retries
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
```

#### Rate Limit Handling
```javascript
async function handleRateLimitedRequest<T>(apiCall: () => Promise<T>): Promise<T> {
  try {
    return await apiCall()
  } catch (error) {
    if (error.message.includes('RATE_LIMIT_EXCEEDED')) {
      // Extract reset time from error details
      const resetTime = new Date(error.details?.reset_time)
      const waitTime = resetTime.getTime() - Date.now()
      
      if (waitTime > 0 && waitTime < 3600000) { // Less than 1 hour
        console.log(`Rate limited. Waiting ${waitTime}ms before retry...`)
        await new Promise(resolve => setTimeout(resolve, waitTime))
        return await apiCall()
      }
    }
    throw error
  }
}
```

### Data Validation

#### Input Validation
```javascript
function validateContactData(contact: any): string[] {
  const errors: string[] = []
  
  if (!contact.first_name?.trim()) {
    errors.push('First name is required')
  }
  
  if (!contact.email?.trim()) {
    errors.push('Email is required')
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push('Invalid email format')
  }
  
  if (contact.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(contact.phone.replace(/[-\s]/g, ''))) {
    errors.push('Invalid phone number format')
  }
  
  return errors
}
```

### Security Considerations

1. **API Key Management**
   - Store API keys securely (environment variables, secure key management)
   - Rotate API keys regularly
   - Use minimum required permissions
   - Monitor API key usage

2. **Data Handling**
   - Validate all input data
   - Sanitize user inputs
   - Use HTTPS for all API calls
   - Don't log sensitive data

3. **Rate Limiting**
   - Implement client-side rate limiting
   - Monitor rate limit headers
   - Handle rate limit errors gracefully
   - Use exponential backoff for retries

---

## Support

For API support and questions:
- Review this documentation
- Use the built-in API testing interface
- Check the error reference for common issues
- Contact support for complex integration questions

**API Version:** v1  
**Last Updated:** January 2025