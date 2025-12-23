import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

async function testFathomSync() {
  try {
    console.log('🧪 Testing Fathom sync with token refresh...')
    console.log(`📡 Sync URL: ${supabaseUrl}/functions/v1/fathom-sync`)

    const response = await fetch(`${supabaseUrl}/functions/v1/fathom-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        sync_type: 'manual',
        limit: 5 // Only sync last 5 meetings for testing
      })
    })

    console.log(`\n📊 Response status: ${response.status}`)

    const result = await response.json()
    console.log(`📊 Response:`, JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('\n✅ Sync test successful!')
      console.log(`   Meetings found: ${result.total_meetings_found || 0}`)
      console.log(`   Meetings synced: ${result.meetings_synced || 0}`)
      if (result.errors && result.errors.length > 0) {
        console.log(`   Errors: ${result.errors.length}`)
      }
    } else {
      console.log('\n❌ Sync test failed!')
    }

  } catch (error) {
    console.error('❌ Test error:', error.message)
  }
}

testFathomSync()
