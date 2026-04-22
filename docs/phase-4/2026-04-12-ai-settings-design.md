# AI Context & Settings Design (Implemented)

## 1. Objective

Enable each tenant to personalize post-stay AI follow-up responses without code changes, directly from dashboard settings.

This design is implemented and active in production flow for WAHA inbound AI follow-up.

## 2. Data Model

The feature uses table `ai_settings` created by migration:

- `supabase/migrations/20260412002000_add_ai_settings_table.sql`

Schema:

```sql
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  hotel_name TEXT,
  ai_name TEXT,
  tone_of_voice TEXT,
  custom_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);
```

Notes:

- `tenant_id` is unique to enforce max 1 AI profile per tenant.
- Personalization scope is prompt-context only.
- No dedicated MCP toggle/model preference is stored in this version.

## 3. Access Control (RLS)

Policies on `ai_settings`:

- `Members can view AI settings` for tenant-scoped read.
- `Owners can manage AI settings` for insert/update/delete.

This matches existing helper functions:

- `public.get_user_tenant_id()`
- `public.is_tenant_owner(tenant_id)`

## 4. Runtime Flow

1. Owner updates settings on `/settings/ai`.
2. Form submit calls server-side save action that delegates to `upsertCurrentTenantAiSettings` in `lib/ai/settings.ts`.
3. WAHA inbound follow-up webhook resolves reservation tenant and calls:
   - `processPostStayLifecycleConversation(reservationId, tenantId, guestName, hotelName, messageHistory)`
4. AI layer loads tenant context from `ai_settings` using admin client.
5. `buildPostStayLifecycleSystemPrompt` merges:
   - tenant overrides (`hotel_name`, `ai_name`, `tone_of_voice`, `custom_instructions`)
   - reservation fallback (`hotelName`)
   - safe defaults when values are empty.

## 5. UI Surface

Implemented files:

- `app/(dashboard)/settings/ai/page.tsx`
- `components/settings/ai/ai-settings-form.tsx`
- `components/layout/sidebar.tsx` (menu entry: AI Assistant)

Fields exposed to owner:

- `hotel_name`
- `ai_name`
- `tone_of_voice`
- `custom_instructions`

## 6. Error Handling and Compatibility

- If table `ai_settings` is not migrated yet, both read/write paths fail gracefully with explicit messaging.
- AI runtime keeps webhook flow resilient by falling back to default prompt context when `ai_settings` cannot be read.
- Prompt generation remains compatible with current tool-calling flow (`aiProvider(AI_MODEL)` from `lib/ai/provider.ts`).

## 7. MCP Note

Current implementation does not register a separate MCP server for AI settings.
Personalization is performed via tenant-scoped database context injection into system prompt, which is sufficient for current requirement (hotel name and custom instructions from page input).
