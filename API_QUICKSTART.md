# 🚀 API Quick Start Guide

## 1. Access the API Testing Interface
Open your browser and go to: **http://localhost:5174/api-testing**

## 2. Generate Your First API Key

### In the Dashboard:
1. Click on the **"API Keys"** tab
2. Click **"Generate New Key"** button
3. Give your key a name (e.g., "Development Key")
4. Set permissions (read/write/delete)
5. Set rate limit (e.g., 1000 requests/hour)
6. Click **"Generate"**
7. **⚠️ IMPORTANT: Copy the key immediately!** It won't be shown again.

## 3. Test Your First API Call

### Using the Request Builder:
1. Go to **"Request Builder"** tab
2. **Select a Module** - Click on one of the 6 options:
   - 👥 Contacts
   - 🏢 Companies  
   - 💰 Deals
   - ✅ Tasks
   - 📅 Meetings
   - 📊 Activities

3. **Select an Operation**:
   - **List All** - Get all records
   - **Get Single** - Get one record (requires ID)
   - **Create** - Add a new record
   - **Update** - Modify a record (requires ID)
   - **Delete** - Remove a record (requires ID)

4. The **Endpoint URL** is automatically generated!

5. If creating/updating, the **Body** is pre-filled with sample data

6. Click **"Send Request"** to execute

## 4. Run Comprehensive Test Suite

### Automatic Testing:
1. Generate an API key (see step 2)
2. Go to **"Test Suite"** tab
3. Click **"Run Complete Test Suite"**
4. Watch as it tests ALL operations:
   - Lists all records
   - Creates a new record
   - Gets the created record
   - Updates the record
   - Deletes the record
5. Download the test report when complete

### What the Test Suite Does:
- Tests all 6 modules (Contacts, Companies, Deals, Tasks, Meetings, Activities)
- Runs 5 operations per module (30 tests total)
- Generates unique test data with timestamps
- Tracks response times and success rates
- Provides downloadable JSON report

## 5. Use Your API Key Externally

### Example: Create a Contact
```bash
curl -X POST https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/api-v1-contacts \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone": "+1234567890"
  }'
```

### Example: List All Deals
```bash
curl https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/api-v1-deals \
  -H "X-API-Key: sk_your_api_key_here"
```

### Example: Update a Task
```bash
curl -X PUT https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/api-v1-tasks/task-id-here \
  -H "X-API-Key: sk_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "completed": true
  }'
```

## 6. Available Endpoints

Base URL: `https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1`

| Entity | List All | Get One | Create | Update | Delete |
|--------|----------|---------|--------|--------|--------|
| **Contacts** | GET /api-v1-contacts | GET /api-v1-contacts/{id} | POST /api-v1-contacts | PUT /api-v1-contacts/{id} | DELETE /api-v1-contacts/{id} |
| **Companies** | GET /api-v1-companies | GET /api-v1-companies/{id} | POST /api-v1-companies | PUT /api-v1-companies/{id} | DELETE /api-v1-companies/{id} |
| **Deals** | GET /api-v1-deals | GET /api-v1-deals/{id} | POST /api-v1-deals | PUT /api-v1-deals/{id} | DELETE /api-v1-deals/{id} |
| **Tasks** | GET /api-v1-tasks | GET /api-v1-tasks/{id} | POST /api-v1-tasks | PUT /api-v1-tasks/{id} | DELETE /api-v1-tasks/{id} |
| **Meetings** | GET /api-v1-meetings | GET /api-v1-meetings/{id} | POST /api-v1-meetings | PUT /api-v1-meetings/{id} | DELETE /api-v1-meetings/{id} |
| **Activities** | GET /api-v1-activities | GET /api-v1-activities/{id} | POST /api-v1-activities | PUT /api-v1-activities/{id} | DELETE /api-v1-activities/{id} |

## 7. Query Parameters

### Pagination
- `?limit=10` - Number of records to return
- `?offset=0` - Number of records to skip

### Filtering
- `?filter[field]=value` - Filter by field value
- `?search=term` - Search across text fields

### Sorting
- `?sort=field` - Sort by field (ascending)
- `?sort=-field` - Sort by field (descending)

### Example
```bash
# Get 10 deals, sorted by value descending, skip first 20
curl "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/api-v1-deals?limit=10&offset=20&sort=-value" \
  -H "X-API-Key: sk_your_api_key_here"
```

## 8. Response Format

### Success Response
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "limit": 10,
    "offset": 0
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

## 9. Rate Limiting

Each API key has a rate limit (default: 1000 requests/hour).

Rate limit info is returned in headers:
- `X-RateLimit-Limit` - Your rate limit
- `X-RateLimit-Remaining` - Requests remaining
- `X-RateLimit-Reset` - When limit resets (Unix timestamp)

## 10. Troubleshooting

### API Key Not Working?
- Make sure you're using the `X-API-Key` header (not Authorization)
- Check that your key hasn't expired
- Verify your rate limit hasn't been exceeded

### Getting 404 Errors?
- Ensure you're using the correct base URL
- Check that the entity name is correct (e.g., `api-v1-contacts` not `contacts`)

### Getting 500 Errors?
- Check that your request body is valid JSON
- Ensure required fields are included for POST/PUT requests

## 📚 Full Documentation
See `/docs/API_DOCUMENTATION.md` for complete API reference.