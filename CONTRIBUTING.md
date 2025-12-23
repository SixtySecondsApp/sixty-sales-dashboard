# Contributing to Sixty Sales Dashboard

Thank you for contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 18+
- Supabase account
- Git

### Installation

```bash
git clone [repository-url]
cd sixty-sales-dashboard
npm install
cp .env.example .env
npm run dev
```

## Development Workflow

### Branch Naming

```
feature/   - New features (feature/add-deal-export)
fix/       - Bug fixes (fix/pipeline-drag-drop)
docs/      - Documentation (docs/update-api-reference)
refactor/  - Code refactoring (refactor/simplify-hooks)
test/      - Test additions (test/add-deal-tests)
```

### Commit Messages

Follow conventional commits:

```
feat: add deal export functionality
fix: resolve pipeline drag-drop issue
docs: update API documentation
refactor: simplify custom hooks
test: add deal service tests
chore: update dependencies
```

### Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commits
3. Run tests: `npm run test`
4. Run type check: `npm run build`
5. Create PR with description
6. Address review feedback
7. Merge after approval

## Code Standards

### TypeScript

- Use strict mode
- Define explicit types (avoid `any`)
- Use interfaces for objects
- Export types from `src/lib/types/`

### React

- Functional components with hooks
- Use React Query for server state
- Use Zustand for UI state
- Memoize expensive computations

### File Structure

```
src/
├── components/    # React components by domain
├── pages/         # Page components
├── lib/
│   ├── services/  # Business logic
│   ├── hooks/     # Custom hooks
│   ├── utils/     # Utility functions
│   └── types/     # TypeScript types
└── contexts/      # React contexts
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `DealCard.tsx` |
| Hooks | camelCase with `use` | `useDealService.ts` |
| Services | camelCase | `dealService.ts` |
| Types | PascalCase | `Deal`, `Contact` |
| Constants | UPPER_SNAKE | `MAX_DEALS` |

## Testing

### Unit Tests

```bash
npm run test           # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # Coverage report
```

### E2E Tests

```bash
npm run playwright     # Run Playwright tests
```

### Test File Naming

- Unit tests: `*.test.ts` or `*.test.tsx`
- E2E tests: `tests/e2e/*.spec.ts`

## Database Changes

### Migrations

1. Create migration in `supabase/migrations/`
2. Use timestamp prefix: `20241223000001_description.sql`
3. Test locally with Supabase CLI
4. Include RLS policies

### Edge Functions

1. Create in `supabase/functions/`
2. Follow naming: `function-name/index.ts`
3. Include shared utilities from `_shared/`

## Code Review Checklist

- [ ] TypeScript types are correct
- [ ] No console.logs in production code
- [ ] Tests cover new functionality
- [ ] RLS policies updated if needed
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Getting Help

- Check `/docs` for documentation
- Review existing code patterns
- Ask in team chat
- Create GitHub issue for bugs

## Questions?

Open an issue or reach out to the team.
