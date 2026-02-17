# Phase 0: Foundations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish the foundational infrastructure for a multi-tenant Hotel PMS Integration & WhatsApp Automation web app with Next.js 14, Supabase, and WAHA.

**Architecture:** Multi-tenant SaaS architecture with tenant isolation enforced at both database (RLS) and application layers. Cookie-based SSR authentication with middleware-driven session management. Event-driven automation with idempotency guarantees.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Postgres + Auth + Realtime), WAHA (WhatsApp HTTP API)

---

## Task 0.1: Project Bootstrap and Environment Contract

**Files:**

- Create: `package.json`
- Create: `next.config.js`
- Create: `tailwind.config.ts`
- Create: `tsconfig.json`
- Create: `.env.local.example`
- Create: `.gitignore`
- Create: `postcss.config.js`

**Step 1: Initialize Next.js project with TypeScript and Tailwind**

Run the following command to create a new Next.js project:

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

Expected: Next.js 14 project initialized with TypeScript, Tailwind CSS, and App Router enabled.

**Step 2: Install additional dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D @types/node
```

Expected: Supabase client libraries installed.

**Step 3: Create environment variables template**

Create `.env.local.example`:

```env
# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# WAHA Configuration
WAHA_BASE_URL=http://localhost:3000
WAHA_API_KEY=your-waha-api-key

# PMS Webhook Configuration
PMS_WEBHOOK_SECRET=your-webhook-secret
```

**Step 4: Update next.config.js with proper configuration**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
```

**Step 5: Verify environment validation**

Create `lib/env.ts`:

```typescript
export function validateEnv() {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        "Please copy .env.local.example to .env.local and fill in the values.",
    );
  }
}
```

**Step 6: Test app startup**

```bash
npm run dev
```

Expected: App starts on http://localhost:3000 without errors.

**Step 7: Commit**

```bash
git add .
git commit -m "feat: initialize Next.js 14 project with TypeScript and Tailwind"
```

---

## Task 0.2: Multi-tenant Schema + RLS Baseline

**Files:**

- Create: `supabase/schema.sql`
- Create: `supabase/seed.sql`

**Step 1: Create Supabase directory structure**

```bash
mkdir -p supabase
```

**Step 2: Create comprehensive database schema**

Create `supabase/schema.sql`:

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants table
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant users table (membership + role)
CREATE TABLE tenant_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'agent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, user_id)
);

-- PMS configurations table
CREATE TABLE pms_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pms_type TEXT NOT NULL CHECK (pms_type IN ('cloudbeds', 'mews', 'custom')),
  endpoint TEXT NOT NULL,
  credentials JSONB NOT NULL, -- Encrypted credentials
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- WAHA configurations table
CREATE TABLE waha_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_connected BOOLEAN DEFAULT false,
  qr_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Guests table
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pms_guest_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  tier TEXT DEFAULT 'standard',
  points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, pms_guest_id)
);

-- Reservations table
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  pms_reservation_id TEXT,
  room_number TEXT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pre-arrival', 'on-stay', 'checked-out', 'cancelled')),
  amount DECIMAL(10, 2),
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, pms_reservation_id)
);

-- Message templates table
CREATE TABLE message_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('pre-arrival', 'on-stay', 'post-stay')),
  content TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Message logs table
CREATE TABLE message_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
  template_id UUID REFERENCES message_templates(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'retrying')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inbound events table (dedupe/idempotency)
CREATE TABLE inbound_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, event_id)
);

-- Automation jobs table (queue state)
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'dead-letter')),
  payload JSONB NOT NULL,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  scheduled_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security Policies

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pms_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE waha_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_jobs ENABLE ROW LEVEL SECURITY;

-- Tenant users can only see their own tenant
CREATE POLICY "Users can view their tenant" ON tenants
  FOR SELECT USING (
    id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Tenant users policies
CREATE POLICY "Users can view their tenant memberships" ON tenant_users
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- PMS configurations policies
CREATE POLICY "Users can view their tenant PMS config" ON pms_configurations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- WAHA configurations policies
CREATE POLICY "Users can manage their tenant WAHA config" ON waha_configurations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Guests policies
CREATE POLICY "Users can manage their tenant guests" ON guests
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Reservations policies
CREATE POLICY "Users can manage their tenant reservations" ON reservations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Message templates policies
CREATE POLICY "Users can manage their tenant templates" ON message_templates
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Message logs policies
CREATE POLICY "Users can view their tenant message logs" ON message_logs
  FOR SELECT USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid()
    )
  );

