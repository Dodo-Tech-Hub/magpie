import * as SQLite from 'expo-sqlite';
import { migrate } from '@/store/migrate';

// Today's schema (version 0), copied as it was before the platform driver.
const V0 = `
PRAGMA foreign_keys = ON;
CREATE TABLE progress (
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
CREATE TABLE progress_channel (
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
CREATE TABLE setting (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);`;

type Db = SQLite.SQLiteDatabase;
const open = () => SQLite.openDatabaseAsync('test.db');
const version = async (db: Db) =>
  (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version;

async function seedV0(db: Db) {
  await db.execAsync(V0);
  await db.runAsync(
    `INSERT INTO progress VALUES ('p1','o1','old@x.com','Old','http://o.png','n1','new@x.com','New',NULL,10,20,99)`,
  );
  const rows: [string, string, number, string][] = [
    ['a', 'A', 1, 'waiting'],
    ['b', 'B', 0, 'moved'],
    ['c', 'C', 1, 'tomorrow'],
    ['d', 'D', 0, 'already_there'],
  ];
  for (const [id, title, picked, status] of rows) {
    await db.runAsync(
      `INSERT INTO progress_channel VALUES ('p1',?,?,'http://t.png',?,?,5)`,
      [id, title, picked, status],
    );
  }
  await db.runAsync(`INSERT INTO setting VALUES ('look','dark')`);
}

describe('migrate', () => {
  it('moves a version 0 database to version 3 with the same data', async () => {
    const db = await open();
    await seedV0(db);
    await migrate(db);
    expect(await version(db)).toBe(3);

    const p = await db.getFirstAsync<Record<string, unknown>>('SELECT * FROM progress');
    expect(p).toMatchObject({
      id: 'p1',
      platform: 'youtube',
      old_account_id: 'o1',
      old_handle: 'old@x.com',
      old_name: 'Old',
      new_handle: 'new@x.com',
      limit_hit_at: 99,
      resume_at: null,
    });

    const items = await db.getAllAsync<Record<string, unknown>>(
      'SELECT * FROM progress_item ORDER BY item_id',
    );
    expect(items.map((i) => [i.item_id, i.kind, i.status, i.picked, i.title, i.thumbnail_url])).toEqual([
      ['a', 'channel', 'waiting', 1, 'A', 'http://t.png'],
      ['b', 'channel', 'moved', 0, 'B', 'http://t.png'],
      ['c', 'channel', 'later', 1, 'C', 'http://t.png'],
      ['d', 'channel', 'already_there', 0, 'D', 'http://t.png'],
    ]);
    expect(items.every((i) => i.data === null && i.reason === null)).toBe(true);
    expect(await db.getFirstAsync('SELECT value FROM setting WHERE key = ?', ['look'])).toEqual({
      value: 'dark',
    });
    expect(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'progress_channel'")).toBeNull();
  });

  it('changes nothing when it runs twice', async () => {
    const db = await open();
    await seedV0(db);
    await migrate(db);
    await migrate(db);
    expect((await db.getAllAsync('SELECT * FROM progress_item')).length).toBe(4);
  });

  it('goes straight to version 3 on an empty database', async () => {
    const db = await open();
    await migrate(db);
    expect(await version(db)).toBe(3);
    expect(await db.getAllAsync('SELECT * FROM progress')).toEqual([]);
  });

  it('keeps the rules of version 2', async () => {
    const db = await open();
    await migrate(db);
    const add = (id: string, platform: string, o: string, n: string) =>
      db.runAsync(
        `INSERT INTO progress (id, platform, old_account_id, old_handle, old_name, new_account_id, new_handle, new_name, created_at, updated_at)
         VALUES (?,?,?,'h','n',?,'h','n',1,1)`,
        [id, platform, o, n],
      );
    await add('p1', 'youtube', 'o', 'n');
    await expect(add('p2', 'youtube', 'o', 'n')).rejects.toThrow();
    await add('p3', 'github', 'o', 'n');
    await db.runAsync(
      `INSERT INTO progress_item (progress_id, item_id, kind, title, picked, status, updated_at) VALUES ('p1','x','channel','X',1,'waiting',1)`,
    );
    await db.runAsync("DELETE FROM progress WHERE id = 'p1'");
    expect(await db.getAllAsync('SELECT * FROM progress_item')).toEqual([]);
  });

  it('moves a version 1 database to version 3 and keeps every row and its items', async () => {
    const db = await open();
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE progress (
        id TEXT PRIMARY KEY NOT NULL, platform TEXT NOT NULL, old_account_id TEXT NOT NULL,
        old_handle TEXT NOT NULL, old_name TEXT NOT NULL, old_photo_url TEXT,
        new_account_id TEXT NOT NULL, new_handle TEXT NOT NULL, new_name TEXT NOT NULL, new_photo_url TEXT,
        created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, limit_hit_at INTEGER, resume_at INTEGER,
        UNIQUE (platform, old_account_id, new_account_id));
      CREATE TABLE progress_item (
        progress_id TEXT NOT NULL REFERENCES progress(id) ON DELETE CASCADE, item_id TEXT NOT NULL,
        kind TEXT NOT NULL, title TEXT NOT NULL, thumbnail_url TEXT, data TEXT,
        picked INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'waiting', reason TEXT,
        updated_at INTEGER NOT NULL, PRIMARY KEY (progress_id, item_id));
      CREATE TABLE setting (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE add_log (account_key TEXT NOT NULL, at INTEGER NOT NULL);
      INSERT INTO progress VALUES ('p1','github','o','oh','On','http://o','n','nh','Nn',NULL,1,2,3,4);
      INSERT INTO progress_item VALUES ('p1','repo:1','repo','R',NULL,'{}',1,'moved',NULL,5);
      PRAGMA user_version = 1;`);
    await migrate(db);
    expect(await version(db)).toBe(3);
    expect(await db.getFirstAsync('SELECT id, new_account_id, resume_at FROM progress')).toEqual({
      id: 'p1',
      new_account_id: 'n',
      resume_at: 4,
    });
    expect(await db.getAllAsync('SELECT item_id, status FROM progress_item')).toEqual([
      { item_id: 'repo:1', status: 'moved' },
    ]);
    // The items still follow their progress.
    await db.runAsync("DELETE FROM progress WHERE id = 'p1'");
    expect(await db.getAllAsync('SELECT * FROM progress_item')).toEqual([]);
  });

  it('moves a version 2 database to version 3 and keeps each add for 1 hour', async () => {
    const db = await open();
    await db.execAsync(`
      CREATE TABLE add_log (account_key TEXT NOT NULL, at INTEGER NOT NULL);
      INSERT INTO add_log VALUES ('github:1', 1000), ('github:1', 5000), ('github:2', 9000);
      PRAGMA user_version = 2;`);
    await migrate(db);
    expect(await version(db)).toBe(3);
    expect(await db.getAllAsync('SELECT at, keep_until FROM add_log ORDER BY at')).toEqual([
      { at: 1000, keep_until: 3_601_000 },
      { at: 5000, keep_until: 3_605_000 },
      { at: 9000, keep_until: 3_609_000 },
    ]);
  });

  it('gives a new add log row no keep time until the pacer sets one', async () => {
    const db = await open();
    await migrate(db);
    await db.runAsync("INSERT INTO add_log (account_key, at) VALUES ('x', 1)");
    expect(await db.getFirstAsync('SELECT keep_until FROM add_log')).toEqual({ keep_until: 0 });
  });

  it('allows one progress with no new account per old account and platform', async () => {
    const db = await open();
    await migrate(db);
    const add = (id: string, platform: string, o: string) =>
      db.runAsync(
        `INSERT INTO progress (id, platform, old_account_id, old_handle, old_name, created_at, updated_at)
         VALUES (?,?,?,'h','n',1,1)`,
        [id, platform, o],
      );
    await add('p1', 'github', 'o');
    await expect(add('p2', 'github', 'o')).rejects.toThrow();
    await add('p3', 'github', 'o2');
    await add('p4', 'youtube', 'o');
  });
});
