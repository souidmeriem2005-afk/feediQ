import type { ProductionCategory, RequirementStatus, Species } from '../domain/types';

/**
 * A requirement model is a set of coefficients that turn a livestock profile
 * into daily nutrient requirements.
 *
 * IMPORTANT — verification status
 * ------------------------------
 * The coefficient values in this file are NOT transcribed from a primary
 * publication. They are structured demonstration values whose only purpose is
 * to exercise the optimization engine end to end. They are flagged
 * `illustrative` and the interface must never present a ration built on them as
 * nutritionally balanced.
 *
 * To obtain a `verified` standard, a qualified animal nutritionist must replace
 * every coefficient below with a value copied from a specific table of a
 * specific edition of the chosen reference, and record the table number in
 * `provenanceAr` plus the verification date.
 */

export interface CategoryModel {
  /** Energy unit this category is expressed in. */
  energyUnit: 'ufl' | 'ufv';
  /** Voluntary dry-matter intake, percent of live weight. */
  dmiPctBw: number;
  /** Energy for maintenance, per kg of metabolic body weight (kg^0.75). */
  energyPerKgMbw: number;
  /** PDI for maintenance, g per kg of metabolic body weight. */
  pdiPerKgMbw: number;
  /** Calcium for maintenance, g per kg of metabolic body weight. */
  caPerKgMbw: number;
  /** Phosphorus for maintenance, g per kg of metabolic body weight. */
  pPerKgMbw: number;
  /** Energy per kg of live-weight gain. */
  energyPerKgGain: number;
  /** PDI per kg of live-weight gain, g. */
  pdiPerKgGain: number;
  /** Calcium per kg of live-weight gain, g. */
  caPerKgGain: number;
  /** Phosphorus per kg of live-weight gain, g. */
  pPerKgGain: number;
  /** Energy per litre of milk. */
  energyPerLitreMilk: number;
  /** PDI per litre of milk, g. */
  pdiPerLitreMilk: number;
  /** Calcium per litre of milk, g. */
  caPerLitreMilk: number;
  /** Phosphorus per litre of milk, g. */
  pPerLitreMilk: number;
  /** Multiplier applied to maintenance energy during late pregnancy. */
  latePregnancyEnergyFactor: number;
  /** Multiplier applied to maintenance PDI during late pregnancy. */
  latePregnancyPdiFactor: number;
  /** Sodium requirement, g per kg of ration dry matter. */
  naPerKgDm: number;
  /** Minimum NDF in the ration dry matter, percent. `null` = not constrained. */
  ndfMinPctDm: number | null;
}

export interface StandardDefinition {
  id: string;
  version: string;
  nameAr: string;
  shortNameAr: string;
  energySystemAr: string;
  proteinSystemAr: string;
  referenceId: string;
  status: RequirementStatus;
  verificationNoteAr: string;
  provenanceAr: string;
  /** Coefficients per species and production category. */
  models: Record<Species, Partial<Record<ProductionCategory, CategoryModel>>>;
  /** Categories for which no coefficient set exists yet. */
  unsupportedCategories: ProductionCategory[];
}

const ALL_CATEGORIES: ProductionCategory[] = [
  'growing',
  'fattening',
  'maintenance',
  'pregnant',
  'lactating',
  'breeding_male',
];

function base(overrides: Partial<CategoryModel> = {}): CategoryModel {
  return {
    energyUnit: 'ufl',
    dmiPctBw: 2.6,
    energyPerKgMbw: 0.035,
    pdiPerKgMbw: 2.8,
    caPerKgMbw: 0.07,
    pPerKgMbw: 0.045,
    energyPerKgGain: 0,
    pdiPerKgGain: 0,
    caPerKgGain: 0,
    pPerKgGain: 0,
    energyPerLitreMilk: 0,
    pdiPerLitreMilk: 0,
    caPerLitreMilk: 0,
    pPerLitreMilk: 0,
    latePregnancyEnergyFactor: 1,
    latePregnancyPdiFactor: 1,
    naPerKgDm: 1.5,
    ndfMinPctDm: 30,
    ...overrides,
  };
}

const SHEEP_MODELS: Record<ProductionCategory, CategoryModel> = {
  maintenance: base({ dmiPctBw: 2.5 }),
  breeding_male: base({ dmiPctBw: 2.6, energyPerKgMbw: 0.037 }),
  growing: base({
    energyUnit: 'ufv',
    dmiPctBw: 3.3,
    energyPerKgMbw: 0.036,
    pdiPerKgMbw: 3.0,
    energyPerKgGain: 2.6,
    pdiPerKgGain: 250,
    caPerKgGain: 11,
    pPerKgGain: 6,
  }),
  fattening: base({
    energyUnit: 'ufv',
    dmiPctBw: 3.4,
    energyPerKgMbw: 0.036,
    pdiPerKgMbw: 3.0,
    energyPerKgGain: 3.1,
    pdiPerKgGain: 260,
    caPerKgGain: 10,
    pPerKgGain: 5.5,
  }),
  pregnant: base({
    dmiPctBw: 2.4,
    latePregnancyEnergyFactor: 1.35,
    latePregnancyPdiFactor: 1.45,
    caPerKgMbw: 0.085,
    pPerKgMbw: 0.055,
  }),
  lactating: base({
    dmiPctBw: 4.0,
    energyPerKgMbw: 0.037,
    pdiPerKgMbw: 3.0,
    energyPerLitreMilk: 0.45,
    pdiPerLitreMilk: 60,
    caPerLitreMilk: 1.3,
    pPerLitreMilk: 0.9,
    naPerKgDm: 1.8,
  }),
};

