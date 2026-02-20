# Phase 1: Core UI and Tenant Dashboard

> **Status:** ✅ COMPLETED  
> **Updated:** 2026-02-18

---

## Overview

Phase 1 built the complete user-facing layer of the application — auth pages, dashboard shell, guest management, and the full staff invite flow backed by the `invitations` table introduced in this phase.

UI stack switched from shadcn/ui (originally planned) to **Mantine v8** for full RSC compatibility.

```
/(auth)                          /(dashboard)
├── /login                       ├── /                  ← dashboard
├── /signup                      └── /guests
├── /onboarding
├── /onboarding/create-tenant
└── /accept-invite?token=<uuid>
```

---

## Tasks Completed

### ✅ Task 1.1: Base UI Components

Mantine v8 adopted as component library (replaces shadcn/ui plan).

| Component     | Source                   |
| ------------- | ------------------------ |
| Button        | `@mantine/core`          |
| Input         | `@mantine/core`          |
| Card / Paper  | `@mantine/core`          |
| Table         | `@mantine/core`          |
| Badge         | `@mantine/core`          |
| Tabs          | `@mantine/core`          |
| Notifications | `@mantine/notifications` |

No custom `components/ui/` primitives needed — Mantine provides all of them.

### ✅ Task 1.2: App Shell and Navigation

| File                            | Purpose                                     |
| ------------------------------- | ------------------------------------------- |
| `app/layout.tsx`                | Root layout — MantineProvider, theme, fonts |
| `app/globals.css`               | Base CSS resets                             |
| `app/(auth)/layout.tsx`         | Centered card layout for auth pages         |
| `app/(dashboard)/layout.tsx`    | Sidebar + main content layout               |
| `components/layout/sidebar.tsx` | Nav links, tenant name, role badge          |
| `lib/auth/logout.ts`            | Server action — `supabase.auth.signOut()`   |

### ✅ Task 1.3: Dashboard Page

Route: `/(dashboard)/` (`app/(dashboard)/page.tsx`)

- Stats cards: Total Guests, Active Reservations, Messages Sent, Occupancy Rate
- Recent reservations placeholder list
- Data fetched server-side per tenant (RLS-filtered)

### ✅ Task 1.4: Guests Management Page

Route: `/(dashboard)/guests` (`app/(dashboard)/guests/page.tsx`)

| File                                 | Purpose                      |
| ------------------------------------ | ---------------------------- |
| `app/(dashboard)/guests/page.tsx`    | Server page — fetches guests |
| `components/guests/guests-table.tsx` | Client table component       |

**Columns:** Name · Phone · Email · Country · Tier · Points · Joined · Actions

### ✅ Task 1.5: Auth UI — Signup, Login, Accept Invite

#### New invite flow: `invitations` table (replaces `user_metadata` approach)

Owner sends invite → row inserted into `invitations` table with UUID token + 7-day expiry → email sent with `/accept-invite?token=<uuid>`.

**Full accept-invite flow:**

```
Staff clicks /accept-invite?token=<uuid>
    ↓
[Server: look up invitations by token — admin client]
    ├─ Not found / expired   → InviteErrorBox
    ├─ Already accepted      → redirect /login
    └─ Valid (pending)?
         ↓
    [Is invited_email a registered user?]
         ├─ NOT registered
         │   → redirect /signup?invite_token=<token>&email=<locked>
         │       - Email field: pre-filled + readOnly + "Locked" badge
         │       - Password + confirm password
         │       - After signup → redirect /login?invite_token=<token>
         │
         └─ Already registered
              ├─ Not logged in → redirect /login?invite_token=<token>
              │                  → after login → redirect /accept-invite?token=<token>
              └─ Logged in
                   → show tenant name + invited email
                   → "Accept invitation" button
                   → acceptStaffInvitation(userId, token)
                       ✓ tenant_users inserted (role='staff')
                       ✓ invitations.status = 'accepted'
                   → redirect /(dashboard)/
```

