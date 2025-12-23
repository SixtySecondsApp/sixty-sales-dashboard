# Check Edge Function Logs

Please go to the Supabase Dashboard and check the latest logs:

**Dashboard Link**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/functions/suggest-next-actions/logs

Look for the most recent execution (within last 2 minutes) and share:

1. Any error messages (red text)
2. The full log output
3. What step it failed at

The logs will show:
- `[fetchActivityContext]` - Did it fetch meeting data?
- `[generateSuggestionsWithClaude]` - Did it call Claude AI?
- `[generateSuggestionsWithClaude] Stripped markdown` - Did it parse the response?
- `[storeSuggestions]` - Did it try to insert suggestions?
- Any error messages

---

Alternatively, we can test the Edge Function directly via curl to see the exact error in real-time.
