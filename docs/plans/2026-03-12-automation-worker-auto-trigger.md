# Automation Worker Auto-Trigger Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the automation worker run automatically in both local development and Vercel production without breaking the existing queue-based automation architecture.

**Architecture:** Extract the current automation cron logic into a reusable worker core, keep the route handler as an authenticated HTTP wrapper, add a local development scheduler that runs the worker core in-process, and add Vercel Cron configuration for production. Status-change ingestion remains enqueue-only.

**Tech Stack:** Next.js App Router, TypeScript, Vercel Cron, Vitest, Supabase-backed queue processing.

---

### Task 1: Extract a Reusable Automation Worker Core

**Files:**

- Create: `lib/automation/automation-cron.ts`
- Modify: `app/api/cron/automation/route.ts`
- Test: `tests/integration/app/api/cron/automation/route.test.ts`

**Step 1: Write the failing test**

Add a test that proves the route delegates to a reusable worker helper rather than containing the processing logic inline.

```ts
it("delegates authorized requests to the automation cron runner", async () => {
  mocks.runAutomationCronMock.mockResolvedValue({
    processed: 1,
    retried: 0,
    deadLettered: 0,
    preArrivalEnqueued: 0,
    postStayEnqueued: 0,
  });

  const response = await GET(
    new Request("http://localhost/api/cron/automation", {
      method: "GET",
      headers: { authorization: "Bearer cron-secret" },
    }),
  );

  expect(response.status).toBe(200);
  expect(mocks.runAutomationCronMock).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/integration/app/api/cron/automation/route.test.ts`

Expected: FAIL because `runAutomationCron` does not exist and the route still contains the worker logic inline.

**Step 3: Write minimal implementation**

Create `lib/automation/automation-cron.ts` that exports `runAutomationCron(now = new Date())` and move the current job-processing logic there.

```ts
export async function runAutomationCron(now = new Date()) {
  const scheduled = await enqueueScheduledAutomationJobs(now);
  const jobs = await claimAutomationJobs(BATCH_SIZE, WORKER_ID);
  // process jobs and return summary
}
```

Update the route to keep only auth and JSON response behavior.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/integration/app/api/cron/automation/route.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add app/api/cron/automation/route.ts lib/automation/automation-cron.ts tests/integration/app/api/cron/automation/route.test.ts
git commit -m "refactor: extract automation cron worker"
```

### Task 2: Add Dedicated Tests for the Worker Core

**Files:**

- Create: `tests/unit/lib/automation/automation-cron.test.ts`
- Modify: `lib/automation/automation-cron.ts`

**Step 1: Write the failing tests**

Add focused tests for worker summary behavior.

```ts
it("counts successful processed jobs", async () => {
  claimAutomationJobsMock.mockResolvedValue([
    { id: "job-1", payload: {}, tenantId: "tenant-1", triggerType: "on-stay" },
  ]);
  processStatusTriggerJobMock.mockResolvedValue(undefined);

  const result = await runAutomationCron(new Date("2026-03-12T00:00:00.000Z"));

  expect(result.processed).toBe(1);
  expect(result.retried).toBe(0);
  expect(result.deadLettered).toBe(0);
});
```

Add similar failing tests for retryable failures and dead-letter failures.

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/automation/automation-cron.test.ts`

Expected: FAIL until the helper is fully wired and exported.

**Step 3: Write minimal implementation**

Complete the helper implementation with the existing queue, retry, and dead-letter behavior.

```ts
for (const job of jobs) {
  try {
    await processStatusTriggerJob(toStatusTriggerJob(job));
    processed += 1;
  } catch (error) {
    // classify, reschedule, or dead-letter
  }
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/automation/automation-cron.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/automation/automation-cron.ts tests/unit/lib/automation/automation-cron.test.ts
git commit -m "test: cover automation cron worker behavior"
```

### Task 3: Add a Development Automation Scheduler

**Files:**

- Create: `lib/automation/dev-automation-scheduler.ts`
- Create: `tests/unit/lib/automation/dev-automation-scheduler.test.ts`
- Reference: `lib/pms/dev-sync-scheduler.ts`

**Step 1: Write the failing tests**

Mirror the PMS scheduler behavior with automation-specific names.

```ts
it("starts once in development, runs immediately, and repeats every 10 seconds by default", async () => {
  const runWorker = vi.fn().mockResolvedValue(undefined);

  const result = startDevelopmentAutomationScheduler({
    runWorker,
    environment: { nodeEnv: "development", nextRuntime: "nodejs" },
  });

  await vi.runAllTicks();

  expect(result.started).toBe(true);
  expect(runWorker).toHaveBeenCalledTimes(1);
});
```

