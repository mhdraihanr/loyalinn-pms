# Hotel PMS Integration & WhatsApp Automation Web App (Execution-Ready Plan)

## Goal

Build a Next.js web app that integrates with hotel PMS systems to sync reservations and guest data, then automate WhatsApp messaging through WAHA based on reservation lifecycle events.

## Principles

- 1 tenant can have many users, but 1 user can only belong to 1 tenant
- Security and reliability before feature breadth
- Start with one PMS adapter for MVP, then scale adapters
- Event-driven automation with idempotency and observability

## Tech Stack

- Next.js 14 App Router + TypeScript
- Supabase (Postgres, Auth, Realtime)
- WAHA (self-hosted WhatsApp HTTP API)
- Tailwind CSS + shadcn/ui
- Mantine Core (Note: Use standard components like `TableThead` over compound components like `Table.Thead` inside Next.js Server Components to prevent 'Element type is invalid' rendering errors).

---

## Phase 0: Foundations (Must be completed first)

### Task 0.1: Project bootstrap and environment contract

Files:

- Create/Update: a-proposal2/package.json
- Create/Update: a-proposal2/next.config.js
- Create/Update: a-proposal2/tailwind.config.ts
- Create/Update: a-proposal2/tsconfig.json
- Create: a-proposal2/.env.local.example

Add env groups:

- App: NEXT_PUBLIC_APP_URL
- Supabase: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
- WAHA: WAHA_BASE_URL, WAHA_API_KEY
- PMS webhook: PMS_WEBHOOK_SECRET

Acceptance Criteria:

- App starts locally with clear env validation errors
- Missing env variables fail fast at startup (non-silent)

### Task 0.2: Multi-user tenant schema + RLS baseline

Files:

- Create: a-proposal2/supabase/schema.sql
- Create: a-proposal2/supabase/seed.sql

Tables:

- tenants (hotel entity, no direct user_id)
- tenant_users (junction: UNIQUE user_id enforces 1 user → max 1 tenant; roles: owner | staff)
- invitations (staff invite tracking — token, status, expiry, invited_email)
- pms_configurations
- waha_configurations
- guests
- reservations (tracks status, and post-stay feedback: rating, comments) [pending migration]
- room_service_orders (created by AI On-Stay Function Calling) [pending migration]
- housekeeping_requests (created by AI On-Stay Function Calling) [pending migration]
- message_templates
- message_logs
- inbound_events (dedupe/idempotency)
- automation_jobs (queue state)

RLS Requirements:

- All tenant-scoped tables require tenant_id policy via tenant_users lookup
- Owners can manage tenant settings and members
- Staff can access operational data (guests, reservations, messages)
- Service role only for webhook and automation operations

Acceptance Criteria:

- Cross-tenant reads/writes are blocked by policy
- 1 user cannot be inserted into 2 different tenants (UNIQUE constraint)
- Staff cannot modify tenant settings or invite others

### Task 0.3: Auth, middleware, tenant context, invite flow ✅

Files:

- Create: a-proposal2/lib/supabase/client.ts
- Create: a-proposal2/lib/supabase/server.ts
- Create: a-proposal2/lib/supabase/admin.ts (service role, bypasses RLS)
- Create: a-proposal2/middleware.ts
- Create: a-proposal2/lib/auth/tenant.ts (getCurrentUserTenant, requireOwner)
- Create: a-proposal2/lib/auth/onboarding.ts (createTenantAsOwner with duplicate guard)
- Create: a-proposal2/lib/auth/invitations.ts (inviteStaffMember, acceptStaffInvitation)

Rules:

- Use cookie-based SSR client approach
- Middleware refreshes auth session
- Owner registers → creates tenant → assigned as owner
- Owner invites staff via email (Supabase Auth Admin API with user_metadata)
- Invited staff accepts → tenant_users record created via acceptStaffInvitation()
- Roles: owner (full control) | staff (operational access)

Acceptance Criteria:

- Protected routes redirect unauthenticated users
- Owner can create tenant on registration
- Owner can invite staff via email
- Staff cannot create tenants or invite others
- 1 user cannot belong to 2 tenants

### Task 0.4: Migration strategy and DB versioning

Files:

- Create: a-proposal2/supabase/migrations/ (folder)
- Create: a-proposal2/docs/migrations.md

Acceptance Criteria:

- Every schema change uses migration file
- Rollback notes exist for critical migrations

### Task 0.5: Observability minimum baseline

Files:

- Create: a-proposal2/lib/observability/logger.ts
- Create: a-proposal2/docs/runbook.md

Logging standards:

- Structured logs with request_id, tenant_id, reservation_id, job_id
- Error categories: validation, integration, retryable, fatal

Acceptance Criteria:

- Webhook and message flows are traceable end-to-end by request_id

---

## Phase 1: Core UI and Tenant Dashboard ✅ COMPLETED

### Task 1.1: Base UI components ✅

Files:

- Create: a-proposal2/lib/utils.ts
- Create: a-proposal2/components/ui/button.tsx
- Create: a-proposal2/components/ui/input.tsx
- Create: a-proposal2/components/ui/card.tsx
- Create: a-proposal2/components/ui/table.tsx
- Create: a-proposal2/components/ui/label.tsx
- Create: a-proposal2/components/ui/badge.tsx
- Create: a-proposal2/components/ui/tabs.tsx

