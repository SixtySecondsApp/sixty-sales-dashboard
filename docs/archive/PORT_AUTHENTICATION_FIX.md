# Port Authentication Fix

## Problem
When running the dev server on port 5174 (or any port other than 5173), authentication fails because:
1. Multiple dev servers can run simultaneously
2. Supabase redirect URLs might be configured for specific ports
3. LocalStorage keys might conflict between different ports

## Solution Implemented

### 1. **Vite Configuration**
- Set default port to 5173 in `vite.config.ts`
- Use `strictPort: false` to allow automatic port increment
- Only one dev server should run at a time

### 2. **Dynamic Site URL**
- `getSiteUrl()` function uses `window.location.origin`
- Works with any port automatically
- No hardcoded localhost:5173 references

### 3. **Per-Origin Sessions (No mock fallback)**
- Sessions are per-origin (protocol + host + port). Changing ports requires re-login.
- Run a single dev server (5173) to avoid confusion.
- Do not rely on mock authentication; only real Supabase sessions are considered authenticated.

### 4. **Enhanced Diagnostics**
- Shows current port in diagnostic tool
- Indicates if mock user is enabled
- Helps troubleshoot port-specific issues

## How to Use

### Option 1: Single Dev Server (Recommended)
```bash
# Kill any existing dev servers
pkill -f "vite"

# Start fresh
npm run dev
```

### Option 2: Specific Port
```bash
# Kill existing servers
pkill -f "vite"

# Start on specific port
npm run dev -- --port 5173
```

### Option 3: Force Mock User
Add to `.env.local`:
```env
VITE_ALLOW_MOCK_USER=true
```

## Verification Steps

1. Check diagnostic tool (bottom-right corner in dev mode)
2. Look for:
   - ✅ Environment Variables configured
   - ✅ Supabase Connection successful
   - ✅ LocalStorage accessible
   - ℹ️ If you changed ports, re-login is expected due to per-origin sessions

## Important Notes

- **No mock fallback**: Guards should only trust real Supabase sessions
- **Port Conflicts**: Kill duplicate servers to avoid issues
- **Supabase Dashboard**: Add your dev origin(s) to redirect URLs if needed

## Commands

```bash
# Check what's running on ports
lsof -i :5173 -i :5174 | grep LISTEN

# Kill specific process
kill [PID]

# Kill all Vite processes
pkill -f "vite"

# Start fresh
npm run dev
```