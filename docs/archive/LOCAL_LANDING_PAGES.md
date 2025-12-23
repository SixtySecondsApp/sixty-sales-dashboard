# Local Landing Page Preview

This setup allows you to preview the landing pages locally during development without affecting the production deployment.

## Usage

When running the development server (`npm run dev`), you can access the landing pages at:

- **Main Landing Page**: http://localhost:5175/landing
- **Waitlist Page**: http://localhost:5175/landing/waitlist
- **Pricing Page**: http://localhost:5175/landing/pricing

## How It Works

1. **Development Only**: The `/landing/*` routes are only active when `NODE_ENV === 'development'`
2. **No Production Impact**: In production builds, these routes redirect to home
3. **Separate Deployment**: Landing pages continue to deploy separately to www.use60.com
4. **Lazy Loading**: Landing pages are loaded on-demand to avoid bundling in production

## Technical Details

### Files Modified

1. **`src/components/LandingWrapper.tsx`** - Wraps landing pages for local preview
2. **`src/App.tsx`** - Adds conditional `/landing/*` routes (dev only)
3. **`vite.config.ts`** - Adds `@landing` alias for importing landing package

### Architecture

```
sixty-sales-dashboard/
├── src/                    # Main app
│   └── App.tsx            # Includes conditional /landing/* routes
├── packages/
│   └── landing/           # Landing pages package (separate deployment)
│       └── src/
│           ├── pages/
│           │   ├── MeetingsLandingV4.tsx
│           │   ├── WaitlistLanding.tsx
│           │   └── PricingPage.tsx
│           └── styles/
│               └── index.css
```

## Deployment

### Main App Deployment
- Builds from root `src/`
- `/landing/*` routes are **not included** in production bundle
- Deployed to app.use60.com

### Landing Pages Deployment
- Builds from `packages/landing/`
- Uses separate build process
- Deployed to www.use60.com

## Development Workflow

```bash
# Start main app development server
npm run dev

# View landing pages locally
# Open browser to:
# - http://localhost:5175/landing
# - http://localhost:5175/landing/waitlist
# - http://localhost:5175/landing/pricing
```

## Important Notes

1. **No Production Bundle Impact**: Landing pages are conditionally loaded and tree-shaken in production
2. **Styles Are Scoped**: Landing page styles don't affect main app styles
3. **Deployment Independence**: Landing pages deploy separately - this setup doesn't change that
4. **Dev Tool Only**: This is purely a developer convenience feature

## Troubleshooting

### Landing pages show blank screen
- Check console for import errors
- Verify `packages/landing/` exists with all source files
- Ensure Vite dev server is running on port 5175

### Styles look wrong
- Landing pages use their own Tailwind config
- Styles are isolated from main app
- Check browser console for CSS loading errors

### Routes don't work in production
- This is expected behavior!
- Landing routes are dev-only
- Production uses separate deployments (app.use60.com vs www.use60.com)
