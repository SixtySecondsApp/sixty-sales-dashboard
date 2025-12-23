# AWS S3 Setup for Video Thumbnails

## Overview

The thumbnail generation system uses **AWS S3** exclusively for storage, which is ideal for high-volume operations (1000+ thumbnails).

**Storage:** AWS S3 only - Best for bulk operations, scalable, cost-effective

---

## Why AWS S3?

For your 1000 meeting initial sync:

| Metric | AWS S3 |
|--------|---------|
| Cost for 1000 Thumbnails | ~$0.023/month storage |
| Bandwidth | $0.09/GB |
| Scalability | Unlimited |

**Key Benefits:**
- ✅ **Cost-effective**: ~$0.023/month for 1GB storage
- ✅ **Unlimited scale**: Handle millions of images
- ✅ **Fast CDN**: Global edge locations
- ✅ **No plan limits**: Not constrained by Supabase storage quotas
- ✅ **Production-grade**: Industry standard for object storage

---

## AWS S3 Setup (5 minutes)

### Step 1: Create S3 Bucket

1. **Go to AWS S3 Console**: https://s3.console.aws.amazon.com/s3/buckets

2. **Create Bucket:**
   - Click "Create bucket"
   - **Bucket name**: `sixty-sales-meeting-thumbnails` (must be globally unique)
   - **AWS Region**: `us-east-1` (or your preferred region)
   - **Block Public Access**: ⚠️ **UNCHECK** "Block all public access"
     - We need public read access for thumbnail URLs
     - Check the acknowledgment box
   - Leave other settings as default
   - Click "Create bucket"

