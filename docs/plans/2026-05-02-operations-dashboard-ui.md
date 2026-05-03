# Operations Dashboard UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the operations dashboard visually consistent with the other dashboard pages while preserving existing operations data and actions.

**Architecture:** Keep server-side data loading in `app/(dashboard)/operations/page.tsx`, add page-level summary presentation there, and keep tab/table interaction in `components/operations/operations-tabs.tsx`. Use existing Mantine components and `PageAutoRefresh` patterns already used by guests, reservations, and feedback pages.

**Tech Stack:** Next.js App Router, React 19, Mantine 8, Tabler icons, Vitest, TypeScript.

---

### Task 1: Add a focused UI regression test

**Files:**

- Create or modify: `tests/unit/operations-dashboard-ui.test.ts`
- Read: `app/(dashboard)/operations/page.tsx`
- Read: `components/operations/operations-tabs.tsx`

**Step 1: Write the failing test**

Create a unit test that reads the operations page and tabs source and asserts the new consistency markers exist:

- operations page imports and renders `PageAutoRefresh`
- operations page uses Mantine `Card` and `SimpleGrid` for page shell and summary cards
- operations page includes a dimmed subtitle mentioning operational workload
- operations tabs render Tabler icons via `leftSection`
- operations tabs include count badges for each tab

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/operations-dashboard-ui.test.ts`
Expected: FAIL because the current page does not yet contain the summary cards, auto-refresh wrapper, or icon/count tab UI.

**Step 3: Keep the failing test unchanged**

Do not alter expected behavior after confirming the test fails correctly.

---

### Task 2: Update operations page layout

**Files:**

- Modify: `app/(dashboard)/operations/page.tsx`

**Step 1: Replace the minimal page shell**

Update imports to use Mantine `Badge`, `Card`, `Group`, `SimpleGrid`, `Stack`, `Text`, and `Title`, add `PageAutoRefresh`, and use `getCurrentUserTenant` plus `redirect("/onboarding")` to match other dashboard pages.

**Step 2: Add derived metric cards**

Compute counts from existing loaded arrays:

- pending housekeeping count
- pending room service count
- active arrival requests count (`pending` or `in-progress`)
- total operational workload count across all three arrays

Render them in `SimpleGrid` using bordered `Card` components, light `Badge` labels, and large count text.

**Step 3: Wrap existing tabs in a card**

Place `OperationsTabs` inside a bordered `Card` with `radius="md"` and `padding="lg"` to match guests and feedback pages.

---

### Task 3: Improve operations tabs visual consistency

**Files:**

- Modify: `components/operations/operations-tabs.tsx`

**Step 1: Add icons and count badges**

Import `Badge` and relevant Tabler icons. Add `leftSection` icons to each tab. Add a small subtle badge in each tab showing the corresponding array length.

**Step 2: Add accessible tab list label**

Add `aria-label="Operations queues"` to `Tabs.List` based on Mantine tabs accessibility guidance.

**Step 3: Preserve tab values and panels**

Keep existing tab values (`housekeeping`, `room-service`, `arrival-requests`) and panel wiring unchanged.

---

### Task 4: Verify and clean up

**Files:**

- Test: `tests/unit/operations-dashboard-ui.test.ts`
- Verify: `app/(dashboard)/operations/page.tsx`
- Verify: `components/operations/operations-tabs.tsx`

**Step 1: Run the focused test**

Run: `pnpm vitest run tests/unit/operations-dashboard-ui.test.ts`
Expected: PASS.

**Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS or no new errors related to modified files.

**Step 3: Inspect changed files**

Run: `git diff -- app/(dashboard)/operations/page.tsx components/operations/operations-tabs.tsx tests/unit/operations-dashboard-ui.test.ts docs/plans/2026-05-02-operations-dashboard-ui.md`
Expected: changes are limited to the approved UI update and the implementation plan.
