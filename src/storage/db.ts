import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Ingredient, LivestockProfile, SavedFormulation } from '../domain/types';

export const DB_NAME = 'smartfeed';
export const DB_VERSION = 1;

interface SettingsRecord {
  id: 'app';
  value: AppSettings;
}

interface MetaRecord {
  key: string;
  value: string;
}

export interface SmartFeedDB extends DBSchema {
  ingredients: { key: string; value: Ingredient };
  profiles: { key: string; value: LivestockProfile };
  formulations: {
    key: string;
    value: SavedFormulation;
    indexes: { 'by-created-at': string };
  };
  settings: { key: string; value: SettingsRecord };
  meta: { key: string; value: MetaRecord };
}

let dbPromise: Promise<IDBPDatabase<SmartFeedDB>> | null = null;

export function getDb(): Promise<IDBPDatabase<SmartFeedDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SmartFeedDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('ingredients')) {
          db.createObjectStore('ingredients', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('profiles')) {
          db.createObjectStore('profiles', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('formulations')) {
          const store = db.createObjectStore('formulations', { keyPath: 'id' });
          store.createIndex('by-created-at', 'createdAt');
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/** Reset the cached connection — used by tests that delete the database. */
export function resetDbConnection(): void {
  dbPromise = null;
}

export async function deleteDatabase(): Promise<void> {
  const existing = dbPromise;
  dbPromise = null;
  if (existing) {
    try {
      const db = await existing;
      db.close();
    } catch {
      /* ignore */
    }
  }
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('database delete failed'));
    request.onblocked = () => resolve();
  });
}
