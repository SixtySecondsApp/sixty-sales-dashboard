# How to Get Your User Authentication Token

## The Issue

The browser console error shows:
```
POST https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/test-fathom-token 401 (Unauthorized)
```

This means the **Supabase user token** is invalid or missing, not the Fathom token.

## Quick Fix: Get Your Session Token

### Option 1: From Application State (Easiest)

Run this in your browser console while logged into your app:

```javascript
// Method 1: From Supabase client
const { data: { session } } = await supabase.auth.getSession();
console.log('Access Token:', session?.access_token);

// Then test Fathom with the correct token
const response = await fetch(
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/test-fathom-token',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
    }
  }
);
const result = await response.json();
console.log('Test Result:', result);
```

### Option 2: From localStorage

```javascript
// Get the session from localStorage
const authData = JSON.parse(localStorage.getItem('sb-ewtuefzeogytgmsnkpmb-auth-token'));
console.log('Access Token:', authData?.access_token);

// Test Fathom
const response = await fetch(
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/test-fathom-token',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authData.access_token}`,
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // Your anon key
    }
  }
);
const result = await response.json();
console.log('Test Result:', result);
```

### Option 3: Add Test Button to UI (Best for Production)

Add this component to your Integrations page:

```typescript
// FathomTokenTest.tsx
import { supabase } from '@/lib/supabase/clientV2';
import { useState } from 'react';

export function FathomTokenTest() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testToken = async () => {
    setTesting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('test-fathom-token');

      if (error) throw error;

      setResult(data);

      if (data.success) {
        alert('✅ Token is valid! You can sync meetings now.');
      } else {
        alert('❌ Token is invalid. Please reconnect your Fathom account.');
      }
    } catch (error) {
      console.error('Test error:', error);
      setResult({ error: error.message });
      alert('Error testing token: ' + error.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={testToken}
        disabled={testing}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {testing ? 'Testing...' : 'Test Fathom Connection'}
      </button>

      {result && (
        <div className={`p-4 rounded ${result.success ? 'bg-green-50' : 'bg-red-50'}`}>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

Then add it to your Integrations page:

```typescript
import { FathomTokenTest } from '@/components/FathomTokenTest';

// In your JSX
<FathomTokenTest />
```

## Common Issues

### Issue 1: "localStorage.getItem returns null"

**Cause:** Using wrong localStorage key

**Solution:** Check what keys exist:
```javascript
Object.keys(localStorage).filter(key => key.includes('supabase') || key.includes('auth'));
```

### Issue 2: "session is null"

**Cause:** User is not logged in

**Solution:** Log in first, then run the test

### Issue 3: "apikey is not defined"

**Cause:** Trying to use import.meta.env in console

**Solution:** Replace with your actual anon key:
```javascript
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // Get from .env or Supabase dashboard
```

## Finding Your Supabase Anon Key

### Option 1: From Environment
```bash
cat .env | grep VITE_SUPABASE_ANON_KEY
```

### Option 2: From Supabase Dashboard
1. Go to https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/settings/api
2. Find "Project API keys" section
3. Copy the "anon" "public" key

### Option 3: From Your App Code
```typescript
// Look in your supabase client initialization
console.log(import.meta.env.VITE_SUPABASE_ANON_KEY);
```

## Correct Test Command

Once you have both tokens:

```javascript
const ANON_KEY = 'YOUR_ANON_KEY_HERE';
const ACCESS_TOKEN = 'YOUR_ACCESS_TOKEN_HERE'; // From session

const response = await fetch(
  'https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/test-fathom-token',
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'apikey': ANON_KEY
    }
  }
);

const result = await response.json();
console.log('✅ Test Result:', result);
```

## Expected Success Response

```json
{
  "success": true,
  "message": "✅ Token is valid and working!",
  "integration": {
    "id": "abc-123",
    "email": "user@example.com",
    "expires_at": "2025-10-25T10:00:00Z",
    "scopes": ["public_api"]
  },
  "api_test": {
    "status": 200,
    "meetings_count": 5,
    "has_cursor": true
  }
}
```

## Alternative: Use Supabase REST API Directly

If you can't get tokens working in console, use Supabase SQL:

```sql
-- Check your Fathom integration directly
SELECT
  id,
  fathom_user_email,
  is_active,
  token_expires_at,
  scopes,
  created_at
FROM fathom_integrations
WHERE user_id = auth.uid()
AND is_active = true;
```

Run this in Supabase SQL Editor (you'll be auto-authenticated).

---

## TL;DR - Fastest Path

**If you have Zustand or React Query in your app:**

```typescript
// Just call the function using your existing Supabase client
const testFathom = async () => {
  const { data, error } = await supabase.functions.invoke('test-fathom-token');
  console.log(data);
};
```

This handles authentication automatically! 🎯
