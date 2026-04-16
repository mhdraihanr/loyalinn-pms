# Automation Worker Fixes & Dev Tools (2026-04-09)

## 1. "Keep Web Clean" Policy (PMS Sync)

- **Problem**: Reservations manually deleted from the local database by the admin were being resurrected during the next cron sync if they still existed in QloApps.
- **Solution**: The `Sync Service` now explicitly ignores incoming reservations from QloApps if they do not exist locally AND their status is either `checked-out` or `cancelled`. This prevents the system from cluttering the dashboard with past reservations that were intentionally removed.

## 2. Deduplication via UUID & Upsert Fixes

- **Problem**: The `reservations` table was creating duplicate rows for the same `pms_reservation_id` (e.g., `O12-R6` appearing twice) because the previous `upsert` mechanism relied solely on `onConflict: "tenant_id,pms_reservation_id"`, which was failing to hit the unique constraint safely.
- **Solution**: The upsert logic in `auto-sync-service.ts` was refactored to aggressively use the `id` (UUID) if the reservation already exists locally. By explicitly spreading the payload and matching the primary UUID, row duplication logic across multi-tenant polling has been completely eliminated.

## 3. Developer Time Machine & Scheduling Override

- **Feature**: Added a new Development Tool UI at `components/settings/developer-time-machine.tsx` backed by an API route `/api/dev/scheduler`.
- **Purpose**: Allows admins/developers to simulate the cron worker running at any specific past or future date.
- **Details**: This tool bypasses the standard production UTC locking time constraints. It executes `runAutomationCron` with `{ forceSchedule: true }`, making it significantly easier to test `pre-arrival` and `post-stay` orchestration behaviors, especially in multi-tenant test environments.

## 4. Next.js Aggressive Caching (Cache-busting)

- **Problem**: Modifying message templates (e.g., translating them from English to Indonesian) in the Supabase database did not reflect on the workers; the system kept sending the old templates.
- **Solution**: The Next.js App Router aggressively cached the Supabase queries within the backend execution. We applied `cache: "no-store"` into `lib/supabase/admin.ts` and set `export const dynamic = 'force-dynamic'` on the API routes to guarantee 100% fresh template reads from the database.

## 5. PMS Sync Lookback Window Optimization

- **Problem**: The `pms-sync-cron.ts` lookback window was reaching 30 days into the past (`startDate.setDate(baseTime.getDate() - 30)`) on every 5-minute interval poll, causing redundant data fetching and excessive API usage to the QloApps engine.
- **Solution**: The lookback window was reduced drastically to **3 days** (`-3`). This ensures reliable synchronizations while massively speeding up the cron runner's response time and payload efficiency.

## 6. Post-Stay Feedback Form + Feedback Monitor

- **Feature**: Implemented a hybrid post-stay feedback collection flow that starts with a WAHA message and redirects guests to a signed magic-link web form.
- **Backend scope**:
  - Added signed token helper in `lib/automation/feedback-link.ts`.
  - Added public feedback page route `app/feedback/[token]/page.tsx`.
  - Added submit API route `app/api/feedback/submit/route.ts`.
  - Added template variable support for `{{feedbackLink}}` so post-stay messages can inject a reservation-specific link.
- **Status behavior**:
  - Post-stay scheduler/send flow now marks reservations as `post_stay_feedback_status='pending'` after the initial WAHA form invitation is sent.
  - Automatic escalation from `pending` to `ai_followup` after 24 hours is now implemented in `lib/automation/feedback-escalation.ts`.
  - AI follow-up kickoff message is now loaded from Message Templates (`trigger='post-stay-ai-followup'`) instead of hardcoded text.
- **Dashboard visibility**:
  - Added tenant-scoped Feedback Monitor page at `/feedback` using `lib/data/feedback.ts`.
  - Added table actions with a detail modal to inspect full comments and open/copy the feedback link directly.

## 7. Route-level Validation for Escalation Metrics

- **Feature**: Added route-level validation that cron responses expose `aiFollowupEscalated`.
- **Coverage**:
  - `tests/integration/app/api/cron/automation/route.test.ts`
  - `tests/integration/app/api/dev/scheduler/route.test.ts`
- **Result**: Both production cron wrapper and development scheduler simulation now assert escalation metrics in their JSON summaries.

