import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function testThumbnailGeneration() {
  try {
    console.log('🔍 Finding a meeting in the database...')

    // Get a meeting that has a share_url
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select('id, title, fathom_recording_id, share_url, fathom_embed_url, thumbnail_url')
      .not('share_url', 'is', null)
      .limit(1)

    if (error) {
      console.error('❌ Error fetching meeting:', error)
      return
    }

    if (!meetings || meetings.length === 0) {
      console.log('❌ No meetings found with share_url')
      return
    }

    const meeting = meetings[0]
    console.log('✅ Found meeting:', {
      id: meeting.id,
      title: meeting.title,
      fathom_recording_id: meeting.fathom_recording_id,
      share_url: meeting.share_url,
      current_thumbnail: meeting.thumbnail_url
    })

    console.log('\n📸 Calling thumbnail generation edge function...')

    // Call the v2 edge function
    const response = await fetch(`${supabaseUrl}/functions/v1/generate-video-thumbnail-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`
      },
      body: JSON.stringify({
        recording_id: meeting.fathom_recording_id || meeting.id,
        share_url: meeting.share_url,
        fathom_embed_url: meeting.fathom_embed_url || meeting.share_url,
        timestamp_seconds: 30,
        meeting_id: meeting.id
      })
    })

    const result = await response.json()

    if (response.ok) {
      console.log('✅ Thumbnail generated successfully!')
      console.log('📊 Result:', JSON.stringify(result, null, 2))
      console.log('\n🔗 Thumbnail URL:', result.thumbnail_url)
      console.log('🗄️  Database updated:', result.db_updated)
      console.log('🛠️  Method used:', result.method_used)

      // Verify the database was updated
      if (result.db_updated) {
        const { data: updatedMeeting } = await supabase
          .from('meetings')
          .select('thumbnail_url')
          .eq('id', meeting.id)
          .single()

        console.log('\n✅ Verified database update:')
        console.log('   New thumbnail_url:', updatedMeeting.thumbnail_url)
      }
    } else {
      console.error('❌ Thumbnail generation failed:', result)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

testThumbnailGeneration()