**Auth files:**

| File                                       | Purpose                                                              |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `app/(auth)/signup/page.tsx`               | Signup form — normal + invite mode (locked email)                    |
| `app/(auth)/login/page.tsx`                | Login form — passes `invite_token` through hidden input              |
| `app/(auth)/accept-invite/page.tsx`        | Server page — full invite validation + accept form                   |
| `components/auth/accept-invite-button.tsx` | `"use client"` submit button with loading state                      |
| `components/auth/invite-error-box.tsx`     | Reusable invite error UI                                             |
| `lib/auth/signup.ts`                       | Server action — handles normal + invite signup                       |
| `lib/auth/login.ts`                        | Server action — redirects to `/accept-invite` if token present       |
| `lib/auth/invitations.ts`                  | `getInvitationByToken`, `inviteStaffMember`, `acceptStaffInvitation` |

**Migration added:**

`supabase/migrations/20260218000000_add_invitations_table.sql`

```
invitations
├── id            UUID PK
├── tenant_id     UUID → tenants(id)
├── invited_email TEXT
├── invited_by    UUID → auth.users(id)
├── token         UUID UNIQUE  ← lookup key
├── status        TEXT CHECK ('pending'|'accepted'|'expired')
├── expires_at    TIMESTAMPTZ  ← 7 days from creation
├── accepted_by   UUID → auth.users(id)
└── created_at    TIMESTAMPTZ
```

RLS: owners manage invitations for their tenant. Token lookup via admin client (no public SELECT).

### ✅ Task 1.6: Onboarding Flow and Create Tenant Page

| File                                           | Purpose                                  |
| ---------------------------------------------- | ---------------------------------------- |
| `app/(auth)/onboarding/page.tsx`               | Choice: "I own a hotel" / "Invited"      |
| `app/(auth)/onboarding/create-tenant/page.tsx` | Form: hotel name → createTenantAsOwner() |
| `lib/auth/onboarding.ts`                       | `createTenantAsOwner()` server action    |

---

## Route Protection Flow

```
User visits app
    ↓
[middleware.ts — refreshes session]
    ├─ No session?          → /login
    └─ Has session?
        ├─ Has tenant?      → /(dashboard)/
        └─ No tenant?       → /onboarding
```

### User Scenarios

| Scenario                                     | Flow                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------- |
| Brand new owner                              | /signup → /login → /onboarding → /onboarding/create-tenant → /        |
| Owner with existing tenant                   | /login → /                                                            |
| Staff invited, **not registered**            | /accept-invite → /signup (locked email) → /login → /accept-invite → / |
| Staff invited, **registered**, not logged in | /accept-invite → /login → /accept-invite → /                          |
| Staff invited, **registered**, logged in     | /accept-invite → /                                                    |
| Invite expired (>7 days)                     | /accept-invite → error page                                           |
| Invite already accepted                      | /accept-invite → redirect /login                                      |

---

## Project Structure (Phase 1 additions)

