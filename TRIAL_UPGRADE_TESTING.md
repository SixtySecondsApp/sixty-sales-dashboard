# Trial & Upgrade Flows Testing Checklist

**Date:** December 11, 2025  
**Purpose:** End-to-end verification of free tier, trial, and upgrade flows before first user launch.

---

## 🎯 Overview

This document provides a comprehensive checklist for testing the complete subscription lifecycle:

1. Free Tier signup and limits
2. Upgrade flow via Stripe
3. Subscription management
4. Downgrade handling

---

## 1. Free Tier Flow ✅

### 1.1 New User Signup
- [ ] Can create account from waitlist invite
- [ ] Welcome email sent via Encharge
- [ ] User lands on onboarding flow
- [ ] Default "Free" subscription created in `organization_subscriptions`

### 1.2 Fathom Connection
- [ ] OAuth flow works correctly
- [ ] `fathom_connected` tracked in `user_onboarding_progress`
- [ ] Encharge event "Fathom Connected" triggered

### 1.3 Initial Sync (Onboarding)
- [ ] Fast sync: 3 meetings load quickly (~5 seconds)
- [ ] Background sync: Remaining 30-day history syncs
- [ ] Meetings marked as `is_historical_import = true` during onboarding
- [ ] `first_meeting_synced` tracked in progress

### 1.4 Free Tier Limits
- [ ] `check_meeting_limits()` returns correct values:
  - `is_free_tier: true`
  - `max_meetings_per_month: 15`
  - `can_sync_new: true` (when under limit)
- [ ] Historical limit enforced (30 days max)
- [ ] New meeting count tracked correctly

### 1.5 Usage Warning (80% = 12 meetings)
- [ ] At 12th meeting: warning email sent via Encharge
- [ ] Warning only sent once per 7 days (no spam)
- [ ] `limitWarning` message returned in sync response
- [ ] UI shows warning banner (if implemented)

### 1.6 Limit Reached (100% = 15 meetings)
- [ ] At 15th meeting: upgrade required
- [ ] `can_sync_new: false` returned
- [ ] Sync returns 402 Payment Required
- [ ] `HistoricalUpgradeGate` modal displays
- [ ] Clear CTA to view pricing plans

---

## 2. Upgrade Flow ✅

### 2.1 Pricing Page
- [ ] Accessible from upgrade prompts and navigation
- [ ] Correct plans displayed (Pro, Team, Enterprise)
- [ ] Monthly/yearly toggle works
- [ ] Feature comparison accurate

### 2.2 Stripe Checkout
- [ ] "Subscribe" button creates Stripe checkout session
- [ ] Correct plan/price passed to Stripe
- [ ] Redirect to Stripe checkout works
- [ ] Test card payments succeed:
  - `4242 4242 4242 4242` - Success
  - `4000 0000 0000 9995` - Declined
  - `4000 0000 0000 0341` - Requires auth

### 2.3 Checkout Success
- [ ] Redirect back to app with success param
- [ ] Success toast/message displayed
- [ ] User can immediately access paid features

### 2.4 Stripe Webhooks
Verify these webhooks fire correctly (see STRIPE_WEBHOOK_TESTING.md):

- [ ] `checkout.session.completed`
  - Creates/updates `organization_subscriptions`
  - Sets `status: 'active'`
  - Links to correct `plan_id`
  
- [ ] `customer.subscription.created`
  - Updates subscription details
  - Sets correct dates

- [ ] `invoice.paid`
  - Logs payment in `payment_logs` (if exists)
  - Confirms subscription active

---

## 3. Subscription Management ✅

### 3.1 Customer Portal
- [ ] "Manage Subscription" button works
- [ ] Opens Stripe Customer Portal
- [ ] Can update payment method
- [ ] Can cancel subscription
- [ ] Changes reflect in app after webhook

### 3.2 Plan Changes
- [ ] Can upgrade (Pro → Team)
- [ ] Can downgrade (Team → Pro)
- [ ] Prorated billing correct in Stripe
- [ ] Webhook updates database

