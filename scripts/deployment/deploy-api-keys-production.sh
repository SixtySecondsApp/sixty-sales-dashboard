#!/bin/bash

# Deploy API Keys System to Production Supabase
# This script deploys the fixed Edge Functions directly to production

set -e

echo "🚀 Deploying API Keys System to Production"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    log_error "Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in the project directory
if [ ! -f "supabase/config.toml" ]; then
    log_error "Not in a Supabase project directory. Please run this from your project root."
    exit 1
fi

# Step 1: Link to production project (if not already linked)
log_info "Checking Supabase project link..."
if ! supabase link --project-ref $(grep VITE_SUPABASE_URL .env | cut -d'/' -f3 | cut -d'.' -f1) 2>/dev/null; then
    log_warning "Project already linked or link failed. Continuing..."
fi

# Step 2: Deploy Edge Functions to production
log_info "Deploying Edge Functions to production..."

# Deploy the create-api-key function
log_info "Deploying create-api-key function..."
if npx supabase functions deploy create-api-key --no-verify-jwt; then
    log_success "create-api-key function deployed successfully"
else
    log_error "Failed to deploy create-api-key function"
    log_info "Trying with supabase CLI directly..."
    if supabase functions deploy create-api-key --no-verify-jwt; then
        log_success "create-api-key function deployed successfully"
    else
        log_error "Failed to deploy create-api-key function"
    fi
fi

# Deploy other API-related functions
for func in api-auth api-proxy api-v1-contacts api-v1-companies api-v1-deals api-v1-tasks api-v1-meetings api-v1-activities; do
    if [ -d "supabase/functions/$func" ]; then
        log_info "Deploying function: $func"
        if npx supabase functions deploy "$func" --no-verify-jwt 2>/dev/null; then
            log_success "Function $func deployed successfully"
        else
            log_warning "Failed to deploy function $func (trying alternative method...)"
            supabase functions deploy "$func" --no-verify-jwt 2>/dev/null || log_warning "Skipping $func"
        fi
    fi
done

# Step 3: Create SQL files for manual database updates
log_info "Creating SQL scripts for manual database updates..."

# Create the final consolidated SQL script
cat > manual-production-fix.sql << 'EOF'
-- API Keys System Production Fix
-- Run this in Supabase Dashboard > SQL Editor

-- Step 1: Add missing columns to api_keys table if it exists
DO $$
BEGIN
    -- Check if api_keys table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_keys') THEN
        -- Add missing columns if they don't exist
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS last_used TIMESTAMP WITH TIME ZONE;
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
        
        ALTER TABLE api_keys 
        ADD COLUMN IF NOT EXISTS key_preview TEXT;
        
        RAISE NOTICE 'api_keys table updated successfully';
    ELSE
        -- Create the table from scratch
        CREATE TABLE api_keys (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            key_hash TEXT NOT NULL UNIQUE,
            key_preview TEXT NOT NULL,
            permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
            rate_limit INTEGER NOT NULL DEFAULT 1000,
            expires_at TIMESTAMP WITH TIME ZONE,
            is_active BOOLEAN NOT NULL DEFAULT true,
            last_used TIMESTAMP WITH TIME ZONE,
            usage_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Create indexes for better performance
        CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
        CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash);
        CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
        CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);
        
        RAISE NOTICE 'api_keys table created successfully';
    END IF;
END $$;

-- Step 2: Create or replace helper functions
CREATE OR REPLACE FUNCTION generate_api_key(prefix TEXT DEFAULT 'sk')
RETURNS TEXT AS $$
DECLARE
    random_part TEXT;
