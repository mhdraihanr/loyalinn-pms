# Database Migration Strategy

## Overview

All database schema changes MUST go through migrations. Never modify the database schema directly in production.

## Migration Workflow

### Creating a Migration

1. Create a new migration file in `supabase/migrations/`:

   ```bash
   # Format: YYYYMMDDHHMMSS_description.sql
   # Example: 20260216120000_add_guest_preferences.sql
   ```

2. Write the migration SQL:

   ```sql
   -- Add new column
   ALTER TABLE guests ADD COLUMN preferences JSONB DEFAULT '{}';

   -- Create index
   CREATE INDEX idx_guests_preferences ON guests USING GIN (preferences);
   ```

3. Test the migration locally:
   - Apply migration to local Supabase instance
   - Verify schema changes
   - Test application functionality

4. Document rollback steps:
   ```sql
   -- Rollback (if needed):
   -- DROP INDEX idx_guests_preferences;
   -- ALTER TABLE guests DROP COLUMN preferences;
   ```

### Applying Migrations

**Development:**

- Use Supabase CLI: `supabase db push`
- Or apply manually in Supabase Studio SQL Editor

**Production:**

- Apply migrations during maintenance window
- Always have rollback plan ready
- Monitor application after migration

## Migration Best Practices

1. **Backwards Compatibility**: Ensure migrations don't break existing code
2. **Idempotency**: Migrations should be safe to run multiple times
3. **Small Changes**: Keep migrations focused and atomic
4. **Test First**: Always test migrations in development
5. **Document Rollback**: Include rollback steps in comments

## Critical Migrations

For high-risk migrations (data transformations, column drops):

1. Create a backup before applying
2. Test rollback procedure
3. Have monitoring in place
4. Schedule during low-traffic period
5. Communicate with team

## Migration Checklist

- [ ] Migration file created with timestamp
- [ ] SQL syntax validated
- [ ] Tested in local environment
- [ ] Rollback steps documented
- [ ] RLS policies updated (if needed)
- [ ] Indexes added for new columns
- [ ] Team notified of schema changes

## Pending Migrations (To Be Applied)

- `20240320000000_add_post_stay_feedback.sql`: Adds post-stay feedback columns to the reservations table.
- `20240320000001_add_on_stay_requests.sql`: Creates `room_service_orders` and `housekeeping_requests` tables for On-Stay AI Agent features.