### 3.3 Cancellation
- [ ] User can cancel in Customer Portal
- [ ] `customer.subscription.deleted` webhook fires
- [ ] Subscription status updated to 'cancelled'
- [ ] Access continues until period end
- [ ] After period end, downgraded to Free tier

---

## 4. Post-Upgrade Verification ✅

### 4.1 Limits Removed
- [ ] `is_free_tier: false` returned
- [ ] `max_meetings_per_month: null` (unlimited)
- [ ] Historical sync no longer limited to 30 days
- [ ] All_time sync works for 90+ days

### 4.2 Features Unlocked
- [ ] All meeting history accessible
- [ ] No upgrade prompts displayed
- [ ] Enhanced AI features available (if tier-specific)

### 4.3 Subscription Tracking
- [ ] Encharge event "Subscription Confirmed" sent
- [ ] User tagged as "paying_customer" in Encharge
- [ ] `subscription_confirmed` email sent

---

## 5. Edge Cases & Error Handling ✅

### 5.1 Payment Failures
- [ ] Declined card shows clear error message
- [ ] User can retry with different card
- [ ] No partial subscription created

### 5.2 Webhook Failures
- [ ] Webhooks retry on 5xx errors
- [ ] Manual reconciliation possible in Stripe dashboard
- [ ] Error logged in Supabase for debugging

### 5.3 Session Timeout
- [ ] Incomplete checkout doesn't corrupt state
- [ ] User can start checkout again
- [ ] `checkout.session.expired` handled (if applicable)

### 5.4 Concurrent Access
- [ ] Multiple tabs don't cause duplicate subscriptions
- [ ] Real-time updates reflect subscription changes

---

## 6. Test Accounts & Data ✅

### Test Stripe Cards
```
Success:                 4242 4242 4242 4242
Declined:                4000 0000 0000 9995
Requires Authentication: 4000 0000 0000 0341
```

### Test User Flow
1. Sign up with test email
2. Connect Fathom (use test OAuth if available)
3. Sync 15+ meetings
4. Verify limit reached
5. Complete upgrade flow
6. Verify unlimited access

---

## 7. SQL Verification Queries

### Check User Subscription Status
```sql
SELECT 
  u.email,
  o.name as org_name,
  os.status,
  sp.name as plan_name,
  sp.is_free_tier,
  sp.max_meetings_per_month
FROM auth.users u
JOIN organization_memberships om ON om.user_id = u.id
JOIN organizations o ON o.id = om.org_id
LEFT JOIN organization_subscriptions os ON os.org_id = o.id
LEFT JOIN subscription_plans sp ON sp.id = os.plan_id
WHERE u.email = 'test@example.com';
```

### Check Meeting Limits for Org
```sql
SELECT * FROM check_meeting_limits('org-uuid-here');
```

### Verify Email Logs
```sql
SELECT * FROM email_logs 
WHERE user_id = 'user-uuid-here'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 8. Encharge Automation Verification

Verify these flows are configured in Encharge.io:

### Waitlist → User
1. `Waitlist Invite Sent` → Send invite email
2. `Account Created` → Send welcome email
3. `Fathom Connected` → Send connection confirmation

### Free Tier Lifecycle
1. `First Meeting Synced` → Celebrate milestone
2. `Meeting Limit Warning` → Send upgrade CTA
3. `Upgrade Prompt Shown` → Track for retargeting

### Paid User
1. `Subscription Confirmed` → Welcome to Pro email
2. `Trial Ending Soon` → Reminder (if trial exists)
3. `Trial Expired` → Grace period warning

---

## ✅ Sign-Off

| Area | Tested By | Date | Status |
|------|-----------|------|--------|
| Free Tier Flow | | | 🔲 |
| Upgrade Flow | | | 🔲 |
| Stripe Webhooks | | | 🔲 |
| Subscription Mgmt | | | 🔲 |
| Edge Cases | | | 🔲 |
| Encharge Flows | | | 🔲 |

---

**Notes:**
- Use Stripe test mode for all testing
- Use Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook`
- Check Supabase logs for any errors
- Test on both desktop and mobile browsers








