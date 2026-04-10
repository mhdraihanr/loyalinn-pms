# Automation Worker Fixes & Dev Tools (2026-04-09)

## 1. "Keep Web Clean" Policy (PMS Sync)

- **Problem**: Reservations manually deleted from the local database by the admin were being resurrected during the next cron sync if they still existed in QloApps.
- **Solution**: The `Sync Service` now explicitly ignores incoming reservations from QloApps if they do not exist locally AND their status is either `checked-out` or `cancelled`. This prevents the system from cluttering the dashboard with past reservations that were intentionally removed.

## 2. Deduplication via UUID & Upsert Fixes

- **Problem**: The `reservations` table was creating duplicate rows for the same `pms_reservation_id` (e.g., `O12-R6` appearing twice) because the previous `upsert` mechanism relied solely on `onConflict: "tenant_id,pms_reservation_id"`, which was failing to hit the unique constraint safely.
- **Solution**: The upsert logic in `auto-sync-service.ts` was refactored to aggressively use the `id` (UUID) if the reservation already exists locally. By explicitly spreading the payload and matching the primary UUID, row duplication logic across multi-tenant polling has been completely eliminated.

## 3. Developer Time Machine & Scheduling Override

- **Feature**: Added a new Development Tool UI at `components/settings/developer-time-machine.tsx` backed by an API route `/api/dev/scheduler`.
- **Purpose**: Allows admins/developers to simulate the cron worker running at any specific past or future date.
- **Details**: This tool bypasses the standard production UTC locking time constraints. It executes `runAutomationCron` with `{ forceSchedule: true }`, making it significantly easier to test `pre-arrival` and `post-stay` orchestration behaviors, especially in multi-tenant test environments.

## 4. Next.js Aggressive Caching (Cache-busting)

- **Problem**: Modifying message templates (e.g., translating them from English to Indonesian) in the Supabase database did not reflect on the workers; the system kept sending the old templates.
- **Solution**: The Next.js App Router aggressively cached the Supabase queries within the backend execution. We applied `cache: "no-store"` into `lib/supabase/admin.ts` and set `export const dynamic = 'force-dynamic'` on the API routes to guarantee 100% fresh template reads from the database.

## 5. PMS Sync Lookback Window Optimization

- **Problem**: The `pms-sync-cron.ts` lookback window was reaching 30 days into the past (`startDate.setDate(baseTime.getDate() - 30)`) on every 5-minute interval poll, causing redundant data fetching and excessive API usage to the QloApps engine.
- **Solution**: The lookback window was reduced drastically to **3 days** (`-3`). This ensures reliable synchronizations while massively speeding up the cron runner's response time and payload efficiency.
