import {
  CATEGORY_LABEL_AR,
  getCategoryModel,
  type CategoryModel,
  type StandardDefinition,
} from '../data/standards';
import type {
  ComputedRequirements,
  LivestockProfile,
  NutrientRequirement,
  ProductionCategory,
  Provenance,
  RequirementStatus,
} from './types';

export interface RequirementValidationIssue {
  field: string;
  messageAr: string;
}

/** Field-level validation used by the livestock form and by the engine. */
export function validateProfile(profile: Partial<LivestockProfile>): RequirementValidationIssue[] {
  const issues: RequirementValidationIssue[] = [];

  if (profile.species !== 'sheep' && profile.species !== 'goat') {
    issues.push({ field: 'species', messageAr: 'يجب اختيار النوع: أغنام أو ماعز.' });
  }

  const weight = profile.liveWeightKg;
  if (weight === null || weight === undefined || !Number.isFinite(weight)) {
    issues.push({ field: 'liveWeightKg', messageAr: 'الوزن الحي مطلوب.' });
  } else if (weight <= 0) {
    issues.push({ field: 'liveWeightKg', messageAr: 'الوزن الحي يجب أن يكون أكبر من صفر.' });
  } else if (weight > 300) {
    issues.push({
      field: 'liveWeightKg',
      messageAr: 'الوزن الحي المُدخل (أكثر من 300 كغ) خارج النطاق المعتاد للأغنام والماعز — يرجى التحقق.',
    });
  }

  const age = profile.ageMonths;
  if (age === null || age === undefined || !Number.isFinite(age)) {
    issues.push({ field: 'ageMonths', messageAr: 'العمر بالأشهر مطلوب.' });
  } else if (age < 0) {
    issues.push({ field: 'ageMonths', messageAr: 'العمر لا يمكن أن يكون سالباً.' });
  } else if (age > 240) {
    issues.push({ field: 'ageMonths', messageAr: 'العمر المُدخل يتجاوز 20 سنة — يرجى التحقق.' });
  }

  const head = profile.headCount;
  if (head === null || head === undefined || !Number.isFinite(head)) {
    issues.push({ field: 'headCount', messageAr: 'عدد الرؤوس مطلوب.' });
  } else if (head < 1) {
    issues.push({ field: 'headCount', messageAr: 'عدد الرؤوس يجب أن يكون 1 على الأقل.' });
  } else if (!Number.isInteger(head)) {
    issues.push({ field: 'headCount', messageAr: 'عدد الرؤوس يجب أن يكون عدداً صحيحاً.' });
  }

  const category = profile.category;
  if (!category) {
    issues.push({ field: 'category', messageAr: 'الفئة الإنتاجية مطلوبة.' });
    return issues;
  }

  if (category === 'growing' || category === 'fattening') {
    const gain = profile.targetDailyGainG;
    if (gain === null || gain === undefined) {
      issues.push({
        field: 'targetDailyGainG',
        messageAr: 'معدل النمو اليومي المستهدف مطلوب لفئات النمو والتسمين.',
      });
    } else if (!Number.isFinite(gain) || gain <= 0) {
      issues.push({
        field: 'targetDailyGainG',
        messageAr: 'معدل النمو اليومي يجب أن يكون أكبر من صفر.',
      });
    } else if (gain > 600) {
      issues.push({
        field: 'targetDailyGainG',
        messageAr: 'معدل نمو يتجاوز 600 غ/يوم غير معتاد للأغنام والماعز — يرجى التحقق.',
      });
    }
  }

  if (category === 'pregnant' && !profile.pregnancyStage) {
    issues.push({
      field: 'pregnancyStage',
      messageAr: 'مرحلة الحمل مطلوبة للأنثى الحامل.',
    });
  }

  if (category === 'lactating') {
    if (profile.dailyMilkL === null || profile.dailyMilkL === undefined) {
      issues.push({
        field: 'dailyMilkL',
        messageAr: 'كمية الحليب اليومية مطلوبة للأنثى المرضعة.',
      });
    } else if (!Number.isFinite(profile.dailyMilkL) || profile.dailyMilkL <= 0) {
      issues.push({
        field: 'dailyMilkL',
        messageAr: 'كمية الحليب اليومية يجب أن تكون أكبر من صفر.',
      });
    }
    if (profile.lactationMonth === null || profile.lactationMonth === undefined) {
      issues.push({
        field: 'lactationMonth',
        messageAr: 'شهر الرضاعة مطلوب للأنثى المرضعة.',
      });
    }
  }

  if (profile.feedingSystem !== 'grazing' && profile.feedingSystem !== 'housed' && profile.feedingSystem !== 'mixed') {
    issues.push({ field: 'feedingSystem', messageAr: 'نظام التغذية مطلوب.' });
  }

  return issues;
}

const STANDARD_PROVENANCE_NOTE =
  'قيمة عرض توضيحية غير مُتحقَّق منها من النسخة الأصلية للمرجع العلمي.';

function requirementProvenance(standard: StandardDefinition, locator: string): Provenance {
  return {
    referenceId: standard.referenceId,
    locator,
    status: standard.status === 'verified' ? 'verified_reference' : 'illustrative_demo',
    note: standard.status === 'verified' ? undefined : STANDARD_PROVENANCE_NOTE,
  };
}

function statusFor(standard: StandardDefinition): RequirementStatus {
  if (standard.status === 'incomplete') return 'incomplete';
  return standard.status;
}

