#!/usr/bin/env node

// Test script for the Sales Analysis Workflow webhook
// This sends a test Fathom payload to the workflow webhook endpoint

const workflowId = 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8'; // Andrew's Sales Analysis Workflow
const webhookUrl = `http://localhost:5173/api/workflows/webhook/${workflowId}`;

// Sample Fathom webhook payload (Mark Ingram meeting)
const fathomPayload = {
  // Meeting data
  "meeting": {
    "title": "Meeting with Mark Ingram",
    "scheduled_start_time": "2024-01-15T10:00:00Z",
    "scheduled_end_time": "2024-01-15T10:30:00Z",
    "invitees": [
      { "name": "Mark Ingram", "email": "mark@company.com", "is_external": true },
      { "name": "Phil", "email": "phil@sixtyseconds.video", "is_external": false }
    ],
    "has_external_invitees": true,
    "external_domains": ["company.com"]
  },
  
  // Recording data
  "recording": {
    "recording_share_url": "https://fathom.video/share/abc123",
    "recording_url": "https://fathom.video/calls/abc123",
    "recording_duration_in_minutes": 30
  },
  
  // User data
  "fathom_user": {
    "name": "Phil",
    "email": "phil@sixtyseconds.video",
    "team": "Sales Team"
  },
  
  // Core identifiers
  "shareId": "abc123-" + Date.now(), // This is the Fathom meeting ID
  "fathom_recording_id": "FATHOM-TEST-" + Date.now(),
  
  // AI Summary
  "ai_summary": "Phil met with Mark Ingram to discuss video solutions for sales enablement. Mark expressed strong interest and requested a proposal with pricing. Key topics covered included personalized video content for prospects and sales enablement improvements. Mark showed positive engagement and requested follow-up.",
  
  // Sales metrics (AI-generated)
  "sentiment_score": 0.8,
  "coach_rating": 8.5,
  "coach_summary": "Strong discovery call with good engagement. Effective needs identification and value proposition presentation.",
  "talk_time_rep_pct": 35,
  "talk_time_customer_pct": 65,
  "talk_time_judgement": "Well-balanced - good customer engagement",
  
  // Action items (would normally come in a separate webhook)
  "action_items": [
    {
      "item": "Send proposal to Mark with pricing details",
      "owner": "Phil",
      "owner_email": "phil@sixtyseconds.video",
      "due_date": "2024-01-15",
      "ai_generated": true,
      "recording_timestamp": "00:25:30",
      "recording_playback_url": "https://fathom.video/share/abc123?t=1530"
    },
    {
      "item": "Schedule follow-up meeting for later this week",
      "owner": "Phil",
      "owner_email": "phil@sixtyseconds.video",
      "due_date": "2024-01-18",
      "ai_generated": true,
      "recording_timestamp": "00:26:15",
      "recording_playback_url": "https://fathom.video/share/abc123?t=1575"
    },
    {
      "item": "Review proposal internally before meeting",
      "owner": "Mark",
      "owner_email": "mark@company.com",
      "due_date": "2024-01-17",
      "ai_generated": false,
      "recording_timestamp": "00:26:45",
      "recording_playback_url": "https://fathom.video/share/abc123?t=1605"
    }
  ]
};

console.log('🚀 Testing Sales Analysis Workflow webhook');
console.log('📍 Webhook URL:', webhookUrl);
console.log('📦 Payload:', JSON.stringify(fathomPayload, null, 2));
console.log('');

// Send the webhook
fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(fathomPayload)
})
.then(response => {
  console.log('📡 Response Status:', response.status, response.statusText);
  return response.text();
})
.then(data => {
  console.log('📊 Response Body:', data);
  
  if (data) {
    try {
      const json = JSON.parse(data);
      console.log('✅ Webhook processed successfully!');
      console.log('📋 Result:', JSON.stringify(json, null, 2));
    } catch (e) {
      console.log('📄 Raw response:', data);
    }
  }
})
.catch(error => {
  console.error('❌ Error sending webhook:', error);
});