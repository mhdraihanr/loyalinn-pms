# Supabase Database Schema

This directory contains the database schema and seed data for the Hotel PMS Integration & WhatsApp Automation app.

## Files

- `schema.sql` - Complete database schema with RLS policies
- `seed.sql` - Demo data (commented out - requires auth user first)
- `migrations/` - Database migration files

## Schema Overview

**Architecture:** Single tenant per user (1:1 relationship)

### Core Tables

- **tenants**: User's hotel/property (1:1 with auth.users via user_id)
- **pms_configurations**: PMS integration settings per tenant
- **waha_configurations**: WhatsApp API settings per tenant
- **guests**: Guest profiles synced from PMS
- **reservations**: Reservation data synced from PMS
- **message_templates**: Customizable message templates
- **message_logs**: Audit trail of all messages sent
- **inbound_events**: Webhook event deduplication (idempotency)
- **automation_jobs**: Message queue with retry logic

## Security

- Row Level Security (RLS) enabled on all tables
- Users can only access their own tenant data
- Direct user_id lookup from tenants table
- Service role for webhook and automation operations

## Row Level Security

All tenant-scoped tables enforce RLS based on tenant_users membership.
Service role is required for webhook and automation operations.
