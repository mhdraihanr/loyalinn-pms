# Lifecycle Intent Guard

## Purpose

The lifecycle intent guard prevents WhatsApp automation from accepting, promising, or routing a guest request when it does not clearly match the reservation lifecycle stage. It runs before a lifecycle AI agent or operational tool is called.

The behavior follows the project architecture in [README](../README.md): inbound WhatsApp messages are logged and deduplicated, then lifecycle automation may create an operational request or safely stop automation.

## Processing order

```text
WAHA inbound webhook
  → authenticate and normalize message
  → resolve reservation lifecycle stage
  → write inbound message_logs record and deduplicate
  → direct post-stay rating parser (when eligible)
  → completed post-stay one-time close-out gate
  → lifecycle session state check
  → deterministic intent guard
       allow    → lifecycle AI agent with stage-scoped tools
       clarify  → one deterministic clarification reply
       handoff  → deterministic boundary reply; stop automation
       resolved → deterministic stop acknowledgement; stop automation
```

The guard does not use an LLM. This makes stage boundaries repeatable and prevents a model from claiming that an unsupported request was accepted.

## Stage scope

| Lifecycle stage | Allowed automated intent | Handoff examples |
| --- | --- | --- |
| `pre-arrival` | ETA, arrival/check-in preparation, early check-in | room service, towels, maintenance, feedback, payment/refund |
| `on-stay` | room service, housekeeping, extra items, maintenance | early check-in, post-stay feedback, refund/payment, booking changes |
| `post-stay` | rating, comments, feedback refusal/stop | room service, housekeeping, maintenance, booking changes, refund/payment |

All stages hand off immediately for safety/security/medical concerns, explicit human/staff requests, legal/privacy matters, refunds/payments, cancellation/booking changes, and policy exceptions.

## Clarify once

An empty, greeting-only, or very short ambiguous message receives one stage-specific clarification. The count is persisted in `lifecycle_ai_sessions.clarification_count`.

On the next ambiguous message, the guard marks the session as `handoff` instead of repeating a clarification. This avoids automated conversation loops.

## Truthful handoff semantics

A guard handoff means:

- `lifecycle_ai_sessions.session_status = 'handoff'`
- `needs_human_follow_up = true`
- `last_action_type = 'intent_guard_handoff'`
- the automated lifecycle agent no longer replies to later messages in that session

The guest-facing copy says the request needs staff review and that automation will not handle it. It does **not** claim that a request was completed or promise an immediate staff response. For urgent cases, it asks the guest to contact the front desk or nearby staff directly.

Active handoffs are available in **Operations → Human Handoffs**. The staff drawer refreshes only the selected WAHA chat and falls back to the database transcript when WAHA is unavailable. See [Human Handoffs Operations](./human-handoffs-operations.md) for the staff workflow.

Operators can also triage the persistent session state with:

```sql
select
  tenant_id,
  reservation_id,
  lifecycle_stage,
  session_status,
  needs_human_follow_up,
  clarification_count,
  last_action_type,
  last_action_payload,
  last_inbound_message_at,
  updated_at
from lifecycle_ai_sessions
where needs_human_follow_up = true
  and session_status = 'handoff'
order by updated_at desc;
```

## Direct post-stay feedback

For a checked-out reservation with feedback status `pending` or `ai_followup`, an explicit supported rating is parsed before the guard and saved through the existing feedback/reward flow. The session becomes `resolved`; it is not a staff handoff.

A completed post-stay feedback flow sends at most one deterministic close-out message, then preserves `handoff` state and suppresses further automatic replies.

## Observability

Enable `LIFECYCLE_AI_DEBUG=true` for focused troubleshooting. For every guard outcome, inspect:

- `message_logs` for inbound and deterministic outbound messages;
- `lifecycle_ai_sessions` for stage, status, clarification count, action type, and action payload;
- operational tables only when an allowed on-stay/pre-arrival tool actually created a row.

## Smoke scenarios

1. Pre-arrival `?` → clarification; no AI or arrival request.
2. Second unclear pre-arrival message → handoff; no AI reply afterward.
3. Pre-arrival `tolong kirim handuk` → handoff, not an arrival request.
4. On-stay `minta dua handuk` → existing housekeeping flow.
5. Post-stay `rating saya 5` → feedback/reward saved without an AI call.
6. Post-stay `tolong refund` → handoff; feedback is not ignored.
7. Post-stay `jangan hubungi lagi` → feedback becomes `ignored` and session becomes `resolved`.
