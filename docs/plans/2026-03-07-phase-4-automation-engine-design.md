# Phase 4 Automation Engine Design

## Goal

Build a reliable Phase 4 automation pipeline that ingests PMS webhook events from QloApps, deduplicates them safely, enqueues asynchronous automation jobs, sends WhatsApp messages through WAHA, and records complete delivery state for audit and retry.

## Scope

This design covers:

- PMS webhook ingestion for QloApps
- Idempotent event persistence
- Database-backed job queue processing
- Status-based trigger resolution for `pre-arrival`, `on-stay`, and `post-stay`
- WAHA delivery orchestration
- Scheduled trigger orchestration through a dedicated scheduler module
- Post-stay AI follow-up orchestration after the initial automated message
- On-stay AI workflows for room service, housekeeping, and concierge requests
- Operations dashboard support for staff-facing operational requests
- Retry and dead-letter behavior
- Observability and test strategy

This design does not cover:

- External queue infrastructure such as Redis, SQS, or RabbitMQ

Manual send remains deferred to Phase 6 per the master plan.

## Current Project Context

Existing foundations already support this work:

- `reservations`, `inbound_events`, `automation_jobs`, and `message_logs` exist in the database schema
- PMS sync now normalizes reservation records through `lib/pms/auto-sync-service.ts` and `app/api/cron/pms-sync/route.ts`
- WAHA transport exists in `lib/waha/client.ts`
- Template management and multilingual variants already exist
- Structured logging is available in `lib/observability/logger.ts`

Because these pieces already exist, Phase 4 should extend the current architecture instead of introducing a parallel messaging subsystem.

## Key Decisions

### PMS target

The first production webhook target is QloApps.

### Execution model

Use an async queue only model:

- webhook route validates and persists quickly
- actual automation processing happens in worker-style cron execution
- WAHA sends never happen inline in the webhook request

### Idempotency key

Use a derived key based on reservation lifecycle data:

- `idempotency_key = sha256("${booking_id}:${status}:${updated_at}")`

This is preferred over a provider-native event id because QloApps event identity may not be stable enough for retries. It is also preferred over hashing the full payload because unrelated payload field changes should not create a new automation event.

If `updated_at` is unavailable in a payload, the system can fall back to a payload hash as a degraded path.

## High-Level Architecture

1. QloApps sends a webhook to `app/api/webhooks/pms/route.ts`
2. The route reads the raw body, validates the secret or signature, normalizes the payload, computes the idempotency key, and inserts an event record
3. The route enqueues an `automation_jobs` record and returns `200` quickly
4. A cron route at `app/api/cron/automation/route.ts` claims due jobs from Postgres using `FOR UPDATE SKIP LOCKED`
5. `lib/automation/scheduler.ts` determines which scheduled `pre-arrival` and `post-stay` jobs should exist and enqueues them idempotently
6. `lib/automation/status-trigger.ts` resolves the trigger, template, guest, and reservation state
7. The system renders the message, writes a `message_logs` draft row, sends the message through `lib/waha/client.ts`, and updates message and job state
8. Retry policy reschedules eligible failures and moves terminal failures to dead-letter
9. Post-stay and on-stay AI handlers consume the same reservation and guest context after the reliable messaging core is in place

## Trigger Rules

### `pre-arrival`

Scheduled by cron using the default window:

- H-1 at 10:00 local tenant time

### `on-stay`

Triggered by webhook-driven status transition:

- sent once when a reservation first transitions to `on-stay`
- still processed asynchronously through the queue

### `post-stay`

Scheduled by cron using the default window:

- H+1 at 10:00 local tenant time

## Transition Guards

A message should not send when any of the following are true:

- guest phone number is missing
- no active template exists for the trigger
- a successful send already exists for the same reservation and trigger
- the incoming event is older than the latest known reservation state

## Database Changes

A new migration should extend the existing schema.

### `inbound_events`

Add:

- `idempotency_key TEXT NOT NULL`
- `source TEXT NOT NULL DEFAULT 'qloapps'`
- `signature_valid BOOLEAN`
- `payload_hash TEXT NOT NULL`
- `received_at TIMESTAMPTZ DEFAULT NOW()`
- `processed_at TIMESTAMPTZ`
- `processing_error TEXT`

Add unique constraint:

- `UNIQUE(tenant_id, idempotency_key)`

### `automation_jobs`

Add:

