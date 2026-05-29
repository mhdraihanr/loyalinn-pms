# Hotel PMS Integration & WhatsApp Automation with Agentic AI Web App

A hotel operations platform that integrates Property Management Systems (PMS) with WhatsApp automation, lifecycle AI agents, and realtime operational dashboards. The app synchronizes reservations and guest profiles, sends automated WAHA-powered WhatsApp messages, escalates post-stay feedback into AI follow-up, and turns guest requests into staff-visible queues.

---

## Demo Videos

| #      | Title                 | Duration | Link                                         |
| ------ | --------------------- | -------- | -------------------------------------------- |
| Part 1 | Setup & Configuration | 6 min    | [Watch Part 1](https://youtu.be/CRnbs8ynPdM) |
| Part 2 | Website Flow          | 12 min   | [Watch Part 2](https://youtu.be/8gTwNlM64_M) |

---

## Features

- **Role-based access control** — owners manage settings, team members, PMS, WAHA, templates, and AI settings; staff focus on operational hotel data.
- **Supabase Auth and RLS** — access-scoped tables are protected with Row Level Security and `SECURITY DEFINER` helpers to avoid recursive policy failures.
- **Webhook-first PMS ingestion** — QloApps events are the primary trigger for inbound reservation synchronization and status-driven automation.
- **Low-frequency reconciliation fallback** — pull sync remains available as an explicit recovery/reconciliation path instead of the primary production mechanism.
- **QloApps-ready integration path** — QloApps adapter, module packaging, setup guide, and webhook-first runtime documentation.
- **WhatsApp automation through WAHA** — session control, QR login, status polling, outbound messaging, and inbound webhook handling.
- **Lifecycle automation engine** — idempotent inbound event handling, Postgres-backed automation jobs, retry policy, scheduler, and message logs.
- **Duplicate-safe lifecycle sends** — status-trigger automation checks existing successful message logs before sending and only treats `on-stay` as realtime automation when a reservation actually transitions into `on-stay`.
- **Lifecycle AI agents** — pre-arrival, on-stay, and post-stay AI workflows with tool calling and observability logs.
- **Operations dashboard** — staff-facing dashboards with database-backed updates and room for future browser push via Supabase Realtime/SSE/WebSockets.
- **Feedback workflow** — post-stay feedback forms, feedback monitor dashboard, 24-hour escalation, and AI follow-up handoff.
- **Configurable AI assistant** — hotel name, AI name, tone of voice, and custom instructions injected into runtime prompts.
- **Multilingual templates** — template triggers and variants support localized guest messaging.
- **Observability baseline** — structured logs with request, tenant, reservation, job, and lifecycle routing context.

---

## Tech Stack

### Frontend

| Technology   | Version | Purpose                                           |
| ------------ | ------- | ------------------------------------------------- |
| Next.js      | 16.1    | App Router, SSR, API routes, middleware           |
| React        | 19.2    | UI framework                                      |
| TypeScript   | 5.x     | Type safety                                       |
| Mantine UI   | 8.3     | Dashboard components, tables, tabs, forms, modals |
| Tailwind CSS | 4.x     | Utility styling                                   |
| Tabler Icons | 3.36    | Icon library                                      |
| Day.js       | 1.11    | Date formatting                                   |

### Backend, Data, and Automation

| Technology               | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| Supabase                 | PostgreSQL, Auth, Realtime, RLS, service-role background work |
| Next.js API Routes       | Cron endpoints, WAHA control endpoints, webhook ingestion     |
| WAHA                     | Self-hosted WhatsApp HTTP API                                 |
| AI SDK + Google provider | Lifecycle AI agents and Gemini model integration              |
| Zod                      | Runtime validation and environment/input contracts            |
| Vitest                   | Unit and integration tests                                    |
| ESLint                   | Static analysis                                               |

### External Integrations

| Service              | Purpose                                                                        |
| -------------------- | ------------------------------------------------------------------------------ |
| PMS adapter contract | Generic reservation and guest ingestion interface                              |
| QloApps              | First production-oriented PMS integration target                               |
| WAHA                 | WhatsApp sessions, QR pairing, outbound messages, inbound webhooks             |
| Gemini               | AI replies, lifecycle routing, and tool calling through the Google AI provider |

---

## Architecture

```text
Hotel PMS / QloApps
    │
    ├── Webhook events (primary)
    ├── Reconciliation pull sync (fallback)
    ▼
Next.js API Routes
    ├── /api/webhooks/pms          → webhook-first PMS ingress
    ├── /api/cron/pms-sync         → explicit fallback reconciliation
    ├── /api/cron/automation       → automation worker
    └── /api/waha/*                → WAHA session control
    │
    ▼
Supabase PostgreSQL
    ├── tenants / tenant_users / invitations
    ├── guests / reservations
    ├── inbound_events / automation_jobs / message_logs
    ├── message_templates / message_template_variants
    ├── lifecycle_ai_sessions / feedback records
    └── housekeeping_requests / room_service_orders / arrival_requests
    │
    ├── Realtime subscriptions → future browser push / operational dashboards
    └── RLS policies + service-role background jobs
    │
    ▼
Automation + Lifecycle AI
    ├── status-trigger engine
    ├── scheduler and retry policy
    ├── pre-arrival AI tools
    ├── on-stay AI tools
    └── post-stay feedback AI follow-up
    │
    ▼
WAHA WhatsApp API
    ├── outbound guest messaging
    └── inbound reply webhook back to Next.js
```

**Core pattern:** inbound events are normalized, deduplicated, and written to Supabase. PMS webhook events are the primary source for reservation changes; pull sync is reserved for reconciliation and recovery. Automation jobs are claimed asynchronously, rendered from templates, sent through WAHA, and logged for observability. AI agents can create operational rows that are shown in realtime staff dashboards.

Lifecycle send guardrails: a reservation must not receive the same successful lifecycle trigger twice. The status-trigger worker checks prior `message_logs` rows with `status = sent` for the same reservation and trigger before calling WAHA. Realtime QloApps `on-stay` automation is enqueueable only on a true status transition into `on-stay`; other reservation field changes while already `on-stay` must not create another `on-stay` send.

For the QloApps webhook-first integration path, configure the PMS sender to call `/api/webhooks/pms`.

---

## Project Structure

```text
a-proposal2/
├── app/
│   ├── (auth)/                     # Login, signup, onboarding, accept-invite flow
│   ├── (dashboard)/                # Dashboard, guests, reservations, operations, settings
│   ├── api/                        # Cron routes, webhooks, WAHA routes, dev utilities
│   └── feedback/[token]/           # Public post-stay feedback form
├── components/
│   ├── dashboard/                  # Dashboard widgets
│   ├── feedback/                   # Feedback form and monitor table
│   ├── guests/                     # Guest management table
│   ├── layout/                     # Sidebar and auto-refresh components
│   ├── operations/                 # Realtime operational queues
│   ├── reservations/               # Reservation table and status tabs
│   └── settings/                   # PMS, WAHA, templates, team, AI settings
├── lib/
│   ├── actions/                    # Server actions for dashboard operations
│   ├── ai/                         # Lifecycle AI agents, prompts, tools, settings
│   ├── auth/                       # Tenant context, invitations, login/signup/onboarding
│   ├── automation/                 # Queue, scheduler, idempotency, triggers, templates
│   ├── data/                       # Server-side dashboard data access
│   ├── observability/              # Structured logging
│   ├── pms/                        # PMS adapters, config, auto-sync service
│   ├── supabase/                   # Client, server, and admin Supabase helpers
│   └── waha/                       # WAHA HTTP client
├── supabase/
│   ├── migrations/                 # Versioned database migrations
│   ├── schema.sql                  # Current schema snapshot
│   └── seed.sql                    # Seed data
└── package.json
```

---

## Requirements

| Software / Service | Minimum / Expected                             |
| ------------------ | ---------------------------------------------- |
| Node.js            | 20.x recommended                               |
| pnpm               | Compatible with the checked-in lockfile        |
| Supabase project   | PostgreSQL, Auth, Realtime, service-role key   |
| WAHA instance      | Reachable HTTP API with API key                |
| Google AI API key  | Required for Gemini lifecycle AI features      |
| PMS test source    | Mock adapter or QloApps-compatible environment |

---

## Environment Variables

Create a local environment file and provide the values used by your deployment.

| Group                 | Variables                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| App                   | `NEXT_PUBLIC_APP_URL`                                                                           |
| Supabase              | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| WAHA                  | `WAHA_BASE_URL`, `WAHA_API_KEY`                                                                 |
| PMS webhook           | `PMS_WEBHOOK_SECRET`                                                                            |
| PMS reconciliation    | `PMS_RECONCILIATION_ENABLED`, `PMS_RECONCILIATION_CRON_SECRET`                                  |
| PMS dev scheduler     | `PMS_DEV_SYNC_ENABLED`, `DEV_PMS_SYNC_INTERVAL_MS`                                              |
| Automation dev worker | `DEV_AUTOMATION_SYNC_ENABLED`, `DEV_AUTOMATION_SYNC_INTERVAL_MS`                                |
| AI                    | `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_MODEL`                                                  |
| Debugging             | `LIFECYCLE_AI_DEBUG`, `AI_FEEDBACK_DEBUG`                                                       |

Local development is standardized in the documentation around `GEMINI_MODEL=gemini-2.5-flash` for lifecycle tool-calling consistency.

For QloApps webhook integration, `PMS_WEBHOOK_SECRET` must exactly match the `Shared Secret` configured in the QloApps module that calls `/api/webhooks/pms`.

Recommended runtime mode:

- `PMS_RECONCILIATION_ENABLED=false` for normal webhook-first operation.
- Enable reconciliation only for recovery, audits, or scheduled low-frequency safety sync.
- Keep `PMS_DEV_SYNC_ENABLED=false` unless you intentionally need development-only pull testing.
- The default dashboard runtime no longer performs a 10-second browser refresh loop.

---

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment variables

Create `.env.local` in the project root and fill in the required Supabase, WAHA, PMS, and AI values.

### 3. Apply database schema

Apply the SQL files in `supabase/migrations/` to the target Supabase project using your preferred Supabase migration workflow.

### 4. Start the development server

```bash
pnpm dev
```

Open `http://localhost:3000` and follow the flow:

1. Sign up with email and password.
2. Log in.
3. Choose owner onboarding and create your workspace.
4. Configure PMS, WAHA, templates, team, and AI settings from the dashboard.

## QloApps Module Installation

For QloApps webhook-first delivery, use the module source in `qloapps-module/loyalinnwebhooksync`.

- Build the uploadable ZIP with `pnpm package:qloapps-module`.
- The packaged file is created at `qloapps-module/dist/loyalinnwebhooksync.zip`.
- Install it from the QloApps back office, or copy the `loyalinnwebhooksync` folder into the QloApps `modules/` directory and install it from Modules.
- Configure `Webhook Endpoint URL`, `Tenant Key`, `Shared Secret`, and `Enabled` in the module settings.
- `Tenant Key` must match `tenants.slug`, and `Shared Secret` must match `PMS_WEBHOOK_SECRET`.
- If QloApps runs in Docker and this app runs on the host machine, set `Webhook Endpoint URL` to `http://host.docker.internal:3000/api/webhooks/pms`.
- Do not use `http://localhost:3000/api/webhooks/pms` in that Docker setup, because `localhost` will point to the QloApps container itself.
- After saving settings, use `Send Test Event` to verify connectivity and signature handling.

---

## Available Scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `pnpm dev`        | Start the Next.js development server |
| `pnpm build`      | Build the application for production |
| `pnpm start`      | Start the production server          |
| `pnpm lint`       | Run ESLint                           |
| `pnpm test`       | Run Vitest once                      |
| `pnpm test:watch` | Run Vitest in watch mode             |

---

## Role System

| Role  | Access                                                                                                      |
| ----- | ----------------------------------------------------------------------------------------------------------- |
| Owner | Full system control: settings, PMS, WAHA, team invitations, templates, AI assistant, operational dashboards |
| Staff | Operational access: dashboard data, guests, reservations, messages, feedback monitor, and operations queues |

User access is enforced through role membership and scoped data policies.

---

## Database Model

The platform uses Supabase PostgreSQL with RLS enabled across access-scoped tables.

| Area             | Key Tables                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------- |
| User access      | `tenant_users`, `invitations`                                                                |
| Integrations     | `pms_configurations`, `waha_configurations`, `ai_settings`                                   |
| Hotel operations | `guests`, `reservations`, `housekeeping_requests`, `room_service_orders`, `arrival_requests` |
| Messaging        | `message_templates`, `message_template_variants`, `message_logs`                             |
| Automation       | `inbound_events`, `automation_jobs`, lifecycle session tables                                |
| Feedback         | reservation feedback fields, feedback tokens/forms, escalation state                         |

Important database practices:

- all schema changes are represented as migrations;
- RLS scopes application data through access checks;
- background jobs use the Supabase service role intentionally;
- queue claiming uses database-level locking patterns for safe concurrent work;
- idempotency keys prevent duplicate webhook and automation side effects.

---

## Operational Notes

- Enable `LIFECYCLE_AI_DEBUG=true` only during focused AI routing or tool-calling triage.
- WAHA webhook duplication can happen when both global and session webhooks are configured with overlapping events; current guardrails normalize events and skip redundant registration when a global webhook is already present.
- The Operations dashboard shows active AI-generated operational rows; completed, resolved, or cancelled rows remain in the database for audit/history.
- Some historical verification notes mention unrelated pre-existing lint or type-check failures. Check the latest task-specific document before treating those as regressions.
