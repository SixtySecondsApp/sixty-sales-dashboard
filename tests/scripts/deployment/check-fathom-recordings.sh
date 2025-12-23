#!/bin/bash
# Check Fathom Recording Data

source .env 2>/dev/null || true

echo "🎥 Checking Fathom Recording Data..."
echo ""

echo "1️⃣ Meetings with Fathom data:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=id,title,fathom_recording_id,transcript_doc_url,video_url&limit=5" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[] | {
    title,
    fathom_id: .fathom_recording_id,
    has_transcript_url: (.transcript_doc_url != null),
    has_video_url: (.video_url != null)
  }'

echo ""
echo "2️⃣ Sample meeting full data:"
curl -s "${VITE_SUPABASE_URL}/rest/v1/meetings?select=*&limit=1" \
  -H "apikey: ${VITE_SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${VITE_SUPABASE_ANON_KEY}" | jq '.[0] | {
    title,
    fathom_recording_id,
    transcript_doc_url,
    video_url,
    has_transcript_text: (.transcript_text != null),
    transcript_length: (.transcript_text | length)
  }'
