// Real SQL engine (Node's built-in SQLite) behind the expo-sqlite calls the app uses,
// so tests check real constraints (unique keys, cascade delete).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DatabaseSync } = require('node:sqlite');

type Params = (string | number | null)[];

export async function openDatabaseAsync() {
  const db = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => db.exec(sql),
    runAsync: async (sql: string, params: Params = []) => db.prepare(sql).run(...params),
    getAllAsync: async (sql: string, params: Params = []) => db.prepare(sql).all(...params),
    getFirstAsync: async (sql: string, params: Params = []) =>
      db.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (task: () => Promise<void>) => {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
    closeAsync: async () => db.close(),
  };
}