### Task 1.2: App shell and navigation ✅

Files:

- Create: a-proposal2/app/layout.tsx
- Create: a-proposal2/app/globals.css
- Create: a-proposal2/app/(auth)/layout.tsx
- Create: a-proposal2/app/(dashboard)/layout.tsx
- Create: a-proposal2/components/layout/sidebar.tsx
- Create: a-proposal2/components/layout/logout-button.tsx (with confirmation modal)
- Create: a-proposal2/lib/auth/logout.ts (server action)

### Task 1.3: Dashboard page ✅

Files:

- Create/Modify: a-proposal2/app/(dashboard)/page.tsx
- Create: a-proposal2/components/dashboard/recent-reservations.tsx (Client component for Mantine Table)
- Create: a-proposal2/lib/data/dashboard.ts

Features:

- Stats cards: total guests, active reservations, messages sent, occupancy rate
- Recent reservations list

### Task 1.4: Guests management page ✅

Files:

- Create: a-proposal2/app/(dashboard)/guests/page.tsx
- Create: a-proposal2/components/guests/guests-table.tsx
- Create: a-proposal2/lib/data/guests.ts

Columns:

- Name
- Phone
- Email
- Country
- Tier
- Points
- Joined
- Actions

### Task 1.5: Auth UI — signup, login, accept-invite ✅

Files:

- Create: a-proposal2/app/(auth)/signup/page.tsx
- Create: a-proposal2/app/(auth)/login/page.tsx
- Create: a-proposal2/app/(auth)/accept-invite/page.tsx
- Create: a-proposal2/lib/auth/signup.ts (server action)
- Create: a-proposal2/lib/auth/login.ts (server action)

#### Authentication & Routing Flow

**Initial Access:**

```
User visits app
    ↓
[Middleware checks session]
    ├─ No session? → /login
    └─ Has session? → Check tenant
        ├─ Has tenant? → /(dashboard)/
        └─ No tenant? → /onboarding
```

**Sign Up (Account creation only - email + password):**

```
/signup page:
  - Input: email + password + confirm password (required)
  - Validation: email format, password strength (min 8 chars)
  - Action: supabase.auth.signUp({ email, password })
  - Result:
    ✓ User created in Supabase Auth
    ✓ No tenant assigned yet
  - Redirect: /login (user must login to proceed)
```

**Login (Email + Password):**

```
/login page:
  - Input: email + password (required)
  - Action: supabase.auth.signInWithPassword({ email, password })
  - Result on success:
    ✓ User authenticated
    ✓ Session created (cookie-based)
  - Middleware check on next request:
    ~ User has tenant? → /(dashboard)/
    ~ User has no tenant? → /onboarding
  - Result on error:
    ✗ "Email or password is incorrect"
    ✗ "Too many login attempts, try again later"
```

**Onboarding (Role selection):**

```
/onboarding page:
  - Displays two options:
    1️⃣ "I own a hotel" (Create Tenant)
    2️⃣ "I'm invited to a hotel" (Accept Invite)

  Option 1: Create Tenant
    - Redirect to: /onboarding/create-tenant
    - Input: hotel_name (required, 3-100 chars)
    - Action: createTenantAsOwner(userId, hotelName)
    - Result:
      ✓ Tenant created in tenants table
      ✓ tenant_users record created (role='owner')
      ✓ User assigned as owner
    - Redirect: /(dashboard)/

  Option 2: Accept Invite
    - Wait for owner to send staff invite via email
    - Owner invites from: /(dashboard)/settings/invitations
    - Staff receives magic-link email with /accept-invite?token=...
```

**Staff Invite (Owner invites staff from dashboard):**

```
Owner clicks "Invite Staff" → /(dashboard)/settings/invitations
  - Input: staff email
  - Action: inviteStaffMember(ownerUserId, staffEmail)
  - Result:
    ✓ Record inserted into invitations table:
        { tenant_id, invited_email, invited_by, token (uuid), status='pending',
          expires_at = NOW() + 7 days }
    ✓ Email sent to staff with link: /accept-invite?token=<uuid>
```

**Staff clicks invite link → /accept-invite?token=<uuid>:**

```
[Server: look up invitations record by token (admin client)]
    ├─ Not found / expired?  → show error: "Link expired. Ask your hotel owner to re-invite you."
    ├─ Already accepted?     → redirect /login
    └─ Valid (pending)?
         ↓
    [Check: is invited_email already a registered Supabase user?]
         ├─ NOT registered (new staff)
         │   → redirect /signup?invite_token=<token>
         │       - Email pre-filled from invitations.invited_email (readonly, cannot be changed)
         │       - Input: password + confirm password
         │       - Action: supabase.auth.signUp({ email, password })
         │       - Result: user created + auto-logged in
         │       → redirect /accept-invite?token=<token>
         │
         └─ Already registered
              ├─ Not logged in → redirect /login?invite_token=<token>
              │                  → after login → redirect /accept-invite?token=<token>
              └─ Logged in
                   → display: tenant name, invited by
                   → "Accept Invite" button
                   → acceptStaffInvitation(userId, token)
                   → Result:
                       ✓ tenant_users record created (role='staff')
                       ✓ invitations.status updated to 'accepted'
                       ✓ invitations.accepted_by = userId
                   → redirect /(dashboard)/
```

