# Nano Banana Pro API Test Guide

## Overview
This document explains how to test the Nano Banana Pro (Gemini 3 Pro Image Preview) API integration.

## API Endpoint
- **Service**: OpenRouter
- **Model**: `google/gemini-3-pro-image-preview`
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`

## Prerequisites
1. OpenRouter API key (get from https://openrouter.ai/)
2. API key configured in one of:
   - Environment variable: `VITE_OPENROUTER_API_KEY`
   - User settings in the app (Settings > AI Provider Settings)
   - `.env` file

## Testing Methods

### Method 1: Direct API Test Script
Run the test script with your API key:

```bash
# Option 1: Pass API key as argument
node test-nanobanana-api.mjs YOUR_API_KEY_HERE

# Option 2: Set environment variable
export VITE_OPENROUTER_API_KEY="your-api-key-here"
node test-nanobanana-api.mjs
```

### Method 2: Test via Browser Console
1. Open the workflows page: http://localhost:5175/workflows
2. Open browser DevTools (F12)
3. Go to Console tab
4. Run this code:

```javascript
// Import the service (if available)
import('/src/lib/services/nanoBananaService.ts').then(async (module) => {
  const { nanoBananaService } = module;
  
  try {
    const result = await nanoBananaService.generateImage({
      prompt: 'a beautiful sunset over mountains',
      aspect_ratio: 'square'
    });
    
    console.log('✅ Success!', result);
    if (result.images && result.images.length > 0) {
      console.log('🖼️ Generated images:', result.images);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
});
```

### Method 3: Test via Workflow UI
1. Navigate to `/workflows`
2. Click "Builder" tab
3. Open the node library panel (left sidebar)
4. Search for "Nano Banana" or "banana"
5. Drag "Nano Banana Pro" node onto canvas
6. Enter a prompt (e.g., "a beautiful sunset over mountains")
7. Select aspect ratio (square/portrait/landscape)
8. Click the generate button (refresh icon)
9. Check the preview area for generated image

## Expected Response Format

The API should return a response in this format:

```json
{
  "choices": [
    {
      "message": {
        "content": "image_url_here" // or array of content blocks
      }
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 0,
    "total_tokens": 10
  }
}
```

The service extracts images from:
1. `choices[0].message.content` (if string with URL)
2. `choices[0].message.content[]` (if array with `image_url` blocks)
3. `data.data.images` (if present)
4. `data.images` (if present)

## Troubleshooting

### Error: 401 Unauthorized - "No auth credentials found"
This means the API key is not being sent correctly. Try:

1. **Verify API key format**:
   ```bash
   # OpenRouter keys should start with "sk-or-v1-" or "sk-or-"
   echo $VITE_OPENROUTER_API_KEY | head -c 15
   ```

2. **Check for extra quotes/spaces**:
   ```bash
   # Remove quotes if present
   export VITE_OPENROUTER_API_KEY=$(echo "$VITE_OPENROUTER_API_KEY" | sed "s/^['\"]//;s/['\"]$//")
   ```

3. **Test with curl** (most reliable):
   ```bash
   ./test-nanobanana-curl.sh "your-api-key-here"
   ```

4. **Verify API key is valid**:
   - Go to https://openrouter.ai/keys
   - Check that your key is active
   - Ensure you have credits/balance

5. **Try regenerating the key**:
   - Create a new API key at https://openrouter.ai/keys
   - Use the new key in the test

### Error: "OpenRouter API key not configured"
- **Solution**: Add your API key to Settings > AI Provider Settings in the app
- Or set `VITE_OPENROUTER_API_KEY` environment variable

### Error: "No images returned from Nano Banana Pro"
- **Possible causes**:
  - API response format changed
  - Model not available or rate limited
  - Invalid API key
- **Solution**: Check the full API response in console/logs

### Error: API returns 401/403
- **Solution**: Verify your OpenRouter API key is valid and has credits

### Error: API returns 429 (Rate Limited)
- **Solution**: Wait a moment and try again, or upgrade your OpenRouter plan

## Service Implementation Details

The service (`src/lib/services/nanoBananaService.ts`):
- Gets API key from user settings → AIProviderService → environment variable
- Makes POST request to OpenRouter chat completions endpoint
- Parses multiple response formats to extract image URLs
- Returns `{ images: string[], usage?: {...} }`

## Test Results

Run the test script to verify:
- ✅ API connection successful
- ✅ Response format matches expectations
- ✅ Image URLs extracted correctly
- ✅ Error handling works properly

## Next Steps

After successful API test:
1. Verify images display correctly in the workflow node
2. Test different aspect ratios (square, portrait, landscape)
3. Test with various prompts
4. Verify error messages are user-friendly
5. Check token usage tracking

