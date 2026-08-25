# Operations Dashboard Retention Policy

## Problem

Previously, the Operations Dashboard only displayed requests with status `pending` and `in-progress`. Requests marked as `resolved` (for arrival requests) or `completed` (for housekeeping/room service) disappeared immediately from the dashboard, even though they remained in the database for audit/history. There was no retention period for recently completed/resolved requests to remain visible for operational review.

## Solution

**Retention Policy Implemented:**

- Requests with status `resolved` (arrival requests) or `completed` (housekeeping/room service) will remain visible in the dashboard for 2 days (48 hours) after their status is updated.
- After 2 days, these requests are hidden from the active dashboard view but are still retained in the database for audit/history purposes.

## Technical Implementation

- The data queries in `lib/data/operations.ts` were updated to include:
  - All `pending` and `in-progress` requests (as before)
  - All `resolved`/`completed` requests where `updated_at` is within the last 2 days
- No new label is shown; the status column continues to display the original status value.
- No destructive deletion is performed; this is a visibility change only.

## Impact

- Staff can now see recently completed/resolved operational requests for 2 days, improving handover and auditability.
- No change to the underlying data model or audit/history retention.

## Related Files

- `lib/data/operations.ts` (query logic)
- `app/(dashboard)/operations/page.tsx` (dashboard data source)
- `components/operations/*-table.tsx` (table rendering, unchanged)

## Verification

- All tests pass after the update.
- No regression in dashboard or operational flows.

## Main Dashboard Surfacing

The main dashboard now reuses the same retained operations dataset to surface a lightweight `Operational Attention` summary. This avoids mismatched numbers between the home dashboard and the full Operations page.

Included summary signals:

- pending housekeeping requests
- pending room service orders
- active arrival requests (`pending` and `in-progress`)
- total operational workload from the retained dataset

The main dashboard also adds a `WhatsApp Health` card focused only on WAHA connection state for the default session, so staff can quickly see whether automations are blocked by connectivity before opening detailed settings.

### Runtime Fix Notes

During dashboard enrichment, the route hit two UI runtime issues that were resolved without changing the retention logic:

- `ActionIcon component={Link}` in the server component path caused a Next.js client boundary error; the safe pattern is wrapping the action with `Link`.
- A non-critical decorative header block in the recent reservations section was simplified after triggering an `Element type is invalid` render failure in the dashboard route.

These fixes keep the operational summary and WAHA health surfacing intact while preserving stable dashboard rendering.

## Verification

- Focused helper tests pass: `tests/dashboard-data.test.ts`
- Existing dashboard retention behavior remains unchanged for operations tables
- Dashboard home route renders successfully after the runtime fix
