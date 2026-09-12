import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// A separate SQLite connection holds an OS lock for the process lifetime.
// The kernel releases it after a crash; no stale PID deletion race is possible.
export function acquireLock(databasePath: string): () => void {
  mkdirSync(dirname(databasePath), { recursive: true, mode: 0o700 });
  const lock = new DatabaseSync(`${databasePath}.lock.sqlite`);
  try { lock.exec('PRAGMA busy_timeout = 0; BEGIN EXCLUSIVE'); }
  catch { lock.close(); throw new Error('Database is already in use by another gateway or publisher'); }
  return () => { lock.exec('ROLLBACK'); lock.close(); };
}
