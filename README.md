# Sixty Sales Dashboard

A modern, enterprise-grade sales CRM and analytics platform.

## Quick Start

```bash
# Install
npm install

# Configure
cp .env.example .env
# Edit .env with Supabase credentials

# Run
npm run dev
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, Framer Motion |
| State | React Query, Zustand |
| Backend | Supabase (PostgreSQL) |
| Hosting | Vercel |

## Key Features

- **4-Stage Pipeline**: SQL → Opportunity → Verbal → Signed
- **Meeting Intelligence**: AI-powered transcript analysis
- **Smart Tasks**: Automated task generation
- **Integrations**: Fathom, Google Calendar, Slack, JustCall

## Documentation

Full documentation available in [`/docs`](./docs/):

- [Getting Started](./docs/getting-started/quick-start.md)
- [Architecture](./docs/architecture/overview.md)
- [API Reference](./docs/api/)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## Project Structure

```
├── src/            # React frontend (138+ components)
├── supabase/       # Backend (170+ edge functions)
├── packages/       # Landing pages
├── tests/          # Test suites
└── docs/           # Documentation
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run test` | Run tests |
| `npm run playwright` | E2E tests |
| `npm run deploy:functions:staging` | Deploy edge functions to staging |
| `npm run deploy:functions:production` | Deploy edge functions to production |
| `npm run deploy:migrations:staging` | Deploy migrations to staging |
| `npm run deploy:migrations:production` | Deploy migrations to production |
| `npm run sync:staging` | Sync production data to staging |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT
