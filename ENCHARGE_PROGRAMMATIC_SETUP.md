# Encharge Programmatic Email Setup

Complete guide for managing email templates and flows programmatically - **no Encharge UI required**.

## Overview

This system allows you to:
- ✅ Store email templates in Supabase (HTML + text)
- ✅ Send emails via AWS SES (already configured)
- ✅ Track events in Encharge for analytics
- ✅ Manage everything programmatically via admin UI

**No Encharge UI needed** - everything is managed through our admin interface and database.

## Architecture

```
┌─────────────────┐
│  Admin UI       │  Create/Edit Templates
│  /platform/     │  ──────────────────┐
│  email-templates│                     │
└─────────────────┘                     │
                                        ▼
┌─────────────────────────────────────────────┐
│  Supabase Database                          │
│  encharge_email_templates table             │
│  - HTML templates                          │
│  - Subject lines                           │
│  - Variables ({{user_name}}, etc.)          │
└─────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────┐
│  Edge Function: encharge-send-email        │
│  - Fetches template from DB                │
│  - Processes variables                     │
│  - Sends via AWS SES                       │
│  - Tracks event in Encharge                │
└─────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
┌──────────────┐    ┌──────────────────┐
│  AWS SES     │    │  Encharge Ingest   │
│  (Sends)     │    │  (Tracking Only)   │
└──────────────┘    └──────────────────┘
```

## Setup Steps

### 1. Set AWS Credentials (Supabase Secrets)

```bash
supabase secrets set AWS_ACCESS_KEY_ID='your-aws-access-key'
supabase secrets set AWS_SECRET_ACCESS_KEY='your-aws-secret-key'
supabase secrets set AWS_REGION='eu-west-2'
```

**Or via Supabase Dashboard:**
1. Go to Project Settings → Edge Functions → Secrets
2. Add:
   - `AWS_ACCESS_KEY_ID`
   - `AWS_SECRET_ACCESS_KEY`
   - `AWS_REGION` (default: `eu-west-2`)

### 2. Run Database Migration

```bash
supabase db push
```

This creates:
- `encharge_email_templates` table
- Default templates (Welcome, Trial Ending, Trial Expired)
- RLS policies (admin-only access)

### 3. Deploy Edge Function

```bash
supabase functions deploy encharge-send-email --no-verify-jwt
```

### 4. Access Admin UI

Navigate to: `/platform/email-templates`

**Requirements:**
- Must be platform admin (`is_admin = true`)
- Must be internal user

## Using the System

### Creating Templates

1. Go to `/platform/email-templates`
2. Click "Create Template"
3. Fill in:
   - **Template Name**: Unique identifier (e.g., "Welcome to Sixty")
   - **Template Type**: Email type (e.g., `welcome`, `trial_ending`)
   - **Subject Line**: Email subject (supports `{{variables}}`)
   - **HTML Body**: Full HTML email template
   - **Plain Text Body**: Optional fallback

### Template Variables

Use `{{variable_name}}` syntax in templates:

```html
<h1>Welcome, {{user_name}}!</h1>
<p>Your trial ends in {{days_remaining}} days</p>
<p>End date: {{trial_end_date}}</p>
```

**Available Variables:**
- `{{user_name}}` - User's name (auto-filled from `to_name` or email)
- `{{user_email}}` - User's email
- Any custom variables passed in `variables` object

### Sending Emails Programmatically

```typescript
import { sendEmailWithTemplate } from '@/lib/services/enchargeTemplateService';

// Send welcome email
await sendEmailWithTemplate({
  template_type: 'welcome',
  to_email: 'user@example.com',
  to_name: 'John Doe',
  user_id: 'user-uuid',
  variables: {
    days_remaining: 7,
    trial_end_date: '2025-12-18',
  },
});
```

### Using with Email Journeys

The `enchargeJourneyService` automatically uses templates:

```typescript
import { triggerJourneyEmail } from '@/lib/services/enchargeJourneyService';

// This will:
// 1. Find the journey by trigger_event
// 2. Get template by email_type
// 3. Send via AWS SES
// 4. Track in Encharge
await triggerJourneyEmail(journey, userId, userEmail, userName);
```

## Default Templates

Three templates are created automatically:

1. **Welcome to Sixty** (`welcome`)
   - Variables: `{{user_name}}`
   - Triggered: On account creation

