-- Check pg_net request status
-- This shows the status of queued HTTP requests

SELECT
  id as request_id,
  method,
  url,
  created,
  status,
  status_text,
  response_headers,
  response_body
FROM net.http_request_queue
ORDER BY created DESC
LIMIT 10;
