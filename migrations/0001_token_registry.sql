CREATE TABLE IF NOT EXISTS token_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chain_id INTEGER NOT NULL,
  address TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  image_uri TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  social TEXT NOT NULL DEFAULT '',
  tx_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(chain_id, address),
  UNIQUE(chain_id, tx_hash)
);
CREATE INDEX IF NOT EXISTS idx_token_registry_created ON token_registry(chain_id, created_at DESC);
