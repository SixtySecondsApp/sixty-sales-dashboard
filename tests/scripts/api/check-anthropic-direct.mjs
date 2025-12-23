#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n🟠 Testing Anthropic Direct API\n');

const apiKey = process.env.VITE_ANTHROPIC_API_KEY;

if (!apiKey) {
  console.log('No Anthropic API key found');
  process.exit(1);
}

// Test with different model versions
const modelsToTest = [
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-3-5-sonnet-20241022',
  'claude-3.5-sonnet-latest',
  'claude-4-sonnet',
  'claude-4-opus',
  'claude-sonnet-4',
  'claude-opus-4',
  'claude-4',
  'claude-3-opus-latest',
  'claude-3-sonnet-latest'
];

async function testModel(model) {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'user', content: 'Say "OK" if you work' }
        ],
        max_tokens: 10,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`✅ ${model} - WORKS`);
      return true;
    } else {
      const error = await response.json();
      if (error.error?.type === 'invalid_request_error' && error.error?.message?.includes('model')) {
        console.log(`❌ ${model} - Not available`);
      } else {
        console.log(`⚠️  ${model} - Error: ${error.error?.message}`);
      }
      return false;
    }
  } catch (err) {
    console.log(`❌ ${model} - Connection error: ${err.message}`);
    return false;
  }
}

// Also check the models endpoint if it exists
async function checkModelsEndpoint() {
  console.log('\nChecking for models endpoint...');
  try {
    const response = await fetch('https://api.anthropic.com/v1/models', {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Models endpoint exists:', data);
    } else {
      console.log('No models endpoint available (404 expected - Anthropic doesn\'t have one)');
    }
  } catch (err) {
    console.log('Models endpoint check failed:', err.message);
  }
}

async function main() {
  console.log('Testing various Claude model names:\n');
  
  for (const model of modelsToTest) {
    await testModel(model);
  }
  
  await checkModelsEndpoint();
  
  console.log('\n📝 Note: Anthropic\'s direct API typically only supports their officially documented models.');
  console.log('Advanced models like Claude 4 may only be available through OpenRouter or other aggregators.\n');
}

main().catch(console.error);