const GOAT_MODELS: Record<ProductionCategory, CategoryModel> = {
  maintenance: base({ dmiPctBw: 2.8, energyPerKgMbw: 0.034 }),
  breeding_male: base({ dmiPctBw: 2.8, energyPerKgMbw: 0.036 }),
  growing: base({
    energyUnit: 'ufv',
    dmiPctBw: 3.6,
    energyPerKgMbw: 0.035,
    pdiPerKgMbw: 2.9,
    energyPerKgGain: 2.5,
    pdiPerKgGain: 245,
    caPerKgGain: 11,
    pPerKgGain: 6,
  }),
  fattening: base({
    energyUnit: 'ufv',
    dmiPctBw: 3.7,
    energyPerKgMbw: 0.035,
    pdiPerKgMbw: 2.9,
    energyPerKgGain: 3.0,
    pdiPerKgGain: 255,
    caPerKgGain: 10,
    pPerKgGain: 5.5,
  }),
  pregnant: base({
    dmiPctBw: 2.6,
    latePregnancyEnergyFactor: 1.3,
    latePregnancyPdiFactor: 1.4,
    caPerKgMbw: 0.085,
    pPerKgMbw: 0.055,
  }),
  lactating: base({
    dmiPctBw: 4.4,
    energyPerKgMbw: 0.036,
    pdiPerKgMbw: 2.9,
    energyPerLitreMilk: 0.42,
    pdiPerLitreMilk: 55,
    caPerLitreMilk: 1.2,
    pPerLitreMilk: 0.9,
    naPerKgDm: 1.8,
  }),
};

export const INRAE_ILLUSTRATIVE: StandardDefinition = {
  id: 'inrae-2018',
  version: '2018-demo.1',
  nameAr: 'نظام INRAE 2018 (نسخة تجريبية)',
  shortNameAr: 'INRAE 2018 — تجريبي',
  energySystemAr: 'الوحدات العلفية UFL (الإدرار) و UFV (اللحم)',
  proteinSystemAr: 'البروتين الهضمي في الأمعاء PDI',
  referenceId: 'ref-inrae-feedtables',
  status: 'illustrative',
  verificationNoteAr:
    'معاملات المتطلبات في هذه النسخة قيم عرض توضيحية بُنيت لتشغيل محرك التحسين، ولم تُنقل من جدول منشور. لا يجوز اعتبار أي عليقة ناتجة عنها متوازنة غذائياً.',
  provenanceAr:
    'بنية النظام (UFL/UFV/PDI) مأخوذة من نظام INRAE 2018 المستخدم في جداول INRAE-CIRAD-AFZ. أما القيم العددية للمعاملات فهي تقديرية ولم تُتحقَّق بعد من النسخة الأصلية للمرجع.',
  models: { sheep: SHEEP_MODELS, goat: GOAT_MODELS },
  unsupportedCategories: [],
};

export const NRC_2007_UNCONFIGURED: StandardDefinition = {
  id: 'nrc-2007',
  version: '2007',
  nameAr: 'NRC 2007 — متطلبات الأغنام والماعز',
  shortNameAr: 'NRC 2007',
  energySystemAr: 'الطاقة القابلة للاستقلاب (ME)',
  proteinSystemAr: 'البروتين الخام (CP)',
  referenceId: 'ref-nrc-2007',
  status: 'incomplete',
  verificationNoteAr:
    'لم تُضَف قيم المتطلبات لهذا المعيار بعد، لأن جداول NRC 2007 لم تُتحقَّق من النسخة الأصلية أثناء تطوير هذه النسخة. التطبيق يمنع التحسين بهذا المعيار حتى تُدخل القيم الموثقة.',
  provenanceAr:
    'المرجع مسجّل في سجل المراجع العلمية، لكن لم تُستورد أي قيمة عددية منه. لا توجد أي قيم مُخترعة هنا.',
  models: { sheep: {}, goat: {} },
  unsupportedCategories: ALL_CATEGORIES,
};

export const STANDARDS: StandardDefinition[] = [INRAE_ILLUSTRATIVE, NRC_2007_UNCONFIGURED];

export function getStandard(id: string): StandardDefinition | undefined {
  return STANDARDS.find((s) => s.id === id);
}

export function getCategoryModel(
  standard: StandardDefinition,
  species: Species,
  category: ProductionCategory,
): CategoryModel | null {
  return standard.models[species]?.[category] ?? null;
}

export const CATEGORY_LABEL_AR: Record<ProductionCategory, string> = {
  growing: 'نامٍ (حملان / جديان)',
  fattening: 'تسمين',
  maintenance: 'صيانة',
  pregnant: 'أنثى حامل',
  lactating: 'أنثى مرضعة',
  breeding_male: 'فحل تربيه',
};

export const SPECIES_LABEL_AR: Record<Species, string> = {
  sheep: 'أغنام',
  goat: 'ماعز',
};
