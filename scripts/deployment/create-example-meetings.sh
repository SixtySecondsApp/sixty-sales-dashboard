#!/bin/bash

# Production Supabase URLs and keys
WEBHOOK_URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/meetings-webhook"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8"

echo "Creating example meetings..."
echo ""

# Meeting 1: Successful discovery call
SHARE_ID_1="example-discovery-$(date +%s)"
echo "Creating Meeting 1: Discovery Call with TechCorp"
echo "Share ID: $SHARE_ID_1"

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "summary",
    "shareId": "'$SHARE_ID_1'",
    "recording": {
        "recording_url": "https://fathom.video/calls/123456789",
        "recording_share_url": "https://fathom.video/share/'$SHARE_ID_1'",
        "recording_duration_in_minutes": 30
    },
    "meeting": {
        "scheduled_start_time": "'$(date -u -v -2d +"%Y-%m-%dT14:00:00Z")'",
        "scheduled_end_time": "'$(date -u -v -2d +"%Y-%m-%dT14:30:00Z")'",
        "title": "Discovery Call - TechCorp Enterprise Solutions",
        "has_external_invitees": true,
        "external_domains": 1,
        "invitees": [
            {
                "name": "Andrew Bryce",
                "email": "andrew@sixtyseconds.video"
            },
            {
                "name": "Sarah Johnson",
                "email": "sarah@techcorp.com"
            },
            {
                "name": "Mike Chen",
                "email": "mike@techcorp.com"
            }
        ]
    },
    "fathom_user": {
        "name": "Andrew Bryce",
        "email": "andrew@sixtyseconds.video",
        "team": "Sales"
    },
    "ai_summary": "Excellent discovery call with TechCorp team. Key points discussed:\n\n• Current challenges with their existing CRM system\n• Need for better pipeline visibility and forecasting\n• Integration requirements with Salesforce and HubSpot\n• Budget range: $50-75K annually\n• Decision timeline: End of Q1\n\nPain points identified:\n• Manual data entry taking 2+ hours daily\n• No real-time pipeline visibility\n• Poor adoption of current tools (only 40% usage)\n• Lack of activity tracking\n\nNext steps:\n• Technical demo scheduled for next week\n• Sending ROI calculator\n• Introducing to implementation team",
    "sentiment_score": 0.82,
    "coach_rating": 92,
    "coach_summary": "Excellent discovery skills, asked probing questions, identified clear pain points and budget",
    "talk_time_rep_pct": 35,
    "talk_time_customer_pct": 65,
    "talk_time_judgement": "excellent"
}' > /dev/null 2>&1

sleep 1

# Add action items for Meeting 1
curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID_1'",
    "action_item": {
        "description": "Send ROI calculator and case studies from similar companies",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:15:30",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID_1'?timestamp=930"
    },
    "assignee": {
        "name": "Andrew Bryce",
        "email": "andrew@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 1,
    "priority": "high"
}' > /dev/null 2>&1

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID_1'",
    "action_item": {
        "description": "Schedule technical demo with their engineering team",
        "completed": true,
        "ai_generated": true,
        "recording_timestamp": "00:25:45",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID_1'?timestamp=1545"
    },
    "assignee": {
        "name": "Andrew Bryce",
        "email": "andrew@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 2,
    "priority": "high"
}' > /dev/null 2>&1

echo "✅ Meeting 1 created"
echo ""

sleep 2

# Meeting 2: Challenging negotiation call
SHARE_ID_2="example-negotiation-$(date +%s)"
echo "Creating Meeting 2: Negotiation Call with GlobalRetail"
echo "Share ID: $SHARE_ID_2"

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "summary",
    "shareId": "'$SHARE_ID_2'",
    "recording": {
        "recording_url": "https://fathom.video/calls/987654321",
        "recording_share_url": "https://fathom.video/share/'$SHARE_ID_2'",
        "recording_duration_in_minutes": 60
    },
    "meeting": {
        "scheduled_start_time": "'$(date -u -v -5d +"%Y-%m-%dT16:00:00Z")'",
        "scheduled_end_time": "'$(date -u -v -5d +"%Y-%m-%dT17:00:00Z")'",
        "title": "Contract Negotiation - GlobalRetail Q1 Renewal",
        "has_external_invitees": true,
        "external_domains": 2,
        "invitees": [
            {
                "name": "Phil O'\''Brien",
                "email": "phil@sixtyseconds.video"
            },
            {
                "name": "Robert Martinez",
                "email": "robert@globalretail.com"
            },
            {
                "name": "Lisa Wang",
                "email": "lisa@globalretail.com"
            },
            {
                "name": "James Thompson",
                "email": "james@globalretail-procurement.com"
            }
        ]
    },
    "fathom_user": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "ai_summary": "Challenging negotiation session for Q1 renewal. Key discussion points:\n\n• Customer pushing for 25% discount due to budget constraints\n• Concerns about feature gaps vs competitors\n• Request for additional seats without price increase\n• Threatening to evaluate alternatives\n\nObjections raised:\n• Price point too high for current usage\n• Missing advanced reporting features\n• Integration with their new ERP system\n• Support response times\n\nConcessions offered:\n• 15% discount for annual commitment\n• 5 additional seats included\n• Priority support upgrade\n• Custom integration development\n\nUnresolved items:\n• Final discount percentage\n• Contract term length\n• Payment terms\n\nRisk: High probability of churn if demands not met",
    "sentiment_score": -0.3,
    "coach_rating": 68,
    "coach_summary": "Handled objections well but could have better controlled the conversation. Too defensive on pricing",
    "talk_time_rep_pct": 58,
    "talk_time_customer_pct": 42,
    "talk_time_judgement": "poor"
}' > /dev/null 2>&1

