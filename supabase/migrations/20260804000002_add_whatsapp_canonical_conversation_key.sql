-- Apply after 20260804000000_add_realtime_whatsapp_inbox.sql and
-- 20260804000001_add_whatsapp_conversation_identity.sql.
-- Run during a short maintenance window so webhook writes cannot race this merge.

BEGIN;
LOCK TABLE whatsapp_conversations IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE whatsapp_messages IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE whatsapp_conversations
  ADD COLUMN IF NOT EXISTS conversation_key TEXT;

UPDATE whatsapp_conversations
SET normalized_phone = NULLIF(regexp_replace(normalized_phone, '\D', '', 'g'), '')
WHERE normalized_phone IS NOT NULL;

UPDATE whatsapp_conversations
SET conversation_key = CASE
  WHEN normalized_phone IS NOT NULL THEN 'phone:' || normalized_phone
  WHEN chat_id ILIKE '%@lid' THEN 'lid:' || lower(chat_id)
  ELSE 'chat:' || lower(chat_id)
END
WHERE conversation_key IS NULL;

-- Preflight: inspect this query before committing in production.
-- SELECT tenant_id, session_name, conversation_key, count(*), array_agg(chat_id)
-- FROM whatsapp_conversations
-- GROUP BY tenant_id, session_name, conversation_key HAVING count(*) > 1;

CREATE TEMP TABLE whatsapp_conversation_merge_map ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    c.id,
    first_value(c.id) OVER (
      PARTITION BY c.tenant_id, c.session_name, c.conversation_key
      ORDER BY c.is_archived ASC, c.last_message_at DESC NULLS LAST,
        c.updated_at DESC, c.created_at ASC, c.id ASC
    ) AS keep_id,
    count(*) OVER (
      PARTITION BY c.tenant_id, c.session_name, c.conversation_key
    ) AS duplicate_count
  FROM whatsapp_conversations c
)
SELECT id AS drop_id, keep_id
FROM ranked
WHERE duplicate_count > 1 AND id <> keep_id;

-- Move children first so ON DELETE CASCADE cannot discard transcript history.
UPDATE whatsapp_messages m
SET conversation_id = map.keep_id, updated_at = now()
FROM whatsapp_conversation_merge_map map
WHERE m.conversation_id = map.drop_id;

WITH aliases AS (
  SELECT
    map.keep_id,
    array_agg(DISTINCT c.chat_id ORDER BY c.chat_id) AS chat_ids,
    (array_agg(c.display_name ORDER BY (c.display_name IS NULL), c.updated_at DESC))[1] AS display_name,
    (array_agg(c.guest_id ORDER BY (c.guest_id IS NULL), c.updated_at DESC))[1] AS guest_id,
    (array_agg(c.reservation_id ORDER BY (c.reservation_id IS NULL), c.updated_at DESC))[1] AS reservation_id
  FROM whatsapp_conversation_merge_map map
  JOIN whatsapp_conversations c ON c.id IN (map.keep_id, map.drop_id)
  GROUP BY map.keep_id
), latest_message AS (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id, m.content, m.direction, coalesce(m.sent_at, m.created_at) AS message_at
  FROM whatsapp_messages m
  JOIN (SELECT DISTINCT keep_id FROM whatsapp_conversation_merge_map) map
    ON map.keep_id = m.conversation_id
  ORDER BY m.conversation_id, coalesce(m.sent_at, m.created_at) DESC, m.created_at DESC, m.id DESC
)
UPDATE whatsapp_conversations c
SET
  display_name = coalesce(nullif(a.display_name, ''), c.display_name),
  guest_id = coalesce(a.guest_id, c.guest_id),
  reservation_id = coalesce(a.reservation_id, c.reservation_id),
  last_message_preview = coalesce(left(lm.content, 500), c.last_message_preview),
  last_message_direction = coalesce(lm.direction, c.last_message_direction),
  last_message_at = coalesce(lm.message_at, c.last_message_at),
  metadata = coalesce(c.metadata, '{}'::jsonb) || jsonb_build_object(
    'provider_chat_ids', a.chat_ids,
    'merged_at', now()
  ),
  updated_at = now()
FROM aliases a
LEFT JOIN latest_message lm ON lm.conversation_id = a.keep_id
WHERE c.id = a.keep_id;

DELETE FROM whatsapp_conversations c
USING whatsapp_conversation_merge_map map
WHERE c.id = map.drop_id;

ALTER TABLE whatsapp_conversations
  ALTER COLUMN conversation_key SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_canonical_key_unique
  ON whatsapp_conversations (tenant_id, session_name, conversation_key);

COMMIT;

-- Postflight checks:
-- SELECT tenant_id, session_name, conversation_key, count(*)
-- FROM whatsapp_conversations GROUP BY 1,2,3 HAVING count(*) > 1;
-- SELECT m.id FROM whatsapp_messages m LEFT JOIN whatsapp_conversations c ON c.id = m.conversation_id WHERE c.id IS NULL;