/**
 * Turn a livestock profile into daily nutrient requirements.
 *
 * The function never guesses a missing animal characteristic: anything the
 * model needs but the profile does not provide becomes a blocker, and callers
 * must refuse to optimise while blockers exist.
 */
export function computeRequirements(
  profile: LivestockProfile,
  standard: StandardDefinition,
): ComputedRequirements {
  const issues = validateProfile(profile);
  const blockersAr = issues.map((i) => i.messageAr);
  const notesAr: string[] = [];

  const model = getCategoryModel(standard, profile.species, profile.category);

  const empty: ComputedRequirements = {
    profileId: profile.id,
    standardId: standard.id,
    standardVersion: standard.version,
    status: statusFor(standard),
    dryMatterIntakeKg: 0,
    energyKey: 'ufl',
    requirements: [],
    ndfMinPctDm: null,
    notesAr,
    blockersAr,
  };

  if (!model) {
    blockersAr.push(
      `لا تتوفر معاملات متطلبات غذائية لهذا المعيار للنوع «${profile.species === 'sheep' ? 'أغنام' : 'ماعز'}» والفئة «${CATEGORY_LABEL_AR[profile.category]}». لم يتم اشتقاق أي قيم بديلة.`,
    );
    return { ...empty, blockersAr };
  }

  if (standard.status === 'incomplete') {
    blockersAr.push(standard.verificationNoteAr);
    return { ...empty, blockersAr };
  }

  if (blockersAr.length > 0) {
    return { ...empty, blockersAr };
  }

  const bw = profile.liveWeightKg;
  const mbw = Math.pow(bw, 0.75);
  const gainKg = (profile.targetDailyGainG ?? 0) / 1000;
  const milkL = profile.category === 'lactating' ? (profile.dailyMilkL ?? 0) : 0;

  const dmi = Math.max(0.1, (model.dmiPctBw / 100) * bw);

  let energy = model.energyPerKgMbw * mbw;
  let pdi = model.pdiPerKgMbw * mbw;
  let ca = model.caPerKgMbw * mbw;
  let p = model.pPerKgMbw * mbw;

  if (profile.category === 'growing' || profile.category === 'fattening') {
    energy += model.energyPerKgGain * gainKg;
    pdi += model.pdiPerKgGain * gainKg;
    ca += model.caPerKgGain * gainKg;
    p += model.pPerKgGain * gainKg;
  }

  if (profile.category === 'lactating') {
    energy += model.energyPerLitreMilk * milkL;
    pdi += model.pdiPerLitreMilk * milkL;
    ca += model.caPerLitreMilk * milkL;
    p += model.pPerLitreMilk * milkL;
    if (profile.lactationMonth === null) {
      notesAr.push('لم يُحدَّد شهر الرضاعة، لذا لم يُطبَّق أي تعديل على أساس مرحلى الإدرار.');
    }
  }

  if (profile.category === 'pregnant') {
    if (profile.pregnancyStage === 'late') {
      energy *= model.latePregnancyEnergyFactor;
      pdi *= model.latePregnancyPdiFactor;
      notesAr.push('طُبِّق معامل الحمل المتأخر على الطاقة والبروتين.');
    } else if (profile.pregnancyStage === 'mid') {
      notesAr.push('لم يُطبَّق أي معامل إضافي لمرحلة الحمل المتوسطة في هذه النسخة.');
    } else {
      notesAr.push('لم يُطبَّق أي معامل إضافي لمرحلة الحمل المبكرة في هذه النسخة.');
    }
  }

  const na = model.naPerKgDm * dmi;

  const locator = `${standard.id}@${standard.version}/${profile.species}/${profile.category}`;
  const requirements: NutrientRequirement[] = [
    {
      key: model.energyUnit,
      amount: energy,
      provenance: requirementProvenance(standard, `${locator}#energy`),
    },
    {
      key: 'pdi_g',
      amount: pdi,
      provenance: requirementProvenance(standard, `${locator}#pdi`),
    },
    {
      key: 'ca_g',
      amount: ca,
      provenance: requirementProvenance(standard, `${locator}#ca`),
    },
    {
      key: 'p_g',
      amount: p,
      provenance: requirementProvenance(standard, `${locator}#p`),
    },
    {
      key: 'na_g',
      amount: na,
      provenance: requirementProvenance(standard, `${locator}#na`),
    },
  ];

  notesAr.push(
    `استهلاك المادة الجافة اليومي المستهدف محسوب كنسبة ${model.dmiPctBw}% من الوزن الحي (${dmi.toFixed(2)} كغ).`,
  );

  return {
    profileId: profile.id,
    standardId: standard.id,
    standardVersion: standard.version,
    status: statusFor(standard),
    dryMatterIntakeKg: dmi,
    energyKey: model.energyUnit,
    requirements,
    ndfMinPctDm: model.ndfMinPctDm,
    notesAr,
    blockersAr,
  };
}

/** Convenience helper used by the UI to explain a category's data needs. */
export function requiredProfileFields(category: ProductionCategory): string[] {
  const base = ['النوع', 'الوزن الحي', 'العمر', 'عدد الرؤوس', 'نظام التغذية'];
  if (category === 'growing' || category === 'fattening') return [...base, 'معدل النمو اليومي'];
  if (category === 'lactating') return [...base, 'كمية الحليب اليومية', 'شهر الرضاعة'];
  if (category === 'pregnant') return [...base, 'مرحلة الحمل'];
  return base;
}

export type { CategoryModel };
