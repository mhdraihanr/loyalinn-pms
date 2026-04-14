# Automation Worker Auto-Trigger Design

**Date:** 2026-03-12

**Goal:** Keep the automation architecture queue-based while making the automation worker run automatically in both local development and Vercel production.

## Context

The current architecture already separates ingestion from delivery correctly:

- PMS webhook ingestion and PMS polling enqueue rows in `automation_jobs`
- The automation worker claims due jobs and processes them through the status trigger pipeline
- In development, only PMS sync is auto-scheduled from `instrumentation.ts`
- In production, there is currently no checked-in cron configuration for the automation worker

This leaves a gap where status changes enqueue jobs successfully, but those jobs remain `pending` until `/api/cron/automation` is called manually.

## Chosen Approach

Use a reusable queue worker core plus environment-specific triggers:

- **Local development:** start a development-only scheduler that calls the worker core directly in-process
- **Vercel production:** keep the authenticated cron route and schedule it through `vercel.json`

This preserves the queue boundary and avoids mixing delivery execution into webhook or polling requests.

## Rejected Alternatives

### 1. Process automation immediately during webhook/polling

Rejected because it breaks the queue boundary, increases request latency, and couples WAHA reliability directly to PMS ingestion.

### 2. Self-call `/api/cron/automation` after each enqueue

Rejected because it adds unnecessary HTTP coupling, depends on local server reachability, complicates auth handling, and is more fragile than a direct in-process call for development.

## Architecture Changes

### 1. Extract worker core

Move the non-HTTP automation worker logic into a reusable function, for example `runAutomationCron(now?: Date)`.

Responsibilities:

- enqueue scheduled `pre-arrival` and `post-stay` jobs
- claim a batch of due `automation_jobs`
- map claimed DB rows to the status trigger input shape
- process each claimed job
- apply retry and dead-letter policy
- return a summary payload equivalent to the current route response

### 2. Keep route handler as authenticated wrapper

`app/api/cron/automation/route.ts` remains the public production entrypoint. It should only:

- validate `Authorization: Bearer ${CRON_SECRET}`
- call `runAutomationCron()`
- return `NextResponse.json(result)`

### 3. Add a development automation scheduler

Create `lib/automation/dev-automation-scheduler.ts` with the same operational model as the existing PMS development scheduler:

- dev-only
- node-runtime only
- immediate first run
- interval-driven subsequent runs
- single active scheduler per process
- overlap protection with an `isRunning` guard

The scheduler should call the worker core directly rather than performing an HTTP request to localhost.

### 4. Register both local schedulers from instrumentation

`instrumentation.ts` should start:

- the PMS sync scheduler
- the automation worker scheduler

This keeps local development behavior automatic without changing route behavior.

### 5. Add Vercel production cron configuration

Create `vercel.json` with cron entries for:

- `/api/cron/pms-sync`
- `/api/cron/automation`

Recommended initial schedules:

- PMS sync: every 5 minutes
- Automation worker: every 1 minute

This keeps queue drain frequency higher than sync frequency, which reduces time spent in `pending` after new status-trigger jobs are enqueued.

## Data Flow

### Local development

1. A webhook or PMS polling run writes a row into `automation_jobs`
2. The in-process development automation scheduler calls `runAutomationCron()`
3. The worker claims due jobs and processes them
4. Job status becomes `completed`, `failed`, or `dead-letter`

### Vercel production

1. A webhook or PMS polling run writes a row into `automation_jobs`
2. Vercel Cron calls `GET /api/cron/automation` with the bearer secret
3. The route validates the secret and delegates to `runAutomationCron()`
4. The worker claims due jobs and processes them
5. Job status becomes `completed`, `failed`, or `dead-letter`

## Configuration

Add a dedicated local interval environment variable:

- `DEV_AUTOMATION_SYNC_INTERVAL_MS`

This should be independent from `DEV_PMS_SYNC_INTERVAL_MS` so worker cadence can be tuned separately.

## Testing Strategy

### Worker core

Add or adapt tests to verify:

- scheduled jobs are enqueued before claiming
- claimed jobs are mapped correctly
- successful jobs increment `processed`
- retryable failures increment `retried`
- terminal failures increment `deadLettered`

### Development scheduler

Add unit tests mirroring the PMS scheduler tests:

- starts only in `development` + `nodejs`
- runs immediately once started
- respects the configured interval
- does not register multiple schedulers
- avoids overlapping runs when the previous run is still active

### Route wrapper

Retain route-level tests for:

- unauthorized requests
- successful delegation to the worker core

## Operational Notes

- The worker remains queue-based. Status-change ingestion must continue to only enqueue work.
- The development scheduler is for local ergonomics only and must not be treated as the production trigger mechanism.
- Vercel production should continue to use the route entrypoint with `CRON_SECRET` authentication.

## Out of Scope

- changing retry policy semantics
- changing WAHA delivery behavior
- processing automation inline during webhook ingestion
- introducing a long-running background worker for production