**Rules:**

- **Signup:** email + password ONLY (no hotel_name)
  - User account created, NO tenant assigned
  - User must login and complete onboarding after signup
  - Cannot create 2nd account with same email (Supabase enforces)
- **Login:** email + password form (standard approach)
  - Middleware auto-checks tenant → route to /onboarding or /dashboard
  - Session persists until explicit logout (15 min inactivity timeout)
- **Onboarding:** 2-way choice
  - Owner: input hotel_name → createTenantAsOwner() → /(dashboard)/
  - Staff: wait for invite, OR if invited already can proceed directly
- **Accept Invite:** only accessible via token in `invitations` table
  - Email on signup form is locked (readonly) to `invitations.invited_email`
  - Staff cannot change email to bypass invite-to-email pairing
  - Cannot accept same invite twice (`status` becomes `accepted` after first accept)
  - Expired after 7 days (`expires_at`) — owner must re-invite
  - Token is UUID — not guessable
- **Dashboard access:** requires valid tenant_id
  - Middleware enforces all flows

### Task 1.6: Onboarding flow and create tenant page ✅

Files:

- Create: a-proposal2/app/(auth)/onboarding/page.tsx
- Create: a-proposal2/app/(auth)/onboarding/create-tenant/page.tsx
- Create: a-proposal2/lib/auth/onboarding.ts (updated with new flow)

**Onboarding page:**

- Display: "Welcome! Choose how you'd like to get started"
- Option 1 button: "I own a hotel" → /onboarding/create-tenant
- Option 2 button: "I was invited to a hotel" → show help text (wait for email)

**Create Tenant page:**

- Form: hotel_name input (required, 3-100 chars, alpha+space+special)
- Button: "Create Tenant"
- On submit:
  - Client validation: hotel_name length + format
  - Server action: createTenantAsOwner(userId, hotelName)
  - On error: show validation errors
  - On success: redirect /(dashboard)/ with toast "Tenant created!"

#### User Types & Initial Routes

| Scenario                                             | Flow                                                                  | Pages                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| Brand new user (owner)                               | signup → login → onboarding → create-tenant                           | `/signup`, `/login`, `/onboarding/create-tenant`             |
| Owner with existing tenant                           | login → dashboard                                                     | `/login`, `/`                                                |
| Staff invited, **not yet registered**                | click invite link → signup (email locked) → accept-invite → dashboard | `/accept-invite`, `/signup?invite_token=X`, `/accept-invite` |
| Staff invited, **already registered**, not logged in | click invite link → login → accept-invite → dashboard                 | `/accept-invite`, `/login?invite_token=X`, `/accept-invite`  |
| Staff invited, **already registered**, logged in     | click invite link → accept-invite → dashboard                         | `/accept-invite`                                             |
| Staff invite expired (>7 days)                       | click invite link → error page                                        | `/accept-invite`                                             |
| Staff invite already accepted                        | click invite link → redirect login                                    | `/login`                                                     |
| Staff without invite (onboarding)                    | login → onboarding → wait for owner                                   | `/login`, `/onboarding`                                      |
| Auth user, no tenant                                 | login → onboarding                                                    | `/login`, `/onboarding`                                      |

Acceptance Criteria (Phase 1):

- ✅ Unauthenticated user lands on /login
- ✅ Signup creates user account (email + password only, no tenant)
- ✅ After signup, user must login to proceed
- ✅ After login without tenant, user redirected to /onboarding
- ✅ Owner can create tenant from /onboarding/create-tenant
- ✅ Owner cannot create 2nd tenant (UNIQUE constraint enforced)
- ✅ Staff can be invited by owner via /(dashboard)/settings/invitations
- ✅ Invite stored in `invitations` table with UUID token + 7-day expiry
- ✅ Staff receives invite email with /accept-invite?token=<uuid>
- ✅ **Staff NOT registered:** /accept-invite → /signup (email locked, readonly) → accept → dashboard
- ✅ **Staff already registered:** /accept-invite → /login (if not logged in) → accept → dashboard
- ✅ Expired invite (>7 days) shows error, does not create tenant_users record
- ✅ Already-accepted token cannot be reused
- ✅ Staff email on signup is locked to invited email — cannot be changed
- ✅ Staff who accept invite land on /(dashboard)/ as role='staff'
- ✅ Tenant user sees only tenant data (RLS enforced)
- ✅ Staff cannot invite others or create tenants
- ✅ User cannot belong to 2 tenants (database constraint verified)
- ✅ Session timeout: 15 min inactivity → auto logout → /login

**Migration required:**

