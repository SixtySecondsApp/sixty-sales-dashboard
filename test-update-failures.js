const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8'
const API_KEY = 'sk_test_api_key_for_suite_12345'

async function testUpdate(endpoint, createData, updateData) {
  // Create first
  const createRes = await fetch(`${SUPABASE_URL}/functions/v1/api-v1-${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify(createData)
  })
  
  const created = await createRes.json()
  if (created.error) {
    console.log(`CREATE failed: ${created.error}`)
    return
  }
  
  const id = created.data.id
  console.log(`Created ${endpoint} with ID: ${id}`)
  
  // Try to update
  const updateRes = await fetch(`${SUPABASE_URL}/functions/v1/api-v1-${endpoint}/${id}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify(updateData)
  })
  
  const updated = await updateRes.json()
  if (updated.error) {
    console.log(`UPDATE failed: ${updated.error}`)
    console.log('Full response:', JSON.stringify(updated, null, 2))
  } else {
    console.log('UPDATE succeeded!')
  }
  
  // Clean up
  await fetch(`${SUPABASE_URL}/functions/v1/api-v1-${endpoint}/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${ANON_KEY}`,
      'X-API-Key': API_KEY
    }
  })
}

async function main() {
  console.log('Testing Meetings UPDATE:')
  await testUpdate('meetings', {
    name: 'Test Meeting',
    date: new Date().toISOString(),
    duration_minutes: 30,
    owner_email: 'test@example.com',
    fathom_recording_id: 'test_123'
  }, {
    name: 'Updated Meeting',
    duration_minutes: 60
  })
  
  console.log('\n---\n')
  
  console.log('Testing Activities UPDATE:')
  await testUpdate('activities', {
    subject: 'Test Activity',
    type: 'outbound',
    client_name: 'Test Client',
    sales_rep: 'test@example.com',
    details: 'Test details',
    date: new Date().toISOString(),
    status: 'completed'
  }, {
    subject: 'Updated Activity',
    details: 'Updated details'
  })
}

main()
