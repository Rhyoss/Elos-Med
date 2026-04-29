-- ============================================================================
-- DermaOS - Security/session schema extensions
-- ============================================================================

CREATE TABLE IF NOT EXISTS shared.encryption_key_versions (
  version    INT PRIMARY KEY,
  algorithm  TEXT NOT NULL DEFAULT 'aes-256-gcm',
  active     BOOLEAN NOT NULL DEFAULT true,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO shared.encryption_key_versions (version, active)
VALUES (1, true)
ON CONFLICT (version) DO NOTHING;

ALTER TABLE shared.users
  ADD COLUMN IF NOT EXISTS password_version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS known_ip_hashes TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_users_password_version
  ON shared.users (id, password_version);

