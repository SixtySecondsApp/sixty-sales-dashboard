#!/usr/bin/env node

// Test the deployed Edge Function directly on Supabase
const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8';
const WORKFLOW_ID = 'b224bdca-7bfa-4bc3-b30e-68e0045a64f8';

const testPayload = {
  "shareId": `test-meeting-${Date.now()}`,  // Fathom meeting ID
  "id": `test-meeting-${Date.now()}`,
  "title": "Sales Demo with Acme Corp - Edge Function Test",
  "topic": "Sales Demo with Acme Corp",
  "date": new Date().toISOString(),
  "duration": 45,
  "participants": [
    {
      "name": "Phil Robertson",
      "email": "phil@sixtyseconds.video",
      "role": "host"
    },
    {
      "name": "John Smith",
      "email": "john@acme.com",
      "role": "participant"
    }
  ],
  "summary": "Testing Edge Function deployment for Fathom integration.",
  "action_items": [
    {
      "text": "Send proposal with custom pricing",
      "owner": "Phil Robertson",
      "due_date": new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      "category": "Proposal"
    },
    {
      "text": "Schedule follow-up call for next week",
      "owner": "Phil Robertson",
      "due_date": new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      "category": "Follow-up"
    },
    {
      "text": "Review security documentation",
      "owner": "John Smith",
      "due_date": new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      "category": "Documentation"
    }
  ],
  "topics_discussed": [
    "Product features",
    "Enterprise pricing",
    "Implementation timeline",
    "Security requirements"
  ],
  "next_steps": [
    "Proposal review",
    "Technical evaluation",
    "Budget approval"
  ]
};

async function testEdgeFunction() {
  console.log('🚀 Testing Edge Function at Supabase...\n');
  console.log(`URL: ${SUPABASE_URL}/functions/v1/workflow-webhook`);
  console.log(`Workflow ID: ${WORKFLOW_ID}\n`);
  
  try {
    // Test the Edge Function directly with workflow ID in the URL path
    // No authorization header needed for webhook endpoint
    const response = await fetch(`${SUPABASE_URL}/functions/v1/workflow-webhook/${WORKFLOW_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });
    
    const responseText = await response.text();
    
    console.log(`📬 Response Status: ${response.status} ${response.statusText}`);
    console.log('📋 Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('\n📄 Response Body:');
    
    try {
      const responseData = JSON.parse(responseText);
      console.log(JSON.stringify(responseData, null, 2));
    } catch {
      console.log(responseText);
    }
    
    if (response.ok) {
      console.log('\n✅ Success! Edge Function is working properly.');
      console.log('\n📝 Next steps:');
      console.log('1. Check the meetings page for Phil to see the new meeting');
      console.log('2. Check the tasks list to see the sales rep tasks with categories');
      console.log('3. Verify that prospect tasks only appear in meeting details');
      console.log('4. Test task completion sync between TaskList and MeetingDetail');
    } else {
      console.log('\n❌ Error: Edge Function returned an error status.');
      console.log('Please check the logs in Supabase dashboard for more details.');
    }
    
  } catch (error) {
    console.error('❌ Network error:', error.message);
    console.log('\nTroubleshooting tips:');
    console.log('1. Check if Supabase project is running');
    console.log('2. Verify Edge Function was deployed successfully');
    console.log('3. Check network connectivity');
  }
}

// Run the test
testEdgeFunction();