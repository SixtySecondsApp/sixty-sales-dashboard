# Authentication V2 – Migration & Hardening Plan

> Goal: Replace the existing Supabase authentication implementation with a **robust, test-covered, and easily maintainable** solution that never forces users to reset their password unexpectedly.

---

## 1. Success Criteria
- ✅ Users can sign-up, sign-in, sign-out, and reset passwords without errors.
- ✅ Session persists across hard refreshes and deployments (no silent logout).
- ✅ No unexpected password resets or "invalid session" issues after new deploys.
- ✅ Full unit + e2e test coverage for all auth flows (>90% lines).
- ✅ Auditable monitoring (Supabase logs + client-side Sentry breadcrumbs).

---

## 2. Supabase Configuration Checklist
- [ ] **Site URL** – set to production domain (`https://sales.sixtyseconds.video`).
- [ ] **Redirect URLs** – include:
  - `https://sales.sixtyseconds.video/auth/login`
  - `https://sales.sixtyseconds.video/auth/reset-password`
  - local Dev: `http://localhost:5173/*`
- [ ] **JWT Expiry** – 1 week (`604800` s) with rolling refresh.
- [ ] **Enable Refresh Tokens** – _ON_.
- [ ] **Password Recovery redirect** – `/auth/reset-password` (prod + dev).
- [ ] **Email Templates** – customise login + recovery emails (brand + links).
- [ ] **SMTP** – verified sender domain & dmarc/spf set.
- [ ] **RLS Policies** – confirm `auth.uid() = id` on `profiles` et al.
- [ ] **Service Role Key** stored only in server-side functions.
- [ ] (Optional) **Social/OAuth providers** configured & tested.

> After ticking all, run `scripts/test-crm-functionality.js` and open Supabase Auth → Logs to confirm events.

---

## 3. Project Environment Variables (`.env.local`)
```env
VITE_SUPABASE_URL="https://xyzcompany.supabase.co"
VITE_SUPABASE_ANON_KEY="public-anon-key"
# ❗ Never push this key to Git – vercel project env only
VITE_SUPABASE_SERVICE_ROLE_KEY="service-role-key"
```

---

## 4. Codebase Work-Plan
### Phase 0 – Cleanup
- [x] Remove legacy auth service files (`src/pages/auth/*`, `AuthGuard`, etc.) **except** for presentational components (keep UI only).
- [x] Delete unused mocks & duplicate tests.

### Phase 1 – Core Client Wrapper
- [x] Create `src/lib/supabase/clientV2.ts` exporting { supabase, supabaseAdmin } with:
  - typed generics, auto token refresh, singletons.
  - storage key versioned (`sb.auth.v2`).
- [ ] Unit tests for client initialisation.

### Phase 2 – Auth Context Provider
- [x] `AuthProvider` (React Context) exposing `{ user, session, signIn(), signUp(), signOut() }`.
- [x] Subscribe to `onAuthStateChange`, write session to React-Query cache.

### Phase 3 – Page/Route Components
- [x] **LoginPage.tsx** – email + password login, error handling, redirect.
- [x] **SignupPage.tsx** – registration with confirm email notice.
- [x] **ForgotPassword.tsx** – send recovery email.
- [x] **ResetPassword.tsx** – update password via `updateUser`.
  - Guard page by verifying `type=recovery` hash.
- [x] Re-use existing Tailwind / motion UI.

### Phase 4 – Route Protection
- [x] Replace `AuthGuard` with `<ProtectedRoute>` HOC leveraging AuthContext.
- [x] Ensure SSR-safe redirect logic for Vercel edge / next.js (if migrated).

### Phase 5 – Testing
- [ ] Vitest unit tests for context + utils.
- [ ] Cypress e2e: sign-up, login, password reset, logout.

### Phase 6 – Monitoring & Analytics
- [ ] Add Sentry breadcrumb for each auth event.
- [x] Edge Function `auth-logger` → `admin_logs` table for sign-in/out.
- [x] AuthLogger service integrated with AuthContext.
- [ ] Rate limiting Edge Function for suspicious auth activity.
- [ ] Session analytics and anomaly detection.

### Phase 7 – Deployment & Rollback
- [ ] Deploy preview branch (`auth-v2-preview`) to Vercel.
- [ ] Run smoke tests → QA sign-in/out across Chrome/Safari/Edge.
- [ ] If green, merge to `main`. Rollback = redeploy previous commit.

---

## 5. Timeline (Indicative)
| Phase | Owner | ETA |
|-------|-------|-----|
| 0-1   | Dev A | Day 1 |
| 2-3   | Dev B | Day 2-3 |
| 4-5   | QA    | Day 4 |
| 6-7   | Lead  | Day 5 |

---

## 6. Post-Launch Checklist
- [ ] Production Supabase logs show auth traffic.
- [ ] Vercel log-drain captures any auth errors.
- [ ] Sentry error rate < 0.5% for auth routes over 24 h.
- [ ] Documented "Reset password" SOP in `docs/auth-support.md`.

---

**NEXT STEP →** _Start Phase 0 cleanup (`git checkout -b auth-v2`)._ 