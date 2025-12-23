# Encharge Event-Based Email Setup (Growth Plan Compatible)

## Overview

Since your Encharge plan doesn't include transactional emails, we're using **event-based automation flows** instead. This works on all Encharge plans (Growth, Premium, etc.) and is actually the recommended approach for marketing emails.

## How It Works

1. **Your App** → Sends events to Encharge via Ingest API
2. **Encharge** → Receives events and triggers automation flows
3. **Automation Flows** → Send emails based on event properties and user segments

## Setup Steps

### Step 1: Create Automation Flows in Encharge

For each email type, create an automation flow in Encharge:

1. Go to **Encharge Dashboard** → **Flows**
2. Click **Create Flow**
3. Set trigger: **Event** → Select the event name (e.g., "Account Created")
4. Add condition (optional): Filter by user properties or tags
5. Add action: **Send Email** → Select your email template
6. Save and activate the flow

### Step 2: Event Names Mapping

Your app sends these events, which should trigger flows:

| Email Type | Event Name | Flow Trigger |
|------------|------------|--------------|
| `welcome` | `Account Created` | Trigger welcome email flow |
| `waitlist_invite` | `Waitlist Invite Sent` | Trigger invite email flow |
| `fathom_connected` | `Fathom Connected` | Trigger confirmation email flow |
| `first_meeting_synced` | `First Meeting Synced` | Trigger celebration email flow |
| `trial_ending` | `Trial Ending Soon` | Trigger reminder email flow |
| `trial_expired` | `Trial Expired` | Trigger win-back email flow |
| `first_summary_viewed` | `First Summary Viewed` | Trigger engagement email flow |

### Step 3: Configure Flow Conditions (Optional)

You can add conditions to flows based on event properties:

- **Days Remaining**: `properties.days_remaining <= 3` → Send urgent reminder
- **User Tags**: `person has tag "trial"` → Send trial-specific emails
- **Custom Properties**: `properties.meeting_count > 0` → Send to engaged users

### Step 4: Test the Integration

1. **Send a test event** from your app:
   ```bash
   curl -X POST https://ygdpgliavpxeugaajgrb.supabase.co/functions/v1/encharge-email \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -d '{
       "email_type": "welcome",
       "to_email": "test@example.com",
       "to_name": "Test User",
       "user_id": "test-user-id"
     }'
   ```

2. **Check Encharge Dashboard**:
   - Go to **People** → Find the test user
   - Check **Activity** tab → Should see "Account Created" event
   - Check **Flows** → Flow should have triggered

3. **Verify email sent**:
   - Check your email inbox
   - Check Encharge **Emails** → **Sent** tab

## Advantages of Event-Based Approach

✅ **Works on all plans** - No Premium required  
✅ **More flexible** - Easy to add conditions and delays  
✅ **Better segmentation** - Use tags and properties  
✅ **Visual flow builder** - No code needed  
✅ **A/B testing** - Built into Encharge flows  
✅ **Analytics** - Track opens, clicks, conversions  

## Flow Examples

### Welcome Email Flow

```
Trigger: Event "Account Created"
Condition: None (send to all)
Action: Send Email "Welcome to Sixty"
Delay: 0 minutes (immediate)
```

### Trial Ending Reminder Flow

```
Trigger: Event "Trial Ending Soon"
Condition: properties.days_remaining == 3
Action: Send Email "Trial Ending Soon"
Delay: 0 minutes
```

### Re-engagement Flow

```
Trigger: Event "User Inactive"
Condition: properties.days_inactive == 7
Action: Send Email "We Miss You"
Delay: 0 minutes
```

## Troubleshooting

### Events not triggering flows?

1. **Check event name matches exactly** (case-sensitive)
2. **Verify flow is active** in Encharge dashboard
3. **Check event properties** - flows may filter by properties
4. **Check user exists** - Encharge needs user in system first

### Emails not sending?

1. **Check flow logs** in Encharge → Flows → [Your Flow] → Logs
2. **Verify email template exists** and is published
3. **Check user email** is valid and not unsubscribed
4. **Check send limits** - Growth plan has monthly send limits

### User not created in Encharge?

The function automatically creates/updates users via the People API. Check:
- User appears in **People** tab
- User has correct tags
- User properties are set correctly

## Migration from Transactional API

If you upgrade to Premium later, you can:
1. Keep using event-based flows (recommended for marketing)
2. Add transactional emails for critical emails (password reset, receipts)
3. Use both approaches together

## Next Steps

1. ✅ Create automation flows in Encharge for each email type
2. ✅ Test with the Onboarding Simulator "Send Test Email" feature
3. ✅ Monitor flow performance in Encharge dashboard
4. ✅ Adjust flow conditions based on user behavior

## Support

- Encharge Flow Documentation: https://help.encharge.io/en/article/automation-flows
- Event Tracking Guide: https://docs.encharge.io/getting-started/connecting-your-app-to-encharge/ingest-api
