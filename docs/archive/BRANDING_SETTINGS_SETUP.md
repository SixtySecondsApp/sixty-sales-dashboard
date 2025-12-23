# Branding Settings Setup Guide

## Overview

A complete branding and customization system has been added to the admin panel, allowing administrators to upload custom logos and icons for the application.

## Features Implemented

### 1. Database Migration
- Created `branding_settings` table with:
  - `logo_light_url` - Logo for light mode
  - `logo_dark_url` - Logo for dark mode
  - `icon_url` - Icon for favicon and collapsed menu
- Singleton pattern enforced (only one branding setting exists)
- RLS policies: All authenticated users can read, only admins can modify
- Auto-update timestamp trigger

### 2. Admin UI Component
- New "Customize" tab in Admin panel (`/admin`)
- Upload interface for:
  - Light mode logo (max 2MB)
  - Dark mode logo (max 2MB)
  - Icon/Favicon (max 500KB)
- Preview of uploaded images
- Remove functionality for each asset
- Real-time favicon updates

### 3. Dynamic Logo Display
- `AppLayout` component now uses custom logos based on theme
- Light mode: Uses `logo_light_url` (falls back to `logo_dark_url` or default)
- Dark mode: Uses `logo_dark_url` (falls back to `logo_light_url` or default)
- Collapsed sidebar: Shows `icon_url` (falls back to default logo)

### 4. Favicon Management
- Automatic favicon update when icon is uploaded
- Supports multiple favicon sizes (16x16, 32x32, 64x64, 128x128)
- Apple touch icon support
- Updates persist across page reloads

## Setup Instructions

### Step 1: Run Database Migration

The migration file is located at:
```
supabase/migrations/20250120000000_create_branding_settings.sql
```

Run this migration in your Supabase project:
1. Go to Supabase Dashboard → SQL Editor
2. Copy and paste the migration SQL
3. Execute the migration

Or use Supabase CLI:
```bash
supabase migration up
```

### Step 2: Deploy Edge Function

Deploy the `upload-branding-logo` edge function:

```bash
supabase functions deploy upload-branding-logo
```

### Step 3: Configure AWS S3 Credentials

Set the following secrets in Supabase for the edge function:

```bash
supabase secrets set AWS_ACCESS_KEY_ID=your_access_key
supabase secrets set AWS_SECRET_ACCESS_KEY=your_secret_key
supabase secrets set AWS_S3_BUCKET=your-bucket-name
supabase secrets set AWS_REGION=eu-west-2  # or your preferred region
```

**Note**: Logos will be uploaded to the `erg logos/` folder in your S3 bucket with the following structure:
```
erg logos/
├── lightLogo/
│   └── lightLogo-1234567890.png
├── darkLogo/
│   └── darkLogo-1234567890.png
└── icon/
    └── icon-1234567890.png
```

### Step 4: Configure S3 Bucket Policy (Optional)

Ensure your S3 bucket has public read access for the `erg logos/*` path:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadErgLogos",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::your-bucket-name/erg logos/*"
    }
  ]
}
```

## Usage

### Accessing Branding Settings

1. Navigate to `/admin`
2. Click on the "Customize" tab (palette icon)
3. Upload logos and icons as needed

### Logo Recommendations

- **Light Mode Logo**: PNG with transparent background, recommended size: 200x60px
- **Dark Mode Logo**: PNG with transparent background, recommended size: 200x60px
- **Icon**: Square PNG, recommended sizes: 32x32px or 64x64px

### File Format Support

- PNG (recommended)
- JPEG/JPG
- SVG
- GIF
- WebP

## Technical Details

### Files Created/Modified

1. **Database Migration**
   - `supabase/migrations/20250120000000_create_branding_settings.sql`

2. **Components**
   - `src/pages/admin/BrandingSettings.tsx` - Main branding settings page
   - `src/lib/hooks/useBrandingSettings.ts` - Hook for fetching branding settings

3. **Modified Files**
   - `src/components/AppLayout.tsx` - Updated to use custom logos
   - `src/pages/Admin.tsx` - Added "Customize" tab

### How It Works

1. **Logo Selection Logic**:
   ```typescript
   // Expanded sidebar: Theme-based logo
   const logoUrl = resolvedTheme === 'dark' 
     ? (brandingSettings?.logo_dark_url || brandingSettings?.logo_light_url || defaultLogo)
     : (brandingSettings?.logo_light_url || brandingSettings?.logo_dark_url || defaultLogo);

   // Collapsed sidebar: Icon
   const iconUrl = brandingSettings?.icon_url || defaultLogo;
   ```

2. **Favicon Updates**:
   - When icon is uploaded, `updateFavicon()` is called
   - Removes existing favicon links
   - Creates new favicon links for multiple sizes
   - Updates persist in database and DOM

3. **Real-time Updates**:
   - Uses Supabase real-time subscriptions
   - Changes reflect immediately across all users
   - No page refresh required

## Troubleshooting

### "Upload failed" Error
- Verify AWS credentials are set in Supabase Edge Function secrets
- Check that the S3 bucket exists and is accessible
- Ensure the edge function is deployed: `supabase functions deploy upload-branding-logo`
- Check edge function logs in Supabase Dashboard

### Logo Not Displaying
- Check browser console for image loading errors
- Verify the S3 URL is accessible (public bucket policy)
- Ensure file format is supported
- Check that the S3 bucket policy allows public read for `erg logos/*`

### Favicon Not Updating
- Clear browser cache
- Check browser developer tools → Network tab for favicon requests
- Verify icon URL is accessible

## Security Notes

- Only admins can upload/modify branding assets
- All authenticated users can view branding settings (read-only)
- S3 bucket policy should allow public read for `erg logos/*` path
- File size limits enforced (2MB logos, 500KB icons)
- File type validation prevents malicious uploads
- AWS credentials stored securely in Supabase Edge Function secrets

## Future Enhancements

Potential improvements:
- Image cropping/resizing interface
- Preview of logos in different contexts
- Multiple icon sizes upload
- Logo positioning options
- Custom color scheme integration

