/**
 * Fix Meeting Ownership Attribution
 *
 * This script re-fetches meeting data from Fathom to fix owner attribution
 * for meetings that were incorrectly assigned during sync.
 *
 * Run with: npx ts-node scripts/fix-meeting-ownership.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Email to user_id mapping cache
const emailToUserCache = new Map<string, string | null>()

async function resolveUserIdFromEmail(email: string): Promise<string | null> {
  if (emailToUserCache.has(email)) {
    return emailToUserCache.get(email)!
  }

  // First check profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single()

  if (profile) {
    emailToUserCache.set(email, profile.id)
    return profile.id
  }

  // Then check fathom_integrations
  const { data: fathomInt } = await supabase
    .from('fathom_integrations')
    .select('user_id')
    .eq('fathom_user_email', email)
    .single()

  if (fathomInt) {
    emailToUserCache.set(email, fathomInt.user_id)
    return fathomInt.user_id
  }

  emailToUserCache.set(email, null)
  return null
}

async function getAccessToken(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('fathom_integrations')
    .select('access_token')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single()

  return data?.access_token || null
}

async function fetchCallFromFathom(recordingId: string, accessToken: string): Promise<any | null> {
  try {
    const response = await fetch(`https://api.fathom.ai/external/v1/recordings/${recordingId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    if (!response.ok) {
      console.log(`  Failed to fetch ${recordingId}: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.log(`  Error fetching ${recordingId}:`, error)
    return null
  }
}

async function fixMeetingOwnership() {
  console.log('🔧 Fixing Meeting Ownership Attribution\n')

  // Get your user ID (the syncing user)
  const yourUserId = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'
  const orgId = '1d1b4274-c9c4-4cb7-9efc-243c90c86f4c'

  // Get access token
  const accessToken = await getAccessToken(yourUserId)
  if (!accessToken) {
    console.error('❌ No access token found. Please ensure Fathom is connected.')
    return
  }

  // Get meetings with NULL owner_email that might need fixing
  const { data: meetings, error } = await supabase
    .from('meetings')
    .select('id, fathom_recording_id, title, owner_user_id, owner_email')
    .eq('owner_user_id', yourUserId)
    .is('owner_email', null)
    .eq('org_id', orgId)
    .not('fathom_recording_id', 'is', null)
    .order('meeting_start', { ascending: false })
    .limit(500) // Process in batches

  if (error) {
    console.error('❌ Error fetching meetings:', error)
    return
  }

  console.log(`📊 Found ${meetings?.length || 0} meetings to check\n`)

  let fixed = 0
  let philCount = 0
  let steveCount = 0
  let otherCount = 0
  let unchanged = 0

  for (const meeting of meetings || []) {
    const callData = await fetchCallFromFathom(meeting.fathom_recording_id, accessToken)

    if (!callData) {
      unchanged++
      continue
    }

    // Try to find the real owner
    const possibleEmails = [
      callData.recorded_by?.email,
      callData.user_email,
      callData.host_email,
    ].filter(Boolean)

    let newOwnerId: string | null = null
    let newOwnerEmail: string | null = null

    for (const email of possibleEmails) {
      const userId = await resolveUserIdFromEmail(email)
      if (userId && userId !== yourUserId) {
        newOwnerId = userId
        newOwnerEmail = email
        break
      }
      if (!newOwnerEmail && email) {
        newOwnerEmail = email
      }
    }

    if (newOwnerId || newOwnerEmail) {
      // Update the meeting
      const updateData: any = {}
      if (newOwnerId) updateData.owner_user_id = newOwnerId
      if (newOwnerEmail) updateData.owner_email = newOwnerEmail

      const { error: updateError } = await supabase
        .from('meetings')
        .update(updateData)
        .eq('id', meeting.id)

      if (!updateError) {
        fixed++
        if (newOwnerEmail?.includes('phil')) philCount++
        else if (newOwnerEmail?.includes('steve')) steveCount++
        else otherCount++

        console.log(`✅ Fixed: ${meeting.title?.substring(0, 40)} → ${newOwnerEmail}`)
      }
    } else {
      unchanged++
    }

    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  console.log('\n📈 Summary:')
  console.log(`  Fixed: ${fixed}`)
  console.log(`    - Phil: ${philCount}`)
  console.log(`    - Steve: ${steveCount}`)
  console.log(`    - Other: ${otherCount}`)
  console.log(`  Unchanged: ${unchanged}`)
}

fixMeetingOwnership().catch(console.error)
