#!/bin/bash

# Test Google Tasks Edge Function
curl -X POST \
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/google-tasks?action=list-tasklists' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI0Njc2MjAsImV4cCI6MjA0ODA0MzYyMH0.gJz_dVP-2dV5GRJU0ExH-i7iMCyBjlfMpW7MA5ubSIY' \
  -H 'Content-Type: application/json' \
  -d '{}' \
  -v