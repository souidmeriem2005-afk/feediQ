import { useMemo, useState } from 'react';
import { useAppStore } from '../state/store';
import {
  INGREDIENT_CATEGORIES,
  INGREDIENT_CATEGORY_LABEL_AR,
  createEmptyIngredient,
} from '../data/ingredients';
import { DATA_STATUS_LABEL_AR, NUTRIENTS, NUTRIENT_KEYS } from '../domain/nutrients';
import { formatDateAr, formatDzd, formatNumber, formatPercent, isoDate, parseDecimal } from '../domain/units';
import type { DataStatus, Ingredient, IngredientCategory, NutrientKey } from '../domain/types';
import { PageHeader, Notice, EmptyState, InlineError } from '../components/ui';
import { DataStatusBadge } from '../components/badges';
import { NumberField, SelectField, TextAreaField, TextField } from '../components/fields';
import { Modal, ConfirmDialog } from '../components/ConfirmDialog';
import { LeafIcon, PencilIcon, PlusIcon, TrashIcon, WarningIcon } from '../components/icons';

type NutrientText = Record<NutrientKey, string>;

function toNutrientText(ingredient: Ingredient): NutrientText {
  const result = {} as NutrientText;
  for (const key of NUTRIENT_KEYS) {
    const value = ingredient.nutrients[key];
    result[key] = value === null || value === undefined ? '' : String(value);
  }
  return result;
}

