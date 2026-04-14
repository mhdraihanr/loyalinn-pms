# Phase 4 Automation Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task in the current session.

**Goal:** Build a reliable Phase 4 automation pipeline that ingests QloApps webhook events, deduplicates them, queues asynchronous jobs, sends WhatsApp messages through WAHA, schedules pre-arrival and post-stay automation, supports AI follow-up workflows, and exposes operational requests to staff.

**Architecture:** The webhook route stays thin and only verifies, normalizes, deduplicates, and enqueues work. A cron-triggered worker claims jobs from Postgres using `FOR UPDATE SKIP LOCKED`, while a scheduler module determines which pre-arrival and post-stay jobs should exist. The reliable messaging core lands first, followed by post-stay AI follow-up, on-stay AI tools, and the operations dashboard.

**Tech Stack:** Next.js App Router, TypeScript, Supabase Postgres, WAHA, structured logging, ESLint.

**Status Summary (2026-03-07):**

- Complete through Task 8.
- Verified in `supabase/migrations/`:
  - `20260307123000_add_phase4_automation_metadata.sql`
  - `20260307160000_add_claim_automation_jobs_function.sql`
- Verified in `lib/automation/`:
  - `idempotency.ts`, `types.ts`, `retry-policy.ts`, `queue.ts`, `template-renderer.ts`, `qloapps-normalizer.ts`, `status-trigger.ts`, `scheduler.ts`
- Related development support now also exists outside the strict Task 1-8 scope:
  - `lib/pms/auto-sync-service.ts` upserts polled guest and reservation data, emits polling-driven `inbound_events`, and enqueues immediate automation jobs for valid `on-stay` transitions.
  - `lib/pms/pms-sync-cron.ts` uses a `-30/+30` day polling window for PMS auto-sync.
  - `lib/pms/dev-sync-scheduler.ts` runs development-only PMS sync every 10 seconds.
  - `components/layout/page-auto-refresh.tsx` refreshes the Reservations and Guests dashboard pages every 10 seconds so background sync changes become visible without manual reload.
- Tasks 9-13 remain pending.

**Update (2026-04-12):**

- Added hybrid post-stay feedback web-form flow (`lib/automation/feedback-link.ts`, `app/feedback/[token]/page.tsx`, `app/api/feedback/submit/route.ts`).
- Added Feedback Monitor dashboard page (`app/(dashboard)/feedback/page.tsx`, `components/feedback/feedback-monitor-table.tsx`) with detail modal for full comments and link visibility.
- Added WAHA inbound follow-up webhook (`app/api/webhooks/waha/route.ts`) and AI tool-calling in `lib/ai/agent.ts`.
- Added automated 24-hour escalation module (`lib/automation/feedback-escalation.ts`) from `post_stay_feedback_status='pending'` to `ai_followup`.
- Added configurable AI follow-up template trigger `post-stay-ai-followup` (schema + migration `20260412001000_add_post_stay_ai_followup_template_trigger.sql`) to remove hardcoded kickoff message content.
- Added route-level tests to validate `aiFollowupEscalated` summary responses on both `/api/cron/automation` and `/api/dev/scheduler`.

---

- [x] **Task 1: Add Phase 4 schema migration** (Complete)

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

**Step 5: Checkpoint**

Confirm the migration file and `schema.sql` stay aligned before moving to the next task.

---

- [x] **Task 2: Add automation domain types and pure helpers** (Complete)

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

**Step 5: Checkpoint**

Confirm helper APIs are stable enough for webhook ingestion and scheduler use.

---

- [x] **Task 3: Add retry policy with pure tests** (Complete)

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

**Step 5: Checkpoint**

Confirm retry policy outputs are deterministic and match the accepted design.

---

- [x] **Task 4: Add queue claim and lifecycle helpers** (Complete)

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

**Step 5: Checkpoint**

Confirm the queue helper API supports both webhook-driven jobs and scheduler-driven jobs.

---

- [x] **Task 5: Add template rendering and delivery guards** (Complete)

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

**Step 5: Checkpoint**

Confirm rendering and delivery guards are reusable by both automation and AI-assisted flows.

---

- [x] **Task 6: Implement PMS webhook ingestion route** (Complete)

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

**Step 5: Checkpoint**

Confirm duplicate ingestion is blocked without suppressing legitimate status changes.

---

- [x] **Task 7: Implement status-trigger orchestration** (Complete)

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

