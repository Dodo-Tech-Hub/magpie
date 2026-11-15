import type { SQLiteDatabase } from 'expo-sqlite';

// Tables and rules: specs/008-github-platform/data-model.md
// Version 0 is the YouTube-only schema. Version 1 holds any platform.
const V1 = `
CREATE TABLE IF NOT EXISTS progress (
  id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL,
  old_account_id TEXT NOT NULL,
  old_handle TEXT NOT NULL, old_name TEXT NOT NULL, old_photo_url TEXT,
  new_account_id TEXT NOT NULL,
  new_handle TEXT NOT NULL, new_name TEXT NOT NULL, new_photo_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  limit_hit_at INTEGER,
  resume_at INTEGER,
  UNIQUE (platform, old_account_id, new_account_id)
);
CREATE TABLE IF NOT EXISTS progress_item (
  progress_id TEXT NOT NULL REFERENCES progress(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  data TEXT,
  picked INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting',
  reason TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (progress_id, item_id)
);
CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS add_log (account_key TEXT NOT NULL, at INTEGER NOT NULL);`;

const V0_TO_V1 = `
ALTER TABLE progress RENAME TO progress_v0;
ALTER TABLE progress_channel RENAME TO progress_channel_v0;
${V1}
INSERT INTO progress (id, platform, old_account_id, old_handle, old_name, old_photo_url,
    new_account_id, new_handle, new_name, new_photo_url, created_at, updated_at, limit_hit_at)
  SELECT id, 'youtube', old_account_id, old_email, old_name, old_photo_url,
    new_account_id, new_email, new_name, new_photo_url, created_at, updated_at, limit_hit_at
  FROM progress_v0;
INSERT INTO progress_item (progress_id, item_id, kind, title, thumbnail_url, picked, status, updated_at)
  SELECT progress_id, channel_id, 'channel', title, thumbnail_url, picked,
    CASE status WHEN 'tomorrow' THEN 'later' ELSE status END, updated_at
  FROM progress_channel_v0;
DROP TABLE progress_channel_v0;
DROP TABLE progress_v0;
PRAGMA user_version = 1;`;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  // Foreign keys cannot change inside a transaction, so this comes first.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const v = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  if (v >= 1) return;
  const old = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'progress_channel'");
  // One transaction: a failed copy leaves version 0 untouched.
  await db.withTransactionAsync(async () => {
    await db.execAsync(old ? V0_TO_V1 : `${V1}\nPRAGMA user_version = 1;`);
  });
}