```sql
-- Migration: YYYYMMDDHHMMSS_add_invitations_table.sql
CREATE TABLE invitations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_email TEXT NOT NULL,
  invited_by   UUID NOT NULL REFERENCES auth.users(id),
  token        UUID NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_by  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Owner can manage invitations for their tenant
CREATE POLICY "Owners can manage invitations" ON invitations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- Service role reads invitation by token (for accept-invite page)
-- Handled via admin client — no public policy needed

-- Migration: YYYYMMDDHHMMSS_add_multilingual_message_templates.sql
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL, -- 'pre-arrival', 'on-stay', 'post-stay'
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, trigger)
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

CREATE POLICY "Owners and staff can manage templates" ON message_templates
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage template variants" ON message_template_variants
  FOR ALL USING (
    template_id IN (
      SELECT id FROM message_templates WHERE tenant_id = auth.uid()
    )
  );
```

---

## Phase 2: PMS Integration (MVP = one adapter first) ✅ COMPLETED

### Task 2.1: Reservations page and status tabs ✅

Files:

- Create: a-proposal2/app/(dashboard)/reservations/page.tsx
- Create: a-proposal2/components/reservations/reservations-table.tsx
- Create: a-proposal2/components/reservations/reservations-tabs.tsx (Client component to separate routing state)
- Create: a-proposal2/lib/data/reservations.ts

Features:

- Data fetching extracted to `lib/data/reservations.ts` for consistency
- Mantine UI components: `<Tabs>` for statuses (all, pre-arrival, on-stay, checked-out) and `<Table>` for data display
- Columns: guest, room, dates, status (`<Badge>`), amount, source

### Task 2.2: PMS Configuration UI ✅

Files:

- Create: a-proposal2/app/(dashboard)/settings/pms/page.tsx
- Create: a-proposal2/components/settings/pms/pms-config-form.tsx
- Create: a-proposal2/lib/pms/config.ts (Server action for saving/testing credentials)

Features:

- Secure storage of API Keys / credentials in `pms_configurations`
- Status indicator for connexion health
- Select PMS Provider from supported list

### Task 2.3: PMS adapter contract and Sync Service ✅

Files:

- Create: a-proposal2/lib/pms/adapter.ts
- Create: a-proposal2/lib/pms/auto-sync-service.ts

Adapter interface must include:

- Pull reservations by date range
- Pull guest profile
- Map PMS status to internal status
- Verify webhook payload authenticity (when supported)

Sync Service Expectations:

- Act as middleware between adapter data and Supabase `guests` and `reservations` tables
- Uses `createAdminClient()` to perform database upserts reliably, leveraging strict UUID-based updates to prevent duplicate `pms_reservation_id` records.
- Enforces a "Keep Web Clean" policy: Safely ignores/drops completed QloApps orders (checked-out/cancelled) if they don't exist locally, preventing the resurrection of soft-deleted reservations.
- Emits change events for downstream automation when reservation state changes

### Task 2.4: First production adapter and Sync UI ✅

Files:

- Create: a-proposal2/lib/pms/mock-adapter.ts (MVP implementation)
- Create: a-proposal2/app/api/cron/pms-sync/route.ts (Secured polling sync route)

Acceptance Criteria (Phase 2):

- Tenant can safely save PMS credentials via settings UI
- Synchronization service correctly persists adapter data to DB
- One adapter passes sync smoke test end-to-end
- Sync can be triggered automatically via a secured scheduler or cron caller
- Internal reservation status mapping is deterministic and documented
- Database RLS policies are optimized using `SECURITY DEFINER` functions to prevent infinite recursion loops during synchronization

**Adapter Guides:**

- [QloApps Adapter Guide](./phase-2/qloapps-adapter-guide.md) — Docker setup, API enablement, and implementation steps

---

## Phase 3: WAHA Integration and Messaging Config ✅ COMPLETED

### Task 3.1: WAHA client and service ✅

Files:

- Create: a-proposal2/lib/waha/client.ts

Capabilities:

- Start/stop session
- Get session status
- Get QR code
- Send text message
- Supports WAHA Core (Free) by forcing "default" session name, but architecture is ready for tenant ID injection in WAHA Plus.

### Task 3.2: Settings page for WAHA configuration ✅

Files:

- Create: a-proposal2/app/api/waha/status/route.ts
- Create: a-proposal2/app/api/waha/start/route.ts
- Create: a-proposal2/app/api/waha/qr/route.ts
- Create: a-proposal2/app/api/waha/logout/route.ts
- Create: a-proposal2/app/(dashboard)/settings/waha/page.tsx
- Create: a-proposal2/components/settings/waha/waha-qr-modal.tsx

Sections:

- Real-time polling via API route mapping `tenant.id` to WAHA. (Falls back to "default" for WAHA Core limitation).
- Session status indicator
- QR visualization (`waha-qr-modal.tsx`)
- Connected phone number display (`phoneInfo.id` mapped from auth string).
- Disconnect / Logout Session
- _Note: WAHA URL and API Key are managed globally via `.env` (no longer required per tenant)._

### Task 3.3: Message templates ✅

Files:

- Create: a-proposal2/app/(dashboard)/settings/templates/page.tsx
- Create: a-proposal2/components/settings/template-form.tsx
- Create: a-proposal2/components/settings/templates-tabs.tsx

