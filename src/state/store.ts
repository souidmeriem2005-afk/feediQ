import { create } from 'zustand';
import type {
  AppSettings,
  Ingredient,
  LivestockProfile,
  RationResult,
  SavedFormulation,
} from '../domain/types';
import { createId } from '../domain/units';
import type { BackupFile } from '../storage/backup';
import {
  DEFAULT_SETTINGS,
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
  type DatabaseSnapshot,
} from '../storage/repository';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface SaveFormulationInput {
  name: string;
  notes: string;
  result: RationResult;
  parentId?: string | null;
}

interface AppStore extends DatabaseSnapshot {
  loadState: LoadState;
  errorAr: string | null;
  init: () => Promise<void>;
  refresh: () => Promise<void>;
  saveIngredient: (ingredient: Ingredient) => Promise<Ingredient>;
  deleteIngredient: (id: string) => Promise<void>;
  saveProfile: (profile: LivestockProfile) => Promise<LivestockProfile>;
  deleteProfile: (id: string) => Promise<void>;
  saveFormulation: (input: SaveFormulationInput) => Promise<SavedFormulation>;
  deleteFormulation: (id: string) => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  importBackup: (file: BackupFile) => Promise<void>;
  resetAll: () => Promise<void>;
}

const EMPTY: DatabaseSnapshot = {
  ingredients: [],
  profiles: [],
  formulations: [],
  settings: { ...DEFAULT_SETTINGS },
};

function messageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'حدث خطأ غير متوقع أثناء الوصول إلى البيانات المحلية.';
}

export const useAppStore = create<AppStore>((set, get) => ({
  ...EMPTY,
  loadState: 'idle',
  errorAr: null,

  init: async () => {
    if (get().loadState === 'loading' || get().loadState === 'ready') return;
    set({ loadState: 'loading', errorAr: null });
    try {
      const snapshot = await initialiseDatabase();
      set({ ...snapshot, loadState: 'ready' });
    } catch (error) {
      set({ loadState: 'error', errorAr: messageOf(error) });
    }
  },

  refresh: async () => {
    try {
      const snapshot = await readSnapshot();
      set({ ...snapshot, loadState: 'ready', errorAr: null });
    } catch (error) {
      set({ errorAr: messageOf(error) });
    }
  },

  saveIngredient: async (ingredient) => {
    const record: Ingredient = ingredient.id
      ? ingredient
      : {
          ...ingredient,
          id: createId('ing'),
          isBuiltIn: false,
          dataStatus: ingredient.dataStatus === 'verified_reference' ? 'user_entered' : ingredient.dataStatus,
        };
    await putIngredient(record);
    await get().refresh();
    return record;
  },

  deleteIngredient: async (id) => {
    await removeIngredient(id);
    await get().refresh();
  },

  saveProfile: async (profile) => {
    const now = new Date().toISOString();
    const record: LivestockProfile = {
      ...profile,
      id: profile.id || createId('profile'),
      createdAt: profile.createdAt || now,
      updatedAt: now,
    };
    await putProfile(record);
    await get().refresh();
    return record;
  },

  deleteProfile: async (id) => {
    await removeProfile(id);
    await get().refresh();
  },

  saveFormulation: async ({ name, notes, result, parentId }) => {
    const now = new Date().toISOString();
    const parent = parentId ? get().formulations.find((f) => f.id === parentId) : undefined;
    const record: SavedFormulation = {
      id: createId('form'),
      name,
      notes,
      createdAt: now,
      updatedAt: now,
      result,
      priceSnapshot: result.lines.map((line) => ({
        ingredientId: line.ingredientId,
        nameAr: line.nameAr,
        valuePerKgAsFed: line.pricePerKgAsFed,
        date: line.priceDate,
      })),
      version: parent ? parent.version + 1 : 1,
      parentId: parent?.id ?? null,
    };
    await putFormulation(record);
    await get().refresh();
    return record;
  },

  deleteFormulation: async (id) => {
    await removeFormulation(id);
    await get().refresh();
  },

  updateSettings: async (patch) => {
    const next: AppSettings = { ...get().settings, ...patch };
    await putSettings(next);
    set({ settings: next });
  },

  importBackup: async (file) => {
    await replaceDatabase(file.data);
    const snapshot = await readSnapshot();
    set({ ...snapshot, loadState: 'ready', errorAr: null });
  },

  resetAll: async () => {
    await resetDatabase();
    const snapshot = await readSnapshot();
    set({ ...snapshot, loadState: 'ready', errorAr: null });
  },
}));
