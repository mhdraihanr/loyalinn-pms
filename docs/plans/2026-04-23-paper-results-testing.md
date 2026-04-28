# Paper Results Testing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Collect verifiable automated evidence for the conference-paper metrics and update `conference-paper/result-sheet.md` with values that are actually supported by fresh test or command output.

**Architecture:** Use the existing test suite and project documentation as the primary evidence source. First, identify which `result-sheet.md` placeholders can be backed directly by automated tests and repository state. Then run focused test commands for reliability and lifecycle scenarios, extract counts from fresh output, and write only the metrics that are verifiable now. Leave live-environment-only metrics clearly marked for later manual experiments.

**Tech Stack:** Node.js, pnpm, Vitest, Next.js test suite, Markdown docs, shell commands.

---

### Task 1: Inspect Test Surface

**Files:**
- Read: `conference-paper/result-sheet.md`
- Read: `package.json`
- Read: `docs/2026-04-17-conference-paper-urgent-plan.md`
- Search: `tests/**`

**Step 1: Identify which paper scenarios map to existing tests**
- S1 PMS sync -> pre-arrival
- S2 duplicate webhook
- S3 retry recovery
- S4 post-stay AI / context budgeting
- S5 on-stay operations

**Step 2: Identify which placeholders require live runs**
- token usage from Gemini provider metadata
- latency p95 from runtime timing
- realtime delay metrics

### Task 2: Run Focused Evidence Commands

**Files:**
- Run tests only; do not modify implementation code

**Step 1: Run a focused reliability/lifecycle suite**
Run the set that best covers S1-S5 with existing automated evidence.

**Step 2: Run the full current test suite only if the focused suite is stable enough and runtime is acceptable**

**Step 3: Capture counts and exact command strings**

### Task 3: Update Result Sheet Carefully

**Files:**
- Modify: `conference-paper/result-sheet.md`

**Step 1: Fill only evidence-backed fields**
- total test files
- total unit/integration files
- total tests passed/failed for the command actually run
- scenario summary fields that can be inferred directly from tests/docs

**Step 2: Mark unsupported metrics explicitly**
Use placeholders like:
- `PENDING_LIVE_RUN`
- `PENDING_GEMINI_USAGE_LOG`
- `PENDING_RUNTIME_MEASUREMENT`

### Task 4: Verify Before Claiming

**Files:**
- Read: `conference-paper/result-sheet.md`

**Step 1: Re-run the final proving command**
Use the exact test command whose results are cited in the final report.

**Step 2: Confirm the result sheet matches fresh evidence**
