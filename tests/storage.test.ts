import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { deleteDatabase } from '../src/storage/db';
import {
  DEFAULT_SETTINGS,
  exportDatabase,
  initialiseDatabase,
  putFormulation,
  putIngredient,
  putProfile,
  putSettings,
  readSnapshot,
  removeFormulation,
  removeIngredient,
  removeProfile,
  replaceDatabase,
  resetDatabase,
} from '../src/storage/repository';
import { BUILT_IN_INGREDIENTS, createEmptyIngredient } from '../src/data/ingredients';
import { validateBackup } from '../src/storage/backup';
import type { LivestockProfile, SavedFormulation } from '../src/domain/types';

const profile: LivestockProfile = {
  id: 'profile-storage-test',
  name: 'ملف اختبار التخزين',
  species: 'goat',
  category: 'maintenance',
  ageMonths: 30,
  liveWeightKg: 38,
  targetDailyGainG: null,
  headCount: 4,
  pregnancyStage: null,
  lactationMonth: null,
  dailyMilkL: null,
  feedingSystem: 'grazing',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const formulation: SavedFormulation = {
  id: 'formulation-storage-test',
  name: 'عليقة اختبار التخزين',
  notes: '',
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  version: 1,
  priceSnapshot: [],
  result: {
    status: 'feasible_unverified_adequacy',
    standardId: 'inrae-2018',
    standardVersion: 'illustrative-1',
    engineVersion: '1.0.0',
    profileId: profile.id,
    profileSnapshot: profile,
    requirements: {
      profileId: profile.id,
      standardId: 'inrae-2018',
      standardVersion: 'illustrative-1',
      status: 'illustrative',
      dryMatterIntakeKg: 1,
      energyKey: 'ufl',
      requirements: [],
      ndfMinPctDm: null,
      notesAr: [],
      blockersAr: [],
    },
    lines: [],
    totalDmKg: 0,
    totalAfKg: 0,
    totalCostPerAnimalDay: 0,
    costPerKgDm: 0,
    costPerKgAf: 0,
    totalCostHerdDay: 0,
    nutrientTotals: {},
    checks: [],
    unevaluated: [],
    messagesAr: [],
    warningsAr: [],
    calculatedAt: '2026-01-02T00:00:00.000Z',
    inputFingerprint: 'storage-test-fingerprint',
  },
};

beforeEach(async () => {
  await deleteDatabase();
});

afterEach(async () => {
  await deleteDatabase();
});

describe('IndexedDB repository', () => {
  it('seeds the built-in catalogue, example profiles and default settings on first run', async () => {
    const snapshot = await initialiseDatabase();
    expect(snapshot.ingredients).toHaveLength(BUILT_IN_INGREDIENTS.length);
    expect(snapshot.profiles).toHaveLength(3);
    expect(snapshot.formulations).toHaveLength(0);
    expect(snapshot.settings).toEqual(DEFAULT_SETTINGS);
    expect(snapshot.profiles.every((item) => item.name.startsWith('مثال'))).toBe(true);
  });

  it('does not duplicate seed data when initialised again', async () => {
    await initialiseDatabase();
    const second = await initialiseDatabase();
    expect(second.ingredients).toHaveLength(BUILT_IN_INGREDIENTS.length);
    expect(second.profiles).toHaveLength(3);
  });

  it('creates, updates and deletes an ingredient', async () => {
    await initialiseDatabase();
    const ingredient = {
      ...createEmptyIngredient(),
      id: 'ing-user-test',
      nameAr: 'مادة اختبار',
      dataStatus: 'user_entered' as const,
    };
    await putIngredient(ingredient);
    let snapshot = await readSnapshot();
    expect(snapshot.ingredients.some((item) => item.id === ingredient.id)).toBe(true);

    await putIngredient({ ...ingredient, nameAr: 'اسم معدّل' });
    snapshot = await readSnapshot();
    expect(snapshot.ingredients.find((item) => item.id === ingredient.id)?.nameAr).toBe('اسم معدّل');

    await removeIngredient(ingredient.id);
    snapshot = await readSnapshot();
    expect(snapshot.ingredients.some((item) => item.id === ingredient.id)).toBe(false);
  });

  it('does not resurrect deleted built-in feeds after a restart', async () => {
    await initialiseDatabase();
    const victim = BUILT_IN_INGREDIENTS[0]!;
    await removeIngredient(victim.id);
    const afterRestart = await initialiseDatabase();
    expect(afterRestart.ingredients.some((item) => item.id === victim.id)).toBe(false);
    expect(afterRestart.ingredients).toHaveLength(BUILT_IN_INGREDIENTS.length - 1);
  });

  it('creates, updates and deletes livestock profiles', async () => {
    await initialiseDatabase();
    await putProfile(profile);
    let snapshot = await readSnapshot();
    expect(snapshot.profiles.find((item) => item.id === profile.id)?.name).toBe(profile.name);

    await putProfile({ ...profile, name: 'اسم جديد' });
    snapshot = await readSnapshot();
    expect(snapshot.profiles.find((item) => item.id === profile.id)?.name).toBe('اسم جديد');

    await removeProfile(profile.id);
    snapshot = await readSnapshot();
    expect(snapshot.profiles.some((item) => item.id === profile.id)).toBe(false);
  });

  it('stores and deletes saved formulations', async () => {
    await initialiseDatabase();
    await putFormulation(formulation);
    let snapshot = await readSnapshot();
    expect(snapshot.formulations).toHaveLength(1);
    expect(snapshot.formulations[0]?.id).toBe(formulation.id);

    await removeFormulation(formulation.id);
    snapshot = await readSnapshot();
    expect(snapshot.formulations).toHaveLength(0);
  });

  it('persists settings changes', async () => {
    await initialiseDatabase();
    const settings = { ...DEFAULT_SETTINGS, preferredBasis: 'DM' as const, dashboardPeriodDays: 7 };
    await putSettings(settings);
    const snapshot = await readSnapshot();
    expect(snapshot.settings.preferredBasis).toBe('DM');
    expect(snapshot.settings.dashboardPeriodDays).toBe(7);
  });

  it('exports a backup that passes full-file validation', async () => {
    await initialiseDatabase();
    await putFormulation(formulation);
    const backup = await exportDatabase();
    const validation = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.file.data.ingredients).toHaveLength(BUILT_IN_INGREDIENTS.length);
    expect(validation.file.data.formulations).toHaveLength(1);
  });

  it('replaces the whole database atomically with an imported backup', async () => {
    await initialiseDatabase();
    const original = await exportDatabase();
    const importedIngredient = {
      ...createEmptyIngredient(),
      id: 'ing-imported-test',
      nameAr: 'مادة مستوردة',
    };
    await replaceDatabase({
      ingredients: [importedIngredient],
      profiles: [profile],
      formulations: [formulation],
      settings: { ...DEFAULT_SETTINGS, defaultStandardId: 'nrc-2007' },
    });

    const snapshot = await readSnapshot();
    expect(snapshot.ingredients).toHaveLength(1);
    expect(snapshot.ingredients[0]?.id).toBe('ing-imported-test');
    expect(snapshot.profiles).toHaveLength(1);
    expect(snapshot.formulations).toHaveLength(1);
    expect(snapshot.settings.defaultStandardId).toBe('nrc-2007');

    // Restoring the original export returns the seeded data.
    await replaceDatabase(original.data);
    const restored = await readSnapshot();
    expect(restored.ingredients).toHaveLength(BUILT_IN_INGREDIENTS.length);
    expect(restored.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('resets to the seeded state', async () => {
    await initialiseDatabase();
    await removeIngredient(BUILT_IN_INGREDIENTS[0]!.id);
    await putProfile(profile);
    await putFormulation(formulation);
    await resetDatabase();
    const snapshot = await readSnapshot();
    expect(snapshot.ingredients).toHaveLength(BUILT_IN_INGREDIENTS.length);
    expect(snapshot.profiles).toHaveLength(3);
    expect(snapshot.formulations).toHaveLength(0);
    expect(snapshot.settings).toEqual(DEFAULT_SETTINGS);
  });
});
