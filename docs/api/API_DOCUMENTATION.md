# API Documentation - Sixty Sales Dashboard

Comprehensive documentation for the Sixty Sales Dashboard API, including admin-only endpoints and security features.

## 🔐 Authentication & Authorization

### User Roles
- **Super Admin**: Full system access including user management
- **Admin**: Revenue splitting, advanced pipeline management (`is_admin: true`)
- **Standard User**: Basic CRM functionality, own data management
- **Read-Only**: View access only (future implementation)

### Authorization Headers
```http
Authorization: Bearer <supabase_jwt_token>
```

All API endpoints require valid Supabase JWT authentication. Admin endpoints additionally validate the `is_admin` flag in the user's profile.

## 📊 Core API Endpoints

### Dashboard Data
```http
GET /api/dashboard
```
**Description**: Retrieves aggregated dashboard metrics and KPIs
**Authentication**: Required
**Response**: Dashboard metrics including sales totals, pipeline data, and activity summaries

### Health Check
```http
GET /api/health
```
**Description**: API health status and system metrics
**Authentication**: Not required
**Response**: System status, database connectivity, and performance metrics

## 💰 Deal Management API

### Create Deal
```http
POST /api/deals
```
**Description**: Create a new deal in the pipeline
**Authentication**: Required
**Request Body**:
```json
{
  "name": "Acme Corp Deal",
  "company": "Acme Corporation", 
  "value": 15000,
  "stage_id": "uuid",
  "expected_close_date": "2024-03-15",
  "contact_email": "contact@acme.com",
  "one_off_revenue": 5000,     // Admin only
  "monthly_mrr": 1000          // Admin only
}
```
**Admin Features**:
- `one_off_revenue` and `monthly_mrr` fields restricted to admin users
- Creates audit log entry for revenue split deals

### Update Deal
```http
PUT /api/deals/:id
```
**Description**: Update existing deal
**Authentication**: Required
**Authorization**: 
- Users can update their own non-split deals
- Admins can update any deal
- Split deals require admin privileges

**Request Body**:
```json
{
  "name": "Updated Deal Name",
  "value": 20000,
  "stage_id": "new_stage_uuid",
  "one_off_revenue": 8000,     // Admin only
  "monthly_mrr": 1500          // Admin only
}
```

### Delete Deal
```http
DELETE /api/deals/:id
```
**Description**: Delete a deal from the pipeline
**Authentication**: Required
**Authorization Rules**:
- Admins can delete any deal
- Non-admins cannot delete split deals
- Non-admins can delete their own non-split deals

**Response**: 
- `200` - Deal deleted successfully
- `403` - Insufficient permissions
- `404` - Deal not found

### Get Deal Details
```http
GET /api/deals/:id
```
**Description**: Retrieve detailed information about a specific deal
**Authentication**: Required
**Response**: Complete deal object including revenue split data (if admin)

## 🎯 Activity Management API

### Create Activity
```http
POST /api/activities
```
**Description**: Log a new sales activity
**Authentication**: Required
**Request Body**:
```json
{
  "type": "meeting",
  "client_name": "John Smith",
  "details": "Discovery call",
  "amount": 5000,              // For proposals/sales
  "date": "2024-03-01T10:00:00Z",
  "deal_id": "uuid",           // Optional deal linking
  "contact_identifier": "john@acme.com",
  "contact_identifier_type": "email"
}
```

### Get Activities
```http
GET /api/activities
```
**Description**: Retrieve user's activities with filtering options
**Authentication**: Required
**Query Parameters**:
- `start_date`: ISO date string
- `end_date`: ISO date string  
- `type`: Activity type filter
- `deal_id`: Filter by associated deal

## 👥 Contact Management API