Data Model (Completed via Migration `20260301130600_add_multilingual_message_templates.sql`):

- `message_templates`: Base trigger configurations (`tenant_id`, `trigger`).
- `message_template_variants`: Multilingual blocks (`template_id`, `language_code`, `content`).

Triggers:

- pre-arrival
- on-stay
- post-stay

Variables:

- {{guestName}}, {{roomNumber}}, {{checkInDate}}, {{checkOutDate}}, {{hotelName}}

### Task 3.4: Team management — members + invitations ✅

**Route:** `/settings/team` (owner only)

Files:

- Create: `a-proposal2/app/(dashboard)/settings/team/page.tsx`
- Create: `a-proposal2/components/settings/team/members-table.tsx`
- Create: `a-proposal2/components/settings/team/invitations-table.tsx`
- Update: `a-proposal2/lib/auth/invitations.ts` — added `resendInvitation()`, `revokeInvitation()`, `removeStaffMember()`

**Page layout (two sections):**

```
/settings/team
├── Section: Active Members
│   ├── Avatar + email, role badge, joined date
│   └── "Remove" button (owner only, cannot remove self)
│
└── Section: Pending Invitations
    ├── Email, sent date, expires date, status badge (pending / expired)
    ├── "Resend" button → reset token (crypto.randomUUID()) + expires_at + re-send email
    └── "Revoke" button → set status='expired' → token immediately invalid
```

Acceptance Criteria (Phase 3):

- ✅ WAHA session can be connected via QR
- ✅ Owner can view all active members and pending invitations
- ✅ Owner can resend an invite (old token invalidated, new token issued)
- ✅ Owner can revoke a pending invite (token immediately unusable)
- ✅ Owner can remove a staff member
- ✅ Owner cannot remove themselves

---

## Phase 4: Automation Engine (Reliable Delivery) 🚧 IN PROGRESS

Current Status (2026-04-16):

- ✅ Reliable delivery core is complete through webhook ingestion, status-trigger orchestration, queue/retry handling, and cron-driven scheduler execution.
- ✅ Phase 4 schema support is in place via `20260307123000_add_phase4_automation_metadata.sql` and `20260307160000_add_claim_automation_jobs_function.sql`.
- ✅ PMS polling now feeds the automation pipeline through `lib/pms/auto-sync-service.ts`, `lib/pms/pms-sync-cron.ts`, and the development-only scheduler in `lib/pms/dev-sync-scheduler.ts`.
- ✅ Post-stay AI follow-up orchestration now includes 24-hour automatic escalation (`pending` -> `ai_followup`) with template-driven follow-up messages.
- ✅ Tenant-scoped AI Assistant settings are implemented (`/settings/ai`) and injected into post-stay follow-up system prompt (`hotel_name`, `ai_name`, `tone_of_voice`, `custom_instructions`).
- ✅ Language routing is now hardened across automation + AI follow-up: Indonesian is only used for Indonesia-pattern numbers (`08`, `+62`, `62`), while non-ID numbers default to English.
- ✅ WAHA post-stay handoff replies (`completed`, `ignored`) now use deterministic built-in bilingual templates in webhook logic (no env dependency).
- ✅ QloApps guest phone resolution now prioritizes `customers` resource phone values and only falls back to the latest `addresses` record.
- ✅ Task 4.4 is implemented end-to-end and currently verified by focused automated tests (see Verification Snapshot under Task 4.4).
- 🚧 On-stay AI tooling and the Operations dashboard are not implemented yet.

Implemented files tracked for Phase 4 to date (Tasks 1-8):

- Database and migrations:
  - `supabase/migrations/20260307123000_add_phase4_automation_metadata.sql`
  - `supabase/migrations/20260307160000_add_claim_automation_jobs_function.sql`
  - `supabase/migrations/20260412001000_add_post_stay_ai_followup_template_trigger.sql`
  - `supabase/migrations/20260412002000_add_ai_settings_table.sql`
  - `supabase/migrations/20260412003000_add_inbound_message_dedupe_unique_index.sql`
  - `supabase/schema.sql` (updated to match migration state)
- Automation core:
  - `lib/automation/types.ts`
  - `lib/automation/idempotency.ts`
  - `lib/automation/retry-policy.ts`
  - `lib/automation/queue.ts`
  - `lib/automation/template-renderer.ts`
  - `lib/automation/qloapps-normalizer.ts`
  - `lib/automation/status-trigger.ts`
  - `lib/automation/scheduler.ts`
- Routes and PMS orchestration:
  - `app/api/webhooks/pms/route.ts`
  - `app/api/cron/automation/route.ts`
  - `app/api/cron/pms-sync/route.ts`
  - `app/api/webhooks/waha/route.ts`
  - `lib/pms/auto-sync-service.ts`
  - `lib/pms/pms-sync-cron.ts`
  - `lib/pms/dev-sync-scheduler.ts`
  - `instrumentation.ts`
- UI support for development visibility:
  - `components/layout/page-auto-refresh.tsx`
