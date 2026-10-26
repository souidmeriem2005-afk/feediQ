import solver from 'javascript-lp-solver';
import type { Model } from 'javascript-lp-solver';
import type { StandardDefinition } from '../../data/standards';
import { effortPerKgDmOf } from '../ingredientMath';
import { computeRequirements } from '../requirements';
import type {
  ConstraintCheck,
  Ingredient,
  LivestockProfile,
  NutrientKey,
  OptimizationStatus,
  RationLine,
  RationResult,
} from '../types';
import { NUTRIENTS } from '../nutrients';
import { dryMatterFraction, formatNumber, percentageOf, round } from '../units';
import { stableHash, stableStringify } from '../hash';

export const ENGINE_VERSION = '1.0.0';
export const SOLVER_RELATIVE_TOLERANCE = 1e-6;
export const SOLVER_ABSOLUTE_TOLERANCE = 1e-7;

export interface FormulationInput {
  profile: LivestockProfile;
  standard: StandardDefinition;
  /** Candidate ingredients, already filtered by the user. */
  ingredients: Ingredient[];
  /** Overrides the dry-matter intake computed from the profile. */
  targetDryMatterKg?: number | null;
  /** Whether the standard's minimum-NDF constraint is applied. */
  applyNdfConstraint?: boolean;
}

export type FormulationOutcome =
  | { ok: true; result: RationResult }
  | {
      ok: false;
      status: OptimizationStatus;
      messagesAr: string[];
      /** Technical detail for the "why" panel. */
      detailsAr: string[];
    };

interface PreparedIngredient {
  ingredient: Ingredient;
  dryMatterFraction: number;
  pricePerKgDm: number;
  nutrients: Record<'energy' | 'pdi' | 'ca' | 'p' | 'na' | 'ndf', number>;
  lowerKg: number;
  upperKg: number | null;
  stockKgAsFed: number | null;
}

function nutrientValue(ingredient: Ingredient, key: NutrientKey): number | null {
  const raw = ingredient.nutrients[key];
  if (raw === null || raw === undefined) return null;
  if (!Number.isFinite(raw)) return null;
  return raw;
}

/**
 * Validate every ingredient against the constraints the standard actually
 * requires. Ingredients with missing values are excluded and reported — they
 * are never treated as zero.
 */
