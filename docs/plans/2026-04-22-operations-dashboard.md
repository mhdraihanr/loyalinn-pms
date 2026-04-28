# Operations Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a real-time Operations Dashboard for staff to monitor and manage AI-generated housekeeping and room service requests using Supabase Realtime and Server Actions.

**Architecture:** 
- **Database:** Enable `supabase_realtime` publication for `housekeeping_requests` and `room_service_orders`.
- **Data Access:** Initial SSR data fetch via `lib/data/operations.ts`.
- **UI:** Client components (`room-service-table.tsx`, `housekeeping-table.tsx`) that use `supabase.channel().on('postgres_changes', ...)` to listen for inserts/updates and merge them into the local React state.
- **Mutations:** Server Actions (`lib/actions/operations.ts`) to update request statuses, which will subsequently trigger the realtime broadcast to all connected clients.

**Tech Stack:** Next.js App Router, Supabase Realtime, `@supabase/ssr`, Tailwind CSS, Mantine Core (Tables/Tabs), Server Actions.

---

## Proposed Changes

### Task 1: Enable Supabase Realtime
Create a database migration to add the operational tables to the `supabase_realtime` publication so client subscriptions can receive events.

**Files:**
- Create: `supabase/migrations/20260423000000_enable_operations_realtime.sql`

**Step 1: Write migration**
```sql
-- Migration: Enable Realtime for Operations Tables
-- Description: Adds room_service_orders and housekeeping_requests to the supabase_realtime publication

ALTER PUBLICATION supabase_realtime ADD TABLE room_service_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE housekeeping_requests;
```

**Step 2: Commit**
```bash
git add supabase/migrations/20260423000000_enable_operations_realtime.sql
git commit -m "feat: enable supabase realtime for operations tables"
```

### Task 2: Data Access & Server Actions
Create the data layer for initial server-side rendering and the server actions for status mutations.

**Files:**
- Create: `lib/data/operations.ts`
- Create: `lib/actions/operations.ts`

**Step 1: Write data access functions**
Implement `getPendingAndInProgressHousekeeping()` and `getPendingAndInProgressRoomService()` using `createClient()` from `lib/supabase/server`.

**Step 2: Write server actions**
Implement `updateHousekeepingStatus(id, status)` and `updateRoomServiceStatus(id, status)` using `createAdminClient()` or server client.

**Step 3: Commit**
```bash
git add lib/data/operations.ts lib/actions/operations.ts
git commit -m "feat: add data access and server actions for operations dashboard"
```

### Task 3: Client Components (Realtime Tables)
Create the interactive tables that subscribe to Supabase channels and allow status updates.

**Files:**
- Create: `components/operations/housekeeping-table.tsx`
- Create: `components/operations/room-service-table.tsx`

**Step 1: Write Housekeeping Table**
Create a client component that receives `initialData`, sets up the Supabase Realtime channel, and renders a Mantine Table. 

**Step 2: Write Room Service Table**
Similar real-time pattern as housekeeping, but parses and formats the JSONB `items` array.

**Step 3: Commit**
```bash
git add components/operations/housekeeping-table.tsx components/operations/room-service-table.tsx
git commit -m "feat: add real-time table components for operations dashboard"
```

### Task 4: Operations Page
Assemble the components into the main dashboard page.

**Files:**
- Create: `app/(dashboard)/operations/page.tsx`

**Step 1: Write Page Component**
Server Component that fetches initial data and renders a layout with Mantine Tabs separating "Housekeeping" and "Room Service".

**Step 2: Commit**
```bash
git add app/(dashboard)/operations/page.tsx
git commit -m "feat: add operations dashboard page"
```
