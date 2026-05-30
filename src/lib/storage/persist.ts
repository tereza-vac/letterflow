import { isTauri } from "@/lib/runtime";
import { SQL_SCHEMA, DB_NAME, APP_STATE_KEY } from "@/lib/storage/sql-schema";

/**
 * Persistence abstraction for the (non-secret) application snapshot.
 *
 * Two adapters are provided:
 *  - {@link TauriSqlAdapter}: SQLite via @tauri-apps/plugin-sql (production).
 *  - {@link LocalStorageAdapter}: browser localStorage (dev server & fallback).
 *
 * Both store a single JSON document keyed by {@link APP_STATE_KEY}. The full
 * relational schema (see sql-schema.ts) is also created in the SQLite case so a
 * future version can migrate to normalized tables / Drizzle without data loss.
 */
export interface PersistAdapter {
  load<T>(): Promise<T | null>;
  save<T>(value: T): Promise<void>;
}

class LocalStorageAdapter implements PersistAdapter {
  async load<T>(): Promise<T | null> {
    try {
      const raw = localStorage.getItem(APP_STATE_KEY);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
  async save<T>(value: T): Promise<void> {
    try {
      localStorage.setItem(APP_STATE_KEY, JSON.stringify(value));
    } catch {
      // Quota or serialization error — non-fatal for the MVP.
    }
  }
}

class TauriSqlAdapter implements PersistAdapter {
  private dbPromise: Promise<unknown> | null = null;

  private async db() {
    if (!this.dbPromise) {
      this.dbPromise = (async () => {
        const { default: Database } = await import("@tauri-apps/plugin-sql");
        const database = await Database.load(DB_NAME);
        for (const ddl of SQL_SCHEMA) {
          await database.execute(ddl);
        }
        return database;
      })();
    }
    return this.dbPromise as Promise<{
      execute: (q: string, b?: unknown[]) => Promise<unknown>;
      select: <R>(q: string, b?: unknown[]) => Promise<R>;
    }>;
  }

  async load<T>(): Promise<T | null> {
    try {
      const database = await this.db();
      const rows = await database.select<Array<{ value: string }>>(
        "SELECT value FROM app_state WHERE key = $1",
        [APP_STATE_KEY],
      );
      if (rows.length === 0) return null;
      return JSON.parse(rows[0].value) as T;
    } catch (err) {
      console.error("Failed to load app state from SQLite", err);
      return null;
    }
  }

  async save<T>(value: T): Promise<void> {
    try {
      const database = await this.db();
      const now = new Date().toISOString();
      await database.execute(
        `INSERT INTO app_state (key, value, updated_at) VALUES ($1, $2, $3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [APP_STATE_KEY, JSON.stringify(value), now],
      );
    } catch (err) {
      console.error("Failed to save app state to SQLite", err);
    }
  }
}

let adapter: PersistAdapter | null = null;

export function getPersistAdapter(): PersistAdapter {
  if (adapter) return adapter;
  adapter = isTauri() ? new TauriSqlAdapter() : new LocalStorageAdapter();
  return adapter;
}
