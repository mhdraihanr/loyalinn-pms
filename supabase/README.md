# Supabase Database Schema

## Setup

1. Create a new Supabase project at https://supabase.com
2. Run the schema.sql file in the SQL Editor
3. Run the seed.sql file for demo data
4. Copy the project URL and anon key to .env.local

## Tables

- **tenants**: Multi-tenant isolation root table
- **tenant_users**: User membership and roles (owner, admin, agent)
- **pms_configurations**: PMS integration settings per tenant
- **waha_configurations**: WhatsApp API settings per tenant
- **guests**: Guest profiles synced from PMS
- **reservations**: Reservation data synced from PMS
- **message_templates**: Customizable message templates
- **message_logs**: Audit trail of all messages sent
- **inbound_events**: Webhook event deduplication
- **automation_jobs**: Message queue with retry logic

## Row Level Security

All tenant-scoped tables enforce RLS based on tenant_users membership.
Service role is required for webhook and automation operations.
