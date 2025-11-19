/**
 * Test script to verify Claude 4.5 Haiku works with OpenRouter
 * Run with: deno run --allow-net --allow-env scripts/test-claude-4-5-haiku.ts
 */

// Try to get API key from environment or .env file
let OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || '';

// If not set, try reading from .env file
if (!OPENROUTER_API_KEY) {
  try {
    const envFile = await Deno.readTextFile('.env');
    const match = envFile.match(/OPENROUTER_API_KEY\s*=\s*["']?([^"'\n]+)["']?/);
    if (match) {
      OPENROUTER_API_KEY = match[1].trim();
    }
  } catch (e) {
    // .env file not found or can't read
  }
}

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found');
  console.error('Please set it as an environment variable or in .env file');
  console.error('Example: export OPENROUTER_API_KEY="your-key-here"');
  Deno.exit(1);
}

console.log('🧪 Testing Claude 4.5 Haiku via OpenRouter...\n');
console.log(`API Key prefix: ${OPENROUTER_API_KEY.substring(0, 10)}...\n`);

const testPrompt = 'Say "Hello, this is Claude 4.5 Haiku!" in exactly 5 words.';

console.log(`📝 Test prompt: "${testPrompt}"\n`);

try {
  const startTime = Date.now();
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://sixtyseconds.video',
      'X-Title': 'Sixty Sales Dashboard Test',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [
        { role: 'user', content: testPrompt }
      ],
      max_tokens: 100,
    }),
  });

  const duration = Date.now() - startTime;

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ API Error:', response.status);
    console.error('Response:', errorText);
    
    try {
      const errorData = JSON.parse(errorText);
      console.error('\n📋 Parsed Error:');
      console.error(JSON.stringify(errorData, null, 2));
    } catch (e) {
      // Not JSON
    }
    
    Deno.exit(1);
  }

  const data = await response.json();
  
  console.log('✅ Success!\n');
  console.log(`⏱️  Response time: ${duration}ms\n`);
  console.log('📊 Response:');
  console.log(JSON.stringify(data, null, 2));
  
  const content = data.choices?.[0]?.message?.content || '';
  console.log(`\n💬 Model response: "${content}"\n`);
  
  if (data.usage) {
    console.log('📈 Token usage:');
    console.log(`   Input tokens: ${data.usage.prompt_tokens || 0}`);
    console.log(`   Output tokens: ${data.usage.completion_tokens || 0}`);
    console.log(`   Total tokens: ${data.usage.total_tokens || 0}`);
  }
  
  console.log('\n✅ Test passed! Claude 4.5 Haiku is working correctly.\n');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  Deno.exit(1);
}

