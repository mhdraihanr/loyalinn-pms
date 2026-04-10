# Phase 4.1: Automated PMS Sync Endpoint (Polling Scheduler) Implementation Plan

The objective of Task 4.1 is to automate the synchronization of reservations and guest data from the Property Management System (PMS) into our Database.
Because QloApps (our MVP PMS) does not support native webhooks, we will implement **Option 1 (Polling)**.

We will create a secure, scheduled API endpoint (`/api/cron/pms-sync`) that runs at regular intervals (e.g., every 5-10 minutes via Vercel Cron or a similar service). This endpoint will iterate through all active `pms_configurations`, fetch the latest data from QloApps using our existing `QloAppsAdapter`, and update our `reservations` and `guests` tables. It will also track state changes (e.g., pre-arrival -> on-stay) and insert these events into the `inbound_events` table to be processed by the automation engine in subsequent steps.

## Proposed Changes

### 1. The Polling Cron Endpoint

A new serverless route to trigger synchronization.

#### [NEW] app/api/cron/pms-sync/route.ts

- Create a `GET` API route.
- **Security Check:** Validate that the request is authenticated via an `Authorization` header `Bearer ${process.env.CRON_SECRET}` (the standard Vercel Cron security pattern).
- Query the `pms_configurations` table for all `is_active = true` configurations.
- For each active tenant, fetch the previous 7 days and future 7 days of reservations using an initialized `PMSAdapter`.
- Call a new background service to process these reservations asynchronously.

### 2. The Auto-Sync Service

The logic to compare fetched data against DB data.

#### [NEW] lib/pms/auto-sync-service.ts

- Create a function `runAutoSyncForTenant(tenantId, adapter)`.
- Fetch all current reservations for the tenant from our `reservations` table (to know the "before" state).
- Call `adapter.pullReservations(...)`.
- For each reservation returned by the adapter:
  - If it is new (not in DB), insert it and log a `reservation.created` event into `inbound_events`.
  - If it already exists in DB, compare the old `status` vs the new `status`.
  - If the status has changed (e.g., `pre-arrival` to `on-stay`), update the DB and log a `reservation.updated` event into `inbound_events`.
  - Also log other relevant changes (e.g., checkout date modified).

### 3. Idempotency & Events Database

Ensuring we don't send duplicate template messages.

#### [MODIFY] supabase/schema.sql

- Review the existing `inbound_events` and `automation_jobs` tables and ensure they are ready for use.
- The `inbound_events` table will hold payloads like:
  ```json
  {
    "reservation_id": "uuid",
    "previous_status": "pre-arrival",
    "new_status": "on-stay"
  }
  ```

## Verification Plan

### Automated/Unit Tests

- Write tests for `auto-sync-service.ts` mocking the DB (`supabase`) and `adapter` returns.
- Ensure that if the adapter returns the exact same data as the DB, _zero_ new records are inserted into `inbound_events`.
- Ensure that if the adapter returns a changed status, exactly _one_ new record is inserted into `inbound_events`.

### Manual Testing

- Start the app locally.
- Manually trigger `GET /api/cron/pms-sync` with Postman using the correct `CRON_SECRET` header.
- Watch the sync logs output to the terminal.
- Verify that the `reservations` and `guests` tables are updated.
- Change a status directly in the QloApps Docker DB manually (or via Mock adapter).
- Run the Cron endpoint again.
- Verify that exactly 1 event appears in `inbound_events` corresponding to the status change.
