# 🏗️ Fathom Webhook Architecture

## How It Works

### Webhook Flow (Independent of Frontend)

```
Fathom Recording Complete
         ↓
Fathom sends webhook POST
         ↓
Supabase Edge Function (https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook)
         ↓
Process & Save to Database
         ↓
Meeting appears in CRM (when user refreshes)
```

**Key Point**: The webhook goes **directly to Supabase**, not through your frontend application.

---

## Environment Differences

### Local Development (localhost:5173)
- **Frontend**: http://localhost:5173
- **Backend/Webhook**: https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
- **Database**: Supabase cloud database (same as production)

### Production (your-domain.com)
- **Frontend**: https://your-domain.com
- **Backend/Webhook**: https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook ✅ (same!)
- **Database**: Supabase cloud database (same as development)

---

## Why This Works Everywhere

### 1. Supabase Edge Functions are Hosted Separately
- Edge functions run on Supabase's infrastructure (Deno Deploy)
- They have their own public URLs
- They don't depend on your frontend being deployed
- Same URL works for local dev, staging, and production

### 2. Database is Shared
- Both local and production frontends connect to **same Supabase project**
- Webhook writes to **same database** your CRM reads from
- No environment-specific configuration needed

### 3. Authentication Handled by Integration
- Webhook uses `fathom_user_email` to look up integration
- Integration contains `user_id` which links to your auth.users
- RLS policies ensure users only see their own meetings

---

## Configuration Required

### One-Time Setup (Already Done ✅)
1. Webhook endpoint deployed to Supabase
2. JWT verification disabled (`.well-known/config.json`)
3. Integration created in database

### Fathom Webhook Configuration (Same for All Environments)
**Webhook URL**: `https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook`

You configure this **once** in Fathom settings, and it works for:
- ✅ Local development (localhost:5173)
- ✅ Staging environment (if you have one)
- ✅ Production (your-domain.com)

---

## How Users See Meetings

### Local Development
1. User records meeting in Fathom
2. Webhook saves to database
3. User opens http://localhost:5173
4. Frontend queries Supabase → sees meeting

### Production
1. User records meeting in Fathom
2. Webhook saves to database (same endpoint!)
3. User opens https://your-domain.com
4. Frontend queries Supabase → sees meeting

**Same backend, different frontend URLs.**

---

## Multiple Users / Teams

### Each User Has Their Own Integration
- User A: `fathom_user_email = 'userA@company.com'`
- User B: `fathom_user_email = 'userB@company.com'`

### Webhook Handles All Users
When webhook receives:
```json
{
  "recorded_by": {
    "email": "userB@company.com"
  }
}
```

It:
1. Looks up integration for `userB@company.com`
2. Gets their `user_id`
3. Saves meeting with that `user_id`
4. RLS ensures User A can't see User B's meetings

---

## Security Considerations

### Public Webhook Endpoint (Safe)
- ✅ JWT verification disabled (required for external webhooks)
- ✅ Only processes data if valid integration exists
- ✅ RLS protects data by `user_id`
- ✅ Service role key used internally (not exposed)

### What If Someone Sends Fake Webhooks?
- They need to know a valid `fathom_user_email` in your system
- Even then, RLS prevents them from seeing the data
- Worst case: creates a meeting that only the legitimate user can see
- Consider adding webhook signature verification in future (Fathom may support this)

---

## Deployment Checklist

### Already Deployed ✅
- [x] Webhook edge function deployed
- [x] JWT verification disabled
- [x] Database tables created (`fathom_integrations`, `meetings`, etc.)
- [x] RLS policies configured
- [x] Integration created for andrew.bryce@sixtyseconds.video

### To Do
- [ ] Configure webhook URL in Fathom settings
- [ ] Test with real meeting
- [ ] Deploy frontend to production (if not already)
- [ ] Verify meetings sync in production environment

---

## Testing in Different Environments

### Test Locally
1. Configure webhook in Fathom (use Supabase URL)
2. Run `npm run dev` locally
3. Record test meeting
4. Refresh http://localhost:5173 → see meeting

### Test in Production
1. Same webhook configuration (no changes needed)
2. Deploy frontend to production
3. Record test meeting
4. Refresh https://your-domain.com → see meeting

**Same webhook, same database, different frontend URLs.**

---

## Environment Variables (Frontend Only)

Your frontend needs these in `.env`:
```env
VITE_SUPABASE_URL=https://ewtuefzeogytgmsnkpmb.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

These are the **same** for local and production (assuming single Supabase project).

If you use separate Supabase projects for dev/prod:
- Local: dev Supabase project
- Production: prod Supabase project
- Each needs its own webhook URL configured in Fathom
- You'd need different integrations per environment

**Current Setup**: Single Supabase project for all environments (recommended for most apps).

---

## Summary

✅ **Webhook URL is environment-agnostic**
✅ **Same URL works for local, staging, and production**
✅ **Supabase hosts the backend separately from your frontend**
✅ **Each user's integration links their Fathom account to your CRM**
✅ **RLS ensures data isolation between users**

**You're all set!** Configure the webhook in Fathom once, and it'll work everywhere.
