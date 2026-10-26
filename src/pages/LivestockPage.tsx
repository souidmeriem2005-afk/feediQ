import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../state/store';
import {
  CATEGORY_LABEL_AR,
  SPECIES_LABEL_AR,
  getStandard,
} from '../data/standards';
import { computeRequirements, validateProfile } from '../domain/requirements';
import { NUTRIENTS } from '../domain/nutrients';
import { formatNumber, parseDecimal } from '../domain/units';
import type {
  FeedingSystem,
  LivestockProfile,
  PregnancyStage,
  ProductionCategory,
  Species,
} from '../domain/types';
import { PageHeader, Notice, EmptyState, InlineError } from '../components/ui';
import { RequirementStatusBadge } from '../components/badges';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/fields';
import { Modal, ConfirmDialog } from '../components/ConfirmDialog';
import { LivestockIcon, PencilIcon, PlusIcon, TrashIcon, WarningIcon } from '../components/icons';

const CATEGORIES: ProductionCategory[] = [
  'maintenance',
  'growing',
  'fattening',
  'pregnant',
  'lactating',
  'breeding_male',
];

function emptyProfile(): LivestockProfile {
  const now = new Date().toISOString();
  return {
    id: '',
    name: '',
    species: 'sheep',
    category: 'fattening',
    ageMonths: 6,
    liveWeightKg: 30,
    targetDailyGainG: 200,
    headCount: 1,
    pregnancyStage: null,
    lactationMonth: null,
    dailyMilkL: null,
    feedingSystem: 'mixed',
    breed: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
  };
}