### Create Contact
```http
POST /api/contacts
```
**Description**: Create a new contact record
**Authentication**: Required
**Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@company.com",
  "phone": "+1234567890",
  "company": "Company Inc",
  "linkedin_url": "https://linkedin.com/in/janedoe"
}
```

### Search Contacts
```http
GET /api/contacts/search
```
**Description**: Search contacts by email, name, or company
**Authentication**: Required
**Query Parameters**:
- `q`: Search query string
- `type`: Search type (email, name, company)

## 🏢 Company Management API

### Create Company
```http
POST /api/companies
```
**Description**: Create a new company record
**Authentication**: Required
**Request Body**:
```json
{
  "name": "Acme Corporation",
  "domain": "acme.com",
  "industry": "Technology",
  "size": "50-100",
  "notes": "Enterprise prospect"
}
```

### Merge Companies
```http
POST /api/companies/merge
```
**Description**: Merge duplicate company records
**Authentication**: Required (Admin recommended)
**Request Body**:
```json
{
  "primary_company_id": "uuid",
  "secondary_company_id": "uuid",
  "merge_strategy": "keep_primary"
}
```

## 🔧 Pipeline Management API

### Get Pipeline Stages
```http
GET /api/stages
```
**Description**: Retrieve all pipeline stages
**Authentication**: Required
**Response**: Array of stage objects with IDs, names, and order

### Update Stage Order
```http
PUT /api/stages/order
```
**Description**: Reorder pipeline stages
**Authentication**: Required (Admin only)
**Request Body**:
```json
{
  "stage_order": ["uuid1", "uuid2", "uuid3"]
}
```

## 👤 User Management API

### Get User Profile
```http
GET /api/user
```
**Description**: Retrieve current user's profile information
**Authentication**: Required
**Response**: User profile including `is_admin` flag

### Update User Profile
```http
PUT /api/user
```
**Description**: Update user profile information
**Authentication**: Required
**Request Body**:
```json
{
  "display_name": "John Smith",
  "email": "john@company.com",
  "phone": "+1234567890"
}
```

### Get All Users (Admin)
```http
GET /api/users
```
**Description**: Retrieve all system users
**Authentication**: Required
**Authorization**: Admin only
**Response**: Array of user profiles with activity statistics

## 📋 Task Management API

### Create Task
```http
POST /api/tasks
```
**Description**: Create a new task
**Authentication**: Required
**Request Body**:
```json
{
  "title": "Follow up with prospect",
  "description": "Send proposal follow-up email",
  "task_type": "follow_up",
  "priority": "high",
  "due_date": "2024-03-05T09:00:00Z",
  "contact_name": "John Smith",
  "company": "Acme Corp"
}
```

### Get Tasks
```http
GET /api/tasks
```
**Description**: Retrieve user's tasks
**Authentication**: Required
**Query Parameters**:
- `status`: Filter by task status
- `priority`: Filter by priority level
- `due_before`: Tasks due before date

## 🔍 Admin-Only Endpoints

### Audit Logs
```http
GET /api/admin/audit-logs
```
**Description**: Retrieve system audit logs
**Authentication**: Required
**Authorization**: Admin only
**Query Parameters**:
- `user_id`: Filter by user
- `action_type`: Filter by action type
- `start_date`: Date range start
- `end_date`: Date range end

**Response**:
```json
{
  "logs": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "action_type": "deal_revenue_split_created",
      "resource_type": "deal",
      "resource_id": "uuid",
      "old_values": {},
      "new_values": {
        "one_off_revenue": 5000,
        "monthly_mrr": 1000
      },
      "timestamp": "2024-03-01T10:00:00Z",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0...",
      "session_id": "session_uuid"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 50
  }
}
```

### Revenue Split Analytics
```http
GET /api/admin/revenue-analytics
```
**Description**: Advanced revenue analytics for split deals
**Authentication**: Required
**Authorization**: Admin only
**Response**: Detailed revenue breakdown, MRR tracking, and forecasting data

### User Impersonation
```http
POST /api/admin/impersonate
```
**Description**: Impersonate another user for support purposes
**Authentication**: Required
**Authorization**: Admin only
**Request Body**:
```json
{
  "target_user_id": "uuid",
  "reason": "Customer support ticket #1234"
}
```
**Response**: Temporary authentication token for target user

### Bulk Data Import
```http
POST /api/admin/bulk-import
```
**Description**: Import bulk data (activities, contacts, deals)
**Authentication**: Required
**Authorization**: Admin only
**Request Body**: Multipart form with CSV file
**Content-Type**: `multipart/form-data`

## 🛡️ Security Features

### Rate Limiting
- **Standard Users**: 100 requests per minute
- **Admin Users**: 500 requests per minute
- **Anonymous**: 20 requests per minute

### Input Validation
All endpoints perform comprehensive input validation:
- SQL injection prevention
- XSS protection
- Data type validation
- Required field validation
- Permission-based field filtering

### Audit Logging
Admin-sensitive operations automatically create audit log entries:
- Deal revenue modifications
- User permission changes
- Bulk data operations
- User impersonation events

### Row Level Security (RLS)
Database-level security policies enforce:
- Users can only access their own data
- Admins have broader access based on `is_admin` flag
- Split deal protection at database level
- Automatic audit trail generation

## 📊 Error Responses

### Standard Error Format
```json
{
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "You don't have permission to access this resource",
    "details": "Admin privileges required for revenue split operations"
  },
  "timestamp": "2024-03-01T10:00:00Z",
  "request_id": "req_uuid"
}
```

### Common Error Codes
- `AUTHENTICATION_REQUIRED` (401)
- `INSUFFICIENT_PERMISSIONS` (403)
- `RESOURCE_NOT_FOUND` (404)
- `VALIDATION_ERROR` (400)
- `RATE_LIMIT_EXCEEDED` (429)
- `INTERNAL_SERVER_ERROR` (500)

## 🚀 API Versioning

Current API Version: `v1`
Base URL: `https://your-domain.com/api`

Future versions will be supported via URL versioning:
- `v1`: Current stable version
- `v2`: Future enhanced version (planned)

## 📝 Changelog

### v1.2.0 (Latest)
- Added admin-only revenue split endpoints
- Enhanced audit logging for financial operations
- Implemented user impersonation for admin support
- Added bulk data import capabilities

### v1.1.0
- Added task management endpoints
- Enhanced contact search functionality
- Implemented company merge operations
- Added advanced filtering options

### v1.0.0
- Initial API release
- Core CRM functionality
- Basic authentication and authorization
- Deal and activity management

---

For additional support or questions about API usage, refer to the comprehensive test suites and implementation examples in the codebase.