-- Inbound events policies (service role only)
CREATE POLICY "Service role can manage inbound events" ON inbound_events
  FOR ALL USING (true);

-- Automation jobs policies (service role only)
CREATE POLICY "Service role can manage automation jobs" ON automation_jobs
  FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX idx_guests_tenant_id ON guests(tenant_id);
CREATE INDEX idx_reservations_tenant_id ON reservations(tenant_id);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_message_logs_tenant_id ON message_logs(tenant_id);
CREATE INDEX idx_inbound_events_event_id ON inbound_events(event_id);
CREATE INDEX idx_automation_jobs_status ON automation_jobs(status);
```

**Step 3: Create seed data**

Create `supabase/seed.sql`:

```sql
-- Insert demo tenant
INSERT INTO tenants (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Demo Hotel', 'demo-hotel');

-- Note: tenant_users will be populated when users sign up
-- The following is just for reference during development

-- Insert demo message templates
INSERT INTO message_templates (tenant_id, name, trigger, content, is_active) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Pre-arrival Welcome', 'pre-arrival',
   'Hello {{guestName}}! Welcome to our hotel. Your room {{roomNumber}} will be ready on {{checkInDate}}. We look forward to seeing you!',
   true),
  ('00000000-0000-0000-0000-000000000001', 'Check-in Confirmation', 'on-stay',
   'Welcome {{guestName}}! You are now checked in to room {{roomNumber}}. Enjoy your stay!',
   true),
  ('00000000-0000-0000-0000-000000000001', 'Post-stay Feedback', 'post-stay',
   'Thank you for staying with us, {{guestName}}! We hope you enjoyed your stay. Please share your feedback!',
   true);
```

**Step 4: Document schema in README**

Create `supabase/README.md`:

```markdown
# Supabase Database Schema

## Setup

1. Create a new Supabase project at https://supabase.com
2. Run the schema.sql file in the SQL Editor
3. Run the seed.sql file for demo data
4. Copy the project URL and anon key to .env.local

## Tables

- **tenants**: Multi-tenant isolation root table
- **tenant_users**: User membership and roles (owner, admin, agent)
- **pms_configurations**: PMS integration settings per tenant
- **waha_configurations**: WhatsApp API settings per tenant
- **guests**: Guest profiles synced from PMS
- **reservations**: Reservation data synced from PMS
- **message_templates**: Customizable message templates
- **message_logs**: Audit trail of all messages sent
- **inbound_events**: Webhook event deduplication
- **automation_jobs**: Message queue with retry logic

## Row Level Security

All tenant-scoped tables enforce RLS based on tenant_users membership.
Service role is required for webhook and automation operations.
```

**Step 5: Verify schema can be applied**

Expected: Schema file is syntactically correct and ready to be applied to Supabase project.

**Step 6: Commit**

```bash
git add supabase/
git commit -m "feat: add multi-tenant database schema with RLS"
```

---

## Task 0.3: Auth, Middleware, Tenant Context, RBAC

**Files:**

- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `middleware.ts`
- Create: `lib/auth/rbac.ts`
- Create: `lib/auth/tenant.ts`

**Step 1: Create client-side Supabase client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
```

**Step 2: Create server-side Supabase client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}
```

**Step 3: Create middleware for auth and tenant resolution**

Create `middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect dashboard routes
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users from auth pages
  if (
    user &&
    (request.nextUrl.pathname === "/login" ||
      request.nextUrl.pathname === "/signup")
  ) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

**Step 4: Create RBAC utilities**

Create `lib/auth/rbac.ts`:

```typescript
export type Role = "owner" | "admin" | "agent";

export const ROLE_PERMISSIONS = {
  owner: ["*"], // Full access
  admin: [
    "guests:read",
    "guests:write",
    "reservations:read",
    "reservations:write",
    "messages:read",
    "messages:send",
    "templates:read",
    "templates:write",
    "settings:read",
    "settings:write",
  ],
  agent: [
    "guests:read",
    "reservations:read",
    "messages:read",
    "messages:send",
    "templates:read",
  ],
} as const;

export function hasPermission(role: Role, permission: string): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions.includes("*") || permissions.includes(permission);
}

export function requirePermission(role: Role, permission: string): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Insufficient permissions. Required: ${permission}`);
  }
}
```

**Step 5: Create tenant context utilities**

Create `lib/auth/tenant.ts`:

```typescript
import { createClient } from "@/lib/supabase/server";

export type TenantUser = {
  tenantId: string;
  userId: string;
  role: "owner" | "admin" | "agent";
};

