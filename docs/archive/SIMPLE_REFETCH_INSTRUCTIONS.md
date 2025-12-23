# Simple Instructions: Re-fetch All Action Items

## ✅ Status
- **21 meetings** have Fathom recording IDs
- **18 meetings** need action items re-fetched
- **2 meetings** already have action items (Viewpoint/SixtySeconds, Jean-Marc)

## 🎯 Two Easy Options

### Option 1: Supabase Dashboard (5 minutes, no terminal needed)

1. **Get the list of meetings to process**
   - Run `batch-refetch-commands.sql` in Supabase SQL Editor
   - Note the `fathom_recording_id` for each meeting

2. **Open Supabase Edge Functions**
   - Go to: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb
   - Click "Edge Functions" → Find "fathom-webhook"

3. **For each meeting, invoke the function**
   - Click "Invoke" button
   - Paste this payload (replace with actual recording_id):
   ```json
   {
     "recording_id": "PASTE_FATHOM_RECORDING_ID_HERE",
     "force_resync": true
   }
   ```
   - Click "Invoke Function"
   - Repeat for all 18 meetings

### Option 2: Automated Script (2 minutes, uses terminal)

1. **Run the SQL query**
   ```bash
   # In Supabase SQL Editor, run:
   # batch-refetch-commands.sql
   ```

2. **Copy all the curl commands from the output**

3. **In terminal, replace YOUR_ANON_KEY and run each command**
   ```bash
   # Get your anon key from .env file
   cat .env | grep VITE_SUPABASE_ANON_KEY

   # Then run each curl command (replace YOUR_ANON_KEY)
   ```

---

## 🔍 After Re-fetch: Verify Results

Run this in Supabase SQL Editor:

```sql
SELECT
    m.title,
    m.meeting_start,
    COUNT(mai.id) as action_items
FROM meetings m
LEFT JOIN meeting_action_items mai ON mai.meeting_id = m.id
WHERE m.meeting_start >= '2025-10-29'
GROUP BY m.id, m.title, m.meeting_start
ORDER BY m.meeting_start DESC;
```

You should see action items populated for your meetings!

---

## 📝 Important Notes

**Why some meetings have 0 action items:**
- Fathom AI didn't detect any action items in those meetings
- Meeting might have been informal/casual with no clear tasks
- This is normal - not every meeting has action items

**What happens after re-fetch:**
1. Action items appear on meeting detail pages
2. You can review and decide which to track
3. Click "Add to Tasks" to manually create tasks
4. No automatic task creation (by design)

---

## 🎉 You're Done!

After running the re-fetch (either method), you'll have:
- ✅ All available action items from Fathom populated in your database
- ✅ Ability to view action items on each meeting page
- ✅ Manual control over which action items become tasks
- ✅ Clean task list with only items you choose to track
