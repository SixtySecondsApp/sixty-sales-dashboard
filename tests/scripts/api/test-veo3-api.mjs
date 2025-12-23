/**
 * Direct API test for Veo 3 video generation
 * Tests the veo3gen.co API endpoint directly
 */

// Parse command line arguments
const args = process.argv.slice(2);
let VEO3_API_KEY = process.env.VITE_VEO3_API_KEY || process.env.VEO3_API_KEY;
let testPrompt = 'A beautiful sunset over mountains with vibrant colors, cinematic style';
let model = 'veo-3.0-fast-generate-preview';
let durationSeconds = 8;
let generateAudio = true;
let aspectRatio = '16:9';

// Parse arguments: [API_KEY] [--prompt "text"] [--model model] [--duration 8] [--no-audio] [--aspect 16:9]
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg.startsWith('--')) {
    const key = arg.substring(2);
    const value = args[i + 1];
    switch (key) {
      case 'prompt':
        testPrompt = value;
        i++;
        break;
      case 'model':
        model = value;
        i++;
        break;
      case 'duration':
        durationSeconds = parseInt(value);
        i++;
        break;
      case 'aspect':
        aspectRatio = value;
        i++;
        break;
      case 'no-audio':
        generateAudio = false;
        break;
    }
  } else if (!VEO3_API_KEY) {
    // First non-flag argument is the API key
    VEO3_API_KEY = arg;
  }
}

// Clean up the API key (remove quotes, whitespace)
if (VEO3_API_KEY) {
  VEO3_API_KEY = VEO3_API_KEY.trim().replace(/^["']|["']$/g, '');
}

if (!VEO3_API_KEY || VEO3_API_KEY.length < 10) {
  console.error('❌ VEO3_API_KEY not found or invalid');
  console.error('\nUsage:');
  console.error('  node test-veo3-api.mjs [API_KEY] [options]');
  console.error('\nOptions:');
  console.error('  --prompt "text"     Custom prompt (default: sunset scene)');
  console.error('  --model model       Model: veo-3.0-fast-generate-preview or veo-3.0-generate-preview');
  console.error('  --duration N        Duration in seconds: 5, 8, or 10 (default: 8)');
  console.error('  --aspect RATIO      Aspect ratio: 16:9, 9:16, or 1:1 (default: 16:9)');
  console.error('  --no-audio         Disable audio generation');
  console.error('\nExamples:');
  console.error('  node test-veo3-api.mjs YOUR_API_KEY');
  console.error('  node test-veo3-api.mjs YOUR_API_KEY --prompt "A cat playing piano" --duration 10');
  console.error('  export VITE_VEO3_API_KEY="your-key" && node test-veo3-api.mjs --prompt "Custom prompt"');
  console.error('\n💡 Get your API key from: https://www.veo3gen.co/');
  process.exit(1);
}

console.log('🧪 Testing Veo 3 API (Google Veo 3 Text-to-Video)\n');
console.log(`API Key: ${VEO3_API_KEY.substring(0, 10)}...${VEO3_API_KEY.substring(VEO3_API_KEY.length - 4)}`);
console.log(`API Key length: ${VEO3_API_KEY.length} characters\n`);

console.log(`📝 Test prompt: "${testPrompt}"\n`);
console.log('🚀 Making request to Veo 3 API...\n');

try {
  const startTime = Date.now();
  
  // Step 1: Start video generation
  const response = await fetch('https://api.veo3gen.co/api/veo/text-to-video', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': VEO3_API_KEY,
    },
    body: JSON.stringify({
      prompt: testPrompt,
      model: model,
      durationSeconds: durationSeconds,
      generateAudio: generateAudio,
      aspectRatio: aspectRatio
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
    
    if (response.status === 401) {
      console.error('\n🔧 Troubleshooting 401 Unauthorized:');
      console.error('   1. Verify your API key is correct');
      console.error('   2. Get your API key from https://www.veo3gen.co/');
      console.error('   3. Ensure there are no extra spaces or quotes');
      console.error('   4. Verify your Veo3 account has credits');
    }
    
    process.exit(1);
  }

  const data = await response.json();
  
  console.log('✅ API Response received!\n');
  console.log('📦 Response Structure:');
  console.log(`   - Has taskId: ${!!data.taskId}`);
  console.log(`   - Task ID: ${data.taskId || 'N/A'}\n`);
  
  if (!data.taskId) {
    console.error('❌ No task ID received');
    console.error('Full response:', JSON.stringify(data, null, 2));
    process.exit(1);
  }

  const taskId = data.taskId;
  console.log(`🔄 Task ID: ${taskId}`);
  console.log('⏳ Polling for status...\n');

  // Step 2: Poll for status
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes max (60 * 5 seconds)
  let finalStatus = null;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    try {
      const statusResponse = await fetch(`https://api.veo3gen.co/api/veo/status/${taskId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': VEO3_API_KEY,
        },
      });

      if (!statusResponse.ok) {
        const errorText = await statusResponse.text();
        console.error(`❌ Status check failed: ${statusResponse.status} ${errorText}`);
        break;
      }

      const statusData = await statusResponse.json();
      finalStatus = statusData;
      
      const status = statusData.status?.toLowerCase() || 'unknown';
      console.log(`   Attempt ${attempts + 1}: Status = ${status}`);
      
      if (status === 'completed') {
        console.log('\n✅ Video generation completed!\n');
        console.log('📹 Video URL:', statusData.videoUrl || statusData.video_url || statusData.url || 'N/A');
        break;
      } else if (status === 'failed') {
        console.error('\n❌ Video generation failed');
        console.error('Error:', statusData.error || 'Unknown error');
        break;
      } else if (status === 'processing' || status === 'pending') {
        // Continue polling
      } else {
        console.log(`   Unknown status: ${status}`);
      }
      
      attempts++;
    } catch (error) {
      console.error(`   Error checking status: ${error.message}`);
      attempts++;
    }
  }

  if (finalStatus) {
    console.log('\n📋 Final Status Response:');
    console.log(JSON.stringify(finalStatus, null, 2).substring(0, 1000));
  }

  if (attempts >= maxAttempts) {
    console.log('\n⚠️  Max polling attempts reached. Video may still be processing.');
    console.log(`   Check status manually: curl -H "X-API-Key: YOUR_KEY" https://api.veo3gen.co/api/veo/status/${taskId}`);
  }
  
  console.log('\n✅ Test completed!');
  
} catch (error) {
  console.error('\n❌ Test failed with error:');
  console.error(`   Message: ${error.message}`);
  if (error.stack) {
    console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
  }
  process.exit(1);
}

