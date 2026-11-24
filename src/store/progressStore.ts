import * as SQLite from 'expo-sqlite';
import { migrate } from '@/store/migrate';

// Tables and rules: specs/008-github-platform/data-model.md

const STATUSES = ['waiting', 'moving', 'moved', 'already_there', 'later', 'couldnt_move'] as const;
export type Status = (typeof STATUSES)[number];

export type AccountInfo = { id: string; handle: string; name: string; photoUrl: string | null };
export type NewItem = {
  itemId: string;
  kind: string;
  title: string;
  thumbnailUrl: string | null;
  // JSON that only the platform driver reads.
  data: string | null;
};
export type StoredItem = NewItem & { picked: boolean; status: Status; reason: string | null };
export type UnfinishedProgress = {
  id: string;
  platform: string;
  oldAccount: AccountInfo;
  // null until the new account signs in (FR-GH-021).
  newAccount: AccountInfo | null;
  left: number;
  limitHitAt: number | null;
  resumeAt: number | null;
};

type Db = SQLite.SQLiteDatabase;
let dbPromise: Promise<Db> | null = null;

export function initStore(): Promise<Db> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('progress.db');
      await migrate(db);
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

export async function findProgressForPair(platform: string, oldId: string, newAccountId: string) {
  const db = await initStore();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM progress WHERE platform = ? AND old_account_id = ? AND new_account_id = ?',
    [platform, oldId, newAccountId],
  );
  return row ? row.id : null;
}

// The progress with no new account yet for this old account, if any (FR-GH-021).
async function findProgressNoNew(platform: string, oldId: string) {
  const db = await initStore();
  const row = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM progress WHERE platform = ? AND old_account_id = ? AND new_account_id IS NULL',
    [platform, oldId],
  );
  return row ? row.id : null;
}

// newA may be null: the progress then starts at the old sign-in and gets its new account later.
export async function getOrCreateProgress(
  platform: string,
  oldA: AccountInfo,
  newA: AccountInfo | null,
): Promise<string> {
  const existing = newA
    ? await findProgressForPair(platform, oldA.id, newA.id)
    : await findProgressNoNew(platform, oldA.id);
  if (existing) return existing;
  const db = await initStore();
  const id = newId();
  const t = now();
  await db.runAsync(
    `INSERT INTO progress (id, platform, old_account_id, old_handle, old_name, old_photo_url,
       new_account_id, new_handle, new_name, new_photo_url, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, platform, oldA.id, oldA.handle, oldA.name, oldA.photoUrl, newA?.id ?? null, newA?.handle ?? null, newA?.name ?? null, newA?.photoUrl ?? null, t, t],
  );
  return id;
}

// The new account signed in. If its pair already has a progress, that one is kept and this one goes.
export async function attachNew(progressId: string, newA: AccountInfo): Promise<string> {
  const db = await initStore();
  const row = await db.getFirstAsync<{ platform: string; old_account_id: string }>(
    'SELECT platform, old_account_id FROM progress WHERE id = ?',
    [progressId],
  );
  if (!row) throw new Error('No such progress');
  const pair = await findProgressForPair(row.platform, row.old_account_id, newA.id);
  if (pair && pair !== progressId) {
    await deleteProgress(progressId);
    return pair;
  }
  await db.runAsync(
    'UPDATE progress SET new_account_id = ?, new_handle = ?, new_name = ?, new_photo_url = ?, updated_at = ? WHERE id = ?',
    [newA.id, newA.handle, newA.name, newA.photoUrl, now(), progressId],
  );
  return progressId;
}

// Existing rows keep their pick and status; only new items are added. A waiting row the old account
// no longer has is dropped (FR-GH-021).
export async function saveItems(progressId: string, items: NewItem[]): Promise<void> {
  const db = await initStore();
  const t = now();
  const keep = new Set(items.map((c) => c.itemId));
  await db.withTransactionAsync(async () => {
    const waiting = await db.getAllAsync<{ item_id: string }>(
      "SELECT item_id FROM progress_item WHERE progress_id = ? AND status = 'waiting'",
      [progressId],
    );
    for (const r of waiting) {
      if (!keep.has(r.item_id)) {
        await db.runAsync('DELETE FROM progress_item WHERE progress_id = ? AND item_id = ?', [progressId, r.item_id]);
      }
    }
    for (const c of items) {
      await db.runAsync(
        `INSERT OR IGNORE INTO progress_item
           (progress_id, item_id, kind, title, thumbnail_url, data, picked, status, updated_at)
         VALUES (?,?,?,?,?,?,1,'waiting',?)`,
        [progressId, c.itemId, c.kind, c.title, c.thumbnailUrl, c.data, t],
      );
    }
  });
}

type ItemRow = {
  item_id: string;
  kind: string;
  title: string;
  thumbnail_url: string | null;
  data: string | null;
  picked: number;
  status: string;
  reason: string | null;
};

// Sorted by the position of the kind in kindOrder, then by title ignoring case.
export async function getItems(progressId: string, kindOrder: string[] = []): Promise<StoredItem[]> {
  const db = await initStore();
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT item_id, kind, title, thumbnail_url, data, picked, status, reason FROM progress_item
     WHERE progress_id = ? ORDER BY title COLLATE NOCASE, item_id`,
    [progressId],
  );
  const rank = (k: string) => {
    const i = kindOrder.indexOf(k);
    return i < 0 ? kindOrder.length : i;
  };
  return rows
    .map((r) => ({
      itemId: r.item_id,
      kind: r.kind,
      title: r.title,
      thumbnailUrl: r.thumbnail_url,
      data: r.data,
      picked: r.picked === 1,
      // ponytail: a downgraded app cannot read newer states, waiting is the safe state
      status: (STATUSES as readonly string[]).includes(r.status) ? (r.status as Status) : 'waiting',
      reason: r.reason,
    }))
    .sort((a, b) => rank(a.kind) - rank(b.kind));
}