export async function getCurrentTenantUser(): Promise<TenantUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: tenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id, user_id, role")
    .eq("user_id", user.id)
    .single();

  if (!tenantUser) return null;

  return {
    tenantId: tenantUser.tenant_id,
    userId: tenantUser.user_id,
    role: tenantUser.role,
  };
}

export async function requireTenantUser(): Promise<TenantUser> {
  const tenantUser = await getCurrentTenantUser();
  if (!tenantUser) {
    throw new Error("User is not associated with any tenant");
  }
  return tenantUser;
}
```

**Step 6: Test middleware protection**

Expected: Unauthenticated requests to /dashboard redirect to /login.

**Step 7: Commit**

```bash
git add lib/ middleware.ts
git commit -m "feat: add Supabase auth, middleware, and RBAC"
```

---

## Task 0.4: Migration Strategy and DB Versioning

**Files:**

- Create: `supabase/migrations/README.md`
- Create: `docs/migrations.md`

**Step 1: Create migrations directory**

```bash
mkdir -p supabase/migrations
```

**Step 2: Document migration strategy**

Create `docs/migrations.md`:

````markdown
# Database Migration Strategy

## Overview

All database schema changes MUST go through migrations. Never modify the database schema directly in production.

## Migration Workflow

### Creating a Migration

1. Create a new migration file in `supabase/migrations/`:
   ```bash
   # Format: YYYYMMDDHHMMSS_description.sql
   # Example: 20260216120000_add_guest_preferences.sql
   ```
````

2. Write the migration SQL:

   ```sql
   -- Add new column
   ALTER TABLE guests ADD COLUMN preferences JSONB DEFAULT '{}';

   -- Create index
   CREATE INDEX idx_guests_preferences ON guests USING GIN (preferences);
   ```

3. Test the migration locally:
   - Apply migration to local Supabase instance
   - Verify schema changes
   - Test application functionality

4. Document rollback steps:
   ```sql
   -- Rollback (if needed):
   -- DROP INDEX idx_guests_preferences;
   -- ALTER TABLE guests DROP COLUMN preferences;
   ```

### Applying Migrations

**Development:**

- Use Supabase CLI: `supabase db push`
- Or apply manually in Supabase Studio SQL Editor

**Production:**

- Apply migrations during maintenance window
- Always have rollback plan ready
- Monitor application after migration

## Migration Best Practices

1. **Backwards Compatibility**: Ensure migrations don't break existing code
2. **Idempotency**: Migrations should be safe to run multiple times
3. **Small Changes**: Keep migrations focused and atomic
4. **Test First**: Always test migrations in development
5. **Document Rollback**: Include rollback steps in comments

## Critical Migrations

For high-risk migrations (data transformations, column drops):

1. Create a backup before applying
2. Test rollback procedure
3. Have monitoring in place
4. Schedule during low-traffic period
5. Communicate with team

## Migration Checklist

- [ ] Migration file created with timestamp
- [ ] SQL syntax validated
- [ ] Tested in local environment
- [ ] Rollback steps documented
- [ ] RLS policies updated (if needed)
- [ ] Indexes added for new columns
- [ ] Team notified of schema changes

````

**Step 3: Create migrations README**

Create `supabase/migrations/README.md`:

```markdown
# Database Migrations

This directory contains all database schema migrations.

## File Naming Convention

`YYYYMMDDHHMMSS_description.sql`

Example: `20260216120000_add_guest_preferences.sql`

## Initial Schema

The initial schema is in `../schema.sql`. All subsequent changes should be migrations in this directory.

## Applying Migrations

See `docs/migrations.md` for the complete migration workflow.
````

**Step 4: Commit**

```bash
git add supabase/migrations/ docs/migrations.md
git commit -m "docs: add database migration strategy"
```

---

## Task 0.5: Observability Minimum Baseline

**Files:**

- Create: `lib/observability/logger.ts`
- Create: `lib/observability/types.ts`
- Create: `docs/runbook.md`

**Step 1: Create logging types**

Create `lib/observability/types.ts`:

```typescript
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogContext = {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  reservationId?: string;
  jobId?: string;
  eventId?: string;
};

export type ErrorCategory =
  | "validation"
  | "integration"
  | "retryable"
  | "fatal";

export type LogEntry = {
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: Error;
  errorCategory?: ErrorCategory;
  timestamp: string;
  metadata?: Record<string, unknown>;
};
```

**Step 2: Create structured logger**

Create `lib/observability/logger.ts`:

