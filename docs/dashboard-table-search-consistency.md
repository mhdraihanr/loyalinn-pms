# Dashboard Table Search Consistency

Date: 2026-05-07

## Summary

Operations and Feedback dashboard tables now follow the same table interaction pattern as Reservations and Guests.

## Updated UI Pattern

Each updated table includes:

- A compact table header with a title and helper text.
- A right-aligned client-side search input on desktop that stacks full-width on small screens.
- Client-side filtering with `useMemo`.
- A full empty state when the source dataset is empty.
- A separate empty search state when data exists but the current query has no matches.

## Updated Pages and Components

- `app/(dashboard)/operations/page.tsx`
  - Retains the existing summary cards and operations tab shell.
- `components/operations/housekeeping-table.tsx`
  - Search by guest, room, type, status, description, and extra items.
- `components/operations/room-service-table.tsx`
  - Search by guest, room, item, note, status, and amount.
- `components/operations/arrival-requests-table.tsx`
  - Search by guest, room, request type, status, ETA/requested time, check-in date, and notes.
- `app/(dashboard)/feedback/page.tsx`
  - Retains the existing feedback summary cards.
- `components/feedback/feedback-monitor-table.tsx`
  - Search by guest, phone, status, rating, comment, check-out date, and last update.

## Rationale

Reservations and Guests already established a consistent dashboard table experience. Applying the same pattern to Operations and Feedback reduces operator friction because staff can search every operational dashboard in the same way.

## Verification

Focused UI consistency tests were added/updated:

- `tests/unit/operations-dashboard-ui.test.ts`
- `tests/unit/feedback-monitor-ui.test.ts`

Focused verification command:

```bash
pnpm test tests/unit/operations-dashboard-ui.test.ts tests/unit/feedback-monitor-ui.test.ts
```

Result: 2 test files passed, 5 tests passed.