function IngredientEditor({
  ingredient,
  onSaved,
}: {
  ingredient: Ingredient;
  onSaved: (message: string) => void;
}) {
  const saveIngredient = useAppStore((state) => state.saveIngredient);
  const isBuiltIn = ingredient.isBuiltIn;

  const [nameAr, setNameAr] = useState(ingredient.nameAr);
  const [nameEn, setNameEn] = useState(ingredient.nameEn ?? '');
  const [category, setCategory] = useState<IngredientCategory>(ingredient.category);
  const [dmText, setDmText] = useState(
    ingredient.dryMatterPctAsFed === null ? '' : String(ingredient.dryMatterPctAsFed),
  );
  const [priceText, setPriceText] = useState(
    ingredient.price ? String(ingredient.price.valuePerKgAsFed) : '',
  );
  const [priceDate, setPriceDate] = useState(ingredient.price?.date ?? isoDate());
  const [priceSource, setPriceSource] = useState(
    ingredient.price?.source ?? 'سعر أدخله المستخدم',
  );
  const [minText, setMinText] = useState(String(ingredient.inclusion.minPctDM));
  const [maxText, setMaxText] = useState(
    ingredient.inclusion.maxPctDM === null ? '' : String(ingredient.inclusion.maxPctDM),
  );
  const [justification, setJustification] = useState(ingredient.inclusion.justificationAr);
  const [stockText, setStockText] = useState(
    ingredient.stockKgAsFed === null || ingredient.stockKgAsFed === undefined
      ? ''
      : String(ingredient.stockKgAsFed),
  );
  const [notesAr, setNotesAr] = useState(ingredient.notesAr ?? '');
  const [dataStatus, setDataStatus] = useState<DataStatus>(
    isBuiltIn ? ingredient.dataStatus : 'user_entered',
  );
  const [nutrientText, setNutrientText] = useState<NutrientText>(() => toNutrientText(ingredient));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const setNutrient = (key: NutrientKey, value: string) => {
    setNutrientText((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    const nextErrors: Record<string, string> = {};
    if (!nameAr.trim()) nextErrors.nameAr = 'اسم المادة العلفية مطلوب.';

    const dm = dmText.trim() === '' ? null : parseDecimal(dmText);
    if (dmText.trim() !== '' && (dm === null || dm <= 0 || dm > 100)) {
      nextErrors.dm = 'نسبة المادة الجافة يجب أن تكون بين 0 و100، أو اتركها فارغة إذا كانت غير معروفة.';
    }

    const priceValue = priceText.trim() === '' ? null : parseDecimal(priceText);
    if (priceText.trim() !== '' && (priceValue === null || priceValue < 0)) {
      nextErrors.price = 'السعر يجب أن يكون رقماً غير سالب، أو اتركه فارغاً.';
    }
    if (priceValue !== null && !priceDate) nextErrors.priceDate = 'تاريخ السعر مطلوب.';
    if (priceValue !== null && !priceSource.trim()) nextErrors.priceSource = 'مصدر السعر مطلوب.';

    const min = minText.trim() === '' ? 0 : parseDecimal(minText);
    if (min === null || min < 0 || min > 100) nextErrors.min = 'الحد الأدنى يجب أن يكون بين 0 و100.';
    const max = maxText.trim() === '' ? null : parseDecimal(maxText);
    if (maxText.trim() !== '' && (max === null || max < 0 || max > 100)) {
      nextErrors.max = 'الحد الأعلى يجب أن يكون بين 0 و100، أو فارغاً.';
    }
    if (min !== null && max !== null && max < min) {
      nextErrors.max = 'الحد الأعلى لا يمكن أن يقل عن الحد الأدنى.';
    }

    const stock = stockText.trim() === '' ? null : parseDecimal(stockText);
    if (stockText.trim() !== '' && (stock === null || stock < 0)) {
      nextErrors.stock = 'المخزون يجب أن يكون رقماً غير سالب أو فارغاً.';
    }

    const nutrients: Partial<Record<NutrientKey, number | null>> = {};
    if (isBuiltIn) {
      for (const key of NUTRIENT_KEYS) nutrients[key] = ingredient.nutrients[key] ?? null;
    } else {
      for (const key of NUTRIENT_KEYS) {
        const text = nutrientText[key].trim();
        if (text === '') {
          nutrients[key] = null;
        } else {
          const value = parseDecimal(text);
          if (value === null || value < 0) {
            nextErrors[`nutrient_${key}`] = 'قيمة غير صالحة.';
            nutrients[key] = null;
          } else {
            nutrients[key] = value;
          }
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const price =
      priceValue === null
        ? null
        : {
            valuePerKgAsFed: priceValue,
            date: priceDate,
            source: priceSource.trim(),
            basis: 'AF' as const,
            dataStatus: 'user_entered' as DataStatus,
          };

    const record: Ingredient = {
      ...ingredient,
      nameAr: nameAr.trim(),
      nameEn: nameEn.trim() || undefined,
      category,
      dryMatterPctAsFed: dm,
      nutrients,
      price,
      inclusion: {
        minPctDM: min ?? 0,
        maxPctDM: max,
        justificationAr: justification.trim() || 'لم يقدّم المستخدم تبريراً لحدود الإدراج.',
      },
      stockKgAsFed: stock,
      dataStatus: isBuiltIn ? ingredient.dataStatus : dataStatus,
      provenance: isBuiltIn ? ingredient.provenance : {},
      notesAr: notesAr.trim(),
      isBuiltIn,
    };

    setBusy(true);
    try {
      await saveIngredient(record);
      onSaved(isBuiltIn ? 'تم تحديث بيانات المادة العلفية.' : 'تمت إضافة مادة علفية جديدة.');
    } catch (error) {
      setErrors({
        submit: error instanceof Error ? error.message : 'تعذّر حفظ المادة العلفية.',
      });
    } finally {
      setBusy(false);
    }
  };

  const groupedKeys: Array<{ group: string; keys: NutrientKey[] }> = [
    { group: 'الطاقة والبروتين', keys: ['ufl', 'ufv', 'me_mj', 'ne_l_mj', 'pdi_g', 'pdia_g', 'cp_pct', 'rpb_g'] },
    { group: 'الألياف والكربوهيدرات', keys: ['cf_pct', 'ndf_pct', 'adf_pct', 'starch_pct', 'fat_pct', 'ash_pct'] },
    { group: 'المعادن', keys: ['ca_g', 'p_g', 'na_g', 'mg_g', 's_g', 'cl_g'] },
    { group: 'أخرى', keys: ['fill_unit'] },
  ];

  return (
    <div className="space-y-5">
      {isBuiltIn ? (
        <Notice tone="info" title="مادة من الكتالوج المرجعي">
          <p>
            قيم التركيب الغذائي محفوظة كما وردت في الجدول المرجعي ولا يمكن تعديلها من هنا. يمكنك تحديث السعر
            والمخزون وحدود الإدراج. عند حفظ سعر جديد سيُصنَّف السعر كبيانات أدخلها المستخدم.
          </p>
        </Notice>
      ) : (
        <Notice tone="warning" title="بيانات يدوية">
          <p>
            هذه المادة ستُحفظ كبيانات أدخلها المستخدم. لا يتحقق التطبيق من صحتها، وأي نقص في القيم يمنع
            استخدامها في التحسين بدلاً من اعتباره صفراً. تُستخدم وحدات المادة الجافة.
          </p>
        </Notice>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="الاسم بالعربية" required value={nameAr} onChange={setNameAr} error={errors.nameAr} />
        <TextField label="الاسم بالإنجليزية (اختياري)" value={nameEn} onChange={setNameEn} />
        <SelectField
          label="الفئة"
          required
          value={category}
          onChange={(value) => setCategory(value as IngredientCategory)}
          options={INGREDIENT_CATEGORIES.map((item) => ({
            value: item,
            label: INGREDIENT_CATEGORY_LABEL_AR[item],
          }))}
        />
        <NumberField
          label="المادة الجافة كما هي"
          value={dmText}
          onChange={setDmText}
          suffix="%"
          error={errors.dm}
          disabled={isBuiltIn}
          hint="النسبة المئوية في المنتج كما يُقدَّم للحيوان."
        />
        <NumberField
          label="السعر"
          value={priceText}
          onChange={setPriceText}
          suffix="دج/كغ AF"
          error={errors.price}
          hint="سعر الكيلوغرام كما هو (أس-fed)، وليس على أساس المادة الجافة."
        />
        <TextField
          label="تاريخ السعر"
          type="date"
          value={priceDate}
          onChange={setPriceDate}
          error={errors.priceDate}
        />
        <TextField
          label="مصدر السعر"
          value={priceSource}
          onChange={setPriceSource}
          error={errors.priceSource}
          hint="مثال: سوق محلي، مورد، تعاونية."
        />
        <NumberField
          label="المخزون المتاح (اختياري)"
          value={stockText}
          onChange={setStockText}
          suffix="كغ AF"
          error={errors.stock}
          hint="إذا أُدخل، يصبح المخزون حداً أعلى إضافياً في التحسين."
        />
        <NumberField label="الحد الأدنى للإدراج" value={minText} onChange={setMinText} suffix="% م.ج" error={errors.min} />
        <NumberField label="الحد الأعلى للإدراج" value={maxText} onChange={setMaxText} suffix="% م.ج" error={errors.max} hint="اتركه فارغاً لعدم وضع حد أعلى." />
      </div>

      <TextAreaField
        label="تبرير حدود الإدراج"
        value={justification}
        onChange={setJustification}
        hint="ما سبب هذه الحدود؟ هل تستند إلى مرجع أم إلى ممارسة عملية؟"
      />

      <div className="rounded-xl border border-sand-200 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">قيم التركيب (على أساس المادة الجافة)</h3>
          <span className="text-xs text-slate-500">اترك الحقل فارغاً إذا كانت القيمة غير معروفة.</span>
        </div>
        <div className="space-y-5">
          {groupedKeys.map(({ group, keys }) => (
            <div key={group}>
              <h4 className="mb-2 text-xs font-extrabold text-brand-800">{group}</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {keys.map((key) => (
                  <NumberField
                    key={key}
                    label={`${NUTRIENTS[key].shortLabelAr} — ${NUTRIENTS[key].labelAr}`}
                    value={nutrientText[key]}
                    onChange={(value) => setNutrient(key, value)}
                    hint={NUTRIENTS[key].unitAr}
                    error={errors[`nutrient_${key}`]}
                    disabled={isBuiltIn}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {!isBuiltIn ? (
          <SelectField
            label="حالة البيانات"
            value={dataStatus}
            onChange={(value) => setDataStatus(value as DataStatus)}
            options={[
              { value: 'user_entered', label: DATA_STATUS_LABEL_AR.user_entered },
              { value: 'laboratory_measured', label: DATA_STATUS_LABEL_AR.laboratory_measured },
              { value: 'reference_requires_confirmation', label: DATA_STATUS_LABEL_AR.reference_requires_confirmation },
              { value: 'unknown', label: DATA_STATUS_LABEL_AR.unknown },
            ]}
            hint="لا تختار «مُتحقَّق منه» إلا إذا كان لديك مصدر موثّق فعلاً."
          />
        ) : (
          <div className="flex items-end pb-2">
            <DataStatusBadge status={ingredient.dataStatus} />
          </div>
        )}
        <TextAreaField label="ملاحظات" value={notesAr} onChange={setNotesAr} />
      </div>

      {errors.submit ? <InlineError>{errors.submit}</InlineError> : null}

      <div className="flex justify-end gap-2 border-t border-sand-200 pt-4">
        <button type="button" className="btn-primary" onClick={() => void handleSubmit()} disabled={busy}>
          {busy ? 'جارٍ الحفظ…' : 'حفظ المادة العلفية'}
        </button>
      </div>

      {isBuiltIn && ingredient.provenance.composition ? (
        <p className="text-xs leading-5 text-slate-500">
          المصدر: {ingredient.provenance.composition.referenceId} — {ingredient.provenance.composition.locator}
          {ingredient.provenance.composition.verifiedOn
            ? ` · تم التحقق في ${formatDateAr(ingredient.provenance.composition.verifiedOn)}`
            : ''}
        </p>
      ) : null}
    </div>
  );
}

export default function IngredientsPage() {
  const ingredients = useAppStore((state) => state.ingredients);
  const deleteIngredient = useAppStore((state) => state.deleteIngredient);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return ingredients.filter((ingredient) => {
      if (category && ingredient.category !== category) return false;
      if (!term) return true;
      return (
        ingredient.nameAr.includes(term) ||
        (ingredient.nameEn ?? '').toLowerCase().includes(term) ||
        INGREDIENT_CATEGORY_LABEL_AR[ingredient.category].includes(term)
      );
    });
  }, [ingredients, search, category]);

  const missingDataCount = ingredients.filter((ingredient) =>
    NUTRIENT_KEYS.some((key) => ingredient.nutrients[key] === null || ingredient.nutrients[key] === undefined),
  ).length;

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await deleteIngredient(deleting.id);
      setMessage(`تم حذف «${deleting.nameAr}» من قاعدة الأعلاف.`);
      setDeleting(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حذف المادة العلفية.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="قاعدة الأعلاف"
        subtitle="قيم التركيب الغذائي مأخوذة من جداول INRAE-CIRAD-AFZ المنشورة. الأسعار المضمّنة عرض توضيحي ويجب استبدالها بأسعار السوق المحلي."
        actions={
          <button type="button" className="btn-primary" onClick={() => setEditing(createEmptyIngredient())}>
            <PlusIcon className="h-5 w-5" /> إضافة مادة علفية
          </button>
        }
      />

      {message ? (
        <Notice tone="success">
          <p>{message}</p>
        </Notice>
      ) : null}
      {error ? <InlineError>{error}</InlineError> : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500">إجمالي المواد</p>
          <p className="mt-1 text-2xl font-extrabold tnum">{ingredients.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500">تركيب مرجعي موثّق</p>
          <p className="mt-1 text-2xl font-extrabold tnum text-brand-800">
            {ingredients.filter((ingredient) => ingredient.dataStatus === 'verified_reference').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500">أسعار تجريبية</p>
          <p className="mt-1 text-2xl font-extrabold tnum text-violet-800">
            {ingredients.filter((ingredient) => ingredient.price?.dataStatus === 'illustrative_demo').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs font-semibold text-slate-500">تحتوي قيماً ناقصة</p>
          <p className="mt-1 text-2xl font-extrabold tnum text-amber-800">{missingDataCount}</p>
        </div>
      </div>

      <Notice tone="warning" title="قبل الاعتماد على أي حساب">
        <p>
          القيم المنشورة متوسطات مرجعية وليست تحليلاً لدفعتك. استبدل الأسعار، واستخدم تحليل المخبر عند
          توفره. حدود الإدراج الافتراضية عملية احترازية وليست من معيار موثّق.
        </p>
      </Notice>

      <section className="card">
        <div className="grid gap-3 border-b border-sand-200 p-4 sm:grid-cols-[1fr_16rem]">
          <TextField label="بحث" type="search" value={search} onChange={setSearch} placeholder="اسم المادة أو الفئة…" />
          <SelectField
            label="تصفية بالفئة"
            value={category}
            onChange={setCategory}
            options={[{ value: '', label: 'كل الفئات' }, ...INGREDIENT_CATEGORIES.map((item) => ({ value: item, label: INGREDIENT_CATEGORY_LABEL_AR[item] }))]}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<LeafIcon className="h-8 w-8" />}
              title="لا توجد مواد مطابقة"
              description="غيّر كلمة البحث أو الفئة، أو أضف مادة علفية جديدة."
            />
          </div>
        ) : (
          <div className="table-wrap px-4 pb-2">
            <table className="data-table min-w-[60rem]">
              <thead>
                <tr>
                  <th>المادة العلفية</th>
                  <th>الفئة</th>
                  <th>مادة جافة</th>
                  <th>السعر</th>
                  <th>حالة التركيب</th>
                  <th>حدود الإدراج</th>
                  <th>المخزون</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ingredient) => (
                  <tr key={ingredient.id}>
                    <td>
                      <p className="font-semibold text-slate-900">{ingredient.nameAr}</p>
                      <p className="text-xs text-slate-500">
                        {ingredient.nameEn ?? '—'}
                        {ingredient.isBuiltIn ? ' · كتالوج' : ' · مادة المستخدم'}
                      </p>
                    </td>
                    <td className="text-xs">{INGREDIENT_CATEGORY_LABEL_AR[ingredient.category]}</td>
                    <td className="tnum">
                      {ingredient.dryMatterPctAsFed === null ? '—' : formatPercent(ingredient.dryMatterPctAsFed, 1)}
                    </td>
                    <td>
                      {ingredient.price ? (
                        <div>
                          <p className="tnum font-semibold">{formatDzd(ingredient.price.valuePerKgAsFed, 2)}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatDateAr(ingredient.price.date)}
                          </p>
                          <DataStatusBadge status={ingredient.price.dataStatus} />
                        </div>
                      ) : (
                        <span className="badge bg-red-100 text-red-900">لا يوجد سعر</span>
                      )}
                    </td>
                    <td>
                      <DataStatusBadge status={ingredient.dataStatus} />
                    </td>
                    <td className="tnum text-xs">
                      {formatPercent(ingredient.inclusion.minPctDM, 0)} –{' '}
                      {ingredient.inclusion.maxPctDM === null
                        ? 'بلا حد'
                        : formatPercent(ingredient.inclusion.maxPctDM, 0)}
                    </td>
                    <td className="tnum text-xs">
                      {ingredient.stockKgAsFed === null || ingredient.stockKgAsFed === undefined
                        ? '—'
                        : `${formatNumber(ingredient.stockKgAsFed, 1)} كغ`}
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn-ghost min-h-9 px-2"
                          onClick={() => setEditing(ingredient)}
                          aria-label={`تعديل ${ingredient.nameAr}`}
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost min-h-9 px-2 text-red-700 hover:bg-red-50"
                          onClick={() => setDeleting(ingredient)}
                          aria-label={`حذف ${ingredient.nameAr}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={editing !== null}
        title={editing?.isBuiltIn ? `تعديل: ${editing.nameAr}` : 'إضافة مادة علفية'}
        onClose={() => setEditing(null)}
        wide
      >
        {editing ? (
          <IngredientEditor
            key={editing.id || 'new'}
            ingredient={editing}
            onSaved={(savedMessage) => {
              setMessage(savedMessage);
              setEditing(null);
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="حذف مادة علفية"
        description={
          <span>
            سيتم حذف «{deleting?.nameAr}» نهائياً من قاعدة الأعلاف المحلية. العليق المحفوظة تحتفظ بلقطتها
            الخاصة، لكن المادة لن تكون متاحة للصياغات الجديدة.
            {deleting?.isBuiltIn ? ' هذه مادة من الكتالوج المرجعي المضمّن.' : ''}
          </span>
        }
        confirmLabel="حذف نهائي"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      >
        <p className="flex items-center gap-2 text-xs font-semibold text-red-700">
          <WarningIcon className="h-4 w-4" /> لا يمكن استرجاعها إلا من نسخة احتياطية.
        </p>
      </ConfirmDialog>
    </div>
  );
}
