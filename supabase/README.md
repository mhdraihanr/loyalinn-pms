# Supabase Database Schema

This directory contains the database schema and seed data for the Hotel PMS Integration & WhatsApp Automation app.

## Files

- `schema.sql` - Complete database schema with RLS policies
- `seed.sql` - Demo data (commented out - requires auth user first)
- `migrations/` - Database migration files (apply after initial schema.sql)

## Schema Overview

**Architecture:** 1 Tenant → Many Users, 1 User → max 1 Tenant

```
Tenant (Hotel A)
├── User 1 (owner)   ← creates tenant via /onboarding/create-tenant
├── User 2 (staff)   ← invited by owner, accepts via /accept-invite
└── User 3 (staff)   ← invited by owner, accepts via /accept-invite
```

**Key constraint:** `tenant_users.user_id UNIQUE` — enforced at database level.

### Tables (11 tables)

| #   | Table                 | Purpose                                                   |
| --- | --------------------- | --------------------------------------------------------- |
| 1   | `tenants`             | Hotel entity                                              |
| 2   | `tenant_users`        | Membership — `UNIQUE(user_id)`, roles: `owner` \| `staff` |
| 3   | `invitations`         | Staff invite tokens — UUID, 7-day expiry, status tracking |
| 4   | `pms_configurations`  | PMS integration settings                                  |
| 5   | `waha_configurations` | WhatsApp API settings                                     |
| 6   | `guests`              | Guest profiles synced from PMS                            |
| 7   | `reservations`        | Reservation data synced from PMS                          |
| 8   | `message_templates`   | Customizable message templates                            |
| 9   | `message_logs`        | Audit trail of all messages sent                          |
| 10  | `inbound_events`      | Webhook event deduplication (idempotency)                 |
| 11  | `automation_jobs`     | Message queue with retry logic                            |

## Migrations

`schema.sql` is the initial baseline schema (Phase 0). All subsequent changes are in `migrations/`:

| File                                       | Description                        |
| ------------------------------------------ | ---------------------------------- |
| `20260218000000_add_invitations_table.sql` | Phase 1 — staff invite token table |

Apply migrations in order after running `schema.sql`.

## Security

- Row Level Security (RLS) enabled on all tables
- **Members (owner + staff):** view tenant, manage guests/reservations/templates
- **Owner only:** update tenant settings, manage members, manage PMS/WAHA config, manage invitations
- **Service role:** inbound events, automation jobs, invitation token lookup (admin client)

## Row Level Security

All tenant-scoped tables enforce RLS via `tenant_users` membership lookup.
Invitation token lookups use the admin client (service role) — no public SELECT policy on `invitations` to prevent email enumeration.
