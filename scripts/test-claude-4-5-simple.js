/**
 * Simple test script for Claude 4.5 Haiku via OpenRouter
 * Run with: node scripts/test-claude-4-5-simple.js
 * Requires: OPENROUTER_API_KEY environment variable
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY environment variable not set');
  console.error('   Run: export OPENROUTER_API_KEY="your-key-here"');
  process.exit(1);
}

console.log('🧪 Testing Claude 4.5 Haiku via OpenRouter...\n');
console.log(`API Key prefix: ${OPENROUTER_API_KEY.substring(0, 10)}...\n`);

const testData = {
  model: 'anthropic/claude-haiku-4.5',
  messages: [
    { role: 'user', content: 'Say "Hello, Claude 4.5 Haiku!" in exactly 5 words.' }
  ],
  max_tokens: 50
};

console.log('📝 Request:');
console.log(JSON.stringify(testData, null, 2));
console.log('');

fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'HTTP-Referer': 'https://sixtyseconds.video',
    'X-Title': 'Sixty Sales Dashboard Test',
  },
  body: JSON.stringify(testData),
})
  .then(async (response) => {
    const duration = Date.now() - startTime;
    const text = await response.text();
    
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`⏱️  Response Time: ${duration}ms\n`);
    
    if (!response.ok) {
      console.error('❌ API Error:');
      console.error(text);
      
      try {
        const errorData = JSON.parse(text);
        console.error('\n📋 Parsed Error:');
        console.error(JSON.stringify(errorData, null, 2));
      } catch (e) {
        // Not JSON
      }
      
      process.exit(1);
    }
    
    const data = JSON.parse(text);
    console.log('✅ Success!\n');
    console.log('📊 Full Response:');
    console.log(JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content || '';
    console.log(`\n💬 Model Response: "${content}"\n`);
    
    if (data.usage) {
      console.log('📈 Token Usage:');
      console.log(`   Input: ${data.usage.prompt_tokens || 0}`);
      console.log(`   Output: ${data.usage.completion_tokens || 0}`);
      console.log(`   Total: ${data.usage.total_tokens || 0}`);
    }
    
    console.log('\n✅ Test passed! Claude 4.5 Haiku is working correctly.\n');
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });

const startTime = Date.now();

