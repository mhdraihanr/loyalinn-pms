# Hotel PMS Integration & WhatsApp Automation Web App (Execution-Ready Plan)

## Goal

Build a Next.js web app that integrates with hotel PMS systems to sync reservations and guest data, then automate WhatsApp messaging through WAHA based on reservation lifecycle events.

## Principles

- Multi-tenant isolation first (database + application layer)
- Security and reliability before feature breadth
- Start with one PMS adapter for MVP, then scale adapters
- Event-driven automation with idempotency and observability

## Tech Stack

- Next.js 14 App Router + TypeScript
- Supabase (Postgres, Auth, Realtime)
- WAHA (self-hosted WhatsApp HTTP API)
- Tailwind CSS + shadcn/ui

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

### Task 0.2: Multi-tenant schema + RLS baseline

Files:

- Create: a-proposal2/supabase/schema.sql
- Create: a-proposal2/supabase/seed.sql

Tables:

- tenants
- tenant_users (membership + role)
- pms_configurations
- waha_configurations
- guests
- reservations
- message_templates
- message_logs
- inbound_events (dedupe/idempotency)
- automation_jobs (queue state)

RLS Requirements:

- All tenant-scoped tables require tenant_id policy
- tenant_users role drives authorization scope
- Service role only for server-side privileged operations

Acceptance Criteria:

- Cross-tenant reads/writes are blocked by policy
- Tenant member can only access own tenant records

### Task 0.3: Auth, middleware, tenant context, RBAC

Files:

- Create: a-proposal2/lib/supabase/client.ts
- Create: a-proposal2/lib/supabase/server.ts
- Create: a-proposal2/middleware.ts
- Create: a-proposal2/lib/auth/rbac.ts

Rules:

- Use cookie-based SSR client approach
- Middleware refreshes auth session and resolves tenant
- RBAC roles: owner, admin, agent

Acceptance Criteria:

- Protected routes redirect unauthenticated users
- RBAC checks enforced in APIs and server actions

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

## Phase 1: Core UI and Tenant Dashboard

### Task 1.1: Base UI components

Files:

- Create: a-proposal2/lib/utils.ts
- Create: a-proposal2/components/ui/button.tsx
- Create: a-proposal2/components/ui/input.tsx
- Create: a-proposal2/components/ui/card.tsx
- Create: a-proposal2/components/ui/table.tsx
- Create: a-proposal2/components/ui/label.tsx
- Create: a-proposal2/components/ui/badge.tsx
- Create: a-proposal2/components/ui/tabs.tsx

### Task 1.2: App shell and navigation

Files:

- Create: a-proposal2/app/layout.tsx
- Create: a-proposal2/app/globals.css
- Create: a-proposal2/app/(auth)/login/page.tsx
- Create: a-proposal2/app/(dashboard)/layout.tsx
- Create: a-proposal2/components/layout/sidebar.tsx

### Task 1.3: Dashboard page

Files:

- Create/Modify: a-proposal2/app/(dashboard)/page.tsx

Features:

- Stats cards: total guests, active reservations, messages sent, occupancy rate
- Recent reservations list

### Task 1.4: Guests management page

Files:

- Create: a-proposal2/app/(dashboard)/guests/page.tsx
- Create: a-proposal2/components/guests/guests-table.tsx

Columns:

- Name
- Phone
- Email
- Country
- Tier
- Points
- Joined
- Actions

Acceptance Criteria (Phase 1):

- Tenant user sees only tenant data
- Guest table supports basic pagination and empty states

---

## Phase 2: PMS Integration (MVP = one adapter first)

### Task 2.1: Reservations page and status tabs

Files:

- Create: a-proposal2/app/(dashboard)/reservations/page.tsx
- Create: a-proposal2/components/reservations/reservations-table.tsx

Features:

- Tabs: all, pre-arrival, on-stay, checked-out
- Columns: guest, room, dates, status, amount, source

### Task 2.2: PMS adapter contract

Files:

