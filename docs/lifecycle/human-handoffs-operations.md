# Human Handoffs Operations

## Purpose

The **Human Handoffs** tab in Operations gives hotel staff a tenant-scoped queue for lifecycle conversations that automation intentionally stopped handling. A handoff is created when the lifecycle intent guard, an AI tool, a provider fallback, or completed post-stay flow requires staff review.

## Staff workflow

1. Open **Operations → Human Handoffs**.
2. Select **Open chat** for a guest.
3. The app refreshes **only the selected WAHA chat** before opening the drawer.
4. Review the transcript and send a manual WhatsApp reply when needed.
5. Select **Resolve handoff** only when staff work is complete.

A manual reply does not resolve the handoff automatically.

## Refresh and fallback

The drawer uses the lifecycle session ID in the URL:

```text
/operations?tab=human-handoffs&handoff=<lifecycle-session-id>
```

This keeps the selected handoff open after a browser refresh. The app stores WAHA session/chat identity from inbound webhook traffic, including LID identity when available.

If WAHA is disconnected or selected-chat refresh fails, the drawer remains usable and shows the transcript stored in `message_logs`. The drawer displays a database-fallback warning rather than claiming the live WhatsApp history was refreshed.

## Security

- Browser code never receives the WAHA API key.
- Manual sends and refreshes use tenant-scoped server actions.
- The client sends only the lifecycle handoff ID, not a raw WAHA chat ID.
- Manual outbound messages are recorded with `source = human` and the responsible user ID.

## Concurrency

Each handoff has `handoff_version`. Send and resolve actions validate this version, so an outdated browser tab cannot silently overwrite an action completed by another staff member. Refresh the drawer if the app reports that a handoff changed.

## LID behavior

WAHA can identify a chat by phone (`@c.us`) or LID (`@lid`). The webhook stores both when WAHA provides the mapping. The server prefers the original chat identity and falls back to the resolved phone chat identity or guest phone when necessary.

## Troubleshooting

### The drawer says database transcript fallback

1. Check WAHA connection in Settings → WAHA.
2. Use **Refresh chat terpilih** again after reconnecting.
3. Confirm the handoff has a guest phone and WAHA identity fields in `lifecycle_ai_sessions`.
4. Old handoffs created before this feature may have no original chat ID; phone fallback is used.

### Manual send fails

1. Confirm the handoff is still active and was not resolved by another operator.
2. Confirm WAHA is connected.
3. Confirm the guest phone/chat identity exists.
4. Review failed `message_logs` rows for the error text.

### Inspect active handoffs in SQL

```sql
select
  id,
  tenant_id,
  reservation_id,
  lifecycle_stage,
  handoff_priority,
  handoff_reason,
  waha_session_name,
  waha_chat_id,
  waha_phone_chat_id,
  waha_lid,
  last_refresh_error,
  handoff_version,
  updated_at
from lifecycle_ai_sessions
where session_status = 'handoff'
  and needs_human_follow_up = true
order by updated_at desc;
```
