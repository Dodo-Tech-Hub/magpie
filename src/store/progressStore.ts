import * as SQLite from 'expo-sqlite';

// Tables and rules: specs/001-subscription-migration/data-model.md

export type Status =
  | 'waiting'
  | 'moving'
  | 'moved'
  | 'already_there'
  | 'tomorrow'
  | 'couldnt_move';

export type AccountInfo = { id: string; email: string; name: string; photoUrl: string | null };
export type NewChannel = { channelId: string; title: string; thumbnailUrl: string | null };
export type StoredChannel = NewChannel & { picked: boolean; status: Status };
export type UnfinishedProgress = {
  id: string;
  oldAccount: AccountInfo;
  newAccount: AccountInfo;
  left: number;
  limitHitAt: number | null;
};

type Db = SQLite.SQLiteDatabase;
let dbPromise: Promise<Db> | null = null;

const SCHEMA = `
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS progress (
  id TEXT PRIMARY KEY NOT NULL,
  old_account_id TEXT NOT NULL,
  old_email TEXT NOT NULL, old_name TEXT NOT NULL, old_photo_url TEXT,
  new_account_id TEXT NOT NULL,
  new_email TEXT NOT NULL, new_name TEXT NOT NULL, new_photo_url TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  limit_hit_at INTEGER,
  UNIQUE (old_account_id, new_account_id)
);
CREATE TABLE IF NOT EXISTS progress_channel (
  progress_id TEXT NOT NULL REFERENCES progress(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail_url TEXT,
  picked INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting','moving','moved','already_there','tomorrow','couldnt_move')),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (progress_id, channel_id)
);
CREATE TABLE IF NOT EXISTS setting (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`;

export function initStore(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('progress.db');
      await db.execAsync(SCHEMA);
      return db;
    })();
  }
  return dbPromise;
}

export async function closeStore(): Promise<void> {
  if (!dbPromise) return;
  const db = await dbPromise;
  dbPromise = null;
  await db.closeAsync();
}

const now = () => Date.now();
const newId = () => `${now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

export async function findProgressForPair(oldId: string, newAccountId: string) {
  const db = await initStore();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM progress WHERE old_account_id = ? AND new_account_id = ?',
    [oldId, newAccountId],
  );
  return row ? row.id : null;
}

export async function getOrCreateProgress(oldA: AccountInfo, newA: AccountInfo): Promise<string> {
  const existing = await findProgressForPair(oldA.id, newA.id);
  if (existing) return existing;
  const db = await initStore();
  const id = newId();
  const t = now();
  await db.runAsync(
    `INSERT INTO progress (id, old_account_id, old_email, old_name, old_photo_url,
       new_account_id, new_email, new_name, new_photo_url, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [id, oldA.id, oldA.email, oldA.name, oldA.photoUrl, newA.id, newA.email, newA.name, newA.photoUrl, t, t],
  );
  return id;
}

// Existing rows keep their pick and status; only new channels are added.
export async function saveChannels(progressId: string, channels: NewChannel[]): Promise<void> {
  const db = await initStore();
  const t = now();
  await db.withTransactionAsync(async () => {
    for (const c of channels) {
      await db.runAsync(
        `INSERT OR IGNORE INTO progress_channel
           (progress_id, channel_id, title, thumbnail_url, picked, status, updated_at)
         VALUES (?,?,?,?,1,'waiting',?)`,
        [progressId, c.channelId, c.title, c.thumbnailUrl, t],
      );
    }
  });
}

type ChannelRow = {
  channel_id: string;
  title: string;
  thumbnail_url: string | null;
  picked: number;
  status: Status;
};

export async function getChannels(progressId: string): Promise<StoredChannel[]> {
  const db = await initStore();
  const rows = await db.getAllAsync<ChannelRow>(
    'SELECT channel_id, title, thumbnail_url, picked, status FROM progress_channel WHERE progress_id = ? ORDER BY title COLLATE NOCASE, channel_id',
    [progressId],
  );
  return rows.map((r) => ({
    channelId: r.channel_id,
    title: r.title,
    thumbnailUrl: r.thumbnail_url,
    picked: r.picked === 1,
    status: r.status,
  }));
}