- Create: a-proposal2/lib/pms/adapter.ts

Adapter interface must include:

- Pull reservations by date range
- Pull guest profile
- Map PMS status to internal status
- Verify webhook payload authenticity (when supported)

### Task 2.3: First production adapter

Files:

- Create: a-proposal2/lib/pms/cloudbeds-adapter.ts OR a-proposal2/lib/pms/mews-adapter.ts

### Task 2.4: Additional adapters (deferred after MVP)

Files:

- Create: a-proposal2/lib/pms/cloudbeds-adapter.ts (if not first)
- Create: a-proposal2/lib/pms/mews-adapter.ts (if not first)
- Create: a-proposal2/lib/pms/custom-adapter.ts

Acceptance Criteria (Phase 2):

- One adapter passes sync smoke test end-to-end
- Internal reservation status mapping is deterministic and documented

---

## Phase 3: WAHA Integration and Messaging Config

### Task 3.1: WAHA client and service

Files:

- Create: a-proposal2/lib/waha/client.ts
- Create: a-proposal2/lib/waha/service.ts

Capabilities:

- Start/stop session
- Get session status
- Get QR code
- Send text message

### Task 3.2: Settings page for WAHA + PMS config

Files:

- Create: a-proposal2/app/(dashboard)/settings/page.tsx
- Create: a-proposal2/components/settings/waha-qr-modal.tsx

Sections:

- WAHA URL and API key config
- Session status indicator
- QR visualization
- PMS configuration (type, endpoint, credentials)

### Task 3.3: Message templates

Files:

- Create: a-proposal2/app/(dashboard)/settings/templates/page.tsx
- Create: a-proposal2/components/settings/template-form.tsx

Triggers:

- pre-arrival
- on-stay
- post-stay

Variables:

- {{guestName}}, {{roomNumber}}, {{checkInDate}}, {{checkOutDate}}

Security Requirement:

- Encrypt sensitive credentials before storing
- Mask credentials in UI and logs

Acceptance Criteria (Phase 3):

- WAHA session can be connected via QR
- Test message can be sent successfully from settings

---

## Phase 4: Automation Engine (Reliable Delivery)

### Task 4.1: PMS webhook endpoint

Files:

- Create: a-proposal2/app/api/webhooks/pms/route.ts

Required controls:

- Signature/token verification
- Timestamp validation
- Replay protection (nonce or event id cache)
- Idempotency on event ingestion

### Task 4.2: Status trigger engine

Files:

- Create: a-proposal2/lib/automation/status-trigger.ts

Flow:

1. Receive webhook event
2. Validate and dedupe event
3. Detect status transition
4. Resolve active template
5. Render variables
6. Enqueue send job
7. Persist log and delivery state

### Task 4.3: Queue, retry, dead-letter

Files:

- Create: a-proposal2/lib/automation/queue.ts
- Create: a-proposal2/lib/automation/retry-policy.ts

Policy:

- Exponential backoff retries
- Max attempts then dead-letter state
- Retry only for retryable failures

### Task 4.4: Scheduled trigger runner

Files:

- Create: a-proposal2/app/api/cron/automation/route.ts
- Create: a-proposal2/lib/automation/scheduler.ts

Use cases:

- Pre-arrival messages 1-2 days before check-in
- Post-stay feedback after checkout

### Task 4.5: Manual send API and dialog

Files:

- Create: a-proposal2/app/api/messages/send/route.ts
- Create: a-proposal2/components/messages/send-dialog.tsx

Features:

- Pick reservation/guest
- Preview rendered template
- Send immediately

Acceptance Criteria (Phase 4):

- Duplicate webhook payload does not send duplicate message
- Failed sends are retried and visible in logs
- Scheduled jobs execute in expected windows

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

### Task 6.1: AI-ready placeholders

Files:

- Create: a-proposal2/lib/ai/types.ts
- Create: a-proposal2/app/api/ai/chat/route.ts

Notes:

- Keep as placeholder only after MVP stability
- Do not block launch on AI scope

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
