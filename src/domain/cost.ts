import { assertNonNegative, assertPositive } from './units';

/** Cost of a quantity of feed priced per kg as fed. */
export function ingredientCost(asFedKg: number, pricePerKgAsFed: number): number {
  assertNonNegative(asFedKg, 'كمية العلف');
  assertNonNegative(pricePerKgAsFed, 'سعر الكيلوغرام');
  return asFedKg * pricePerKgAsFed;
}

export interface CostedLine {
  quantityKg: number;
  pricePerKg: number;
}

/** Total cost of a mixture, summing each line's quantity × price. */
export function mixtureCost(lines: CostedLine[]): number {
  return lines.reduce((sum, line) => sum + ingredientCost(line.quantityKg, line.pricePerKg), 0);
}

/** Cost per kilogram of a mixture. Throws when the quantity is zero. */
export function costPerKg(totalCost: number, totalQuantityKg: number): number {
  assertNonNegative(totalCost, 'التكلفة الإجمالية');
  assertPositive(totalQuantityKg, 'الكمية الإجمالية');
  return totalCost / totalQuantityKg;
}

/** Daily cost for a single animal = daily quantity × price per kg. */
export function dailyCostPerAnimal(dailyQuantityKg: number, pricePerKg: number): number {
  return ingredientCost(dailyQuantityKg, pricePerKg);
}

/** Daily cost for the herd = daily cost per animal × number of animals. */
export function dailyHerdCost(costPerAnimalDay: number, headCount: number): number {
  assertNonNegative(costPerAnimalDay, 'التكلفة اليومية للحيوان');
  assertNonNegative(headCount, 'عدد الرؤوس');
  return costPerAnimalDay * headCount;
}

/** Estimated cost over a period = daily herd cost × number of days. */
export function periodCost(herdCostPerDay: number, days: number): number {
  assertNonNegative(herdCostPerDay, 'التكلفة اليومية للقطيع');
  assertNonNegative(days, 'عدد الأيام');
  return herdCostPerDay * days;
}

export interface CostPerGainInput {
  totalFeedCost: number;
  totalGainKg: number;
}

/**
 * Cost per kilogram of live-weight gain.
 *
 * Returns `null` — never a fabricated number — when the weight-gain basis is
 * missing, zero or negative, because such a ratio is mathematically undefined
 * and nutritionally meaningless.
 */
export function costPerKgGain(totalFeedCost: number, totalGainKg: number): number | null {
  if (!Number.isFinite(totalFeedCost) || !Number.isFinite(totalGainKg)) return null;
  if (totalFeedCost < 0) return null;
  if (totalGainKg <= 0) return null;
  return totalFeedCost / totalGainKg;
}

export const COST_FORMULA_EXPLANATION_AR = {
  dailyCostPerAnimal:
    'التكلفة اليومية للحيوان = الكمية اليومية للحيوان (كغ) × سعر الكيلوغرام (دج).',
  dailyHerdCost: 'التكلفة اليومية للقطيع = التكلفة اليومية للحيوان × عدد الرؤوس.',
  periodCost: 'التكلفة التقديرية للفترة = التكلفة اليومية للقطيع × عدد الأيام.',
  costPerKgGain:
    'تكلفة كيلوغرام النمو = إجمالي تكلفة العلف خلال الفترة ÷ إجمالي الزيادة الوزنية المُتحقَّقة في نفس الفترة. لا تُحسب هذه القيمة إذا كانت الزيادة صفراً أو سالبة أو غير موثقة.',
} as const;
