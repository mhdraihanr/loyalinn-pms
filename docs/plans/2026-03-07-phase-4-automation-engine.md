# Phase 4 Automation Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reliable Phase 4 automation pipeline that ingests QloApps webhook events, deduplicates them, queues asynchronous jobs, sends WhatsApp messages through WAHA, and records retryable delivery state.

**Architecture:** The webhook route stays thin and only verifies, normalizes, deduplicates, and enqueues work. A cron-triggered worker claims jobs from Postgres using `FOR UPDATE SKIP LOCKED`, resolves eligible message triggers, sends through WAHA, and updates `message_logs`, `automation_jobs`, and `inbound_events` deterministically.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres, WAHA, structured logging, ESLint.

---

### Task 1: Add Phase 4 schema migration

**Files:**

- Create: `supabase/migrations/20260307xxxxxx_add_phase4_automation_metadata.sql`
- Modify: `supabase/schema.sql`
- Test: manual SQL verification against local Supabase or schema review

**Step 1: Write the migration**

Add a migration that:

- alters `inbound_events` with `idempotency_key`, `source`, `signature_valid`, `payload_hash`, `received_at`, `processed_at`, `processing_error`
- adds `UNIQUE(tenant_id, idempotency_key)`
- alters `automation_jobs` with `trigger_type`, `available_at`, `locked_at`, `locked_by`, `last_error_category`, `message_log_id`
- alters `message_logs` with `trigger_type`, `template_language_code`, `automation_job_id`, `provider_message_id`, `provider_response`
- adds indexes for queue lookup

**Step 2: Mirror schema.sql**

Update `supabase/schema.sql` so it matches the new migration state.

**Step 3: Review for backward compatibility**

Confirm defaults and nullable columns do not break existing inserts from current code paths.

**Step 4: Validate the migration**

Run the local migration command or perform the project’s existing migration workflow.
Expected: migration applies cleanly with no SQL errors.

**Step 5: Commit**

Commit message: `feat: extend schema for phase 4 automation pipeline`

---

### Task 2: Add automation domain types and pure helpers

**Files:**

- Create: `lib/automation/types.ts`
- Create: `lib/automation/idempotency.ts`
- Test: `tests/unit/lib/automation/idempotency.test.ts`

**Step 1: Write the failing test**

Create tests for:

- stable `idempotency_key` generation from `booking_id`, `status`, `updated_at`
- fallback payload hash behavior when `updated_at` is absent
- payload hash stability for identical raw payloads

**Step 2: Run test to verify it fails**

Run the project test command for the new file.
Expected: failure because helper files and test harness are not ready yet.

**Step 3: Write minimal implementation**

Add:

- internal webhook event types
- `buildIdempotencyKey()`
- `buildPayloadHash()`
- any small parser-safe helper needed by webhook ingestion

**Step 4: Run test to verify it passes**

Run the test again.
Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add automation idempotency helpers`

---

### Task 3: Add retry policy with pure tests

**Files:**

- Create: `lib/automation/retry-policy.ts`
- Test: `tests/unit/lib/automation/retry-policy.test.ts`

**Step 1: Write the failing test**

Cover:

- retry schedule for attempts 1 through 4
- terminal dead-letter decision after max retries
- mapping of error categories to retry behavior

**Step 2: Run test to verify it fails**

Expected: FAIL because policy module does not exist.

**Step 3: Write minimal implementation**

Implement pure functions such as:

- `classifyAutomationError()`
- `getNextRetryAt()`
- `shouldDeadLetter()`

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add automation retry policy`

---

### Task 4: Add queue claim and lifecycle helpers

**Files:**

- Create: `lib/automation/queue.ts`
- Test: `tests/unit/lib/automation/queue.test.ts` or integration test if SQL is required

**Step 1: Write the failing test**

Cover:

- claiming only eligible jobs with `status='pending'` and `available_at <= now`
- not reclaiming locked or already processing jobs
- rescheduling retryable jobs
- marking terminal jobs dead-letter

**Step 2: Run test to verify it fails**

Expected: FAIL because queue helpers do not exist.

**Step 3: Write minimal implementation**

Implement helpers to:

- claim a batch of jobs using Postgres locking
- mark `processing`
- mark `completed`
- mark `failed` with a retry time
- mark `dead-letter`

Use `createAdminClient()` so background work is independent of RLS.

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add postgres-backed automation queue helpers`

---

### Task 5: Add template rendering and delivery guards

**Files:**

- Create: `lib/automation/template-renderer.ts`
- Test: `tests/unit/lib/automation/template-renderer.test.ts`

**Step 1: Write the failing test**

Cover:

- variable interpolation for `{{guestName}}`, `{{roomNumber}}`, `{{checkInDate}}`, `{{checkOutDate}}`, `{{hotelName}}`
- rejecting send when guest phone is missing
- rejecting send when no active template variant exists
- rejecting duplicate successful sends for the same reservation and trigger

**Step 2: Run test to verify it fails**

Expected: FAIL because renderer does not exist.

**Step 3: Write minimal implementation**

Implement:

- `renderTemplate()`
- small helper to choose template language variant
- guard helpers used by the status trigger engine

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add automation template rendering guards`

