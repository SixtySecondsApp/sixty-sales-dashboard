#!/usr/bin/env node

const SUPABASE_URL = "https://ewtuefzeogytgmsnkpmb.supabase.co"
const API_KEY = "sk_test_api_key_for_suite_12345"
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8"

async function testCreate(endpoint, data, name) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify(data)
    })

    const result = await response.json()
    
    if (response.ok && result.data?.id) {
      return true
    } else {
      return false
    }
  } catch (error) {
    return false
  }
}

async function runCreateTests() {
  const tests = [
    {
      endpoint: 'api-v1-tasks',
      data: { title: 'Test Task', status: 'pending', task_type: 'follow_up' },
      name: 'Tasks'
    },
    {
      endpoint: 'api-v1-meetings', 
      data: { title: 'Test Meeting', owner_email: 'test@example.com' },
      name: 'Meetings'
    },
    {
      endpoint: 'api-v1-activities',
      data: { subject: 'Test Activity', type: 'call', status: 'completed' },
      name: 'Activities'
    }
  ]

  let passed = 0
  
  for (const test of tests) {
    const success = await testCreate(test.endpoint, test.data, test.name)
    if (success) passed++
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  if (passed === tests.length) {
  } else {
  }
  
  return passed
}

runCreateTests().catch(console.error)