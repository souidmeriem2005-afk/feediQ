/**
 * Domain model for SmartFeed.
 *
 * Conventions used everywhere in this file:
 *  - All nutrient concentrations are expressed **per kg of dry matter (DM)**
 *    unless the nutrient key explicitly says otherwise.
 *  - All monetary values are Algerian dinars (DZD) and always carry an explicit basis.
 *  - `null` always means "unknown / not measured". It never means zero.
 */

export type Basis = 'DM' | 'AF';

/** Provenance class of a piece of data. Displayed verbatim in the UI. */
export type DataStatus =
  | 'verified_reference'
  | 'laboratory_measured'
  | 'reference_requires_confirmation'
  | 'user_entered'
  | 'illustrative_demo'
  | 'unknown';

export type Species = 'sheep' | 'goat';

export type ProductionCategory =
  | 'growing'
  | 'fattening'
  | 'maintenance'
  | 'pregnant'
  | 'lactating'
  | 'breeding_male';

export type FeedingSystem = 'grazing' | 'housed' | 'mixed';

export type PregnancyStage = 'early' | 'mid' | 'late';
export type LactationStage = 'early' | 'mid' | 'late';

/** Keys of every nutrient the engine knows about. */
export type NutrientKey =
  | 'ufl'
  | 'ufv'
  | 'me_mj'
  | 'ne_l_mj'
  | 'pdi_g'
  | 'pdia_g'
  | 'cp_pct'
  | 'cf_pct'
  | 'ndf_pct'
  | 'adf_pct'
  | 'starch_pct'
  | 'fat_pct'
  | 'ash_pct'
  | 'ca_g'
  | 'p_g'
  | 'na_g'
  | 'mg_g'
  | 's_g'
  | 'cl_g'
  | 'fill_unit'
  | 'rpb_g';

export interface NutrientDefinition {
  key: NutrientKey;
  labelAr: string;
  shortLabelAr: string;
  unitAr: string;
  /** `DM` = per kg dry matter, `AF` = per kg as fed. */
  basis: Basis;
  /** Group used for provenance attribution. */
  group: 'energy' | 'protein' | 'fibre' | 'minerals' | 'other';
  decimals: number;
}

export interface Provenance {
  referenceId: string;
  /** Free-text locator, e.g. table or chapter. */
  locator?: string;
  /** ISO date (YYYY-MM-DD) on which the value was checked against the source. */
  verifiedOn?: string;
  status: DataStatus;
  note?: string;
}

export interface ScientificReference {
  id: string;
  titleAr: string;
  titleOriginal: string;
  authors: string;
  year: number;
  edition?: string;
  url?: string;
  doi?: string;
  /** Species and production categories covered by the reference. */
  coversAr: string;
  energySystem?: string;
  proteinSystem?: string;
  unitsNoteAr?: string;
  limitationsAr: string;
  reviewedOn: string;
  /** Whether the full text was actually consulted while building this app. */
  accessStatus: 'consulted' | 'partially_consulted' | 'not_consulted';
  accessNoteAr: string;
}

export type IngredientCategory =
  | 'cereal_grain'
  | 'cereal_byproduct'
  | 'forage'
  | 'straw'
  | 'protein_feed'
  | 'mineral'
  | 'additive';

export interface PriceRecord {
  /** DZD per kilogram of the product as fed. */
  valuePerKgAsFed: number;
  /** ISO date the price was recorded or observed. */
  date: string;
  /** Where the price came from ("سوق محلي", "المورد", ...). */
  source: string;
  basis: 'AF';
  /** Provenance class of the price itself (market data vs. illustrative). */
  dataStatus: DataStatus;
}

export interface InclusionLimits {
  /** Minimum share of the ration DM, in percent. */
  minPctDM: number;
  /** Maximum share of the ration DM, in percent. `null` = unbounded. */
  maxPctDM: number | null;
  /** Scientific / practical justification for the limits, in Arabic. */
  justificationAr: string;
}

export interface Ingredient {
  id: string;
  nameAr: string;
  nameEn?: string;
  scientificName?: string;
  category: IngredientCategory;
  /** Dry matter content of the product as fed, in percent (0 < x <= 100). */
  dryMatterPctAsFed: number | null;
  /** Nutrient concentrations. `null` = unknown. */
  nutrients: Partial<Record<NutrientKey, number | null>>;
  price: PriceRecord | null;
  inclusion: InclusionLimits;
  /** Available stock in kg as fed. `null` = unknown / unlimited. */
  stockKgAsFed?: number | null;
  dataStatus: DataStatus;
  provenance: {
    composition?: Provenance;
    energy?: Provenance;
    protein?: Provenance;
    minerals?: Provenance;
  };
  notesAr?: string;
  /** True for the imported reference set; false for user-created rows. */
  isBuiltIn: boolean;
}