- Post-stay feedback flow and monitoring:
  - `lib/automation/feedback-link.ts`
  - `lib/automation/feedback-reward.ts`
  - `app/feedback/[token]/page.tsx`
  - `components/feedback/post-stay-feedback-form.tsx`
  - `app/api/feedback/submit/route.ts`
  - `lib/data/feedback.ts`
  - `app/(dashboard)/feedback/page.tsx`
  - `components/feedback/feedback-monitor-table.tsx`
- AI settings management for follow-up prompt personalization:
  - `app/(dashboard)/settings/ai/page.tsx`
  - `components/settings/ai/ai-settings-form.tsx`
  - `lib/ai/settings.ts`
  - `lib/ai/agent.ts` (prompt builder now merges tenant AI settings)

### Task 4.1: PMS webhook endpoint ✅

Files:

- Create: a-proposal2/app/api/webhooks/pms/route.ts
- Create: a-proposal2/lib/automation/qloapps-normalizer.ts
- Create: a-proposal2/lib/automation/types.ts
- Create: a-proposal2/lib/automation/idempotency.ts
- Modify: a-proposal2/supabase/schema.sql
- Create: a-proposal2/supabase/migrations/20260307123000_add_phase4_automation_metadata.sql

Required controls:

- Signature/token verification
- Timestamp validation
- Replay protection (nonce or event id cache)
- Idempotency on event ingestion

### Task 4.2: Status trigger engine ✅

Files:

- Create: a-proposal2/lib/automation/status-trigger.ts
- Create: a-proposal2/lib/automation/template-renderer.ts

Flow:

1. Receive webhook event
2. Validate and dedupe event
3. Detect status transition
4. Resolve active template
5. Render variables
6. Enqueue send job
7. Persist log and delivery state

### Task 4.3: Queue, retry, dead-letter ✅

Files:

- Create: a-proposal2/lib/automation/queue.ts
- Create: a-proposal2/lib/automation/retry-policy.ts
- Create: a-proposal2/supabase/migrations/20260307160000_add_claim_automation_jobs_function.sql

Policy:

- Exponential backoff retries
- Max attempts then dead-letter state
- Retry only for retryable failures

### Task 4.4: Scheduled trigger runner & Post-Stay AI Follow-Up ✅ COMPLETED (Verified 2026-04-16)

Files:

- Create: a-proposal2/app/api/cron/automation/route.ts
- Create: a-proposal2/lib/automation/scheduler.ts
- Create: a-proposal2/app/api/cron/pms-sync/route.ts
- Create: a-proposal2/lib/pms/auto-sync-service.ts
- Create: a-proposal2/lib/pms/pms-sync-cron.ts
- Create: a-proposal2/lib/pms/dev-sync-scheduler.ts
- Create: a-proposal2/instrumentation.ts
- Create: a-proposal2/components/layout/page-auto-refresh.tsx
- Create: a-proposal2/components/settings/developer-time-machine.tsx
- Create: a-proposal2/lib/ai/agent.ts (Moved from Phase 6 MVP to handle follow-ups)
- Create: a-proposal2/lib/automation/feedback-link.ts
- Create: a-proposal2/lib/automation/feedback-reward.ts
- Create: a-proposal2/components/feedback/post-stay-feedback-form.tsx
- Create: a-proposal2/app/feedback/[token]/page.tsx
- Create: a-proposal2/app/api/feedback/submit/route.ts
- Create: a-proposal2/lib/data/feedback.ts
- Create: a-proposal2/app/(dashboard)/feedback/page.tsx
- Create: a-proposal2/components/feedback/feedback-monitor-table.tsx
- Create: a-proposal2/lib/automation/feedback-escalation.ts
- Create: a-proposal2/supabase/migrations/20260412001000_add_post_stay_ai_followup_template_trigger.sql
- Create: a-proposal2/supabase/migrations/20260412002000_add_ai_settings_table.sql
- Create: a-proposal2/supabase/migrations/20260417000100_add_feedback_reward_points_function.sql
- Create: a-proposal2/app/(dashboard)/settings/ai/page.tsx
- Create: a-proposal2/components/settings/ai/ai-settings-form.tsx
- Create: a-proposal2/lib/ai/settings.ts

Current implementation status:

