# Guests & Reservations UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refresh the Guests and Reservations pages with a consistent premium dashboard shell, client-side search/filter UI, and improved table presentation.

**Architecture:** Keep server-side data fetching in the page files. Move search/filter interaction into client table components. Reuse Mantine cards, grids, badges, inputs, and existing auto-refresh behavior to align both pages.

**Tech Stack:** Next.js App Router, React 19, Mantine 8, Tabler icons, Vitest, TypeScript.

---

### Task 1: Add failing UI regression tests

**Files:**

- Create: `tests/unit/guests-reservations-ui.test.ts`
- Read: `app/(dashboard)/guests/page.tsx`
- Read: `app/(dashboard)/reservations/page.tsx`
- Read: `components/guests/guests-table.tsx`
- Read: `components/reservations/reservations-table.tsx`

**Step 1: Write the failing test**
Assert the source contains the new consistency markers:

- both pages use `SimpleGrid` and `Card`
- guests page includes summary labels and richer subtitle
- reservations page includes summary labels and richer subtitle
- both table components include client-side search UI and polished empty states

**Step 2: Run test to verify it fails**
Run: `pnpm vitest run tests/unit/guests-reservations-ui.test.ts`
Expected: FAIL.

### Task 2: Refresh Guests page shell

**Files:**

- Modify: `app/(dashboard)/guests/page.tsx`

**Step 1: Add summary metrics**
Compute total guests, tiered members, guests with email, and total points.

**Step 2: Add consistent page shell**
Render header, subtitle, stat cards, and a main card wrapping the guests table.

### Task 3: Enhance Guests table interaction and styling

**Files:**

- Modify: `components/guests/guests-table.tsx`

**Step 1: Add client-side search**
Add a search input that filters by name, email, phone, and country.

**Step 2: Improve table presentation**
Add toolbar, better empty states, refined row blocks, and clearer value styling.

### Task 4: Refresh Reservations page shell

**Files:**

- Modify: `app/(dashboard)/reservations/page.tsx`

**Step 1: Add summary metrics**
Compute totals for reservations, on-stay, pre-arrival, and revenue snapshot.

**Step 2: Add consistent page shell**
Render the same header/stat-card/table-card structure used by Guests.

### Task 5: Enhance Reservations table interaction and styling

**Files:**

- Modify: `components/reservations/reservations-table.tsx`
- Optional small tweak: `components/reservations/reservations-tabs.tsx`

**Step 1: Add client-side search**
Filter by guest name, room number, and source.

**Step 2: Improve table presentation**
Refine guest/date blocks, badge treatment, empty states, and toolbar alignment with tabs.

### Task 6: Verify

**Files:**

- Test: `tests/unit/guests-reservations-ui.test.ts`

**Step 1: Run focused test**
Run: `pnpm vitest run tests/unit/guests-reservations-ui.test.ts`
Expected: PASS.

**Step 2: Run lint**
Run: `pnpm lint`
Expected: PASS or no new errors from modified files.