2. **Trial Ending Soon** (`trial_ending`)
   - Variables: `{{user_name}}`, `{{days_remaining}}`, `{{trial_end_date}}`
   - Triggered: 3 days before trial ends

3. **Trial Expired** (`trial_expired`)
   - Variables: `{{user_name}}`
   - Triggered: When trial ends

## Testing

### Send Test Email

1. Go to `/platform/email-templates`
2. Click "Send Test" on any template
3. Enter test email address
4. Click "Send Test Email"

### Manual Testing (cURL)

```bash
curl -X POST https://your-project.supabase.co/functions/v1/encharge-send-email \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "welcome",
    "to_email": "test@example.com",
    "to_name": "Test User",
    "variables": {
      "user_name": "Test User"
    }
  }'
```

## Encharge Integration

### Event Tracking

Every email send automatically tracks an event in Encharge:

- **Event Name**: Mapped from template type (e.g., `welcome` → `Account Created`)
- **User Properties**: Email, user ID, name
- **Event Properties**: Template type, template name, variables

**Event Name Mapping:**
- `welcome` → `Account Created`
- `waitlist_invite` → `Waitlist Invite Sent`
- `trial_ending` → `Trial Ending Soon`
- `trial_expired` → `Trial Expired`
- `first_summary_viewed` → `First Summary Viewed`
- `fathom_connected` → `Fathom Connected`
- `first_meeting_synced` → `First Meeting Synced`

### Why Encharge?

Even though we send via AWS SES, we track events in Encharge for:
- **Analytics**: See email open rates, click rates
- **Segmentation**: Segment users by email engagement
- **Automation**: Trigger other flows based on email events
- **Reporting**: Track conversion funnels

**Note**: Encharge is used for tracking/analytics only. Actual emails are sent via AWS SES.

## Troubleshooting

### "AWS credentials not configured"

Set the secrets:
```bash
supabase secrets set AWS_ACCESS_KEY_ID='...'
supabase secrets set AWS_SECRET_ACCESS_KEY='...'
supabase secrets set AWS_REGION='eu-west-2'
```

Then redeploy:
```bash
supabase functions deploy encharge-send-email --no-verify-jwt
```

### "Template not found"

1. Check template exists: `/platform/email-templates`
2. Verify `template_type` matches exactly (case-sensitive)
3. Ensure template is `is_active = true`

### Email not sending

1. Check AWS SES is configured and verified
2. Verify sender email (`workflows@sixtyseconds.ai`) is verified in SES
3. Check Edge Function logs:
   ```bash
   supabase functions logs encharge-send-email
   ```

### Event not tracking in Encharge

1. Verify `ENCHARGE_WRITE_KEY` is set:
   ```bash
   supabase secrets list
   ```
2. Check Encharge dashboard for events (may take a few minutes)
3. Verify event name mapping is correct

## API Reference

### Edge Function: `encharge-send-email`

**Endpoint:** `POST /functions/v1/encharge-send-email`

**Request:**
```typescript
{
  template_type: string;      // Required: 'welcome', 'trial_ending', etc.
  to_email: string;           // Required: Recipient email
  to_name?: string;           // Optional: Recipient name
  user_id?: string;           // Optional: User UUID
  variables?: Record<string, any>; // Optional: Template variables
}
```

**Response:**
```typescript
{
  success: boolean;
  message_id?: string;        // AWS SES message ID
  template_type: string;
  template_name: string;
  event_tracked: string;      // Encharge event name
  error?: string;
}
```

### Service: `enchargeTemplateService`

**Functions:**
- `getAllTemplates()` - Get all active templates
- `getTemplateByType(type)` - Get template by type
- `createTemplate(params)` - Create new template (admin)
- `updateTemplate(id, updates)` - Update template (admin)
- `deleteTemplate(id)` - Delete template (admin)
- `sendEmailWithTemplate(params)` - Send email using template

## Next Steps

1. ✅ Set AWS credentials
2. ✅ Run migration
3. ✅ Deploy function
4. ✅ Create custom templates
5. ✅ Test email sending
6. ✅ Monitor Encharge events

## Benefits

- **No Encharge UI**: Manage everything programmatically
- **Version Control**: Templates stored in database, can be migrated
- **Cost Effective**: AWS SES is much cheaper than Encharge Premium
- **Full Control**: Customize templates without Encharge limitations
- **Analytics**: Still get Encharge tracking for segmentation

---

**Questions?** Check Edge Function logs or Encharge dashboard for event tracking.
