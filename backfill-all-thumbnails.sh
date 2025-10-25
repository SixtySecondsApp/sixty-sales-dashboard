#!/bin/bash

SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs"
URL="https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/backfill-thumbnails"

echo "🚀 Starting thumbnail backfill for all meetings..."
echo ""

for i in {1..20}; do
  echo "📦 Batch $i..."

  result=$(curl -s -X POST "$URL" \
    -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    -d '{"batchSize": 50, "dryRun": false}')

  # Parse results
  total=$(echo "$result" | grep -o '"total":[0-9]*' | cut -d':' -f2)
  successful=$(echo "$result" | grep -o '"successful":[0-9]*' | cut -d':' -f2)
  failed=$(echo "$result" | grep -o '"failed":[0-9]*' | cut -d':' -f2)

  echo "   Total: $total | Successful: $successful | Failed: $failed"

  # If no meetings to process, we're done
  if [ "$total" = "0" ]; then
    echo ""
    echo "✅ All meetings have thumbnails!"
    break
  fi

  # Wait between batches to respect rate limits
  if [ $i -lt 20 ]; then
    echo "   ⏳ Waiting 5 seconds..."
    sleep 5
  fi
done

echo ""
echo "🎉 Backfill complete!"