## 8. WAHA AI Follow-up 500 Fix (OpenRouter Compatibility)

- **Problem**: Inbound WAHA replies for AI follow-up were returning HTTP `500` because OpenRouter rejected request payloads with `Invalid Responses API request` on `/api/v1/responses`.
- **Root Cause**: The AI SDK provider default path used Responses API shape, while this feedback flow relies on chat-style tool-calling messages.
- **Solution**: Force Chat Completions path in `lib/ai/agent.ts` by using `openrouter.chat(AI_MODEL)`.
- **Validation**:
  - `tests/integration/app/api/webhooks/waha/route.test.ts` passed (`6/6`).
  - Runtime logs no longer report the Responses API validation error once the patch is deployed.

## 9. WAHA Inbound `@lid` Mapping (Sender Chat ID Resolution)

- **Problem**: Guests using linked WhatsApp accounts sent messages identifying with `@lid` (Lobby ID) instead of the standard `@c.us` phone number. This caused the existing phone-number regex parsing to fail and incorrectly return `ignored: no active ai_followup reservation found`.
- **Solution**: Implemented a fallback mechanism in `app/api/webhooks/waha/route.ts` to call the WAHA `/api/{session}/lids/{lid}` endpoint via `wahaClient.getLidMapping()` when a `@lid` is detected. This dynamically maps the anonymized Lobby ID to a real phone number before attempting to match the guest and reservation.

## 10. Webhook Idempotency & Duplicate Detection

- **Problem**: WAHA was forwarding duplicate webhooks for a single guest message, causing double AI invocations and duplicate database insertions.
- **Solution**: Implemented `hasDuplicateInboundMessage` utilizing the Supabase `message_logs` table checking for exact `provider_message_id` matches. Duplicate webhook retries are now safely ignored.
- **Validation**:
  - `tests/integration/app/api/webhooks/waha/route.test.ts` (now 14 passing tests) correctly asserts idempotency checks and LID lookups.
  - Live testing confirmed that duplicate webhook payloads skip processing and the target status accurately completes.

## 11. QloApps Guest Phone Source Hardening (Customer First)

- **Problem**: Some guest phone numbers were stale because address data could override newer customer profile numbers.
- **Solution**:
  - In `lib/pms/qloapps-adapter.ts`, phone resolution now prefers `customer.phone` / `customer.phone_mobile` first.
  - Address phone is now fallback-only, and it is fetched from the newest address row with deterministic ordering.
  - Adapter parsing was typed to remove explicit `any` and reduce runtime ambiguity.
- **Validation**:
  - `tests/unit/lib/pms/qloapps-adapter.test.ts`
  - Covers customer-phone precedence and address fallback behavior.

## 12. Language Routing Policy (Non-ID => English)

- **Problem**: Non-Indonesia numbers could still receive Indonesian copy in automation and AI follow-up paths.
- **Solution**:
  - Language detection now uses phone pattern as primary signal.
  - Indonesian is restricted to Indonesia-style numbers (`08`, `+62`, `62`).
  - Non-ID numbers default to English.
- **Applied scope**:
  - `lib/automation/status-trigger.ts`
  - `lib/automation/feedback-escalation.ts`
  - `app/api/webhooks/waha/route.ts`
  - `lib/ai/agent.ts` (prompt/tool copy localized via `preferredLanguage`)

## 13. WAHA Handoff Replies Decoupled from Env Templates

- **Problem**: Final handoff text (`completed` / `ignored`) depended on env template overrides, which made behavior less deterministic across environments.
- **Solution**:
  - Handoff replies are now resolved from built-in bilingual templates in `app/api/webhooks/waha/route.ts`.
  - `preferredLanguage` drives deterministic ID/EN fallback copy.
  - Environment variables are no longer required for handoff default behavior.
- **Validation**:
  - `tests/integration/app/api/webhooks/waha/route.test.ts` now verifies built-in completed handoff response.

## 14. Context7 References Used in This Hardening Pass

- **PrestaShop docs** (`/prestashop/docs`): confirmed supported list query parameters (`filter`, `sort`, `limit`) for robust latest-address fallback reads.
- **Vercel AI SDK docs** (`/vercel/ai`): reconfirmed guidance that system prompts + deterministic settings are recommended for reliable tool-calling flows.
