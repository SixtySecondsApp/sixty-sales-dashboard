#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n📋 Fetching Complete Model Lists from All Providers\n');

// OpenAI
async function getOpenAIModels() {
  console.log('🔵 OpenAI Models:');
  const apiKey = process.env.VITE_OPENAI_API_KEY;
  if (!apiKey) {
    console.log('  No API key');
    return;
  }
  
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await response.json();
    
    // Get all GPT and O1 models
    const models = data.data
      .map(m => m.id)
      .filter(id => id.includes('gpt') || id.includes('o1') || id.includes('dall') || id.includes('whisper'))
      .sort();
    
    console.log('  Total models:', data.data.length);
    console.log('  Chat/Completion models:');
    models.forEach(m => console.log(`    - ${m}`));
  } catch (err) {
    console.error('  Error:', err.message);
  }
}

// Anthropic
async function getAnthropicModels() {
  console.log('\n🟠 Anthropic Models:');
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log('  No API key');
    return;
  }
  
  // Anthropic doesn't have a models endpoint, but we can list known models
  console.log('  Available models (from API documentation):');
  const models = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-2.1',
    'claude-2.0',
    'claude-instant-1.2'
  ];
  models.forEach(m => console.log(`    - ${m}`));
}

// OpenRouter
async function getOpenRouterModels() {
  console.log('\n🟢 OpenRouter Models:');
  const apiKey = process.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    console.log('  No API key');
    return;
  }
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await response.json();
    
    console.log('  Total models:', data.data.length);
    console.log('  Sample of available models:');
    
    // Show models containing specific keywords
    const keywords = ['gpt', 'claude', 'gemini', 'llama', 'mistral'];
    keywords.forEach(keyword => {
      const filtered = data.data.filter(m => m.id.toLowerCase().includes(keyword));
      if (filtered.length > 0) {
        console.log(`\n  Models containing "${keyword}":`);
        filtered.slice(0, 5).forEach(m => console.log(`    - ${m.id}`));
        if (filtered.length > 5) console.log(`    ... and ${filtered.length - 5} more`);
      }
    });
  } catch (err) {
    console.error('  Error:', err.message);
  }
}

// Gemini
async function getGeminiModels() {
  console.log('\n🔴 Google Gemini Models:');
  const apiKey = process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    console.log('  No API key');
    return;
  }
  
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await response.json();
    
    console.log('  Total models:', data.models.length);
    console.log('  Available models:');
    data.models.forEach(m => {
      const name = m.name.replace('models/', '');
      const methods = m.supportedGenerationMethods?.join(', ') || 'unknown';
      console.log(`    - ${name} (supports: ${methods})`);
    });
  } catch (err) {
    console.error('  Error:', err.message);
  }
}

// Run all checks
async function checkAllModels() {
  await getOpenAIModels();
  await getAnthropicModels();
  await getOpenRouterModels();
  await getGeminiModels();
  console.log('\n✅ Complete model list fetched\n');
}

checkAllModels().catch(console.error);