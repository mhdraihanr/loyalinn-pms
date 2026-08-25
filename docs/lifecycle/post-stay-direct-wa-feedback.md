# Post-Stay Direct WhatsApp Feedback

## Summary

Post-stay feedback can now be completed directly from a WhatsApp reply when the guest provides an explicit 1-5 rating in the message.

Example accepted replies:

- `Rate dari saya 5 kamar luas`
- `rating 4, pelayanan ramah`
- `Saya kasih 5 bintang, bagus sekali`

## Behavior

When the WAHA webhook receives an inbound message for a `checked-out` reservation with `post_stay_feedback_status` of `pending` or `ai_followup`, the route first runs a deterministic parser before dispatching the message to the AI agent.

If an explicit rating is detected:

1. The webhook calls `completePostStayFeedbackWithReward()` directly.
2. The reservation is updated to `post_stay_feedback_status = completed`.
3. `post_stay_rating` and `post_stay_comments` are saved.
4. Reward points are applied through the shared feedback reward RPC.
5. A short thank-you WhatsApp reply is sent.
6. The AI agent is skipped for that message.

If no explicit rating is detected, the existing AI post-stay conversation flow remains active.

## Rationale

AI function calling is useful for conversational follow-up, but explicit rating messages should not depend on probabilistic model behavior. A deterministic parser makes common guest replies reliable while preserving AI handling for ambiguous cases.

## Guardrails

The parser only accepts explicit rating phrases such as `rate`, `rating`, `score`, `nilai`, `kasih`, or `bintang`. It intentionally ignores unrelated numbers such as room numbers or stay duration.

## Updated files

- `lib/automation/post-stay-feedback-parser.ts`
- `app/api/webhooks/waha/route.ts`
- `tests/unit/lib/automation/post-stay-feedback-parser.test.ts`

## Verification

Run:

- `pnpm test tests/unit/lib/automation/post-stay-feedback-parser.test.ts`
- `pnpm lint`
- `pnpm test`
