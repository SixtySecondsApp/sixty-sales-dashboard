#!/bin/bash

# Supabase local development URLs and keys
WEBHOOK_URL="http://localhost:54321/functions/v1/meetings-webhook"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"

# Test meeting share ID
SHARE_ID="test-meeting-$(date +%s)"

echo "Creating test meeting with ID: $SHARE_ID"

# Step 1: Create meeting with AI Summary
echo "Step 1: Sending AI Summary webhook..."
curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "summary",
    "shareId": "'$SHARE_ID'",
    "recording": {
        "recording_url": "https://fathom.video/calls/389818293",
        "recording_share_url": "https://fathom.video/share/'$SHARE_ID'",
        "recording_duration_in_minutes": 45
    },
    "meeting": {
        "scheduled_start_time": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
        "scheduled_end_time": "'$(date -u -d "+45 minutes" +"%Y-%m-%dT%H:%M:%SZ")'",
        "title": "Product Demo - Sixty Seconds Dashboard",
        "has_external_invitees": true,
        "external_domains": 1,
        "invitees": [
            {
                "name": "Phil O'\''Brien",
                "email": "phil@sixtyseconds.video"
            },
            {
                "name": "John Smith",
                "email": "john@acmecorp.com"
            }
        ]
    },
    "fathom_user": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "ai_summary": "Excellent product demo showcasing the Sixty Seconds sales dashboard. Key highlights:\n\n• Demonstrated real-time pipeline visualization\n• Showed advanced activity tracking features\n• Discussed integration capabilities with existing CRM systems\n• Client expressed strong interest in the automated reporting features\n\nNext steps:\n• Send detailed pricing proposal\n• Schedule technical deep-dive session\n• Provide access to sandbox environment",
    "sentiment_score": 0.75,
    "coach_rating": 85,
    "coach_summary": "Strong discovery, excellent rapport building, clear value articulation",
    "talk_time_rep_pct": 48,
    "talk_time_customer_pct": 52,
    "talk_time_judgement": "good"
}'

echo -e "\n\nStep 2: Adding action items..."
sleep 2

# Step 2: Add Action Items
curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID'",
    "action_item": {
        "description": "Send detailed pricing proposal with enterprise tier options",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:21:23",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID'?timestamp=1283"
    },
    "assignee": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 2,
    "priority": "high"
}'

sleep 1

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID'",
    "action_item": {
        "description": "Schedule technical deep-dive session with engineering team",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:35:15",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID'?timestamp=2115"
    },
    "assignee": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 3,
    "priority": "medium"
}'

sleep 1

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID'",
    "action_item": {
        "description": "Review proposal with decision makers and provide feedback",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:42:30",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID'?timestamp=2550"
    },
    "assignee": {
        "name": "John Smith",
        "email": "john@acmecorp.com",
        "team": "Customer"
    },
    "deadline_days": 5,
    "priority": "high"
}'

echo -e "\n\nStep 3: Adding transcript link..."
sleep 2

# Step 3: Add Transcript
curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "transcript",
    "shareId": "'$SHARE_ID'",
    "transcript_url": "https://docs.google.com/document/d/1CiAMJMZscDRNjoDAvlL299SCoF3QPFoxZJDdf_drKb8/edit"
}'

echo -e "\n\n✅ Test meeting created successfully!"
echo "Meeting ID: $SHARE_ID"
echo -e "\nNow go to http://localhost:5173/meetings to see your meeting!"