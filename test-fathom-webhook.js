import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

// Sample webhook payload based on Fathom's new format
const webhookPayload = {
  "recording_id": "test-webhook-" + Date.now(),
  "title": "Quarterly Business Review - WEBHOOK TEST",
  "meeting_title": "QBR 2025 Q1",
  "url": "https://fathom.video/xyz123",
  "share_url": "https://fathom.video/share/xyz123",
  "created_at": "2025-03-01T17:01:30Z",
  "scheduled_start_time": "2025-03-01T16:00:00Z",
  "scheduled_end_time": "2025-03-01T17:00:00Z",
  "recording_start_time": "2025-03-01T16:01:12Z",
  "recording_end_time": "2025-03-01T17:00:55Z",
  "calendar_invitees_domains_type": "one_or_more_external",
  "default_summary": {
    "template_name": "general",
    "markdown_formatted": "## Summary\nWebhook test - reviewing Q1 objectives.\n"
  },
  "action_items": [
    {
      "description": "Email revised proposal to client",
      "user_generated": false,
      "completed": false,
      "recording_timestamp": "00:10:45",
      "recording_playback_url": "https://fathom.video/xyz123#t=645"
    }
  ],
  "calendar_invitees": [
    {
      "name": "Test User",
      "email": "test@acme.com",
      "is_external": false,
      "email_domain": "acme.com"
    }
  ],
  "recorded_by": {
    "name": "Test User",
    "email": "test@acme.com",
    "team": "Sales"
  }
}

async function testWebhook() {
  try {
    console.log('🧪 Testing Fathom webhook endpoint...')
    console.log(`📡 Webhook URL: ${supabaseUrl}/functions/v1/fathom-webhook`)

    const response = await fetch(`${supabaseUrl}/functions/v1/fathom-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload)
    })

    console.log(`\n📊 Response status: ${response.status}`)

    const result = await response.json()
    console.log(`📊 Response:`, JSON.stringify(result, null, 2))

    if (response.ok) {
      console.log('\n✅ Webhook test successful!')
    } else {
      console.log('\n❌ Webhook test failed!')
    }

  } catch (error) {
    console.error('❌ Test error:', error.message)
  }
}

testWebhook()
