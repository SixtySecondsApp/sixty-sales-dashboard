# How to Get Your Supabase Auth Token

## Quick Method (Browser Console)

1. **Open your app** in the browser: `http://localhost:5173` (or your deployed URL)

2. **Make sure you're logged in** to the app

3. **Open browser DevTools**:
   - Chrome/Edge: Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
   - Firefox: Press `F12` or `Ctrl+Shift+K`
   - Safari: Enable Developer menu first, then `Cmd+Option+I`

4. **Go to Console tab**

5. **Paste this command** and press Enter:
   ```javascript
   console.log(JSON.parse(localStorage.getItem('sb-ewtuefzeogytgmsnkpmb-auth-token')).access_token)
   ```

6. **Copy the token** that appears (long string starting with `eyJ...`)

## Alternative Method (Application Storage)

1. Open DevTools (`F12`)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Expand **Local Storage** in the left sidebar
4. Click on your app's domain (e.g., `http://localhost:5173`)
5. Find the key: `sb-ewtuefzeogytgmsnkpmb-auth-token`
6. Click on it and copy the `access_token` value from the JSON

## Example Token Format

Your token should look like:
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzYxNTEyMDM1LCJpYXQiOjE3NjE1MDg0MzUsImlzcyI6Imh0dHBzOi8vZXd0dWVmemVvZ3l0Z21zbmtwbWIuc3VwYWJhc2UuY28vYXV0aC92MSIsInN1YiI6IjEyMzQ1Njc4LTEyMzQtMTIzNC0xMjM0LTEyMzQ1Njc4OTBhYiIsImVtYWlsIjoidXNlckBleGFtcGxlLmNvbSIsInBob25lIjoiIiwiYXBwX21ldGFkYXRhIjp7InByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiXX0sInVzZXJfbWV0YWRhdGEiOnt9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzYxNTA4NDM1fV0sInNlc3Npb25faWQiOiIxMjM0NTY3OC0xMjM0LTEyMzQtMTIzNC0xMjM0NTY3ODkwYWIifQ.1234567890abcdefghijklmnopqrstuvwxyz1234567890
```

## Then Run the Test Script

Once you have the token:

```bash
cd /Users/andrewbryce/Documents/sixty-sales-dashboard
./test_ai_analysis.sh
```

When prompted, paste your token.

## Security Note

⚠️ **Keep your token private!** It provides full access to your account.
- Don't share it
- Don't commit it to git
- It expires after ~1 hour (you'll need to get a new one)

## Troubleshooting

### "Cannot read property 'access_token' of null"
- You're not logged in - log into the app first
- Wrong storage key - try the alternative method

### "Token expired"
- Tokens expire after 1 hour
- Log out and log back in to get a fresh token
- Or just refresh the page while logged in

### "localStorage is not defined"
- You're not in a browser console
- Make sure you're in the **Console** tab of DevTools