function prepareIngredients(
  input: FormulationInput,
  energyKey: 'ufl' | 'ufv',
  ndfRequired: boolean,
): { prepared: PreparedIngredient[]; problems: string[]; excluded: string[] } {
  const problems: string[] = [];
  const excluded: string[] = [];
  const prepared: PreparedIngredient[] = [];

  const targetDm = input.targetDryMatterKg ?? 0;
  const usingTarget = targetDm > 0;

  for (const ingredient of input.ingredients) {
    const label = ingredient.nameAr;
    const missing: string[] = [];

    if (ingredient.dryMatterPctAsFed === null) {
      missing.push('نسبة المادة الجافة');
    } else if (
      !Number.isFinite(ingredient.dryMatterPctAsFed) ||
      ingredient.dryMatterPctAsFed <= 0 ||
      ingredient.dryMatterPctAsFed > 100
    ) {
      problems.push(
        `«${label}»: نسبة المادة الجافة (${formatNumber(ingredient.dryMatterPctAsFed, 1)}%) غير صالحة؛ يجب أن تكون أكبر من 0 ولا تتجاوز 100%.`,
      );
      excluded.push(label);
      continue;
    }

    if (!ingredient.price || ingredient.price.valuePerKgAsFed === null) {
      missing.push('السعر');
    } else if (!Number.isFinite(ingredient.price.valuePerKgAsFed) || ingredient.price.valuePerKgAsFed < 0) {
      problems.push(`«${label}»: سعر الكيلوغرام غير صالح.`);
      excluded.push(label);
      continue;
    }

    const energy = nutrientValue(ingredient, energyKey);
    if (energy === null) missing.push(NUTRIENTS[energyKey].labelAr);

    const pdi = nutrientValue(ingredient, 'pdi_g');
    if (pdi === null) missing.push(NUTRIENTS.pdi_g.labelAr);

    const ca = nutrientValue(ingredient, 'ca_g');
    if (ca === null) missing.push(NUTRIENTS.ca_g.labelAr);

    const p = nutrientValue(ingredient, 'p_g');
    if (p === null) missing.push(NUTRIENTS.p_g.labelAr);

    const na = nutrientValue(ingredient, 'na_g');
    if (na === null) missing.push(NUTRIENTS.na_g.labelAr);

    const ndf = nutrientValue(ingredient, 'ndf_pct');
    if (ndfRequired && ndf === null) missing.push(NUTRIENTS.ndf_pct.labelAr);

    if (missing.length > 0) {
      problems.push(`«${label}»: قيم ناقصة (${missing.join('، ')}) — استُبعدت من التحسين.`);
      excluded.push(label);
      continue;
    }

    const dmFraction = dryMatterFraction(ingredient.dryMatterPctAsFed);
    const pricePerKgAsFed = ingredient.price?.valuePerKgAsFed ?? 0;

    const maxPct = ingredient.inclusion.maxPctDM;
    const minPct = ingredient.inclusion.minPctDM;
    const stock = ingredient.stockKgAsFed ?? null;

    let lowerKg = 0;
    let upperKg: number | null = null;

    if (usingTarget) {
      lowerKg = (Math.max(0, minPct) / 100) * targetDm;
      if (maxPct !== null) upperKg = (Math.min(maxPct, 100) / 100) * targetDm;
    }

    if (stock !== null && Number.isFinite(stock) && stock >= 0) {
      const stockDm = stock * dmFraction;
      upperKg = upperKg === null ? stockDm : Math.min(upperKg, stockDm);
    }

    if (upperKg !== null && upperKg < lowerKg) {
      problems.push(
        `«${label}»: الحد الأدنى للإدراج (${formatNumber(minPct, 1)}%) يتعارض مع المخزون أو الحد الأقصى المتاح (${formatNumber(upperKg, 3)} كغ مادة جافة).`,
      );
      excluded.push(label);
      continue;
    }

    prepared.push({
      ingredient,
      dryMatterFraction: dmFraction,
      pricePerKgDm: effortPerKgDmOf(pricePerKgAsFed, dmFraction),
      nutrients: {
        energy: energy as number,
        pdi: pdi as number,
        ca: ca as number,
        p: p as number,
        na: na as number,
        ndf: ndf ?? 0,
      },
      lowerKg,
      upperKg,
      stockKgAsFed: stock,
    });
  }

  return { prepared, problems, excluded };
}

function relativeTolerance(required: number): number {
  return Math.max(SOLVER_ABSOLUTE_TOLERANCE, SOLVER_RELATIVE_TOLERANCE * Math.max(1, Math.abs(required)));
}

/**
 * Run a genuine linear program:
 *
 *   minimise  Σ (price per kg DM_i × x_i)
 *   subject to Σ x_i = dry matter target
 *              Σ nutrient_i × x_i ≥ requirement     (energy, PDI, Ca, P, Na, NDF)
 *              lower_i ≤ x_i ≤ upper_i
 *
 * then re-verify every constraint from the returned quantities.
 */