sleep 1

# Add action items for Meeting 2
curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID_2'",
    "action_item": {
        "description": "Get approval for 20% discount from leadership",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:35:20",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID_2'?timestamp=2120"
    },
    "assignee": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 1,
    "priority": "urgent"
}' > /dev/null 2>&1

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID_2'",
    "action_item": {
        "description": "Prepare competitive analysis document",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:42:15",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID_2'?timestamp=2535"
    },
    "assignee": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 2,
    "priority": "high"
}' > /dev/null 2>&1

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID_2'",
    "action_item": {
        "description": "Schedule follow-up with decision makers",
        "completed": false,
        "ai_generated": false,
        "recording_timestamp": "00:55:00",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID_2'?timestamp=3300"
    },
    "assignee": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 1,
    "priority": "urgent"
}' > /dev/null 2>&1

# Add transcript links
curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "transcript",
    "shareId": "'$SHARE_ID_1'",
    "transcript_url": "https://docs.google.com/document/d/1ABC_discovery_call_transcript/edit"
}' > /dev/null 2>&1

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "transcript",
    "shareId": "'$SHARE_ID_2'",
    "transcript_url": "https://docs.google.com/document/d/2XYZ_negotiation_transcript/edit"
}' > /dev/null 2>&1

echo "✅ Meeting 2 created"
echo ""

sleep 2

# Meeting 3: Product demo
SHARE_ID_3="example-demo-$(date +%s)"
echo "Creating Meeting 3: Product Demo with StartupCo"
echo "Share ID: $SHARE_ID_3"

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "summary",
    "shareId": "'$SHARE_ID_3'",
    "recording": {
        "recording_url": "https://fathom.video/calls/555666777",
        "recording_share_url": "https://fathom.video/share/'$SHARE_ID_3'",
        "recording_duration_in_minutes": 45
    },
    "meeting": {
        "scheduled_start_time": "'$(date -u -v -1d +"%Y-%m-%dT10:00:00Z")'",
        "scheduled_end_time": "'$(date -u -v -1d +"%Y-%m-%dT10:45:00Z")'",
        "title": "Product Demo - StartupCo Sales Team",
        "has_external_invitees": true,
        "external_domains": 1,
        "invitees": [
            {
                "name": "Andrew Bryce",
                "email": "andrew@sixtyseconds.video"
            },
            {
                "name": "Emily Rodriguez",
                "email": "emily@startupco.io"
            },
            {
                "name": "David Park",
                "email": "david@startupco.io"
            }
        ]
    },
    "fathom_user": {
        "name": "Andrew Bryce",
        "email": "andrew@sixtyseconds.video",
        "team": "Sales"
    },
    "ai_summary": "Successful product demo with StartupCo sales team. Highlights:\n\n• Live demonstration of pipeline management features\n• Showed activity tracking and reporting capabilities\n• Demonstrated mobile app functionality\n• Covered integration with their existing tech stack\n\nKey features that resonated:\n• Real-time pipeline updates\n• Automated activity logging\n• Custom dashboard creation\n• Team collaboration features\n• Mobile accessibility\n\nQuestions addressed:\n• API capabilities and limits\n• Data migration process\n• Training and onboarding support\n• Customization options\n• Security and compliance (SOC 2)\n\nBuying signals:\n• Asked about implementation timeline\n• Requested pricing for 15 seats\n• Wanted reference customers\n• Discussed contract terms\n\nNext steps agreed:\n• Sending proposal by EOD\n• Reference call with similar customer\n• Security review documentation\n• Pilot program for 30 days",
    "sentiment_score": 0.91,
    "coach_rating": 88,
    "coach_summary": "Strong demo skills, good feature-benefit connection, excellent handling of technical questions",
    "talk_time_rep_pct": 55,
    "talk_time_customer_pct": 45,
    "talk_time_judgement": "good"
}' > /dev/null 2>&1

sleep 1

# Add action items for Meeting 3
curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID_3'",
    "action_item": {
        "description": "Send formal proposal with 15-seat pricing",
        "completed": true,
        "ai_generated": true,
        "recording_timestamp": "00:40:00",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID_3'?timestamp=2400"
    },
    "assignee": {
        "name": "Andrew Bryce",
        "email": "andrew@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 0,
    "priority": "high"
}' > /dev/null 2>&1

curl --location "$WEBHOOK_URL" \
--header "Authorization: Bearer $SUPABASE_ANON_KEY" \
--header "Content-Type: application/json" \
--data '{
    "topic": "action_items",
    "shareId": "'$SHARE_ID_3'",
    "action_item": {
        "description": "Coordinate reference call with similar startup customer",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:38:30",
        "recording_playback_url": "https://fathom.video/share/'$SHARE_ID_3'?timestamp=2310"
    },
    "assignee": {
        "name": "Andrew Bryce",
        "email": "andrew@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 3,
    "priority": "medium"
}' > /dev/null 2>&1

echo "✅ Meeting 3 created"
echo ""
echo "========================================="
echo "✅ Successfully created 3 example meetings!"
echo ""
echo "Meetings created:"
echo "1. Discovery Call - TechCorp (Positive sentiment, 2 days ago)"
echo "2. Contract Negotiation - GlobalRetail (Challenging, 5 days ago)"
echo "3. Product Demo - StartupCo (Very positive, yesterday)"
echo ""
echo "Go to http://localhost:5173/meetings to view them!"