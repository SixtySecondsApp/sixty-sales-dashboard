# S3 Bucket Public Access Setup for Company Logos

The company logos are stored in S3 and need to be publicly accessible for the leads list view to display them correctly.

## Problem

The S3 bucket is currently private, which causes 403 Forbidden errors when trying to load logo images in the browser. The images need to be publicly accessible.

## Solution

Make the `company-logos/` folder in your S3 bucket publicly readable.

## Steps

1. **Go to AWS S3 Console**
   - Navigate to https://s3.console.aws.amazon.com/
   - Find your bucket (the one specified in `LOGOS_BUCKET_NAME` environment variable)

2. **Configure Bucket Policy**
   - Click on your bucket name
   - Go to the **Permissions** tab
   - Scroll down to **Bucket policy**
   - Click **Edit** and add the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadCompanyLogos",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::erg-application-logos/company-logos/*"
    }
  ]
}
```

**Note:** This policy is for the `erg-application-logos` bucket. If using a different bucket, replace `erg-application-logos` with your bucket name.

3. **⚠️ CRITICAL: Block Public Access Settings**
   
   **This step is REQUIRED!** Even if you have the bucket policy set correctly, if Block Public Access is enabled, it will override the policy and you'll still get 403 errors.
   
   - Still in the **Permissions** tab
   - Scroll to **Block public access (bucket settings)**
   - Click **Edit**
   - **Uncheck at least this option:**
     - ✅ **Block public access to buckets and objects granted through new public bucket or access point policies**
   - You can also uncheck **Block all public access** if you want, but the above option is the minimum required
   - Click **Save changes**
   - Confirm by typing `confirm`
   
   **If you skip this step, your bucket policy will be ignored and you'll continue to get 403 errors!**

4. **Configure CORS (if needed)**
   - Still in the **Permissions** tab
   - Scroll to **Cross-origin resource sharing (CORS)**
   - Click **Edit** and add this configuration if it doesn't exist:
   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "HEAD"],
       "AllowedOrigins": ["*"],
       "ExposeHeaders": [],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
   - This allows browsers to load images from any origin

5. **Verify**
   - After making these changes, wait a few seconds for AWS to propagate the changes
   - Test by accessing a logo URL directly in a browser:
   ```
   https://erg-application-logos.s3.eu-west-2.amazonaws.com/company-logos/stripe.com.png
   ```
   - You should see the image load successfully (not a 403 error)
   - If you still get 403, double-check that you completed step 3 (Block Public Access)
   - **Note:** If the bucket works in other applications, they might be using CloudFront or a different access method. Direct S3 URLs may still need the above configuration.

6. **Re-upload Existing Files (if needed)**
   - If files were uploaded before the bucket policy was configured, they might have private ACLs
   - The edge function will automatically re-upload files when they're requested
   - Or you can manually trigger a re-upload by calling the edge function for each domain
   - New files uploaded after the bucket policy is set will work correctly

## Security Note

This makes only the `company-logos/` folder public. The rest of your bucket remains private. This is safe because:
- Company logos are not sensitive data
- They're meant to be displayed publicly in the UI
- Only read access is granted, not write access

## Alternative: Use CloudFront CDN (Optional)

For better performance and security, you could set up a CloudFront distribution in front of your S3 bucket:
- Better caching
- DDoS protection
- Custom domain support
- More granular access control

This is optional and not required for basic functionality.