- `trigger_type TEXT NOT NULL`
- `available_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `locked_at TIMESTAMPTZ`
- `locked_by TEXT`
- `last_error_category TEXT`
- `message_log_id UUID REFERENCES message_logs(id) ON DELETE SET NULL`

Add indexes:

- `(status, available_at)`
- `(tenant_id, status, available_at)`

### `message_logs`

Add:

- `trigger_type TEXT`
- `template_language_code TEXT`
- `automation_job_id UUID REFERENCES automation_jobs(id) ON DELETE SET NULL`
- `provider_message_id TEXT`
- `provider_response JSONB`

## File-by-File Design

### `app/api/webhooks/pms/route.ts`

Responsibilities:

- accept raw webhook requests
- verify secret or signature
- normalize QloApps payload to internal event shape
- compute `idempotency_key` and `payload_hash`
- insert into `inbound_events`
- create an `automation_jobs` row
- return success immediately

This route must stay thin and avoid calling WAHA directly.

### `lib/automation/status-trigger.ts`

Responsibilities:

- orchestrate trigger processing for queued jobs
- resolve reservation, guest, tenant, and template state
- decide whether the event still qualifies for delivery
- render template variables
- create and update `message_logs`
- call WAHA transport
- update inbound event and job processing state

### `lib/automation/queue.ts`

Responsibilities:

- claim jobs using `FOR UPDATE SKIP LOCKED`
- mark claimed jobs as `processing`
- complete jobs on success
- reschedule retryable jobs
- mark terminal jobs as `dead-letter`

### `lib/automation/retry-policy.ts`

Responsibilities:

- classify failures into `validation`, `integration`, `retryable`, or `fatal`
- compute deterministic backoff windows
- decide when retries are exhausted

Recommended backoff progression:

- attempt 1: 1 minute
- attempt 2: 5 minutes
- attempt 3: 15 minutes
- attempt 4: 1 hour

### `app/api/cron/automation/route.ts`

Responsibilities:

- authenticate scheduler access with a cron secret
- delegate scheduling decisions to `lib/automation/scheduler.ts`
- claim and process a small batch of pending jobs
- return a batch summary for monitoring

### `lib/automation/scheduler.ts`

Responsibilities:

- find reservations eligible for `pre-arrival` and `post-stay`
- avoid duplicate scheduled jobs or duplicate successful sends
- prepare follow-up checks for post-stay feedback escalation

### `lib/ai/agent.ts`

Responsibilities:

- drive the post-stay AI follow-up after the H+1 automated message
- use reservation and guest history as context input
- summarize guest feedback into structured fields

### `lib/ai/on-stay-agent.ts` and `lib/ai/tools.ts`

Responsibilities:

- parse inbound on-stay guest requests
- create `room_service_orders` or `housekeeping_requests`
- answer concierge-style questions or escalate to a human

### `app/(dashboard)/operations/page.tsx`

Responsibilities:

- display staff-facing operational queues for housekeeping and room service
- allow staff to update request status safely within tenant boundaries

## Error Handling

Use four categories:

- `validation`
- `integration`
- `retryable`
- `fatal`

Job state rules:

- `validation` and `fatal` failures go directly to `dead-letter`
- retryable failures are rescheduled by setting a future `available_at`
- success marks the job `completed`

## Observability

Every meaningful log entry should include:

- `request_id`
- `tenant_id`
- `event_id` or `idempotency_key`
- `reservation_id`
- `job_id`
- `message_log_id`

Key log points:

1. webhook received
2. signature validation result
3. dedupe hit or miss
4. job created
5. job claimed
6. template resolved
7. WAHA send started
8. WAHA send finished
9. retry scheduled or dead-letter recorded

## Testing Strategy

### Unit tests

Cover:

- retry backoff calculations
- idempotency key generation
- status transition rules
- template rendering guards

### Integration tests

Cover:

- valid webhook inserts event and job
- duplicate webhook does not create a second job
- cron processing claims only eligible jobs
- WAHA temporary failure triggers reschedule
- WAHA success updates `message_logs` and `automation_jobs`
- scheduler enqueues `pre-arrival` and `post-stay` jobs once
- on-stay AI tool calls create housekeeping and room service records

### Contract tests

Cover:

- QloApps payload normalization
- field mapping for `booking_id`, `status`, `updated_at`, guest phone, and stay dates

### Workflow tests

Cover:

- H+1 post-stay message sets feedback state to pending
- follow-up escalation waits for the configured timeout before invoking AI
- staff can see and update AI-generated operational requests from the dashboard

## Acceptance Criteria

- duplicate webhook payloads do not create duplicate sends
- `on-stay` sends exactly once on first valid transition
- `pre-arrival` and `post-stay` are scheduled in the expected window
- retryable WAHA failures are rescheduled with backoff
- exhausted failures move to dead-letter
- each message attempt is traceable through event, job, and log records

## Recommendation Summary

The recommended MVP implementation is a Postgres-backed queue with asynchronous cron-driven processing. This keeps webhook latency low, reuses the existing schema and WAHA client, and gives the project a reliable foundation for future AI and manual-send features.

The execution order should still prioritize the reliable delivery core first, then layer scheduler behavior, then AI workflows, then the operations dashboard.
