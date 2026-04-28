# Phase 4 - Operations Dashboard (Task 4.6)

## Overview
Implemented the Operations Dashboard to allow hotel staff to monitor and manage AI-generated requests in real-time. The dashboard now covers Housekeeping, Room Service, and pre-arrival Arrival Requests such as ETA capture and early check-in follow-up.

## Implementation Details

### 1. Supabase Realtime Integration
Enabled `supabase_realtime` publication for the `housekeeping_requests`, `room_service_orders`, and `arrival_requests` tables. Housekeeping and room service are covered by `20260423000000_enable_operations_realtime.sql`; the arrival queue is added with `20260428000000_add_arrival_requests.sql` after the table exists. This allows our Next.js application to subscribe to Postgres changes over websockets.

### 2. Server Actions & Data Fetching
- **Initial Data Fetching:** Created `lib/data/operations.ts` with `getHousekeepingRequests`, `getRoomServiceOrders`, and `getArrivalRequests` to load initial SSR data.
- **Mutations:** Created `lib/actions/operations.ts` with status update Server Actions for housekeeping, room service, and arrival requests. Each action scopes updates to the current tenant and revalidates `/operations`.

### 3. Realtime Client Components
Created specialized Mantine Table components (`components/operations/housekeeping-table.tsx`, `components/operations/room-service-table.tsx`, and `components/operations/arrival-requests-table.tsx`) that:
- Receive initial SSR data.
- Set up a Supabase Realtime channel (`postgres_changes` event) to listen for inserts, updates, and deletes.
- Optimistically update local React state.
- Expose buttons to transition request statuses. Housekeeping and room service use `pending` -> `in-progress` -> `completed`; arrival requests use `pending` -> `in-progress` -> `resolved` or `cancelled`.

### 4. Dashboard Page Integration
Created the main `/operations` route (`app/(dashboard)/operations/page.tsx`) utilizing Mantine Tabs to separate the Housekeeping, Room Service, and Arrival Requests views. The page is server-rendered with initial data and hydrates into the real-time client components.

### 5. Arrival Requests
Pre-arrival tools in `lib/ai/tools.ts` now write structured rows to `arrival_requests`:

- `capture_arrival_eta` creates an `arrival_eta` row with the guest ETA and optional notes.
- `request_early_checkin` creates an `early_checkin` row with the requested time and optional reason.

Both tools still update `lifecycle_ai_sessions` so lifecycle audit and routing state remain intact. The Arrival Requests tab gives front office staff a first-class queue for arrival preparation instead of relying only on the lifecycle session's `last_action_type`.

## Operational Note
The `/operations` dashboard only shows AI-created requests after lifecycle AI actually executes its tools and inserts rows into `housekeeping_requests`, `room_service_orders`, or `arrival_requests`. Local development is now standardized on `GEMINI_MODEL=gemini-2.5-flash` so lifecycle tool-calling and operations request routing use a single, consistent Gemini configuration.

Lifecycle AI now sends a budgeted chat context to Gemini instead of replaying the entire reservation transcript on every inbound message. The webhook keeps the newest messages and prepends a deterministic summary of trimmed history when needed, so `/operations` behavior stays the same while AI token usage is reduced.