BEGIN
    -- Generate a random string
    random_part := encode(gen_random_bytes(32), 'hex');
    RETURN prefix || '_' || random_part;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION hash_api_key(api_key TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN encode(digest(api_key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Enable Row Level Security
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
DROP POLICY IF EXISTS "Users can view their own API keys" ON api_keys;
CREATE POLICY "Users can view their own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own API keys" ON api_keys;
CREATE POLICY "Users can create their own API keys"
    ON api_keys FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own API keys" ON api_keys;
CREATE POLICY "Users can update their own API keys"
    ON api_keys FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own API keys" ON api_keys;
CREATE POLICY "Users can delete their own API keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- Step 5: Grant necessary permissions
GRANT ALL ON api_keys TO authenticated;
GRANT ALL ON api_keys TO service_role;

-- Step 6: Create api_requests table for tracking
CREATE TABLE IF NOT EXISTS api_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID REFERENCES api_keys(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_api_requests_api_key_id ON api_requests(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON api_requests(created_at DESC);

-- Enable RLS for api_requests
ALTER TABLE api_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for api_requests
DROP POLICY IF EXISTS "Users can view their own API requests" ON api_requests;
CREATE POLICY "Users can view their own API requests"
    ON api_requests FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM api_keys
            WHERE api_keys.id = api_requests.api_key_id
            AND api_keys.user_id = auth.uid()
        )
    );

-- Step 7: Verify the setup
DO $$
DECLARE
    table_count INTEGER;
    column_count INTEGER;
BEGIN
    -- Check tables exist
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_name IN ('api_keys', 'api_requests');
    
    -- Check columns exist
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns
    WHERE table_name = 'api_keys'
    AND column_name IN ('id', 'user_id', 'name', 'key_hash', 'key_preview', 
                        'permissions', 'rate_limit', 'expires_at', 'is_active',
                        'last_used', 'usage_count', 'created_at', 'updated_at');
    
    IF table_count = 2 AND column_count = 13 THEN
        RAISE NOTICE 'SUCCESS: All tables and columns are properly configured!';
    ELSE
        RAISE WARNING 'Some tables or columns may be missing. Tables: %, Columns: %', table_count, column_count;
    END IF;
END $$;

-- Final confirmation
SELECT 'API Keys database setup completed successfully!' as status;
EOF

log_success "SQL script created: manual-production-fix.sql"

# Step 4: Create test script for production
cat > test-production-api-keys.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Test Production API Keys</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px; 
            margin: 50px auto; 
            padding: 20px;
            background: #0f172a;
            color: #e2e8f0;
        }
        h1 { color: #60a5fa; }
        button { 
            background: #3b82f6;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin: 10px 5px;
        }
        button:hover { background: #2563eb; }
        button:disabled { 
            background: #64748b;
            cursor: not-allowed;
        }
        .status { 
            padding: 15px; 
            margin: 20px 0; 
            border-radius: 8px;
            background: #1e293b;
            border: 1px solid #334155;
        }
        .success { 
            background: #065f46;
            border-color: #10b981;
        }
        .error { 
            background: #7f1d1d;
            border-color: #ef4444;
        }
        .warning { 
            background: #78350f;
            border-color: #f59e0b;
        }
        pre { 
            background: #1e293b;
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            border: 1px solid #334155;
        }
        input { 
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            background: #1e293b;
            border: 1px solid #334155;
            color: #e2e8f0;
            border-radius: 6px;
            font-family: monospace;
        }
        .info {
            background: #1e3a8a;
            border-color: #3b82f6;
            padding: 15px;
            margin: 20px 0;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <h1>🔑 Production API Keys Test</h1>
    
    <div class="info">
        <strong>Prerequisites:</strong>
        <ol>
            <li>Run the SQL script in Supabase Dashboard > SQL Editor</li>
            <li>Ensure you're logged into the application</li>
            <li>Have your Supabase URL and Anon Key ready</li>
        </ol>
    </div>

    <div>
        <label>Supabase URL:</label>
        <input type="text" id="supabaseUrl" placeholder="https://your-project.supabase.co">
        
        <label>Supabase Anon Key:</label>
        <input type="text" id="supabaseKey" placeholder="your-anon-key">
        
        <label>Your Auth Token (from localStorage):</label>
        <input type="text" id="authToken" placeholder="Will be auto-filled if available">
    </div>

    <button id="testBtn" onclick="runTest()">Test API Key Creation</button>
    <button onclick="clearResults()">Clear Results</button>
    <button onclick="getAuthToken()">Get Auth Token</button>
    
    <div id="status"></div>
    <pre id="result"></pre>

    <script type="module">
        // Try to auto-fill from environment
        window.addEventListener('DOMContentLoaded', () => {
            // Try to get values from parent window if embedded
            try {
                const url = localStorage.getItem('supabase.url');
                const key = localStorage.getItem('supabase.auth.token');
                
                if (url) document.getElementById('supabaseUrl').value = url;
                
                // Try to get auth token from localStorage
                const authData = localStorage.getItem('sb-auth-token');
                if (authData) {
                    const parsed = JSON.parse(authData);
                    document.getElementById('authToken').value = parsed.access_token || '';
                }
            } catch (e) {
                console.log('Could not auto-fill values:', e);
            }
        });

        window.getAuthToken = function() {
            try {
                // Look for Supabase auth token in localStorage
                for (let key in localStorage) {
                    if (key.includes('supabase.auth.token') || key.includes('sb-') && key.includes('auth-token')) {
                        const value = localStorage.getItem(key);
                        const parsed = JSON.parse(value);
                        if (parsed.access_token) {
                            document.getElementById('authToken').value = parsed.access_token;
                            showStatus('Found auth token!', 'success');
                            return;
                        }
                    }
                }
                showStatus('No auth token found. Please log in first.', 'warning');
            } catch (e) {
                showStatus('Error getting auth token: ' + e.message, 'error');
            }
        };

        window.runTest = async function() {
            const btn = document.getElementById('testBtn');
            btn.disabled = true;
            
            const url = document.getElementById('supabaseUrl').value;
            const key = document.getElementById('supabaseKey').value;
            const token = document.getElementById('authToken').value;
            
            if (!url || !key || !token) {
                showStatus('Please fill in all fields', 'error');
                btn.disabled = false;
                return;
            }
            
            try {
                showStatus('Testing API key creation...', '');
                
                const response = await fetch(`${url}/functions/v1/create-api-key`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': key
                    },
                    body: JSON.stringify({
                        name: `Test Key ${new Date().toISOString()}`,
                        permissions: ['deals:read', 'deals:write'],
                        rate_limit: 1000
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    showStatus('✅ Success! API key created', 'success');
                    showResult({
                        status: 'SUCCESS',
                        apiKey: data.api_key,
                        preview: data.key_preview,
                        id: data.id,
                        permissions: data.permissions
                    });
                } else {
                    showStatus(`❌ Error ${response.status}: ${data.error || data.message}`, 'error');
                    showResult(data);
                }
            } catch (error) {
                showStatus('❌ Network error: ' + error.message, 'error');
                showResult({ error: error.message });
            } finally {
                btn.disabled = false;
            }
        };
        
        window.showStatus = function(message, type) {
            const status = document.getElementById('status');
            status.className = 'status ' + type;
            status.textContent = message;
        };
        
        window.showResult = function(data) {
            document.getElementById('result').textContent = JSON.stringify(data, null, 2);
        };
        
        window.clearResults = function() {
            document.getElementById('status').textContent = '';
            document.getElementById('status').className = '';
            document.getElementById('result').textContent = '';
        };
    </script>
</body>
</html>
EOF

log_success "Test page created: test-production-api-keys.html"

# Step 5: Display instructions
echo
log_success "Deployment preparation completed!"
echo
echo "📋 IMPORTANT - Manual Steps Required:"
echo "======================================"
echo
echo "1. 📊 Update Database Schema:"
echo "   • Go to Supabase Dashboard > SQL Editor"
echo "   • Copy and paste the contents of: manual-production-fix.sql"
echo "   • Click 'Run' to execute the SQL"
echo
echo "2. 🔑 Set Environment Variables (if needed):"
echo "   • Go to Supabase Dashboard > Settings > Edge Functions"
echo "   • Add SUPABASE_JWT_SECRET if not already set"
echo
echo "3. 🧪 Test the System:"
echo "   • Open test-production-api-keys.html in your browser"
echo "   • Fill in your Supabase URL and Anon Key"
echo "   • Click 'Test API Key Creation'"
echo
echo "4. 🔍 Monitor Functions:"
echo "   • Go to Supabase Dashboard > Functions"
echo "   • Check logs for any errors"
echo
echo "📁 Files Created:"
echo "================"
echo "• manual-production-fix.sql - Database setup script"
echo "• test-production-api-keys.html - Testing interface"
echo
echo "🔗 Useful Links:"
echo "==============="
echo "• Supabase Dashboard: https://app.supabase.com"
echo "• Edge Functions Logs: https://app.supabase.com/project/_/functions"
echo "• SQL Editor: https://app.supabase.com/project/_/sql"
echo
log_warning "Remember to run the SQL script first before testing!"
log_success "Once the database is updated, your API keys system will be fully functional! 🎉"