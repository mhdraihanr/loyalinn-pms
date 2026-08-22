# QloApps Webhook-First Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make QloApps webhook events the primary runtime path for syncing guests, reservations, inbound events, and automation jobs, while keeping polling as explicit fallback reconciliation.

**Architecture:** The existing webhook route will stay as the ingress boundary. A new webhook processing service will resolve the tenant, persist the inbound event idempotently, enrich order details through the existing QloApps PMS adapter, upsert guest/reservation records, and enqueue automation jobs only after the local reservation state is updated. Existing polling code remains available, but production scheduling changes from frequent polling to reconciliation-only behavior.

**Tech Stack:** Next.js App Router, TypeScript, Supabase service-role client, QloApps PMS adapter, Vitest.

---

## Current Runtime Gap

The repository already has:

- `app/api/webhooks/pms/route.ts` for webhook ingress.
- `lib/automation/qloapps-normalizer.ts` for thin payload normalization.
- `lib/automation/tenant-resolver.ts` for `tenant_key`/`tenants.slug` to UUID resolution.
- `lib/pms/auto-sync-service.ts` for pull-based guest/reservation upsert.
- `lib/pms/pms-sync-cron.ts` for polling all active tenants.
- `vercel.json` with frequent PMS sync every 5 minutes.

The missing runtime behavior is:

- webhook-driven enrichment,
- webhook-driven guest/reservation upsert,
- reservation-linked automation jobs from webhook events,
- production polling reduced to fallback reconciliation.

---

## Task 1: Extract Shared Reservation Upsert Logic

**Files:**

- Modify: `lib/pms/auto-sync-service.ts`
- Create: `lib/pms/reservation-upsert-service.ts`
- Test: `tests/unit/reservation-upsert-service.test.ts`

**Purpose:** Move reusable guest/reservation upsert and change detection logic out of polling-only code so webhook processing can use the same persistence behavior.

### Step 1: Write failing tests

Create tests for:

1. New reservation creates guest and reservation.
2. Existing reservation updates changed status/room/amount/date fields.
3. Existing unchanged reservation returns `changed: false`.
4. Checked-out/cancelled historical new reservation can be skipped only when caller opts into polling cleanup behavior.

Expected initial result: tests fail because `upsertPmsReservation` does not exist.

### Step 2: Implement service

Create `upsertPmsReservation(params)` that accepts:

- `tenantId`
- `adapter`
- `reservation`
- `status`
- `skipTerminalNewReservations?: boolean`

Return:

- `reservationId`
- `guestId`
- `previousStatus`
- `nextStatus`
- `changed`
- `skipped`

### Step 3: Refactor polling sync

Update `runAutoSyncForTenant()` to call the new service instead of owning all guest/reservation persistence directly.

### Step 4: Verify

Run:

- `npm test -- tests/unit/reservation-upsert-service.test.ts`
- `npm test -- tests/dashboard-data.test.ts`

Expected: pass.

---

## Task 2: Add QloApps Webhook Processing Service

**Files:**

- Create: `lib/pms/qloapps-webhook-processor.ts`
- Modify: `app/api/webhooks/pms/route.ts`
- Test: `tests/unit/qloapps-webhook-processor.test.ts`

**Purpose:** Move webhook runtime work from route handler into a service that can be tested directly.

### Step 1: Write failing tests

Test cases:

1. Unknown `tenant_key` returns not-found style error.
2. Duplicate inbound event returns `duplicate: true` and does not upsert reservation.
3. Valid event inserts inbound event, enriches reservation, upserts local guest/reservation, and marks event processed.
4. Valid status transition enqueues automation with `reservation_id`.
5. Enrichment failure stores/returns processing error without silently succeeding.

Expected initial result: tests fail because `processQloAppsWebhookEvent` does not exist.

### Step 2: Implement processor input

The processor should accept:

- `rawBody`
- `payload`
- `payloadHash`
- `normalizedEvent`
- optional injectable Supabase client and adapter factory for tests.

