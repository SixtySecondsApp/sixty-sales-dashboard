# Export Instructions for Landing Page

The landing page has been built and is ready to share!

## Option 1: Share the dist folder (Recommended)

1. **Zip the dist folder:**
   ```bash
   cd packages/landing
   zip -r landing-page.zip dist/
   ```

2. **Share the `landing-page.zip` file** with your colleague

3. **Your colleague should:**
   - Unzip the file
   - Open a terminal in the unzipped folder
   - Run one of these commands to serve it:
     - **Node.js (if installed):** `node serve-dist.js` or `npx serve dist`
     - **Python 3:** `python3 -m http.server 3000`
     - **Python 2:** `python -m SimpleHTTPServer 3000`
   - Open `http://localhost:3000` in their browser

## Option 2: Use the included server script

1. **Share both the `dist` folder AND `serve-dist.js` file**

2. **Your colleague should:**
   - Extract both files to the same directory
   - Run: `node serve-dist.js`
   - Open `http://localhost:3000` in their browser

## Option 3: Use a simple HTTP server (if Node.js is installed)

Your colleague can use `npx serve`:
```bash
npx serve dist
```

## Quick Share Command

To create a shareable zip file:
```bash
cd packages/landing
zip -r landing-page-export.zip dist/ serve-dist.js EXPORT_INSTRUCTIONS.md
```

Then share `landing-page-export.zip` with your colleague!

---

**Note:** The landing page is a Single Page Application (SPA) built with React, so it needs to be served via HTTP (not just opened as a file) for routing and module loading to work correctly.

