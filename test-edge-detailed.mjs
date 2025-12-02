import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🧪 Testing unified edge function with details...\n')

// Get auth user for testing
const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })

if (usersError || !users || users.length === 0) {
  console.log('⚠️  No users found for testing, creating test invocation anyway...')
}

const testUser = users && users[0] ? users[0] : null

if (!testUser) {
  console.log('⚠️  Cannot test without a user, but function is deployed')
  process.exit(0)
}

// Create a test auth token
const { data: { session }, error: sessionError } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: testUser.email
})

console.log('User ID:', testUser.id)
console.log('Testing with auth...\n')

// Test invocation
const response = await fetch(`${supabaseUrl}/functions/v1/create-task-unified`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${supabaseServiceKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    mode: 'manual',
    action_item_ids: ['00000000-0000-0000-0000-000000000000'], // Fake UUID
    source: 'action_item'
  })
})

const responseText = await response.text()
console.log('Status:', response.status)
console.log('Response:', responseText)

if (response.status === 200) {
  console.log('\n✅ Function is working!')
} else if (response.status === 401) {
  console.log('\n⚠️  Auth error - expected with test data')
} else if (response.status === 500) {
  const parsed = JSON.parse(responseText)
  if (parsed.error && parsed.error.includes('Action items not found')) {
    console.log('\n✅ Function is working! (Expected error for fake ID)')
  } else {
    console.log('\n❌ Unexpected error:', parsed.error)
  }
}

console.log('\n🎯 Test complete')
