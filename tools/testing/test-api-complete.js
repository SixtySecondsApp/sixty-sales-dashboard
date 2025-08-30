#!/usr/bin/env node

/**
 * Complete API Testing Suite for Sixty Sales Dashboard CRM
 * 
 * This script tests all API endpoints with proper authentication,
 * rate limiting, error handling, and data validation.
 */

import https from 'https';
import fs from 'fs';

// Configuration - Update these values for your environment
const CONFIG = {
  BASE_URL: process.env.SUPABASE_URL?.replace('//', '//').replace(/\/+$/, '') || 'https://your-project.supabase.co',
  API_KEY: process.env.TEST_API_KEY || 'sk_test_key_here',
  VERBOSE: process.env.VERBOSE === 'true' || false,
  TIMEOUT: 10000,
  MAX_RETRIES: 3
};

// Test data templates
const TEST_DATA = {
  company: {
    name: `Test Company ${Date.now()}`,
    website: 'https://testcompany.com',
    industry: 'Technology',
    size: '10-50',
    description: 'Test company for API testing'
  },
  contact: {
    first_name: 'John',
    last_name: 'Doe',
    email: `john.doe.${Date.now()}@test.com`,
    phone: '+1-555-0123',
    title: 'CEO'
  },
  deal: {
    name: `Test Deal ${Date.now()}`,
    value: 50000,
    one_off_revenue: 10000,
    monthly_mrr: 2000,
    probability: 75,
    expected_close_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  },
  task: {
    title: `Test Task ${Date.now()}`,
    description: 'This is a test task created by the API test suite',
    status: 'todo',
    priority: 'medium',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  },
  meeting: {
    title: `Test Meeting ${Date.now()}`,
    description: 'API test meeting',
    meeting_type: 'demo',
    status: 'scheduled',
    start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    end_time: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()
  },
  activity: {
    type: 'call',
    subject: `Test Call ${Date.now()}`,
    details: 'Test activity created by API test suite',
    date: new Date().toISOString(),
    status: 'completed',
    outcome: 'positive'
  }
};

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  summary: {}
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// HTTP client with retry logic
async function makeRequest(method, path, data = null, retries = CONFIG.MAX_RETRIES) {
  return new Promise((resolve, reject) => {
    const url = `${CONFIG.BASE_URL}/functions/v1${path}`;
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'X-API-Key': CONFIG.API_KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'API-Test-Suite/1.0.0'
      },
      timeout: CONFIG.TIMEOUT
    };

    const req = https.request(options, (res) => {
      let body = '';
      
      res.on('data', (chunk) => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            data: body ? JSON.parse(body) : null
          };
          resolve(response);
        } catch (error) {
          reject(new Error(`JSON parse error: ${error.message}`));
        }
      });
    });

    req.on('error', async (error) => {
      if (retries > 0) {
        console.log(`${colors.yellow}Retrying request (${retries} attempts left)...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          const result = await makeRequest(method, path, data, retries - 1);
          resolve(result);
        } catch (retryError) {
          reject(retryError);
        }
      } else {
        reject(error);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test runner function
async function runTest(name, testFn) {
  testResults.total++;
  
  try {
    console.log(`${colors.blue}Running: ${name}${colors.reset}`);
    const startTime = Date.now();
    await testFn();
    const duration = Date.now() - startTime;
    
    testResults.passed++;
    console.log(`${colors.green}✓ ${name} (${duration}ms)${colors.reset}`);
    return true;
  } catch (error) {
    testResults.failed++;
    testResults.errors.push({ test: name, error: error.message });
    console.log(`${colors.red}✗ ${name}: ${error.message}${colors.reset}`);
    return false;
  }
}

// Test assertion helpers
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function assertExists(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

function assertValidUUID(uuid, message) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(uuid)) {
    throw new Error(`${message}: invalid UUID format`);
  }
}

// Global test data storage
const createdRecords = {
  companies: [],
  contacts: [],
  deals: [],
  tasks: [],
  meetings: [],
  activities: []
};

// API Authentication Tests
async function testApiKeyAuthentication() {
  // Test missing API key
  const noKeyResponse = await makeRequest('GET', '/api-v1-contacts', null, 0);
  assertEquals(noKeyResponse.status, 401, 'Should return 401 for missing API key');
  assert(noKeyResponse.data.error.includes('API key required'), 'Should indicate API key is required');

  // Test invalid API key format
  const invalidKeyResponse = await makeRequest('GET', '/api-v1-contacts', null, 0);
  // This would need a modified request function to test invalid keys
  
  // Test valid API key (implicitly tested by other tests)
}

// Companies API Tests
async function testCompaniesAPI() {
  let companyId;

  // Test create company
  const createResponse = await makeRequest('POST', '/api-v1-companies', TEST_DATA.company);
  assertEquals(createResponse.status, 201, 'Create company should return 201');
  assertExists(createResponse.data.data, 'Create response should have data');
  assertValidUUID(createResponse.data.data.id, 'Company should have valid UUID');
  
  companyId = createResponse.data.data.id;
  createdRecords.companies.push(companyId);
  
  // Test get company
  const getResponse = await makeRequest('GET', `/api-v1-companies/${companyId}`);
  assertEquals(getResponse.status, 200, 'Get company should return 200');
  assertEquals(getResponse.data.data.name, TEST_DATA.company.name, 'Company name should match');

  // Test list companies
  const listResponse = await makeRequest('GET', '/api-v1-companies?limit=10');
  assertEquals(listResponse.status, 200, 'List companies should return 200');
  assert(Array.isArray(listResponse.data.data), 'Companies list should be an array');
  assert(listResponse.data.count >= 1, 'Should have at least one company');

  // Test search companies
  const searchResponse = await makeRequest('GET', `/api-v1-companies?search=${encodeURIComponent('Test Company')}`);
  assertEquals(searchResponse.status, 200, 'Search companies should return 200');

  // Test update company
  const updateData = { description: 'Updated test description' };
  const updateResponse = await makeRequest('PUT', `/api-v1-companies/${companyId}`, updateData);
  assertEquals(updateResponse.status, 200, 'Update company should return 200');
  assertEquals(updateResponse.data.data.description, updateData.description, 'Description should be updated');

  return companyId;
}

// Contacts API Tests
async function testContactsAPI(companyId) {
  let contactId;

  // Test create contact
  const contactData = { ...TEST_DATA.contact, company_id: companyId };
  const createResponse = await makeRequest('POST', '/api-v1-contacts', contactData);
  assertEquals(createResponse.status, 201, 'Create contact should return 201');
  assertExists(createResponse.data.data, 'Create response should have data');
  assertValidUUID(createResponse.data.data.id, 'Contact should have valid UUID');
  
  contactId = createResponse.data.data.id;
  createdRecords.contacts.push(contactId);

  // Test get contact
  const getResponse = await makeRequest('GET', `/api-v1-contacts/${contactId}`);
  assertEquals(getResponse.status, 200, 'Get contact should return 200');
  assertEquals(getResponse.data.data.email, contactData.email, 'Contact email should match');

  // Test list contacts
  const listResponse = await makeRequest('GET', '/api-v1-contacts?limit=10');
  assertEquals(listResponse.status, 200, 'List contacts should return 200');
  assert(Array.isArray(listResponse.data.data), 'Contacts list should be an array');

  // Test duplicate email validation
  const duplicateResponse = await makeRequest('POST', '/api-v1-contacts', contactData);
  assertEquals(duplicateResponse.status, 409, 'Duplicate email should return 409');

  // Test update contact
  const updateData = { phone: '+1-555-9999' };
  const updateResponse = await makeRequest('PUT', `/api-v1-contacts/${contactId}`, updateData);
  assertEquals(updateResponse.status, 200, 'Update contact should return 200');
  assertEquals(updateResponse.data.data.phone, updateData.phone, 'Phone should be updated');

  return contactId;
}

// Deals API Tests
async function testDealsAPI() {
  let dealId;

  // First, get a valid stage_id
  const stagesResponse = await makeRequest('GET', '/stages');
  if (stagesResponse.status !== 200 || !stagesResponse.data.data?.length) {
    throw new Error('No deal stages available for testing');
  }
  
  const stageId = stagesResponse.data.data[0].id;
  
  // Test create deal
  const dealData = { ...TEST_DATA.deal, stage_id: stageId };
  const createResponse = await makeRequest('POST', '/api-v1-deals', dealData);
  assertEquals(createResponse.status, 201, 'Create deal should return 201');
  assertExists(createResponse.data.data, 'Create response should have data');
  assertValidUUID(createResponse.data.data.id, 'Deal should have valid UUID');
  
  dealId = createResponse.data.data.id;
  createdRecords.deals.push(dealId);

  // Test calculated fields
  const expectedLTV = (dealData.monthly_mrr * 3) + dealData.one_off_revenue;
  assertEquals(createResponse.data.data.ltv, expectedLTV, 'LTV should be calculated correctly');

  // Test get deal
  const getResponse = await makeRequest('GET', `/api-v1-deals/${dealId}`);
  assertEquals(getResponse.status, 200, 'Get deal should return 200');
  assertEquals(getResponse.data.data.name, dealData.name, 'Deal name should match');

  // Test list deals
  const listResponse = await makeRequest('GET', '/api-v1-deals?limit=10');
  assertEquals(listResponse.status, 200, 'List deals should return 200');
  assert(Array.isArray(listResponse.data.data), 'Deals list should be an array');

  // Test filter by value
  const filterResponse = await makeRequest('GET', `/api-v1-deals?min_value=40000&max_value=60000`);
  assertEquals(filterResponse.status, 200, 'Filter deals should return 200');

  // Test update deal
  const updateData = { probability: 80 };
  const updateResponse = await makeRequest('PUT', `/api-v1-deals/${dealId}`, updateData);
  assertEquals(updateResponse.status, 200, 'Update deal should return 200');
  assertEquals(updateResponse.data.data.probability, updateData.probability, 'Probability should be updated');

  return dealId;
}

// Tasks API Tests
async function testTasksAPI(dealId) {
  let taskId;

  // Test create task
  const taskData = { ...TEST_DATA.task, deal_id: dealId };
  const createResponse = await makeRequest('POST', '/api-v1-tasks', taskData);
  assertEquals(createResponse.status, 201, 'Create task should return 201');
  assertExists(createResponse.data.data, 'Create response should have data');
  assertValidUUID(createResponse.data.data.id, 'Task should have valid UUID');
  
  taskId = createResponse.data.data.id;
  createdRecords.tasks.push(taskId);

  // Test get task
  const getResponse = await makeRequest('GET', `/api-v1-tasks/${taskId}`);
  assertEquals(getResponse.status, 200, 'Get task should return 200');
  assertEquals(getResponse.data.data.title, taskData.title, 'Task title should match');

  // Test list tasks
  const listResponse = await makeRequest('GET', '/api-v1-tasks?limit=10');
  assertEquals(listResponse.status, 200, 'List tasks should return 200');
  assert(Array.isArray(listResponse.data.data), 'Tasks list should be an array');

  // Test filter by status
  const filterResponse = await makeRequest('GET', '/api-v1-tasks?status=todo');
  assertEquals(filterResponse.status, 200, 'Filter tasks should return 200');

  // Test update task status
  const updateData = { status: 'completed' };
  const updateResponse = await makeRequest('PUT', `/api-v1-tasks/${taskId}`, updateData);
  assertEquals(updateResponse.status, 200, 'Update task should return 200');
  assertEquals(updateResponse.data.data.status, updateData.status, 'Status should be updated');
  assertExists(updateResponse.data.data.completed_at, 'Completed_at should be set');

  return taskId;
}

// Meetings API Tests
async function testMeetingsAPI(dealId) {
  let meetingId;

  // Test create meeting
  const meetingData = { ...TEST_DATA.meeting, deal_id: dealId };
  const createResponse = await makeRequest('POST', '/api-v1-meetings', meetingData);
  assertEquals(createResponse.status, 201, 'Create meeting should return 201');
  assertExists(createResponse.data.data, 'Create response should have data');
  assertValidUUID(createResponse.data.data.id, 'Meeting should have valid UUID');
  
  meetingId = createResponse.data.data.id;
  createdRecords.meetings.push(meetingId);

  // Test get meeting
  const getResponse = await makeRequest('GET', `/api-v1-meetings/${meetingId}`);
  assertEquals(getResponse.status, 200, 'Get meeting should return 200');
  assertEquals(getResponse.data.data.title, meetingData.title, 'Meeting title should match');

  // Test list meetings
  const listResponse = await makeRequest('GET', '/api-v1-meetings?limit=10');
  assertEquals(listResponse.status, 200, 'List meetings should return 200');
  assert(Array.isArray(listResponse.data.data), 'Meetings list should be an array');

  // Test upcoming meetings filter
  const upcomingResponse = await makeRequest('GET', '/api-v1-meetings?upcoming=true');
  assertEquals(upcomingResponse.status, 200, 'Upcoming meetings should return 200');

  // Test update meeting
  const updateData = { status: 'completed' };
  const updateResponse = await makeRequest('PUT', `/api-v1-meetings/${meetingId}`, updateData);
  assertEquals(updateResponse.status, 200, 'Update meeting should return 200');
  assertEquals(updateResponse.data.data.status, updateData.status, 'Status should be updated');

  return meetingId;
}

// Activities API Tests
async function testActivitiesAPI(dealId) {
  let activityId;

  // Test create activity
  const activityData = { ...TEST_DATA.activity, deal_id: dealId };
  const createResponse = await makeRequest('POST', '/api-v1-activities', activityData);
  assertEquals(createResponse.status, 201, 'Create activity should return 201');
  assertExists(createResponse.data.data, 'Create response should have data');
  assertValidUUID(createResponse.data.data.id, 'Activity should have valid UUID');
  
  activityId = createResponse.data.data.id;
  createdRecords.activities.push(activityId);

  // Test get activity
  const getResponse = await makeRequest('GET', `/api-v1-activities/${activityId}`);
  assertEquals(getResponse.status, 200, 'Get activity should return 200');
  assertEquals(getResponse.data.data.subject, activityData.subject, 'Activity subject should match');

  // Test list activities
  const listResponse = await makeRequest('GET', '/api-v1-activities?limit=10');
  assertEquals(listResponse.status, 200, 'List activities should return 200');
  assert(Array.isArray(listResponse.data.data), 'Activities list should be an array');

  // Test filter by type
  const filterResponse = await makeRequest('GET', '/api-v1-activities?type=call');
  assertEquals(filterResponse.status, 200, 'Filter activities should return 200');

  // Test this month filter
  const thisMonthResponse = await makeRequest('GET', '/api-v1-activities?this_month=true');
  assertEquals(thisMonthResponse.status, 200, 'This month activities should return 200');

  // Test update activity
  const updateData = { outcome: 'neutral' };
  const updateResponse = await makeRequest('PUT', `/api-v1-activities/${activityId}`, updateData);
  assertEquals(updateResponse.status, 200, 'Update activity should return 200');
  assertEquals(updateResponse.data.data.outcome, updateData.outcome, 'Outcome should be updated');

  return activityId;
}

// Error handling tests
async function testErrorHandling() {
  // Test invalid UUID format
  const invalidUUIDResponse = await makeRequest('GET', '/api-v1-contacts/invalid-uuid');
  assertEquals(invalidUUIDResponse.status, 400, 'Invalid UUID should return 400');

  // Test not found
  const notFoundResponse = await makeRequest('GET', '/api-v1-contacts/00000000-0000-0000-0000-000000000000');
  assertEquals(notFoundResponse.status, 404, 'Not found should return 404');

  // Test validation error
  const validationResponse = await makeRequest('POST', '/api-v1-contacts', { first_name: '' });
  assertEquals(validationResponse.status, 400, 'Validation error should return 400');

  // Test method not allowed
  const methodResponse = await makeRequest('PATCH', '/api-v1-contacts');
  assertEquals(methodResponse.status, 405, 'Method not allowed should return 405');
}

// Pagination tests
async function testPagination() {
  // Test pagination parameters
  const page1Response = await makeRequest('GET', '/api-v1-contacts?limit=5&offset=0');
  assertEquals(page1Response.status, 200, 'First page should return 200');
  assert(page1Response.data.pagination, 'Response should include pagination info');
  
  const page2Response = await makeRequest('GET', '/api-v1-contacts?limit=5&offset=5');
  assertEquals(page2Response.status, 200, 'Second page should return 200');

  // Test maximum limit
  const maxLimitResponse = await makeRequest('GET', '/api-v1-contacts?limit=2000');
  assertEquals(maxLimitResponse.status, 200, 'Max limit should be enforced');
  assert(maxLimitResponse.data.data.length <= 1000, 'Should enforce maximum page size');
}

// Rate limiting tests (if enabled)
async function testRateLimiting() {
  const response = await makeRequest('GET', '/api-v1-contacts?limit=1');
  
  // Check rate limit headers
  assert(response.headers['x-ratelimit-limit'], 'Should include rate limit header');
  assert(response.headers['x-ratelimit-remaining'], 'Should include remaining requests header');
  assert(response.headers['x-ratelimit-reset'], 'Should include reset time header');

  console.log(`Rate limit: ${response.headers['x-ratelimit-limit']}`);
  console.log(`Remaining: ${response.headers['x-ratelimit-remaining']}`);
}

// Cleanup function
async function cleanup() {
  console.log(`${colors.yellow}Cleaning up test data...${colors.reset}`);
  
  // Delete in reverse dependency order
  const deleteOrder = [
    { type: 'activities', endpoint: '/api-v1-activities' },
    { type: 'meetings', endpoint: '/api-v1-meetings' },
    { type: 'tasks', endpoint: '/api-v1-tasks' },
    { type: 'deals', endpoint: '/api-v1-deals' },
    { type: 'contacts', endpoint: '/api-v1-contacts' },
    { type: 'companies', endpoint: '/api-v1-companies' }
  ];

  for (const { type, endpoint } of deleteOrder) {
    for (const id of createdRecords[type]) {
      try {
        await makeRequest('DELETE', `${endpoint}/${id}`);
        console.log(`${colors.green}Deleted ${type}: ${id}${colors.reset}`);
      } catch (error) {
        console.log(`${colors.yellow}Failed to delete ${type} ${id}: ${error.message}${colors.reset}`);
      }
    }
  }
}

// Main test execution
async function runAllTests() {
  console.log(`${colors.bold}Starting API Test Suite${colors.reset}`);
  console.log(`Base URL: ${CONFIG.BASE_URL}`);
  console.log(`API Key: ${CONFIG.API_KEY ? '***' + CONFIG.API_KEY.slice(-4) : 'Not set'}`);
  console.log('');

  try {
    // Authentication tests
    await runTest('API Key Authentication', testApiKeyAuthentication);

    // Core entity tests
    const companyId = await runTest('Companies API', () => testCompaniesAPI());
    const contactId = await runTest('Contacts API', () => testContactsAPI(companyId));
    const dealId = await runTest('Deals API', () => testDealsAPI());
    
    // Related entity tests
    await runTest('Tasks API', () => testTasksAPI(dealId));
    await runTest('Meetings API', () => testMeetingsAPI(dealId));
    await runTest('Activities API', () => testActivitiesAPI(dealId));

    // System tests
    await runTest('Error Handling', testErrorHandling);
    await runTest('Pagination', testPagination);
    await runTest('Rate Limiting', testRateLimiting);

  } catch (error) {
    console.error(`${colors.red}Test execution error: ${error.message}${colors.reset}`);
    testResults.failed++;
    testResults.errors.push({ test: 'Test Execution', error: error.message });
  } finally {
    // Always attempt cleanup
    await cleanup();
  }

  // Print results
  console.log('');
  console.log(`${colors.bold}Test Results Summary${colors.reset}`);
  console.log(`Total: ${testResults.total}`);
  console.log(`${colors.green}Passed: ${testResults.passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${testResults.failed}${colors.reset}`);
  
  if (testResults.errors.length > 0) {
    console.log('');
    console.log(`${colors.red}${colors.bold}Errors:${colors.reset}`);
    testResults.errors.forEach(({ test, error }) => {
      console.log(`  ${colors.red}${test}: ${error}${colors.reset}`);
    });
  }

  // Save results to file
  const resultsFile = `api-test-results-${Date.now()}.json`;
  fs.writeFileSync(resultsFile, JSON.stringify({
    ...testResults,
    timestamp: new Date().toISOString(),
    config: CONFIG
  }, null, 2));
  
  console.log('');
  console.log(`Results saved to: ${resultsFile}`);
  
  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle process termination
process.on('SIGINT', async () => {
  console.log(`${colors.yellow}\nReceived SIGINT, cleaning up...${colors.reset}`);
  await cleanup();
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log(`${colors.yellow}\nReceived SIGTERM, cleaning up...${colors.reset}`);
  await cleanup();
  process.exit(1);
});

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(error => {
    console.error(`${colors.red}Fatal error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

export {
  runAllTests,
  makeRequest,
  testResults
};