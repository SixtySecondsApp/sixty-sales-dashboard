#!/bin/bash

# Video Thumbnail Service Deployment Script
# Deploys the thumbnail generation system for Fathom meetings

set -e

echo "🚀 Deploying Video Thumbnail Generation Service..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Deploy Edge Function
echo -e "${YELLOW}Step 1: Deploying Edge Function...${NC}"
supabase functions deploy generate-video-thumbnail
echo -e "${GREEN}✅ Edge function deployed${NC}"
echo ""

# Step 2: Create Storage Bucket
echo -e "${YELLOW}Step 2: Creating storage bucket...${NC}"
supabase db push
echo -e "${GREEN}✅ Storage bucket created${NC}"
echo ""

# Step 3: Configuration
echo -e "${YELLOW}Step 3: Configuration${NC}"
echo ""
echo "Choose your screenshot service:"
echo "1) Microlink (Free - 50/day, no setup)"
echo "2) ScreenshotOne (Free - 100/month, requires API key)"
echo "3) Browserless (Most powerful, requires token)"
echo ""
read -p "Enter choice [1-3]: " choice

case $choice in
  1)
    echo -e "${GREEN}Using Microlink (no API key needed)${NC}"
    ;;
  2)
    echo ""
    echo "Sign up at: https://screenshotone.com"
    read -p "Enter your ScreenshotOne API key: " api_key
    supabase secrets set SCREENSHOTONE_API_KEY="$api_key"
    echo -e "${GREEN}✅ API key configured${NC}"
    ;;
  3)
    echo ""
    echo "Sign up at: https://browserless.io"
    read -p "Enter your Browserless token: " token
    supabase secrets set BROWSERLESS_TOKEN="$token"
    echo -e "${GREEN}✅ Token configured${NC}"
    ;;
  *)
    echo -e "${RED}Invalid choice. Using Microlink (default).${NC}"
    ;;
esac

echo ""

# Step 4: Enable Feature
echo -e "${YELLOW}Step 4: Enabling video thumbnail generation...${NC}"
supabase secrets set ENABLE_VIDEO_THUMBNAILS=true
echo -e "${GREEN}✅ Feature enabled${NC}"
echo ""

# Step 5: Test
echo -e "${YELLOW}Step 5: Testing (optional)${NC}"
read -p "Would you like to test the thumbnail service? (y/n): " test_choice

if [ "$test_choice" = "y" ] || [ "$test_choice" = "Y" ]; then
  echo ""
  echo "Testing requires:"
  echo "1. Your Supabase project URL"
  echo "2. Your service role key"
  echo "3. A Fathom recording ID and share URL"
  echo ""
  read -p "Do you have these ready? (y/n): " ready

  if [ "$ready" = "y" ] || [ "$ready" = "Y" ]; then
    read -p "Supabase URL: " supabase_url
    read -p "Service Role Key: " service_key
    read -p "Recording ID: " recording_id
    read -p "Share URL: " share_url

    # Extract share ID from URL
    share_id=$(echo "$share_url" | grep -oP '(?<=/share/)[^/]+')
    embed_url="https://fathom.video/embed/$share_id"

    echo ""
    echo "Testing thumbnail generation..."
    curl -X POST \
      "$supabase_url/functions/v1/generate-video-thumbnail" \
      -H "Authorization: Bearer $service_key" \
      -H "Content-Type: application/json" \
      -d "{
        \"recording_id\": \"$recording_id\",
        \"share_url\": \"$share_url\",
        \"fathom_embed_url\": \"$embed_url\"
      }"
    echo ""
  fi
fi

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Re-sync your Fathom meetings to generate thumbnails"
echo "2. Check Supabase Dashboard → Storage → meeting-assets"
echo "3. Monitor Edge Function logs:"
echo "   supabase functions logs generate-video-thumbnail --tail"
echo ""
echo "For detailed configuration, see: VIDEO_THUMBNAIL_SETUP.md"