export function formulateRation(input: FormulationInput): FormulationOutcome {
  const { profile, standard } = input;

  const requirements = computeRequirements(profile, standard);
  if (requirements.blockersAr.length > 0) {
    return {
      ok: false,
      status: 'insufficient_animal_data',
      messagesAr: requirements.blockersAr,
      detailsAr: [
        'لم يتم تشغيل محرك التحسين لأن بيانات الحيوان أو المعيار الغذائي غير مكتملة.',
      ],
    };
  }

  const targetDm = input.targetDryMatterKg ?? requirements.dryMatterIntakeKg;
  if (!Number.isFinite(targetDm) || targetDm <= 0) {
    return {
      ok: false,
      status: 'invalid_input',
      messagesAr: ['كمية المادة الجافة المستهدفة غير صالحة؛ يجب أن تكون أكبر من صفر.'],
      detailsAr: ['الكمية المستهدفة تُستخدم لتثبيت إجمالي المادة الجافة في العليقة.'],
    };
  }

  if (input.ingredients.length === 0) {
    return {
      ok: false,
      status: 'invalid_input',
      messagesAr: ['لم يتم اختيار أي مادة علفية للتحسين.'],
      detailsAr: ['اختر مادة واحدة على الأقل من قاعدة الأعلاف.'],
    };
  }

  const energyKey = requirements.energyKey;
  const ndfRequired = Boolean(input.applyNdfConstraint && requirements.ndfMinPctDm !== null);

  const { prepared, problems, excluded } = prepareIngredients(input, energyKey, ndfRequired);

  if (prepared.length === 0) {
    return {
      ok: false,
      status: 'missing_ingredient_data',
      messagesAr: [
        'لا توجد مادة علفية واحدة تحتوي على كل القيم الغذائية التي تتطلبها القيود. لم يتم إجراء أي تحسين.',
        ...problems,
      ],
      detailsAr: [
        `القيود الإلزامية لهذا المعيار تحتاج إلى: الطاقة (${energyKey.toUpperCase()})، PDI، Ca، P، Na${ndfRequired ? '، NDF' : ''}.`,
        'القيم الناقصة لا تُعامل أبداً كصفر.',
      ],
    };
  }

  const requirementByKey = new Map(requirements.requirements.map((r) => [r.key, r]));
  const energyReq = requirementByKey.get(energyKey)?.amount ?? 0;
  const pdiReq = requirementByKey.get('pdi_g')?.amount ?? 0;
  const caReq = requirementByKey.get('ca_g')?.amount ?? 0;
  const pReq = requirementByKey.get('p_g')?.amount ?? 0;
  const naReq = requirementByKey.get('na_g')?.amount ?? 0;
  const ndfMinPercent = requirements.ndfMinPctDm ?? 0;
  const ndfReqKg = ndfRequired ? (ndfMinPercent / 100) * targetDm : 0;

  const constraints: Model['constraints'] = {
    dmTotal: { equal: targetDm },
    energy: { min: energyReq },
    pdi: { min: pdiReq },
    ca: { min: caReq },
    p: { min: pReq },
    na: { min: naReq },
  };
  if (ndfRequired) constraints.ndf = { min: ndfReqKg };

  const variables: Model['variables'] = {};
  for (const item of prepared) {
    const id = item.ingredient.id;
    const coefficients: Record<string, number> = {
      cost: item.pricePerKgDm,
      dmTotal: 1,
      energy: item.nutrients.energy,
      pdi: item.nutrients.pdi,
      ca: item.nutrients.ca,
      p: item.nutrients.p,
      na: item.nutrients.na,
    };
    if (ndfRequired) coefficients.ndf = item.nutrients.ndf / 100;

    if (item.upperKg !== null) {
      constraints[`ub_${id}`] = { max: item.upperKg };
      coefficients[`ub_${id}`] = 1;
    }
    if (item.lowerKg > 0) {
      constraints[`lb_${id}`] = { min: item.lowerKg };
      coefficients[`lb_${id}`] = 1;
    }

    variables[id] = coefficients;
  }

  const model: Model = {
    optimize: 'cost',
    opType: 'min',
    constraints,
    variables,
  };

  let raw: unknown;
  try {
    raw = solver.Solve(model, 1e-9);
  } catch (error) {
    return {
      ok: false,
      status: 'solver_error',
      messagesAr: ['حدث خطأ داخلي أثناء تشغيل محرك التحسين.'],
      detailsAr: [error instanceof Error ? error.message : String(error)],
    };
  }

  const solution = raw as Record<string, unknown> | undefined;
  if (!solution || typeof solution !== 'object') {
    return {
      ok: false,
      status: 'solver_error',
      messagesAr: ['لم يُرجع محرك التحسين أي نتيجة.'],
      detailsAr: ['استجابة المحرك فارغة أو غير صالحة.'],
    };
  }

  if (solution.feasible !== true) {
    const reason = buildInfeasibilityExplanation(prepared, targetDm, {
      energyReq,
      pdiReq,
      caReq,
      pReq,
      naReq,
      energyKey,
      ndfRequired,
      ndfMinPercent,
    });
    return {
      ok: false,
      status: 'infeasible',
      messagesAr: [
        'لا يوجد حل مُرضٍ تحت هذه القيود والحدود الحالية.',
        ...(problems.length > 0 ? problems : []),
      ],
      detailsAr: reason,
    };
  }

  if (solution.bounded === false) {
    return {
      ok: false,
      status: 'solver_error',
      messagesAr: ['المشكلة غير محدودة (unbounded) — تحقق من الحدود العليا والمدخلات.'],
      detailsAr: ['أعاد المحرك حالة "غير محدود"، وهي حالة خطأ في بناء النموذج.'],
    };
  }

  /* ------------------------------------------------------------------ */
  /* Independent verification — never trust the solver blindly.          */
  /* ------------------------------------------------------------------ */

  const quantities = new Map<string, number>();
  for (const item of prepared) {
    const value = solution[item.ingredient.id];
    const qty = typeof value === 'number' ? value : 0;
    if (!Number.isFinite(qty) || qty < -SOLVER_ABSOLUTE_TOLERANCE) {
      return {
        ok: false,
        status: 'solver_error',
        messagesAr: ['أعاد المحرك كمية غير صالحة لمادة علفية.'],
        detailsAr: [`المادة: ${item.ingredient.nameAr}، القيمة: ${String(value)}`],
      };
    }
    quantities.set(item.ingredient.id, Math.max(0, qty));
  }

  const totals = {
    dm: 0,
    energy: 0,
    pdi: 0,
    ca: 0,
    p: 0,
    na: 0,
    ndf: 0,
    cost: 0,
  };

  for (const item of prepared) {
    const qty = quantities.get(item.ingredient.id) ?? 0;
    totals.dm += qty;
    totals.energy += qty * item.nutrients.energy;
    totals.pdi += qty * item.nutrients.pdi;
    totals.ca += qty * item.nutrients.ca;
    totals.p += qty * item.nutrients.p;
    totals.na += qty * item.nutrients.na;
    totals.ndf += qty * (item.nutrients.ndf / 100);
    totals.cost += qty * item.pricePerKgDm;
  }

  const violations: string[] = [];
  if (Math.abs(totals.dm - targetDm) > relativeTolerance(targetDm)) {
    violations.push(
      `مجموع المادة الجافة ${formatNumber(totals.dm, 4)} كغ لا يطابق الهدف ${formatNumber(targetDm, 4)} كغ.`,
    );
  }
  const checkMin = (label: string, actual: number, required: number) => {
    if (actual + relativeTolerance(required) < required) {
      violations.push(`${label}: المُتحقق ${formatNumber(actual, 4)} أقل من المطلوب ${formatNumber(required, 4)}.`);
    }
  };
  checkMin('الطاقة', totals.energy, energyReq);
  checkMin('PDI', totals.pdi, pdiReq);
  checkMin('الكالسيوم', totals.ca, caReq);
  checkMin('الفوسفور', totals.p, pReq);
  checkMin('الصوديوم', totals.na, naReq);
  if (ndfRequired) checkMin('NDF', totals.ndf, ndfReqKg);

  for (const item of prepared) {
    const qty = quantities.get(item.ingredient.id) ?? 0;
    if (qty + SOLVER_ABSOLUTE_TOLERANCE < item.lowerKg) {
      violations.push(`«${item.ingredient.nameAr}» أقل من الحد الأدنى للإدراج.`);
    }
    if (item.upperKg !== null && qty - SOLVER_ABSOLUTE_TOLERANCE > item.upperKg) {
      violations.push(`«${item.ingredient.nameAr}» يتجاوز الحد الأعلى المتاح.`);
    }
  }

  if (violations.length > 0) {
    return {
      ok: false,
      status: 'solver_error',
      messagesAr: [
        'أعاد المحرك حلاً لم يجتز التحقق المستقل من القيود، لذلك لم يُعرض كعليقة صالحة.',
        ...violations,
      ],
      detailsAr: ['تتحقق هذه الخطوة من كل قيد بشكل مستقل عن نتائج المحرك باستخدام كميات الأعلاف المُرجعة.'],
    };
  }

  /* ------------------------------------------------------------------ */
  /* Build the result                                                    */
  /* ------------------------------------------------------------------ */

  const lines: RationLine[] = [];
  for (const item of prepared) {
    const qtyDm = quantities.get(item.ingredient.id) ?? 0;
    if (qtyDm <= 1e-9) continue;
    const qtyAf = qtyDm / item.dryMatterFraction;
    const price = item.ingredient.price?.valuePerKgAsFed ?? null;
    const contribution: Partial<Record<NutrientKey, number>> = {};
    for (const key of Object.keys(item.ingredient.nutrients) as NutrientKey[]) {
      const value = item.ingredient.nutrients[key];
      if (value === null || value === undefined) continue;
      contribution[key] = value * qtyDm;
    }
    lines.push({
      ingredientId: item.ingredient.id,
      nameAr: item.ingredient.nameAr,
      quantityKgDM: qtyDm,
      quantityKgAF: qtyAf,
      sharePctDM: percentageOf(qtyDm, totals.dm),
      sharePctAF: percentageOf(qtyAf, totals.dm === 0 ? 0 : lines.reduce((s, l) => s + l.quantityKgAF, 0) + qtyAf),
      costPerAnimalDay: qtyAf * (price ?? 0),
      pricePerKgAsFed: price,
      priceDate: item.ingredient.price?.date ?? null,
      dryMatterPctAsFed: item.ingredient.dryMatterPctAsFed ?? 0,
      stockKgAsFed: item.stockKgAsFed,
      stockWarning:
        item.stockKgAsFed !== null && qtyAf > item.stockKgAsFed - SOLVER_ABSOLUTE_TOLERANCE * 1000,
      contribution,
    });
  }

  lines.sort((a, b) => b.quantityKgDM - a.quantityKgDM);

  // Recompute as-fed shares now that every line exists (single consistent basis).
  const totalAf = lines.reduce((sum, l) => sum + l.quantityKgAF, 0);
  for (const line of lines) {
    line.sharePctAF = percentageOf(line.quantityKgAF, totalAf);
  }

  const totalAfKg = totalAf;
  const totalCost = lines.reduce((sum, l) => sum + l.costPerAnimalDay, 0);

  const nutrientTotals: Partial<Record<NutrientKey, number>> = {};
  for (const line of lines) {
    for (const [key, value] of Object.entries(line.contribution) as Array<[NutrientKey, number]>) {
      nutrientTotals[key] = (nutrientTotals[key] ?? 0) + value;
    }
  }

  const checks: ConstraintCheck[] = [];
  const pushCheck = (key: NutrientKey, actual: number, required: number) => {
    const def = NUTRIENTS[key];
    checks.push({
      key,
      labelAr: def.labelAr,
      required: round(required, 4),
      actual: round(actual, 4),
      unitAr: def.unitAr,
      satisfied: actual + relativeTolerance(required) >= required,
      surplus: round(actual - required, 4),
    });
  };

  pushCheck(energyKey, totals.energy, energyReq);
  pushCheck('pdi_g', totals.pdi, pdiReq);
  pushCheck('ca_g', totals.ca, caReq);
  pushCheck('p_g', totals.p, pReq);
  pushCheck('na_g', totals.na, naReq);
  if (ndfRequired) pushCheck('ndf_pct', totals.ndf, ndfReqKg);

  const unevaluated: NutrientKey[] = [];
  if (!ndfRequired && requirements.ndfMinPctDm !== null) {
    unevaluated.push('ndf_pct');
  }

  const warningsAr: string[] = [];
  for (const line of lines) {
    if (line.stockWarning) {
      warningsAr.push(`«${line.nameAr}»: الكمية المطلوبة تقارب أو تتجاوز المخزون المتاح.`);
    }
  }
  if (excluded.length > 0) {
    warningsAr.push(`استُبعدت من التحسين ${excluded.length} مادة علفية بسبب نقص البيانات.`);
  }

  const messagesAr: string[] = [];
  if (requirements.status === 'illustrative') {
    messagesAr.push(
      'القيود المستخدمة مبنية على نسخة تجريبية من معاملات المتطلبات غير المُتحقَّق منها. الحل صالح رياضياً فقط ولا يُثبت توازناً غذائياً.',
    );
  }
  if (unevaluated.length > 0) {
    messagesAr.push('لم يتم التحقق من الحد الأدنى للألياف (NDF) لأن المستخدم عطّله.');
  }

  const fingerprint = stableHash(
    stableStringify({
      profile: {
        id: profile.id,
        species: profile.species,
        category: profile.category,
        liveWeightKg: profile.liveWeightKg,
        targetDailyGainG: profile.targetDailyGainG,
        dailyMilkL: profile.dailyMilkL,
        pregnancyStage: profile.pregnancyStage,
        headCount: profile.headCount,
        lactationMonth: profile.lactationMonth,
      },
      standard: { id: standard.id, version: standard.version },
      targetDm,
      applyNdf: ndfRequired,
      ingredients: prepared.map((p) => ({
        id: p.ingredient.id,
        price: p.ingredient.price?.valuePerKgAsFed ?? null,
        priceDate: p.ingredient.price?.date ?? null,
        dm: p.ingredient.dryMatterPctAsFed,
        nutrients: p.ingredient.nutrients,
        min: p.ingredient.inclusion.minPctDM,
        max: p.ingredient.inclusion.maxPctDM,
        stock: p.stockKgAsFed,
      })),
    }),
  );

  const allConstraintsVerified = checks.every((c) => c.satisfied);
  const status: OptimizationStatus =
    requirements.status === 'verified' && allConstraintsVerified && unevaluated.length === 0
      ? 'feasible_verified'
      : 'feasible_unverified_adequacy';

  const result: RationResult = {
    status,
    standardId: standard.id,
    standardVersion: standard.version,
    engineVersion: ENGINE_VERSION,
    profileId: profile.id,
    profileSnapshot: { ...profile },
    requirements,
    lines,
    totalDmKg: totals.dm,
    totalAfKg,
    totalCostPerAnimalDay: totalCost,
    costPerKgDm: totals.dm > 0 ? totalCost / totals.dm : 0,
    costPerKgAf: totalAfKg > 0 ? totalCost / totalAfKg : 0,
    totalCostHerdDay: totalCost * profile.headCount,
    nutrientTotals,
    checks,
    unevaluated,
    messagesAr: [...messagesAr, ...(problems.length > 0 ? problems : [])],
    warningsAr,
    calculatedAt: new Date().toISOString(),
    inputFingerprint: fingerprint,
  };

  return { ok: true, result };
}

