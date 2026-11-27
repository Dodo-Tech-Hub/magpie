import type { SQLiteDatabase } from 'expo-sqlite';

// Tables and rules: specs/008-github-platform/data-model.md
// Version 0 is the YouTube-only schema. Version 1 holds any platform. Version 2 lets a progress
// have no new account yet (FR-GH-021). Version 3 gives each add a keep time, so one platform keeps adds
// for an hour and another for a day (specs/013-bluesky-platform/data-model.md).
const progressTable = (name: string) => `
CREATE TABLE ${name} (
  id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL,
  old_account_id TEXT NOT NULL,
  old_handle TEXT NOT NULL, old_name TEXT NOT NULL, old_photo_url TEXT,
  new_account_id TEXT,
  new_handle TEXT, new_name TEXT, new_photo_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  limit_hit_at INTEGER,
  resume_at INTEGER,
  UNIQUE (platform, old_account_id, new_account_id)
);`;
// Nulls are distinct in UNIQUE, so one progress with no new account needs its own index.
const NO_NEW_INDEX =
  'CREATE UNIQUE INDEX IF NOT EXISTS progress_no_new ON progress (platform, old_account_id) WHERE new_account_id IS NULL;';

const SCHEMA = `
${progressTable('progress').replace('CREATE TABLE', 'CREATE TABLE IF NOT EXISTS')}
${NO_NEW_INDEX}
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
CREATE TABLE IF NOT EXISTS add_log (account_key TEXT NOT NULL, at INTEGER NOT NULL, keep_until INTEGER NOT NULL DEFAULT 0);`;

const V0_TO_V3 = `
ALTER TABLE progress RENAME TO progress_v0;
ALTER TABLE progress_channel RENAME TO progress_channel_v0;
${SCHEMA}
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
PRAGMA user_version = 3;`;

// Rebuild with foreign keys off (migrate does that), so dropping the old table does not delete the items.
const V1_TO_V2 = `
${progressTable('progress_v2')}
INSERT INTO progress_v2 (id, platform, old_account_id, old_handle, old_name, old_photo_url,
    new_account_id, new_handle, new_name, new_photo_url, created_at, updated_at, limit_hit_at, resume_at)
  SELECT id, platform, old_account_id, old_handle, old_name, old_photo_url,
    new_account_id, new_handle, new_name, new_photo_url, created_at, updated_at, limit_hit_at, resume_at
  FROM progress;
DROP TABLE progress;
ALTER TABLE progress_v2 RENAME TO progress;
${NO_NEW_INDEX}
PRAGMA user_version = 2;`;

// Every add in the log so far is GitHub's, which keeps adds for 1 hour.
const V2_TO_V3 = `
ALTER TABLE add_log ADD COLUMN keep_until INTEGER NOT NULL DEFAULT 0;
UPDATE add_log SET keep_until = at + 3600000;
PRAGMA user_version = 3;`;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const v = (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version ?? 0;
  // Foreign keys cannot change inside a transaction, so this comes first.
  await db.execAsync(`PRAGMA foreign_keys = ${v >= 2 ? 'ON' : 'OFF'};`);
  if (v >= 3) return;
  try {
    const old = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'progress_channel'");
    // One transaction: a failed copy leaves the old version untouched.
    await db.withTransactionAsync(async () => {
      if (v === 2) await db.execAsync(V2_TO_V3);
      else if (v === 1) await db.execAsync(`${V1_TO_V2}\n${V2_TO_V3}`);
      else await db.execAsync(old ? V0_TO_V3 : `${SCHEMA}\nPRAGMA user_version = 3;`);
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
