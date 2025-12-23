#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '.env') });

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

console.log(`${colors.cyan}🧪 Testing AI Provider Connections${colors.reset}\n`);

// Test OpenAI
async function testOpenAI() {
  console.log(`${colors.blue}Testing OpenAI...${colors.reset}`);
  const apiKey = process.env.VITE_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.log(`${colors.yellow}⚠️  OpenAI API key not configured${colors.reset}`);
    return false;
  }

  try {
    // Test with models endpoint
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const gptModels = data.data.filter(m => m.id.includes('gpt')).slice(0, 3);
      console.log(`${colors.green}✅ OpenAI connected successfully!${colors.reset}`);
      console.log(`   Available models: ${gptModels.map(m => m.id).join(', ')}`);
      
      // Test a completion
      const completionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a test assistant.' },
            { role: 'user', content: 'Reply with OK if you can read this.' }
          ],
          max_tokens: 10,
          temperature: 0.1,
        }),
      });

      if (completionResponse.ok) {
        console.log(`   Chat completion test: ${colors.green}Success${colors.reset}`);
      } else {
        const error = await completionResponse.json();
        console.log(`   Chat completion test: ${colors.red}Failed - ${error.error?.message}${colors.reset}`);
      }
      
      return true;
    } else {
      const error = await response.json();
      console.log(`${colors.red}❌ OpenAI connection failed: ${error.error?.message || response.statusText}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ OpenAI connection error: ${error.message}${colors.reset}`);
    return false;
  }
}

// Test Anthropic
async function testAnthropic() {
  console.log(`\n${colors.blue}Testing Anthropic...${colors.reset}`);
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    console.log(`${colors.yellow}⚠️  Anthropic API key not configured${colors.reset}`);
    return false;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        system: 'You are a test assistant.',
        messages: [
          { role: 'user', content: 'Reply with OK if you can read this.' }
        ],
        max_tokens: 10,
        temperature: 0.1,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log(`${colors.green}✅ Anthropic connected successfully!${colors.reset}`);
      console.log(`   Response: "${data.content[0].text}"`);
      console.log(`   Available models: Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku`);
      return true;
    } else {
      const error = await response.json();
      console.log(`${colors.red}❌ Anthropic connection failed: ${error.error?.message || response.statusText}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Anthropic connection error: ${error.message}${colors.reset}`);
    return false;
  }
}

// Test OpenRouter
async function testOpenRouter() {
  console.log(`\n${colors.blue}Testing OpenRouter...${colors.reset}`);
  const apiKey = process.env.VITE_OPENROUTER_API_KEY;
  
  if (!apiKey) {
    console.log(`${colors.yellow}⚠️  OpenRouter API key not configured${colors.reset}`);
    return false;
  }

  try {
    // Test models endpoint
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const topModels = data.data.slice(0, 5);
      console.log(`${colors.green}✅ OpenRouter connected successfully!${colors.reset}`);
      console.log(`   Available models: ${topModels.map(m => m.id).join(', ')}...`);
      
      // Test a completion
      const completionResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'Sixty Sales Dashboard Test',
        },
        body: JSON.stringify({
          model: 'openai/gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are a test assistant.' },
            { role: 'user', content: 'Reply with OK if you can read this.' }
          ],
          max_tokens: 10,
          temperature: 0.1,
        }),
      });

      if (completionResponse.ok) {
        console.log(`   Chat completion test: ${colors.green}Success${colors.reset}`);
      } else {
        const error = await completionResponse.json();
        console.log(`   Chat completion test: ${colors.red}Failed - ${error.error?.message}${colors.reset}`);
      }
      
      return true;
    } else {
      const error = await response.json();
      console.log(`${colors.red}❌ OpenRouter connection failed: ${error.error?.message || response.statusText}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ OpenRouter connection error: ${error.message}${colors.reset}`);
    return false;
  }
}

// Test Google Gemini
async function testGemini() {
  console.log(`\n${colors.blue}Testing Google Gemini...${colors.reset}`);
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    console.log(`${colors.yellow}⚠️  Gemini API key not configured${colors.reset}`);
    return false;
  }

  try {
    // Test models endpoint
    const modelsResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );

    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      const generativeModels = modelsData.models
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .slice(0, 3);
      
      console.log(`${colors.green}✅ Gemini connected successfully!${colors.reset}`);
      console.log(`   Available models: ${generativeModels.map(m => m.name.replace('models/', '')).join(', ')}`);
      
      // Test a completion
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: 'Reply with OK if you can read this.' }
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 10,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
        console.log(`   Chat completion test: ${colors.green}Success${colors.reset}`);
        console.log(`   Response: "${responseText}"`);
      } else {
        const error = await response.json();
        console.log(`   Chat completion test: ${colors.red}Failed - ${error.error?.message}${colors.reset}`);
      }
      
      return true;
    } else {
      const error = await modelsResponse.json();
      console.log(`${colors.red}❌ Gemini connection failed: ${error.error?.message || modelsResponse.statusText}${colors.reset}`);
      return false;
    }
  } catch (error) {
    console.log(`${colors.red}❌ Gemini connection error: ${error.message}${colors.reset}`);
    return false;
  }
}

// Run all tests
async function runTests() {
  const results = {
    openai: await testOpenAI(),
    anthropic: await testAnthropic(),
    openrouter: await testOpenRouter(),
    gemini: await testGemini(),
  };

  // Summary
  console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}📊 Test Summary${colors.reset}\n`);
  
  const working = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  Object.entries(results).forEach(([provider, success]) => {
    const status = success ? `${colors.green}✅ Working${colors.reset}` : `${colors.red}❌ Not configured/Failed${colors.reset}`;
    console.log(`   ${provider.padEnd(12)}: ${status}`);
  });
  
  console.log(`\n${colors.cyan}Total: ${working}/${total} providers configured and working${colors.reset}`);
  
  if (working === 0) {
    console.log(`\n${colors.yellow}⚠️  No API keys are configured. Add them to your .env file or through the admin panel.${colors.reset}`);
  } else if (working < total) {
    console.log(`\n${colors.yellow}ℹ️  Some providers are not configured. You can add their API keys later.${colors.reset}`);
  } else {
    console.log(`\n${colors.green}🎉 All providers are configured and working!${colors.reset}`);
  }
}

// Run the tests
runTests().catch(console.error);