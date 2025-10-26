/**
 * Test Fathom Sync with 10 Mock Calls
 *
 * This script simulates 10 Fathom webhook calls to test the complete integration
 */

const SUPABASE_URL = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const PROJECT_REF = 'ewtuefzeogytgmsnkpmb';

// Get service role key from environment
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY not found');
  console.error('Set it with: export SUPABASE_SERVICE_ROLE_KEY=your_key');
  Deno.exit(1);
}

// Mock Fathom webhook payloads
const mockFathomCalls = [
  {
    meeting_id: 'fathom_test_001',
    title: 'Discovery Call - TechCorp',
    start_time: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    duration: 30,
    participants: [
      { name: 'Sarah Johnson', email: 'sarah@techcorp.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Discussed product requirements and pricing',
    action_items: [
      {
        title: 'Send pricing proposal',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 2,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_002',
    title: 'Demo - StartupXYZ',
    start_time: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    duration: 45,
    participants: [
      { name: 'Mike Chen', email: 'mike@startupxyz.io' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Product demo, very interested in enterprise features',
    action_items: [
      {
        title: 'Schedule follow-up call',
        assignee: 'admin@salesdemo.com',
        priority: 'medium',
        deadline: 3,
      },
      {
        title: 'Review enterprise pricing',
        assignee: 'mike@startupxyz.io',
        priority: 'medium',
        deadline: 5,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_003',
    title: 'Q1 Planning - MegaCorp',
    start_time: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    duration: 60,
    participants: [
      { name: 'Jennifer White', email: 'jwhite@megacorp.com' },
      { name: 'Tom Black', email: 'tblack@megacorp.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Quarterly planning discussion with key stakeholders',
    action_items: [
      {
        title: 'Prepare Q1 roadmap presentation',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 7,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_004',
    title: 'Onboarding Call - FastGrow Inc',
    start_time: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    duration: 30,
    participants: [
      { name: 'Alex Rivera', email: 'alex@fastgrow.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'New customer onboarding, setup assistance needed',
    action_items: [
      {
        title: 'Send onboarding documentation',
        assignee: 'admin@salesdemo.com',
        priority: 'urgent',
        deadline: 1,
      },
      {
        title: 'Schedule training session',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 3,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_005',
    title: 'Technical Review - DataDriven LLC',
    start_time: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    duration: 45,
    participants: [
      { name: 'Dr. Lisa Park', email: 'lpark@datadriven.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Deep dive into technical requirements and integration needs',
    action_items: [
      {
        title: 'Provide API documentation',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 2,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_006',
    title: 'Pricing Discussion - GreenTech Solutions',
    start_time: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
    duration: 30,
    participants: [
      { name: 'Carlos Martinez', email: 'carlos@greentech.io' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Negotiating pricing for 50+ user seats',
    action_items: [
      {
        title: 'Prepare custom pricing proposal',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 2,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_007',
    title: 'Security Review - BankCorp',
    start_time: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
    duration: 90,
    participants: [
      { name: 'Maria Garcia', email: 'mgarcia@bankcorp.com' },
      { name: 'John Smith', email: 'jsmith@bankcorp.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Comprehensive security and compliance review',
    action_items: [
      {
        title: 'Provide SOC 2 documentation',
        assignee: 'admin@salesdemo.com',
        priority: 'urgent',
        deadline: 1,
      },
      {
        title: 'Schedule security audit',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 5,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_008',
    title: 'Product Feedback - InnovateLabs',
    start_time: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    duration: 30,
    participants: [
      { name: 'Emma Wilson', email: 'emma@innovatelabs.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Gathering feedback on recent feature releases',
    action_items: [
      {
        title: 'Document feature requests',
        assignee: 'admin@salesdemo.com',
        priority: 'medium',
        deadline: 7,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_009',
    title: 'Renewal Discussion - LegacyCorp',
    start_time: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
    duration: 45,
    participants: [
      { name: 'Robert Taylor', email: 'rtaylor@legacycorp.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Discussing contract renewal and expansion opportunities',
    action_items: [
      {
        title: 'Send renewal proposal',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 3,
      },
      {
        title: 'Review contract terms',
        assignee: 'rtaylor@legacycorp.com',
        priority: 'medium',
        deadline: 7,
      },
    ],
  },
  {
    meeting_id: 'fathom_test_010',
    title: 'Executive Briefing - GlobalEnterprises',
    start_time: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
    duration: 60,
    participants: [
      { name: 'CEO Amanda Lee', email: 'alee@globalent.com' },
      { name: 'CFO David Kim', email: 'dkim@globalent.com' },
      { name: 'Internal User', email: 'admin@salesdemo.com' },
    ],
    summary: 'Executive-level briefing on strategic partnership',
    action_items: [
      {
        title: 'Prepare executive summary',
        assignee: 'admin@salesdemo.com',
        priority: 'urgent',
        deadline: 1,
      },
      {
        title: 'Schedule C-level demo',
        assignee: 'admin@salesdemo.com',
        priority: 'high',
        deadline: 5,
      },
    ],
  },
];

interface TestResult {
  meeting_id: string;
  status: 'success' | 'error';
  response?: any;
  error?: string;
  timing: number;
}

async function callFathomSync(payload: any): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/fathom-sync`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const timing = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      return {
        meeting_id: payload.meeting_id,
        status: 'error',
        error: `HTTP ${response.status}: ${error}`,
        timing,
      };
    }

    const data = await response.json();
    return {
      meeting_id: payload.meeting_id,
      status: 'success',
      response: data,
      timing,
    };
  } catch (error) {
    return {
      meeting_id: payload.meeting_id,
      status: 'error',
      error: error.message,
      timing: Date.now() - startTime,
    };
  }
}

async function runBulkTest() {
  console.log('==========================================');
  console.log('🧪 Testing Fathom Sync with 10 Mock Calls');
  console.log('==========================================');
  console.log('');

  const results: TestResult[] = [];
  let successCount = 0;
  let errorCount = 0;
  let totalTime = 0;

  for (let i = 0; i < mockFathomCalls.length; i++) {
    const call = mockFathomCalls[i];
    console.log(`📞 Test ${i + 1}/10: ${call.title}`);

    const result = await callFathomSync(call);
    results.push(result);
    totalTime += result.timing;

    if (result.status === 'success') {
      console.log(`   ✅ Success (${result.timing}ms)`);
      successCount++;
    } else {
      console.log(`   ❌ Error: ${result.error}`);
      errorCount++;
    }

    // Small delay between calls to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  console.log('');
  console.log('==========================================');
  console.log('📊 BULK TEST RESULTS');
  console.log('==========================================');
  console.log(`Total Tests: ${results.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log(`⏱️  Average Time: ${Math.round(totalTime / results.length)}ms`);
  console.log(`⏱️  Total Time: ${totalTime}ms`);
  console.log('');

  if (errorCount > 0) {
    console.log('❌ FAILED TESTS:');
    results
      .filter((r) => r.status === 'error')
      .forEach((r) => {
        console.log(`   - ${r.meeting_id}: ${r.error}`);
      });
    console.log('');
  }

  console.log('==========================================');

  return {
    total: results.length,
    successful: successCount,
    errors: errorCount,
    avgTime: Math.round(totalTime / results.length),
    results,
  };
}

// Run the test
if (import.meta.main) {
  await runBulkTest();
}
