import { describe, expect, it } from 'vitest';
import {
  BACKUP_APP_ID,
  BACKUP_SCHEMA_VERSION,
  createBackup,
  serialiseBackup,
  validateBackup,
  type BackupData,
} from '../src/storage/backup';
import { BUILT_IN_INGREDIENTS } from '../src/data/ingredients';
import { DEFAULT_SETTINGS } from '../src/storage/repository';
import type { Ingredient, LivestockProfile, SavedFormulation } from '../src/domain/types';

const profile: LivestockProfile = {
  id: 'profile-test',
  name: 'اختبار',
  species: 'sheep',
  category: 'maintenance',
  ageMonths: 24,
  liveWeightKg: 45,
  targetDailyGainG: null,
  headCount: 5,
  pregnancyStage: null,
  lactationMonth: null,
  dailyMilkL: null,
  feedingSystem: 'housed',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const formulation: SavedFormulation = {
  id: 'formulation-test',
  name: 'عليقة اختبار',
  notes: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  priceSnapshot: [
    {
      ingredientId: 'ing-barley',
      nameAr: 'شعير',
      valuePerKgAsFed: 45,
      date: '2026-01-01',
    },
  ],
  result: {
    status: 'feasible_unverified_adequacy',
    standardId: 'inrae-2018',
    standardVersion: 'illustrative-1',
    engineVersion: '1.0.0',
    profileId: 'profile-test',
    profileSnapshot: profile,
    requirements: {
      profileId: 'profile-test',
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
    lines: [
      {
        ingredientId: 'ing-barley',
        nameAr: 'شعير',
        quantityKgDM: 0.5,
        quantityKgAF: 0.57,
        sharePctDM: 100,
        sharePctAF: 100,
        costPerAnimalDay: 25,
        pricePerKgAsFed: 45,
        priceDate: '2026-01-01',
        dryMatterPctAsFed: 88,
        stockKgAsFed: null,
        stockWarning: false,
        contribution: {},
      },
    ],
    totalDmKg: 0.5,
    totalAfKg: 0.57,
    totalCostPerAnimalDay: 25,
    costPerKgDm: 50,
    costPerKgAf: 43.8,
    totalCostHerdDay: 125,
    nutrientTotals: {},
    checks: [],
    unevaluated: [],
    messagesAr: [],
    warningsAr: [],
    calculatedAt: '2026-01-01T00:00:00.000Z',
    inputFingerprint: 'test-fingerprint',
  },
};

function makeData(): BackupData {
  return {
    ingredients: BUILT_IN_INGREDIENTS.map((item) => ({ ...item })),
    profiles: [profile],
    formulations: [formulation],
    settings: { ...DEFAULT_SETTINGS },
  };
}

describe('backup export and import', () => {
  it('round-trips a backup through JSON without losing data', () => {
    const file = createBackup(makeData());
    const parsed: unknown = JSON.parse(serialiseBackup(file));
    const validation = validateBackup(parsed);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.file.app).toBe(BACKUP_APP_ID);
    expect(validation.file.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(validation.file.exportedAt).toBe(file.exportedAt);
    expect(validation.file.data.ingredients).toHaveLength(BUILT_IN_INGREDIENTS.length);
    expect(validation.file.data.profiles[0]?.id).toBe('profile-test');
    expect(validation.file.data.formulations[0]?.id).toBe('formulation-test');
    expect(validation.file.data.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('rejects a file that belongs to another application', () => {
    const raw = { ...createBackup(makeData()), app: 'another-app' };
    const validation = validateBackup(raw);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errorsAr.join(' ')).toContain('app');
  });

  it('rejects an unsupported schema version', () => {
    const raw = { ...createBackup(makeData()), schemaVersion: 99 };
    const validation = validateBackup(raw);
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errorsAr.join(' ')).toContain('schemaVersion');
  });

  it('rejects a malformed ingredient instead of partially importing the file', () => {
    const data = makeData();
    data.ingredients[0] = {
      ...data.ingredients[0]!,
      nutrients: { ...data.ingredients[0]!.nutrients, ca_g: 'not-a-number' as unknown as number },
    };
    const validation = validateBackup(createBackup(data));
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errorsAr.join(' ')).toContain('data.ingredients[0].nutrients.ca_g');
  });

  it('rejects a missing settings section', () => {
    const raw = createBackup(makeData()) as unknown as Record<string, unknown>;
    const data = { ...(raw.data as Record<string, unknown>) };
    delete data.settings;
    const validation = validateBackup({ ...raw, data });
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errorsAr.join(' ')).toContain('data.settings');
  });

  it('rejects an ingredient with an invalid dry-matter percentage', () => {
    const bad = {
      ...BUILT_IN_INGREDIENTS[0]!,
      dryMatterPctAsFed: 140,
    } as Ingredient;
    const validation = validateBackup(createBackup({ ...makeData(), ingredients: [bad] }));
    expect(validation.ok).toBe(false);
    if (validation.ok) return;
    expect(validation.errorsAr.join(' ')).toContain('dryMatterPctAsFed');
  });

  it('warns about duplicate ingredient identifiers but still accepts the file', () => {
    const data = makeData();
    data.ingredients = [data.ingredients[0]!, { ...data.ingredients[0]! }];
    const validation = validateBackup(createBackup(data));
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;
    expect(validation.warningsAr.join(' ')).toContain('مكررة');
  });

  it('rejects non-object JSON payloads', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup([]).ok).toBe(false);
    expect(validateBackup('text').ok).toBe(false);
  });
});
