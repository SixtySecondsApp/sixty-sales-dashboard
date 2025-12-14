[
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.launch_checklist_items\\` has a row level security policy \\`Platform admins can insert launch checklist\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "launch_checklist_items",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_launch_checklist_items_Platform admins can insert launch checklist"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.launch_checklist_items\\` has a row level security policy \\`Platform admins can update launch checklist\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "launch_checklist_items",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_launch_checklist_items_Platform admins can update launch checklist"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.launch_checklist_items\\` has a row level security policy \\`Platform admins can view launch checklist\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "launch_checklist_items",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_launch_checklist_items_Platform admins can view launch checklist"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_workflow_results\\` has a row level security policy \\`Org members can view workflow results\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_workflow_results",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_workflow_results_Org members can view workflow results"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_workflow_results\\` has a row level security policy \\`Users can view workflow results for their meetings\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_workflow_results",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_workflow_results_Users can view workflow results for their meetings"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_logs\\` has a row level security policy \\`email_logs_admin_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_logs_email_logs_admin_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_logs\\` has a row level security policy \\`email_logs_service_role\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_logs_email_logs_service_role"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_logs\\` has a row level security policy \\`email_logs_user_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_logs_email_logs_user_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.user_activation_events\\` has a row level security policy \\`activation_events_admin_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_user_activation_events_activation_events_admin_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.user_activation_events\\` has a row level security policy \\`activation_events_user_insert\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_user_activation_events_activation_events_user_insert"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.user_activation_events\\` has a row level security policy \\`activation_events_user_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_user_activation_events_activation_events_user_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meetings_waitlist\\` has a row level security policy \\`Platform admins can manage waitlist\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meetings_waitlist_Platform admins can manage waitlist"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_journeys\\` has a row level security policy \\`email_journeys_admin_insert\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_journeys",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_journeys_email_journeys_admin_insert"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_journeys\\` has a row level security policy \\`email_journeys_admin_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_journeys",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_journeys_email_journeys_admin_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_journeys\\` has a row level security policy \\`email_journeys_admin_update\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_journeys",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_journeys_email_journeys_admin_update"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_sends\\` has a row level security policy \\`email_sends_admin_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_sends_email_sends_admin_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_sends\\` has a row level security policy \\`email_sends_user_insert\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_sends_email_sends_user_insert"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.email_sends\\` has a row level security policy \\`email_sends_user_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_email_sends_email_sends_user_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.pipeline_automation_rules\\` has a row level security policy \\`Org admins can manage pipeline rules\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "pipeline_automation_rules",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_pipeline_automation_rules_Org admins can manage pipeline rules"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.pipeline_automation_rules\\` has a row level security policy \\`Org members can view pipeline rules\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "pipeline_automation_rules",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_pipeline_automation_rules_Org members can view pipeline rules"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.pipeline_automation_log\\` has a row level security policy \\`Org members can view pipeline log\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "pipeline_automation_log",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_pipeline_automation_log_Org members can view pipeline log"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.encharge_email_templates\\` has a row level security policy \\`encharge_templates_admin_delete\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "encharge_email_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_encharge_email_templates_encharge_templates_admin_delete"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.encharge_email_templates\\` has a row level security policy \\`encharge_templates_admin_insert\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "encharge_email_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_encharge_email_templates_encharge_templates_admin_insert"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.encharge_email_templates\\` has a row level security policy \\`encharge_templates_admin_select\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "encharge_email_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_encharge_email_templates_encharge_templates_admin_select"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.encharge_email_templates\\` has a row level security policy \\`encharge_templates_admin_update\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "encharge_email_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_encharge_email_templates_encharge_templates_admin_update"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.app_settings\\` has a row level security policy \\`app_settings_admin_all\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "app_settings",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_app_settings_app_settings_admin_all"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_structured_summaries\\` has a row level security policy \\`Org members can view structured summaries\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_structured_summaries",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_structured_summaries_Org members can view structured summaries"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_structured_summaries\\` has a row level security policy \\`Service role can manage all structured summaries\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_structured_summaries",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_structured_summaries_Service role can manage all structured summaries"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has a row level security policy \\`Org admins can manage scorecard templates\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_coaching_scorecard_templates_Org admins can manage scorecard templates"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has a row level security policy \\`Org members can view scorecard templates\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_coaching_scorecard_templates_Org members can view scorecard templates"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has a row level security policy \\`Service role can manage all templates\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_coaching_scorecard_templates_Service role can manage all templates"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_scorecards\\` has a row level security policy \\`Org members can view meeting scorecards\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_scorecards",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_scorecards_Org members can view meeting scorecards"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_scorecards\\` has a row level security policy \\`Service role can manage all scorecards\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_scorecards",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_scorecards_Service role can manage all scorecards"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.deal_risk_signals\\` has a row level security policy \\`Org members can resolve risk signals\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_deal_risk_signals_Org members can resolve risk signals"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.deal_risk_signals\\` has a row level security policy \\`Org members can view deal risk signals\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_deal_risk_signals_Org members can view deal risk signals"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.deal_risk_signals\\` has a row level security policy \\`Service role can manage all risk signals\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_deal_risk_signals_Service role can manage all risk signals"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.deal_risk_aggregates\\` has a row level security policy \\`Org members can view deal risk aggregates\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "deal_risk_aggregates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_deal_risk_aggregates_Org members can view deal risk aggregates"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.deal_risk_aggregates\\` has a row level security policy \\`Service role can manage all risk aggregates\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "deal_risk_aggregates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_deal_risk_aggregates_Service role can manage all risk aggregates"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_classifications\\` has a row level security policy \\`Org members can view meeting classifications\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_classifications",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_classifications_Org members can view meeting classifications"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_classifications\\` has a row level security policy \\`Service role can manage all classifications\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_classifications",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_classifications_Service role can manage all classifications"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_aggregate_metrics\\` has a row level security policy \\`Org members can view aggregate metrics\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_aggregate_metrics",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_aggregate_metrics_Org members can view aggregate metrics"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.meeting_aggregate_metrics\\` has a row level security policy \\`Service role can manage all aggregate metrics\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "meeting_aggregate_metrics",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_meeting_aggregate_metrics_Service role can manage all aggregate metrics"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.org_call_types\\` has a row level security policy \\`Org admins can delete call types\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "org_call_types",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_org_call_types_Org admins can delete call types"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.org_call_types\\` has a row level security policy \\`Org admins can insert call types\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "org_call_types",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_org_call_types_Org admins can insert call types"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.org_call_types\\` has a row level security policy \\`Org admins can update call types\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "org_call_types",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_org_call_types_Org admins can update call types"
  },
  {
    "name": "auth_rls_initplan",
    "title": "Auth RLS Initialization Plan",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if calls to \\`current_setting()\\` and \\`auth.<function>()\\` in RLS policies are being unnecessarily re-evaluated for each row",
    "detail": "Table \\`public.org_call_types\\` has a row level security policy \\`Users can view their org's call types\\` that re-evaluates current_setting() or auth.<function>() for each row. This produces suboptimal query performance at scale. Resolve the issue by replacing \\`auth.<function>()\\` with \\`(select auth.<function>())\\`. See [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select) for more info.",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan",
    "metadata": {
      "name": "org_call_types",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "auth_rls_init_plan_public_org_call_types_Users can view their org's call types"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`anon\\` for action \\`DELETE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_anon_DELETE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`anon\\` for action \\`INSERT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_anon_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Org members can view scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`anon\\` for action \\`UPDATE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_anon_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_aggregates\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk aggregates\",\"Service role can manage all risk aggregates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_aggregates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_aggregates_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`anon\\` for action \\`UPDATE\\`. Policies include \\`{\"Org members can resolve risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_anon_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_logs\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{email_logs_admin_select,email_logs_service_role,email_logs_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_logs_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_sends\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{email_sends_admin_select,email_sends_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_sends_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_aggregate_metrics\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view aggregate metrics\",\"Service role can manage all aggregate metrics\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_aggregate_metrics",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_aggregate_metrics_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_classifications\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting classifications\",\"Service role can manage all classifications\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_classifications",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_classifications_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_scorecards\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting scorecards\",\"Service role can manage all scorecards\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_scorecards",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_scorecards_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_structured_summaries\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view structured summaries\",\"Service role can manage all structured summaries\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_structured_summaries",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_structured_summaries_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`anon\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can signup for waitlist\",meetings_waitlist_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_anon_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view waitlist entries\",meetings_waitlist_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.user_activation_events\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{activation_events_admin_select,activation_events_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_user_activation_events_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`anon\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can create email invites\",waitlist_email_invites_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_anon_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`anon\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view email invites\",waitlist_email_invites_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_anon_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`anon\\` for action \\`UPDATE\\`. Policies include \\`{\"Anyone can update email invites\",waitlist_email_invites_update}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_anon_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.app_settings\\` has multiple permissive policies for role \\`authenticated\\` for action \\`DELETE\\`. Policies include \\`{app_settings_admin_all,app_settings_delete}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "app_settings",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_app_settings_authenticated_DELETE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.app_settings\\` has multiple permissive policies for role \\`authenticated\\` for action \\`INSERT\\`. Policies include \\`{app_settings_admin_all,app_settings_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "app_settings",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_app_settings_authenticated_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.app_settings\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{app_settings_admin_all,app_settings_authenticated_read,app_settings_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "app_settings",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_app_settings_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.app_settings\\` has multiple permissive policies for role \\`authenticated\\` for action \\`UPDATE\\`. Policies include \\`{app_settings_admin_all,app_settings_update}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "app_settings",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_app_settings_authenticated_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticated\\` for action \\`DELETE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticated_DELETE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticated\\` for action \\`INSERT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticated_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Org members can view scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticated\\` for action \\`UPDATE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticated_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_aggregates\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk aggregates\",\"Service role can manage all risk aggregates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_aggregates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_aggregates_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`authenticated\\` for action \\`UPDATE\\`. Policies include \\`{\"Org members can resolve risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_authenticated_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_logs\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{email_logs_admin_select,email_logs_service_role,email_logs_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_logs_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_sends\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{email_sends_admin_select,email_sends_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_sends_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_aggregate_metrics\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view aggregate metrics\",\"Service role can manage all aggregate metrics\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_aggregate_metrics",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_aggregate_metrics_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_classifications\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting classifications\",\"Service role can manage all classifications\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_classifications",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_classifications_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_scorecards\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting scorecards\",\"Service role can manage all scorecards\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_scorecards",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_scorecards_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_structured_summaries\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view structured summaries\",\"Service role can manage all structured summaries\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_structured_summaries",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_structured_summaries_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_workflow_results\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view workflow results\",\"Users can view workflow results for their meetings\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_workflow_results",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_workflow_results_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`authenticated\\` for action \\`DELETE\\`. Policies include \\`{\"Platform admins can manage waitlist\",meetings_waitlist_delete}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_authenticated_DELETE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`authenticated\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can signup for waitlist\",\"Platform admins can manage waitlist\",meetings_waitlist_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_authenticated_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view waitlist entries\",\"Platform admins can manage waitlist\",meetings_waitlist_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`authenticated\\` for action \\`UPDATE\\`. Policies include \\`{\"Platform admins can manage waitlist\",meetings_waitlist_update}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_authenticated_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.pipeline_automation_rules\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Org admins can manage pipeline rules\",\"Org members can view pipeline rules\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "pipeline_automation_rules",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_pipeline_automation_rules_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.user_activation_events\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{activation_events_admin_select,activation_events_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_user_activation_events_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`authenticated\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can create email invites\",waitlist_email_invites_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_authenticated_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`authenticated\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view email invites\",waitlist_email_invites_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_authenticated_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`authenticated\\` for action \\`UPDATE\\`. Policies include \\`{\"Anyone can update email invites\",waitlist_email_invites_update}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_authenticated_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticator\\` for action \\`DELETE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticator_DELETE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticator\\` for action \\`INSERT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticator_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Org members can view scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`authenticator\\` for action \\`UPDATE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_authenticator_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_aggregates\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk aggregates\",\"Service role can manage all risk aggregates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_aggregates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_aggregates_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`authenticator\\` for action \\`UPDATE\\`. Policies include \\`{\"Org members can resolve risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_authenticator_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_logs\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{email_logs_admin_select,email_logs_service_role,email_logs_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_logs_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_sends\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{email_sends_admin_select,email_sends_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_sends_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_aggregate_metrics\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view aggregate metrics\",\"Service role can manage all aggregate metrics\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_aggregate_metrics",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_aggregate_metrics_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_classifications\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting classifications\",\"Service role can manage all classifications\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_classifications",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_classifications_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_scorecards\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting scorecards\",\"Service role can manage all scorecards\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_scorecards",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_scorecards_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_structured_summaries\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view structured summaries\",\"Service role can manage all structured summaries\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_structured_summaries",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_structured_summaries_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`authenticator\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can signup for waitlist\",meetings_waitlist_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_authenticator_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view waitlist entries\",meetings_waitlist_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.user_activation_events\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{activation_events_admin_select,activation_events_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_user_activation_events_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`authenticator\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can create email invites\",waitlist_email_invites_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_authenticator_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`authenticator\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view email invites\",waitlist_email_invites_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_authenticator_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`authenticator\\` for action \\`UPDATE\\`. Policies include \\`{\"Anyone can update email invites\",waitlist_email_invites_update}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_authenticator_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`DELETE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_cli_login_postgres_DELETE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`INSERT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_cli_login_postgres_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Org members can view scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`UPDATE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_cli_login_postgres_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_aggregates\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk aggregates\",\"Service role can manage all risk aggregates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_aggregates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_aggregates_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`UPDATE\\`. Policies include \\`{\"Org members can resolve risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_cli_login_postgres_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_logs\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{email_logs_admin_select,email_logs_service_role,email_logs_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_logs_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_sends\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{email_sends_admin_select,email_sends_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_sends_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_aggregate_metrics\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view aggregate metrics\",\"Service role can manage all aggregate metrics\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_aggregate_metrics",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_aggregate_metrics_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_classifications\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting classifications\",\"Service role can manage all classifications\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_classifications",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_classifications_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_scorecards\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting scorecards\",\"Service role can manage all scorecards\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_scorecards",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_scorecards_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_structured_summaries\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view structured summaries\",\"Service role can manage all structured summaries\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_structured_summaries",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_structured_summaries_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can signup for waitlist\",meetings_waitlist_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_cli_login_postgres_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view waitlist entries\",meetings_waitlist_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.user_activation_events\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{activation_events_admin_select,activation_events_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_user_activation_events_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can create email invites\",waitlist_email_invites_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_cli_login_postgres_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view email invites\",waitlist_email_invites_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_cli_login_postgres_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`cli_login_postgres\\` for action \\`UPDATE\\`. Policies include \\`{\"Anyone can update email invites\",waitlist_email_invites_update}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_cli_login_postgres_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`DELETE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_dashboard_user_DELETE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`INSERT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_dashboard_user_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Org members can view scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.coaching_scorecard_templates\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`UPDATE\\`. Policies include \\`{\"Org admins can manage scorecard templates\",\"Service role can manage all templates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "coaching_scorecard_templates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_coaching_scorecard_templates_dashboard_user_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_aggregates\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk aggregates\",\"Service role can manage all risk aggregates\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_aggregates",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_aggregates_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view deal risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.deal_risk_signals\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`UPDATE\\`. Policies include \\`{\"Org members can resolve risk signals\",\"Service role can manage all risk signals\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "deal_risk_signals",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_deal_risk_signals_dashboard_user_UPDATE"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_logs\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{email_logs_admin_select,email_logs_service_role,email_logs_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_logs",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_logs_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.email_sends\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{email_sends_admin_select,email_sends_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "email_sends",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_email_sends_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_aggregate_metrics\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view aggregate metrics\",\"Service role can manage all aggregate metrics\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_aggregate_metrics",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_aggregate_metrics_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_classifications\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting classifications\",\"Service role can manage all classifications\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_classifications",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_classifications_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_scorecards\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view meeting scorecards\",\"Service role can manage all scorecards\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_scorecards",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_scorecards_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meeting_structured_summaries\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Org members can view structured summaries\",\"Service role can manage all structured summaries\"}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meeting_structured_summaries",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meeting_structured_summaries_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can signup for waitlist\",meetings_waitlist_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_dashboard_user_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.meetings_waitlist\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view waitlist entries\",meetings_waitlist_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "meetings_waitlist",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_meetings_waitlist_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.user_activation_events\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{activation_events_admin_select,activation_events_user_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "user_activation_events",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_user_activation_events_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`INSERT\\`. Policies include \\`{\"Anyone can create email invites\",waitlist_email_invites_insert}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_dashboard_user_INSERT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`SELECT\\`. Policies include \\`{\"Anyone can view email invites\",waitlist_email_invites_select}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_dashboard_user_SELECT"
  },
  {
    "name": "multiple_permissive_policies",
    "title": "Multiple Permissive Policies",
    "level": "WARN",
    "facing": "EXTERNAL",
    "categories": [
      "PERFORMANCE"
    ],
    "description": "Detects if multiple permissive row level security policies are present on a table for the same \\`role\\` and \\`action\\` (e.g. insert). Multiple permissive policies are suboptimal for performance as each policy must be executed for every relevant query.",
    "detail": "Table \\`public.waitlist_email_invites\\` has multiple permissive policies for role \\`dashboard_user\\` for action \\`UPDATE\\`. Policies include \\`{\"Anyone can update email invites\",waitlist_email_invites_update}\\`",
    "remediation": "https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies",
    "metadata": {
      "name": "waitlist_email_invites",
      "type": "table",
      "schema": "public"
    },
    "cache_key": "multiple_permissive_policies_public_waitlist_email_invites_dashboard_user_UPDATE"
  }
]