export interface LivestockProfile {
  id: string;
  name: string;
  species: Species;
  category: ProductionCategory;
  ageMonths: number;
  /** Average live weight, kg. */
  liveWeightKg: number;
  /** Target average daily gain, g/day. Required for growing/fattening. */
  targetDailyGainG: number | null;
  headCount: number;
  pregnancyStage: PregnancyStage | null;
  /** Months since last lambing/kidding. */
  lactationMonth: number | null;
  /** Daily milk yield, litres/day. Required for lactating animals. */
  dailyMilkL: number | null;
  feedingSystem: FeedingSystem;
  breed?: string;
  /** Ambient conditions relevant to the selected standard, when required. */
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type RequirementStatus =
  | 'verified'
  | 'requires_confirmation'
  | 'illustrative'
  | 'incomplete';

export interface NutrientRequirement {
  key: NutrientKey;
  /** Required amount per animal per day, in the nutrient's own unit × kg. */
  amount: number;
  /** Upper bound when the standard defines one. */
  maxAmount?: number;
  /** Where the requirement comes from. */
  provenance: Provenance;
}

export interface ComputedRequirements {
  profileId: string;
  standardId: string;
  standardVersion: string;
  status: RequirementStatus;
  /** Total dry matter intake target for the ration, kg DM/day/animal. */
  dryMatterIntakeKg: number;
  /** Energy unit used by this standard for this production category. */
  energyKey: 'ufl' | 'ufv';
  requirements: NutrientRequirement[];
  /** Minimum NDF in ration DM required by the standard, percent. `null` = unconstrained. */
  ndfMinPctDm: number | null;
  /** Non-fatal notes for the user (assumptions, missing inputs). */
  notesAr: string[];
  /** Blocking problems. Non-empty ⇒ formulation must not run. */
  blockersAr: string[];
}

export interface Baseline {
  id: string;
  label: string;
  /** Decimal separator normalisation, lists of nutrients, etc. */
  createdAt: string;
}

export type OptimizationStatus =
  | 'feasible_verified'
  | 'feasible_unverified_adequacy'
  | 'infeasible'
  | 'missing_ingredient_data'
  | 'insufficient_animal_data'
  | 'invalid_input'
  | 'solver_error';

export interface ConstraintCheck {
  key: NutrientKey;
  labelAr: string;
  required: number;
  actual: number;
  unitAr: string;
  satisfied: boolean;
  /** actual - required */
  surplus: number;
}

export interface RationLine {
  ingredientId: string;
  nameAr: string;
  /** Quantity of dry matter, kg per animal per day. */
  quantityKgDM: number;
  /** Equivalent quantity as fed, kg per animal per day. */
  quantityKgAF: number;
  /** Share of the ration on a DM basis, percent. */
  sharePctDM: number;
  /** Share of the ration on an as-fed basis, percent. */
  sharePctAF: number;
  /** DZD per animal per day. */
  costPerAnimalDay: number;
  pricePerKgAsFed: number | null;
  priceDate: string | null;
  dryMatterPctAsFed: number;
  /** Stock limit as fed, when one was supplied. */
  stockKgAsFed: number | null;
  stockWarning: boolean;
  /** Nutrients contributed, already multiplied by the quantity. */
  contribution: Partial<Record<NutrientKey, number>>;
}

export interface RationResult {
  status: OptimizationStatus;
  standardId: string;
  standardVersion: string;
  engineVersion: string;
  profileId: string;
  profileSnapshot: LivestockProfile;
  requirements: ComputedRequirements;
  lines: RationLine[];
  /** Per animal per day. */
  totalDmKg: number;
  totalAfKg: number;
  totalCostPerAnimalDay: number;
  costPerKgDm: number;
  costPerKgAf: number;
  totalCostHerdDay: number;
  /** Calculated nutrient totals for the whole ration, per animal per day. */
  nutrientTotals: Partial<Record<NutrientKey, number>>;
  checks: ConstraintCheck[];
  /** Constraints the standard mandates that could not be evaluated. */
  unevaluated: NutrientKey[];
  messagesAr: string[];
  warningsAr: string[];
  /** Timestamp of the calculation. */
  calculatedAt: string;
  /** Hash of every input that affects the result, used to detect stale results. */
  inputFingerprint: string;
}

export interface SavedFormulation {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  result: RationResult;
  /** Snapshot of prices so history is never rewritten by later edits. */
  priceSnapshot: Array<{ ingredientId: string; nameAr: string; valuePerKgAsFed: number | null; date: string | null }>;
  /** Prices that changed since the snapshot was taken (computed on demand). */
  version: number;
  parentId?: string | null;
}

export interface AppSettings {
  currency: 'DZD';
  /** Show quantities on an as-fed basis instead of DM where both exist. */
  preferredBasis: Basis;
  /** Show the scientific status badges. */
  showDataStatus: boolean;
  /** Confirmed that the user understands demo data are not approved. */
  demoAcknowledged: boolean;
  /** Chosen standard for new formulations. */
  defaultStandardId: string;
  /** Feeding period used by the dashboard expense estimate. */
  dashboardPeriodDays: number;
}

export interface DatabaseShape {
  species: Species;
}