```typescript
import { LogLevel, LogContext, LogEntry, ErrorCategory } from "./types";

class Logger {
  private context: LogContext = {};

  setContext(context: LogContext) {
    this.context = { ...this.context, ...context };
  }

  clearContext() {
    this.context = {};
  }

  private log(
    level: LogLevel,
    message: string,
    metadata?: Record<string, unknown>,
  ) {
    const entry: LogEntry = {
      level,
      message,
      context: this.context,
      timestamp: new Date().toISOString(),
      metadata,
    };

    // In production, send to logging service (e.g., Datadog, Sentry)
    // For now, use console with structured output
    console.log(JSON.stringify(entry));
  }

  debug(message: string, metadata?: Record<string, unknown>) {
    this.log("debug", message, metadata);
  }

  info(message: string, metadata?: Record<string, unknown>) {
    this.log("info", message, metadata);
  }

  warn(message: string, metadata?: Record<string, unknown>) {
    this.log("warn", message, metadata);
  }

  error(
    message: string,
    error?: Error,
    category?: ErrorCategory,
    metadata?: Record<string, unknown>,
  ) {
    const entry: LogEntry = {
      level: "error",
      message,
      context: this.context,
      error,
      errorCategory: category,
      timestamp: new Date().toISOString(),
      metadata,
    };

    console.error(JSON.stringify(entry));
  }

  fatal(message: string, error?: Error, metadata?: Record<string, unknown>) {
    const entry: LogEntry = {
      level: "fatal",
      message,
      context: this.context,
      error,
      errorCategory: "fatal",
      timestamp: new Date().toISOString(),
      metadata,
    };

    console.error(JSON.stringify(entry));
  }
}

// Singleton instance
export const logger = new Logger();

// Helper to create logger with context
export function createLogger(context: LogContext): Logger {
  const contextLogger = new Logger();
  contextLogger.setContext(context);
  return contextLogger;
}
```

**Step 3: Create operational runbook**

Create `docs/runbook.md`:

```markdown
# Operational Runbook

## Overview

This runbook provides procedures for monitoring, troubleshooting, and responding to incidents in the Hotel PMS Integration & WhatsApp Automation system.

## Monitoring

### Key Metrics

1. **Authentication**
   - Failed login attempts
   - Session refresh failures
   - Token expiration rate

2. **PMS Integration**
   - Webhook delivery success rate
   - Sync job completion time
   - Failed reservation syncs

3. **WhatsApp Messaging**
   - Message delivery rate
   - Failed sends
   - WAHA session status

4. **Database**
   - Query performance
   - Connection pool usage
   - RLS policy violations

### Log Tracing

All logs include structured context:

- `requestId`: Trace a single request end-to-end
- `tenantId`: Filter by tenant
- `reservationId`: Track reservation lifecycle
- `jobId`: Follow automation job execution

Example log query:
```

requestId:"abc-123" AND level:"error"

```

## Incident Response

### PMS Down

**Symptoms:**
- Webhook timeouts
- Failed reservation syncs
- Stale reservation data

**Actions:**
1. Check PMS status page
2. Verify PMS credentials in `pms_configurations`
3. Check webhook endpoint accessibility
4. Review `inbound_events` for processing errors
5. If extended outage, notify tenants

**Recovery:**
- Webhooks will retry automatically
- Manual sync available via admin panel
- Check for data gaps after recovery

### WAHA Down

**Symptoms:**
- Failed message sends
- Session disconnected
- QR code not loading

**Actions:**
1. Check WAHA service status
2. Verify WAHA API key validity
3. Check `waha_configurations.is_connected`
4. Restart WAHA session if needed
5. Review `message_logs` for failed sends

**Recovery:**
- Failed messages will retry per retry policy
- Reconnect WhatsApp session via QR
- Check dead-letter queue for unrecoverable failures

### Webhook Failures

**Symptoms:**
- Duplicate events processed
- Missing reservation updates
- High error rate in `inbound_events`

**Actions:**
1. Check webhook signature validation
2. Verify `PMS_WEBHOOK_SECRET` is correct
3. Review `inbound_events` for duplicate `event_id`
4. Check idempotency logic
5. Validate event payload schema

**Recovery:**
- Idempotency prevents duplicate processing
- Replay failed events manually if needed
- Update webhook secret if compromised

### Database Issues

**Symptoms:**
- Slow queries
- Connection timeouts
- RLS policy errors

**Actions:**
1. Check Supabase dashboard for performance
2. Review slow query logs
3. Verify RLS policies are correct
4. Check connection pool settings
5. Scale database if needed

**Recovery:**
- Optimize slow queries with indexes
- Review and fix RLS policies
- Increase connection pool size
- Upgrade database tier if necessary

## Alert Thresholds

### Critical Alerts (Immediate Response)

- Message delivery failure rate > 10%
- Webhook processing failure rate > 5%
- Database connection errors
- Authentication system down

### Warning Alerts (Monitor)

- Message delivery failure rate > 5%
- Slow query time > 1s
- High retry queue depth
- Session refresh failures

## On-Call Actions

1. **Acknowledge Alert**: Respond within 5 minutes
2. **Assess Impact**: Check affected tenants
3. **Follow Runbook**: Use procedures above
4. **Communicate**: Update status page
5. **Resolve**: Fix root cause
6. **Post-Mortem**: Document incident

## Escalation

- **Level 1**: On-call engineer
- **Level 2**: Team lead
- **Level 3**: CTO / Infrastructure team

## Maintenance Windows

- **Scheduled**: Sundays 2-4 AM UTC
- **Emergency**: Communicate 1 hour in advance
- **Database Migrations**: During scheduled window only

## Backup and Recovery

- **Database**: Automated daily backups via Supabase
- **Recovery Time Objective (RTO)**: 4 hours
- **Recovery Point Objective (RPO)**: 24 hours

## Contact Information

- **Supabase Support**: support@supabase.com
- **WAHA Support**: [GitHub Issues](https://github.com/devlikeapro/waha)
- **PMS Support**: [Vendor-specific]
```

