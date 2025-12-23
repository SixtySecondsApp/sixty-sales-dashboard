import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

console.log('🧪 Testing Unified Task Creation System\n')

// Test 1: Sign in
console.log('Test 1: Authentication...')
const { data: { user }, error: authError } = await supabase.auth.getUser()

if (authError || !user) {
  console.log('⚠️  Not authenticated. Please sign in to the app first.')
  console.log('   Navigate to http://localhost:5175 and sign in, then run this test again.')
  process.exit(0)
}

console.log(`✅ Authenticated as: ${user.email}\n`)

// Test 2: Check for action items
console.log('Test 2: Checking for action items...')
const { data: actionItems, error: itemsError } = await supabase
  .from('meeting_action_items')
  .select('id, title, importance, synced_to_task')
  .eq('synced_to_task', false)
  .limit(3)

if (itemsError) {
  console.log('❌ Error fetching action items:', itemsError.message)
  process.exit(1)
}

if (!actionItems || actionItems.length === 0) {
  console.log('⚠️  No unsynced action items found.')
  console.log('   Create a meeting with action items first, then run this test.')
  process.exit(0)
}

console.log(`✅ Found ${actionItems.length} unsynced action items:`)
actionItems.forEach((item, i) => {
  console.log(`   ${i + 1}. ${item.title} (${item.importance})`)
})
console.log('')

// Test 3: Call unified function
console.log('Test 3: Calling create-task-unified function...')
const testItemId = actionItems[0].id

const { data: result, error: funcError } = await supabase.functions.invoke('create-task-unified', {
  body: {
    mode: 'manual',
    action_item_ids: [testItemId],
    source: 'action_item'
  }
})

if (funcError) {
  console.log('❌ Function invocation error:', funcError.message)
  console.log('   Details:', funcError)
  process.exit(1)
}

console.log('✅ Function responded successfully!')
console.log('   Response:', JSON.stringify(result, null, 2))

// Test 4: Verify task was created
if (result.success && result.tasks_created > 0) {
  console.log('\n✅ Task created successfully!')
  console.log('   Tasks created:', result.tasks_created)

  // Check if action item was updated
  const { data: updatedItem } = await supabase
    .from('meeting_action_items')
    .select('synced_to_task, linked_task_id')
    .eq('id', testItemId)
    .single()

  if (updatedItem?.synced_to_task && updatedItem?.linked_task_id) {
    console.log('✅ Bidirectional sync verified!')
    console.log('   Action item synced_to_task:', updatedItem.synced_to_task)
    console.log('   Linked task ID:', updatedItem.linked_task_id)
  } else {
    console.log('⚠️  Bidirectional sync may not be complete')
  }
} else {
  console.log('⚠️  No tasks were created')
  if (result.errors) {
    console.log('   Errors:', result.errors)
  }
}

console.log('\n🎯 Test complete!')
