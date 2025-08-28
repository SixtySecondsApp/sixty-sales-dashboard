#!/usr/bin/env node

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8'
const API_KEY = 'sk_test_api_key_for_suite_12345'

async function testActivities() {
  console.log('🧪 Testing Activities API\n')
  
  // Test with 'call' type (will fail due to constraint)
  console.log('1. Testing with type="call":')
  try {
    const callResponse = await fetch(`${SUPABASE_URL}/functions/v1/api-v1-activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        subject: `Test Call Activity ${Date.now()}`,
        type: 'call',
        client_name: `Test Client ${Date.now()}`,
        sales_rep: 'test@example.com',
        details: 'Test activity details',
        date: new Date().toISOString(),
        status: 'completed'
      })
    })
    
    const callResult = await callResponse.json()
    if (callResult.error) {
      console.log(`❌ Failed: ${callResult.error}`)
    } else {
      console.log(`✅ Success! ID: ${callResult.data.id}`)
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
  }
  
  // Test with 'outbound' type (should work)
  console.log('\n2. Testing with type="outbound":')
  try {
    const outboundResponse = await fetch(`${SUPABASE_URL}/functions/v1/api-v1-activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        subject: `Test Outbound Activity ${Date.now()}`,
        type: 'outbound',
        client_name: `Test Client ${Date.now()}`,
        sales_rep: 'test@example.com',
        details: 'Test activity details',
        date: new Date().toISOString(),
        status: 'completed'
      })
    })
    
    const outboundResult = await outboundResponse.json()
    if (outboundResult.error) {
      console.log(`❌ Failed: ${outboundResult.error}`)
    } else {
      console.log(`✅ Success! ID: ${outboundResult.data.id}`)
      
      // Clean up - delete the created activity
      await fetch(`${SUPABASE_URL}/functions/v1/api-v1-activities/${outboundResult.data.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'X-API-Key': API_KEY
        }
      })
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
  }
  
  // Test with 'sale' type (should work based on existing data)
  console.log('\n3. Testing with type="sale":')
  try {
    const saleResponse = await fetch(`${SUPABASE_URL}/functions/v1/api-v1-activities`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      },
      body: JSON.stringify({
        subject: `Test Sale Activity ${Date.now()}`,
        type: 'sale',
        client_name: `Test Client ${Date.now()}`,
        sales_rep: 'test@example.com',
        details: 'Test activity details',
        date: new Date().toISOString(),
        status: 'completed'
      })
    })
    
    const saleResult = await saleResponse.json()
    if (saleResult.error) {
      console.log(`❌ Failed: ${saleResult.error}`)
    } else {
      console.log(`✅ Success! ID: ${saleResult.data.id}`)
      
      // Clean up - delete the created activity
      await fetch(`${SUPABASE_URL}/functions/v1/api-v1-activities/${saleResult.data.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${ANON_KEY}`,
          'X-API-Key': API_KEY
        }
      })
    }
  } catch (error) {
    console.log(`❌ Error: ${error.message}`)
  }
  
  console.log('\n---')
  console.log('📝 Summary:')
  console.log('• The database constraint only allows: "outbound" and "sale"')
  console.log('• The test should use type="outbound" not type="call"')
  console.log('• Update your test file to use "outbound" for activities')
}

testActivities()