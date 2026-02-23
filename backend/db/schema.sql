-- input: Cloudflare D1 executes this SQL to initialize storage schema.
-- output: users/ciphers/sessions tables with indexes and triggers for timestamps/versioning.
-- pos: backend persistence foundation; update this file when table or version rules change.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  auth_key TEXT NOT NULL,
  kdf_salt TEXT NOT NULL,
  kdf_params TEXT NOT NULL,
  vault_version INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ciphers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  encrypted_dek TEXT NOT NULL,
  encrypted_data TEXT NOT NULL,
  item_version INTEGER NOT NULL DEFAULT 1,
  vault_version INTEGER NOT NULL DEFAULT 0,
  deleted_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_ciphers_user_id ON ciphers(user_id);
CREATE INDEX IF NOT EXISTS idx_ciphers_user_vault_version ON ciphers(user_id, vault_version);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

CREATE TRIGGER IF NOT EXISTS trg_users_updated_at
AFTER UPDATE ON users
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE users
  SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_ciphers_updated_at
AFTER UPDATE ON ciphers
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE ciphers
  SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_sessions_updated_at
AFTER UPDATE ON sessions
FOR EACH ROW
WHEN NEW.updated_at = OLD.updated_at
BEGIN
  UPDATE sessions
  SET updated_at = CAST(unixepoch('subsec') * 1000 AS INTEGER)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_ciphers_insert_bump_vault
AFTER INSERT ON ciphers
FOR EACH ROW
BEGIN
  UPDATE users
  SET vault_version = vault_version + 1
  WHERE id = NEW.user_id;

  UPDATE ciphers
  SET vault_version = (
    SELECT vault_version
    FROM users
    WHERE id = NEW.user_id
  )
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_ciphers_update_bump_versions
AFTER UPDATE OF encrypted_dek, encrypted_data, deleted_at ON ciphers
FOR EACH ROW
BEGIN
  UPDATE users
  SET vault_version = vault_version + 1
  WHERE id = NEW.user_id;

  UPDATE ciphers
  SET item_version = OLD.item_version + 1,
      vault_version = (
        SELECT vault_version
        FROM users
        WHERE id = NEW.user_id
      )
  WHERE id = NEW.id;
END;
