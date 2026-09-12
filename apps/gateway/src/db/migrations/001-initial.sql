PRAGMA journal_mode = WAL;
PRAGMA synchronous = FULL;
PRAGMA foreign_keys = ON;
PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS challenges (id TEXT PRIMARY KEY, document TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, subject TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS intents (id TEXT PRIMARY KEY, subject TEXT NOT NULL, document TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY, intent_id TEXT NOT NULL UNIQUE REFERENCES intents(id),
  subject TEXT NOT NULL, payment_tx TEXT NOT NULL, document TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS purchases_subject ON purchases(subject);
CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, subject TEXT NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchases(id), operations TEXT NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY, purchase_id TEXT NOT NULL REFERENCES purchases(id),
  operation TEXT NOT NULL, admitted_at INTEGER NOT NULL, finished_at INTEGER, outcome TEXT
);
CREATE INDEX IF NOT EXISTS usage_window ON usage_events(purchase_id, admitted_at);
CREATE TABLE IF NOT EXISTS receipts (purchase_id TEXT PRIMARY KEY REFERENCES purchases(id), document TEXT NOT NULL, reference TEXT);
CREATE TABLE IF NOT EXISTS closed_passes (purchase_id TEXT PRIMARY KEY REFERENCES purchases(id));
INSERT OR IGNORE INTO schema_migrations(version) VALUES(1);
