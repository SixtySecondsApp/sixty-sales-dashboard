#!/bin/bash
echo "Relationship Health Monitor - Migration Files"
echo "=============================================="
echo ""
echo "Location: supabase/migrations/"
echo ""
echo "Files (in execution order):"
echo "---------------------------"
i=1
for file in supabase/migrations/2025112200000*.sql; do
  if [ -f "$file" ]; then
    lines=$(wc -l < "$file" | xargs)
    size=$(ls -lh "$file" | awk '{print $5}')
    echo "$i. $(basename $file)"
    echo "   Size: $size | Lines: $lines"
    echo ""
    ((i++))
  fi
done
echo "Total files: $((i-1))"
echo ""
echo "To view a file:"
echo "  cat supabase/migrations/20251122000001_create_relationship_health_scores.sql"
echo ""
echo "To open in editor:"
echo "  code supabase/migrations/20251122000001_create_relationship_health_scores.sql"
