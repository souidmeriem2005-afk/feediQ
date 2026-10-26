import type {
  DataStatus,
  Ingredient,
  IngredientCategory,
  NutrientKey,
  Provenance,
} from '../domain/types';

/**
 * Built-in feed catalogue.
 *
 * COMPOSITION VALUES
 * ------------------
 * Every number in `nutrients` below was copied from the publicly published
 * feed page of INRAE-CIRAD-AFZ (https://www.feedtables.com/) on 2026-10-23,
 * using the "on dry matter" column. The dry-matter percentage itself is taken
 * from the "as fed" column of the same page.
 *
 * PRICES
 * ------
 * No verified Algerian market quotation was available while this build was
 * made. Every built-in price is therefore `illustrative_demo` and is displayed
 * as such. It must be replaced by a real local price before any economic
 * decision is taken.
 *
 * INCLUSION LIMITS
 * ----------------
 * The minimum/maximum inclusion rates are conservative practical bounds used
 * only to keep the linear program inside physically sensible territory. They
 * are NOT transcribed from a published feeding standard and are labelled
 * accordingly in `inclusion.justificationAr`.
 */

const VERIFIED_ON = '2026-10-23';
const COMPOSITION_SOURCE = 'INRAE-CIRAD-AFZ Feed tables (feedtables.com)';
const PRICE_SOURCE = 'سعر عرض توضيحي — استبدله بسعر السوق المحلي';

const ALL_KEYS: NutrientKey[] = [
  'ufl',
  'ufv',
  'me_mj',
  'ne_l_mj',
  'pdi_g',
  'pdia_g',
  'cp_pct',
  'cf_pct',
  'ndf_pct',
  'adf_pct',
  'starch_pct',
  'fat_pct',
  'ash_pct',
  'ca_g',
  'p_g',
  'na_g',
  'mg_g',
  's_g',
  'cl_g',
  'fill_unit',
  'rpb_g',
];

type NutrientInput = Partial<Record<NutrientKey, number | null>>;

/**
 * Build a complete nutrient map. A key that is not supplied stays `null`
 * ("unknown"), never `0`, so the optimisation engine can refuse to use it.
 */
function nutrientMap(values: NutrientInput): Partial<Record<NutrientKey, number | null>> {
  const result: Partial<Record<NutrientKey, number | null>> = {};
  for (const key of ALL_KEYS) {
    result[key] = values[key] ?? null;
  }
  return result;
}

function provenance(locator: string, status: DataStatus = 'verified_reference'): Provenance {
  return {
    referenceId: 'ref-inrae-feedtables',
    locator,
    verifiedOn: VERIFIED_ON,
    status,
    note:
      status === 'verified_reference'
        ? `قيمة منشورة في ${COMPOSITION_SOURCE}، منقولة على أساس المادة الجافة.`
        : undefined,
  };
}

interface BuiltIn
  extends Omit<
    Ingredient,
    'isBuiltIn' | 'stockKgAsFed' | 'price' | 'nutrients' | 'provenance' | 'dataStatus'
  > {
  nutrients: NutrientInput;
  slug: string;
  pricePerKgAsFed: number | null;
  priceStatus?: DataStatus;
  provenanceStatus?: DataStatus;
}

function build(spec: BuiltIn): Ingredient {
  const locator = `${COMPOSITION_SOURCE} — ${spec.slug}`;
  const status = spec.provenanceStatus ?? 'verified_reference';
  return {
    id: spec.id,
    nameAr: spec.nameAr,
    nameEn: spec.nameEn,
    scientificName: spec.scientificName,
    category: spec.category,
    dryMatterPctAsFed: spec.dryMatterPctAsFed,
    nutrients: nutrientMap(spec.nutrients),
    price:
      spec.pricePerKgAsFed === null
        ? null
        : {
            valuePerKgAsFed: spec.pricePerKgAsFed,
            date: VERIFIED_ON,
            source: PRICE_SOURCE,
            basis: 'AF',
            dataStatus: spec.priceStatus ?? 'illustrative_demo',
          },
    inclusion: spec.inclusion,
    stockKgAsFed: null,
    dataStatus: status,
    provenance: {
      composition: status === 'unknown' ? undefined : provenance(locator, status),
      energy: status === 'unknown' ? undefined : provenance(`${locator}#energy`, status),
      protein: status === 'unknown' ? undefined : provenance(`${locator}#protein`, status),
      minerals: status === 'unknown' ? undefined : provenance(`${locator}#minerals`, status),
    },
    notesAr: spec.notesAr,
    isBuiltIn: true,
  };
}

