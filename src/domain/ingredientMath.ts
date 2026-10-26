import { NUTRIENTS } from './nutrients';
import type { Ingredient, NutrientKey } from './types';
import { dryMatterFraction } from './units';

/** Cost of one kilogram of dry matter, from the as-fed price. */
export function effortPerKgDmOf(pricePerKgAsFed: number, dmFraction: number): number {
  if (!Number.isFinite(pricePerKgAsFed) || pricePerKgAsFed < 0) return Number.POSITIVE_INFINITY;
  if (!Number.isFinite(dmFraction) || dmFraction <= 0) return Number.POSITIVE_INFINITY;
  return pricePerKgAsFed / dmFraction;
}

/** Price per kg dry matter for an ingredient, or null when it cannot be computed. */
export function pricePerKgDm(ingredient: Ingredient): number | null {
  if (!ingredient.price || ingredient.dryMatterPctAsFed === null) return null;
  try {
    return effortPerKgDmOf(ingredient.price.valuePerKgAsFed, dryMatterFraction(ingredient.dryMatterPctAsFed));
  } catch {
    return null;
  }
}

/** True when every listed nutrient has a known, finite value. */
export function hasNutrients(ingredient: Ingredient, keys: NutrientKey[]): boolean {
  return keys.every((key) => {
    const value = ingredient.nutrients[key];
    return value !== null && value !== undefined && Number.isFinite(value);
  });
}

export interface IngredientReadiness {
  ready: boolean;
  missingAr: string[];
}

/**
 * Whether an ingredient can take part in an optimisation that constrains
 * `requiredKeys`, plus a human explanation of what is missing.
 */
export function ingredientReadiness(
  ingredient: Ingredient,
  requiredKeys: NutrientKey[],
): IngredientReadiness {
  const missingAr: string[] = [];
  if (ingredient.dryMatterPctAsFed === null) {
    missingAr.push('نسبة المادة الجافة');
  } else if (ingredient.dryMatterPctAsFed <= 0 || ingredient.dryMatterPctAsFed > 100) {
    missingAr.push('نسبة مادة جافة صالحة');
  }
  if (!ingredient.price || ingredient.price.valuePerKgAsFed === null) {
    missingAr.push('السعر');
  }
  for (const key of requiredKeys) {
    const value = ingredient.nutrients[key];
    if (value === null || value === undefined || !Number.isFinite(value)) {
      missingAr.push(NUTRIENTS[key].shortLabelAr);
    }
  }
  return { ready: missingAr.length === 0, missingAr };
}

/** Weighted average concentration of a nutrient across a ration. */
export function weightedConcentration(totalContribution: number, totalDmKg: number): number | null {
  if (!Number.isFinite(totalContribution) || !Number.isFinite(totalDmKg) || totalDmKg <= 0) return null;
  return totalContribution / totalDmKg;
}
