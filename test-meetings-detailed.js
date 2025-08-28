const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8'
const API_KEY = 'sk_test_api_key_for_suite_12345'

async function testMeetings() {
  // Test CREATE with comprehensive-api-test data
  console.log('Testing Meetings CREATE with test data:')
  const createRes1 = await fetch(`${SUPABASE_URL}/functions/v1/api-v1-meetings`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: `Test Meeting ${Date.now()}`,
      start_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      duration_minutes: 30,
      owner_email: 'test@example.com',
      fathom_recording_id: `test_${Date.now()}`
    })
  })
  
  const result1 = await createRes1.json()
  if (result1.error) {
    console.log(`❌ CREATE failed: ${result1.error}`)
    return
  }
  
  const id = result1.data.id
  console.log(`✅ Created meeting with ID: ${id}`)
  
  // Test UPDATE
  console.log('\nTesting Meetings UPDATE:')
  const updateRes = await fetch(`${SUPABASE_URL}/functions/v1/api-v1-meetings/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      title: 'Updated Meeting Title',
      duration_minutes: 60
    })
  })
  
  const updateResult = await updateRes.json()
  if (updateResult.error) {
    console.log(`❌ UPDATE failed: ${updateResult.error}`)
    console.log('Response:', JSON.stringify(updateResult, null, 2))
  } else {
    console.log(`✅ UPDATE succeeded!`)
  }
  
  // Clean up
  await fetch(`${SUPABASE_URL}/functions/v1/api-v1-meetings/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'X-API-Key': API_KEY
    }
  })
}

testMeetings()
