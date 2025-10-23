#!/usr/bin/env node

// Test Fathom Webhook with all three payload types
// Run: node test-fathom-webhook.js <workflow-id>

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8';

// Get workflow ID from command line or use a placeholder
const workflowId = process.argv[2] || 'YOUR-WORKFLOW-ID-HERE';

if (workflowId === 'YOUR-WORKFLOW-ID-HERE') {
    console.log('⚠️  Please provide a workflow ID as an argument:');
    console.log('   node test-fathom-webhook.js <workflow-id>');
    console.log('\nTo get your workflow ID, run this SQL in Supabase:');
    console.log(`
SELECT id as workflow_id
FROM public.user_automation_rules
WHERE rule_name = 'Fathom Meeting Integration'
AND user_id = 'ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459'::UUID
LIMIT 1;
    `);
    process.exit(1);
}

const webhookUrl = `${SUPABASE_URL}/functions/v1/workflow-webhook/${workflowId}`;

// Test Payloads from the user's original request
const payloads = {
    summary: {
        topic: "Sales Demo with Acme Corp",
        meetingUrl: "https://fathom.video/share/abc123",
        shareId: "abc123",
        participants: [
            { name: "John Doe", email: "john@acme.com" },
            { name: "Jane Smith", email: "jane@yourcompany.com" }
        ],
        startedAt: "2024-01-15T10:00:00Z",
        endedAt: "2024-01-15T10:30:00Z",
        duration: 1800,
        chapters: [
            { topic: "Introduction", start: 0, end: 300 },
            { topic: "Product Demo", start: 300, end: 1200 }
        ],
        action_items: [
            { item: "Send proposal", owner: "Jane Smith" },
            { item: "Schedule follow-up", owner: "John Doe" }
        ],
        ai_summary: "Successful product demo with strong interest in enterprise features."
    },
    
    transcript: {
        transcript: `00:00:00 Jane Smith: Good morning everyone, thanks for joining today's demo.
00:00:15 John Doe: Thanks for having us. We're excited to see what you've built.
00:05:30 Jane Smith: Let me show you our key features...
00:10:45 John Doe: This looks great. Can you show us the API integration?
00:15:20 Jane Smith: Absolutely, let me pull that up...
00:25:00 John Doe: Excellent. We'll need to discuss this with our team.
00:29:30 Jane Smith: I'll send over a proposal today and we can schedule a follow-up.`,
        meetingUrl: "https://fathom.video/share/abc123",
        shareId: "abc123",
        duration: 1800
    },
    
    actionItems: {
        action_item: [
            {
                item: "Send proposal to John",
                owner: "Jane Smith",
                due_date: "2024-01-18"
            },
            {
                item: "Prepare API documentation",
                owner: "Tech Team",
                due_date: "2024-01-20"
            },
            {
                item: "Schedule follow-up meeting",
                owner: "John Doe",
                due_date: "2024-01-22"
            }
        ],
        meetingUrl: "https://fathom.video/share/abc123",
        shareId: "abc123"
    }
};

async function testWebhook(payloadType, payload) {
    console.log(`\n🚀 Testing ${payloadType} payload...`);
    console.log(`   URL: ${webhookUrl}`);
    
    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'apikey': SUPABASE_ANON_KEY
            },
            body: JSON.stringify(payload)
        });
        
        const responseText = await response.text();
        let responseData;
        
        try {
            responseData = JSON.parse(responseText);
        } catch {
            responseData = responseText;
        }
        
        if (response.ok) {
            console.log(`✅ ${payloadType} test SUCCESSFUL!`);
            console.log('   Response:', JSON.stringify(responseData, null, 2));
        } else {
            console.log(`❌ ${payloadType} test FAILED`);
            console.log(`   Status: ${response.status} ${response.statusText}`);
            console.log('   Response:', responseData);
        }
        
        return { success: response.ok, data: responseData };
    } catch (error) {
        console.log(`❌ ${payloadType} test ERROR`);
        console.log('   Error:', error.message);
        return { success: false, error: error.message };
    }
}

async function runAllTests() {
    console.log('========================================');
    console.log('🎬 FATHOM WEBHOOK TESTING');
    console.log('========================================');
    console.log(`Workflow ID: ${workflowId}`);
    console.log(`Webhook URL: ${webhookUrl}`);
    
    const results = [];
    
    // Test 1: Summary Payload
    results.push(await testWebhook('SUMMARY', payloads.summary));
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 2: Transcript Payload
    results.push(await testWebhook('TRANSCRIPT', payloads.transcript));
    
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 3: Action Items Payload
    results.push(await testWebhook('ACTION ITEMS', payloads.actionItems));
    
    // Summary
    console.log('\n========================================');
    console.log('📊 TEST SUMMARY');
    console.log('========================================');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.length - successful;
    
    console.log(`✅ Successful: ${successful}`);
    console.log(`❌ Failed: ${failed}`);
    
    if (successful === results.length) {
        console.log('\n🎉 ALL TESTS PASSED! Your Fathom integration is working!');
    } else {
        console.log('\n⚠️  Some tests failed. Check the errors above.');
    }
}

// Run the tests
runAllTests().catch(console.error);