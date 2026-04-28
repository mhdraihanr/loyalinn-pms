# AI Token Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce Gemini token usage across lifecycle and post-stay AI flows without materially degrading reply quality or tool-calling reliability.

**Architecture:** Introduce a shared AI context-budgeting helper that trims long chat history before model calls, keeping the newest messages and optionally injecting a compact system summary when older context exists. Then shorten repeated lifecycle prompts, add lightweight token/step observability from AI SDK responses, and document the new behavior and tuning knobs.

**Tech Stack:** Next.js App Router, Vercel AI SDK (`generateText`), Gemini via `@ai-sdk/google`, Vitest, Supabase.

---

### Task 1: Shared AI Context Budgeting Helper

**Files:**
- Create: `lib/ai/context-budget.ts`
- Test: `tests/unit/lib/ai/context-budget.test.ts`

**Step 1: Write the failing test**

Add tests for:
- returning the original history when message count is already within budget
- keeping only the most recent messages when history exceeds the budget
- prepending a compact summary system message when older messages are trimmed and a summary is provided
- ignoring blank summaries so we do not spend tokens on empty prefix text

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/ai/context-budget.test.ts`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Implement a helper shaped roughly like:

```ts
buildBudgetedMessageHistory({
  messages,
  maxRecentMessages,
  trimmedSummary,
})
```

Rules:
- preserve message ordering
- if trimming is not needed, return original messages
- if trimming happens and `trimmedSummary` is non-empty, prepend one `system` message
- do not mutate the input array

**Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/lib/ai/context-budget.test.ts`

Expected: PASS

### Task 2: Apply Context Budgeting to Lifecycle + Post-Stay Calls

**Files:**
- Modify: `app/api/webhooks/waha/route.ts`
- Modify: `lib/ai/on-stay-agent.ts`
- Modify: `lib/ai/pre-arrival-agent.ts`
- Modify: `lib/ai/agent.ts`
- Test: `tests/unit/lib/ai/context-budget.test.ts`

**Step 1: Write the failing test**

Extend `tests/unit/lib/ai/context-budget.test.ts` with one integration-style unit test that proves a long conversation becomes:
- one system summary message (when provided)
- plus only the configured recent tail

The point of this test is to lock the message-shape contract that the agents will consume.

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/ai/context-budget.test.ts`

Expected: FAIL because the helper contract is not yet complete.

**Step 3: Write minimal implementation**

In `app/api/webhooks/waha/route.ts`:
- after loading `rawLogs`, convert them into a full `messageHistory`
- pass that history through the shared budgeting helper before calling lifecycle/post-stay AI functions
- keep the newest messages only (balanced default: 8 recent messages)
- if trimming occurs, prepend one compact system summary like:
  - Indonesian: `Ringkasan percakapan sebelumnya: ...`
  - English: `Summary of earlier conversation: ...`
- initial version may use a deterministic textual summary built from count + short snippet of earlier user/assistant messages, not a second LLM call

Rules:
- no extra AI summarization request
- preserve current DB logging behavior
- preserve tool-calling behavior

**Step 4: Run targeted verification**

Run:
- `npx vitest run tests/unit/lib/ai/context-budget.test.ts`

Expected: PASS

### Task 3: Compact Repeated Lifecycle Prompts and Add AI Usage Observability

**Files:**
- Modify: `lib/ai/on-stay-agent.ts`
- Modify: `lib/ai/pre-arrival-agent.ts`
- Modify: `lib/ai/agent.ts`
- Test: `tests/unit/lib/ai/lifecycle-stage-agents.test.ts`

**Step 1: Write the failing test**

Add/adjust tests so they assert:
- lifecycle agents still call `generateText`
- observability logs still happen with debug enabled
- prompt compaction does not remove the key tool-routing rules that matter for behavior

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/lib/ai/lifecycle-stage-agents.test.ts`

Expected: FAIL for the changed expectation if prompt/logging shape is not yet updated.

**Step 3: Write minimal implementation**

In the three AI modules:
- shorten repeated prose in system prompts while keeping:
  - tool routing
  - refusal prohibition
  - “always confirm after tool success” rule
- add debug logging for:
  - step count
  - tool call count
  - estimated message count passed to model
  - usage metadata if available from AI SDK result (`usage`, provider metadata, or both)

Constraints:
- do not add new provider-specific billing code
- do not remove existing fallback safety nets
- keep current stage behavior intact

**Step 4: Run targeted verification**

Run: `npx vitest run tests/unit/lib/ai/lifecycle-stage-agents.test.ts tests/unit/lib/ai/fallback-reply.test.ts`

Expected: PASS

### Task 4: Update Docs

**Files:**
- Modify: `docs/plan.md`
- Modify: `docs/phase-4/2026-04-22-operations-dashboard.md`
- Optionally modify: other related docs under `docs/` if the final implementation changes operational guidance

**Step 1: Update docs**

Document:
- lifecycle AI now uses history budgeting instead of full chat replay
- prompt guidance was compacted to reduce repeated token spend
- debug/observability can be used to inspect token/step usage
- operations dashboard behavior is unchanged, but AI requests now depend on budgeted context instead of full transcript replay

**Step 2: Run verification**

Run:
- `npx vitest run tests/unit/lib/ai/context-budget.test.ts tests/unit/lib/ai/provider.test.ts tests/unit/lib/ai/fallback-reply.test.ts`
- `npx eslint lib/ai/context-budget.ts lib/ai/on-stay-agent.ts lib/ai/pre-arrival-agent.ts lib/ai/agent.ts tests/unit/lib/ai/context-budget.test.ts tests/unit/lib/ai/lifecycle-stage-agents.test.ts`

Expected: PASS / clean output
