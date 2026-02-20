-- Migration: 20260218000000_add_invitations_table.sql
-- Phase 1 — Staff invite flow
--
-- Adds the `invitations` table to track staff invite tokens.
-- Replaces the previous approach of storing pending_tenant_id in Supabase
-- user_metadata. Tokens are UUID-based (not guessable), expire after 7 days.
--
-- Flow:
--   Owner creates invite → row inserted here with status='pending'
--   Staff clicks /accept-invite?token=<uuid>
--     → server reads row via admin client (bypasses RLS)
--     → if not registered: redirect /signup?invite_token=<uuid> (email locked)
--     → if registered: show accept page → acceptStaffInvitation(userId, token)
--         → tenant_users inserted (role='staff')
--         → invitations.status = 'accepted'
--
-- Rollback: DROP TABLE invitations;

CREATE TABLE invitations (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  invited_email TEXT        NOT NULL,
  invited_by    UUID        NOT NULL REFERENCES auth.users(id),
  token         UUID        NOT NULL DEFAULT uuid_generate_v4() UNIQUE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'accepted', 'expired')),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_by   UUID        REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for token lookups on /accept-invite page
CREATE INDEX idx_invitations_token ON invitations(token);

-- Index for owner listing their sent invitations
CREATE INDEX idx_invitations_tenant_id ON invitations(tenant_id);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Owners can view, create, and delete invitations for their own tenant
CREATE POLICY "Owners can manage invitations" ON invitations
  FOR ALL USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND role = 'owner'
    )
  );

-- NOTE: Token lookup for /accept-invite is done via admin client (service role).
-- No public SELECT policy is intentional — prevents enumeration of invited emails.