3. **Configure Bucket Policy for Public Read:**
   - Click on your bucket name
   - Go to "Permissions" tab
   - Scroll to "Bucket policy"
   - Click "Edit" and paste:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::sixty-sales-meeting-thumbnails/*"
       }
     ]
   }
   ```

   - Click "Save changes"

4. **Enable CORS (Cross-Origin Resource Sharing):**
   - Still in "Permissions" tab
   - Scroll to "Cross-origin resource sharing (CORS)"
   - Click "Edit" and paste:

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   - Click "Save changes"

### Step 2: Create IAM User with S3 Access

1. **Go to IAM Console**: https://console.aws.amazon.com/iam/home#/users

2. **Create User:**
   - Click "Add users"
   - **User name**: `sixty-sales-thumbnail-uploader`
   - **Access type**: Check "Programmatic access"
   - Click "Next: Permissions"

3. **Attach Policy:**
   - Select "Attach existing policies directly"
   - Click "Create policy"
   - Choose "JSON" tab and paste:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:PutObjectAcl",
           "s3:GetObject"
         ],
         "Resource": "arn:aws:s3:::sixty-sales-meeting-thumbnails/*"
       }
     ]
   }
   ```

   - Click "Next: Tags" (skip)
   - Click "Next: Review"
   - **Policy name**: `SixtySalesThumbnailUpload`
   - Click "Create policy"

4. **Complete User Creation:**
   - Go back to the user creation tab
   - Click the refresh button next to "Create policy"
   - Search for `SixtySalesThumbnailUpload` and check it
   - Click "Next: Tags" (skip)
   - Click "Next: Review"
   - Click "Create user"

5. **Save Credentials:**
   - ⚠️ **IMPORTANT**: Download the CSV or copy the credentials now
   - You'll need:
     - **Access key ID**: `AKIA...`
     - **Secret access key**: `wJalrXUtn...`
   - You won't be able to see the secret key again!

### Step 3: Configure Supabase Secrets

Set the AWS credentials as Supabase secrets:

```bash
# Set AWS credentials
supabase secrets set AWS_ACCESS_KEY_ID="your_access_key_id"
supabase secrets set AWS_SECRET_ACCESS_KEY="your_secret_access_key"
supabase secrets set AWS_S3_BUCKET="sixty-sales-meeting-thumbnails"
supabase secrets set AWS_REGION="us-east-1"

# Verify secrets are set
supabase secrets list
```

---

## Deploy Updated Function

The Edge Function has been updated to support AWS S3. Deploy it:

```bash
supabase functions deploy generate-video-thumbnail
```

---

## Testing

### Test S3 Upload

```bash
# Test with a real meeting
curl -X POST \
  "https://ewtuefzeogytgmsnkpmb.supabase.co/functions/v1/generate-video-thumbnail" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "recording_id": "96397021",
    "share_url": "https://fathom.video/share/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf",
    "fathom_embed_url": "https://fathom.video/embed/BTPE7mwG8QtBsQwtPtX6PxeauX1C8bZf"
  }'
```

Expected response:
```json
{
  "success": true,
  "thumbnail_url": "https://sixty-sales-meeting-thumbnails.s3.us-east-1.amazonaws.com/meeting-thumbnails/96397021.jpg",
  "recording_id": "96397021"
}
```

### Verify in S3

1. Go to S3 Console: https://s3.console.aws.amazon.com/s3/buckets/sixty-sales-meeting-thumbnails
2. Navigate to `meeting-thumbnails/` folder
3. You should see `96397021.jpg`
4. Click on it and copy the "Object URL"
5. Open the URL in a browser - you should see the thumbnail

---

## Cost Estimation

### AWS S3 Pricing (us-east-1)

**Storage:**
- First 50 TB: $0.023 per GB/month
- For 1000 thumbnails (~1GB): **$0.023/month**

**Requests:**
- PUT requests: $0.005 per 1,000 requests
- For 1000 uploads: **$0.005**

**Data Transfer:**
- First 1 GB: Free
- Next 9.999 TB: $0.09 per GB
- For 1000 thumbnail views: **~$0.09**

**Monthly Total for 1000 Thumbnails:**
- Storage: $0.023
- Initial upload: $0.005 (one-time)
- Transfer (est. 10GB/month): $0.90
- **Total: ~$0.93/month**

### Comparison with Screenshot Services

For 1000 thumbnails/month:

| Service | Screenshot Cost | Storage Cost | Total |
|---------|----------------|--------------|-------|
| **Microlink** + S3 | $90/month | $0.93 | **$90.93** |
| **ScreenshotOne** + S3 | $19/month | $0.93 | **$19.93** ⭐ |
| Browserless + S3 | $30/month | $0.93 | **$30.93** |

**Recommendation**: Use **ScreenshotOne** ($19/month for 5,000 screenshots) with AWS S3 storage.

---

## Screenshot Service Setup

Since you need 1000 screenshots, set up ScreenshotOne:

### Option 1: ScreenshotOne (Recommended)

1. **Sign up**: https://screenshotone.com
2. **Get API key** from dashboard
3. **Set secret**:
   ```bash
   supabase secrets set SCREENSHOTONE_API_KEY="your_api_key"
   ```
4. **Pricing**: $19/month for 5,000 screenshots

### Option 2: Browserless (Most Reliable)

1. **Sign up**: https://browserless.io
2. **Get token** from dashboard
3. **Set secret**:
   ```bash
   supabase secrets set BROWSERLESS_TOKEN="your_token"
   ```
4. **Pricing**: $30/month for 1,000 minutes

---

## Deployment Checklist

- [ ] Create S3 bucket with public read access
- [ ] Configure bucket policy and CORS
- [ ] Create IAM user with upload permissions
- [ ] Set Supabase secrets (AWS credentials)
- [ ] Set screenshot service API key
- [ ] Deploy updated Edge Function
- [ ] Test thumbnail generation
- [ ] Verify S3 upload works
- [ ] Verify public URL is accessible
- [ ] Re-sync Fathom meetings

---

## Storage Structure

```
sixty-sales-meeting-thumbnails/
└── meeting-thumbnails/
    ├── 96397021.jpg
    ├── 96272358.jpg
    ├── 96191438.jpg
    └── ... (1000+ files)
```

**Public URLs:**
```
https://sixty-sales-meeting-thumbnails.s3.us-east-1.amazonaws.com/meeting-thumbnails/{recording_id}.jpg
```

---

## Troubleshooting

### 403 Forbidden errors?
- Verify bucket policy allows public read
- Check IAM user has `s3:PutObject` permission
- Ensure bucket name in policy matches actual bucket

### Images not uploading?
1. Check Edge Function logs:
   ```bash
   supabase functions logs generate-video-thumbnail --tail
   ```
2. Verify AWS credentials are set:
   ```bash
   supabase secrets list | grep AWS
   ```
3. Test IAM user permissions with AWS CLI:
   ```bash
   aws s3 ls s3://sixty-sales-meeting-thumbnails/
   ```

### Images uploading but not accessible?
- Verify bucket policy has `s3:GetObject` for all principals
- Check CORS is configured correctly
- Ensure "Block Public Access" is disabled

### Wrong region errors?
- Verify `AWS_REGION` matches bucket region
- Update endpoint in S3 client if using custom region

---

## Security Best Practices

1. **IAM User**: Use dedicated IAM user with minimal permissions
2. **Secret Rotation**: Rotate AWS credentials every 90 days
3. **CloudFront CDN**: Consider adding CloudFront for better performance and security
4. **Bucket Versioning**: Enable versioning for backup/recovery
5. **Lifecycle Policies**: Set up policies to delete old/unused thumbnails

---

## Next Steps

1. ✅ Create S3 bucket and IAM user
2. ✅ Set Supabase secrets
3. ✅ Deploy updated Edge Function
4. ✅ Set up screenshot service (ScreenshotOne recommended)
5. 🧪 Test thumbnail generation
6. 🔄 Re-sync Fathom meetings
7. 📊 Monitor costs in AWS Cost Explorer

---

**Quick Reference:**
- S3 Console: https://s3.console.aws.amazon.com/s3/buckets
- IAM Console: https://console.aws.amazon.com/iam
- Cost Explorer: https://console.aws.amazon.com/cost-management/home
- ScreenshotOne: https://screenshotone.com

**Support Files:**
- VIDEO_THUMBNAIL_SETUP.md - Original setup guide
- THUMBNAIL_DEPLOYMENT_QUICKSTART.md - Quick deployment guide
- deploy-thumbnail-service.sh - Automated deployment script