**Step 5: Checkpoint**

Confirm `on-stay` behavior only fires on the first valid transition and that send state is recorded correctly.

---

- [x] **Task 8: Implement scheduler module and cron automation worker route** (Complete)

**Files:**

- Create: `app/api/cron/automation/route.ts`
- Create: `lib/automation/scheduler.ts`
- Test: `tests/integration/app/api/cron/automation/route.test.ts`
- Test: `tests/integration/lib/automation/scheduler.test.ts`

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

Implement route and scheduler logic to:

- validate cron secret
- find reservations eligible for `pre-arrival` and `post-stay`
- enqueue missing jobs idempotently
- mark post-stay feedback follow-up candidates as pending where needed
- claim due jobs
- process them through `status-trigger.ts`
- return a structured batch summary

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Checkpoint**

Confirm scheduled jobs are created once per eligible reservation and trigger.

---

### Task 9: Implement post-stay AI follow-up orchestration

**Files:**

- Create: `lib/ai/agent.ts`
- Test: `tests/integration/lib/ai/agent.test.ts`

**Step 1: Write the failing integration test**

Cover:

- follow-up only starts for reservations whose post-stay feedback remains pending past the timeout window
- guest and reservation context are loaded before the AI call
- structured feedback updates reservation fields consistently

**Step 2: Run test to verify it fails**

Expected: FAIL because agent orchestration does not exist.

**Step 3: Write minimal implementation**

Implement orchestration that:

- resolves eligible pending post-stay follow-up candidates
- prepares contextual prompt input from guest and reservation history
- writes structured feedback back into reservation records through a narrow update API

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Checkpoint**

Confirm follow-up only activates after the reliable message path and pending-state checks succeed.

---

### Task 10: Implement on-stay AI agent and tools

**Files:**

- Create: `lib/ai/on-stay-agent.ts`
- Create: `lib/ai/tools.ts`
- Test: `tests/integration/lib/ai/on-stay-agent.test.ts`

**Step 1: Write the failing integration test**

Cover:

- room service requests create `room_service_orders`
- housekeeping requests create `housekeeping_requests`
- unsupported or ambiguous requests escalate cleanly

**Step 2: Run test to verify it fails**

Expected: FAIL because the on-stay agent and tools do not exist.

**Step 3: Write minimal implementation**

Implement:

- request classification for room service, housekeeping, and concierge
- tool functions that insert operational records safely
- escalation behavior for requests the automation should not fulfill directly

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Checkpoint**

Confirm all created operational records remain tenant-safe and tied to the active reservation when available.

---

### Task 11: Implement operations dashboard

**Files:**

- Create: `app/(dashboard)/operations/page.tsx`
- Create: `components/operations/housekeeping-table.tsx`
- Create: `components/operations/room-service-table.tsx`
- Test: `tests/integration/app/(dashboard)/operations/page.test.tsx`

**Step 1: Write the failing integration test**

Cover:

- staff can view housekeeping and room service requests for their tenant
- status update actions are restricted to tenant members
- records created by AI flows appear in the dashboard tables

**Step 2: Run test to verify it fails**

Expected: FAIL because the dashboard files do not exist.

**Step 3: Write minimal implementation**

Implement:

- a dashboard page under the operations section
- housekeeping and room service tables
- status update actions for operational records

**Step 4: Run test to verify it passes**

Expected: PASS.

**Step 5: Checkpoint**

Confirm the dashboard reflects the AI-generated operational workflow without introducing cross-tenant access.

---

### Task 12: Update operational documentation

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

**Step 4: Checkpoint**

Confirm runbook steps match the final routes, job states, and AI-assisted workflows.

---

### Task 13: Full verification pass

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
- post-stay pending follow-up path
- on-stay AI request creation path
- operations dashboard visibility path

Expected: one message send, one completed job, no duplicate sends.

**Step 4: Checkpoint**

Summarize verification output and any remaining known gaps without creating a commit.

---

## Notes for Execution

- Keep webhook handlers thin
- Prefer pure functions for rendering, retry, and idempotency
- Reuse `createAdminClient()` for all background database writes
- Do not add external queue infrastructure for MVP
- Keep batch processing small at first, for example 10 jobs per cron run
- Do not create git commits unless the user explicitly asks for one

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
8. scheduler and cron route
9. post-stay AI follow-up
10. on-stay AI tools
11. operations dashboard
12. docs
13. verification
