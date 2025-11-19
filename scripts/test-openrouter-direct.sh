#!/bin/bash
# Direct test of OpenRouter API with Claude 4.5 Haiku

echo "🧪 Testing OpenRouter API with Claude 4.5 Haiku..."
echo ""

# Get API key from .env or environment
if [ -f .env ]; then
  # Read OPENROUTER_API_KEY from .env file (handles quoted and unquoted values)
  OPENROUTER_API_KEY=$(grep -E "^OPENROUTER_API_KEY=" .env | head -1 | cut -d '=' -f2- | sed "s/^['\"]//;s/['\"]$//" | tr -d '\n')
fi

# Also check environment variable
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-${OPENROUTER_API_KEY}}"

if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "❌ OPENROUTER_API_KEY not found"
  echo ""
  echo "Please provide your OpenRouter API key:"
  read -p "API Key: " OPENROUTER_API_KEY
  echo ""
fi

if [ -z "$OPENROUTER_API_KEY" ]; then
  echo "❌ No API key provided. Exiting."
  exit 1
fi

echo "📝 Making test request to OpenRouter..."
echo "   Model: anthropic/claude-haiku-4.5"
echo "   API Key prefix: ${OPENROUTER_API_KEY:0:10}..."
echo ""

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST \
  "https://openrouter.ai/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${OPENROUTER_API_KEY}" \
  -H "HTTP-Referer: https://sixtyseconds.video" \
  -H "X-Title: Sixty Sales Dashboard Test" \
  -d '{
    "model": "anthropic/claude-haiku-4.5",
    "messages": [
      {
        "role": "user",
        "content": "Say hello in exactly 3 words."
      }
    ],
    "max_tokens": 50
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | sed '/HTTP_STATUS/d')

echo "📊 HTTP Status: $HTTP_STATUS"
echo ""
echo "📋 Response:"

if command -v jq &> /dev/null; then
  echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
else
  echo "$BODY"
fi

echo ""

if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ SUCCESS! Claude 4.5 Haiku is working correctly."
  
  # Extract and show the response content
  if command -v jq &> /dev/null; then
    CONTENT=$(echo "$BODY" | jq -r '.choices[0].message.content' 2>/dev/null)
    if [ -n "$CONTENT" ]; then
      echo ""
      echo "💬 Model response: \"$CONTENT\""
    fi
    
    USAGE=$(echo "$BODY" | jq '.usage' 2>/dev/null)
    if [ -n "$USAGE" ] && [ "$USAGE" != "null" ]; then
      echo ""
      echo "📈 Token usage:"
      echo "$USAGE" | jq '.'
    fi
  fi
else
  echo "❌ FAILED with status $HTTP_STATUS"
  echo ""
  echo "Error details above. Check:"
  echo "1. API key is correct"
  echo "2. Model ID 'anthropic/claude-haiku-4.5' is valid"
  echo "3. Your Anthropic key is added to OpenRouter"
fi

