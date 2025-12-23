# 🚀 Connect Fathom Integration - Step by Step

## 📍 You Are Here
✅ Webhook endpoint is working
✅ Database checked - **No integration found**
❌ Need to connect Fathom to create integration record

---

## 🎯 Quick Steps to Connect

### Step 1: Open Integrations Page

**If running locally**:
```
http://localhost:5173/integrations
```

**If deployed**:
```
https://your-app-url.com/integrations
```

**Or navigate through UI**:
1. Click Settings (gear icon) or your profile
2. Click "Integrations" tab or menu item

### Step 2: Find Fathom Card

Look for a card that says:
```
┌─────────────────────────────────┐
│ FATHOM [logo]                   │
│                                 │
│ Status: Not Connected           │
│                                 │
│ [Connect Fathom] button         │
└─────────────────────────────────┘
```

### Step 3: Click "Connect Fathom"

This will:
1. Redirect you to Fathom's OAuth page
2. Ask you to authorize the app
3. Redirect back to your CRM

### Step 4: Authorize on Fathom

On the Fathom OAuth page:
- ✅ Review permissions (read recordings, etc.)
- ✅ Click "Authorize" or "Allow"
- ✅ Wait for redirect back to CRM

### Step 5: Verify Connection

After redirect, you should see:
```
┌─────────────────────────────────┐
│ FATHOM [logo]                   │
│                                 │
│ Status: ✅ Connected            │
│ Email: andrew@sixty.xyz         │
│                                 │
│ [Sync Now] [Disconnect]         │
└─────────────────────────────────┘
```

### Step 6: Verify in Database

Run this SQL query again:
```sql
SELECT user_id, fathom_user_email, is_active
FROM fathom_integrations
WHERE fathom_user_email = 'andrew@sixty.xyz';
```

**Expected**: 1 row with `is_active = true`

---

## ✅ After Connection is Complete

Once you see the integration in the database, you can:

### 1. Configure Webhook in Fathom

Go to: https://app.fathom.video/settings

Add webhook URL:
```
https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/fathom-webhook
```

Event: "Recording Ready"

### 2. Test with Manual Sync (Optional)

Click "Sync Now" button on the Integrations page to:
- Pull existing meetings from Fathom
- Test the sync functionality
- Verify meetings appear in CRM

### 3. Record Test Meeting

After webhook is configured:
- Record a 2-minute test meeting
- Wait 5 minutes
- Check if it appears automatically

---

## 🐛 Troubleshooting

### "Connect Fathom" Button Not Working?

**Check browser console** (F12 → Console) for errors

**Common issues**:
- OAuth redirect URL not configured in Fathom
- Pop-up blocked by browser
- Network/firewall blocking OAuth

**Solution**: Check the OAuth configuration in Fathom developer settings

### Already Connected But No Database Record?

**Check**:
```sql
SELECT * FROM fathom_integrations;
```

If you see ANY rows but not for your email:
- You may be logged in as different user
- Check `user_id` matches your current session

### OAuth Flow Never Completes?

1. Check Fathom OAuth app settings
2. Verify redirect URI is correct
3. Try disconnecting and reconnecting

---

## 📋 Quick Checklist

- [ ] Open Integrations page
- [ ] Find Fathom card
- [ ] Click "Connect Fathom"
- [ ] Authorize on Fathom OAuth page
- [ ] See "Connected" status in CRM
- [ ] Verify 1 row in database
- [ ] Configure webhook in Fathom settings
- [ ] Test with new meeting

---

## 🔗 Quick Links

- **Integrations Page**: http://localhost:5173/integrations
- **Fathom Settings**: https://app.fathom.video/settings
- **SQL Editor**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/editor
- **Edge Logs**: https://supabase.com/dashboard/project/ewtuefzeogytgmsnkpmb/logs/edge-functions

---

**Next**: After connecting, see `WEBHOOK_STATUS_UPDATE.md` for final webhook configuration steps.
