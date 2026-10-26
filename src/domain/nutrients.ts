import type { DataStatus, NutrientDefinition, NutrientKey } from './types';

/**
 * The nutrient dictionary.
 *
 * Every nutrient carries its own unit and its own basis so the UI and the
 * calculation engine can never silently mix dry-matter and as-fed values.
 */
export const NUTRIENTS: Record<NutrientKey, NutrientDefinition> = {
  ufl: {
    key: 'ufl',
    labelAr: 'الطاقة (وحدة علفية لبن)',
    shortLabelAr: 'UFL',
    unitAr: 'UFL/كغ م.ج',
    basis: 'DM',
    group: 'energy',
    decimals: 2,
  },
  ufv: {
    key: 'ufv',
    labelAr: 'الطاقة (وحدة علفية لحم)',
    shortLabelAr: 'UFV',
    unitAr: 'UFV/كغ م.ج',
    basis: 'DM',
    group: 'energy',
    decimals: 2,
  },
  me_mj: {
    key: 'me_mj',
    labelAr: 'الطاقة القابلة للاستقلاب',
    shortLabelAr: 'ME',
    unitAr: 'ميغاجول/كغ م.ج',
    basis: 'DM',
    group: 'energy',
    decimals: 1,
  },
  ne_l_mj: {
    key: 'ne_l_mj',
    labelAr: 'صافي طاقة الإدرار',
    shortLabelAr: 'NEL',
    unitAr: 'ميغاجول/كغ م.ج',
    basis: 'DM',
    group: 'energy',
    decimals: 1,
  },
  pdi_g: {
    key: 'pdi_g',
    labelAr: 'البروتين الهضمي في الأمعاء',
    shortLabelAr: 'PDI',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'protein',
    decimals: 0,
  },
  pdia_g: {
    key: 'pdia_g',
    labelAr: 'البروتين غير المتحلل في الكرش',
    shortLabelAr: 'PDIA',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'protein',
    decimals: 0,
  },
  cp_pct: {
    key: 'cp_pct',
    labelAr: 'البروتين الخام',
    shortLabelAr: 'CP',
    unitAr: '% م.ج',
    basis: 'DM',
    group: 'protein',
    decimals: 1,
  },
  cf_pct: {
    key: 'cf_pct',
    labelAr: 'الألياف الخام',
    shortLabelAr: 'CF',
    unitAr: '% م.ج',
    basis: 'DM',
    group: 'fibre',
    decimals: 1,
  },
  ndf_pct: {
    key: 'ndf_pct',
    labelAr: 'الألياف المتعادلة (NDF)',
    shortLabelAr: 'NDF',
    unitAr: '% م.ج',
    basis: 'DM',
    group: 'fibre',
    decimals: 1,
  },
  adf_pct: {
    key: 'adf_pct',
    labelAr: 'الألياف الحمضية (ADF)',
    shortLabelAr: 'ADF',
    unitAr: '% م.ج',
    basis: 'DM',
    group: 'fibre',
    decimals: 1,
  },
  starch_pct: {
    key: 'starch_pct',
    labelAr: 'النشا',
    shortLabelAr: 'النشا',
    unitAr: '% م.ج',
    basis: 'DM',
    group: 'other',
    decimals: 1,
  },
  fat_pct: {
    key: 'fat_pct',
    labelAr: 'الدهن الخام',
    shortLabelAr: 'الدهن',
    unitAr: '% م.ج',
    basis: 'DM',
    group: 'other',
    decimals: 1,
  },
  ash_pct: {
    key: 'ash_pct',
    labelAr: 'الرماد',
    shortLabelAr: 'الرماد',
    unitAr: '% م.ج',
    basis: 'DM',
    group: 'other',
    decimals: 1,
  },
  ca_g: {
    key: 'ca_g',
    labelAr: 'الكالسيوم',
    shortLabelAr: 'Ca',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'minerals',
    decimals: 1,
  },
  p_g: {
    key: 'p_g',
    labelAr: 'الفوسفور',
    shortLabelAr: 'P',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'minerals',
    decimals: 1,
  },
  na_g: {
    key: 'na_g',
    labelAr: 'الصوديوم',
    shortLabelAr: 'Na',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'minerals',
    decimals: 2,
  },
  mg_g: {
    key: 'mg_g',
    labelAr: 'المغنيزيوم',
    shortLabelAr: 'Mg',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'minerals',
    decimals: 2,
  },
  s_g: {
    key: 's_g',
    labelAr: 'الكبريت',
    shortLabelAr: 'S',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'minerals',
    decimals: 2,
  },
  cl_g: {
    key: 'cl_g',
    labelAr: 'الكلور',
    shortLabelAr: 'Cl',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'minerals',
    decimals: 2,
  },
  fill_unit: {
    key: 'fill_unit',
    labelAr: 'وحدة الحشو',
    shortLabelAr: 'FU',
    unitAr: 'FU/كغ م.ج',
    basis: 'DM',
    group: 'other',
    decimals: 3,
  },
  rpb_g: {
    key: 'rpb_g',
    labelAr: 'توازن بروتين الكرش',
    shortLabelAr: 'RPB',
    unitAr: 'غ/كغ م.ج',
    basis: 'DM',
    group: 'protein',
    decimals: 0,
  },
};

export const NUTRIENT_KEYS = Object.keys(NUTRIENTS) as NutrientKey[];

/** Nutrients the least-cost engine can constrain. */
export const CONSTRAINABLE_NUTRIENTS: NutrientKey[] = [
  'ufl',
  'ufv',
  'pdi_g',
  'ca_g',
  'p_g',
  'na_g',
];

export const DATA_STATUS_LABEL_AR: Record<DataStatus, string> = {
  verified_reference: 'بيانات مرجعية موثّقة',
  laboratory_measured: 'بيانات مقاسة مخبرياً',
  reference_requires_confirmation: 'مشتقة من مرجع وتحتاج تأكيداً',
  user_entered: 'بيانات أدخلها المستخدم',
  illustrative_demo: 'بيانات عرض توضيحية',
  unknown: 'غير معروفة أو غير مُتحقَّق منها',
};

export const DATA_STATUS_STYLE: Record<DataStatus, string> = {
  verified_reference: 'bg-brand-100 text-brand-900',
  laboratory_measured: 'bg-sky-100 text-sky-900',
  reference_requires_confirmation: 'bg-amber-100 text-amber-900',
  user_entered: 'bg-slate-100 text-slate-800',
  illustrative_demo: 'bg-violet-100 text-violet-900',
  unknown: 'bg-red-100 text-red-900',
};

export function nutrientLabel(key: NutrientKey): string {
  return NUTRIENTS[key].labelAr;
}

export function formatNutrient(key: NutrientKey, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const d = NUTRIENTS[key].decimals;
  return value.toFixed(d);
}
