# Fathom Embed Troubleshooting Guide

## 🚨 "Video failed to load within 6 seconds" Error

This error means the iframe didn't trigger its `onLoad` event within the timeout period. This is **expected behavior** when iframes are blocked or slow to load.

---

## 🔍 Quick Diagnostic Steps

### Step 1: Use the Debug Tool

Open `fathom-debug.html` in your browser:

```bash
# Just double-click the file or open it:
open fathom-debug.html
```

This tool will:
- ✅ Test if Fathom URLs are accessible
- ✅ Check browser environment
- ✅ Monitor iframe load events
- ✅ Provide specific recommendations

### Step 2: Check Browser Console

1. Open Developer Tools (F12 or Cmd+Option+I)
2. Go to Console tab
3. Look for errors like:

**Common Error Patterns:**

```
❌ Refused to display 'https://fathom.video/...' in a frame because it set 'X-Frame-Options' to 'deny'.
→ Solution: Fathom blocks embedding, you need a different share URL

❌ Blocked by Content Security Policy
→ Solution: Your app's CSP needs to allow fathom.video

❌ Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure frame 'http://...'.
→ Solution: Ensure embed URL uses HTTPS

❌ net::ERR_BLOCKED_BY_CLIENT
→ Solution: Ad blocker or browser extension is blocking
```

### Step 3: Test Direct Access

Click the "Open in Fathom" button. Does the video play?

- **YES** → The Fathom URL works, embedding is blocked
- **NO** → The share URL itself may be invalid or expired

---

## 🛠️ Common Issues & Solutions

### Issue 1: File Protocol (`file://`)