Add tests for duplicate-start protection and non-development disablement.

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/automation/dev-automation-scheduler.test.ts`

Expected: FAIL because the scheduler module does not exist yet.

**Step 3: Write minimal implementation**

Implement the new scheduler with:

- `DEFAULT_INTERVAL_MS`
- `shouldStartScheduler()`
- `resolveIntervalMs()`
- `isRunning` overlap guard
- `resetDevelopmentAutomationSchedulerForTests()`

Use `runAutomationCron` as the default runner.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/automation/dev-automation-scheduler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add lib/automation/dev-automation-scheduler.ts tests/unit/lib/automation/dev-automation-scheduler.test.ts
git commit -m "feat: add development automation scheduler"
```

### Task 4: Register the Automation Scheduler in Local Startup

**Files:**

- Modify: `instrumentation.ts`
- Test: `tests/unit/lib/automation/dev-automation-scheduler.test.ts`
- Test: `tests/unit/lib/pms/dev-sync-scheduler.test.ts`

**Step 1: Write the failing test**

Add a test that verifies the instrumentation register hook starts both the PMS scheduler and the automation scheduler in node runtime.

```ts
it("starts both development schedulers in node runtime", async () => {
  await register();

  expect(startDevelopmentPmsSyncSchedulerMock).toHaveBeenCalledTimes(1);
  expect(startDevelopmentAutomationSchedulerMock).toHaveBeenCalledTimes(1);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/instrumentation.test.ts`

Expected: FAIL because `instrumentation.ts` only starts the PMS scheduler today.

**Step 3: Write minimal implementation**

Update the register hook to import and start both development schedulers.

```ts
const { startDevelopmentPmsSyncScheduler } =
  await import("./lib/pms/dev-sync-scheduler");
const { startDevelopmentAutomationScheduler } =
  await import("./lib/automation/dev-automation-scheduler");

startDevelopmentPmsSyncScheduler();
startDevelopmentAutomationScheduler();
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/instrumentation.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add instrumentation.ts tests/unit/instrumentation.test.ts
git commit -m "feat: start automation scheduler in development"
```

### Task 5: Add Local Configuration for Worker Cadence

**Files:**

- Modify: `.env.local.example`
- Modify: `lib/automation/dev-automation-scheduler.ts`
- Modify: `docs/plan.md`

**Step 1: Write the failing test**

Add or extend a scheduler test that proves the interval can be read from `DEV_AUTOMATION_SYNC_INTERVAL_MS`.

```ts
it("uses DEV_AUTOMATION_SYNC_INTERVAL_MS when provided", async () => {
  const runWorker = vi.fn().mockResolvedValue(undefined);

  const result = startDevelopmentAutomationScheduler({
    runWorker,
    environment: {
      nodeEnv: "development",
      nextRuntime: "nodejs",
      intervalMs: "5000",
    },
  });

  expect(result.intervalMs).toBe(5000);
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/unit/lib/automation/dev-automation-scheduler.test.ts`

Expected: FAIL until the env-driven interval is implemented.

**Step 3: Write minimal implementation**

Wire the scheduler to read `DEV_AUTOMATION_SYNC_INTERVAL_MS` and document it in the example env file and plan notes.

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/unit/lib/automation/dev-automation-scheduler.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add .env.local.example lib/automation/dev-automation-scheduler.ts docs/plan.md
git commit -m "docs: add development automation scheduler config"
```

### Task 6: Add Vercel Cron Configuration for Production

**Files:**

- Create: `vercel.json`
- Modify: `docs/plan.md`
- Optionally Modify: `README.md`

**Step 1: Write the failing check**

Confirm the production scheduler config is absent.

Run: `rg --files -g "vercel.json"`

Expected: no output.

**Step 2: Write minimal implementation**

Create `vercel.json` with cron entries similar to:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/pms-sync",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/automation",
      "schedule": "* * * * *"
    }
  ]
}
```

**Step 3: Run verification**

Run: `type vercel.json`

Expected: the file exists and contains both cron entries.

**Step 4: Commit**

```bash
git add vercel.json docs/plan.md README.md
git commit -m "chore: add vercel cron configuration"
```

### Task 7: Run Focused Verification

**Files:**

- Test: `tests/integration/app/api/cron/automation/route.test.ts`
- Test: `tests/unit/lib/automation/automation-cron.test.ts`
- Test: `tests/unit/lib/automation/dev-automation-scheduler.test.ts`
- Test: `tests/unit/instrumentation.test.ts`

**Step 1: Run focused test suite**

Run: `pnpm test tests/integration/app/api/cron/automation/route.test.ts tests/unit/lib/automation/automation-cron.test.ts tests/unit/lib/automation/dev-automation-scheduler.test.ts tests/unit/instrumentation.test.ts`

Expected: PASS.

**Step 2: Run build verification**

Run: `pnpm build`

Expected: PASS.

**Step 3: Manual local smoke check**

Run the app in development and confirm:

- a newly enqueued `automation_jobs` row transitions out of `pending` without manual Postman calls
- the local console shows the automation scheduler starting once

**Step 4: Commit**

```bash
git add .
git commit -m "test: verify automatic automation worker flow"
```
