# Logo.dev Integration Guide

This document explains how Sixty fetches company logos via the [`logo.dev`](https://logo.dev) API, stores the final asset in S3 for caching, and returns the cached URL to the client.

---

## High-Level Flow

1. **Frontend hook** (`src/lib/hooks/useCompanyLogo.ts`) normalizes the company domain and invokes the Supabase edge function `fetch-company-logo`.
2. **Edge function** (`supabase/functions/fetch-company-logo/index.ts`) validates the request, checks S3 for an existing logo, and returns the cached asset immediately if it exists.
3. **Cache miss** triggers a multi-step attempt to download the logo from `logo.dev`.
4. **Successful downloads** are uploaded into the S3 bucket under `logos/{domain}.png` with long-lived cache headers.
5. The edge function responds with the public S3 URL plus metadata (`cached` flag, normalized domain). The hook exposes that URL to React components.

---

## Components

### `useCompanyLogo` hook

- Accepts a domain, removes protocol/`www`, lowercases it, then calls `supabase.functions.invoke('fetch-company-logo', { body: { domain } })`.
- Handles loading state and returns `logoUrl` (string or `null`). Failures simply resolve to `null`, so consumers can fall back to initials/placeholder badges.

### `fetch-company-logo` edge function

- Runs on Deno (Supabase Edge Functions) and uses `s3_lite_client` for AWS S3 access.
- Requires the following environment variables:  
  `LOGOS_DEV_API_KEY`, `LOGOS_DEV_SECRET_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `LOGOS_BUCKET_NAME`, and optional `AWS_REGION` (defaults to `eu-west-2`).
- Normalizes the incoming domain exactly like the hook to keep cache keys aligned.

---

## Detailed Sequence

1. **Request validation & normalization**
   - Rejects empty domains.
   - Removes protocols (`http://`, `https://`), strips `www.`, trims trailing slashes, then lowercases the domain.
2. **S3 cache check**
   - Builds key `logos/{normalizedDomain}.png`.
   - Calls `s3Client.getObject`; if found, responds with `https://{bucket}.s3.{region}.amazonaws.com/{key}` and `cached: true`.
3. **Logo.dev fetch with fallbacks**
   - Attempts the API in up to three modes:
     1. `token` query param + `Authorization: Bearer {secret}` header.
     2. `token` **and** `secret` query params.
     3. `token` only (final fallback).
   - All calls hit `https://img.logo.dev/{domain}?size=128&format=png&retina=true`.
   - Collects the first successful `Response`; otherwise returns a structured 4xx/5xx error with trimmed upstream message.
4. **S3 write-through cache**
   - Converts `Response` to an `ArrayBuffer` and uploads it to S3.
   - Metadata: `Content-Type: image/png`, `Cache-Control: public, max-age=31536000, immutable`.
   - Because the bucket policy allows public reads for `logos/*`, clients can request the file directly.
5. **Response payload**
   ```json
   {
     "logo_url": "https://{bucket}.s3.{region}.amazonaws.com/logos/{domain}.png",
     "cached": false,
     "domain": "{normalizedDomain}"
   }
   ```
   - Subsequent requests skip the logo.dev call because the S3 check now succeeds and returns `{ cached: true }`.

---

## Storage & Bucket Notes

- Bucket name comes from `LOGOS_BUCKET_NAME`; store assets inside the `logos/` prefix to match the IAM policy.
- Ensure the bucket (or prefix) grants public-read access; otherwise browsers cannot use the returned URL directly.
- Objects are immutable once written. If a logo ever needs to refresh, delete the object (or upload a new version) so the next request refetches from logo.dev.

---

## Testing & Troubleshooting

| Scenario | Steps |
| --- | --- |
| Verify Supabase invocation | Run `ts-node scripts/test-logo-fetch.ts` after setting `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| Hit the edge function directly | Run `ts-node scripts/test-logo-direct.ts` to POST straight to `/functions/v1/fetch-company-logo`. |
| Inspect cache hits | Check CloudWatch/S3 logs or temporarily log `cached` responses returned by the hook. |
| Force refresh | Delete `logos/{domain}.png` from S3 and re-run the test; the next call should show `cached: false`. |

**Common issues**
- *Missing environment variables*: the function returns HTTP 500 with `S3 configuration missing` or `Logo.dev credentials missing`.
- *403/401 from logo.dev*: ensure both API key and secret key are valid. The multi-step fallback is designed to handle either header-based or query-based auth.
- *Public access blocked*: confirm the bucket policy allows `s3:GetObject` for the `logos/*` prefix (see `AWS_S3_SETUP.md` for baseline configuration).

---

## Extending the Integration

- Change `size` or `format` query parameters in the edge function to fetch different logo variants; remember to adjust cache keys if you mix dimensions.
- Surface additional metadata (e.g., `cached` or `domain`) in the UI by reading it from the hook’s response for debugging chips or badges.
- Add monitoring by logging error responses and last attempted logo.dev URL whenever we fall back to placeholder avatars.

This flow keeps logo retrieval fast (single network hop after the first request) while shielding the UI from logo.dev latency and rate limits.