const PRACTICAL_LIMITS_NOTE =
  'حدود عملية احترازية لضبط النموذج الرياضي، وليست مأخوذة من جدول معيار غذائي موثّق؛ راجعها مع أخصائي تغذية قبل الاعتماد النهائي.';

export const BUILT_IN_INGREDIENTS: Ingredient[] = [
  build({
    id: 'ing-barley',
    nameAr: 'الشعير',
    nameEn: 'Barley',
    category: 'cereal_grain',
    dryMatterPctAsFed: 87.2,
    slug: 'barley',
    pricePerKgAsFed: 55,
    nutrients: {
      cp_pct: 11.3,
      cf_pct: 5.4,
      fat_pct: 1.9,
      ash_pct: 2.5,
      ndf_pct: 21.5,
      adf_pct: 6.5,
      starch_pct: 59.9,
      ca_g: 0.8,
      p_g: 3.9,
      na_g: 0.11,
      mg_g: 1.3,
      s_g: 1.5,
      ufl: 1.11,
      ufv: 1.11,
      pdi_g: 87,
      pdia_g: 30,
      me_mj: 12.2,
      ne_l_mj: 8,
      fill_unit: 0.194,
      rpb_g: -23,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 70,
      justificationAr: `حبوب نشوية؛ الإفراط فيها قد يسبب اضطراباً في الكرش. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-maize',
    nameAr: 'الذرة الصفراء',
    nameEn: 'Maize grain',
    category: 'cereal_grain',
    dryMatterPctAsFed: 86.3,
    slug: 'maize grain',
    pricePerKgAsFed: 65,
    nutrients: {
      cp_pct: 8.8,
      cf_pct: 2.6,
      fat_pct: 4.1,
      ash_pct: 1.4,
      ndf_pct: 12.4,
      adf_pct: 3.1,
      starch_pct: 73.9,
      ca_g: 0.5,
      p_g: 2.9,
      na_g: 0.04,
      mg_g: 1.2,
      s_g: 1.3,
      ufl: 1.29,
      ufv: 1.33,
      pdi_g: 95,
      pdia_g: 42,
      me_mj: 13.6,
      ne_l_mj: 9.1,
      fill_unit: 0.336,
      rpb_g: -55,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 60,
      justificationAr: `حبوب عالية النشا؛ تُستخدم ضمن مزيج متوازن. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-wheat-bran',
    nameAr: 'نخالة القمح',
    nameEn: 'Wheat bran',
    category: 'cereal_byproduct',
    dryMatterPctAsFed: 86.9,
    slug: 'wheat bran',
    pricePerKgAsFed: 40,
    nutrients: {
      cp_pct: 17.6,
      cf_pct: 10.5,
      fat_pct: 3.8,
      ash_pct: 5.6,
      ndf_pct: 45.6,
      adf_pct: 13.5,
      starch_pct: 22.3,
      ca_g: 1.4,
      p_g: 11,
      na_g: 0.08,
      mg_g: 4.2,
      s_g: 2.1,
      ufl: 0.91,
      ufv: 0.85,
      pdi_g: 89,
      pdia_g: 37,
      me_mj: 10.6,
      ne_l_mj: 6.7,
      fill_unit: 0.31,
      rpb_g: 34,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 40,
      justificationAr: `غنية بالفوسفور والألياف؛ الإفراط قد يرفع الفوسفور ويقلل كثافة الطاقة. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-wheat-straw',
    nameAr: 'قش القمح',
    nameEn: 'Wheat straw',
    category: 'straw',
    dryMatterPctAsFed: 90.3,
    slug: 'wheat straw',
    pricePerKgAsFed: 18,
    nutrients: {
      cp_pct: 3.9,
      cf_pct: 41.6,
      fat_pct: 1.4,
      ash_pct: 6.6,
      ndf_pct: 78,
      adf_pct: 50,
      starch_pct: 0.8,
      ca_g: 4.4,
      p_g: 0.7,
      na_g: 0.17,
      mg_g: 1.1,
      s_g: 1.1,
      ufl: 0.5,
      ufv: 0.38,
      pdi_g: 56,
      pdia_g: 13,
      me_mj: 6.3,
      ne_l_mj: 3.6,
      fill_unit: 0.622,
      rpb_g: -62,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 45,
      justificationAr: `مالئة منخفضة الطاقة؛ الإكثار منها يحد من استهلاك الطاقة والبروتين. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-soybean-meal',
    nameAr: 'كسب فول الصويا',
    nameEn: 'Soybean meal',
    category: 'protein_feed',
    dryMatterPctAsFed: 88,
    slug: 'soybean meal',
    pricePerKgAsFed: 105,
    nutrients: {
      cp_pct: 52.6,
      cf_pct: 6.8,
      fat_pct: 1.8,
      ash_pct: 7.1,
      ndf_pct: 14.2,
      adf_pct: 8.4,
      starch_pct: 5.7,
      ca_g: 3.8,
      p_g: 7.1,
      na_g: 0.16,
      mg_g: 3.1,
      s_g: 4.5,
      ufl: 1.27,
      ufv: 1.28,
      pdi_g: 227,
      pdia_g: 172,
      me_mj: 14,
      ne_l_mj: 9.4,
      fill_unit: 0.253,
      rpb_g: 244,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 30,
      justificationAr: `مصدر بروتيني مركّز مرتفع الثمن؛ يُستخدم بالقدر اللازم لتغطية PDI. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-alfalfa-dehydrated',
    nameAr: 'ألفالفا مجففة (دريس)',
    nameEn: 'Dehydrated alfalfa',
    category: 'forage',
    dryMatterPctAsFed: 90.6,
    slug: 'dehydrated alfalfa',
    pricePerKgAsFed: 45,
    nutrients: {
      cp_pct: 17.9,
      cf_pct: 28.9,
      fat_pct: 2.5,
      ash_pct: 12.3,
      ndf_pct: 45.2,
      adf_pct: 32.9,
      starch_pct: 3.1,
      ca_g: 23.3,
      p_g: 2.7,
      na_g: 0.43,
      mg_g: 2,
      s_g: 2.9,
      ufl: 0.75,
      ufv: 0.67,
      pdi_g: 100,
      pdia_g: 53,
      me_mj: 9,
      ne_l_mj: 5.5,
      fill_unit: 0.383,
      rpb_g: 21,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 70,
      justificationAr: `علف خشن غني بالكالسيوم والألياف؛ يلزم توازنه مع مصدر فوسفور. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-grass-dehydrated',
    nameAr: 'دريس الأعشاب المجفف',
    nameEn: 'Dehydrated grass',
    category: 'forage',
    dryMatterPctAsFed: 90,
    slug: 'dehydrated grass',
    pricePerKgAsFed: 35,
    nutrients: {
      cp_pct: 16.2,
      cf_pct: 26,
      fat_pct: 3.4,
      ash_pct: 8.6,
      ndf_pct: 54.2,
      adf_pct: 30.7,
      starch_pct: 1.2,
      ca_g: 5.9,
      p_g: 3.1,
      na_g: 4.37,
      mg_g: 1.8,
      s_g: 1.1,
      ufl: 0.92,
      ufv: 0.87,
      pdi_g: 103,
      pdia_g: 51,
      me_mj: 10.7,
      ne_l_mj: 6.8,
      fill_unit: 0.396,
      rpb_g: 2,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 70,
      justificationAr: `علف خشن متوسط الجودة؛ يوفّر أليافاً فعلية للكرش. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-maize-bran',
    nameAr: 'نخالة الذرة',
    nameEn: 'Maize bran',
    category: 'cereal_byproduct',
    dryMatterPctAsFed: 90.9,
    slug: 'maize bran',
    pricePerKgAsFed: 42,
    nutrients: {
      cp_pct: 11.3,
      cf_pct: 8.6,
      fat_pct: 4.7,
      ash_pct: 4.5,
      ndf_pct: 39.3,
      adf_pct: 10.6,
      starch_pct: 38.6,
      ca_g: 3,
      p_g: 3.3,
      na_g: 0.13,
      mg_g: 2.2,
      s_g: 1.2,
      ufl: 1.17,
      ufv: 1.17,
      pdi_g: 119,
      pdia_g: 66,
      me_mj: 12.4,
      ne_l_mj: 8.1,
      fill_unit: 0.547,
      rpb_g: -62,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 40,
      justificationAr: `منتج ثانوي يجمع بين طاقة معقولة وألياف؛ يستخدم لضبط NDF دون خسارة كبيرة في الطاقة. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-limestone',
    nameAr: 'الحجر الجيري (كربونات الكالسيوم)',
    nameEn: 'Limestone / calcium carbonate',
    category: 'mineral',
    dryMatterPctAsFed: 99.5,
    slug: 'limestone',
    pricePerKgAsFed: 12,
    nutrients: {
      cp_pct: 0,
      cf_pct: 0,
      fat_pct: 0,
      ash_pct: 100,
      ndf_pct: 0,
      adf_pct: 0,
      starch_pct: 0,
      ca_g: 351,
      p_g: 0,
      na_g: 0,
      ufl: 0,
      ufv: 0,
      pdi_g: 0,
      pdia_g: 0,
      me_mj: 0,
      ne_l_mj: 0,
      fill_unit: 0,
      rpb_g: 0,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 3,
      justificationAr: `مكمّل معدني للكالسيوم فقط؛ الإفراط يخلّ بتوازن الكالسيوم والفوسفور. ${PRACTICAL_LIMITS_NOTE}`,
    },
    notesAr: 'لا تُستخدم قيم الطاقة أو البروتين للمعادن في حساب تغطية الطاقة، لكنها مضبوطة على صفر في الجدول المرجعي.',
  }),
  build({
    id: 'ing-salt',
    nameAr: 'ملح الطعام (كلوريد الصوديوم)',
    nameEn: 'Sodium chloride / salt',
    category: 'mineral',
    dryMatterPctAsFed: 99.6,
    slug: 'sodium chloride',
    pricePerKgAsFed: 25,
    nutrients: {
      cp_pct: 0,
      cf_pct: 0,
      fat_pct: 0,
      ash_pct: 100,
      ndf_pct: 0,
      adf_pct: 0,
      starch_pct: 0,
      ca_g: 0,
      p_g: 0,
      na_g: 381,
      ufl: 0,
      ufv: 0,
      pdi_g: 0,
      pdia_g: 0,
      me_mj: 0,
      ne_l_mj: 0,
      fill_unit: 0,
      rpb_g: 0,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 1,
      justificationAr: `يغطي الصوديوم؛ الإفراط يرفع استهلاك الماء ويمكن أن يسبب تسمماً ملحياً. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-dicalcium-phosphate',
    nameAr: 'فوسفات ثنائي الكالسيوم',
    nameEn: 'Dicalcium phosphate',
    category: 'mineral',
    dryMatterPctAsFed: 97.4,
    slug: 'dicalcium phosphate',
    pricePerKgAsFed: 220,
    nutrients: {
      cp_pct: 0,
      cf_pct: 0,
      fat_pct: 0,
      ash_pct: 100,
      ndf_pct: 0,
      adf_pct: 0,
      starch_pct: 0,
      ca_g: 245,
      p_g: 175,
      na_g: 1.16,
      mg_g: 6.3,
      ufl: 0,
      ufv: 0,
      pdi_g: 0,
      pdia_g: 0,
      me_mj: 0,
      ne_l_mj: 0,
      fill_unit: 0,
      rpb_g: 0,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 3,
      justificationAr: `مكمّل للفوسفور والكالسيوم معاً؛ يُستخدم عند نقص الفوسفور في المزيج الأساسي. ${PRACTICAL_LIMITS_NOTE}`,
    },
  }),
  build({
    id: 'ing-urea',
    nameAr: 'اليوريا',
    nameEn: 'Urea',
    category: 'additive',
    dryMatterPctAsFed: 99.4,
    slug: 'urea',
    pricePerKgAsFed: 70,
    nutrients: {
      cp_pct: 287,
      cf_pct: 0,
      fat_pct: 0,
      ash_pct: 0,
      ndf_pct: 0,
      adf_pct: 0,
      starch_pct: 0,
      ca_g: 0,
      p_g: 0,
      na_g: 0,
      ufl: 0.26,
      ufv: 0.2,
      pdi_g: 71,
      pdia_g: 0,
      me_mj: 3.4,
      ne_l_mj: 1.9,
      fill_unit: 0.226,
      rpb_g: 2557,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 1,
      justificationAr:
        'الحد الأعلى 1% احترازي بسبب خطر التسمم بالأمونيا وسوء التكيّف مع آزوت غير بروتيني، ويجب توزيعه تدريجياً مع مصدر طاقة متاح في الكرش. الحد مقيّد بنموذج رياضي وليس بمرجع معتمد — لا تُستخدم اليوريا دون إشراف مختص.',
    },
    notesAr:
      'آزوت غير بروتيني: لا يُعامل كبروتين حقيقي. القيم منشورة على أساس المادة الجافة، لكن الاستخدام الآمن يتطلب إشرافاً مختصاً.',
  }),
  build({
    id: 'ing-mineral-premix',
    nameAr: 'خليط معدني وفيتاميني (بيانات غير متوفرة)',
    nameEn: 'Mineral-vitamin premix',
    category: 'additive',
    dryMatterPctAsFed: 100,
    slug: 'mineral premix',
    pricePerKgAsFed: 350,
    provenanceStatus: 'unknown',
    nutrients: {
      cp_pct: null,
      ca_g: null,
      p_g: null,
      na_g: null,
      ndf_pct: null,
      ufl: null,
      ufv: null,
      pdi_g: null,
    },
    inclusion: {
      minPctDM: 0,
      maxPctDM: 1,
      justificationAr: `حد أعلى عملي وقائي؛ التركيب الدقيق غير معروف في هذه النسخة. ${PRACTICAL_LIMITS_NOTE}`,
    },
    notesAr:
      'تُركت جميع قيم التركيب فارغة عن قصد: هذه المادة تبيّن كيف يستبعد المحرك أي مادة ناقصة البيانات بدلاً من اعتبار النقص صفراً. أدخل تركيبها من بطاقة المنتج لتصلح للتحسين.',
  }),
];

export function getBuiltInIngredient(id: string): Ingredient | undefined {
  return BUILT_IN_INGREDIENTS.find((i) => i.id === id);
}

export const INGREDIENT_CATEGORY_LABEL_AR: Record<IngredientCategory, string> = {
  cereal_grain: 'حبوب',
  cereal_byproduct: 'منتجات ثانوية للحبوب',
  forage: 'أعلاف خشنة',
  straw: 'أتبان',
  protein_feed: 'أعلاف بروتينية',
  mineral: 'معادن',
  additive: 'إضافات',
};

export const INGREDIENT_CATEGORIES = Object.keys(
  INGREDIENT_CATEGORY_LABEL_AR,
) as IngredientCategory[];

export function emptyNutrients(): Partial<Record<NutrientKey, number | null>> {
  return nutrientMap({});
}

/** A blank, clearly user-owned ingredient used by the "add feed" form. */
export function createEmptyIngredient(): Ingredient {
  return {
    id: '',
    nameAr: '',
    category: 'cereal_grain',
    dryMatterPctAsFed: null,
    nutrients: emptyNutrients(),
    price: null,
    inclusion: {
      minPctDM: 0,
      maxPctDM: null,
      justificationAr: 'حدود أدخلها المستخدم — لا تستند إلى مرجع موثّق.',
    },
    stockKgAsFed: null,
    dataStatus: 'user_entered',
    provenance: {},
    notesAr: '',
    isBuiltIn: false,
  };
}
