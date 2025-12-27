-- Add auto_create_devhub_tickets toggle to sentry_bridge_config
-- This controls whether the Sentry Bridge automatically creates tickets in AI Dev Hub
-- When false, issues are still processed but no MCP calls are made to create tickets

ALTER TABLE sentry_bridge_config
ADD COLUMN IF NOT EXISTS auto_create_devhub_tickets BOOLEAN NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN sentry_bridge_config.auto_create_devhub_tickets IS
  'When true, automatically create tickets in AI Dev Hub via MCP. When false, process webhooks but skip ticket creation.';