export async function setPicked(progressId: string, channelIds: string[], picked: boolean) {
  const db = await initStore();
  await db.withTransactionAsync(async () => {
    for (const id of channelIds) {
      await db.runAsync(
        `UPDATE progress_channel SET picked = ?, updated_at = ?
         WHERE progress_id = ? AND channel_id = ? AND status NOT IN ('already_there')`,
        [picked ? 1 : 0, now(), progressId, id],
      );
    }
  });
}

export async function setStatus(progressId: string, channelId: string, status: Status) {
  const db = await initStore();
  await db.runAsync(
    'UPDATE progress_channel SET status = ?, updated_at = ? WHERE progress_id = ? AND channel_id = ?',
    [status, now(), progressId, channelId],
  );
}

// "Moved" and "already there" are final (SC-004).
export async function markAlreadyThere(progressId: string, channelIds: string[]) {
  const db = await initStore();
  await db.withTransactionAsync(async () => {
    for (const id of channelIds) {
      await db.runAsync(
        `UPDATE progress_channel SET status = 'already_there', picked = 0, updated_at = ?
         WHERE progress_id = ? AND channel_id = ? AND status NOT IN ('moved','already_there')`,
        [now(), progressId, id],
      );
    }
  });
}

export async function markWaitingAsTomorrow(progressId: string) {
  const db = await initStore();
  await db.runAsync(
    `UPDATE progress_channel SET status = 'tomorrow', updated_at = ?
     WHERE progress_id = ? AND picked = 1 AND status = 'waiting'`,
    [now(), progressId],
  );
}

export async function releaseTomorrow(progressId: string) {
  const db = await initStore();
  await db.runAsync(
    `UPDATE progress_channel SET status = 'waiting', updated_at = ?
     WHERE progress_id = ? AND status = 'tomorrow'`,
    [now(), progressId],
  );
}

export async function setLimitHit(progressId: string, at: number | null) {
  const db = await initStore();
  await db.runAsync('UPDATE progress SET limit_hit_at = ?, updated_at = ? WHERE id = ?', [
    at,
    now(),
    progressId,
  ]);
}

type ProgressRow = {
  id: string;
  old_account_id: string; old_email: string; old_name: string; old_photo_url: string | null;
  new_account_id: string; new_email: string; new_name: string; new_photo_url: string | null;
  limit_hit_at: number | null;
  left: number;
};

const toProgress = (r: ProgressRow): UnfinishedProgress => ({
  id: r.id,
  oldAccount: { id: r.old_account_id, email: r.old_email, name: r.old_name, photoUrl: r.old_photo_url },
  newAccount: { id: r.new_account_id, email: r.new_email, name: r.new_name, photoUrl: r.new_photo_url },
  left: r.left,
  limitHitAt: r.limit_hit_at,
});

const WITH_LEFT = `SELECT p.*, (SELECT COUNT(*) FROM progress_channel c
  WHERE c.progress_id = p.id AND c.picked = 1
    AND c.status IN ('waiting','tomorrow','moving')) AS "left" FROM progress p`;

// Unfinished = at least one picked channel still waiting (FR-032, FR-035).
export async function listUnfinished(): Promise<UnfinishedProgress[]> {
  const db = await initStore();
  const rows = await db.getAllAsync<ProgressRow>(
    `SELECT * FROM (${WITH_LEFT}) WHERE "left" > 0 ORDER BY updated_at DESC`,
  );
  return rows.map(toProgress);
}

export async function getProgress(id: string): Promise<UnfinishedProgress | null> {
  const db = await initStore();
  const row = await db.getFirstAsync<ProgressRow>(`SELECT * FROM (${WITH_LEFT}) WHERE id = ?`, [id]);
  return row ? toProgress(row) : null;
}

export async function deleteProgress(id: string) {
  const db = await initStore();
  await db.runAsync('DELETE FROM progress WHERE id = ?', [id]);
}

export async function deleteAll() {
  const db = await initStore();
  await db.runAsync('DELETE FROM progress');
  await db.runAsync('DELETE FROM setting');
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await initStore();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM setting WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function setSetting(key: string, value: string) {
  const db = await initStore();
  await db.runAsync('INSERT OR REPLACE INTO setting (key, value) VALUES (?, ?)', [key, value]);
}
