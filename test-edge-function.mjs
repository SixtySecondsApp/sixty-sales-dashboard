import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

console.log('🧪 Testing unified edge function...\n')

// Test 1: Check if function exists
console.log('Test 1: Checking if create-task-unified function exists...')
try {
  const { data, error } = await supabase.functions.invoke('create-task-unified', {
    body: {
      mode: 'manual',
      action_item_ids: ['test-id-that-does-not-exist'],
      source: 'action_item'
    }
  })
  
  if (error) {
    console.log('❌ Function invocation error:', error.message)
  } else {
    console.log('✅ Function exists and responded')
    console.log('Response:', JSON.stringify(data, null, 2))
  }
} catch (err) {
  console.log('❌ Function test failed:', err.message)
}

console.log('\n🎯 Edge function test complete')
