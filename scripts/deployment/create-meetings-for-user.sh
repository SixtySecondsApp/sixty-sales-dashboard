#!/bin/bash

# Production Supabase URLs and keys
WEBHOOK_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/meetings-webhook"
SUPABASE_URL="https://ewtuefzeogytgmsnkpmb.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8"

# Your user ID and email
USER_ID="ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459"
USER_EMAIL="andrew.bryce@sixtyseconds.video"

echo "Creating meetings for user: $USER_EMAIL"
echo ""

# First, let's directly insert meetings into the database
echo "Creating meetings directly in the database..."

# Meeting 1: Discovery Call
MEETING_1_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
SHARE_ID_1="andrew-discovery-$(date +%s)"

curl -X POST "$SUPABASE_URL/rest/v1/meetings" \
-H "apikey: $SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $SUPABASE_ANON_KEY" \
-H "Content-Type: application/json" \
-H "Prefer: return=representation" \
-d '{
  "fathom_recording_id": "'$SHARE_ID_1'",
  "title": "Discovery Call - TechCorp Enterprise Solutions",
  "share_url": "https://fathom.video/share/'$SHARE_ID_1'",
  "calls_url": "https://fathom.video/calls/123456789",
  "meeting_start": "'$(date -u -v -2d +"%Y-%m-%dT14:00:00Z")'",
  "meeting_end": "'$(date -u -v -2d +"%Y-%m-%dT14:30:00Z")'",
  "duration_minutes": 30,
  "owner_user_id": "'$USER_ID'",
  "owner_email": "'$USER_EMAIL'",
  "team_name": "Sales",
  "summary": "Excellent discovery call with TechCorp team. Key points discussed:\n\n• Current challenges with their existing CRM system\n• Need for better pipeline visibility and forecasting\n• Integration requirements with Salesforce and HubSpot\n• Budget range: $50-75K annually\n• Decision timeline: End of Q1\n\nPain points identified:\n• Manual data entry taking 2+ hours daily\n• No real-time pipeline visibility\n• Poor adoption of current tools (only 40% usage)\n• Lack of activity tracking\n\nNext steps:\n• Technical demo scheduled for next week\n• Sending ROI calculator\n• Introducing to implementation team",
  "transcript_doc_url": "https://docs.google.com/document/d/1ABC_discovery_call_transcript/edit"
}'

sleep 1

# Add metrics for Meeting 1
MEETING_1_QUERY=$(curl -X GET "$SUPABASE_URL/rest/v1/meetings?fathom_recording_id=eq.$SHARE_ID_1&select=id" \
-H "apikey: $SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $SUPABASE_ANON_KEY" 2>/dev/null)

MEETING_1_ID=$(echo $MEETING_1_QUERY | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$MEETING_1_ID" ]; then
  curl -X POST "$SUPABASE_URL/rest/v1/meeting_metrics" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "'$MEETING_1_ID'",
    "sentiment_score": 0.82,
    "coach_rating": 92,
    "coach_summary": "Excellent discovery skills, asked probing questions, identified clear pain points and budget",
    "talk_time_rep_pct": 35,
    "talk_time_customer_pct": 65,
    "talk_time_judgement": "excellent"
  }' > /dev/null 2>&1

  # Add action items
  curl -X POST "$SUPABASE_URL/rest/v1/meeting_action_items" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "meeting_id": "'$MEETING_1_ID'",
      "title": "Send ROI calculator and case studies from similar companies",
      "assignee_name": "Andrew Bryce",
      "assignee_email": "'$USER_EMAIL'",
      "priority": "high",
      "category": "Sales",
      "deadline_at": "'$(date -u -v +1d +"%Y-%m-%dT17:00:00Z")'",
      "completed": false,
      "ai_generated": true,
      "timestamp_seconds": 930,
      "playback_url": "https://fathom.video/share/'$SHARE_ID_1'?timestamp=930"
    },
    {
      "meeting_id": "'$MEETING_1_ID'",
      "title": "Schedule technical demo with their engineering team",
      "assignee_name": "Andrew Bryce",
      "assignee_email": "'$USER_EMAIL'",
      "priority": "high",
      "category": "Sales",
      "deadline_at": "'$(date -u -v +2d +"%Y-%m-%dT17:00:00Z")'",
      "completed": true,
      "ai_generated": true,
      "timestamp_seconds": 1545,
      "playback_url": "https://fathom.video/share/'$SHARE_ID_1'?timestamp=1545"
    }
  ]' > /dev/null 2>&1
fi

echo "✅ Meeting 1 created: Discovery Call - TechCorp"

sleep 1

# Meeting 2: Negotiation Call
SHARE_ID_2="andrew-negotiation-$(date +%s)"

