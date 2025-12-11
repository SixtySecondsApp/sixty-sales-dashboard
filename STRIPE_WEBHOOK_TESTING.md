# Stripe Webhook Testing Checklist

## Production Verification Steps

### 1. Verify Webhook Endpoint Configuration

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Confirm endpoint URL is: `https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/stripe-webhook`
3. Verify these events are enabled:
   - [x] `checkout.session.completed`
   - [x] `customer.subscription.created`
   - [x] `customer.subscription.updated`
   - [x] `customer.subscription.deleted`
   - [x] `customer.subscription.trial_will_end`
   - [x] `invoice.paid`
   - [x] `invoice.payment_failed`
   - [x] `invoice.finalized`

### 2. Environment Variables Check

Verify these are set in Supabase Edge Functions:
```
STRIPE_SECRET_KEY=sk_live_... or sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### 3. Test Each Flow (in Test Mode)

#### A. New Subscription Flow
```
User clicks "Start Free Trial" or "Subscribe"
  → checkout.session.completed
  → customer.subscription.created
  → invoice.finalized
  → invoice.paid (if not trial)
```

**Verify in Database:**
- [ ] `organization_subscriptions` updated with correct plan_id
- [ ] `stripe_subscription_id` populated
- [ ] `stripe_customer_id` populated
- [ ] `status` is 'trialing' or 'active'
- [ ] `trial_ends_at` set correctly (if trial)

#### B. Subscription Renewal
```
Billing cycle completes
  → invoice.finalized
  → invoice.paid
  → customer.subscription.updated
```

**Verify:**
- [ ] `current_period_start` and `current_period_end` updated
- [ ] `stripe_latest_invoice_id` updated

#### C. Trial Ending Warning
```
3 days before trial ends
  → customer.subscription.trial_will_end
```

**Verify:**
- [ ] User receives trial ending email (via Encharge)
- [ ] `billing_history` logged

#### D. Payment Failure
```
Payment method fails
  → invoice.payment_failed
```

**Verify:**
- [ ] `status` changes to 'past_due'
- [ ] User notified (via Encharge)
- [ ] `billing_history` logged with failure

#### E. Cancellation
```
User cancels subscription
  → customer.subscription.deleted
```

**Verify:**
- [ ] `status` changes to 'canceled'
- [ ] `canceled_at` timestamp set
- [ ] User notified

### 4. Use Stripe CLI for Local Testing

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to local function
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook

# Trigger test events
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created
stripe trigger invoice.payment_failed
```

### 5. Monitor Logs

```bash
# View Supabase Edge Function logs
supabase functions logs stripe-webhook --tail
```

Look for:
- `Processing Stripe event: <event_type>`
- Any error messages
- Database update confirmations

### 6. Webhook Retry Behavior

Stripe automatically retries failed webhooks:
- 1st retry: 1 hour
- 2nd retry: 2 hours
- 3rd retry: 4 hours
- And so on for up to 3 days

If webhook consistently fails, check:
1. Endpoint URL correctness
2. Webhook secret matches
3. Edge function logs for errors
4. Database RLS policies

---

## Quick Smoke Test

After deploying, run this quick test:

1. **Create Test Customer:**
   - Go to Stripe Dashboard → Customers → Create
   - Use test email: `test@example.com`

2. **Create Test Subscription:**
   - Use Stripe CLI: `stripe subscriptions create --customer=cus_xxx --price=price_xxx`

3. **Check Database:**
   ```sql
   SELECT * FROM organization_subscriptions 
   WHERE stripe_customer_id = 'cus_xxx';
   ```

4. **Check Billing History:**
   ```sql
   SELECT * FROM billing_history 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

---

## Status

| Event | Handler Exists | Tested |
|-------|---------------|--------|
| checkout.session.completed | ✅ | ⬜ |
| customer.subscription.created | ✅ | ⬜ |
| customer.subscription.updated | ✅ | ⬜ |
| customer.subscription.deleted | ✅ | ⬜ |
| customer.subscription.trial_will_end | ✅ | ⬜ |
| invoice.paid | ✅ | ⬜ |
| invoice.payment_failed | ✅ | ⬜ |
| invoice.finalized | ✅ | ⬜ |

**Last Verified:** Not yet tested in production

---

## Integration with Encharge

After webhook processing, send emails via Encharge:

```typescript
// In stripe-webhook after subscription confirmed:
await fetch(`${SUPABASE_URL}/functions/v1/encharge-email`, {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
  body: JSON.stringify({
    email_type: 'subscription_confirmed',
    to_email: userEmail,
    user_id: userId,
    data: { plan_name: planName }
  })
});
```

This should be added to relevant webhook handlers once basic flow is verified.
