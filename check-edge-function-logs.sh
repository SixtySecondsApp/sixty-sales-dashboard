#!/bin/bash
# Check Edge Function logs for notification creation attempts

source .env 2>/dev/null || true

echo "📋 Checking Edge Function Logs for Notification Creation"
echo ""

# Get recent Edge Function invocations
echo "Recent suggest-next-actions invocations:"
supabase functions logs suggest-next-actions --limit 50 2>&1 | grep -A5 -B5 "notification\|Created notification\|Failed to create notification" || echo "No notification-related logs found"

echo ""
echo "=========================================="
echo ""

# Alternative: Check if the function is even trying to create notifications
echo "Checking for task creation context:"
supabase functions logs suggest-next-actions --limit 30 2>&1 | grep -A2 -B2 "createdTasks\|task count\|meeting_id" || echo "No task creation logs found"
