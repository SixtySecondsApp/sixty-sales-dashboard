#!/usr/bin/env node

/**
 * Test script for full-screen Fathom video thumbnail generation
 *
 * This script tests multiple approaches to get a clean, full-screen video screenshot:
 * 1. Direct Fathom screenshot with video element manipulation
 * 2. Proxy mode to bypass iframe restrictions
 * 3. Various fallback methods
 */

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzEwODkyNzcsImV4cCI6MjA0NjY2NTI3N30.kKOCc-c5_azvJr5sXgLg7ihtpvJ-vB4LhlQyqLQmeJY'

// Test data - replace with your actual values
const TEST_CONFIG = {
  recording_id: 'YOUR_RECORDING_ID', // Replace with actual recording ID
  share_url: 'https://fathom.video/share/YOUR_SHARE_TOKEN', // Replace with actual share URL
  meeting_id: 'YOUR_MEETING_ID', // Replace with actual meeting ID
  timestamp_seconds: 30
}

async function testThumbnailGeneration(mode = 'direct') {
  console.log(`\n🧪 Testing ${mode.toUpperCase()} mode...`)
  console.log('=' + '='.repeat(60))

  const body = {
    ...TEST_CONFIG,
    mode, // Pass mode for testing different approaches
  }

  // Add mode-specific environment flags
  if (mode === 'proxy') {
    body.enable_proxy_mode = true
  } else if (mode === 'direct_enhanced') {
    body.force_video_fullscreen = true
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-video-thumbnail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (data.success && data.thumbnail_url) {
      console.log('✅ SUCCESS!')
      console.log(`📸 Thumbnail URL: ${data.thumbnail_url}`)
      console.log(`📊 DB Updated: ${data.db_updated}`)
      console.log('\n🎯 To view the thumbnail:')
      console.log(`   Open: ${data.thumbnail_url}`)
      return data.thumbnail_url
    } else {
      console.log('❌ FAILED')
      console.log(`Error: ${data.error || 'Unknown error'}`)
      return null
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message)
    return null
  }
}

async function runAllTests() {
  console.log('🚀 Full-Screen Fathom Video Thumbnail Test Suite')
  console.log('=' + '='.repeat(60))
  console.log('\nThis script tests multiple approaches to capture full-screen video')
  console.log('without any Fathom UI chrome (tabs, summary, controls).\n')

  // Test 1: Enhanced Direct Mode (Video Element Manipulation)
  console.log('\n📌 Test 1: Enhanced Direct Mode')
  console.log('   Strategy: Manipulate video element to fill screen')
  console.log('   Expected: Full-screen video, no UI chrome')
  await testThumbnailGeneration('direct_enhanced')

  // Test 2: Proxy Mode (Bypass Iframe Restrictions)
  console.log('\n📌 Test 2: Proxy Mode')
  console.log('   Strategy: Proxy Fathom page, inject fullscreen styles')
  console.log('   Expected: Full-screen video via same-origin access')

  // Set environment variable for proxy mode
  process.env.ENABLE_PROXY_MODE = 'true'
  await testThumbnailGeneration('proxy')

  // Test 3: Standard Direct Mode (Baseline)
  console.log('\n📌 Test 3: Standard Direct Mode (Baseline)')
  console.log('   Strategy: Direct Fathom screenshot')
  console.log('   Expected: May show UI chrome (for comparison)')
  await testThumbnailGeneration('direct')

  console.log('\n' + '=' + '='.repeat(60))
  console.log('🏁 Test suite complete!')
  console.log('\n💡 Tips:')
  console.log('   1. Compare the three thumbnails to see which is cleanest')
  console.log('   2. Enhanced Direct Mode should show only video content')
  console.log('   3. Proxy Mode should also show full-screen video')
  console.log('   4. Standard Direct Mode may show Fathom UI for comparison')
}

// Check if required values are set
if (TEST_CONFIG.recording_id === 'YOUR_RECORDING_ID' ||
    TEST_CONFIG.share_url === 'https://fathom.video/share/YOUR_SHARE_TOKEN') {
  console.error('⚠️  Please update TEST_CONFIG with your actual values:')
  console.error('   - recording_id: From your Fathom recording')
  console.error('   - share_url: The Fathom share URL')
  console.error('   - meeting_id: From your database')
  console.error('\nEdit this file and replace the placeholder values.')
  process.exit(1)
}

// Run the tests
runAllTests().catch(console.error)