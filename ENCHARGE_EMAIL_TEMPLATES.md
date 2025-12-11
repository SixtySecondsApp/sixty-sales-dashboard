# Encharge Email Templates - Required Templates

This document lists all email templates that need to be created in the Encharge dashboard for the email journey system to work properly.

## Template Creation Instructions

1. Log into your Encharge dashboard: https://app.encharge.io
2. Navigate to **Emails** section
3. Click the **+** icon in the lower-left to create a new email
4. Use the template name exactly as specified below
5. Configure Liquid template variables as needed
6. Note the template ID from the URL (e.g., `http://app.encharge.io/email?email=123` → ID is `123`)

---

## Onboarding Flow Templates

### 1. Welcome to Sixty
- **Template Name**: `Welcome to Sixty`
- **Type**: Transactional
- **Trigger**: Account Created (Day 0)
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ person.email }}` - User's email
  - `{{ person.company }}` - Organization name
- **Purpose**: Welcome new users and guide them to onboarding

### 2. You're In!
- **Template Name**: `You're In!`
- **Type**: Transactional
- **Trigger**: Waitlist Invite (Day 0)
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ magic_link }}` - Magic link for account creation
  - `{{ referral_code }}` - User's referral code
  - `{{ waitlist_position }}` - Position in waitlist
- **Purpose**: Notify waitlist users they've been granted access

### 3. Connect Fathom
- **Template Name**: `Connect Fathom`
- **Type**: Transactional
- **Trigger**: 24h reminder if Fathom not connected (Day 1)
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ days_remaining }}` - Trial days remaining
- **Purpose**: Remind users to connect Fathom integration

### 4. Sync Your Meetings
- **Template Name**: `Sync Your Meetings`
- **Type**: Transactional
- **Trigger**: 3 day reminder if no meetings synced (Day 3)
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ days_remaining }}` - Trial days remaining
- **Purpose**: Encourage users to sync their first meeting

---

## Trial Flow Templates

### 5. Trial Ending Soon
- **Template Name**: `Trial Ending Soon`
- **Type**: Transactional
- **Trigger**: Trial will end (3 days or 1 day remaining)
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ days_remaining }}` - Days until trial expires
  - `{{ trial_end_date }}` - Trial end date
- **Purpose**: Urge users to add payment method before trial expires

### 6. We Miss You
- **Template Name**: `We Miss You`
- **Type**: Transactional
- **Trigger**: Trial Expired (Day 14)
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ trial_end_date }}` - Date trial expired
- **Purpose**: Win-back email after trial expiration

---

## Engagement Flow Templates

### 7. You're Crushing It
- **Template Name**: `You're Crushing It`
- **Type**: Transactional
- **Trigger**: First Summary Viewed (Day 7+)
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ meeting_count }}` - Number of meetings synced
- **Purpose**: Celebrate user activation milestone

### 8. Power User Welcome
- **Template Name**: `Power User Welcome`
- **Type**: Transactional
- **Trigger**: First Proposal Generated
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ proposal_id }}` - Generated proposal ID
- **Purpose**: Welcome power users who generate proposals

---

## Retention Flow Templates

### 9. Re-engagement Nudge
- **Template Name**: `Re-engagement Nudge`
- **Type**: Transactional
- **Trigger**: User inactive for 7 or 14 days
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ days_inactive }}` - Days since last activity
- **Purpose**: Re-engage inactive users

### 10. Come Back
- **Template Name**: `Come Back`
- **Type**: Transactional
- **Trigger**: User inactive for 30 days OR 2 days after trial expired
- **Variables Available**:
  - `{{ person.firstName }}` - User's first name
  - `{{ days_inactive }}` - Days since last activity
  - `{{ special_offer }}` - Optional special offer code
- **Purpose**: Win-back users who have churned

---

## Template Variable Reference

All templates can use these standard Encharge person fields:

- `{{ person.firstName }}` - First name
- `{{ person.lastName }}` - Last name
- `{{ person.email }}` - Email address
- `{{ person.company }}` - Company name
- `{{ person.userId }}` - User ID

Custom variables passed via `data.template_variables`:

- `{{ days_remaining }}` - Trial days remaining
- `{{ trial_end_date }}` - Trial end date (formatted)
- `{{ meeting_count }}` - Number of meetings
- `{{ days_inactive }}` - Days since last activity
- `{{ magic_link }}` - Account creation link
- `{{ referral_code }}` - User referral code
- `{{ waitlist_position }}` - Waitlist position

---

## Template Best Practices

1. **Subject Lines**: Keep under 50 characters, include value proposition
2. **Personalization**: Always use `{{ person.firstName }}` in greeting
3. **Clear CTA**: Single, prominent call-to-action button
4. **Mobile Responsive**: Test on mobile devices
5. **Unsubscribe**: Include unsubscribe link (required by law)
6. **Brand Consistency**: Use Sixty Seconds branding colors (#37bd7e)

---

## Template ID Mapping

After creating templates, update the `email_journeys` table with template IDs:

```sql
-- Example: Update journey with template ID
UPDATE email_journeys
SET email_template_id = '123' -- Template ID from Encharge URL
WHERE journey_name = 'onboarding'
AND email_type = 'welcome';
```

Or use template names (Encharge will resolve them):

```sql
UPDATE email_journeys
SET email_template_id = 'Welcome to Sixty'
WHERE journey_name = 'onboarding'
AND email_type = 'welcome';
```

---

## Testing Templates

1. Use the Onboarding Simulator's "Send Test Email" feature
2. Send to your own email address
3. Verify all variables are populated correctly
4. Check email rendering on desktop and mobile
5. Test unsubscribe functionality

---

## Template Status Checklist

- [ ] Welcome to Sixty
- [ ] You're In!
- [ ] Connect Fathom
- [ ] Sync Your Meetings
- [ ] Trial Ending Soon
- [ ] We Miss You
- [ ] You're Crushing It
- [ ] Power User Welcome
- [ ] Re-engagement Nudge
- [ ] Come Back

---

## Support

For questions about template creation or Liquid syntax:
- Encharge Documentation: https://docs.encharge.io
- Liquid Template Guide: https://shopify.github.io/liquid/
