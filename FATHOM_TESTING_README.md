# Fathom Embed Testing Guide

This guide explains how to test and use the new Fathom video embedding improvements.

## 🎯 What Was Created

### 1. **fathom-embed-test.html** (Standalone Test Page)
A self-contained HTML file you can open directly in your browser without running the dev server.

**Features:**
- Complete React app with Tailwind CSS (via CDN)
- Improved FathomPlayer with timeout detection
- 2 demo meetings with real Fathom share URLs
- Action items with timestamp jumping
- Loading states and fallback UI

**How to Use:**
1. Simply double-click `fathom-embed-test.html` to open it in your browser
2. Click "Open" on any meeting to test the video player
3. Try clicking action items to test timestamp jumping
4. Check browser console (F12) for debug logs

**What to Test:**
- Does the video load within 6 seconds?
- Do you see a loading spinner while it loads?
- If it fails to load, do you see the fallback UI with "Open in Fathom" button?
- Do timestamp jumps work when clicking action items?

---

### 2. **src/components/FathomPlayerV2.tsx** (Improved Component)
Enhanced TypeScript version for integration into your app.

**Key Improvements:**
- ✅ 6-second timeout detection
- ✅ Loading state with spinner
- ✅ Fallback UI when iframe fails
- ✅ "Open in Fathom" escape hatch
- ✅ `onLoad` and `onError` callbacks
- ✅ Drop-in compatible with existing FathomPlayer

**Usage Example:**
```tsx
import FathomPlayerV2 from '@/components/FathomPlayerV2'

function MyComponent() {
  return (
    <FathomPlayerV2
      shareUrl="https://fathom.video/share/YOUR_ID_HERE"
      title="Meeting Recording"
      timeoutMs={6000}  // Optional, defaults to 6000ms
      onLoad={() => console.log('Video loaded!')}
      onError={() => console.log('Video failed to load')}
    />
  )
}
```

**API (same as FathomPlayer + new props):**
```typescript
interface FathomPlayerV2Props {
  shareUrl?: string
  id?: string
  recordingId?: string
  autoplay?: boolean
  startSeconds?: number
  aspectRatio?: string | number
  className?: string
  title?: string
  timeoutMs?: number      // NEW: Default 6000
  onLoad?: () => void     // NEW: Called when iframe loads
  onError?: () => void    // NEW: Called on timeout
}
```

---

### 3. **src/pages/FathomComparison.tsx** (Comparison Page)
Side-by-side comparison of FathomPlayer (V1) vs FathomPlayerV2 (V2).

**Features:**
- Visual comparison of both implementations
- Load time metrics
- Recording selector
- Debug information
- Implementation notes

**How to Use:**
1. Add route to your router (see below)
2. Navigate to `/fathom-comparison`
3. Select a test recording
4. Compare load behavior and performance

**Add to Router:**
```tsx
// In your router configuration
import { FathomComparison } from '@/pages/FathomComparison'

// Add route
{
  path: '/fathom-comparison',
  element: <FathomComparison />
}
```

---

## 🧪 Testing Workflow

### Quick Test (No Setup)
1. Open `fathom-embed-test.html` in browser
2. Test both demo recordings
3. Verify timeout/fallback behavior
4. Check console for logs

### App Integration Test
1. Add FathomComparison route to your router
2. Navigate to `/fathom-comparison`
3. Compare V1 vs V2 side-by-side
4. Measure load times

### Production Integration
1. Replace `FathomPlayer` with `FathomPlayerV2` in your code
2. Add error handling callbacks if needed
3. Test in your production environment
4. Monitor load success rates

---

## 🔍 Key Improvements Explained

### Timeout Detection
**Problem:** Iframes can hang indefinitely if blocked by CSP, ad blockers, or firewalls.
**Solution:** V2 implements a 6-second timeout to detect failures early.

### Loading State
**Problem:** Users see a blank black box while video loads.
**Solution:** V2 shows a loading spinner and message for better UX.

### Fallback UI
**Problem:** When embedding fails, users see nothing.
**Solution:** V2 shows a helpful error message with "Open in Fathom" button.

### Error Callbacks
**Problem:** No way to track or debug loading failures.
**Solution:** V2 provides `onLoad` and `onError` callbacks for monitoring.

---

## 📊 Comparison: V1 vs V2

| Feature | FathomPlayer (V1) | FathomPlayerV2 (V2) |
|---------|------------------|---------------------|
| Basic embedding | ✅ | ✅ |
| Timeout detection | ❌ | ✅ (6s default) |
| Loading state | ❌ | ✅ |
| Fallback UI | ❌ | ✅ |
| Error callbacks | ❌ | ✅ |
| "Open in Fathom" | ❌ | ✅ |
| Ref forwarding | ✅ | ✅ |
| seekToTimestamp | ✅ | ✅ |
| API compatibility | — | ✅ Drop-in |

---

## 🐛 Troubleshooting

### Video doesn't load in either version
**Possible Causes:**
- CSP (Content Security Policy) blocking iframes
- Ad blocker blocking third-party content
- Corporate firewall blocking fathom.video
- Invalid or expired share URL

**Solutions:**
1. Check browser console for errors
2. Try disabling ad blocker
3. Test in incognito mode
4. Click "Open in Fathom" to verify URL works

### Timeout triggers even though video loads
**Possible Causes:**
- Slow network connection
- Timeout too aggressive (< 6s)

**Solutions:**
1. Increase `timeoutMs` prop: `<FathomPlayerV2 timeoutMs={10000} />`
2. Check network speed in DevTools

### V2 always shows fallback UI
**Possible Causes:**
- iframe.onLoad event not firing
- React strict mode mounting twice (dev only)

**Solutions:**
1. Check if issue occurs in production build
2. Verify iframe renders in DOM (inspect element)
3. Try different browser

---

## 📝 Next Steps

1. **Test the standalone HTML page** - Verify basic functionality
2. **Compare implementations** - Use FathomComparison page
3. **Integrate V2** - Replace FathomPlayer with FathomPlayerV2 in your app
4. **Monitor metrics** - Use onLoad/onError to track success rates
5. **Report issues** - Document any embedding failures

---

## 🔗 Related Files

- `/fathom-embed-test.html` - Standalone test page
- `/src/components/FathomPlayer.tsx` - Original implementation
- `/src/components/FathomPlayerV2.tsx` - Improved implementation
- `/src/pages/FathomComparison.tsx` - Comparison page
- `/src/pages/MeetingDetail.tsx` - Current usage of FathomPlayer

---

## 📚 Resources

- [Fathom Embed Documentation](https://help.fathom.video/en/articles/5446472-embed-fathom-recordings)
- [Iframe Security](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)
- [React useImperativeHandle](https://react.dev/reference/react/useImperativeHandle)

---

## ✅ Testing Checklist

- [ ] Standalone HTML page loads and displays meetings list
- [ ] Video player shows loading state while iframe loads
- [ ] Video plays successfully when embedding works
- [ ] Fallback UI displays if video fails to load within 6 seconds
- [ ] "Open in Fathom" button opens recording in new tab
- [ ] Timestamp jumping works for action items
- [ ] Console logs show debug information
- [ ] FathomComparison page loads and shows both versions
- [ ] Load time metrics appear for both versions
- [ ] Error callbacks fire when expected
- [ ] Component works in production build

---

**Questions?** Check browser console for debug logs or review the implementation notes in the comparison page.