### Step 3: Resolve PMS config

After tenant UUID resolution, fetch active `pms_configurations` for that tenant where `pms_type = 'qloapps'` and `is_active = true`.

If missing, return `500`/processing error equivalent because webhook cannot enrich details.

### Step 4: Initialize adapter

Use existing PMS registry/adapter:

- `getPMSAdapter('qloapps')`
- `adapter.init(configuration.credentials, configuration.endpoint)`

### Step 5: Enrich reservation

Use the webhook `bookingId`/`id_order` to fetch the matching QloApps reservation data.

Preferred implementation path:

- add a targeted adapter method if available/needed, for example `pullReservationById(idOrder)`.
- avoid scanning large date windows inside webhook path.

If the current adapter cannot fetch by id yet, implement the targeted method in the QloApps adapter.

### Step 6: Persist event and reservation

Processing order:

1. Insert `inbound_events` idempotently.
2. If duplicate, return success duplicate response.
3. Enrich reservation from QloApps.
4. Upsert guest/reservation via shared service.
5. Mark inbound event `processed = true`, `processed_at = now()`.
6. If persistence/enrichment fails, set `processing_error` on inbound event.

### Step 7: Enqueue automation after upsert

Automation job must include:

- `tenant_id`
- `reservation_id`
- `job_type: 'status-trigger'`
- `trigger_type: nextStatus`
- payload with `inbound_event_id`, `booking_id`, `status`, `previous_status`, `updated_at`, `event_type`.

Recommended trigger policy:

- `pre-arrival`: enqueue only for new reservation/payment-confirmed if pre-arrival messaging is enabled later.
- `on-stay`: enqueue when status transitions into `on-stay`.
- `checked-out`: enqueue only if post-stay flow exists/enabled.
- `cancelled`: enqueue cleanup/cancel job if existing automation supports it.

For MVP, preserve current behavior for `on-stay` and `cancelled`, but ensure job has `reservation_id` when possible.

### Step 8: Simplify route handler

Keep route responsible only for:

- reading raw body,
- checking timestamp,
- checking HMAC signature,
- parsing JSON,
- normalizing payload,
- calling processor,
- translating processor result to HTTP response.

### Step 9: Verify

Run:

- `npm test -- tests/unit/qloapps-webhook-processor.test.ts`
- `npm test -- tests/unit/webhook-tenant-resolver.test.ts`

Expected: pass.

---

## Task 3: Add Targeted QloApps Reservation Fetch

**Files:**

- Modify: `lib/pms/adapter.ts`
- Modify: `lib/pms/qloapps-adapter.ts`
- Test: `tests/unit/qloapps-adapter.test.ts` or existing PMS adapter test file if present.

**Purpose:** Avoid using wide polling windows in webhook processing.

### Step 1: Extend adapter contract

Add optional method:

```ts
pullReservationById?(bookingId: string): Promise<AdapterReservation | null>;
```

### Step 2: Implement QloApps method

Implement targeted lookup using QloApps webservice data available for orders/room bookings.

Expected behavior:

- return normalized `AdapterReservation` for one QloApps order/booking,
- return `null` if not found,
- preserve current `mapStatus()` behavior.

### Step 3: Test fallback behavior

If exact QloApps endpoint limitations require multiple reads, keep the query scoped to the order/booking id, not a rolling date window.

### Step 4: Verify

Run adapter tests and webhook processor tests.

---

## Task 4: Convert Polling to Fallback Reconciliation

**Files:**

- Modify: `lib/pms/pms-sync-cron.ts`
- Modify: `app/api/cron/pms-sync/route.ts`
- Modify: `vercel.json`
- Optional Modify: `lib/pms/dev-sync-scheduler.ts`
- Test: `tests/unit/pms-sync-cron.test.ts` if existing, otherwise create it.

**Purpose:** Keep pull sync available, but make it explicit reconciliation rather than frequent production primary sync.

### Step 1: Add explicit reconciliation naming

