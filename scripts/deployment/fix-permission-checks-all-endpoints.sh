#!/bin/bash

# Fix permission checks in all CRUD endpoints to use entity-specific permissions

echo "🔧 Fixing permission checks in all CRUD endpoints..."

# Companies endpoint
echo "Fixing companies endpoint..."
sed -i '' "s/checkPermission(permissions, 'write')/checkPermission(permissions, 'companies:write')/g" supabase/functions/api-v1-companies/index.ts
sed -i '' "s/checkPermission(permissions, 'delete')/checkPermission(permissions, 'companies:delete')/g" supabase/functions/api-v1-companies/index.ts

# Deals endpoint
echo "Fixing deals endpoint..."
sed -i '' "s/checkPermission(permissions, 'write')/checkPermission(permissions, 'deals:write')/g" supabase/functions/api-v1-deals/index.ts
sed -i '' "s/checkPermission(permissions, 'delete')/checkPermission(permissions, 'deals:delete')/g" supabase/functions/api-v1-deals/index.ts

# Tasks endpoint
echo "Fixing tasks endpoint..."
sed -i '' "s/checkPermission(permissions, 'write')/checkPermission(permissions, 'tasks:write')/g" supabase/functions/api-v1-tasks/index.ts
sed -i '' "s/checkPermission(permissions, 'delete')/checkPermission(permissions, 'tasks:delete')/g" supabase/functions/api-v1-tasks/index.ts

# Meetings endpoint
echo "Fixing meetings endpoint..."
sed -i '' "s/checkPermission(permissions, 'write')/checkPermission(permissions, 'meetings:write')/g" supabase/functions/api-v1-meetings/index.ts
sed -i '' "s/checkPermission(permissions, 'delete')/checkPermission(permissions, 'meetings:delete')/g" supabase/functions/api-v1-meetings/index.ts

# Activities endpoint
echo "Fixing activities endpoint..."
sed -i '' "s/checkPermission(permissions, 'write')/checkPermission(permissions, 'activities:write')/g" supabase/functions/api-v1-activities/index.ts
sed -i '' "s/checkPermission(permissions, 'delete')/checkPermission(permissions, 'activities:delete')/g" supabase/functions/api-v1-activities/index.ts

echo "✅ All permission checks fixed!"
echo ""
echo "Changes made:"
echo "- 'write' → 'entity:write' (e.g., 'contacts:write')"
echo "- 'delete' → 'entity:delete' (e.g., 'contacts:delete')"
echo ""
echo "Now run the API test suite again!"