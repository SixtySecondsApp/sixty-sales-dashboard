# AWS SES Domain Setup Guide

## Why Emails Go to Spam

Emails go to spam when:
1. **Domain not verified** in AWS SES
2. **Missing SPF record** - Email providers can't verify sender legitimacy
3. **Missing DKIM records** - No cryptographic signature to prove authenticity
4. **Missing DMARC record** - No policy for handling unauthenticated emails
5. **Domain reputation** - New domains have low reputation initially

## Step-by-Step Setup

### 1. Verify Domain in AWS SES

1. Go to [AWS SES Console](https://console.aws.amazon.com/ses/)
2. Navigate to **Verified identities** → **Create identity**
3. Choose **Domain**
4. Enter: `use60.com`
5. Click **Create identity**

### 2. Add DNS Records

AWS will provide you with DNS records. Add these to your domain's DNS provider (e.g., Cloudflare, Route53, etc.):

#### A. DKIM Records (3 CNAME records)
AWS will provide 3 CNAME records like:
```
Type: CNAME
Name: [token1]._domainkey.use60.com
Value: [token1].dkim.amazonses.com

Type: CNAME
Name: [token2]._domainkey.use60.com
Value: [token2].dkim.amazonses.com

Type: CNAME
Name: [token3]._domainkey.use60.com
Value: [token3].dkim.amazonses.com
```

#### B. SPF Record (TXT record)
```
Type: TXT
Name: use60.com (or @)
Value: v=spf1 include:amazonses.com ~all
```

#### C. DMARC Record (TXT record)
```
Type: TXT
Name: _dmarc.use60.com
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@use60.com; pct=100
```

**Note:** Start with `p=quarantine` (soft fail). Once everything works, you can change to `p=reject` (hard fail).

### 3. Verify Email Address (Optional but Recommended)

1. In AWS SES → **Verified identities**
2. Click **Create identity** → **Email address**
3. Enter: `app@use60.com`
4. Check the inbox for verification email and click the link

### 4. Request Production Access (If Still in Sandbox)

If your account is still in sandbox mode:
1. Go to **Account dashboard** → **Request production access**
2. Fill out the form explaining your use case
3. Wait for approval (usually 24-48 hours)

### 5. Warm Up the Domain (For New Domains)

New domains need to build reputation:
- Start with low volume (10-50 emails/day)
- Gradually increase over 2-4 weeks
- Monitor bounce and complaint rates
- Keep bounce rate < 5% and complaint rate < 0.1%

## Verification Checklist

Use the script `verify-ses-domain.sh` to check your setup:

```bash
./verify-ses-domain.sh use60.com
```

This will check:
- ✅ Domain verification status
- ✅ SPF record
- ✅ DKIM records
- ✅ DMARC record
- ✅ Email deliverability settings

## Testing

After setup, test with:

```bash
./test-full-email-setup.sh your@email.com
```

## Troubleshooting

### Still Going to Spam?

1. **Check DNS propagation**: Use `dig` or online DNS checker
   ```bash
   dig TXT use60.com
   dig TXT _dmarc.use60.com
   dig CNAME [token]._domainkey.use60.com
   ```

2. **Check domain reputation**: 
   - [MXToolbox](https://mxtoolbox.com/blacklists.aspx)
   - [Google Postmaster Tools](https://postmaster.google.com/)

3. **Verify in AWS SES**: Check that domain shows as "Verified" (green checkmark)

4. **Check email content**: Avoid spam trigger words, excessive links, all caps

5. **Monitor SES metrics**: 
   - Bounce rate should be < 5%
   - Complaint rate should be < 0.1%
   - Check SES → Account dashboard → Sending statistics

### Common Issues

**Issue**: "Domain verification pending"
- **Fix**: Make sure all DNS records are added correctly and propagated (can take up to 48 hours)

**Issue**: "SPF record not found"
- **Fix**: Add SPF TXT record to root domain (`use60.com`)

**Issue**: "DKIM not enabled"
- **Fix**: Add all 3 CNAME records provided by AWS

**Issue**: "DMARC record invalid"
- **Fix**: Check syntax - must start with `v=DMARC1;`

## Quick Reference

### DNS Records Summary

```
# SPF
use60.com TXT "v=spf1 include:amazonses.com ~all"

# DKIM (3 records - get exact values from AWS SES)
[token1]._domainkey.use60.com CNAME [token1].dkim.amazonses.com
[token2]._domainkey.use60.com CNAME [token2].dkim.amazonses.com
[token3]._domainkey.use60.com CNAME [token3].dkim.amazonses.com

# DMARC
_dmarc.use60.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@use60.com"
```

### AWS SES Console Links

- [Verified Identities](https://console.aws.amazon.com/ses/home#/verified-identities)
- [Account Dashboard](https://console.aws.amazon.com/ses/home#/account)
- [Sending Statistics](https://console.aws.amazon.com/ses/home#/account/sending-statistics)

## Next Steps

1. ✅ Verify domain in AWS SES
2. ✅ Add all DNS records
3. ✅ Wait for DNS propagation (up to 48 hours)
4. ✅ Verify domain shows as "Verified" in AWS SES
5. ✅ Test email sending
6. ✅ Monitor deliverability metrics
7. ✅ Gradually increase sending volume