function ProfileEditor({
  profile,
  onSaved,
}: {
  profile: LivestockProfile;
  onSaved: (message: string) => void;
}) {
  const saveProfile = useAppStore((state) => state.saveProfile);
  const [name, setName] = useState(profile.name);
  const [species, setSpecies] = useState<Species>(profile.species);
  const [category, setCategory] = useState<ProductionCategory>(profile.category);
  const [ageText, setAgeText] = useState(String(profile.ageMonths));
  const [weightText, setWeightText] = useState(String(profile.liveWeightKg));
  const [gainText, setGainText] = useState(
    profile.targetDailyGainG === null ? '' : String(profile.targetDailyGainG),
  );
  const [headText, setHeadText] = useState(String(profile.headCount));
  const [pregnancyStage, setPregnancyStage] = useState<PregnancyStage | ''>(profile.pregnancyStage ?? '');
  const [lactationMonthText, setLactationMonthText] = useState(
    profile.lactationMonth === null ? '' : String(profile.lactationMonth),
  );
  const [milkText, setMilkText] = useState(profile.dailyMilkL === null ? '' : String(profile.dailyMilkL));
  const [feedingSystem, setFeedingSystem] = useState<FeedingSystem>(profile.feedingSystem);
  const [breed, setBreed] = useState(profile.breed ?? '');
  const [notes, setNotes] = useState(profile.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const candidate: LivestockProfile = {
      ...profile,
      name: name.trim(),
      species,
      category,
      ageMonths: parseDecimal(ageText) ?? Number.NaN,
      liveWeightKg: parseDecimal(weightText) ?? Number.NaN,
      targetDailyGainG: gainText.trim() === '' ? null : parseDecimal(gainText),
      headCount: parseDecimal(headText) ?? Number.NaN,
      pregnancyStage: pregnancyStage === '' ? null : pregnancyStage,
      lactationMonth: lactationMonthText.trim() === '' ? null : parseDecimal(lactationMonthText),
      dailyMilkL: milkText.trim() === '' ? null : parseDecimal(milkText),
      feedingSystem,
      breed: breed.trim(),
      notes: notes.trim(),
    };

    const nextErrors: Record<string, string> = {};
    if (!candidate.name) nextErrors.name = 'اسم الملف مطلوب لتمييزه في القائمة.';
    for (const issue of validateProfile(candidate)) {
      if (!nextErrors[issue.field]) nextErrors[issue.field] = issue.messageAr;
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    try {
      await saveProfile(candidate);
      onSaved('تم حفظ ملف الحيوان.');
    } catch (error) {
      setErrors({ submit: error instanceof Error ? error.message : 'تعذّر حفظ ملف الحيوان.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Notice tone="info" title="بيانات يدخلها المستخدم">
        <p>
          هذه بياناتك المحلية. لا يتحقق التطبيق من دقتها، ولا يخمّن أي قيمة ناقصة. توفر الحقول المطلوبة شرط
          لازم لحساب المتطلبات.
        </p>
      </Notice>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="اسم الملف" required value={name} onChange={setName} error={errors.name} placeholder="مثال: حملان تسمين — الدفعة 2" />
        <SelectField
          label="النوع"
          required
          value={species}
          onChange={(value) => setSpecies(value as Species)}
          options={[
            { value: 'sheep', label: SPECIES_LABEL_AR.sheep },
            { value: 'goat', label: SPECIES_LABEL_AR.goat },
          ]}
        />
        <SelectField
          label="الفئة الإنتاجية"
          required
          value={category}
          onChange={(value) => setCategory(value as ProductionCategory)}
          options={CATEGORIES.map((item) => ({ value: item, label: CATEGORY_LABEL_AR[item] }))}
        />
        <NumberField label="العمر" value={ageText} onChange={setAgeText} suffix="شهر" error={errors.ageMonths} />
        <NumberField label="الوزن الحي" value={weightText} onChange={setWeightText} suffix="كغ" error={errors.liveWeightKg} />
        <NumberField label="عدد الرؤوس" value={headText} onChange={setHeadText} suffix="رأس" error={errors.headCount} />
        {category === 'growing' || category === 'fattening' ? (
          <NumberField
            label="معدل النمو اليومي المستهدف"
            value={gainText}
            onChange={setGainText}
            suffix="غ/يوم"
            error={errors.targetDailyGainG}
            hint="قيمة مستهدفة يدخلها المستخدم، وليست تنبؤاً."
          />
        ) : null}
        {category === 'pregnant' ? (
          <SelectField
            label="مرحلة الحمل"
            required
            value={pregnancyStage}
            onChange={(value) => setPregnancyStage(value as PregnancyStage | '')}
            options={[
              { value: '', label: 'اختر…' },
              { value: 'early', label: 'مبكر' },
              { value: 'mid', label: 'متوسط' },
              { value: 'late', label: 'متأخر' },
            ]}
            error={errors.pregnancyStage}
          />
        ) : null}
        {category === 'lactating' ? (
          <>
            <NumberField
              label="شهر الرضاعة"
              value={lactationMonthText}
              onChange={setLactationMonthText}
              suffix="شهر"
              error={errors.lactationMonth}
            />
            <NumberField
              label="إنتاج الحليب اليومي"
              value={milkText}
              onChange={setMilkText}
              suffix="لتر"
              error={errors.dailyMilkL}
            />
          </>
        ) : null}
        <SelectField
          label="نظام التغذية"
          required
          value={feedingSystem}
          onChange={(value) => setFeedingSystem(value as FeedingSystem)}
          options={[
            { value: 'housed', label: 'مربّى في الحظيرة' },
            { value: 'grazing', label: 'رعي' },
            { value: 'mixed', label: 'مختلط (رعي + تغذية مكمّلة)' },
          ]}
          error={errors.feedingSystem}
        />
        <TextField label="السلالة (اختياري)" value={breed} onChange={setBreed} />
      </div>

      <TextAreaField label="ملاحظات" value={notes} onChange={setNotes} />

      {errors.submit ? <InlineError>{errors.submit}</InlineError> : null}

      <div className="flex justify-end border-t border-sand-200 pt-4">
        <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={busy}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ ملف الحيوان'}
        </button>
      </div>
    </div>
  );
}

export default function LivestockPage() {
  const profiles = useAppStore((state) => state.profiles);
  const settings = useAppStore((state) => state.settings);
  const deleteProfile = useAppStore((state) => state.deleteProfile);
  const [editing, setEditing] = useState<LivestockProfile | null>(null);
  const [deleting, setDeleting] = useState<LivestockProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const standard = getStandard(settings.defaultStandardId);
  const totalHeads = profiles.reduce((sum, profile) => sum + profile.headCount, 0);

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await deleteProfile(deleting.id);
      setMessage(`تم حذف ملف «${deleting.name}».`);
      setDeleting(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حذف الملف.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="مواشيّ"
        subtitle="ملفات الحيوانات أو مجموعات القطيع المحلية. تُستخدم هذه البيانات لحساب المتطلبات الغذائية اليومية."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing(emptyProfile())}>
            <PlusIcon className="h-5 w-5" /> إضافة ملف حيوان
          </button>
        }
      />

      {message ? (
        <Notice tone="success">
          <p>{message}</p>
        </Notice>
      ) : null}
      {error ? <InlineError>{error}</InlineError> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500">عدد الملفات</p>
          <p className="mt-1 text-2xl font-extrabold tnum">{profiles.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500">إجمالي الرؤوس</p>
          <p className="mt-1 text-2xl font-extrabold tnum">{totalHeads}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500">المعيار المستخدم</p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <span className="text-sm font-bold">{standard ? standard.shortNameAr : '—'}</span>
            {standard ? <RequirementStatusBadge status={standard.status} /> : null}
          </div>
        </div>
      </div>

      {profiles.length === 0 ? (
        <EmptyState
          icon={<LivestockIcon className="h-9 w-9" />}
          title="لا توجد ملفات مواشٍ"
          description="أضف ملفاً واحداً على الأقل للبدء في حساب المتطلبات وصياغة العليق."
          action={
            <button type="button" className="btn-primary" onClick={() => setEditing(emptyProfile())}>
              إضافة أول ملف
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {profiles.map((profile) => {
            const requirements = standard ? computeRequirements(profile, standard) : null;
            return (
              <article key={profile.id} className="card card-pad">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-slate-900">{profile.name}</h2>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {SPECIES_LABEL_AR[profile.species]} · {CATEGORY_LABEL_AR[profile.category]}
                      {profile.breed ? ` · ${profile.breed}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn-ghost min-h-9 px-2"
                      onClick={() => setEditing(profile)}
                      aria-label={`تعديل ${profile.name}`}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="btn-ghost min-h-9 px-2 text-red-700 hover:bg-red-50"
                      onClick={() => setDeleting(profile)}
                      aria-label={`حذف ${profile.name}`}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-2 gap-x-4 text-sm">
                  <div className="border-b border-sand-100 py-1.5">
                    <dt className="text-xs text-slate-500">الوزن الحي</dt>
                    <dd className="font-semibold tnum">{formatNumber(profile.liveWeightKg, 1)} كغ</dd>
                  </div>
                  <div className="border-b border-sand-100 py-1.5">
                    <dt className="text-xs text-slate-500">عدد الرؤوس</dt>
                    <dd className="font-semibold tnum">{profile.headCount}</dd>
                  </div>
                  <div className="border-b border-sand-100 py-1.5">
                    <dt className="text-xs text-slate-500">العمر</dt>
                    <dd className="font-semibold tnum">{profile.ageMonths} شهر</dd>
                  </div>
                  <div className="border-b border-sand-100 py-1.5">
                    <dt className="text-xs text-slate-500">نظام التغذية</dt>
                    <dd className="font-semibold">
                      {profile.feedingSystem === 'housed'
                        ? 'حظيرة'
                        : profile.feedingSystem === 'grazing'
                          ? 'رعي'
                          : 'مختلط'}
                    </dd>
                  </div>
                  {(profile.category === 'growing' || profile.category === 'fattening') && (
                    <div className="border-b border-sand-100 py-1.5">
                      <dt className="text-xs text-slate-500">النمو المستهدف</dt>
                      <dd className="font-semibold tnum">
                        {profile.targetDailyGainG === null ? '—' : `${profile.targetDailyGainG} غ/يوم`}
                      </dd>
                    </div>
                  )}
                  {profile.category === 'lactating' && (
                    <div className="border-b border-sand-100 py-1.5">
                      <dt className="text-xs text-slate-500">إنتاج الحليب</dt>
                      <dd className="font-semibold tnum">
                        {profile.dailyMilkL === null ? '—' : `${profile.dailyMilkL} لتر/يوم`}
                      </dd>
                    </div>
                  )}
                </dl>

                <div className="mt-3 rounded-xl bg-sand-50 p-3">
                  {requirements && requirements.blockersAr.length === 0 ? (
                    <>
                      <p className="text-xs font-bold text-slate-700">
                        متطلبات محسوبة بالمعيار {standard?.shortNameAr}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span>
                          مادة جافة: <strong className="tnum">{formatNumber(requirements.dryMatterIntakeKg, 2)} كغ/يوم</strong>
                        </span>
                        {requirements.requirements.slice(0, 3).map((requirement) => (
                          <span key={requirement.key}>
                            {NUTRIENTS[requirement.key].shortLabelAr}:{' '}
                            <strong className="tnum">
                              {formatNumber(requirement.amount, NUTRIENTS[requirement.key].decimals)}
                            </strong>{' '}
                            {NUTRIENTS[requirement.key].unitAr}
                          </span>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-amber-700">
                        القيم توضيحية غير مُتحقَّق منها — لا تُستخدم كأساس تغذية حقيقي.
                      </p>
                    </>
                  ) : (
                    <div className="flex items-start gap-2 text-xs text-red-700">
                      <WarningIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <p className="font-bold">لا يمكن حساب المتطلبات</p>
                        <ul className="mt-1 list-inside list-disc space-y-0.5">
                          {(requirements?.blockersAr ?? ['المعيار غير متوفر.']).map((blocker, index) => (
                            <li key={index}>{blocker}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link to={`/formulate?profile=${profile.id}`} className="btn-secondary min-h-9 px-3 text-xs">
                    صياغة عليقة لهذا الملف
                  </Link>
                  <span className="text-[11px] text-slate-400">
                    حدّث الوزن قبل كل دورة؛ الأرقام لا تتحدث تلقائياً.
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal
        open={editing !== null}
        title={editing?.id ? `تعديل: ${editing.name}` : 'إضافة ملف حيوان'}
        onClose={() => setEditing(null)}
        wide
      >
        {editing ? (
          <ProfileEditor
            key={editing.id || 'new'}
            profile={editing}
            onSaved={(savedMessage) => {
              setMessage(savedMessage);
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="حذف ملف حيوان"
        description={
          <span>
            سيتم حذف ملف «{deleting?.name}» نهائياً. العليق المحفوظة ستبقى مع لقطة بياناتها الأصلية، لكن لا
            يمكن استخدام هذا الملف في صياغات جديدة.
          </span>
        }
        confirmLabel="حذف الملف"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
