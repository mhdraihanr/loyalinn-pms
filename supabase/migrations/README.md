# Database Migrations

This directory contains all database schema migrations.

## File Naming Convention

`YYYYMMDDHHMMSS_description.sql`

Example: `20260216120000_add_guest_preferences.sql`

## Initial Schema

The initial schema is in `../schema.sql`. All subsequent changes should be migrations in this directory.

## Applying Migrations

See `docs/migrations.md` for the complete migration workflow.
