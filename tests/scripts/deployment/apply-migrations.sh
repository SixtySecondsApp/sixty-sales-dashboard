#!/bin/bash

# Apply database migrations
echo "Applying database migrations..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "Supabase CLI not found. Please install it first."
    echo "Visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Apply migrations
supabase db push

echo "Migrations applied successfully!"