# Phase 3 WAHA Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate WAHA for WhatsApp messaging, implement multilingual message templates, and complete team management functionality.

**Architecture:** We use a real-time polling API to sync WAHA session status using the `tenant_id` as the session UUID. Message templates will support multilingual variants based on the guest's country code. Team management will allow owners to revoke/resend invites and remove staff.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (Auth, Postgres), WAHA, Tailwind CSS.

---

### Task 1: WAHA Global Client

**Files:**

- Create: `lib/waha/client.ts`

**Step 1: Write minimal implementation**

```typescript
// lib/waha/client.ts
import axios from "axios";

const WAHA_BASE_URL = process.env.WAHA_BASE_URL;
const WAHA_API_KEY = process.env.WAHA_API_KEY;

const apiClient = axios.create({
  baseURL: WAHA_BASE_URL,
  headers: {
    Accept: "application/json",
    "X-Api-Key": WAHA_API_KEY,
  },
});

export const wahaClient = {
  getSessions: async () =>
    apiClient.get("/api/sessions?all=true").then((res) => res.data),
  getSession: async (session: string) =>
    apiClient.get(`/api/sessions/${session}`).then((res) => res.data),
  startSession: async (session: string) =>
    apiClient.post("/api/sessions/start", { session }).then((res) => res.data),
  getQR: async (session: string) =>
    apiClient.get(`/api/${session}/auth/qr`).then((res) => res.data),
  logoutSession: async (session: string) =>
    apiClient.post(`/api/sessions/logout`, { session }).then((res) => res.data),
  sendMessage: async (session: string, chatId: string, text: string) =>
    apiClient
      .post(`/api/${session}/sendText`, { chatId, text })
      .then((res) => res.data),
};
```

**Step 2: Commit**

```bash
git add lib/waha/client.ts
git commit -m "feat: add waha global api client"
```

---

### Task 2: WAHA Status Polling API Route

**Files:**

- Create: `app/api/waha/status/route.ts`

**Step 1: Write API Route implementation**

```typescript
// app/api/waha/status/route.ts
import { NextResponse } from "next/server";
import { wahaClient } from "@/lib/waha/client";
import { getCurrentUserTenant } from "@/lib/auth/tenant";

export async function GET() {
  const { tenant } = await getCurrentUserTenant();
  if (!tenant)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = tenant.id; // UUID as session name
  try {
    const sessions = await wahaClient.getSessions();
    const session = sessions.find((s: any) => s.name === sessionId);

    if (!session) {
      return NextResponse.json({ status: "STOPPED" });
    }

    return NextResponse.json({
      status: session.status,
      me: session.me, // connected phone info
    });
  } catch (error: any) {
    console.error("WAHA API Error:", error.message);
    return NextResponse.json(
      { error: "WAHA connection failed", status: "ERROR" },
      { status: 500 },
    );
  }
}
```

**Step 2: Commit**

```bash
git add app/api/waha/status/route.ts
git commit -m "feat: add waha status polling api route"
```

---

### Task 3: WAHA Session Control API Routes

**Files:**

- Create: `app/api/waha/start/route.ts`
- Create: `app/api/waha/qr/route.ts`
- Create: `app/api/waha/logout/route.ts`

**Step 1: Write implementations**
Implement `POST` handlers that securely verify `tenant.id` and pass it to `wahaClient.startSession`, `wahaClient.getQR`, and `wahaClient.logoutSession` respectively.

**Step 2: Commit**

```bash
git add app/api/waha/start/route.ts app/api/waha/qr/route.ts app/api/waha/logout/route.ts
git commit -m "feat: add waha session control api routes"
```

---

### Task 4: WAHA Settings UI

**Files:**

- Create: `app/(dashboard)/settings/waha/page.tsx`
- Create: `components/settings/waha/waha-qr-modal.tsx`

**Step 1: Write Client Components**
Create the Next.js page that uses SWR or `useEffect` `setInterval` (polling every 3s) to fetch `/api/waha/status`.

- If `STOPPED`, show "Connect WhatsApp" button (calls `/api/waha/start`).
- If `SCAN_QR_CODE`, fetch `/api/waha/qr` and display standard `<Modal>` containing the QR image.
- If `WORKING`, show "Connected" and a "Disconnect" button (calls `/api/waha/logout`).

**Step 2: Commit**

```bash
git add app/(dashboard)/settings/waha/page.tsx components/settings/waha/waha-qr-modal.tsx
git commit -m "feat: waha settings ui with real-time qr polling"
```

---

### Task 5: Multilingual Message Templates Schema & Migrations

**Files:**

- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_message_templates.sql`

**Step 1: Write Migration**

```sql
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_event TEXT NOT NULL, -- 'pre-arrival', 'on-stay', 'post-stay'
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, trigger_event)
);

CREATE TABLE message_template_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL, -- 'id', 'en', etc.
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(template_id, language_code)
);

ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_template_variants ENABLE ROW LEVEL SECURITY;
-- Add RLS policies for tenant owners/staff to manage
```

**Step 2: Commit**

```bash
git add supabase/migrations/*
git commit -m "feat: add multilingual message templates schema"
```

---

### Task 6: Message Templates UI

**Files:**

- Create: `app/(dashboard)/settings/templates/page.tsx`
- Create: `components/settings/template-form.tsx`

**Step 1: Write Implementation**
Implement the UI using Mantine Tabs for triggers (`pre-arrival`, `on-stay`, `post-stay`).
Inside each tab, list available languages. Allow users to add a new language variant, and save `content` string with standard variable placeholders: `{{guestName}}`, `{{roomNumber}}`, `{{checkInDate}}`, `{{checkOutDate}}`.

**Step 2: Commit**

```bash
git add app/(dashboard)/settings/templates/page.tsx components/settings/template-form.tsx
git commit -m "feat: multilingual message template settings ui"
```

---

### Task 7: Team Management Lib Updates

**Files:**

- Modify: `lib/auth/invitations.ts`

**Step 1: Write Implementation**
Add:

- `resendInvitation(ownerId, invitationId)`: regenerate UUID token, update `expires_at`, call resend email API.
- `revokeInvitation(ownerId, invitationId)`: set status to 'expired'.
- `removeStaffMember(ownerId, targetUserId)`: delete `tenant_users` row where role is staff.

**Step 2: Commit**

```bash
git add lib/auth/invitations.ts
git commit -m "feat: team management actions for invitations and staff"
```

---

### Task 8: Team Management UI

**Files:**

- Create: `app/(dashboard)/settings/team/page.tsx`
- Create: `components/settings/team/members-table.tsx`
- Create: `components/settings/team/invitations-table.tsx`

**Step 1: Write Implementation**
Create tables utilizing Mantine to list active staff members (with `Remove` button calling Server Action) and pending invitations (with `Resend` and `Revoke` buttons calling Server Actions). Ensure owner cannot remove themselves.

**Step 2: Commit**

```bash
git add app/(dashboard)/settings/team/page.tsx components/settings/team/*
git commit -m "feat: team management settings ui"
```