- ✅ `app/api/cron/automation/route.ts` and `lib/automation/scheduler.ts` are implemented.
- ✅ Scheduled pre-arrival and post-stay jobs are created idempotently and processed through the cron worker.
- ✅ Custom Developer Time Machine tool built (`/api/dev/scheduler`) allowing admins to simulate future/past worker runs with UTC locking bypasses, resolving Multi-Tenant queue tracking.
- ✅ Overcame Next.js aggressive cache returning old templates using `cache: "no-store"` and `force-dynamic` to ensure fresh DB reads.
- ✅ Optimized `pms-sync-cron.ts` lookback window from 30 days to 3 days to maximize processing speed.
- ✅ PMS polling is connected to automation ingestion through `lib/pms/auto-sync-service.ts`.
- ✅ Local development startup now supports separate `DEV_PMS_SYNC_INTERVAL_MS` and `DEV_AUTOMATION_SYNC_INTERVAL_MS` intervals for the two schedulers.
- ✅ Production scheduling is defined through `vercel.json` for `/api/cron/pms-sync` every 5 minutes and `/api/cron/automation` every minute.
- ✅ Completing post-stay feedback now awards loyalty points (`+50`) to the related guest exactly once via Supabase RPC `complete_post_stay_feedback_with_reward`.
- ✅ Reward logic is shared by both web form submit route and AI feedback tool to keep behavior consistent and idempotent.
- ✅ AI follow-up closing flow now explicitly informs guests that reward points can be redeemed for services (welcome drink, extra bed, or room-rate discount).
- ✅ Feedback Monitor detail modal now surfaces reward status, richer feedback metadata, and quick open/copy feedback-link actions.
- ✅ Hybrid Post-Stay Web Form flow is implemented end-to-end (signed magic link generation, public form page, submit API, and template variable support `{{feedbackLink}}`).
- ✅ Feedback Monitor dashboard page (`/feedback`) is implemented with status cards, tenant-scoped table, and detail modal showing full comments + feedback link.
- ✅ WAHA inbound webhook integration (`app/api/webhooks/waha/route.ts`) and `lib/ai/agent.ts` tool-calling are implemented for AI-assisted follow-up replies.
- ✅ AI provider has been migrated from OpenRouter to Gemini API via `@ai-sdk/google` (`aiProvider(AI_MODEL)`), keeping WAHA AI follow-up flow on a native provider path.
- ✅ WAHA AI follow-up webhook now degrades gracefully on retryable provider failures (including Gemini `429`), returning deterministic fallback reply with HTTP `200` instead of propagating `500`.
- ✅ Agent prompt now enforces numeric rating-first behavior (`1-5`) before calling `update_guest_feedback`, reducing premature tool-call attempts when guests send comments first.
- ✅ If primary model is rate-limited and `GEMINI_FALLBACK_MODEL` is configured, AI follow-up automatically retries with fallback model before webhook-level fallback reply is used.
- ✅ Automatic scheduler escalation after 24 hours (`pending` -> `ai_followup`) is implemented in `lib/automation/feedback-escalation.ts`.
- ✅ Follow-up kickoff message is now template-driven from Message Templates tab `post-stay-ai-followup` (not hardcoded).
- ✅ Cron summary responses now expose `aiFollowupEscalated` and are validated at route level (`/api/cron/automation` and `/api/dev/scheduler`).
- ✅ Tenant-specific AI prompt context is now configurable from dashboard `/settings/ai`, persisted in `ai_settings`, and consumed by `processGuestFeedback` to personalize AI replies.
- ✅ Inbound WAHA dedupe is hardened with atomic DB-level unique index and webhook fallback payload hashing when provider message id is missing.
- ✅ AI + automation language policy now consistently uses phone-based detection (`08` / `+62` / `62` => `id`, others => `en`) for status-trigger sends, escalation kickoff, and agentic follow-up chat.
- ✅ Webhook now keeps completed/ignored closing replies from Agentic AI output (language follows detected guest language), while deterministic text fallback is reserved for retryable provider failures only.
- ✅ QloApps adapter phone mapping now prefers `customer.phone`/`customer.phone_mobile`; address phone is used only as fallback from the latest address row.

Verification Snapshot (2026-04-16):

- Command: `pnpm test tests/integration/app/api/cron/automation/route.test.ts tests/integration/app/api/dev/scheduler/route.test.ts tests/integration/lib/automation/scheduler.test.ts tests/integration/lib/automation/status-trigger.test.ts tests/unit/lib/automation/automation-cron.test.ts tests/unit/lib/automation/feedback-escalation.test.ts tests/integration/app/api/feedback/submit/route.test.ts tests/integration/app/api/webhooks/waha/route.test.ts`
- Result: `8` test files passed, `33` tests passed, `0` failed.

Additional Verification Snapshot (2026-04-16, language + handoff hardening):

- Command: `pnpm test tests/integration/app/api/webhooks/waha/route.test.ts tests/unit/lib/ai/agent.test.ts tests/unit/lib/automation/feedback-escalation.test.ts`
- Result: `3` test files passed, `20` tests passed, `0` failed.

Use cases:

