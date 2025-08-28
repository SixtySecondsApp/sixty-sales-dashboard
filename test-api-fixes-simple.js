#!/usr/bin/env node

// Simple API fix verification script
const SUPABASE_URL = "https://ewtuefzeogytgmsnkpmb.supabase.co"
const API_KEY = "sk_test_api_key_for_suite_12345"
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8"

const endpoints = [
  'api-v1-contacts',
  'api-v1-companies', 
  'api-v1-deals',
  'api-v1-tasks',
  'api-v1-meetings',
  'api-v1-activities'
]

async function testEndpoint(endpoint) {
  try {
    console.log(`Testing ${endpoint}...`)
    
    const response = await fetch(`${SUPABASE_URL}/functions/v1/${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      timeout: 10000
    })

    if (!response.ok) {
      console.log(`❌ ${endpoint}: HTTP ${response.status}`)
      return false
    }

    const data = await response.json()
    
    if (data.error) {
      console.log(`❌ ${endpoint}: ${data.error}`)
      return false
    }

    if (data.data && Array.isArray(data.data)) {
      console.log(`✅ ${endpoint}: ${data.data.length} records`)
      return true
    }

    console.log(`⚠️ ${endpoint}: Unexpected response format`)
    return false

  } catch (error) {
    console.log(`❌ ${endpoint}: ${error.message}`)
    return false
  }
}

async function runTests() {
  console.log('🧪 Testing API Fixes\n')
  
  let passed = 0
  let total = endpoints.length

  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint)
    if (success) passed++
    await new Promise(resolve => setTimeout(resolve, 500)) // Brief delay
  }

  console.log(`\n📊 Results: ${passed}/${total} APIs working`)
  
  if (passed === total) {
    console.log('🎉 All API fixes verified!')
  } else {
    console.log('⚠️ Some APIs still need fixes')
  }

  return passed
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests()
    .then(passed => process.exit(passed === endpoints.length ? 0 : 1))
    .catch(error => {
      console.error('Test failed:', error.message)
      process.exit(1)
    })
}

export { runTests }