# GitHub Secrets Check

Please verify these secrets in your GitHub repository:

**Go to**: Repository → Settings → Secrets and variables → Actions

## Required Secrets:

1. **SUPABASE_PROJECT_ID**
   - Should be: `ewtuefzeogytgmsnkpmb` (your production project)
   - Used for: Finding branches and authentication

2. **SUPABASE_ACCESS_TOKEN**
   - Your Supabase personal access token
   - Get from: https://app.supabase.com/account/tokens
   - Used for: CLI authentication

3. **SUPABASE_DB_PASSWORD**
   - Your production database password
   - Should work for both production AND development-v2
   - Used for: Database connections

## Common Issue:

If `SUPABASE_PROJECT_ID` was set to the OLD development branch ID instead of the production project ID, the workflow would fail to find `development-v2`.

**Correct value**: `ewtuefzeogytgmsnkpmb` (production project)
**Wrong value**: `yjdzlbivjddcumtevggd` or `68fc8173-d1b9-47be-8920-9aa8218cc285` (old branch IDs)

Please check and let me know what SUPABASE_PROJECT_ID is set to!
