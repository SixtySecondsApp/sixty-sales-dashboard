-- Check if Fathom integration exists for any user
SELECT
  fi.id,
  fi.user_id,
  fi.fathom_user_email,
  fi.is_active,
  fi.created_at,
  fi.token_expires_at,
  u.email as user_email
FROM fathom_integrations fi
LEFT JOIN auth.users u ON u.id = fi.user_id
ORDER BY fi.created_at DESC
LIMIT 10;

-- Check OAuth states
SELECT
  id,
  user_id,
  state,
  created_at,
  expires_at,
  expires_at < NOW() as is_expired
FROM fathom_oauth_states
ORDER BY created_at DESC
LIMIT 10;

-- Check sync state
SELECT *
FROM fathom_sync_state
ORDER BY created_at DESC
LIMIT 10;
