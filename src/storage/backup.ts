import type {
  AppSettings,
  Ingredient,
  IngredientCategory,
  LivestockProfile,
  ProductionCategory,
  SavedFormulation,
  Species,
} from '../domain/types';
import { INGREDIENT_CATEGORIES } from '../data/ingredients';

/**
 * JSON backup format.
 *
 * The importer validates the *entire* file before writing anything. A file that
 * fails validation is rejected as a whole; partial imports are never performed.
 */
export const BACKUP_APP_ID = 'smartfeed';
export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupData {
  ingredients: Ingredient[];
  profiles: LivestockProfile[];
  formulations: SavedFormulation[];
  settings: AppSettings;
}

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  data: BackupData;
}

export type BackupValidation =
  | { ok: true; file: BackupFile; warningsAr: string[] }
  | { ok: false; errorsAr: string[] };

const DATA_STATUSES = [
  'verified_reference',
  'laboratory_measured',
  'reference_requires_confirmation',
  'user_entered',
  'illustrative_demo',
  'unknown',
] as const;

const SPECIES: Species[] = ['sheep', 'goat'];
const CATEGORIES: ProductionCategory[] = [
  'growing',
  'fattening',
  'maintenance',
  'pregnant',
  'lactating',
  'breeding_male',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isIsoDateLike(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

class Problems {
  readonly items: string[] = [];

  add(path: string, messageAr: string): void {
    if (this.items.length < 80) this.items.push(`${path}: ${messageAr}`);
  }
}

function validateIngredient(raw: unknown, path: string, p: Problems): Ingredient | null {
  if (!isRecord(raw)) {
    p.add(path, 'يجب أن تكون المادة العلفية كائناً.');
    return null;
  }
  if (!isNonEmptyString(raw.id)) p.add(`${path}.id`, 'معرّف مفقود.');
  if (!isNonEmptyString(raw.nameAr)) p.add(`${path}.nameAr`, 'اسم المادة بالعربية مفقود.');
  if (!isString(raw.category) || !INGREDIENT_CATEGORIES.includes(raw.category as IngredientCategory)) {
    p.add(`${path}.category`, 'فئة مادة علفية غير معروفة.');
  }
  if (raw.dryMatterPctAsFed !== null && !isFiniteNumber(raw.dryMatterPctAsFed)) {
    p.add(`${path}.dryMatterPctAsFed`, 'يجب أن تكون نسبة المادة الجافة رقماً أو null.');
  } else if (
    isFiniteNumber(raw.dryMatterPctAsFed) &&
    (raw.dryMatterPctAsFed <= 0 || raw.dryMatterPctAsFed > 100)
  ) {
    p.add(`${path}.dryMatterPctAsFed`, 'نسبة المادة الجافة يجب أن تكون بين 0 و100.');
  }

  if (!isRecord(raw.nutrients)) {
    p.add(`${path}.nutrients`, 'خريطة القيم الغذائية مفقودة.');
  } else {
    for (const [key, value] of Object.entries(raw.nutrients)) {
      if (!isNullableNumber(value)) {
        p.add(`${path}.nutrients.${key}`, 'القيمة يجب أن تكون رقماً أو null.');
      }
    }
  }

  if (raw.price !== null && raw.price !== undefined) {
    if (!isRecord(raw.price)) {
      p.add(`${path}.price`, 'السعر غير صالح.');
    } else {
      if (!isFiniteNumber(raw.price.valuePerKgAsFed) || raw.price.valuePerKgAsFed < 0) {
        p.add(`${path}.price.valuePerKgAsFed`, 'السعر يجب أن يكون رقماً غير سالب.');
      }
      if (!isIsoDateLike(raw.price.date)) p.add(`${path}.price.date`, 'تاريخ السعر غير صالح.');
      if (!isString(raw.price.source)) p.add(`${path}.price.source`, 'مصدر السعر مفقود.');
      if (raw.price.basis !== 'AF') p.add(`${path}.price.basis`, 'أساس السعر يجب أن يكون AF.');
      if (!isString(raw.price.dataStatus) || !DATA_STATUSES.includes(raw.price.dataStatus as never)) {
        p.add(`${path}.price.dataStatus`, 'حالة بيانات السعر غير معروفة.');
      }
    }
  }

  if (!isRecord(raw.inclusion)) {
    p.add(`${path}.inclusion`, 'حدود الإدراج مفقودة.');
  } else {
    if (!isFiniteNumber(raw.inclusion.minPctDM) || raw.inclusion.minPctDM < 0) {
      p.add(`${path}.inclusion.minPctDM`, 'الحد الأدنى يجب أن يكون رقماً غير سالب.');
    }
    if (raw.inclusion.maxPctDM !== null && !isFiniteNumber(raw.inclusion.maxPctDM)) {
      p.add(`${path}.inclusion.maxPctDM`, 'الحد الأعلى يجب أن يكون رقماً أو null.');
    }
    if (!isString(raw.inclusion.justificationAr)) {
      p.add(`${path}.inclusion.justificationAr`, 'تفسير حدود الإدراج مفقود.');
    }
  }

  if (raw.stockKgAsFed !== undefined && raw.stockKgAsFed !== null && !isFiniteNumber(raw.stockKgAsFed)) {
    p.add(`${path}.stockKgAsFed`, 'المخزون يجب أن يكون رقماً أو null.');
  }
  if (!isString(raw.dataStatus) || !DATA_STATUSES.includes(raw.dataStatus as never)) {
    p.add(`${path}.dataStatus`, 'حالة البيانات غير معروفة.');
  }
  if (!isRecord(raw.provenance)) p.add(`${path}.provenance`, 'بيانات المصدر مفقودة.');
  if (!isBoolean(raw.isBuiltIn)) p.add(`${path}.isBuiltIn`, 'حقل isBuiltIn يجب أن يكون منطقياً.');

  return p.items.length === 0 ? (raw as unknown as Ingredient) : (raw as unknown as Ingredient);
}

function validateProfile(raw: unknown, path: string, p: Problems): LivestockProfile | null {
  if (!isRecord(raw)) {
    p.add(path, 'ملف الحيوان يجب أن يكون كائناً.');
    return null;
  }
  if (!isNonEmptyString(raw.id)) p.add(`${path}.id`, 'المعرّف مفقود.');
  if (!isNonEmptyString(raw.name)) p.add(`${path}.name`, 'اسم الملف مفقود.');
  if (!isString(raw.species) || !SPECIES.includes(raw.species as Species)) {
    p.add(`${path}.species`, 'النوع يجب أن يكون sheep أو goat.');
  }
  if (!isString(raw.category) || !CATEGORIES.includes(raw.category as ProductionCategory)) {
    p.add(`${path}.category`, 'الفئة الإنتاجية غير معروفة.');
  }
  if (!isFiniteNumber(raw.ageMonths) || raw.ageMonths < 0) p.add(`${path}.ageMonths`, 'العمر غير صالح.');
  if (!isFiniteNumber(raw.liveWeightKg) || raw.liveWeightKg <= 0) {
    p.add(`${path}.liveWeightKg`, 'الوزن الحي غير صالح.');
  }
  if (!isNullableNumber(raw.targetDailyGainG)) p.add(`${path}.targetDailyGainG`, 'معدل النمو غير صالح.');
  if (!isFiniteNumber(raw.headCount) || raw.headCount < 1) p.add(`${path}.headCount`, 'عدد الرؤوس غير صالح.');
  if (raw.feedingSystem !== 'grazing' && raw.feedingSystem !== 'housed' && raw.feedingSystem !== 'mixed') {
    p.add(`${path}.feedingSystem`, 'نظام التغذية غير معروف.');
  }
  if (raw.pregnancyStage !== null && !['early', 'mid', 'late'].includes(String(raw.pregnancyStage))) {
    p.add(`${path}.pregnancyStage`, 'مرحلة الحمل غير معروفة.');
  }
  if (!isNullableNumber(raw.lactationMonth)) p.add(`${path}.lactationMonth`, 'شهر الرضاعة غير صالح.');
  if (!isNullableNumber(raw.dailyMilkL)) p.add(`${path}.dailyMilkL`, 'كمية الحليب غير صالحة.');
  if (!isIsoDateLike(raw.createdAt)) p.add(`${path}.createdAt`, 'تاريخ الإنشاء غير صالح.');
  if (!isIsoDateLike(raw.updatedAt)) p.add(`${path}.updatedAt`, 'تاريخ التحديث غير صالح.');
  return raw as unknown as LivestockProfile;
}

function validateFormulation(raw: unknown, path: string, p: Problems): SavedFormulation | null {
  if (!isRecord(raw)) {
    p.add(path, 'العليقة المحفوظة يجب أن تكون كائناً.');
    return null;
  }
  if (!isNonEmptyString(raw.id)) p.add(`${path}.id`, 'المعرّف مفقود.');
  if (!isNonEmptyString(raw.name)) p.add(`${path}.name`, 'اسم العليقة مفقود.');
  if (!isString(raw.notes)) p.add(`${path}.notes`, 'الملاحظات يجب أن تكون نصاً.');
  if (!isIsoDateLike(raw.createdAt)) p.add(`${path}.createdAt`, 'تاريخ الإنشاء غير صالح.');
  if (!isIsoDateLike(raw.updatedAt)) p.add(`${path}.updatedAt`, 'تاريخ التحديث غير صالح.');
  if (!isFiniteNumber(raw.version) || raw.version < 1) p.add(`${path}.version`, 'رقم الإصدار غير صالح.');
  if (!Array.isArray(raw.priceSnapshot)) {
    p.add(`${path}.priceSnapshot`, 'لقطة الأسعار مفقودة.');
  }
  if (!isRecord(raw.result)) {
    p.add(`${path}.result`, 'نتيجة العليقة مفقودة.');
  } else {
    if (!isString(raw.result.status)) p.add(`${path}.result.status`, 'حالة النتيجة مفقودة.');
    if (!isFiniteNumber(raw.result.totalDmKg)) p.add(`${path}.result.totalDmKg`, 'إجمالي المادة الجافة غير صالح.');
    if (!isFiniteNumber(raw.result.totalCostPerAnimalDay)) {
      p.add(`${path}.result.totalCostPerAnimalDay`, 'التكلفة اليومية غير صالحة.');
    }
    if (!Array.isArray(raw.result.lines)) {
      p.add(`${path}.result.lines`, 'أسطر العليقة مفقودة.');
    } else {
      raw.result.lines.forEach((line, index) => {
        const linePath = `${path}.result.lines[${index}]`;
        if (!isRecord(line)) {
          p.add(linePath, 'سطر غير صالح.');
          return;
        }
        if (!isString(line.ingredientId)) p.add(`${linePath}.ingredientId`, 'معرّف المادة مفقود.');
        if (!isString(line.nameAr)) p.add(`${linePath}.nameAr`, 'اسم المادة مفقود.');
        if (!isFiniteNumber(line.quantityKgDM) || line.quantityKgDM < 0) {
          p.add(`${linePath}.quantityKgDM`, 'الكمية غير صالحة.');
        }
      });
    }
    if (!isRecord(raw.result.profileSnapshot)) {
      p.add(`${path}.result.profileSnapshot`, 'لقطة بيانات الحيوان مفقودة.');
    }
    if (!isRecord(raw.result.requirements) || !Array.isArray(raw.result.requirements.requirements)) {
      p.add(`${path}.result.requirements`, 'لقطة المتطلبات مفقودة.');
    }
  }
  return raw as unknown as SavedFormulation;
}

export function validateSettings(raw: unknown, path: string, p: Problems): AppSettings | null {
  if (!isRecord(raw)) {
    p.add(path, 'الإعدادات مفقودة.');
    return null;
  }
  if (raw.currency !== 'DZD') p.add(`${path}.currency`, 'العملة يجب أن تكون DZD.');
  if (raw.preferredBasis !== 'AF' && raw.preferredBasis !== 'DM') {
    p.add(`${path}.preferredBasis`, 'أساس العرض يجب أن يكون AF أو DM.');
  }
  if (!isBoolean(raw.showDataStatus)) p.add(`${path}.showDataStatus`, 'قيمة غير منطقية.');
  if (!isBoolean(raw.demoAcknowledged)) p.add(`${path}.demoAcknowledged`, 'قيمة غير منطقية.');
  if (!isNonEmptyString(raw.defaultStandardId)) {
    p.add(`${path}.defaultStandardId`, 'المعيار الافتراضي مفقود.');
  }
  if (!isFiniteNumber(raw.dashboardPeriodDays) || raw.dashboardPeriodDays <= 0) {
    p.add(`${path}.dashboardPeriodDays`, 'مدة لوحة المعلومات يجب أن تكون أكبر من صفر.');
  }
  return raw as unknown as AppSettings;
}

export function createBackup(data: BackupData): BackupFile {
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export function validateBackup(raw: unknown): BackupValidation {
  const p = new Problems();
  if (!isRecord(raw)) {
    return { ok: false, errorsAr: ['الملف ليس كائن JSON صالحاً.'] };
  }

  if (raw.app !== BACKUP_APP_ID) {
    p.add('app', 'الملف لا ينتمي إلى تطبيق علفتي الذكية.');
  }
  if (raw.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    p.add(
      'schemaVersion',
      `إصدار المخطط غير مدعوم (المتوقع ${BACKUP_SCHEMA_VERSION}).`,
    );
  }
  if (!isRecord(raw.data)) {
    p.add('data', 'قسم البيانات مفقود.');
    return { ok: false, errorsAr: p.items };
  }

  const data = raw.data;
  const ingredientsRaw = data.ingredients;
  const profilesRaw = data.profiles;
  const formulationsRaw = data.formulations;

  if (!Array.isArray(ingredientsRaw)) p.add('data.ingredients', 'يجب أن تكون قائمة.');
  if (!Array.isArray(profilesRaw)) p.add('data.profiles', 'يجب أن تكون قائمة.');
  if (!Array.isArray(formulationsRaw)) p.add('data.formulations', 'يجب أن تكون قائمة.');

  const ingredients = Array.isArray(ingredientsRaw)
    ? ingredientsRaw.map((item, i) => validateIngredient(item, `data.ingredients[${i}]`, p))
    : [];
  const profiles = Array.isArray(profilesRaw)
    ? profilesRaw.map((item, i) => validateProfile(item, `data.profiles[${i}]`, p))
    : [];
  const formulations = Array.isArray(formulationsRaw)
    ? formulationsRaw.map((item, i) => validateFormulation(item, `data.formulations[${i}]`, p))
    : [];
  validateSettings(data.settings, 'data.settings', p);

  if (p.items.length > 0) {
    return { ok: false, errorsAr: p.items };
  }

  const warningsAr: string[] = [];
  const ingredientIds = new Set(ingredients.map((i) => i?.id));
  const duplicateIds = ingredients.length !== ingredientIds.size;
  if (duplicateIds) warningsAr.push('الملف يحتوي على معرّفات مواد علفية مكررة؛ سيُحتفظ بالسجل الأخير.');
  warningsAr.push('سيؤدي الاستيراد إلى استبدال جميع البيانات المحلية الحالية بعد التأكيد.');
  warningsAr.push('الأسعار وبيانات التركيب المستوردة تبقى بمسؤولية المستخدم وتحتاج تحققاً قبل الاستخدام.');

  return {
    ok: true,
    file: {
      app: BACKUP_APP_ID,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: isString(raw.exportedAt) ? raw.exportedAt : new Date().toISOString(),
      data: {
        ingredients: ingredients.filter((x): x is Ingredient => x !== null),
        profiles: profiles.filter((x): x is LivestockProfile => x !== null),
        formulations: formulations.filter((x): x is SavedFormulation => x !== null),
        settings: validateSettings(data.settings, 'data.settings', new Problems()) as AppSettings,
      },
    },
    warningsAr,
  };
}

/** Pretty-printed JSON suitable for download. */
export function serialiseBackup(file: BackupFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