**Symptom:** Testing HTML files by opening them directly (file://)

**Why it fails:**
- Browsers block cross-origin requests from file:// protocol
- Security restriction to prevent malicious local files

**Solutions:**
```bash
# Option A: Use a local server (recommended)
npx serve .
# Then visit http://localhost:3000/fathom-embed-test.html

# Option B: Python simple server
python -m http.server 8000
# Then visit http://localhost:8000/fathom-embed-test.html

# Option C: PHP server
php -S localhost:8000
# Then visit http://localhost:8000/fathom-embed-test.html
```

### Issue 2: Ad Blockers

**Symptom:** Iframe never loads, console shows `net::ERR_BLOCKED_BY_CLIENT`

**Common blockers:**
- uBlock Origin
- AdBlock Plus
- Privacy Badger
- Brave Shields

**Solutions:**
1. Temporarily disable ad blocker
2. Add fathom.video to allowlist
3. Test in incognito mode (often disables extensions)

### Issue 3: Content Security Policy (CSP)

**Symptom:** Console error about CSP violation

**Example error:**
```
Refused to frame 'https://fathom.video/' because an ancestor violates the following Content Security Policy directive: "frame-src 'self'"
```

**Solutions:**

If you control the parent page, add to CSP headers:
```html
<!-- In your HTML -->
<meta http-equiv="Content-Security-Policy"
      content="frame-src 'self' https://fathom.video https://app.fathom.video;">

<!-- Or in server headers -->
Content-Security-Policy: frame-src 'self' https://fathom.video https://app.fathom.video;
```

For Vite (vite.config.ts):
```typescript
export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': "frame-src 'self' https://fathom.video https://app.fathom.video;"
    }
  }
})
```

### Issue 4: Corporate Firewall / VPN

**Symptom:** Works at home but not at office

**Why:**
- Corporate networks often block video streaming sites
- VPNs may route traffic through restrictive countries

**Solutions:**
1. Contact IT to allowlist fathom.video
2. Test outside corporate network
3. Use direct Fathom links instead of embedding

### Issue 5: Slow Network Connection

**Symptom:** Works sometimes, fails other times

**Why:**
- 6-second timeout too aggressive for slow connections
- Mobile networks can be unpredictable

**Solutions:**

Increase timeout in code:
```tsx
<FathomPlayerV2
  shareUrl="..."
  timeoutMs={15000}  // 15 seconds instead of 6
/>
```

Or in HTML test page:
```javascript
// Change this line:
timeoutMs: 15000  // Instead of 6000
```

### Issue 6: Invalid or Expired Share URL

**Symptom:** "Open in Fathom" button also doesn't work

**Why:**
- Share URL was deleted
- URL permissions changed
- Wrong Fathom account

**Solutions:**
1. Verify URL in Fathom dashboard
2. Check share settings (public vs private)
3. Generate new share URL

### Issue 7: Browser Privacy Settings

**Symptom:** Works in Chrome, fails in Firefox/Safari

**Why:**
- Firefox Enhanced Tracking Protection blocks third-party frames
- Safari Intelligent Tracking Prevention
- Brave Shields

**Solutions:**

**Firefox:**
1. Click shield icon in address bar
2. Turn off Enhanced Tracking Protection for this site

**Safari:**
1. Safari → Preferences → Privacy
2. Uncheck "Prevent cross-site tracking" (temporarily)

**Brave:**
1. Click lion icon in address bar
2. Change Shields to "Down"

---

## 🧪 Testing Matrix

Test in this order to isolate the issue:

| Step | Test | Expected Result | If Failed |
|------|------|-----------------|-----------|
| 1 | Open fathom-debug.html | Diagnostic info appears | Browser too old |
| 2 | Click "Run Test" | Tests execute | Check console errors |
| 3 | Direct fetch test passes | ✅ Success | Network/firewall issue |
| 4 | Iframe loads within timeout | ✅ Success | See Issue 1-7 above |
| 5 | Click "Open in Fathom" | Opens in new tab | Invalid share URL |

---

## 📊 Environment-Specific Solutions

### Local Development (HTML files)

**Problem:** `file://` protocol blocking

**Solution:**
```bash
# Use any local server:
npx serve .
# OR
python -m http.server 8000
```

### React App (Vite/CRA)

**Problem:** CSP headers or slow initial load

**Solutions:**
```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Content-Security-Policy': "frame-src 'self' https://fathom.video https://app.fathom.video;"
    }
  }
})
```

```tsx
// Increase timeout for development
<FathomPlayerV2 timeoutMs={15000} />
```

### Production Deployment

**Problem:** Stricter security policies

**Solutions:**
1. Ensure CSP allows fathom.video
2. Use longer timeout (10-15s)
3. Monitor with onError callback:

```tsx
<FathomPlayerV2
  onError={() => {
    // Log to analytics
    analytics.track('fathom_embed_failed', {
      shareId: meeting.id,
      userAgent: navigator.userAgent
    })
  }}
/>
```

---

## 🔧 Advanced Debugging

### Enable Verbose Logging

Add this to test pages:
```javascript
// Log all iframe events
const iframe = document.querySelector('iframe');
iframe.addEventListener('load', () => console.log('✅ Load'));
iframe.addEventListener('error', () => console.log('❌ Error'));

// Log CSP violations
document.addEventListener('securitypolicyviolation', (e) => {
  console.error('CSP Violation:', e.violatedDirective, e.blockedURI);
});
```

### Network Tab Inspection

1. Open DevTools → Network tab
2. Reload page
3. Filter by "fathom"
4. Check:
   - Status code (should be 200)
   - Response headers
   - Time to load

### Iframe Communication Test

Test if iframe can communicate:
```javascript
const iframe = document.querySelector('iframe');
iframe.addEventListener('load', () => {
  try {
    console.log('Iframe document:', iframe.contentDocument);
  } catch (e) {
    console.log('Cross-origin restriction (expected):', e.message);
  }
});
```

---

## 💡 Recommended Workflow

### For Development:
1. Use `fathom-debug.html` to identify root cause
2. Increase timeout to 15 seconds
3. Disable browser extensions temporarily
4. Use local server (not file://)

### For Production:
1. Set timeout to 10-15 seconds
2. Add proper CSP headers
3. Implement onError tracking
4. Provide fallback "Open in Fathom" button
5. Monitor error rates

---

## 📞 Still Not Working?

### Gather Debug Info:

```javascript
// Run this in browser console:
const debugInfo = {
  userAgent: navigator.userAgent,
  cookiesEnabled: navigator.cookieEnabled,
  online: navigator.onLine,
  protocol: window.location.protocol,
  csp: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
  errors: performance.getEntriesByType('resource')
    .filter(r => r.name.includes('fathom'))
    .map(r => ({ url: r.name, duration: r.duration }))
};
console.log(JSON.stringify(debugInfo, null, 2));
```

### Check These:

1. ✅ Share URL is valid (test in browser)
2. ✅ Network can reach fathom.video
3. ✅ No ad blockers active
4. ✅ Using http:// or https:// (not file://)
5. ✅ CSP allows frame-src
6. ✅ Timeout is reasonable (10-15s)
7. ✅ Browser console shows no errors

---

## 🎯 Quick Fixes Summary

| Symptom | Quick Fix |
|---------|-----------|
| "Failed to load" | Increase timeout to 15000ms |
| Works in incognito | Disable browser extensions |
| file:// in URL | Use local server (npx serve) |
| CSP error | Add fathom.video to frame-src |
| Works on phone | Corporate firewall blocking |
| "Open in Fathom" fails too | Invalid/expired share URL |

---

## 🔗 Useful Resources

- [Fathom Help Center](https://help.fathom.video/)
- [CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Iframe Security](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe)

---

**Remember:** The timeout and fallback UI are **features, not bugs**. They provide a better user experience when embedding fails, which can happen for many legitimate reasons (ad blockers, CSP, firewalls, etc.).
