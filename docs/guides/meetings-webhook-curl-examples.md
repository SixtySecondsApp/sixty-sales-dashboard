# Meetings Webhook CURL Examples for Postman

## Setup
- Base URL: `http://localhost:54321/functions/v1/meetings-webhook` (local)
- Production URL: `https://YOUR-PROJECT.supabase.co/functions/v1/meetings-webhook`
- Content-Type: `application/json`

## 1. AI Summary Webhook

```bash
curl --location 'http://localhost:54321/functions/v1/meetings-webhook' \
--header 'Content-Type: application/json' \
--data '{
    "topic": "summary",
    "shareId": "hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
    "recording": {
        "recording_url": "https://fathom.video/calls/389818293",
        "recording_share_url": "https://fathom.video/share/hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
        "recording_duration_in_minutes": 22
    },
    "meeting": {
        "scheduled_start_time": "2025-08-26T17:00:00Z",
        "scheduled_end_time": "2025-08-26T17:22:00Z",
        "title": "60 Seconds Demo Call",
        "has_external_invitees": true,
        "external_domains": 1,
        "invitees": [
            {
                "name": "Phil O'\''Brien",
                "email": "phil@sixtyseconds.video"
            },
            {
                "name": "Loren Smith",
                "email": "loren@allegrosoft.com"
            }
        ]
    },
    "fathom_user": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "ai_summary": "Successfully uploading and processing company data. Enriching with LinkedIn info. Clear next steps include fixing data table view, connecting export, and scheduling a demo. Prospect showed strong interest in the solution and requested pricing information for the enterprise tier."
}'
```

## 2. Action Items Webhook

### First Action Item
```bash
curl --location 'http://localhost:54321/functions/v1/meetings-webhook' \
--header 'Content-Type: application/json' \
--data '{
    "topic": "action_items",
    "shareId": "hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
    "action_item": {
        "description": "Send supporting content and examples to Loren",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:21:23",
        "recording_playback_url": "https://fathom.video/share/hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg?timestamp=1283"
    },
    "assignee": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 3
}'
```

### Second Action Item
```bash
curl --location 'http://localhost:54321/functions/v1/meetings-webhook' \
--header 'Content-Type: application/json' \
--data '{
    "topic": "action_items",
    "shareId": "hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
    "action_item": {
        "description": "Book follow-up meeting with Loren",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:09:00",
        "recording_playback_url": "https://fathom.video/share/hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg?timestamp=540"
    },
    "assignee": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "deadline_days": 2
}'
```

### Third Action Item (Prospect Action)
```bash
curl --location 'http://localhost:54321/functions/v1/meetings-webhook' \
--header 'Content-Type: application/json' \
--data '{
    "topic": "action_items",
    "shareId": "hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
    "action_item": {
        "description": "Review proposal with CEO and provide feedback",
        "completed": false,
        "ai_generated": true,
        "recording_timestamp": "00:16:50",
        "recording_playback_url": "https://fathom.video/share/hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg?timestamp=1010"
    },
    "assignee": {
        "name": "Loren Smith",
        "email": "loren@allegrosoft.com",
        "team": "Customer"
    },
    "deadline_days": 5
}'
```

## 3. Transcript Webhook

```bash
curl --location 'http://localhost:54321/functions/v1/meetings-webhook' \
--header 'Content-Type: application/json' \
--data '{
    "topic": "transcript",
    "shareId": "hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
    "transcript_url": "https://docs.google.com/document/d/1CiAMJMZscDRNjoDAvlL299SCoF3QPFoxZJDdf_drKb8/edit"
}'
```

## 4. Complete Meeting Example (All Three Webhooks)

Send these three requests in order to fully populate a meeting:

### Step 1: Summary (creates the meeting)
Use the AI Summary webhook from #1 above

### Step 2: Action Items (adds tasks)
Send all three action item webhooks from #2 above

### Step 3: Transcript (adds document link)
Use the Transcript webhook from #3 above

## 5. Additional Analytics Data (Optional)

If you want to test with sentiment and coaching scores, add these fields to the summary webhook payload:

```bash
curl --location 'http://localhost:54321/functions/v1/meetings-webhook' \
--header 'Content-Type: application/json' \
--data '{
    "topic": "summary",
    "shareId": "hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
    "recording": {
        "recording_url": "https://fathom.video/calls/389818293",
        "recording_share_url": "https://fathom.video/share/hQzHeu38iRs4z9jLKXReEYaLrUqqGwxg",
        "recording_duration_in_minutes": 22
    },
    "meeting": {
        "scheduled_start_time": "2025-08-26T17:00:00Z",
        "scheduled_end_time": "2025-08-26T17:22:00Z",
        "title": "60 Seconds Demo Call - With Analytics",
        "has_external_invitees": true,
        "external_domains": 1,
        "invitees": [
            {
                "name": "Phil O'\''Brien",
                "email": "phil@sixtyseconds.video"
            },
            {
                "name": "Loren Smith",
                "email": "loren@allegrosoft.com"
            }
        ]
    },
    "fathom_user": {
        "name": "Phil O'\''Brien",
        "email": "phil@sixtyseconds.video",
        "team": "Sales"
    },
    "ai_summary": "Excellent discovery call with clear next steps identified.",
    "sentiment_score": 0.32,
    "coach_rating": 78,
    "coach_summary": "Good rapport building, clear agenda, strong discovery depth",
    "talk_time_rep_pct": 58,
    "talk_time_customer_pct": 42,
    "talk_time_judgement": "a bit high for discovery"
}'
```

## Postman Collection Setup

1. Create a new collection called "Meetings Webhooks"
2. Add these as separate requests:
   - POST Summary
   - POST Action Item 1
   - POST Action Item 2 
   - POST Action Item 3
   - POST Transcript
3. Set the base URL as a collection variable
4. Add authentication headers if needed (for production)

## Testing Flow

1. First run the database migration:
   ```bash
   supabase migration up
   ```

2. Start the Supabase functions locally:
   ```bash
   supabase functions serve meetings-webhook
   ```

3. Send the webhooks in order:
   - Summary (creates meeting)
   - Action Items (adds tasks)
   - Transcript (adds document)

4. Check the UI at `http://localhost:5173/meetings` to see the ingested data

## Notes for Make.com Integration

When setting up in Make.com, map the Fathom fields to this structure:
- Always include `topic` and `shareId` in the request body
- The `shareId` should be extracted from the Fathom share URL
- Dates should be in ISO 8601 format
- `deadline_days` for action items is calculated from the meeting date