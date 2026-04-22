# 2026-04-21: Lifecycle AI Observability Hardening

## Background

Issue observed in production troubleshooting:

- AI was suspected to run only on post-stay because detailed lifecycle logs mostly appeared under post-stay flow.
- Pre-arrival and on-stay were routed correctly, but lacked step-level and summary-level debug logs.

## Root Cause

Lifecycle stage execution was already implemented for all phases, but observability was asymmetric:

- Post-stay had explicit debug callbacks and summary logs.
- Pre-arrival and on-stay did not emit equivalent step/summary logs.
- Webhook routing did not emit a structured debug event that clearly showed selected lifecycle stage and reservation context.

Result: operational traces looked as if only post-stay used AI.

## Design Notes (Context7)

Based on AI SDK event-listener docs for generateText:

- onStepFinish is the correct hook for per-step telemetry.
- Summary logging after generation is recommended to capture total steps, tool calls, and tool errors.

Applied approach:

- Use onStepFinish for pre-arrival and on-stay.
- Keep logs gated by environment debug flags.
- Add route-level stage selection logs in WAHA webhook for traceability.

## Implementation

### 1) Pre-arrival agent logging parity

File: lib/ai/pre-arrival-agent.ts

Changes:

- Added debug gate helper (LIFECYCLE_AI_DEBUG or AI_FEEDBACK_DEBUG).
- Added onStepFinish callback for step logs:
  - label: [Lifecycle AI][Pre-arrival] Step
- Added post-run summary log:
  - label: [Lifecycle AI][Pre-arrival] Summary
  - includes: reservationId, model, steps, toolCalls, toolErrors

### 2) On-stay agent logging parity

File: lib/ai/on-stay-agent.ts

Changes:

- Added debug gate helper (LIFECYCLE_AI_DEBUG or AI_FEEDBACK_DEBUG).
- Added onStepFinish callback for step logs:
  - label: [Lifecycle AI][On-stay] Step
- Added post-run summary log:
  - label: [Lifecycle AI][On-stay] Summary
  - includes: reservationId, model, steps, toolCalls, toolErrors

### 3) WAHA webhook route selection and handoff decision logs

File: app/api/webhooks/waha/route.ts

Changes:

- Added debug gate helper (LIFECYCLE_AI_DEBUG or AI_FEEDBACK_DEBUG).
- Added route selection log:
  - label: [WAHA][Lifecycle AI] Route selected
  - includes: tenantId, reservationId, lifecycleStage, reservationStatus, postStayFeedbackStatus, providerMessageId
- Added completed handoff decision logs:
  - [WAHA][Lifecycle AI] Completed handoff gate
  - [WAHA][Lifecycle AI] Completed handoff unchanged
  - [WAHA][Lifecycle AI] Completed handoff sent
- Added stage dispatch/response logs for non-completed flow:
  - [WAHA][Lifecycle AI] Dispatching stage agent
  - [WAHA][Lifecycle AI] Stage agent responded

### 4) Duplicate inbound observability and registration guardrail

Files:

- app/api/webhooks/waha/route.ts
- app/api/waha/start/route.ts

Changes:

- Prevent misleading route logs on duplicate deliveries:
  - Route log [WAHA][Lifecycle AI] Route selected now runs only after inbound insert succeeds.
  - Duplicate path now emits explicit log:
    - [WAHA][Lifecycle AI] Duplicate inbound ignored
- Prevent redundant webhook registration that can multiply inbound requests:
  - Session webhook auto-registration now skips when equivalent global WAHA webhook is already configured.
  - Skip reason is returned in start-session response:
    - webhooksSkipReason: global-webhook-configured
- Normalize event lists to avoid overlapping subscriptions:
  - If message.any is present, message is dropped from the same subscription list.

Root-cause evidence for "4x webhook request" pattern:

- WAHA can deliver via global webhook config and session webhook config independently.
- If both are active and both include overlapping events (for example message + message.any), a single inbound user message can fan out into multiple callbacks.
- Retry policy can add more deliveries if an earlier callback fails or times out.

## Verification (TDD + Regression)

### RED

Added tests first and confirmed failure:

- tests/unit/lib/ai/lifecycle-stage-agents.test.ts
- tests/integration/app/api/webhooks/waha/route.test.ts (route log assertion)
- tests/integration/app/api/waha/start/route.test.ts (global/session duplication + event normalization)

### GREEN

After implementation, ran:

- pnpm test tests/unit/lib/ai/lifecycle-stage-agents.test.ts tests/integration/app/api/webhooks/waha/route.test.ts

Result:

- 3 test files passed
- 26 tests passed
- 0 failed

## Operational Usage

Enable debug logs when tracing lifecycle routing and tool-calling behavior:

- LIFECYCLE_AI_DEBUG=true

Optional legacy-compatible switch:

- AI_FEEDBACK_DEBUG=true

Recommended:

- Keep disabled in normal production operation.
- Enable temporarily during incident triage or focused validation.

## Outcome

- AI execution visibility is now symmetric across pre-arrival, on-stay, and post-stay.
- Operators can distinguish routing decisions from model/tool execution and handoff decisions.
- The prior perception that AI runs only on post-stay is resolved at observability level.
- Repeated webhook deliveries are now easier to diagnose and are reduced by default guardrails in webhook registration.
