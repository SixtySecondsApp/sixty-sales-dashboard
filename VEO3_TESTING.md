# Veo 3 API Testing Guide

This guide explains how to test the Veo 3 video generation API using the provided test scripts and browser interface.

## Overview

Veo 3 is Google's text-to-video generation model, accessible via the veo3gen.co API. This project includes:

1. **Browser Test Page** (`test-veo3-browser.html`) - Interactive web interface
2. **Node.js Test Script** (`test-veo3-api.mjs`) - Command-line testing tool
3. **Service Integration** (`src/lib/services/veo3Service.ts`) - App service for Veo 3 API

## Prerequisites

- Veo 3 API key from [veo3gen.co](https://www.veo3gen.co/)
- Node.js 18+ (for command-line script)
- Modern browser (for browser test)

## Browser Test Page

### Usage

1. **When running from the app** (recommended):
   - Start the Vite dev server: `npm run dev`
   - Open `http://localhost:5175/test-veo3-browser.html`
   - The page will automatically use the app's Veo 3 service (which gets API key from user settings)

2. **Standalone mode**:
   - Open `test-veo3-browser.html` directly in your browser
   - Enter your Veo 3 API key when prompted
   - The page will use direct API calls

### Features

- **Interactive UI**: Easy-to-use form with all generation options
- **Real-time Polling**: Automatically polls for video completion
- **Video Preview**: Displays generated video when ready
- **Error Handling**: Clear error messages and troubleshooting tips
- **Dual Mode**: Works with app service or direct API calls

### Parameters

- **Prompt**: Text description of the video to generate
- **Model**: 
  - `veo-3.0-fast-generate-preview` - Faster generation (default)
  - `veo-3.0-generate-preview` - Higher quality
- **Duration**: 5, 8, or 10 seconds
- **Aspect Ratio**: 16:9 (landscape), 9:16 (portrait), or 1:1 (square)
- **Generate Audio**: Enable/disable audio generation

## Node.js Test Script

### Basic Usage

```bash
# Using environment variable
export VITE_VEO3_API_KEY="your-api-key"
node test-veo3-api.mjs

# Or pass API key as argument
node test-veo3-api.mjs "your-api-key"
```

### Advanced Usage

```bash
# Custom prompt
node test-veo3-api.mjs YOUR_KEY --prompt "A cat playing piano in space"

# Quality model with 10-second duration
node test-veo3-api.mjs YOUR_KEY --model veo-3.0-generate-preview --duration 10

# Portrait video without audio
node test-veo3-api.mjs YOUR_KEY --aspect 9:16 --no-audio

# Full example
node test-veo3-api.mjs YOUR_KEY \
  --prompt "A futuristic city at sunset" \
  --model veo-3.0-generate-preview \
  --duration 10 \
  --aspect 16:9
```

### Command-Line Options

- `--prompt "text"` - Custom prompt (default: sunset scene)
- `--model model` - Model selection (default: veo-3.0-fast-generate-preview)
- `--duration N` - Duration in seconds: 5, 8, or 10 (default: 8)
- `--aspect RATIO` - Aspect ratio: 16:9, 9:16, or 1:1 (default: 16:9)
- `--no-audio` - Disable audio generation

### Output

The script provides:
- API response time
- Task ID for tracking
- Real-time polling status updates
- Final video URL when complete
- Error messages with troubleshooting tips

## Service Integration

The Veo 3 service (`src/lib/services/veo3Service.ts`) is integrated into the app and:

- Gets API key from user settings (Settings > AI Provider Settings)
- Falls back to environment variable `VITE_VEO3_API_KEY`
- Provides TypeScript types for type safety
- Handles errors gracefully

### Usage in Code

```typescript
import { veo3Service } from '@/lib/services/veo3Service';

// Start generation
const result = await veo3Service.generateVideo({
  prompt: 'A beautiful sunset over mountains',
  model: 'veo-3.0-fast-generate-preview',
  durationSeconds: 8,
  generateAudio: true,
  aspectRatio: '16:9'
});

// Poll for status
const status = await veo3Service.getTaskStatus(result.taskId);

// When completed, get video URL
if (status.status === 'completed' && status.videoUrl) {
  console.log('Video ready:', status.videoUrl);
}
```

## API Endpoints

### Generate Video

```
POST https://api.veo3gen.co/api/veo/text-to-video
Headers:
  Content-Type: application/json
  X-API-Key: YOUR_API_KEY
Body:
  {
    "prompt": "Video description",
    "model": "veo-3.0-fast-generate-preview",
    "durationSeconds": 8,
    "generateAudio": true,
    "aspectRatio": "16:9"
  }
```

### Check Status

```
GET https://api.veo3gen.co/api/veo/status/{taskId}
Headers:
  X-API-Key: YOUR_API_KEY
```

## Troubleshooting

### 401 Unauthorized

- Verify your API key is correct
- Check for extra spaces or quotes in the API key
- Ensure your Veo3 account has credits
- Get a new API key from [veo3gen.co](https://www.veo3gen.co/)

### No Task ID Received

- Check the API response structure
- Verify the request body format
- Ensure all required parameters are provided

### Video Generation Failed

- Check the error message in the status response
- Verify your prompt is appropriate
- Try a different model or duration
- Check your account credits

### Polling Timeout

- Videos can take 1-5 minutes to generate
- The script polls for up to 5 minutes (60 attempts × 5 seconds)
- You can manually check status using the task ID
- Some videos may take longer than expected

## Best Practices

1. **API Key Security**: Never commit API keys to version control
2. **Error Handling**: Always handle errors and provide user feedback
3. **Polling**: Use appropriate polling intervals (5 seconds recommended)
4. **Timeouts**: Set reasonable timeouts for long-running operations
5. **User Feedback**: Show progress indicators during generation
6. **Prompt Quality**: Write detailed, descriptive prompts for better results

## Examples

### Example Prompts

- "A beautiful sunset over mountains with vibrant colors, cinematic style"
- "A cat playing piano in a cozy living room, warm lighting"
- "A futuristic city at night with flying cars and neon lights"
- "Ocean waves crashing on a beach at sunset, peaceful atmosphere"
- "A robot walking through a forest, morning mist, cinematic"

### Example Workflows

1. **Quick Test**: Use fast model with 5-second duration
2. **High Quality**: Use quality model with 10-second duration
3. **Social Media**: Use portrait aspect ratio (9:16) with audio
4. **Square Format**: Use 1:1 aspect ratio for Instagram-style content

## Support

For issues or questions:
- Check the [Veo3 API documentation](https://www.veo3gen.co/)
- Review error messages in the test outputs
- Check your account status and credits
- Verify API key permissions and validity

























