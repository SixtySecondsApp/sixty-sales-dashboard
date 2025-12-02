# Send Waitlist Invite Edge Function

This Edge Function handles sending bulk email invitations for the waitlist referral system.

## Environment Variables Required

Add these to your Supabase project settings:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
```

## Deployment

```bash
# Deploy the function
supabase functions deploy send-waitlist-invite

# Set environment variables
supabase secrets set RESEND_API_KEY=re_xxxxxxxxxxxxx
```

## Testing Locally

```bash
# Start local Supabase
supabase start

# Set local environment variables
echo "RESEND_API_KEY=re_xxxxxxxxxxxxx" >> supabase/.env.local

# Serve the function locally
supabase functions serve send-waitlist-invite --env-file supabase/.env.local
```

## API Request Format

```typescript
POST https://your-project.supabase.co/functions/v1/send-waitlist-invite

Headers:
  Authorization: Bearer YOUR_ANON_KEY
  Content-Type: application/json

Body:
{
  "invites": [
    {
      "id": "uuid-of-invite-record",
      "email": "friend@example.com"
    }
  ],
  "referral_url": "https://yourdomain.com/waitlist?ref=ABC123",
  "sender_name": "John Doe"
}
```

## Response Format

```typescript
{
  "results": [
    {
      "invite_id": "uuid",
      "email": "friend@example.com",
      "success": true
    },
    {
      "invite_id": "uuid2",
      "email": "invalid@email",
      "success": false,
      "error": "Invalid email address"
    }
  ]
}
```

## Email Provider Setup

This function uses **Resend** (https://resend.com) for sending emails.

### Setup Steps:

1. Sign up at https://resend.com
2. Verify your sending domain
3. Generate API key
4. Add API key to Supabase secrets
5. Update the `from` address in the Edge Function to match your verified domain

### Alternative Email Providers

To use a different provider (SendGrid, Mailgun, etc.), replace the Resend API call in `index.ts` with your provider's API:

```typescript
// Example for SendGrid
const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SENDGRID_API_KEY}`,
  },
  body: JSON.stringify({
    personalizations: [{ to: [{ email: invite.email }] }],
    from: { email: 'invites@yourdomain.com' },
    subject: 'Your subject',
    content: [{ type: 'text/html', value: emailHtml }]
  }),
});
```

## Email Template Customization

The email template is defined in the `generateEmailTemplate()` function. Customize:

- Brand colors and styling
- Logo and images
- Copy and messaging
- Call-to-action buttons

## Error Handling

The function handles errors gracefully:
- Invalid email addresses are rejected
- Failed sends are tracked with error messages
- Partial success is supported (some emails succeed, others fail)
- All results are returned to the client for status updates

## Security Considerations

- Service role key is used for database operations (bypasses RLS)
- Email validation prevents malicious inputs
- Rate limiting should be configured at the Supabase project level
- CORS is configured to allow frontend requests

## Monitoring

Monitor Edge Function performance in Supabase Dashboard:
- Function invocations
- Error rates
- Execution time
- Log output

## Database Integration

The function reads from `waitlist_email_invites` table. Ensure RLS policies allow:
- Reading invite records for status updates
- Writing status updates (sent, failed, converted)

## Future Enhancements

- [ ] Add email template variations based on user tier
- [ ] Implement retry logic for failed sends
- [ ] Add bounce/complaint handling webhooks
- [ ] Support for custom email templates per organization
- [ ] A/B testing for email subject lines and content