export async function setPicked(progressId: string, itemIds: string[], picked: boolean) {
  const db = await initStore();
  await db.withTransactionAsync(async () => {
    for (const id of itemIds) {
      await db.runAsync(
        `UPDATE progress_item SET picked = ?, updated_at = ?
         WHERE progress_id = ? AND item_id = ? AND status NOT IN ('already_there')`,
        [picked ? 1 : 0, now(), progressId, id],
      );
    }
  });
}

export async function setStatus(progressId: string, itemId: string, status: Status, reason?: string) {
  const db = await initStore();
  await db.runAsync(
    'UPDATE progress_item SET status = ?, reason = ?, updated_at = ? WHERE progress_id = ? AND item_id = ?',
    [status, reason ?? null, now(), progressId, itemId],
  );
}

// "Moved" and "already there" are final (SC-004).
export async function markAlreadyThere(progressId: string, itemIds: string[]) {
  const db = await initStore();
  await db.withTransactionAsync(async () => {
    for (const id of itemIds) {
      await db.runAsync(
        `UPDATE progress_item SET status = 'already_there', picked = 0, updated_at = ?
         WHERE progress_id = ? AND item_id = ? AND status NOT IN ('moved','already_there')`,
        [now(), progressId, id],
      );
    }
  });
}

export async function markWaitingAsLater(progressId: string) {
  const db = await initStore();
  await db.runAsync(
    `UPDATE progress_item SET status = 'later', updated_at = ?
     WHERE progress_id = ? AND picked = 1 AND status = 'waiting'`,
    [now(), progressId],
  );
}

export async function releaseLater(progressId: string) {
  const db = await initStore();
  await db.runAsync(
    `UPDATE progress_item SET status = 'waiting', updated_at = ?
     WHERE progress_id = ? AND status = 'later'`,
    [now(), progressId],
  );
}

export async function setLimitHit(progressId: string, at: number | null, resumeAt: number | null = null) {
  const db = await initStore();
  await db.runAsync('UPDATE progress SET limit_hit_at = ?, resume_at = ?, updated_at = ? WHERE id = ?', [
    at,
    resumeAt,
    now(),
    progressId,
  ]);
}

type ProgressRow = {
  id: string;
  platform: string;
  old_account_id: string; old_handle: string; old_name: string; old_photo_url: string | null;
  new_account_id: string | null; new_handle: string | null; new_name: string | null; new_photo_url: string | null;
  limit_hit_at: number | null;
  resume_at: number | null;
  left: number;
};

const toProgress = (r: ProgressRow): UnfinishedProgress => ({
  id: r.id,
  platform: r.platform,
  oldAccount: { id: r.old_account_id, handle: r.old_handle, name: r.old_name, photoUrl: r.old_photo_url },
  newAccount:
    r.new_account_id === null
      ? null
      : { id: r.new_account_id, handle: r.new_handle ?? '', name: r.new_name ?? '', photoUrl: r.new_photo_url },
  left: r.left,
  limitHitAt: r.limit_hit_at,
  resumeAt: r.resume_at,
});

const WITH_LEFT = `SELECT p.*, (SELECT COUNT(*) FROM progress_item c
  WHERE c.progress_id = p.id AND c.picked = 1
    AND c.status IN ('waiting','later','moving')) AS "left" FROM progress p`;

// Unfinished = at least one picked item still waiting (FR-032, FR-035). One platform, or all.
export async function listUnfinished(platform?: string): Promise<UnfinishedProgress[]> {
  const db = await initStore();
  const rows = await db.getAllAsync<ProgressRow>(
    `SELECT * FROM (${WITH_LEFT}) WHERE "left" > 0 AND (? IS NULL OR platform = ?) ORDER BY updated_at DESC`,
    [platform ?? null, platform ?? null],
  );
  return rows.map(toProgress);
}

export async function getProgress(id: string): Promise<UnfinishedProgress | null> {
  const db = await initStore();
  const row = await db.getFirstAsync<ProgressRow>(`SELECT * FROM (${WITH_LEFT}) WHERE id = ?`, [id]);
  return row ? toProgress(row) : null;
}

// The times of recent adds, for the pace (FR-GH-010). Rows older than 1 hour go on every write.
// keepMs: how long the pace needs this add on record (1 hour for GitHub, 1 day for Bluesky). Gone after that.
export async function recordAdd(accountKey: string, at: number, keepMs = 3_600_000) {
  const db = await initStore();
  await db.runAsync('DELETE FROM add_log WHERE keep_until < ?', [now()]);
  await db.runAsync('INSERT INTO add_log (account_key, at, keep_until) VALUES (?, ?, ?)', [accountKey, at, at + keepMs]);
}

export async function addsSince(accountKey: string, since: number): Promise<number[]> {
  const db = await initStore();
  const rows = await db.getAllAsync<{ at: number }>(
    'SELECT at FROM add_log WHERE account_key = ? AND at >= ? ORDER BY at',
    [accountKey, since],
  );
  return rows.map((r) => r.at);
}

export async function deleteProgress(id: string) {
  const db = await initStore();
  await db.runAsync('DELETE FROM progress WHERE id = ?', [id]);
}

export async function deleteAll() {
  const db = await initStore();
  await db.runAsync('DELETE FROM progress');
  await db.runAsync('DELETE FROM setting');
  await db.runAsync('DELETE FROM add_log');
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