Add or rename wrapper to something like:

- `runPmsReconciliation()`

This can call existing `runAutoSyncForTenant()` internally.

### Step 2: Protect cron by mode/env

Add environment control:

- `PMS_RECONCILIATION_ENABLED`
- optional `PMS_RECONCILIATION_CRON_SECRET`

If disabled, route returns a successful no-op response:

```json
{ "skipped": true, "reason": "PMS reconciliation disabled" }
```

### Step 3: Reduce production schedule

Change `vercel.json` PMS cron schedule from every 5 minutes to a fallback cadence, for example:

- daily: `0 2 * * *`

or remove it if manual-only reconciliation is desired.

Recommended MVP: daily reconciliation until webhook path is proven stable.

### Step 4: Dev scheduler guard

Ensure `lib/pms/dev-sync-scheduler.ts` does not start polling unless a dev-only env var is explicitly enabled.

Recommended env:

- `PMS_DEV_SYNC_ENABLED=true`

### Step 5: Verify

Run:

- `npm test -- tests/unit/pms-sync-cron.test.ts`
- `npm test`

Expected: pass.

---

## Task 5: Update Docs and Operator Runbook

**Files:**

- Modify: `docs/qloapps-integration/README.md`
- Modify: `docs/qloapps-integration/qloapps-webhook-setup-guide.md`
- Modify: `docs/runbook.md`
- Modify: `README.md`
- Modify: `qloapps-module/loyalinnwebhooksync/README.md`

**Purpose:** Make operator behavior match runtime behavior.

### Step 1: Document runtime modes

Add clear terms:

- Webhook-first mode
- Reconciliation mode
- Dev polling mode

### Step 2: Document env vars

Add:

- `PMS_WEBHOOK_SECRET`
- `PMS_RECONCILIATION_ENABLED`
- `PMS_DEV_SYNC_ENABLED`

### Step 3: Document UAT checks

Include:

1. Create booking in QloApps.
2. Confirm webhook appears in `inbound_events` with `source = 'qloapps'`.
3. Confirm `reservations` has matching `pms_reservation_id`.
4. Confirm `guests` has matching guest data.
5. Confirm expected `automation_jobs` row only after reservation upsert.
6. Confirm no 5-minute production pull is required.

### Step 4: Verify docs

Run link/path sanity checks manually by opening docs.

---

## Task 6: End-to-End Verification

**Files:**

- No new source files unless tests reveal gaps.

**Purpose:** Verify the migration works and does not regress existing automation.

### Step 1: Unit tests

Run:

- `npm test -- tests/unit/webhook-tenant-resolver.test.ts`
- `npm test -- tests/unit/qloapps-webhook-processor.test.ts`
- `npm test -- tests/unit/reservation-upsert-service.test.ts`

### Step 2: Full test suite

Run:

- `npm test`

### Step 3: Build/lint

Run:

- `npm run lint`
- `npm run build`

### Step 4: Manual webhook test

Send a signed webhook payload matching the QloApps module format:

- `tenant_key` equals `tenants.slug`
- `event_type` is one of `booking.created`, `booking.payment_confirmed`, `booking.status_changed`, `booking.cancelled`
- `id_order` is an existing QloApps order id
- `status_code` maps to the intended internal status

Expected:

- webhook returns success,
- `inbound_events` stores the event,
- reservation is enriched and upserted,
- automation job is created only when trigger policy matches.

### Step 5: Reconciliation verification

Disable webhook temporarily or replay a missed event scenario, then run reconciliation and confirm the local reservation state converges correctly.

---

## Expected Outcome

After this plan is implemented:

- QloApps emits thin webhook events from native hooks.
- The app treats webhook ingestion as the primary reservation sync path.
- Reservation persistence is shared between webhook and reconciliation paths.
- Automation jobs are created from actual local reservation transitions, not just raw inbound payloads.
- Polling remains available, but only as explicit fallback reconciliation.
- Operators have one canonical documentation folder under `docs/qloapps-integration`.
