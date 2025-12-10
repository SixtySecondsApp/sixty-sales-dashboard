#!/bin/bash
# Simple curl test for Nano Banana Pro API
# Usage: ./test-nanobanana-curl.sh YOUR_API_KEY

API_KEY="${1:-${VITE_OPENROUTER_API_KEY:-${OPENROUTER_API_KEY}}}"

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key required"
  echo "Usage: ./test-nanobanana-curl.sh YOUR_API_KEY"
  echo "Or set: export VITE_OPENROUTER_API_KEY='your-key'"
  exit 1
fi

# Clean up API key (remove quotes)
API_KEY=$(echo "$API_KEY" | sed "s/^['\"]//;s/['\"]$//")

echo "🧪 Testing Nano Banana Pro API with curl"
echo "API Key: ${API_KEY:0:10}...${API_KEY: -4}"
echo ""

curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $API_KEY" \
  -H "HTTP-Referer: http://localhost:5175" \
  -H "X-Title: Sixty Sales Dashboard - Nano Banana Pro Test" \
  -d '{
    "model": "google/gemini-3-pro-image-preview",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "a beautiful sunset over mountains with vibrant colors"
          }
        ]
      }
    ],
    "aspect_ratio": "square"
  }' \
  -w "\n\n⏱️  Response time: %{time_total}s\n" \
  -s | jq '.' 2>/dev/null || cat

echo ""
echo "✅ Test complete!"























