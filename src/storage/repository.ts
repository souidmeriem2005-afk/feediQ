import type {
  AppSettings,
  Ingredient,
  LivestockProfile,
  SavedFormulation,
} from '../domain/types';
import { BUILT_IN_INGREDIENTS } from '../data/ingredients';
import { isoDate } from '../domain/units';
import { createBackup, type BackupData, type BackupFile } from './backup';
import { getDb } from './db';

export const DEFAULT_SETTINGS: AppSettings = {
  currency: 'DZD',
  preferredBasis: 'AF',
  showDataStatus: true,
  demoAcknowledged: false,
  defaultStandardId: 'inrae-2018',
  dashboardPeriodDays: 30,
};

const SEED_FLAG = 'seed_v1';

function seedProfiles(): LivestockProfile[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'profile-seed-fattening-sheep',
      name: 'مثال — حملان تسمين',
      species: 'sheep',
      category: 'fattening',
      ageMonths: 8,
      liveWeightKg: 35,
      targetDailyGainG: 220,
      headCount: 12,
      pregnancyStage: null,
      lactationMonth: null,
      dailyMilkL: null,
      feedingSystem: 'mixed',
      breed: 'أولاد جلال (مثال)',
      notes: 'ملف مثال قابل للتعديل أو الحذف. ليس بيانات حيوانات حقيقية.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'profile-seed-lactating-goat',
      name: 'مثال — ماعز حلوبة',
      species: 'goat',
      category: 'lactating',
      ageMonths: 36,
      liveWeightKg: 40,
      targetDailyGainG: null,
      headCount: 8,
      pregnancyStage: null,
      lactationMonth: 2,
      dailyMilkL: 2.5,
      feedingSystem: 'housed',
      notes: 'ملف مثال قابل للتعديل أو الحذف. ليس بيانات حيوانات حقيقية.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'profile-seed-growing-sheep',
      name: 'مثال — حملان نامية',
      species: 'sheep',
      category: 'growing',
      ageMonths: 5,
      liveWeightKg: 25,
      targetDailyGainG: 180,
      headCount: 15,
      pregnancyStage: null,
      lactationMonth: null,
      dailyMilkL: null,
      feedingSystem: 'mixed',
      notes: 'ملف مثال قابل للتعديل أو الحذف. ليس بيانات حيوانات حقيقية.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export interface DatabaseSnapshot {
  ingredients: Ingredient[];
  profiles: LivestockProfile[];
  formulations: SavedFormulation[];
  settings: AppSettings;
}

/**
 * Open the database and, on the very first run only, write the built-in
 * catalogue and example profiles. The seed flag lives in `meta`, so deleting
 * every built-in feed does not cause them to reappear on the next launch.
 */
export async function initialiseDatabase(): Promise<DatabaseSnapshot> {
  const db = await getDb();
  const seeded = await db.get('meta', SEED_FLAG);

  if (!seeded) {
    const tx = db.transaction(['ingredients', 'profiles', 'settings', 'meta'], 'readwrite');
    for (const ingredient of BUILT_IN_INGREDIENTS) {
      await tx.objectStore('ingredients').put(structuredCloneSafe(ingredient));
    }
    for (const profile of seedProfiles()) {
      await tx.objectStore('profiles').put(profile);
    }
    await tx.objectStore('settings').put({ id: 'app', value: { ...DEFAULT_SETTINGS } });
    await tx.objectStore('meta').put({ key: SEED_FLAG, value: new Date().toISOString() });
    await tx.done;
  } else {
    const existingSettings = await db.get('settings', 'app');
    if (!existingSettings) {
      await db.put('settings', { id: 'app', value: { ...DEFAULT_SETTINGS } });
    }
  }

  return readSnapshot();
}

export async function readSnapshot(): Promise<DatabaseSnapshot> {
  const db = await getDb();
  const tx = db.transaction(['ingredients', 'profiles', 'formulations', 'settings'], 'readonly');
  const [ingredients, profiles, formulations, settingsRecord] = await Promise.all([
    tx.objectStore('ingredients').getAll(),
    tx.objectStore('profiles').getAll(),
    tx.objectStore('formulations').getAll(),
    tx.objectStore('settings').get('app'),
  ]);
  await tx.done;

  ingredients.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
  profiles.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  formulations.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    ingredients,
    profiles,
    formulations,
    settings: settingsRecord?.value ?? { ...DEFAULT_SETTINGS },
  };
}

export async function putIngredient(ingredient: Ingredient): Promise<void> {
  const db = await getDb();
  await db.put('ingredients', ingredient);
}

export async function removeIngredient(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('ingredients', id);
}

export async function putProfile(profile: LivestockProfile): Promise<void> {
  const db = await getDb();
  await db.put('profiles', profile);
}

export async function removeProfile(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('profiles', id);
}

export async function putFormulation(formulation: SavedFormulation): Promise<void> {
  const db = await getDb();
  await db.put('formulations', formulation);
}

export async function removeFormulation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('formulations', id);
}

export async function putSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', { id: 'app', value: settings });
}

export async function exportDatabase(): Promise<BackupFile> {
  const snapshot = await readSnapshot();
  return createBackup({
    ingredients: snapshot.ingredients,
    profiles: snapshot.profiles,
    formulations: snapshot.formulations,
    settings: snapshot.settings,
  });
}

/** Replace the entire database with a validated backup. Atomic. */
export async function replaceDatabase(data: BackupData): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ['ingredients', 'profiles', 'formulations', 'settings', 'meta'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('ingredients').clear(),
    tx.objectStore('profiles').clear(),
    tx.objectStore('formulations').clear(),
    tx.objectStore('settings').clear(),
  ]);
  for (const ingredient of data.ingredients) {
    await tx.objectStore('ingredients').put(ingredient);
  }
  for (const profile of data.profiles) {
    await tx.objectStore('profiles').put(profile);
  }
  for (const formulation of data.formulations) {
    await tx.objectStore('formulations').put(formulation);
  }
  await tx.objectStore('settings').put({ id: 'app', value: data.settings });
  await tx.objectStore('meta').put({ key: SEED_FLAG, value: isoDate() });
  await tx.done;
}

/** Wipe every record (used by "reset all data"). The catalogue is re-seeded. */
export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(
    ['ingredients', 'profiles', 'formulations', 'settings', 'meta'],
    'readwrite',
  );
  await Promise.all([
    tx.objectStore('ingredients').clear(),
    tx.objectStore('profiles').clear(),
    tx.objectStore('formulations').clear(),
    tx.objectStore('settings').clear(),
    tx.objectStore('meta').clear(),
  ]);
  await tx.done;
  await initialiseDatabase();
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}
