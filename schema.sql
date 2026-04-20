CREATE TABLE vault_entries (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  username TEXT,
  password TEXT,
  url TEXT,
  notes TEXT,
  category TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
