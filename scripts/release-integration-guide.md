# Release API Integration Guide

This guide explains how to integrate the new release API endpoints with CI/CD and frontend components.

## 📋 API Endpoints

### `/public/version.json`
Returns current build information:
```json
{
  "buildId": "build-2025-08-28T19-32-36-v1.0.2",
  "builtAt": "2025-08-28T19:32:36.859Z"
}
```

### `/public/releases.json`
Returns release history (max 10 releases):
```json
[
  {
    "buildId": "build-2025-08-28T19-32-36-v1.0.2",
    "date": "2025-08-28T19:32:36.859Z",
    "notes": "🎉 New release API endpoints with proper cache control headers"
  }
]
```

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy Release
on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build and Release
        run: npm run release:build
        env:
          BUILD_VERSION: ${{ github.ref_name }}
          RELEASE_NOTES: "Release ${{ github.ref_name }}"
      
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

### Vercel Build Command
Update `vercel.json` build command to use the integrated script:
```json
{
  "buildCommand": "npm run release:build"
}
```

## 📜 NPM Scripts

Available release management scripts:

```bash
# Update version.json only
npm run version:update [version]

# Add new release entry
npm run release:add "Release notes here" [buildId]

# Complete build process with versioning
npm run release:build [version] [notes]
```

## 🔧 Frontend Integration

### React Component Example
```tsx
import { useEffect, useState } from 'react';

interface VersionInfo {
  buildId: string;
  builtAt: string;
}

interface Release {
  buildId: string;
  date: string;
  notes: string;
}

export function VersionDisplay() {
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [releases, setReleases] = useState<Release[]>([]);

  useEffect(() => {
    // Fetch current version
    fetch('/version.json')
      .then(res => res.json())
      .then(setVersion)
      .catch(console.error);

    // Fetch release history
    fetch('/releases.json')
      .then(res => res.json())
      .then(setReleases)
      .catch(console.error);
  }, []);

  if (!version) return <div>Loading...</div>;

  return (
    <div className="version-info">
      <p>Build: {version.buildId}</p>
      <p>Built: {new Date(version.builtAt).toLocaleDateString()}</p>
      
      <h3>Recent Releases</h3>
      {releases.slice(0, 3).map(release => (
        <div key={release.buildId} className="release-item">
          <strong>{release.buildId}</strong>
          <p>{release.notes}</p>
        </div>
      ))}
    </div>
  );
}
```

## 🔒 Cache Control

The endpoints are configured with `Cache-Control: no-store` headers in `vercel.json` to ensure fresh data:

```json
{
  "source": "/(version|releases)\\.json",
  "headers": [
    {
      "key": "Cache-Control",
      "value": "no-store, no-cache, must-revalidate"
    },
    {
      "key": "Content-Type",
      "value": "application/json"
    },
    {
      "key": "Access-Control-Allow-Origin",
      "value": "*"
    }
  ]
}
```

## 🧪 Testing

Test the endpoints locally:
```bash
# Start development server
npm run dev

# Test endpoints
curl http://localhost:5173/version.json
curl http://localhost:5173/releases.json
```

Test the scripts:
```bash
# Test version update
npm run version:update v1.0.3

# Test release addition
npm run release:add "Fixed critical bug" build-custom-id

# Test complete build (skip actual build for testing)
SKIP_BUILD=true npm run release:build v1.0.4 "Testing release"
```

## 🚀 Production Deployment

1. Ensure scripts are executable:
   ```bash
   chmod +x scripts/*.js
   ```

2. Update your deployment pipeline to use:
   ```bash
   npm run release:build $VERSION "$RELEASE_NOTES"
   ```

3. The built files will include updated version information that can be accessed by frontend components immediately after deployment.

## 🔍 Monitoring

Monitor the endpoints:
- Version endpoint should update on every build
- Releases endpoint should contain chronological release history
- Both should return fresh data (no caching) due to headers configuration

The system maintains a rolling history of 10 releases and automatically trims older entries.