import { describe, expect, it } from 'vitest';
import { INRAE_ILLUSTRATIVE, type StandardDefinition } from '../src/data/standards';
import { formulateRation } from '../src/domain/optimization/formulate';
import type { Ingredient, LivestockProfile, NutrientKey } from '../src/domain/types';

function ingredient(
  id: string,
  overrides: {
    price?: number;
    dm?: number;
    maxPctDM?: number;
    stock?: number | null;
    nutrients?: Partial<Record<NutrientKey, number | null>>;
  } = {},
): Ingredient {
  return {
    id,
    nameAr: id,
    category: 'cereal_grain',
    dryMatterPctAsFed: overrides.dm ?? 100,
    nutrients: {
      ufl: 1,
      ufv: 1,
      pdi_g: 100,
      ca_g: 10,
      p_g: 5,
      na_g: 2,
      ndf_pct: 35,
      ...overrides.nutrients,
    },
    price: {
      valuePerKgAsFed: overrides.price ?? 10,
      date: '2026-01-01',
      source: 'اختبار',
      basis: 'AF',
      dataStatus: 'user_entered',
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: overrides.maxPctDM ?? 100,
      justificationAr: 'اختبار',
    },
    stockKgAsFed: overrides.stock ?? null,
    dataStatus: 'user_entered',
    provenance: {},
    isBuiltIn: false,
  };
}

const maintenanceProfile: LivestockProfile = {
  id: 'p1',
  name: 'صيانة',
  species: 'sheep',
  category: 'maintenance',
  ageMonths: 24,
  liveWeightKg: 50,
  targetDailyGainG: null,
  headCount: 10,
  pregnancyStage: null,
  lactationMonth: null,
  dailyMilkL: null,
  feedingSystem: 'housed',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function run(
  ingredients: Ingredient[],
  options: {
    profile?: LivestockProfile;
    standard?: StandardDefinition;
    targetDm?: number;
    ndf?: boolean;
  } = {},
) {
  return formulateRation({
    profile: options.profile ?? maintenanceProfile,
    standard: options.standard ?? INRAE_ILLUSTRATIVE,
    ingredients,
    targetDryMatterKg: options.targetDm ?? 1,
    applyNdfConstraint: options.ndf ?? true,
  });
}

describe('least-cost formulation engine', () => {
  it('chooses the cheaper ingredient when it satisfies every constraint', () => {
    const outcome = run([ingredient('A', { price: 10 }), ingredient('B', { price: 20 })]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const a = outcome.result.lines.find((line) => line.ingredientId === 'A');
    const b = outcome.result.lines.find((line) => line.ingredientId === 'B');
    expect(a?.quantityKgDM).toBeCloseTo(1, 6);
    expect(b).toBeUndefined();
    expect(outcome.result.totalCostPerAnimalDay).toBeCloseTo(10, 6);
    expect(outcome.result.totalDmKg).toBeCloseTo(1, 6);
  });

  it('produces a genuinely constrained optimum for the NDF minimum', () => {
    const outcome = run([
      ingredient('A', { price: 10, nutrients: { ndf_pct: 10 } }),
      ingredient('B', { price: 12, nutrients: { ndf_pct: 50 } }),
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const a = outcome.result.lines.find((line) => line.ingredientId === 'A');
    const b = outcome.result.lines.find((line) => line.ingredientId === 'B');
    expect(a?.quantityKgDM).toBeCloseTo(0.5, 5);
    expect(b?.quantityKgDM).toBeCloseTo(0.5, 5);
    expect(outcome.result.totalCostPerAnimalDay).toBeCloseTo(11, 5);
    const ndfCheck = outcome.result.checks.find((check) => check.key === 'ndf_pct');
    expect(ndfCheck?.satisfied).toBe(true);
    expect(ndfCheck?.actual).toBeGreaterThanOrEqual(0.3 - 1e-6);
  });

  it('reports infeasibility without silently relaxing the constraints', () => {
    const outcome = run([ingredient('A', { maxPctDM: 10 })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe('infeasible');
    expect(outcome.detailsAr.join(' ')).toContain('لم يتم تخفيف أي قيد تلقائياً');
  });

  it('excludes ingredients with missing required values instead of treating them as zero', () => {
    const outcome = run([ingredient('A'), ingredient('C', { nutrients: { ca_g: null } })]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.lines.some((line) => line.ingredientId === 'C')).toBe(false);
    expect(outcome.result.warningsAr.join(' ')).toContain('نقص البيانات');
  });

  it('refuses to optimise when every ingredient is missing required data', () => {
    const outcome = run([ingredient('C', { nutrients: { ca_g: null } })]);
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe('missing_ingredient_data');
  });

  it('prices dry matter correctly when the feed is only 50% dry matter', () => {
    const outcome = run([ingredient('WET', { price: 10, dm: 50 })]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const line = outcome.result.lines[0]!;
    expect(line.quantityKgDM).toBeCloseTo(1, 6);
    expect(line.quantityKgAF).toBeCloseTo(2, 6);
    expect(line.costPerAnimalDay).toBeCloseTo(20, 6);
    expect(outcome.result.costPerKgDm).toBeCloseTo(20, 6);
    expect(outcome.result.costPerKgAf).toBeCloseTo(10, 6);
  });

  it('respects a stock upper bound', () => {
    const outcome = run([
      ingredient('A', { price: 10, stock: 0.4 }),
      ingredient('B', { price: 12 }),
    ]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const a = outcome.result.lines.find((line) => line.ingredientId === 'A');
    expect(a?.quantityKgAF).toBeCloseTo(0.4, 5);
  });

  it('never reports a verified status for the illustrative standard', () => {
    const outcome = run([ingredient('A')]);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.requirements.status).toBe('illustrative');
    expect(outcome.result.status).toBe('feasible_unverified_adequacy');
    expect(outcome.result.messagesAr.join(' ')).toContain('غير المُتحقَّق منها');
  });

  it('can report verified status only when the standard itself is verified and every constraint is checked', () => {
    const verifiedStandard: StandardDefinition = { ...INRAE_ILLUSTRATIVE, status: 'verified' };
    const outcome = run([ingredient('A')], { standard: verifiedStandard, ndf: true });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.requirements.status).toBe('verified');
    expect(outcome.result.unevaluated).toHaveLength(0);
    expect(outcome.result.status).toBe('feasible_verified');
  });

  it('never treats a disabled NDF constraint as satisfied', () => {
    const outcome = run([ingredient('A', { nutrients: { ndf_pct: 0 } })], { ndf: false });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.unevaluated).toContain('ndf_pct');
    expect(outcome.result.status).toBe('feasible_unverified_adequacy');
  });

  it('rejects an invalid dry-matter target', () => {
    const outcome = run([ingredient('A')], { targetDm: -1 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe('invalid_input');
  });

  it('refuses to run when the animal profile is incomplete', () => {
    const outcome = run([ingredient('A')], {
      profile: { ...maintenanceProfile, liveWeightKg: Number.NaN },
    });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.status).toBe('insufficient_animal_data');
  });

  it('fingerprints every input that affects the result', () => {
    const first = run([ingredient('A', { price: 10 })]);
    const same = run([ingredient('A', { price: 10 })]);
    const changed = run([ingredient('A', { price: 11 })]);
    expect(first.ok && same.ok && changed.ok).toBe(true);
    if (!first.ok || !same.ok || !changed.ok) return;
    expect(first.result.inputFingerprint).toBe(same.result.inputFingerprint);
    expect(first.result.inputFingerprint).not.toBe(changed.result.inputFingerprint);
  });
});
