# Fathom Webhook - Quick Reference Card

## 🎯 Webhook URL
```
https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
```

## ⚡ Quick Setup (3 Steps)

### 1. Verify Integration
```sql
SELECT fathom_user_email, is_active, token_expires_at
FROM fathom_integrations
WHERE fathom_user_email = 'andrew@sixty.xyz';
```
Expected: 1 row, `is_active = true`

### 2. Add Webhook in Fathom
- Go to Fathom Settings → Webhooks
- Add URL above
- Select: "Recording Ready" event
- Save

### 3. Test
- Record 2-min test meeting
- Wait 5 minutes
- Check CRM Meetings page

## 📊 Check Status

### View Logs
https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

Filter: `fathom-webhook`

### Run Checker
```bash
./check-fathom-webhook-config.sh
```

## 🔍 What to Look For in Logs

✅ **Success**:
```
╔════════════════════════════════════════════
║ 📡 FATHOM WEBHOOK RECEIVED
...
║ ✅ WEBHOOK PROCESSING COMPLETE
```

❌ **User Not Found**:
```
❌ Could not determine user_id for webhook
```
→ Reconnect Fathom in Settings → Integrations

## 🐛 Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| No logs appear | Check webhook configured in Fathom |
| User not found | Reconnect Fathom integration |
| Meeting synced but no transcript | Wait 10-15 min for AI processing |
| Webhook configured but not firing | Contact Fathom support |

## 📚 Full Documentation

- Setup Guide: `FATHOM_WEBHOOK_SETUP.md`
- Diagnostic Summary: `WEBHOOK_DIAGNOSTIC_SUMMARY.md`
- Integration Checker: `check-fathom-integration.sql`

---

**Need Help?**
1. Check logs (link above)
2. Run `./check-fathom-webhook-config.sh`
3. Review `WEBHOOK_DIAGNOSTIC_SUMMARY.md`
