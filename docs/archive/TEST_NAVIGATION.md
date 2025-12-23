# Navigation Test for Task Sync Settings

## Issue
When navigating to `/settings/task-sync`, the page redirects to homepage.

## Troubleshooting Steps

### 1. Check Browser Console
Open browser at: `http://localhost:5175/settings/task-sync`

Look for:
- Any red errors in console
- Network tab - check if any requests fail
- React error overlay
- Any redirect messages

### 2. Check React Router
The route is configured at line 458 in `src/App.tsx`:
```tsx
<Route path="/settings/task-sync" element={<AppLayout><TaskSyncSettings /></AppLayout>} />
```

### 3. Alternative Access Methods

Try accessing via Settings page:
1. Go to `http://localhost:5175/settings`
2. Look for "Task Auto-Sync" link
3. Click it

Or try direct component test:
1. Go to any working page (e.g., `/settings/ai`)
2. Manually change URL to `/settings/task-sync`
3. See if it loads

### 4. Check Auth Context
The component uses `useAuth()` hook. If auth context is not loaded, it might redirect.

Check in `TaskSyncSettings.tsx` line 13:
```tsx
const { userData } = useAuth()
```

### 5. Common Causes

1. **Missing Auth**: If `userData` is null, component might not render
2. **Route Guard**: Check if there's a route guard blocking access
3. **Import Error**: Component might not be importing correctly
4. **Lazy Load Issue**: lazyWithRetry might be failing

### 6. Quick Fix Test

Try adding a console.log in the component:

In `src/pages/settings/TaskSyncSettings.tsx`, add at line 13:
```tsx
const { userData } = useAuth()
console.log('[TaskSyncSettings] Component mounted, userData:', userData)
```

Then reload `/settings/task-sync` and check console.

### 7. Check Network Tab

In browser DevTools → Network:
- Look for failed requests
- Check if TaskSyncSettings.tsx loads
- See if there's a redirect (301/302 status)

## Expected Behavior

Page should show:
- Title: "Task Auto-Sync Settings"
- Enable/disable toggle
- Importance level checkboxes (High, Medium, Low)
- Confidence threshold slider
- Preview section
- Save button

## If Still Not Working

Please provide:
1. Browser console errors (screenshot or copy/paste)
2. Network tab status codes
3. Any React error overlays
4. Current URL after redirect

This will help diagnose the exact issue.
