# Documentation

This directory contains all project documentation organized by phase and topic.

## Structure

### 📁 [phase-0/](./phase-0/)

**Status:** ✅ Completed

Foundation phase documentation including:

- Implementation plan
- Walkthrough with verification results
- Summary of all accomplishments

### 📁 [phase-1/](./phase-1/)

**Status:** ✅ Completed

Core UI and Tenant Dashboard phase documentation including:

- Implementation plan
- Walkthrough with bug fixes and decisions
- Summary of all accomplishments

### 📁 [phase-2/](./phase-2/)

**Status:** ✅ Completed

PMS Integration (MVP) phase documentation including:

- Summary of all accomplishments
- Implemented synchronization service architecture

### 📄 Core Documentation

- **[migrations.md](./migrations.md)** - Database migration strategy and best practices
- **[runbook.md](./runbook.md)** - Operational procedures and incident response playbooks
- **[plan.md](./plan.md)** - Overall project plan with all phases

### 📄 Latest Implementation Notes

- **[Automation Worker Fixes & Tools (2026-04-09)](./phase-4/2026-04-09-automation-worker-fixes-and-tools.md)** - Reliability fixes, idempotency, and latest hardening notes.
- **[AI Settings Design (2026-04-12)](./phase-4/2026-04-12-ai-settings-design.md)** - Final architecture for tenant-specific AI context injection.
- **[AI Settings Implementation (2026-04-12)](./phase-4/2026-04-12-ai-settings-implementation.md)** - Execution record, delivered files, and verification summary.

### 📁 plans/

Archive of implementation plans (now organized by phase folders)

## Quick Links

### Phase 0: Foundations ✅

- [Phase 0 README](./phase-0/README.md) - Overview and status
- [Implementation Plan](./phase-0/implementation-plan.md) - Detailed execution plan
- [Walkthrough](./phase-0/walkthrough.md) - What was accomplished

### Phase 1: Core UI and Tenant Dashboard ✅

- [Phase 1 README](./phase-1/README.md) - Overview and status
- [Implementation Plan](./phase-1/implementation-plan.md) - Detailed execution plan
- [Walkthrough](./phase-1/walkthrough.md) - What was accomplished, bugs fixed

### Phase 2: PMS Integration (MVP) ✅

- [Phase 2 README](./phase-2/README.md) - Overview and architectural choices (Sync and Tabs)

### Operational Guides

- [Migration Strategy](./migrations.md) - How to manage database schema changes
- [Operational Runbook](./runbook.md) - Monitoring, troubleshooting, and incident response

## Documentation Standards

All phase documentation should include:

- ✅ Implementation plan with exact file paths and code
- ✅ Walkthrough documenting accomplishments and verification
- ✅ README with status, deliverables, and next steps
- ✅ Git commit history

## Contributing

When adding new documentation:

1. Create a phase folder (e.g., `phase-1/`, `phase-2/`)
2. Include README.md, implementation-plan.md, and walkthrough.md
3. Link from this main README
4. Keep documentation concise and actionable
