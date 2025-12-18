# Vercel Deployment Configuration for Landing Pages

## Current Configuration

The `vercel.json` in `packages/landing/` assumes Vercel is running from the **repository root**.

## Vercel Project Settings

In the Vercel dashboard for `sixty-meetings-landing-page`, check the **Root Directory** setting:

### Option 1: Root Directory = Repository Root (default)
If Root Directory is **empty** or set to **`.`** (repo root):
- ✅ Current `vercel.json` configuration should work
- `installCommand`: `npm install` (runs from repo root)
- `buildCommand`: `cd packages/landing && npm run build`
- `outputDirectory`: `packages/landing/dist`

### Option 2: Root Directory = packages/landing
If Root Directory is set to **`packages/landing`**:
- ❌ Current configuration won't work
- Update `vercel.json` to:
  ```json
  {
    "installCommand": "cd ../.. && npm install",
    "buildCommand": "npm run build",
    "outputDirectory": "dist"
  }
  ```

## Troubleshooting

### If deployment still fails:

1. **Check Vercel Build Logs** for specific error messages
2. **Verify Root Directory** in Vercel project settings
3. **Check Environment Variables** - landing pages may need:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - Any other VITE_ prefixed variables

4. **Verify Node Version** - should be >= 18.0.0 (set in `package.json` engines)

5. **Check Build Output** - ensure `dist` folder is created in `packages/landing/`

## Manual Build Test

To test the build locally:
```bash
# From repository root
npm install
cd packages/landing
npm run build

# Check if dist folder exists
ls -la dist/
```

If this works locally but fails on Vercel, the issue is likely:
- Root Directory mismatch
- Missing environment variables
- Node version mismatch
