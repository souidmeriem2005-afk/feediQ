import { describe, expect, it } from 'vitest';
import type { LivestockProfile } from '../src/domain/types';
import { computeRequirements, validateProfile } from '../src/domain/requirements';
import {
  INRAE_ILLUSTRATIVE,
  NRC_2007_UNCONFIGURED,
  getCategoryModel,
  type StandardDefinition,
} from '../src/data/standards';

function profile(overrides: Partial<LivestockProfile> = {}): LivestockProfile {
  return {
    id: 'p1',
    name: 'اختبار',
    species: 'sheep',
    category: 'fattening',
    ageMonths: 8,
    liveWeightKg: 35,
    targetDailyGainG: 220,
    headCount: 10,
    pregnancyStage: null,
    lactationMonth: null,
    dailyMilkL: null,
    feedingSystem: 'mixed',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('livestock profile validation', () => {
  it('accepts a complete fattening profile', () => {
    expect(validateProfile(profile())).toHaveLength(0);
  });

  it('blocks a growing profile without a target gain', () => {
    const issues = validateProfile(profile({ category: 'growing', targetDailyGainG: null }));
    expect(issues.some((issue) => issue.field === 'targetDailyGainG')).toBe(true);
  });

  it('requires milk yield for a lactating animal', () => {
    const issues = validateProfile(profile({ category: 'lactating', dailyMilkL: null }));
    expect(issues.some((issue) => issue.field === 'dailyMilkL')).toBe(true);
  });

  it('rejects an implausible weight', () => {
    const issues = validateProfile(profile({ liveWeightKg: 400 }));
    expect(issues.some((issue) => issue.field === 'liveWeightKg')).toBe(true);
  });
});

describe('requirement computation', () => {
  it('computes dry-matter intake from live weight and flags the illustrative status', () => {
    const result = computeRequirements(profile(), INRAE_ILLUSTRATIVE);
    expect(result.blockersAr).toHaveLength(0);
    expect(result.status).toBe('illustrative');
    expect(result.dryMatterIntakeKg).toBeCloseTo(0.034 * 35, 10);
    expect(result.requirements.length).toBeGreaterThanOrEqual(5);
    expect(result.requirements.every((item) => item.provenance.status === 'illustrative_demo')).toBe(true);
  });

  it('adds gain to the energy requirement for fattening animals', () => {
    const result = computeRequirements(profile(), INRAE_ILLUSTRATIVE);
    const energy = result.requirements.find((item) => item.key === 'ufv');
    expect(energy).toBeDefined();
    const model = getCategoryModel(INRAE_ILLUSTRATIVE, 'sheep', 'fattening');
    expect(model).not.toBeNull();
    const expected = model!.energyPerKgMbw * Math.pow(35, 0.75) + model!.energyPerKgGain * 0.22;
    expect(energy!.amount).toBeCloseTo(expected, 10);
  });

  it('never derives values for the unconfigured NRC standard', () => {
    const result = computeRequirements(profile(), NRC_2007_UNCONFIGURED);
    expect(result.blockersAr.length).toBeGreaterThan(0);
    expect(result.requirements).toHaveLength(0);
    expect(result.dryMatterIntakeKg).toBe(0);
    expect(result.status).toBe('incomplete');
  });

  it('reports missing animal data as blockers before attempting a model', () => {
    const result = computeRequirements(
      profile({ category: 'lactating', dailyMilkL: null, lactationMonth: null }),
      INRAE_ILLUSTRATIVE,
    );
    expect(result.blockersAr.length).toBeGreaterThan(0);
    expect(result.requirements).toHaveLength(0);
  });

  it('applies the late-pregnancy factor only when requested', () => {
    const early = computeRequirements(
      profile({ category: 'pregnant', pregnancyStage: 'early', targetDailyGainG: null }),
      INRAE_ILLUSTRATIVE,
    );
    const late = computeRequirements(
      profile({ category: 'pregnant', pregnancyStage: 'late', targetDailyGainG: null }),
      INRAE_ILLUSTRATIVE,
    );
    const earlyEnergy = early.requirements.find((item) => item.key === 'ufl')!.amount;
    const lateEnergy = late.requirements.find((item) => item.key === 'ufl')!.amount;
    expect(lateEnergy).toBeGreaterThan(earlyEnergy);
    expect(late.notesAr.some((note) => note.includes('الحمل المتأخر'))).toBe(true);
  });
});

describe('standard integrity', () => {
  it('keeps the built-in standards explicitly non-verified', () => {
    const standards: StandardDefinition[] = [INRAE_ILLUSTRATIVE, NRC_2007_UNCONFIGURED];
    for (const standard of standards) {
      expect(standard.status).not.toBe('verified');
    }
  });
});
