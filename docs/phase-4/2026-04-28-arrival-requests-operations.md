# Phase 4 - Arrival Requests Operations Update

## Summary

The Operations Dashboard now includes a first-class **Arrival Requests** tab for pre-arrival AI outputs. This turns guest ETA messages and early check-in requests into staff-visible operational rows instead of leaving them only as lifecycle session metadata.

## Scope

- Added `arrival_requests` as an operational queue table.
- Added realtime support for the new table in the same migration that creates it.
- Added tenant-scoped data access and server action support in `lib/data/operations.ts` and `lib/actions/operations.ts`.
- Added `components/operations/arrival-requests-table.tsx` and wired it into `/operations`.
- Updated pre-arrival AI tools in `lib/ai/tools.ts`:
  - `capture_arrival_eta` writes an `arrival_eta` row.
  - `request_early_checkin` writes an `early_checkin` row.
  - Both tools continue to update `lifecycle_ai_sessions`.

## Operational Model

Arrival requests use a front-office status flow:

1. `pending`
2. `in-progress`
3. `resolved` or `cancelled`

The default Operations view shows `pending` and `in-progress` rows. Resolved and cancelled rows remain in the database for audit/history but are hidden from the active queue.

## Data Model

`arrival_requests` stores:

- tenant, reservation, guest, and room references
- `request_type`: `arrival_eta` or `early_checkin`
- `eta` for arrival ETA captures
- `requested_time` for early check-in requests
- JSON `details` for notes or guest-provided reasons
- operational `status`

## Verification

Fresh verification after implementation:

- `pnpm test` passed with 38 test files and 157 tests.
- Changed-file ESLint passed.
- Full `pnpm lint` still reports unrelated existing lint errors outside this feature area.
- `pnpm exec tsc --noEmit` still reports unrelated existing `NODE_ENV` readonly assignment errors in `tests/integration/app/api/dev/scheduler/route.test.ts`.
