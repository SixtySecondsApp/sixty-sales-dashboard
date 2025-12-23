# 🚀 Fathom Embed Quick Start

## ⚡ TL;DR - I just want to test it

**Fastest way:**

```bash
# 1. Start a local server (IMPORTANT - don't use file://)
npx serve .

# 2. Open in browser:
# http://localhost:3000/fathom-debug.html
```

The debug tool will tell you exactly what's wrong.

---

## 🎯 What You're Seeing

**Message:** "Some environments block third-party iframes. The video failed to load within 6 seconds."

**This is NOT a bug** - it's a feature! The component detected that the iframe didn't load and is showing you a helpful fallback instead of a blank screen.

---

## 🔍 Why Isn't It Loading?

### Most Common Reasons:

1. **You opened the HTML file directly** (`file://`)
   - Solution: Use a local server (see below)

2. **Ad blocker is enabled**
   - Solution: Disable temporarily or add fathom.video to allowlist

3. **Network timeout (slow connection)**
   - Solution: Increase timeout from 6s to 15s

4. **Corporate firewall/VPN**
   - Solution: Test on different network

---

## ✅ Step-by-Step Fix

### Option 1: Use Local Server (Recommended)

```bash
# Pick ONE:

# Node.js:
npx serve .

# Python 3:
python -m http.server 8000

# Python 2:
python -m SimpleHTTPServer 8000

# PHP:
php -S localhost:8000
```

Then open:
- `http://localhost:3000/fathom-debug.html` (or :8000 depending on server)

### Option 2: Increase Timeout

If using FathomPlayerV2 in your React app:

```tsx
<FathomPlayerV2
  shareUrl="..."
  timeoutMs={15000}  // Try 15 seconds instead of 6
/>
```

### Option 3: Disable Ad Blocker

1. Click extension icon (usually in top-right)
2. Disable for this site
3. Reload page

### Option 4: Test in Incognito Mode

- Chrome: Cmd+Shift+N (Mac) or Ctrl+Shift+N (Windows)
- Firefox: Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows)
- Safari: Cmd+Shift+N (Mac)

This disables most extensions that might block iframes.

---

## 🧪 Files Created for You

| File | Purpose | How to Use |
|------|---------|------------|
| `fathom-debug.html` | **Diagnose why embedding fails** | Open with local server, runs automatic tests |
| `fathom-embed-test.html` | Full demo app with 2 meetings | Open with local server, test player features |
| `src/components/FathomPlayerV2.tsx` | Improved React component | Import and use in your app |
| `src/pages/FathomComparison.tsx` | Side-by-side comparison | Add route and compare V1 vs V2 |
| `FATHOM_TROUBLESHOOTING.md` | Detailed troubleshooting guide | Read if issues persist |
| `FATHOM_TESTING_README.md` | Complete documentation | Full implementation guide |

---

## 🎬 Quick Test Workflow

### 1. Start Local Server
```bash
npx serve .
```

### 2. Open Debug Tool
```
http://localhost:3000/fathom-debug.html
```

### 3. Read Results

The tool will tell you:
- ✅ **Green**: Tests passed - embedding should work
- ⚠️ **Yellow**: Warnings - may work with adjustments
- ❌ **Red**: Tests failed - see recommendations

### 4. Follow Recommendations

The tool gives specific instructions based on what failed.

---

## 🔧 Common Fixes

### "Direct fetch failed"
→ Network can't reach fathom.video
→ Check firewall/VPN settings

### "Iframe failed to load within 6000ms"
→ Timeout too short or iframe blocked
→ Increase timeout or disable ad blocker

### "Using file:// protocol"
→ Browser security blocks cross-origin requests
→ Use local server

### Works in debug tool but not in app
→ CSP headers blocking iframes
→ Add fathom.video to CSP policy

---

## 💻 Integrating into Your App

### Replace Existing FathomPlayer

```tsx
// Before:
import FathomPlayer from '@/components/FathomPlayer'

// After:
import FathomPlayerV2 from '@/components/FathomPlayerV2'

// Usage (drop-in replacement):
<FathomPlayerV2
  shareUrl={meeting.share_url}
  timeoutMs={10000}  // Optional: adjust timeout
  onLoad={() => console.log('Loaded!')}
  onError={() => console.log('Failed')}
/>
```

### Add Comparison Page

```tsx
// In your router:
import { FathomComparison } from '@/pages/FathomComparison'

{
  path: '/fathom-comparison',
  element: <FathomComparison />
}

// Then visit:
// http://localhost:5173/fathom-comparison
```

---

## 📊 What Success Looks Like

### ✅ Working:
- You see the Fathom video player
- Video plays when clicked
- Timestamp jumps work
- Console shows: `[FathomPlayerV2] Iframe loaded successfully`

### ⚠️ Fallback (Expected in Some Environments):
- You see "Couldn't load the embedded video" message
- "Open in Fathom" button works
- This is **correct behavior** - better than blank screen!

---

## 🆘 Still Having Issues?

### Run This in Browser Console:

```javascript
// Quick diagnostic:
console.log({
  protocol: window.location.protocol,
  online: navigator.onLine,
  cookies: navigator.cookieEnabled,
  userAgent: navigator.userAgent.slice(0, 50)
});
```

**If protocol is `file:`** → You MUST use a local server

**If online is `false`** → Check internet connection

**If cookies is `false`** → Enable cookies in browser settings

---

## 📞 Debug Checklist

Before asking for help, verify:

- [ ] Using local server (http:// or https://, NOT file://)
- [ ] Tested with ad blocker disabled
- [ ] Tried in incognito mode
- [ ] Checked browser console for errors
- [ ] Verified "Open in Fathom" button works
- [ ] Tried increasing timeout to 15 seconds
- [ ] Tested on different network (not corporate VPN)

---

## 🎯 Expected Behavior

The FathomPlayerV2 component is **working correctly** when:

1. It shows a loading spinner while iframe loads
2. It displays the video if embedding succeeds
3. It shows fallback UI with "Open in Fathom" if embedding fails

**All three states are intentional and correct!**

---

## 💡 Pro Tips

### For Development:
- Always use local server for testing HTML files
- Use longer timeout (15s) during development
- Keep browser console open to see debug logs

### For Production:
- Set timeout to 10-15 seconds (networks vary)
- Monitor error rates with `onError` callback
- Ensure CSP headers allow fathom.video
- Fallback UI is user-friendly - embrace it!

---

## 🔗 Next Steps

1. **Start here:** `fathom-debug.html` with local server
2. **Learn more:** `FATHOM_TROUBLESHOOTING.md`
3. **Full docs:** `FATHOM_TESTING_README.md`
4. **Integrate:** Use FathomPlayerV2 in your app

---

**Remember:** The timeout/fallback system is a **feature**, not a bug. It makes your app more robust by gracefully handling embedding failures that are outside your control (ad blockers, CSP, firewalls, etc.).

Good luck! 🚀