curl -X POST "$SUPABASE_URL/rest/v1/meetings" \
-H "apikey: $SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $SUPABASE_ANON_KEY" \
-H "Content-Type: application/json" \
-H "Prefer: return=representation" \
-d '{
  "fathom_recording_id": "'$SHARE_ID_2'",
  "title": "Contract Negotiation - GlobalRetail Q1 Renewal",
  "share_url": "https://fathom.video/share/'$SHARE_ID_2'",
  "calls_url": "https://fathom.video/calls/987654321",
  "meeting_start": "'$(date -u -v -5d +"%Y-%m-%dT16:00:00Z")'",
  "meeting_end": "'$(date -u -v -5d +"%Y-%m-%dT17:00:00Z")'",
  "duration_minutes": 60,
  "owner_user_id": "'$USER_ID'",
  "owner_email": "'$USER_EMAIL'",
  "team_name": "Sales",
  "summary": "Challenging negotiation session for Q1 renewal. Key discussion points:\n\n• Customer pushing for 25% discount due to budget constraints\n• Concerns about feature gaps vs competitors\n• Request for additional seats without price increase\n• Threatening to evaluate alternatives\n\nObjections raised:\n• Price point too high for current usage\n• Missing advanced reporting features\n• Integration with their new ERP system\n• Support response times\n\nConcessions offered:\n• 15% discount for annual commitment\n• 5 additional seats included\n• Priority support upgrade\n• Custom integration development\n\nUnresolved items:\n• Final discount percentage\n• Contract term length\n• Payment terms\n\nRisk: High probability of churn if demands not met",
  "transcript_doc_url": "https://docs.google.com/document/d/2XYZ_negotiation_transcript/edit"
}'

sleep 1

# Add metrics for Meeting 2
MEETING_2_QUERY=$(curl -X GET "$SUPABASE_URL/rest/v1/meetings?fathom_recording_id=eq.$SHARE_ID_2&select=id" \
-H "apikey: $SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $SUPABASE_ANON_KEY" 2>/dev/null)

MEETING_2_ID=$(echo $MEETING_2_QUERY | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$MEETING_2_ID" ]; then
  curl -X POST "$SUPABASE_URL/rest/v1/meeting_metrics" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "'$MEETING_2_ID'",
    "sentiment_score": -0.3,
    "coach_rating": 68,
    "coach_summary": "Handled objections well but could have better controlled the conversation. Too defensive on pricing",
    "talk_time_rep_pct": 58,
    "talk_time_customer_pct": 42,
    "talk_time_judgement": "poor"
  }' > /dev/null 2>&1

  # Add action items
  curl -X POST "$SUPABASE_URL/rest/v1/meeting_action_items" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "meeting_id": "'$MEETING_2_ID'",
      "title": "Get approval for 20% discount from leadership",
      "assignee_name": "Andrew Bryce",
      "assignee_email": "'$USER_EMAIL'",
      "priority": "urgent",
      "category": "Sales",
      "deadline_at": "'$(date -u -v +1d +"%Y-%m-%dT17:00:00Z")'",
      "completed": false,
      "ai_generated": true,
      "timestamp_seconds": 2120,
      "playback_url": "https://fathom.video/share/'$SHARE_ID_2'?timestamp=2120"
    },
    {
      "meeting_id": "'$MEETING_2_ID'",
      "title": "Prepare competitive analysis document",
      "assignee_name": "Andrew Bryce",
      "assignee_email": "'$USER_EMAIL'",
      "priority": "high",
      "category": "Sales",
      "deadline_at": "'$(date -u -v +2d +"%Y-%m-%dT17:00:00Z")'",
      "completed": false,
      "ai_generated": true,
      "timestamp_seconds": 2535,
      "playback_url": "https://fathom.video/share/'$SHARE_ID_2'?timestamp=2535"
    },
    {
      "meeting_id": "'$MEETING_2_ID'",
      "title": "Schedule follow-up with decision makers",
      "assignee_name": "Andrew Bryce",
      "assignee_email": "'$USER_EMAIL'",
      "priority": "urgent",
      "category": "Sales",
      "deadline_at": "'$(date -u -v +1d +"%Y-%m-%dT17:00:00Z")'",
      "completed": false,
      "ai_generated": false,
      "timestamp_seconds": 3300,
      "playback_url": "https://fathom.video/share/'$SHARE_ID_2'?timestamp=3300"
    }
  ]' > /dev/null 2>&1
fi

echo "✅ Meeting 2 created: Contract Negotiation - GlobalRetail"

sleep 1

# Meeting 3: Product Demo
SHARE_ID_3="andrew-demo-$(date +%s)"

