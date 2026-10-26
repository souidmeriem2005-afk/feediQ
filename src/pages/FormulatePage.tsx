import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../state/store';
import { CATEGORY_LABEL_AR, SPECIES_LABEL_AR, STANDARDS, getStandard } from '../data/standards';
import { INGREDIENT_CATEGORY_LABEL_AR } from '../data/ingredients';
import { computeRequirements } from '../domain/requirements';
import { formulateRation, type FormulationOutcome } from '../domain/optimization/formulate';
import { ingredientReadiness } from '../domain/ingredientMath';
import { NUTRIENTS } from '../domain/nutrients';
import { formatDzd, formatNumber, formatPercent, isoDate, parseDecimal } from '../domain/units';
import type { Ingredient, NutrientKey } from '../domain/types';
import { PageHeader, Notice, EmptyState, InlineError } from '../components/ui';
import { RequirementStatusBadge } from '../components/badges';
import { CheckboxField, NumberField, SelectField, TextAreaField, TextField } from '../components/fields';
import { RationResultView } from '../components/RationResultView';
import { FlaskIcon, WarningIcon } from '../components/icons';

const FALLBACK_KEYS: NutrientKey[] = ['ufl', 'pdi_g', 'ca_g', 'p_g', 'na_g'];

export default function FormulatePage() {
  const profiles = useAppStore((state) => state.profiles);
  const ingredients = useAppStore((state) => state.ingredients);
  const settings = useAppStore((state) => state.settings);
  const saveFormulation = useAppStore((state) => state.saveFormulation);

  const [searchParams] = useSearchParams();
  const [profileId, setProfileId] = useState(() => {
    const requested = searchParams.get('profile');
    if (requested && profiles.some((item) => item.id === requested)) return requested;
    return profiles[0]?.id ?? '';
  });
  const [standardId, setStandardId] = useState(settings.defaultStandardId);
  const [targetDmText, setTargetDmText] = useState('');
  const [applyNdf, setApplyNdf] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(ingredients.map((ingredient) => ingredient.id)),
  );
  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState<FormulationOutcome | null>(null);
  const [dirty, setDirty] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [saveNotes, setSaveNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const standard = getStandard(standardId) ?? getStandard(settings.defaultStandardId) ?? STANDARDS[0];

  const requirements = useMemo(
    () => (profile && standard ? computeRequirements(profile, standard) : null),
    [profile, standard],
  );

  const requiredKeys = useMemo<NutrientKey[]>(() => {
    if (!requirements) return FALLBACK_KEYS;
    const keys: NutrientKey[] = [requirements.energyKey, 'pdi_g', 'ca_g', 'p_g', 'na_g'];
    if (requirements.ndfMinPctDm !== null) keys.push('ndf_pct');
    return keys;
  }, [requirements]);

  const readinessById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof ingredientReadiness>>();
    for (const ingredient of ingredients) {
      map.set(ingredient.id, ingredientReadiness(ingredient, requiredKeys));
    }
    return map;
  }, [ingredients, requiredKeys]);

  const selectedIngredients = ingredients.filter((ingredient) => selectedIds.has(ingredient.id));
  const readySelected = selectedIngredients.filter((ingredient) => readinessById.get(ingredient.id)?.ready);

  const filteredIngredients = ingredients.filter((ingredient) => {
    const term = search.trim();
    if (!term) return true;
    return (
      ingredient.nameAr.includes(term) ||
      (ingredient.nameEn ?? '').toLowerCase().includes(term.toLowerCase()) ||
      INGREDIENT_CATEGORY_LABEL_AR[ingredient.category].includes(term)
    );
  });

  const targetDm = targetDmText.trim() === '' ? null : parseDecimal(targetDmText);
  const targetDmError =
    targetDmText.trim() !== '' && (targetDm === null || targetDm <= 0)
      ? 'أدخل كمية مادة جافة أكبر من صفر، أو اترك الحقل فارغاً لاستخدام القيمة المحسوبة.'
      : undefined;

  const markDirty = () => {
    if (outcome) setDirty(true);
    setSaveMessage(null);
  };

  const toggleIngredient = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    markDirty();
  };

  const selectAll = () => {
    setSelectedIds(new Set(ingredients.map((ingredient) => ingredient.id)));
    markDirty();
  };

  const clearAll = () => {
    setSelectedIds(new Set());
    markDirty();
  };

  const handleRun = () => {
    setRunError(null);
    setSaveMessage(null);
    if (!profile) {
      setRunError('اختر ملف حيوان أولاً.');
      return;
    }
    if (!standard) {
      setRunError('المعيار الغذائي غير موجود.');
      return;
    }
    if (targetDmError) {
      setRunError(targetDmError);
      return;
    }
    if (selectedIngredients.length === 0) {
      setRunError('اختر مادة علفية واحدة على الأقل.');
      return;
    }
    const result = formulateRation({
      profile,
      standard,
      ingredients: selectedIngredients,
      targetDryMatterKg: targetDm,
      applyNdfConstraint: applyNdf,
    });
    setOutcome(result);
    setDirty(false);
    if (result.ok) {
      setSaveName(`عليقة ${profile.name} — ${isoDate()}`);
      setSaveNotes('');
    }
  };

  const handleSave = async () => {
    if (!outcome?.ok) return;
    if (!saveName.trim()) {
      setRunError('أدخل اسماً للعليقة قبل الحفظ.');
      return;
    }
    setSaving(true);
    setRunError(null);
    try {
      const record = await saveFormulation({
        name: saveName.trim(),
        notes: saveNotes.trim(),
        result: outcome.result,
      });
      setSaveMessage(`تم حفظ العليقة «${record.name}» محلياً.`);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'فشل حفظ العليقة.');
    } finally {
      setSaving(false);
    }
  };

  if (profiles.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="صياغة عليقة جديدة" subtitle="اختر ملف حيوان ثم الأعلاف المتاحة." />
        <EmptyState
          icon={<FlaskIcon className="h-9 w-9" />}
          title="أضف ملف حيوان أولاً"
          description="يحتاج محرك التحسين إلى الوزن والفئة الإنتاجية وعدد الرؤوس على الأقل. لا يخمّن التطبيق أي قيمة ناقصة."
          action={
            <Link to="/livestock" className="btn-primary">
              الانتقال إلى ملفات المواشي
            </Link>
          }
        />
      </div>
    );
  }

  if (!profile || !standard) {
    return (
      <div className="space-y-5">
        <PageHeader title="صياغة عليقة جديدة" />
        <Notice tone="danger" title="تعذّر تحميل بيانات الصياغة">
          <p>ملف الحيوان أو المعيار الغذائي المحدد غير موجود. أعد تحميل الصفحة أو اختر معياراً من الإعدادات.</p>
        </Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="صياغة عليقة جديدة"
        subtitle="حدّد الحيوان والأعلاف المتاحة، ثم شغّل محرك البرمجة الخطية لأقل تكلفة. كل قيد إلزامي يبقى مفروضاً؛ لا يُخفَّف تلقائياً."
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          <section className="card card-pad">
            <h2 className="section-title mb-3">1. الحيوان والمعيار</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="ملف الحيوان"
                required
                value={profile.id}
                onChange={(value) => {
                  setProfileId(value);
                  markDirty();
                }}
                options={profiles.map((item) => ({
                  value: item.id,
                  label: `${item.name} — ${item.headCount} رأس`,
                }))}
              />
              <SelectField
                label="المعيار الغذائي"
                required
                value={standard.id}
                onChange={(value) => {
                  setStandardId(value);
                  markDirty();
                }}
                options={STANDARDS.map((item) => ({
                  value: item.id,
                  label: `${item.nameAr}${item.status === 'incomplete' ? ' (غير مكتمل)' : ''}`,
                }))}
              />
              <NumberField
                label="تثبيت المادة الجافة (اختياري)"
                value={targetDmText}
                onChange={(value) => {
                  setTargetDmText(value);
                  markDirty();
                }}
                suffix="كغ/يوم"
                placeholder={
                  requirements && requirements.dryMatterIntakeKg > 0
                    ? formatNumber(requirements.dryMatterIntakeKg, 3)
                    : 'محسوبة من الوزن'
                }
                error={targetDmError}
                hint="إذا تُرك فارغاً يستخدم المحرك الكمية المحسوبة من الوزن الحي ونسبة الاستهلاك في المعيار."
              />
              <div className="flex items-end pb-1">
                <CheckboxField
                  label="تطبيق الحد الأدنى للألياف (NDF)"
                  checked={applyNdf}
                  onChange={(value) => {
                    setApplyNdf(value);
                    markDirty();
                  }}
                  hint={
                    requirements?.ndfMinPctDm === null
                      ? 'المعيار الحالي لا يحدد حداً أدنى للألياف.'
                      : requirements
                        ? `الحد الأدنى للمعيار: ${formatPercent(requirements.ndfMinPctDm, 1)} من المادة الجافة.`
                        : undefined
                  }
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-sand-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-700">
                  {SPECIES_LABEL_AR[profile.species]} · {CATEGORY_LABEL_AR[profile.category]}
                </span>
                <RequirementStatusBadge status={requirements?.status ?? 'incomplete'} />
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{standard.verificationNoteAr}</p>
            </div>

            {requirements && requirements.blockersAr.length > 0 ? (
              <div className="mt-4">
                <Notice tone="danger" title="لا يمكن تشغيل التحسين">
                  <ul className="list-inside list-disc space-y-1">
                    {requirements.blockersAr.map((blocker, index) => (
                      <li key={index}>{blocker}</li>
                    ))}
                  </ul>
                </Notice>
              </div>
            ) : requirements ? (
              <div className="mt-4 overflow-x-auto">
                <table className="data-table min-w-[34rem]">
                  <thead>
                    <tr>
                      <th>المتطلب اليومي</th>
                      <th>الكمية</th>
                      <th>الوحدة</th>
                      <th>حالة البيانات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.requirements.map((requirement) => (
                      <tr key={requirement.key}>
                        <td className="font-semibold">{NUTRIENTS[requirement.key].labelAr}</td>
                        <td className="tnum">{formatNumber(requirement.amount, NUTRIENTS[requirement.key].decimals)}</td>
                        <td className="text-xs text-slate-500">{NUTRIENTS[requirement.key].unitAr}</td>
                        <td>
                          <span className="badge bg-amber-100 text-amber-900">عرض توضيحي غير مُتحقَّق منه</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>

          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 px-4 py-3">
              <div>
                <h2 className="section-title">2. المواد العلفية المتاحة</h2>
                <p className="muted mt-0.5">
                  {selectedIngredients.length} محددة من أصل {ingredients.length}. المواد الناقصة البيانات تُستبعد من
                  التحسين ولا تُعامل كصفر.
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={selectAll}>
                  تحديد الكل
                </button>
                <button type="button" className="btn-secondary min-h-9 px-3 text-xs" onClick={clearAll}>
                  إلغاء التحديد
                </button>
              </div>
            </div>

            <div className="px-4 py-3">
              <TextField
                label="بحث في المواد العلفية"
                value={search}
                onChange={setSearch}
                placeholder="الاسم أو الفئة..."
                type="search"
              />
            </div>

            {ingredients.length === 0 ? (
              <div className="px-4 pb-4">
                <Notice tone="danger" title="قاعدة الأعلاف فارغة">
                  <p>لا توجد مواد علفية. أضف مواد من صفحة قاعدة الأعلاف ثم عد إلى هنا.</p>
                </Notice>
              </div>
            ) : filteredIngredients.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-slate-500">لا توجد نتائج مطابقة للبحث.</p>
            ) : (
              <ul className="max-h-[32rem] divide-y divide-sand-100 overflow-y-auto">
                {filteredIngredients.map((ingredient) => {
                  const readiness = readinessById.get(ingredient.id);
                  const selected = selectedIds.has(ingredient.id);
                  return (
                    <li key={ingredient.id} className={`px-4 py-3 ${selected ? 'bg-brand-50/40' : ''}`}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleIngredient(ingredient.id)}
                          className="mt-1 h-4 w-4 shrink-0 accent-brand-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-bold text-slate-900">{ingredient.nameAr}</span>
                            <span className="badge bg-sand-100 text-slate-600">
                              {INGREDIENT_CATEGORY_LABEL_AR[ingredient.category]}
                            </span>
                            {ingredient.price?.dataStatus === 'illustrative_demo' ? (
                              <span className="badge bg-violet-100 text-violet-900">سعر تجريبي</span>
                            ) : null}
                            {readiness && !readiness.ready ? (
                              <span className="badge bg-amber-100 text-amber-900" title={readiness.missingAr.join('، ')}>
                                بيانات ناقصة
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>مادة جافة: {ingredient.dryMatterPctAsFed === null ? '—' : formatPercent(ingredient.dryMatterPctAsFed, 1)}</span>
                            <span>
                              السعر: {ingredient.price ? `${formatDzd(ingredient.price.valuePerKgAsFed, 2)}/كغ AF` : '—'}
                            </span>
                            <span>
                              حد الإدراج: {formatPercent(ingredient.inclusion.minPctDM, 0)} –{' '}
                              {ingredient.inclusion.maxPctDM === null ? 'بلا حد' : formatPercent(ingredient.inclusion.maxPctDM, 0)}
                            </span>
                            {readiness && !readiness.ready ? (
                              <span className="font-semibold text-amber-700">
                                ناقص: {readiness.missingAr.join('، ')}
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {runError ? <InlineError>{runError}</InlineError> : null}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              onClick={handleRun}
              disabled={Boolean(requirements?.blockersAr.length) || selectedIngredients.length === 0}
            >
              <FlaskIcon className="h-5 w-5" /> تشغيل التحسين
            </button>
            <span className="text-xs text-slate-500">
              جاهزة للتحسين: {readySelected.length} مادة. المواد الناقصة ستُستبعد مع إشعار.
            </span>
          </div>

          {dirty && outcome ? (
            <Notice tone="warning" title="النتيجة المعروضة قديمة">
              <p>تغيّرت المدخلات بعد آخر تشغيل. أعد تشغيل التحسين لعرض نتيجة مطابقة.</p>
            </Notice>
          ) : null}

          {outcome && !outcome.ok ? (
            <div className="space-y-3">
              <Notice tone="danger" title="لم يُنتج المحرك عليقة قابلة للعرض">
                <ul className="list-inside list-disc space-y-1">
                  {outcome.messagesAr.map((message, index) => (
                    <li key={index}>{message}</li>
                  ))}
                </ul>
              </Notice>
              {outcome.detailsAr.length > 0 ? (
                <div className="card card-pad">
                  <h3 className="mb-2 text-sm font-bold text-slate-900">تفاصيل التشخيص</h3>
                  <ul className="space-y-1.5 text-xs leading-5 text-slate-600">
                    {outcome.detailsAr.map((detail, index) => (
                      <li key={index}>• {detail}</li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">
                    حالة المحرك: <span className="font-mono">{outcome.status}</span>
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {outcome?.ok ? (
            <div className="space-y-4">
              <RationResultView result={outcome.result} />

              <section className="card card-pad">
                <h2 className="section-title mb-3">حفظ العليقة</h2>
                {saveMessage ? (
                  <div className="mb-3">
                    <Notice tone="success">
                      <p>{saveMessage}</p>
                      <p className="text-xs">
                        <Link to="/saved" className="font-bold underline">
                          عرض العليق المحفوظة
                        </Link>
                      </p>
                    </Notice>
                  </div>
                ) : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="اسم العليقة"
                    required
                    value={saveName}
                    onChange={setSaveName}
                    placeholder="مثال: عليقة تسمين — نوفمبر"
                  />
                  <TextAreaField
                    label="ملاحظات"
                    value={saveNotes}
                    onChange={setSaveNotes}
                    placeholder="ظروف السوق، مصدر الأسعار، ملاحظات المختص…"
                    className="sm:col-span-2"
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
                    {saving ? 'جارٍ الحفظ…' : 'حفظ العليقة محلياً'}
                  </button>
                  <span className="text-xs text-slate-500">
                    تُحفظ لقطة الأسعار مع النتيجة، فلا تتغير الأرقام التاريخية عند تعديل الأسعار لاحقاً.
                  </span>
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          <Notice tone="demo" title="قبل التشغيل — اقرأ هذا">
            <p>
              معاملات المتطلبات في المعيار «{standard.shortNameAr}» قيم عرض توضيحية غير مستخرجة من جدول منشور،
              لذلك ستكون حالة أي نتيجة <strong>«كفاية غير مُتحقَّق منها»</strong>.
            </p>
            <p>الأسعار التجريبية تجعل التكلفة غير معبّرة عن السوق. حدّثها أولاً لدقة أعلى.</p>
          </Notice>

          <div className="card card-pad">
            <h2 className="text-sm font-bold text-slate-900">كيف يعمل المحرك؟</h2>
            <ol className="mt-2 list-inside list-decimal space-y-2 text-xs leading-5 text-slate-600">
              <li>يثبّت مجموع المادة الجافة على الهدف (معادلة تساوٍ).</li>
              <li>يقلّل مجموع (سعر كغ المادة الجافة × الكمية) لكل مادة.</li>
              <li>يفرض حداً أدنى للطاقة و PDI و Ca و P و Na، وNDF عند تفعيله.</li>
              <li>يحترم حدود الإدراج والمخزون لكل مادة.</li>
              <li>يتحقق من كل قيد مستقلاً بعد الحل؛ وأي إخلال يُلغي عرض الحل.</li>
            </ol>
          </div>

          {requirements && requirements.notesAr.length > 0 ? (
            <div className="card card-pad">
              <h2 className="text-sm font-bold text-slate-900">ملاحظات الحساب</h2>
              <ul className="mt-2 list-inside list-disc space-y-1 text-xs leading-5 text-slate-600">
                {requirements.notesAr.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {selectedIngredients.some((ingredient) => !readinessById.get(ingredient.id)?.ready) ? (
            <Notice tone="warning" title="مواد محددة ستُستبعد">
              <ul className="space-y-1 text-xs">
                {selectedIngredients
                  .filter((ingredient) => !readinessById.get(ingredient.id)?.ready)
                  .map((ingredient: Ingredient) => (
                    <li key={ingredient.id} className="flex items-start gap-1.5">
                      <WarningIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {ingredient.nameAr}: {(readinessById.get(ingredient.id)?.missingAr ?? []).join('، ')}
                      </span>
                    </li>
                  ))}
              </ul>
            </Notice>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
