/**
 * Test script for Nano Banana Pro image generation
 * Run with: node test-nanobanana.mjs
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Try to get API key from .env file
let OPENROUTER_API_KEY = process.env.VITE_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  try {
    const envFile = readFileSync(join(__dirname, '.env'), 'utf-8');
    const match = envFile.match(/OPENROUTER_API_KEY\s*=\s*["']?([^"'\n]+)["']?/);
    if (match) {
      OPENROUTER_API_KEY = match[1].trim();
    }
  } catch (e) {
    console.error('Could not read .env file');
  }
}

if (!OPENROUTER_API_KEY) {
  console.error('❌ OPENROUTER_API_KEY not found');
  console.error('Please set it as an environment variable or in .env file');
  console.error('Example: export VITE_OPENROUTER_API_KEY="your-key-here"');
  process.exit(1);
}

console.log('🧪 Testing Nano Banana Pro (Gemini 3 Pro Image Preview) via OpenRouter...\n');
console.log(`API Key prefix: ${OPENROUTER_API_KEY.substring(0, 10)}...\n`);

const testPrompt = 'a beautiful sunset over mountains with vibrant colors';

console.log(`📝 Test prompt: "${testPrompt}"\n`);

try {
  console.log('🚀 Making request to OpenRouter...\n');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'http://localhost:5175',
      'X-Title': 'Sixty Sales Dashboard - Nano Banana Pro Test',
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

  console.log(`📊 Response status: ${response.status} ${response.statusText}\n`);

  if (!response.ok) {
    const errorText = await response.text();
    let errorData;
    try {
      errorData = JSON.parse(errorText);
    } catch {
      errorData = { error: { message: errorText } };
    }
    
    console.error('❌ API Error:');
    console.error(JSON.stringify(errorData, null, 2));
    process.exit(1);
  }

  const data = await response.json();
  
  console.log('✅ Response received successfully!\n');
  console.log('📦 Response structure:');
  console.log(`   - Has choices: ${!!data.choices}`);
  console.log(`   - Choices count: ${data.choices?.length || 0}`);
  console.log(`   - Has usage: ${!!data.usage}`);
  
  if (data.choices && data.choices.length > 0) {
    const content = data.choices[0].message?.content;
    console.log(`\n📝 Content type: ${typeof content}`);
    
    if (typeof content === 'string') {
      console.log(`   Content length: ${content.length} characters`);
      console.log(`   Content preview: ${content.substring(0, 200)}...`);
      
      // Check for URLs
      const urlMatches = content.match(/https?:\/\/[^\s]+/g);
      if (urlMatches) {
        console.log(`\n🖼️  Found ${urlMatches.length} image URL(s):`);
        urlMatches.forEach((url, i) => {
          console.log(`   ${i + 1}. ${url}`);
        });
      } else {
        console.log('\n⚠️  No URLs found in content');
      }
    } else if (Array.isArray(content)) {
      console.log(`   Content is array with ${content.length} items`);
      content.forEach((block, i) => {
        console.log(`   Block ${i + 1}: type=${block.type}`);
        if (block.type === 'image_url' && block.image_url?.url) {
          console.log(`      Image URL: ${block.image_url.url}`);
        }
      });
    }
  }
  
  // Check for images in other locations
  if (data.data?.images) {
    console.log(`\n🖼️  Found images in data.data.images: ${data.data.images.length}`);
  }
  if (data.images) {
    console.log(`\n🖼️  Found images in data.images: ${data.images.length}`);
  }
  
  if (data.usage) {
    console.log(`\n💰 Token usage:`);
    console.log(`   - Prompt tokens: ${data.usage.prompt_tokens || 0}`);
    console.log(`   - Completion tokens: ${data.usage.completion_tokens || 0}`);
    console.log(`   - Total tokens: ${data.usage.total_tokens || 0}`);
  }
  
  console.log('\n✅ Test completed successfully!');
  console.log('\n📋 Full response (first 1000 chars):');
  console.log(JSON.stringify(data, null, 2).substring(0, 1000));
  
} catch (error) {
  console.error('\n❌ Test failed:');
  console.error(error.message);
  console.error(error.stack);
  process.exit(1);
}























