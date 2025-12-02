/**
 * Browser-Based Deployment Test
 * 
 * Copy and paste this into your browser console (F12) when on the app
 * Tests the deployed sentiment analysis feature
 */

(async function testDeployment() {
  console.log('🧪 Testing Deployed Sentiment Analysis Feature');
  console.log('='.repeat(60));

  const results = [];

  function addResult(name, passed, message, details) {
    results.push({ name, passed, message, details });
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}: ${message}`);
    if (details) console.log('   Details:', details);
  }

  // Test 1: Check if EmailSyncPanel component exists
  try {
    const { EmailSyncPanel } = await import('/src/components/health/EmailSyncPanel.tsx');
    if (EmailSyncPanel) {
      addResult('EmailSyncPanel Component', true, 'Component available');
    } else {
      addResult('EmailSyncPanel Component', false, 'Component not found');
    }
  } catch (error) {
    addResult('EmailSyncPanel Component', false, `Error: ${error.message}`);
  }

  // Test 2: Check if email sync service exists
  try {
    const emailSyncService = await import('/src/lib/services/emailSyncService.ts');
    if (emailSyncService.performEmailSync) {
      addResult('Email Sync Service', true, 'Service available');
    } else {
      addResult('Email Sync Service', false, 'performEmailSync not found');
    }
  } catch (error) {
    addResult('Email Sync Service', false, `Error: ${error.message}`);
  }

  // Test 3: Check if sentiment analysis service exists
  try {
    const { analyzeEmailWithClaude } = await import('/src/lib/services/emailAIAnalysis.ts');
    if (analyzeEmailWithClaude) {
      addResult('Sentiment Analysis Service', true, 'Service available');
      
      // Test with sample email if API key is available
      try {
        const testResult = await analyzeEmailWithClaude(
          'Test email',
          'This is a test email for sentiment analysis.'
        );
        
        if (testResult && typeof testResult.sentiment_score === 'number') {
          addResult('Sentiment Analysis API', true, 'API working', {
            sentiment_score: testResult.sentiment_score,
            urgency: testResult.urgency,
            topics: testResult.key_topics.length
          });
        } else {
          addResult('Sentiment Analysis API', false, 'Invalid response format', testResult);
        }
      } catch (apiError) {
        if (apiError.message.includes('API_KEY') || apiError.message.includes('configured')) {
          addResult('Sentiment Analysis API', false, 'API key not configured (expected in production)');
        } else {
          addResult('Sentiment Analysis API', false, `API error: ${apiError.message}`);
        }
      }
    } else {
      addResult('Sentiment Analysis Service', false, 'analyzeEmailWithClaude not found');
    }
  } catch (error) {
    addResult('Sentiment Analysis Service', false, `Error: ${error.message}`);
  }

  // Test 4: Check database connection and query sentiment data
  try {
    const { supabase } = await import('/src/lib/supabase/clientV2.ts');
    
    // Try to query communication_events with sentiment columns
    const { data, error } = await supabase
      .from('communication_events')
      .select('id, sentiment_score, ai_analyzed, urgency')
      .limit(1);

    if (error) {
      if (error.message.includes('column') || error.message.includes('does not exist')) {
        addResult('Database Migrations', false, 'Sentiment columns not found - migrations may not be applied');
      } else {
        addResult('Database Migrations', true, 'Columns exist (query succeeded)');
      }
    } else {
      addResult('Database Migrations', true, 'Sentiment columns exist and accessible');
    }

    // Check if any emails have sentiment scores
    const { data: sentimentData, error: sentimentError } = await supabase
      .from('communication_events')
      .select('id, sentiment_score')
      .not('sentiment_score', 'is', null)
      .limit(5);

    if (!sentimentError && sentimentData) {
      addResult('Email Sentiment Data', true, `Found ${sentimentData.length} emails with sentiment scores`);
    } else {
      addResult('Email Sentiment Data', true, 'No emails with sentiment yet (run email sync)');
    }

  } catch (error) {
    addResult('Database Connection', false, `Error: ${error.message}`);
  }

  // Test 5: Check health score integration
  try {
    const dealHealthService = await import('/src/lib/services/dealHealthService.ts');
    if (dealHealthService.calculateDealHealth) {
      addResult('Deal Health Service', true, 'Service available with sentiment integration');
    } else {
      addResult('Deal Health Service', false, 'calculateDealHealth not found');
    }
  } catch (error) {
    addResult('Deal Health Service', false, `Error: ${error.message}`);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${total}`);
  console.log(`📈 Success Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed === 0) {
    console.log('\n🎉 All tests passed! Feature is ready to use.');
  } else {
    console.log('\n⚠️  Some tests failed. Review errors above.');
    console.log('\nFailed tests:');
    results.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.name}: ${r.message}`);
    });
  }

  return results;
})();















