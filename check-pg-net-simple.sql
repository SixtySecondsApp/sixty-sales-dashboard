-- Simple check of pg_net queue - all columns
SELECT *
FROM net.http_request_queue
ORDER BY id DESC
LIMIT 10;
