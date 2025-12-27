/**
 * Shared Fathom Transcript Fetching Utilities
 * 
 * Purpose: Reusable functions for fetching transcripts from Fathom API
 * Used by: fathom-sync, fathom-transcript-retry, fetch-transcript, backfill-transcripts
 */

/**
 * Fetch transcript from Fathom API
 * Uses dual authentication: X-Api-Key first, then Bearer fallback
 */
export async function fetchTranscriptFromFathom(
  accessToken: string,
  recordingId: string
): Promise<string | null> {
  try {
    const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/transcript`

    console.log(`[fetchTranscript] Fetching transcript for recording ${recordingId}`)
    console.log(`[fetchTranscript] Token preview: ${accessToken.substring(0, 15)}...${accessToken.substring(accessToken.length - 10)}`)

    // Try Bearer token first (for OAuth tokens - most common in our setup)
    let response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    console.log(`[fetchTranscript] Bearer auth response: ${response.status}`)

    // If Bearer fails with 401, log the error and try X-Api-Key
    if (response.status === 401) {
      const errorBody = await response.text()
      console.log(`[fetchTranscript] 401 error body: ${errorBody.substring(0, 200)}`)
      console.log(`[fetchTranscript] Trying X-Api-Key instead...`)

      response = await fetch(url, {
        headers: {
          'X-Api-Key': accessToken,
          'Content-Type': 'application/json',
        },
      })
      console.log(`[fetchTranscript] X-Api-Key auth response: ${response.status}`)
    }

    if (response.status === 404) {
      // Transcript not yet available - Fathom still processing
      console.log(`ℹ️  Transcript not yet available for recording ${recordingId} (404)`)
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()
      const errorMsg = `HTTP ${response.status}: ${errorText.substring(0, 200)}`
      console.error(`❌ Failed to fetch transcript for recording ${recordingId}: ${errorMsg}`)
      throw new Error(errorMsg)
    }

    const data = await response.json()

    // CRITICAL FIX: Fathom returns an array of transcript objects, not a string
    // Format: { transcript: [{ speaker: { display_name: "..." }, text: "..." }] }
    if (!data) {
      console.log(`⚠️  Empty response for transcript of recording ${recordingId}`)
      return null
    }

    // Handle array format (most common)
    if (Array.isArray(data.transcript)) {
      const lines = data.transcript.map((segment: any) => {
        const speaker = segment?.speaker?.display_name ? `${segment.speaker.display_name}: ` : ''
        const text = segment?.text || ''
        return `${speaker}${text}`.trim()
      })
      const plaintext = lines.join('\n')
      return plaintext
    }

    // Handle string format (fallback)
    if (typeof data.transcript === 'string') {
      return data.transcript
    }

    // If data itself is a string
    if (typeof data === 'string') {
      return data
    }
    
    // If data has a different structure, log it for debugging
    console.log(`⚠️  Unexpected transcript format for recording ${recordingId}:`, JSON.stringify(data).substring(0, 200))
    return null
  } catch (error) {
    console.error(`❌ Error fetching transcript for recording ${recordingId}:`, error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Fetch enhanced summary from Fathom API
 * Uses dual authentication: X-Api-Key first, then Bearer fallback
 */
export async function fetchSummaryFromFathom(
  accessToken: string,
  recordingId: string
): Promise<any | null> {
  try {
    const url = `https://api.fathom.ai/external/v1/recordings/${recordingId}/summary`
    
    // Try X-Api-Key first (preferred for Fathom API)
    let response = await fetch(url, {
      headers: {
        'X-Api-Key': accessToken,
        'Content-Type': 'application/json',
      },
    })
    // If X-Api-Key fails with 401, try Bearer (for OAuth tokens)
    if (response.status === 401) {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      })
    }

    if (response.status === 404) {
      // Summary not yet available
      return null
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`)
    }

    return await response.json()
  } catch (error) {
    return null
  }
}

