# Re-fetch Action Items from Fathom - Quick Guide

## 🎯 Goal
Get action items from Fathom API for all meetings that currently have 0 action items.

## ⚡ Quick Start (5 minutes)

### Step 1: Identify Meetings Needing Action Items
Run this query in Supabase SQL Editor:

```sql
SELECT
    m.title as meeting_title,
    m.fathom_recording_id,
    m.meeting_start,
    COUNT(mai.id) as current_action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.fathom_recording_id IS NOT NULL
GROUP BY m.id, m.title, m.fathom_recording_id, m.meeting_start
HAVING COUNT(mai.id) = 0
ORDER BY m.meeting_start DESC;
```

This shows you which meetings have 0 action items and need to be re-fetched.

### Step 2: Choose Your Re-fetch Method

#### Option A: Supabase Dashboard (EASIEST - Recommended)

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb

2. **Navigate to Edge Functions**
   - Click "Edge Functions" in left sidebar
   - Find "fathom-webhook" function

3. **Invoke Function for Each Meeting**
   - Click "Invoke" button
   - Paste this payload (replace with actual recording_id from Step 1):
   ```json
   {
     "recording_id": "PASTE_FATHOM_RECORDING_ID_HERE",
     "force_resync": true
   }
   ```
   - Click "Invoke Function"
   - Wait for success response
   - Repeat for each meeting from Step 1

4. **Verify Action Items Were Created**
   Run this query:
   ```sql
   SELECT
       m.title,
       COUNT(mai.id) as action_items
   FROM meetings m
   LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
   GROUP BY m.id, m.title
   ORDER BY m.meeting_start DESC
   LIMIT 10;
   ```

   You should now see action items for your meetings!

#### Option B: Using curl Commands (For Terminal Users)

1. **Get Your Supabase Anon Key**
   - Find it in your `.env` file: `VITE_SUPABASE_ANON_KEY`

2. **Generate curl Commands**
   Run this query to get ready-to-use curl commands:
   ```sql
   SELECT
       m.title,
       CONCAT(
           'curl -X POST ''https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook'' ',
           '-H ''Authorization: Bearer YOUR_ANON_KEY'' ',
           '-H ''Content-Type: application/json'' ',
           '-d ''{"recording_id": "', m.fathom_recording_id, '", "force_resync": true}'''
       ) as curl_command
   FROM meetings m
   LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
   WHERE m.fathom_recording_id IS NOT NULL
   GROUP BY m.id, m.title, m.fathom_recording_id
   HAVING COUNT(mai.id) = 0;
   ```

3. **Copy and Run Each curl Command**
   - Replace `YOUR_ANON_KEY` with your actual key
   - Run each command in your terminal
   - Each command fetches action items for one meeting

---

## ✅ Verification Checklist

After re-fetching, verify:

- [ ] Run verification query and see action items for each meeting
- [ ] Open a meeting detail page in your app
- [ ] See action items listed in the meeting
- [ ] "Add to Tasks" button is available for each action item
- [ ] Click "Add to Tasks" to create a task (optional test)
- [ ] Task appears in your task list

---

## 🔍 What Happens When You Call the Webhook?

1. **Edge Function Receives Request**
   - Gets the `recording_id` from your request
   - `force_resync: true` tells it to fetch even if already synced

2. **Calls Fathom API**
   - Uses your Fathom API credentials
   - Downloads meeting details and action items

3. **Stores in Database**
   - Creates/updates rows in `meeting_action_items` table
   - Does NOT automatically create tasks (automatic syncing is disabled)
   - Action items are ready for manual selection

4. **You Review and Select**
   - Go to meeting detail page
   - Review action items from Fathom
   - Click "Add to Tasks" for items you want to track
   - Task is created in your task list

---

## 🚨 Troubleshooting

### "No action items were created"
- Check that the meeting has a valid `fathom_recording_id`
- Verify the Fathom API credentials are configured
- Check Edge Function logs in Supabase Dashboard

### "Error calling webhook"
- Verify your Supabase anon key is correct
- Check that the Edge Function is deployed
- Look for error messages in the response

### "Action items already exist"
- If `force_resync: false`, it won't re-fetch existing items
- Use `force_resync: true` to override and re-fetch

---

## 📋 Next Steps After Re-fetch

1. **Review Meetings**: Visit each meeting detail page
2. **Select Important Items**: Click "Add to Tasks" for action items you want to track
3. **Manage Tasks**: Tasks appear in your task list with proper attribution
4. **Follow Up**: Use the task system to track completion

That's it! Your action items are now populated and ready for manual task selection.
