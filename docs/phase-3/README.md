# Phase 3 WAHA Integration Implementation plan

**Goal:** Integrate WAHA for WhatsApp messaging, implement multilingual message templates, and complete team management functionality.

**Architecture:** We use a real-time polling API to sync WAHA session status using the `tenant_id` as the session UUID. Message templates will support multilingual variants based on the guest's country code. Team management will allow owners to revoke/resend invites and remove staff.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Auth, Postgres), WAHA, Tailwind CSS.

---

### Task 1: WAHA Global Client

- Create: `lib/waha/client.ts`
- Uses `axios` to communicate with standard `/api/sessions` WAHA REST endpoints.
- Supports `DEFAULT` session enforcement for WAHA Core compatibility.

### Task 2: WAHA Status Polling API Route

- Create: `app/api/waha/status/route.ts`
- Verifies user tenant and queries WAHA for standard payload `status`, `me`.

### Task 3: WAHA Session Control API Routes

- Create: `app/api/waha/start/route.ts`
- Create: `app/api/waha/qr/route.ts`
- Create: `app/api/waha/logout/route.ts`
- Enforces user tenancy constraints and relays commands through proxy methods to wahaClient.

### Task 4: WAHA Settings UI

- Create: `app/(dashboard)/settings/waha/page.tsx`
- Create: `components/settings/waha/waha-qr-modal.tsx`
- Polling `setInterval(3000)` approach maps WAHA states ('WORKING', 'SCAN_QR_CODE', 'STOPPED').

### Task 5: Multilingual Message Templates Schema & Migrations

- Migration `YYYYMMDDHHMMSS_add_multilingual_message_templates.sql`
- Creates `message_templates` block and related localized `message_template_variants` entries enforcing `TRIGGER` event unicity.

### Task 6: Message Templates UI

- Create: `app/(dashboard)/settings/templates/page.tsx`
- Create: `components/settings/template-form.tsx`
- Adds Tab view navigation across 'Pre-Arrival', 'On-Stay', 'Post-Stay'.

### Task 7: Team Management Lib Updates

- Modify: `lib/auth/invitations.ts`
- Adds `resendInvitation()`, `revokeInvitation()`, `removeStaffMember()`.
- Incorporates `crypto.randomUUID()` handling for regenerating revoked Magic Links emails.

### Task 8: Team Management UI

- Create: `app/(dashboard)/settings/team/page.tsx`
- Create: `components/settings/team/members-table.tsx`
- Create: `components/settings/team/invitations-table.tsx`
- Connects Mantine `<Table>` elements to database queries executing staff management lib server actions.
