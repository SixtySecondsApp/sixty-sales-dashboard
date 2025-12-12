# use60 Supabase Email Templates

Professional, high-contrast email templates for Supabase Auth. Designed to look great in both light and dark mode email clients.

## 🎨 Design Features

- **Universal Contrast**: Dark background with white card ensures readability everywhere
- **Brand Colors**: Green accent (#37bd7e) for recognition
- **Logo with Fallback**: Image loads from Cloudinary with background-color fallback
- **Outlook Support**: VML fallbacks for proper button rendering in Outlook
- **Mobile Ready**: Table-based layout that works on all devices
- **Accessibility**: Proper alt text and semantic structure

## 📁 Templates Included

| Template | Purpose | Suggested Subject |
|----------|---------|-------------------|
| `confirmation.html` | Email verification for new signups | `Confirm your use60 account` |
| `magic-link.html` | Passwordless sign-in | `Sign in to use60` |
| `invite.html` | Team invitations | `You're invited to use60` |
| `reset-password.html` | Password recovery | `Reset your use60 password` |
| `change-email.html` | Email address changes | `Confirm your new email address` |

## 🚀 Setup Instructions

### 1. Access Supabase Dashboard
Navigate to your project → **Authentication** → **Email Templates**

### 2. Configure Each Template

For each template type:

1. **Select the template** from the dropdown
2. **Copy** the contents of the corresponding `.html` file
3. **Paste** into the "Body" field
4. **Update** the Subject line (see suggested subjects above)
5. **Save** the template

### 3. Test Your Templates

Use the preview tool to test:
```bash
cd supabase/email-templates
python3 -m http.server 8765
# Open http://localhost:8765/preview.html
```

## 🔧 Template Variables

Supabase automatically replaces these placeholders:

| Variable | Description |
|----------|-------------|
| `{{ .ConfirmationURL }}` | The action URL (verification, sign-in, reset, etc.) |
| `{{ .Email }}` | User's email address |
| `{{ .Token }}` | The auth token (if needed) |
| `{{ .TokenHash }}` | Hashed token for security |

## 🖼️ Logo Configuration

The logo is hosted on Cloudinary:
```
https://res.cloudinary.com/sixty-seconds/image/upload/v1761311652/sixtyseconds-Icon_1_2_cybz4p.png
```

If you need to change the logo:
1. Upload new image to Cloudinary or your CDN
2. Update the `src` attribute in each template's `<img>` tag
3. Ensure the image is served over HTTPS

## 🎯 Contrast Strategy

These templates use a "card on dark background" approach:

```
┌─────────────────────────────────────┐
│  Dark background (#111111)          │
│  ┌───────────────────────────────┐  │
│  │  White card (#ffffff)          │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │ Green accent (#37bd7e)  │  │  │
│  │  └─────────────────────────┘  │  │
│  │                                │  │
│  │  Dark text on white           │  │
│  │  Maximum readability          │  │
│  │                                │  │
│  └───────────────────────────────┘  │
│                                      │
└─────────────────────────────────────┘
```

This ensures:
- ✅ Perfect contrast in light-mode email clients
- ✅ Perfect contrast in dark-mode email clients
- ✅ No "dark mode override" issues
- ✅ Professional appearance everywhere

## 📧 Email Client Compatibility

Tested to work with:
- Gmail (web & mobile)
- Apple Mail
- Outlook (desktop & web)
- Yahoo Mail
- iOS Mail
- Android Gmail

## 💡 Tips

1. **Always test** emails with real Supabase auth flows before going live
2. **Check mobile** rendering - most users read email on phones
3. **Monitor delivery** - ensure your sender reputation is good
4. **Keep it simple** - avoid complex CSS that may break

---

© 2025 use60 · AI Sales Assistant
