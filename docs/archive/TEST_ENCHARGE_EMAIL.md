# Testing Encharge Email Sending

Quick guide to test the email sending functionality.

## Prerequisites

1. **Database Migration Run**
   ```bash
   supabase db push
   ```
   This creates the `encharge_email_templates` table with default templates.

2. **AWS Credentials Set**
   ```bash
   supabase secrets set AWS_ACCESS_KEY_ID='your-key'
   supabase secrets set AWS_SECRET_ACCESS_KEY='your-secret'
   supabase secrets set AWS_REGION='eu-west-2'
   ```

3. **Edge Function Deployed**
   ```bash
   supabase functions deploy encharge-send-email --no-verify-jwt
   ```

## Testing Methods

### Method 1: Admin UI (Easiest)

1. Navigate to `/platform/email-templates`
2. Find the "Welcome to Sixty" template
3. Click "Send Test" button
4. Enter your email address
5. Click "Send Test Email"

### Method 2: Test Script

```bash
# Basic test
./test-encharge-email.sh your-email@example.com "Your Name"

# Or with custom variables
./test-encharge-email.sh your-email@example.com "John Doe"
```

### Method 3: cURL (Manual)

```bash
# Get your Supabase URL and anon key
supabase status

# Send test email
curl -X POST \
  "https://your-project.supabase.co/functions/v1/encharge-send-email" \
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

### Method 4: Via Service (Code)

```typescript
import { sendEmailWithTemplate } from '@/lib/services/enchargeTemplateService';

// In your component or test
const result = await sendEmailWithTemplate({
  template_type: 'welcome',
  to_email: 'test@example.com',
  to_name: 'Test User',
  variables: {
    user_name: 'Test User',
  },
});

console.log('Result:', result);
```

## Expected Response

```json
{
  "success": true,
  "message_id": "0100018a-1234-5678-9abc-def012345678-000000",
  "template_type": "welcome",
  "template_name": "Welcome to Sixty",
  "event_tracked": "Account Created"
}
```

## What to Check

### ✅ Email Received
- Check your inbox (and spam folder)
- Email should be from `workflows@sixtyseconds.ai`
- Should have the welcome template content

### ✅ AWS SES
- Check AWS SES console → Sending Statistics
- Should show 1 email sent
- Check for any bounces or complaints

### ✅ Encharge Tracking
- Go to Encharge dashboard
- Check Events → Should see "Account Created" event
- Event should have properties: `template_type`, `template_name`, `user_name`

### ✅ Database Log
```sql
SELECT * FROM email_logs 
WHERE email_type = 'welcome' 
ORDER BY created_at DESC 
LIMIT 1;
```

Should show:
- `status`: 'sent'
- `sent_via`: 'aws_ses'
- `metadata`: JSON with template info and message_id

## Troubleshooting

### "Template not found"
```sql
-- Check templates exist
SELECT * FROM encharge_email_templates WHERE is_active = true;
```

### "AWS credentials not configured"
```bash
# Check secrets
supabase secrets list

# Set if missing
supabase secrets set AWS_ACCESS_KEY_ID='...'
supabase secrets set AWS_SECRET_ACCESS_KEY='...'
```

### "Email not received"
1. Check AWS SES sender verification (`workflows@sixtyseconds.ai`)
2. Check spam folder
3. Check AWS SES sending statistics for bounces
4. Verify email address is correct

### "Event not in Encharge"
1. Check `ENCHARGE_WRITE_KEY` is set:
   ```bash
   supabase secrets list | grep ENCHARGE
   ```
2. Check Edge Function logs:
   ```bash
   supabase functions logs encharge-send-email --tail
   ```
3. Wait a few minutes (Encharge may take time to process)

## Testing Different Templates

### Trial Ending
```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/encharge-send-email" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "trial_ending",
    "to_email": "test@example.com",
    "to_name": "Test User",
    "variables": {
      "user_name": "Test User",
      "days_remaining": 3,
      "trial_end_date": "2025-12-14"
    }
  }'
```

### Trial Expired
```bash
curl -X POST \
  "https://your-project.supabase.co/functions/v1/encharge-send-email" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "template_type": "trial_expired",
    "to_email": "test@example.com",
    "to_name": "Test User",
    "variables": {
      "user_name": "Test User"
    }
  }'
```

## Next Steps

After successful test:
1. ✅ Verify email received
2. ✅ Check Encharge event tracking
3. ✅ Review email template in admin UI
4. ✅ Create custom templates as needed

---

**Need help?** Check Edge Function logs:
```bash
supabase functions logs encharge-send-email --tail
```