interface RequirementSnapshot {
  energyReq: number;
  pdiReq: number;
  caReq: number;
  pReq: number;
  naReq: number;
  energyKey: 'ufl' | 'ufv';
  ndfRequired: boolean;
  ndfMinPercent: number;
}

/** Explain the most likely reason an infeasible model was produced. */
function buildInfeasibilityExplanation(
  prepared: PreparedIngredient[],
  targetDm: number,
  snapshot: RequirementSnapshot,
): string[] {
  const details: string[] = [];
  details.push(
    `الهدف: ${formatNumber(targetDm, 3)} كغ مادة جافة يومياً لكل حيوان، مع ${formatNumber(snapshot.energyReq, 3)} ${snapshot.energyKey.toUpperCase()}، ${formatNumber(snapshot.pdiReq, 1)} غ PDI، ${formatNumber(snapshot.caReq, 2)} غ Ca، ${formatNumber(snapshot.pReq, 2)} غ P، ${formatNumber(snapshot.naReq, 2)} غ Na.`,
  );

  const maxDm = prepared.reduce((sum, p) => sum + (p.upperKg ?? Infinity), 0);
  if (maxDm < targetDm - 1e-9) {
    details.push(
      `مجموع الحدود العليا المتاحة (${formatNumber(maxDm, 3)} كغ مادة جافة) أقل من الكمية المستهدفة — لا يمكن تكوين العليقة بالكمية المطلوبة.`,
    );
  }

  const maxEnergy = prepared.reduce((sum, p) => sum + (p.upperKg ?? Infinity) * p.nutrients.energy, 0);
  if (Number.isFinite(maxEnergy) && maxEnergy < snapshot.energyReq) {
    details.push('حتى باستخدام الحد الأقصى من كل مادة، لا يمكن بلوغ متطلب الطاقة.');
  }

  const maxPdi = prepared.reduce((sum, p) => sum + (p.upperKg ?? Infinity) * p.nutrients.pdi, 0);
  if (Number.isFinite(maxPdi) && maxPdi < snapshot.pdiReq) {
    details.push('حتى باستخدام الحد الأقصى من كل مادة، لا يمكن بلوغ متطلب البروتين (PDI).');
  }

  const maxCa = prepared.reduce((sum, p) => sum + (p.upperKg ?? Infinity) * p.nutrients.ca, 0);
  if (Number.isFinite(maxCa) && maxCa < snapshot.caReq) {
    details.push('لا تتوفر كمية كالسيوم كافية ضمن الأعلاف والحدود الحالية — أضف مصدراً معدناً للكالسيوم.');
  }

  const maxP = prepared.reduce((sum, p) => sum + (p.upperKg ?? Infinity) * p.nutrients.p, 0);
  if (Number.isFinite(maxP) && maxP < snapshot.pReq) {
    details.push('لا تتوفر كمية فوسفور كافية ضمن الأعلاف والحدود الحالية — أضف مصدراً معدنياً للفوسفور.');
  }

  if (snapshot.ndfRequired) {
    details.push(
      `الحد الأدنى للألياف (NDF ${formatNumber(snapshot.ndfMinPercent, 1)}% من المادة الجافة) قد يكون متعارضاً مع بقية القيود. جرّب إضافة مادة علفية غنية بالألياف.`,
    );
  }

  details.push(
    'لم يتم تخفيف أي قيد تلقائياً. يمكنك تعديل حدود الإدراج أو إضافة مواد علفية أو مراجعة متطلبات الحيوان.',
  );
  return details;
}
