-- Check current queued requests
SELECT
  id,
  method,
  url,
  headers,
  timeout_milliseconds
FROM net.http_request_queue
ORDER BY id DESC
LIMIT 10;
