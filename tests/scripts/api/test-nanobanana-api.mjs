/**
 * Direct API test for Nano Banana Pro
 * Tests the OpenRouter API endpoint directly
 */

let OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY || 
                         process.env.OPENROUTER_API_KEY ||
                         process.argv[2]; // Allow passing as argument

// Clean up the API key (remove quotes, whitespace)
if (OPENROUTER_API_KEY) {
  OPENROUTER_API_KEY = OPENROUTER_API_KEY.trim().replace(/^["']|["']$/g, '');
}

if (!OPENROUTER_API_KEY || OPENROUTER_API_KEY.length < 10) {
  console.error('❌ OPENROUTER_API_KEY not found or invalid');
  console.error('Usage: node test-nanobanana-api.mjs [API_KEY]');
  console.error('Or set: export VITE_OPENROUTER_API_KEY="your-key"');
  console.error('\n💡 Make sure your API key:');
  console.error('   - Starts with "sk-or-v1-" (OpenRouter format)');
  console.error('   - Is at least 20 characters long');
  console.error('   - Has no extra quotes or spaces');
  process.exit(1);
}

// Validate API key format
if (!OPENROUTER_API_KEY.startsWith('sk-or-v1-') && !OPENROUTER_API_KEY.startsWith('sk-or-')) {
  console.warn('⚠️  Warning: API key format looks unusual');
  console.warn(`   Expected format: sk-or-v1-... or sk-or-...`);
  console.warn(`   Got: ${OPENROUTER_API_KEY.substring(0, 15)}...`);
}

console.log('🧪 Testing Nano Banana Pro API (Gemini 3 Pro Image Preview)\n');
console.log(`API Key: ${OPENROUTER_API_KEY.substring(0, 10)}...${OPENROUTER_API_KEY.substring(OPENROUTER_API_KEY.length - 4)}`);
console.log(`API Key length: ${OPENROUTER_API_KEY.length} characters\n`);

const testPrompt = 'a beautiful sunset over mountains with vibrant colors';

console.log(`📝 Test prompt: "${testPrompt}"\n`);
console.log('🚀 Making request to OpenRouter API...\n');

try {
  const startTime = Date.now();
  
  // Debug: Show what we're sending (without exposing full key)
  const authHeader = `Bearer ${OPENROUTER_API_KEY}`;
  console.log('🔍 Request Debug:');
  console.log(`   Authorization header: ${authHeader.substring(0, 20)}...${authHeader.substring(authHeader.length - 10)}`);
  console.log(`   Header length: ${authHeader.length} characters\n`);
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
      'HTTP-Referer': 'http://localhost:5175',
      'X-Title': 'Sixty Sales Dashboard - Nano Banana Pro API Test',
    },
    body: JSON.stringify({
      model: 'google/gemini-3-pro-image-preview',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: testPrompt
            }
          ]
        }
      ],
      aspect_ratio: 'square',
    }),
  });

  const duration = Date.now() - startTime;
  console.log(`⏱️  Response time: ${duration}ms\n`);
  console.log(`📊 Status: ${response.status} ${response.statusText}\n`);

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: { message: errorText } };
    }
    
    console.error('❌ API Error Response:');
    console.error(JSON.stringify(errorData, null, 2));
    
    // Provide helpful troubleshooting
    if (response.status === 401) {
      console.error('\n🔧 Troubleshooting 401 Unauthorized:');
      console.error('   1. Verify your API key is correct');
      console.error('   2. Check that the key starts with "sk-or-v1-" or "sk-or-"');
      console.error('   3. Ensure there are no extra spaces or quotes');
      console.error('   4. Verify your OpenRouter account has credits');
      console.error('   5. Try regenerating your API key at https://openrouter.ai/keys');
      console.error('\n💡 To test with a new key:');
      console.error(`   node test-nanobanana-api.mjs "your-new-key-here"`);
    }
    
    process.exit(1);
  }

  const data = await response.json();
  
  console.log('✅ API Response received!\n');
  console.log('📦 Response Structure:');
  console.log(`   - Has choices: ${!!data.choices}`);
  console.log(`   - Choices count: ${data.choices?.length || 0}`);
  console.log(`   - Has usage data: ${!!data.usage}`);
  console.log(`   - Has error: ${!!data.error}\n`);
  
  if (data.error) {
    console.error('❌ API returned error:');
    console.error(JSON.stringify(data.error, null, 2));
    process.exit(1);
  }
  
  if (data.choices && data.choices.length > 0) {
    const choice = data.choices[0];
    const content = choice.message?.content;
    
    console.log('📝 Content Analysis:');
    console.log(`   - Content type: ${typeof content}`);
    
    if (typeof content === 'string') {
      console.log(`   - Content length: ${content.length} characters`);
      console.log(`   - Content preview: ${content.substring(0, 300)}...\n`);
      
      // Check for image URLs
      const urlMatches = content.match(/https?:\/\/[^\s"']+/g);
      if (urlMatches && urlMatches.length > 0) {
        console.log(`🖼️  Found ${urlMatches.length} image URL(s):`);
        urlMatches.forEach((url, i) => {
          console.log(`   ${i + 1}. ${url}`);
        });
        console.log('\n✅ SUCCESS: Image URLs found in response!');
      } else {
        console.log('⚠️  No image URLs found in string content');
        console.log('   This might indicate the response format has changed');
      }
    } else if (Array.isArray(content)) {
      console.log(`   - Content is array with ${content.length} items\n`);
      content.forEach((block, i) => {
        console.log(`   Block ${i + 1}:`);
        console.log(`      - Type: ${block.type}`);
        if (block.type === 'image_url' && block.image_url?.url) {
          console.log(`      - Image URL: ${block.image_url.url}`);
          console.log('\n✅ SUCCESS: Image URL found in content array!');
        } else if (block.type === 'text') {
          console.log(`      - Text preview: ${block.text?.substring(0, 100)}...`);
        }
      });
    } else {
      console.log(`   - Content value: ${JSON.stringify(content).substring(0, 200)}...\n`);
    }
  } else {
    console.log('⚠️  No choices in response');
  }
  
  // Check for images in other response locations
  if (data.data?.images) {
    console.log(`\n🖼️  Found images in data.data.images: ${data.data.images.length}`);
    data.data.images.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
    });
  }
  if (data.images && Array.isArray(data.images)) {
    console.log(`\n🖼️  Found images in data.images: ${data.images.length}`);
    data.images.forEach((url, i) => {
      console.log(`   ${i + 1}. ${url}`);
    });
  }
  
  if (data.usage) {
    console.log(`\n💰 Token Usage:`);
    console.log(`   - Prompt tokens: ${data.usage.prompt_tokens || 0}`);
    console.log(`   - Completion tokens: ${data.usage.completion_tokens || 0}`);
    console.log(`   - Total tokens: ${data.usage.total_tokens || 0}`);
  }
  
  console.log('\n📋 Full Response (first 2000 chars):');
  console.log(JSON.stringify(data, null, 2).substring(0, 2000));
  if (JSON.stringify(data).length > 2000) {
    console.log('... (truncated)');
  }
  
  console.log('\n✅ Test completed successfully!');
  
} catch (error) {
  console.error('\n❌ Test failed with error:');
  console.error(`   Message: ${error.message}`);
  if (error.stack) {
    console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
  }
  process.exit(1);
}

