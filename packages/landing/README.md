# Sixty Sales Dashboard - Landing Pages

Marketing and promotional landing pages for the Sixty Sales Dashboard platform.

## Overview

This package contains the public-facing landing pages, including:
- Main marketing homepage
- Feature showcase pages
- Pricing pages
- Signup/waitlist flows

## Development

### Install Dependencies

```bash
cd packages/landing
npm install
```

### Run Development Server

```bash
npm run dev
```

Opens at [http://localhost:5174](http://localhost:5174)

### Build for Production

```bash
npm run build
```

Output is in the `dist/` directory.

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Vite | Build tool |
| React | UI framework |
| Tailwind CSS | Styling |
| TypeScript | Type safety |

## Project Structure

```
packages/landing/
├── src/
│   ├── components/     # UI components
│   │   ├── components-v3/   # Version 3 components
│   │   ├── components-v4/   # Version 4 components
│   │   └── components/      # Base components
│   ├── pages/          # Page components
│   └── styles/         # Global styles
├── public/             # Static assets
└── dist/               # Build output
```

## Deployment

Deployed to Vercel. See `vercel.json` for configuration.

## Related Documentation

- [Main Project README](../../README.md)
- [Design System](./design_system.md)
- [Deployment Guide](./VERCEL_DEPLOYMENT.md)