**Step 4: Commit**

```bash
git add lib/observability/ docs/runbook.md
git commit -m "feat: add structured logging and operational runbook"
```

---

## Verification Plan

### Automated Tests

**Test 1: Environment Validation**

```bash
# Create .env.local with missing variables
npm run dev
```

Expected: App fails to start with clear error message listing missing variables.

**Test 2: TypeScript Compilation**

```bash
npm run build
```

Expected: No TypeScript errors, successful build.

### Manual Verification

**Test 1: Project Structure**

Verify the following files exist:

- [ ] `package.json` with correct dependencies
- [ ] `next.config.js` with proper configuration
- [ ] `tailwind.config.ts` with Tailwind setup
- [ ] `tsconfig.json` with TypeScript settings
- [ ] `.env.local.example` with all required env vars
- [ ] `supabase/schema.sql` with complete schema
- [ ] `supabase/seed.sql` with seed data
- [ ] `lib/supabase/client.ts` for client-side Supabase
- [ ] `lib/supabase/server.ts` for server-side Supabase
- [ ] `middleware.ts` for auth and routing
- [ ] `lib/auth/rbac.ts` for role-based access control
- [ ] `lib/auth/tenant.ts` for tenant context
- [ ] `lib/observability/logger.ts` for structured logging
- [ ] `docs/migrations.md` for migration strategy
- [ ] `docs/runbook.md` for operational procedures

**Test 2: Supabase Setup**

1. Create a new Supabase project
2. Copy `.env.local.example` to `.env.local`
3. Fill in Supabase credentials
4. Run `schema.sql` in Supabase SQL Editor
5. Run `seed.sql` in Supabase SQL Editor
6. Verify all tables created with RLS enabled

**Test 3: App Startup**

```bash
npm run dev
```

Expected:

- App starts on http://localhost:3000
- No errors in console
- Can access homepage

**Test 4: Authentication Flow**

1. Navigate to http://localhost:3000/dashboard
2. Should redirect to /login (not yet implemented, but middleware should redirect)
3. Verify middleware is working

**Test 5: Logging**

Add test log in any page:

```typescript
import { logger } from "@/lib/observability/logger";

logger.info("Test log", { test: true });
```

Expected: Structured JSON log in console with timestamp and context.

---

## Acceptance Criteria

- [ ] Next.js 14 project initialized with TypeScript and Tailwind CSS
- [ ] All required environment variables documented in `.env.local.example`
- [ ] Environment validation fails fast with clear error messages
- [ ] Complete multi-tenant database schema with RLS policies
- [ ] Supabase client and server utilities created
- [ ] Middleware refreshes auth sessions and protects routes
- [ ] RBAC utilities for permission checking
- [ ] Tenant context utilities for multi-tenancy
- [ ] Migration strategy documented
- [ ] Structured logging with request tracing
- [ ] Operational runbook with incident procedures
- [ ] All files committed to git with descriptive messages

---

## Next Steps

After Phase 0 is complete, proceed to Phase 1: Core UI and Tenant Dashboard.
