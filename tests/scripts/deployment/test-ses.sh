#!/bin/bash
# Test AWS SES Setup
# Fetches credentials from Supabase and runs the test

echo "🔍 Fetching AWS credentials from Supabase secrets..."

# Get AWS credentials from Supabase
AWS_REGION=$(npx supabase secrets list 2>/dev/null | grep AWS_REGION | awk '{print $2}' || echo "eu-west-2")
AWS_ACCESS_KEY_ID=$(npx supabase secrets list 2>/dev/null | grep AWS_ACCESS_KEY_ID | awk '{print $2}' || echo "")
AWS_SECRET_ACCESS_KEY=$(npx supabase secrets list 2>/dev/null | grep AWS_SECRET_ACCESS_KEY | awk '{print $2}' || echo "")

if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo "❌ AWS credentials not found in Supabase secrets"
  echo ""
  echo "Please set them with:"
  echo "  npx supabase secrets set AWS_ACCESS_KEY_ID=your_key"
  echo "  npx supabase secrets set AWS_SECRET_ACCESS_KEY=your_secret"
  echo "  npx supabase secrets set AWS_REGION=eu-west-2"
  exit 1
fi

echo "✅ Found AWS credentials"
echo ""

# Export for Deno
export AWS_REGION
export AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY

# Run the test
echo "🧪 Running SES setup test..."
echo ""
deno run --allow-net --allow-env test-ses-setup.ts
