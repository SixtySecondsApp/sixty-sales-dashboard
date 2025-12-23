#!/bin/bash
echo "🔍 Checking condense-meeting-summary Edge Function logs..."
echo ""
npx supabase functions logs condense-meeting-summary --tail 20
