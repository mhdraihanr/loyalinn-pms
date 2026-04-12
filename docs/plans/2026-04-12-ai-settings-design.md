# AI Context & Settings Design

## 1. Overview
The goal is to allow tenants (hotels) to dynamically customize how their AI behaves and responds to guests. Instead of hardcoding settings or using a rigid JSONB structure on the `tenants` table, we will create a dedicated `ai_settings` table to store instructions, tone, and environment context (such as basic info or checking MCP connectivity) for the AI agent.

## 2. Architecture & Data Schema
A new table `ai_settings` will be added via a Supabase migration script:
```sql
CREATE TABLE ai_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
  hotel_name TEXT,
  ai_name TEXT,
  tone_of_voice TEXT,
  custom_instructions TEXT,
  ai_model_preference TEXT,
  mcp_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```
- **tenant_id** holds a UNIQUE constraint so each tenant has at most 1 AI settings profile.

## 3. Web UI & Components
- Add a new dashboard page: `/app/(dashboard)/settings/ai/page.tsx`.
- Create a `ai-settings-form.tsx` client component to handle form state and validation using `zod` and `react-hook-form`.
- Users can update their `hotel_name`, `ai_name` (e.g., 'Resepsionis Virtual'), `tone_of_voice` (e.g., 'Formal, Ramah'), and `custom_instructions` (e.g., 'Selalu ingatkan jam check-out pukul 12 siang').
- Add a Server Action or API route to read and update `ai_settings`.

## 4. AI Agent Integration
- In `lib/ai/agent.ts`, when the `processGuestFeedback` (or any other function) is triggered, it will fetch the `ai_settings` by the given `tenant_id`.
- Default values (e.g., "Resepsionis", "Ramah dan Sopan") will be loaded if there is no row in `ai_settings`.
- The `generateText` system prompt will dynamically combine these pieces to guide the model.

## 5. Security & Testing
- Supabase Row-Level Security (RLS) policies should ensure only authenticated tenant users can SELECT, INSERT, or UPDATE their `ai_settings`.
- If the AI is triggered via webhook (`api/webhooks/...`), the backend automatically fetches the settings via the admin client since webhooks skip standard RLS context.