curl -X POST "$SUPABASE_URL/rest/v1/meetings" \
-H "apikey: $SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $SUPABASE_ANON_KEY" \
-H "Content-Type: application/json" \
-H "Prefer: return=representation" \
-d '{
  "fathom_recording_id": "'$SHARE_ID_3'",
  "title": "Product Demo - StartupCo Sales Team",
  "share_url": "https://fathom.video/share/'$SHARE_ID_3'",
  "calls_url": "https://fathom.video/calls/555666777",
  "meeting_start": "'$(date -u -v -1d +"%Y-%m-%dT10:00:00Z")'",
  "meeting_end": "'$(date -u -v -1d +"%Y-%m-%dT10:45:00Z")'",
  "duration_minutes": 45,
  "owner_user_id": "'$USER_ID'",
  "owner_email": "'$USER_EMAIL'",
  "team_name": "Sales",
  "summary": "Successful product demo with StartupCo sales team. Highlights:\n\n• Live demonstration of pipeline management features\n• Showed activity tracking and reporting capabilities\n• Demonstrated mobile app functionality\n• Covered integration with their existing tech stack\n\nKey features that resonated:\n• Real-time pipeline updates\n• Automated activity logging\n• Custom dashboard creation\n• Team collaboration features\n• Mobile accessibility\n\nQuestions addressed:\n• API capabilities and limits\n• Data migration process\n• Training and onboarding support\n• Customization options\n• Security and compliance (SOC 2)\n\nBuying signals:\n• Asked about implementation timeline\n• Requested pricing for 15 seats\n• Wanted reference customers\n• Discussed contract terms\n\nNext steps agreed:\n• Sending proposal by EOD\n• Reference call with similar customer\n• Security review documentation\n• Pilot program for 30 days",
  "transcript_doc_url": "https://docs.google.com/document/d/3ABC_demo_transcript/edit"
}'

sleep 1

# Add metrics for Meeting 3
MEETING_3_QUERY=$(curl -X GET "$SUPABASE_URL/rest/v1/meetings?fathom_recording_id=eq.$SHARE_ID_3&select=id" \
-H "apikey: $SUPABASE_ANON_KEY" \
-H "Authorization: Bearer $SUPABASE_ANON_KEY" 2>/dev/null)

MEETING_3_ID=$(echo $MEETING_3_QUERY | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$MEETING_3_ID" ]; then
  curl -X POST "$SUPABASE_URL/rest/v1/meeting_metrics" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "meeting_id": "'$MEETING_3_ID'",
    "sentiment_score": 0.91,
    "coach_rating": 88,
    "coach_summary": "Strong demo skills, good feature-benefit connection, excellent handling of technical questions",
    "talk_time_rep_pct": 55,
    "talk_time_customer_pct": 45,
    "talk_time_judgement": "good"
  }' > /dev/null 2>&1

  # Add action items
  curl -X POST "$SUPABASE_URL/rest/v1/meeting_action_items" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "meeting_id": "'$MEETING_3_ID'",
      "title": "Send formal proposal with 15-seat pricing",
      "assignee_name": "Andrew Bryce",
      "assignee_email": "'$USER_EMAIL'",
      "priority": "high",
      "category": "Sales",
      "deadline_at": "'$(date -u +"%Y-%m-%dT17:00:00Z")'",
      "completed": true,
      "ai_generated": true,
      "timestamp_seconds": 2400,
      "playback_url": "https://fathom.video/share/'$SHARE_ID_3'?timestamp=2400"
    },
    {
      "meeting_id": "'$MEETING_3_ID'",
      "title": "Coordinate reference call with similar startup customer",
      "assignee_name": "Andrew Bryce",
      "assignee_email": "'$USER_EMAIL'",
      "priority": "medium",
      "category": "Sales",
      "deadline_at": "'$(date -u -v +3d +"%Y-%m-%dT17:00:00Z")'",
      "completed": false,
      "ai_generated": true,
      "timestamp_seconds": 2310,
      "playback_url": "https://fathom.video/share/'$SHARE_ID_3'?timestamp=2310"
    }
  ]' > /dev/null 2>&1
fi

echo "✅ Meeting 3 created: Product Demo - StartupCo"

echo ""
echo "========================================="
echo "✅ Successfully created 3 meetings for user: $USER_EMAIL"
echo ""
echo "Meetings created:"
echo "1. Discovery Call - TechCorp (Positive sentiment, 2 days ago)"
echo "2. Contract Negotiation - GlobalRetail (Challenging, 5 days ago)"
echo "3. Product Demo - StartupCo (Very positive, yesterday)"
echo ""
echo "Go to http://localhost:5173/meetings to view them!"