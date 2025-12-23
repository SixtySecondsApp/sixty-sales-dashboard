import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY

async function testTokenRefresh() {
  try {
    console.log('🔄 Testing automatic token refresh...\n')

    // Step 1: Get user_id from fathom_integrations
    console.log('📋 Step 1: Fetching integration details...')
    const integrationResponse = await fetch(`${supabaseUrl}/rest/v1/fathom_integrations?select=user_id,fathom_user_email,token_expires_at&is_active=eq.true`, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    })

    const integrations = await integrationResponse.json()

    if (!integrations || integrations.length === 0) {
      console.log('❌ No active integrations found')
      return
    }

    const integration = integrations[0]
    console.log(`✅ Found integration for user: ${integration.user_id}`)
    console.log(`   Email: ${integration.fathom_user_email || 'N/A'}`)
    console.log(`   Token expires: ${integration.token_expires_at}`)

    const expiresAt = new Date(integration.token_expires_at)
    const now = new Date()
    const hoursSinceExpiry = (now - expiresAt) / (1000 * 60 * 60)
    console.log(`   Status: Expired ${hoursSinceExpiry.toFixed(1)} hours ago\n`)

    // Step 2: Trigger sync to force token refresh
    console.log('🚀 Step 2: Triggering sync to refresh token...')
    const syncResponse = await fetch(`${supabaseUrl}/functions/v1/fathom-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sync_type: 'manual',
        user_id: integration.user_id,
        limit: 1  // Only sync 1 meeting to test
      })
    })

    console.log(`   Response status: ${syncResponse.status}`)

    const syncResult = await syncResponse.json()
    console.log(`   Response:`, JSON.stringify(syncResult, null, 2))

    if (syncResponse.ok) {
      console.log('\n✅ Sync successful! Token should be refreshed.')

      // Step 3: Verify token was refreshed
      console.log('\n📋 Step 3: Verifying token refresh...')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

      const verifyResponse = await fetch(`${supabaseUrl}/rest/v1/fathom_integrations?select=token_expires_at,updated_at&is_active=eq.true`, {
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`
        }
      })

      const verifyData = await verifyResponse.json()
      const newExpiry = new Date(verifyData[0].token_expires_at)

      if (newExpiry > now) {
        console.log(`✅ TOKEN REFRESHED!`)
        console.log(`   New expiry: ${verifyData[0].token_expires_at}`)
        console.log(`   Valid for: ${((newExpiry - now) / (1000 * 60 * 60)).toFixed(1)} hours`)
        console.log(`   Last updated: ${verifyData[0].updated_at}`)
      } else {
        console.log(`⚠️  Token still expired: ${verifyData[0].token_expires_at}`)
      }

    } else {
      console.log('\n❌ Sync failed!')
      console.log('   This might mean:')
      console.log('   1. Refresh token is also expired (need to reconnect)')
      console.log('   2. OAuth credentials are incorrect')
      console.log('   3. Fathom user revoked access')
    }

  } catch (error) {
    console.error('❌ Test error:', error.message)
  }
}

testTokenRefresh()