- Pre-arrival messages 1-2 days before check-in.
- **Post-stay feedback loop (Hybrid Web-Form + AI Agent):**
  1. H+1 after checkout: Send an automated WAHA message with a link to a "Post-Stay Feedback" Web Form. Database status `post_stay_feedback_status` = `pending`.
  2. Scheduled trigger runs every X hours to check for `pending` status.
  3. **Agentic Intervention:** If a guest drops off (doesn't fill the form within 24 hours), the scheduler escalates status to `ai_followup` and sends a configurable AI follow-up kickoff template via WAHA.
  4. **Context Provision & Personalization:** Before chatting, the system retrieves the `guest` and `reservation` history (e.g., room booked, length of stay, total spend, past visits) and injects it into the AI's System Prompt.
  5. The AI directly chats with the guest in a highly personalized manner: _"Halo [Nama], terima kasih sudah menginap di [Tipe Kamar] selama 3 malam kemarin. Bagaimana pengalaman Anda? Apakah ada masukan untuk kami?"_
  6. **Function Calling & Summarization:** AI parses the guest's unstructured chat reply, summarizes it, and calls `update_guest_feedback(rating, comments)` to save structured data back to the database, identical to the Web Form output.

### Task 4.5: On-Stay Agentic AI (In-Stay Automation) 🚧

Files:

- Create: a-proposal2/lib/ai/on-stay-agent.ts
- Create: a-proposal2/lib/ai/tools.ts

Use cases:

- **AI Room Service / F&B Ordering:**
  1. Guest sends a WhatsApp message ordering food to their room.
  2. The WAHA Webhook triggers the AI Agent, providing the guest profile and active reservation in the context.
  3. AI parses the request, asks for confirmation, and calls `order_in_room_dining(room_number, items)`.
  4. System saves the structured order to `room_service_orders` (accessible in standard Next.js staff dashboards).
- **AI Housekeeping & Request Management:**
  1. Guest requests room cleaning or extra towels via WhatsApp.
  2. AI calls `request_housekeeping(room_number, request_type, details)`.
  3. System saves the request to `housekeeping_requests`.
- **AI Concierge & FAQ:**
  1. Guest asks hotel-related questions (e.g., "What time does the pool close?").
  2. AI answers directly using RAG / predefined knowledge base.
  3. Escalates to human staff explicitly using `escalate_to_human()` if necessary.

### Task 4.6: Operations Dashboard (Housekeeping & Room Service) 🚧

Files:

- Create: a-proposal2/app/(dashboard)/operations/page.tsx
- Create: a-proposal2/components/operations/housekeeping-table.tsx
- Create: a-proposal2/components/operations/room-service-table.tsx

Features:

- A dedicated UI page mapped under the "OPERATIONS" sidebar group.
- Real-time or polled lists of `housekeeping_requests` and `room_service_orders` generated by the AI on-stay agent.
- Actions to mark requests as "In Progress" or "Completed".

Acceptance Criteria (Phase 4):

- ✅ Duplicate webhook payload does not send duplicate message
- ✅ Failed sends are retried and visible in logs
- ✅ Scheduled jobs execute in expected windows
- ✅ Staff can monitor post-stay feedback from dashboard `/feedback`, including detail view for full comments and feedback link.
- 🚧 Staff can view and update AI-generated requests in the Operations dashboard

---

## Phase 5: QA, Security Hardening, and Release Readiness

### Task 5.1: Test strategy implementation

Files:

- Create: a-proposal2/docs/testing-strategy.md
- Create: a-proposal2/tests/ (unit/integration/e2e)

Minimum coverage:

- Unit tests: template renderer, status mapper, retry policy
- Integration tests: webhook to queue to WAHA mock
- Contract tests: PMS adapter mapping

### Task 5.2: Rate limiting and tenant fairness

Files:

- Create: a-proposal2/lib/security/rate-limit.ts

Requirements:

- Per-tenant rate limits for manual and automated sends
- Safe fallback responses on limit breaches

### Task 5.3: Compliance and data governance

Files:

- Create: a-proposal2/docs/compliance.md

Must define:

- Consent capture and opt-out handling
- PII retention period and purge jobs
- DSAR/export-delete process

### Task 5.4: Operational readiness

Files:

- Update: a-proposal2/docs/runbook.md

Include:

- Incident playbooks (PMS down, WAHA down, webhook failures)
- Alert thresholds and on-call actions

Acceptance Criteria (Phase 5):

- Critical flows covered by automated tests
- Runbook is sufficient for first production incident handling

---

## Phase 6: Future Enhancements (Deferred)

### Task 6.1: Advanced AI features

Files:

- Create: a-proposal2/lib/ai/prompts.ts
- Create: a-proposal2/app/api/ai/recommendations/route.ts

Notes:

- Keep as placeholder for advanced upselling (e.g., proactive spa recommendations based on past stays).
- The core AI follow-up logic for post-stay feedback is already implemented in Phase 4.

### Task 6.2: Manual send API and dialog

Files:

- Create: a-proposal2/app/api/messages/send/route.ts
- Create: a-proposal2/components/messages/send-dialog.tsx

Features:

- Pick reservation/guest
- Preview rendered template
- Send immediately

---

## MVP Scope (Recommended)

Include:

- Phase 0 to Phase 4
- Exactly one PMS adapter
- Manual send + automated status-based send

Defer:

- AI features
- Multiple PMS adapters beyond first production adapter
- Advanced analytics dashboards

---

## Open Product Questions (Must clarify before implementation)

1. Which PMS is first go-live target: Cloudbeds or Mews?
2. Exact event mapping matrix from PMS statuses to internal statuses?
3. Throughput target per tenant (messages per minute/day)?
4. Consent policy and legal jurisdiction (GDPR, PDPA, local laws)?
5. Multi-property under one tenant needed in MVP or post-MVP?
6. Role permissions detail for owner/admin/agent?

---

## Definition of Done (Project-level)

- Tenant isolation is enforced by RLS and verified by tests
- End-to-end flow works: PMS event -> automation -> WAHA send -> log
- Duplicate events do not create duplicate sends
- Failed deliveries are retried with clear terminal states
- Security checks exist for webhook, secrets, and RBAC
- Release runbook and monitoring are in place
