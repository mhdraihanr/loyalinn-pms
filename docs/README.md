# Documentation

This directory contains project documentation. Operational docs are tracked in git; phase logs and dated working notes are local-only archives.

## Structure

### 📁 Local archives (not tracked in git)

`phase-0/` … `phase-4/`, `plans/`, and dated notes (`YYYY-MM-DD-*.md`) are local working archives: implementation plans, walkthroughs, and phase summaries kept on disk for reference.

### 📄 Core Documentation

- **[migrations.md](./migrations.md)** - Database migration strategy and best practices
- **[runbook.md](./runbook.md)** - Operational procedures and incident response playbooks
- **[plan.md](./plan.md)** - Overall project plan with all phases
- **[qloapps-integration/](./qloapps-integration/README.md)** - QloApps webhook-first runtime notes, setup guide, and cutover checklists

### � guides/

- **[AI Provider Configuration](./guides/ai-provider-configuration.md)** - Gemini and 9Router environment switch, aliases, model selection, and local validation steps.
- **[Menu & Facilities Service Catalog](./guides/service-catalog-menu-facilities.md)** - Operations-area room-service, facility, availability, price, alias, and preparation-minute data used by on-stay AI before answering guests or creating validated orders.
- **[Operations Dashboard Retention Policy](./guides/operations-dashboard-retention.md)** - Retention rules for operational queue rows.
- **[Dashboard Table Search Consistency](./guides/dashboard-table-search-consistency.md)** - Search behavior conventions across dashboard tables.

### 📁 lifecycle/

- **[Lifecycle Intent Guard](./lifecycle/lifecycle-intent-guard.md)** - Deterministic stage scope, clarify-once behavior, truthful handoff semantics, and lifecycle session triage.
- **[Human Handoffs Operations](./lifecycle/human-handoffs-operations.md)** - Staff queue, selected-chat WAHA refresh, manual reply, resolve flow, and fallback transcript guidance.
- **[Post-Stay Direct WhatsApp Feedback](./lifecycle/post-stay-direct-wa-feedback.md)** - Direct post-stay feedback flow over WhatsApp.

### 📁 decisions/

- **[Architecture Analysis: Single Tenant](./decisions/architecture-analysis-single-tenant.md)** - Decision record for the single-tenant final model.

### 📄 Reference

- **[QloApps Integration](./qloapps-integration/README.md)** - Webhook-first runtime notes, including lifecycle status semantics and duplicate-safe `on-stay` automation guardrails.

### 📁 plans/

Archive of implementation plans (now organized by phase folders)

## Quick Links

Phase folders (`phase-0/` … `phase-4/`) and `plans/` are local working archives — they exist on disk but are intentionally not tracked in git. See the Core Documentation and Latest Implementation Notes above for tracked docs.

### Operational Guides

- [Migration Strategy](./migrations.md) - How to manage database schema changes
- [Operational Runbook](./runbook.md) - Monitoring, troubleshooting, and incident response
- [QloApps Webhook Setup Guide](./qloapps-integration/qloapps-webhook-setup-guide.md) - Module setup, signing, and validation flow
- [Lifecycle docs](./lifecycle/) - Intent guard, human handoffs, post-stay feedback

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