```
a-proposal2/
├── app/
│   ├── layout.tsx                          # Root — MantineProvider
│   ├── globals.css
│   ├── (auth)/
│   │   ├── layout.tsx                      # Centered auth layout
│   │   ├── login/page.tsx                  # Login form (invite_token aware)
│   │   ├── signup/page.tsx                 # Signup form (locked email for invites)
│   │   ├── onboarding/
│   │   │   ├── page.tsx                    # Owner / Invited choice
│   │   │   └── create-tenant/page.tsx      # Hotel name form
│   │   └── accept-invite/
│   │       └── page.tsx                    # Full invite validation + accept
│   └── (dashboard)/
│       ├── layout.tsx                      # Sidebar layout
│       ├── page.tsx                        # Dashboard stats
│       └── guests/page.tsx                 # Guests table
├── components/
│   ├── auth/
│   │   ├── accept-invite-button.tsx        # "use client" submit button
│   │   └── invite-error-box.tsx            # Reusable invite error card
│   ├── guests/
│   │   └── guests-table.tsx                # Client table
│   └── layout/
│       └── sidebar.tsx                     # Nav + tenant name + role badge
├── lib/
│   ├── auth/
│   │   ├── login.ts                        # Server action (invite_token redirect)
│   │   ├── logout.ts                       # Server action
│   │   ├── signup.ts                       # Server action (invite + normal modes)
│   │   ├── onboarding.ts                   # createTenantAsOwner
│   │   ├── invitations.ts                  # getInvitationByToken, invite, accept
│   │   └── tenant.ts                       # getCurrentUserTenant, requireOwner
│   └── data/
│       ├── dashboard.ts                    # Extracted dashboard data queries
│       └── guests.ts                       # Extracted guests data queries
└── supabase/
    └── migrations/
        └── 20260218000000_add_invitations_table.sql
```

---

## Acceptance Criteria — All Met ✅

**Auth & Routing:**

- ✅ Unauthenticated users → /login
- ✅ Authenticated, no tenant → /onboarding
- ✅ Authenticated, has tenant → /(dashboard)/

**Signup:**

- ✅ Creates user account (email + password only — no tenant)
- ✅ After signup, must login to proceed
- ✅ Invite mode: email pre-filled, readonly, locked badge
- ✅ Invite token validated server-side before account creation

**Login:**

- ✅ Email + password
- ✅ With `invite_token`: redirects to `/accept-invite?token=<uuid>` after login
- ✅ Without token: redirects to `/` (middleware routes to dashboard or onboarding)

**Onboarding:**

- ✅ Owner creates tenant from /onboarding/create-tenant
- ✅ Cannot create 2nd tenant (UNIQUE constraint enforced)
- ✅ Staff option shows instruction to check email

**Staff Invite:**

- ✅ `invitations` table — UUID token, 7-day expiry, status tracking
- ✅ `/accept-invite` validates token via admin client (bypasses RLS)
- ✅ Expired / revoked token → InviteErrorBox (no tenant_users record created)
- ✅ Already-accepted token → redirect /login
- ✅ Not registered staff → redirect /signup with locked email
- ✅ Registered staff, not logged in → redirect /login with token
- ✅ Email mismatch → error (cannot accept invite meant for different email)
- ✅ Accept → tenant_users(role='staff') + invitations.status='accepted'

**Data & Security:**

- ✅ RLS enforced — all queries tenant-scoped
- ✅ 1 user cannot belong to 2 tenants
- ✅ Staff cannot invite others or create tenants
- ✅ Token lookup uses admin client — no public enumeration of invited emails
- ✅ Production build passing

---

## Notable Changes from Original Plan

| Planned                                         | Actual                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------- |
| Tailwind CSS + shadcn/ui                        | **Mantine v8** (full RSC support, no client wrapper issues)             |
| Invite via `user_metadata`                      | **`invitations` table** with UUID token + expiry (queryable, revokable) |
| Single signup flow                              | **Two modes:** normal owner signup + invite-locked staff signup         |
| `components/ui/*` primitives                    | Not needed — Mantine provides all primitives                            |
| `accept-invite-button.tsx` co-located in `app/` | Moved to `components/auth/`                                             |
| Page components fetch data directly             | **Extracted to `lib/data/`** for better separation of concerns          |

---

## Next: Phase 2 — PMS Integration

1. Build `/reservations` page with status tabs (pre-arrival, on-stay, checked-out)
2. Define PMS adapter contract (`lib/pms/adapter.ts`)
3. Implement first production adapter (Cloudbeds or Mews)
4. Webhook endpoint + deduplification

---

**Status:** ✅ COMPLETED | **Build:** ✅ Passing | **Architecture:** Token-based invite flow via `invitations` table