---

### Task 6: Implement PMS webhook ingestion route

**Files:**

- Create: `app/api/webhooks/pms/route.ts`
- Create: `lib/automation/qloapps-normalizer.ts`
- Test: `tests/integration/app/api/webhooks/pms/route.test.ts`

**Step 1: Write the failing integration test**

Cover:

- valid webhook persists one `inbound_events` row and one `automation_jobs` row
- duplicate webhook with the same idempotency key does not create a second job
- invalid secret or signature returns unauthorized

**Step 2: Run test to verify it fails**

Expected: FAIL because route and normalizer do not exist.

**Step 3: Write minimal implementation**

Implement route logic to:

- read raw request body
- validate configured secret or signature
- normalize the QloApps payload
- compute idempotency and payload hash
- insert `inbound_events`
- create queued `automation_jobs`
- return a fast success response

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add pms webhook ingestion route`

---

### Task 7: Implement status-trigger orchestration

**Files:**

- Create: `lib/automation/status-trigger.ts`
- Test: `tests/integration/lib/automation/status-trigger.test.ts`

**Step 1: Write the failing integration test**

Cover:

- `on-stay` sends only when the reservation truly transitions to `on-stay`
- out-of-order events do not trigger sends
- successful send writes `message_logs` and completes the job
- missing phone or missing template dead-letters the job

**Step 2: Run test to verify it fails**

Expected: FAIL because orchestration module does not exist.

**Step 3: Write minimal implementation**

Implement a function that:

- loads reservation, guest, and tenant context
- determines valid trigger behavior
- resolves template and renders content
- creates draft `message_logs`
- calls WAHA transport
- updates job and log state on success or failure

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add status trigger orchestration`

---

### Task 8: Implement cron automation worker route

**Files:**

- Create: `app/api/cron/automation/route.ts`
- Test: `tests/integration/app/api/cron/automation/route.test.ts`

**Step 1: Write the failing integration test**

Cover:

- unauthorized calls are rejected
- scheduled `pre-arrival` jobs are enqueued once
- scheduled `post-stay` jobs are enqueued once
- worker claims a small batch of jobs and processes them
- retryable failure reschedules with future `available_at`

**Step 2: Run test to verify it fails**

Expected: FAIL because cron route does not exist.

**Step 3: Write minimal implementation**

Implement route logic to:

- validate cron secret
- find reservations eligible for `pre-arrival` and `post-stay`
- enqueue missing jobs idempotently
- claim due jobs
- process them through `status-trigger.ts`
- return a structured batch summary

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add cron-driven automation worker`

---

### Task 9: Implement manual send API skeleton

**Files:**

- Create: `app/api/messages/send/route.ts`
- Test: `tests/integration/app/api/messages/send/route.test.ts`

**Step 1: Write the failing integration test**

Cover:

- only authenticated tenant members can enqueue manual sends
- invalid reservation or guest references are rejected
- a valid manual send request creates a queued job

**Step 2: Run test to verify it fails**

Expected: FAIL because route does not exist.

**Step 3: Write minimal implementation**

Implement route logic that:

- validates tenant access
- resolves reservation and guest
- enqueues a `manual-send` automation job
- returns a success response with job metadata

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Commit**

Commit message: `feat: add manual message send api`

---

### Task 10: Update operational documentation

**Files:**

- Modify: `docs/runbook.md`
- Modify: `docs/migrations.md`

**Step 1: Add runbook guidance**

Document:

- webhook failure response steps
- retry and dead-letter inspection steps
- how to identify a broken WAHA delivery pipeline using `request_id`, `job_id`, and `message_log_id`

**Step 2: Add migration notes**

Document rollback and operational notes for the new Phase 4 migration.

**Step 3: Review documentation for accuracy**

Check that new route paths and job states match code.

**Step 4: Commit**

Commit message: `docs: add phase 4 automation operations notes`

---

### Task 11: Full verification pass

**Files:**

- Verify all touched files

**Step 1: Run lint**

Run the project lint command.
Expected: PASS.

**Step 2: Run focused tests**

Run all unit and integration tests added for Phase 4.
Expected: PASS.

**Step 3: Run end-to-end smoke path manually**

Exercise:

- valid webhook ingestion
- cron worker processing
- WAHA mocked success path
- duplicate webhook path

Expected: one message send, one completed job, no duplicate sends.

**Step 4: Commit final verification changes**

Commit message: `test: verify phase 4 automation flow`

---

## Notes for Execution

- Keep webhook handlers thin
- Prefer pure functions for rendering, retry, and idempotency
- Reuse `createAdminClient()` for all background database writes
- Do not add external queue infrastructure for MVP
- Keep batch processing small at first, for example 10 jobs per cron run

## Suggested test tooling decision

If the repository does not yet have a test runner, add the smallest viable TypeScript-friendly setup before Task 2 and keep it scoped to unit/integration testing needed for Phase 4.

## Suggested execution order

1. schema migration
2. pure helpers
3. retry policy
4. queue helpers
5. template guards
6. webhook route
7. status-trigger orchestration
8. cron route
9. manual send API
10. docs and verification
