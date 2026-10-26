import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../state/store';
import {
  COST_FORMULA_EXPLANATION_AR,
  costPerKgGain,
  dailyHerdCost,
  ingredientCost,
  periodCost,
} from '../domain/cost';
import { formatDzd, formatNumber, parseDecimal } from '../domain/units';
import { PageHeader, Notice, InlineError } from '../components/ui';
import { StatCard } from '../components/badges';
import { NumberField, SelectField, TextField } from '../components/fields';
import { CalculatorIcon, PlusIcon, PrintIcon, TrashIcon } from '../components/icons';

interface CalcRow {
  key: string;
  ingredientId: string;
  name: string;
  quantityText: string;
  priceText: string;
}

function newRow(): CalcRow {
  return {
    key: `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    ingredientId: '',
    name: '',
    quantityText: '',
    priceText: '',
  };
}

export default function CalculatorPage() {
  const ingredients = useAppStore((state) => state.ingredients);
  const formulations = useAppStore((state) => state.formulations);
  const [rows, setRows] = useState<CalcRow[]>([newRow()]);
  const [headText, setHeadText] = useState('10');
  const [daysText, setDaysText] = useState('30');
  const [gainText, setGainText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadedLabel, setLoadedLabel] = useState('');

  const head = parseDecimal(headText);
  const days = parseDecimal(daysText);
  const gainG = gainText.trim() === '' ? null : parseDecimal(gainText);

  const headValid = head !== null && Number.isInteger(head) && head >= 1;
  const daysValid = days !== null && Number.isInteger(days) && days >= 1;
  const gainValid = gainG === null || (gainG > 0 && Number.isFinite(gainG));

  const rowValues = rows.map((row) => {
    const quantity = parseDecimal(row.quantityText);
    const price = parseDecimal(row.priceText);
    const valid = quantity !== null && quantity >= 0 && price !== null && price >= 0;
    return {
      ...row,
      quantity: quantity ?? 0,
      price: price ?? 0,
      valid,
      cost: valid ? ingredientCost(quantity ?? 0, price ?? 0) : 0,
      hasInput: row.quantityText.trim() !== '' || row.priceText.trim() !== '',
    };
  });

  const dailyPerAnimal = rowValues.reduce((sum, row) => sum + row.cost, 0);
  const herdDaily = headValid ? dailyHerdCost(dailyPerAnimal, head) : null;
  const periodHerd = herdDaily !== null && daysValid ? periodCost(herdDaily, days) : null;
  const periodPerAnimal = daysValid && days !== null ? dailyPerAnimal * days : null;
  const gainKg =
    gainG !== null && gainG > 0 && days !== null && days > 0 ? (gainG / 1000) * days : null;
  const costPerGain =
    periodPerAnimal !== null && gainKg !== null ? costPerKgGain(periodPerAnimal, gainKg) : null;

  const updateRow = (key: string, patch: Partial<CalcRow>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  };

  const handleIngredientChange = (row: CalcRow, ingredientId: string) => {
    const ingredient = ingredients.find((item) => item.id === ingredientId);
    if (!ingredient) {
      updateRow(row.key, { ingredientId: '', name: row.name });
      return;
    }
    updateRow(row.key, {
      ingredientId,
      name: ingredient.nameAr,
      priceText: ingredient.price ? String(ingredient.price.valuePerKgAsFed) : '',
    });
    if (!ingredient.price) {
      setError(`المادة «${ingredient.nameAr}» لا تحتوي على سعر محلي بعد. أدخل السعر يدوياً أو حدّثه من قاعدة الأعلاف.`);
    } else {
      setError(null);
    }
  };

  const loadFormulation = (id: string) => {
    const formulation = formulations.find((item) => item.id === id);
    if (!formulation) {
      setLoadedLabel('');
      return;
    }
    setRows(
      formulation.result.lines.map((line) => ({
        key: `row_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        ingredientId: line.ingredientId,
        name: line.nameAr,
        quantityText: formatNumber(line.quantityKgAF, 3).replace(/,/g, ''),
        priceText: line.pricePerKgAsFed === null ? '' : String(line.pricePerKgAsFed),
      })),
    );
    setHeadText(String(formulation.result.profileSnapshot.headCount));
    setLoadedLabel(formulation.name);
    setError(null);
  };

  const validateForCalc = (): boolean => {
    if (!headValid) {
      setError('عدد الرؤوس يجب أن يكون عدداً صحيحاً أكبر من صفر.');
      return false;
    }
    if (!daysValid) {
      setError('عدد الأيام يجب أن يكون عدداً صحيحاً أكبر من صفر.');
      return false;
    }
    if (!gainValid) {
      setError('الزيادة الوزنية اليومية يجب أن تكون أكبر من صفر أو تُترك فارغة.');
      return false;
    }
    if (rowValues.some((row) => row.hasInput && !row.valid)) {
      setError('تحقق من الكميات والأسعار: يجب أن تكون أرقاماً غير سالبة.');
      return false;
    }
    if (rowValues.every((row) => !row.hasInput)) {
      setError('أضف صفاً واحداً على الأقل بكمية وسعر.');
      return false;
    }
    setError(null);
    return true;
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="حاسبة التكلفة"
        subtitle="حاسبة مستقلة عن محرك التحسين: أدخل الكميات والأسعار بنفسك لحساب تكلفة الخلطة. لا تتحقق من التوازن الغذائي ولا تضيف أي قيمة من عندها."
        actions={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                if (validateForCalc()) window.print();
              }}
            >
              <PrintIcon className="h-5 w-5" /> طباعة
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                setRows([newRow()]);
                setHeadText('10');
                setDaysText('30');
                setGainText('');
                setError(null);
                setLoadedLabel('');
              }}
            >
              مسح الحاسبة
            </button>
          </>
        }
      />

      <Notice tone="info" title="أساس الحساب">
        <p>الكميات هنا «كما هي» (as-fed) لكل حيوان في اليوم، والأسعار بالدينار الجزائري لكل كيلوغرام كما هو.</p>
        <p>لا تُقارن النتيجة تلقائياً مع أي متطلب غذائي. استخدم صفحة الصياغة للتحقق من القيود.</p>
      </Notice>

      {formulations.length > 0 ? (
        <div className="card card-pad">
          <SelectField
            label="تعبئة الصفوف من عليقة محفوظة (اختياري)"
            value=""
            onChange={loadFormulation}
            placeholder="اختر عليقة لنسخ كمياتها وأسعارها…"
            options={formulations.map((formulation) => ({
              value: formulation.id,
              label: `${formulation.name} — ${formatNumber(formulation.result.totalCostPerAnimalDay, 2)} دج/حيوان/يوم`,
            }))}
            hint="النسخ لأغراض الحساب فقط؛ لن تُعدَّل العليقة المحفوظة."
          />
          {loadedLabel ? <p className="mt-2 text-xs font-semibold text-brand-800">تم التحميل من: {loadedLabel}</p> : null}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 px-4 py-3">
              <h2 className="section-title">صفوف الخلطة</h2>
              <button
                type="button"
                className="btn-secondary min-h-9 px-3 text-xs"
                onClick={() => setRows((current) => [...current, newRow()])}
              >
                <PlusIcon className="h-4 w-4" /> إضافة صف
              </button>
            </div>

            <div className="space-y-4 p-4">
              {rows.map((row, index) => {
                const values = rowValues[index];
                const ingredient = ingredients.find((item) => item.id === row.ingredientId);
                return (
                  <div key={row.key} className="rounded-2xl border border-sand-200 p-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <SelectField
                        label={`المادة ${index + 1}`}
                        value={row.ingredientId}
                        onChange={(value) => handleIngredientChange(row, value)}
                        placeholder="مادة مخصصة / خارج القاعدة"
                        options={ingredients.map((item) => ({
                          value: item.id,
                          label: `${item.nameAr}${item.price ? ' — سعر موجود' : ' — بلا سعر'}`,
                        }))}
                      />
                      <TextField
                        label="الاسم المعروض"
                        value={row.name}
                        onChange={(value) => updateRow(row.key, { name: value })}
                        placeholder="اسم المادة في الحساب"
                      />
                      <NumberField
                        label="الكمية اليومية للحيوان"
                        value={row.quantityText}
                        onChange={(value) => updateRow(row.key, { quantityText: value })}
                        suffix="كغ AF"
                        error={values?.hasInput && !values?.valid ? 'كمية غير صالحة.' : undefined}
                      />
                      <NumberField
                        label="سعر الكيلوغرام"
                        value={row.priceText}
                        onChange={(value) => updateRow(row.key, { priceText: value })}
                        suffix="دج/كغ"
                        error={values?.hasInput && !values?.valid ? 'سعر غير صالح.' : undefined}
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-slate-500">
                        {ingredient?.price?.dataStatus === 'illustrative_demo' ? (
                          <span className="badge bg-violet-100 text-violet-900">سعر تجريبي من القاعدة</span>
                        ) : (
                          'التكلفة اليومية للحيوان'
                        )}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="font-bold tnum">{formatDzd(values?.cost ?? 0, 2)}</span>
                        <button
                          type="button"
                          className="btn-ghost min-h-8 px-2 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setRows((current) =>
                              current.length === 1 ? [newRow()] : current.filter((item) => item.key !== row.key),
                            );
                            setLoadedLabel('');
                          }}
                          aria-label={`حذف الصف ${index + 1}`}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {error ? <InlineError>{error}</InlineError> : null}

          <section className="card card-pad">
            <h2 className="section-title mb-3">بيانات القطيع والمدة</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="عدد الرؤوس" value={headText} onChange={setHeadText} suffix="رأس" />
              <NumberField label="عدد الأيام" value={daysText} onChange={setDaysText} suffix="يوم" />
              <NumberField
                label="الزيادة الوزنية اليومية (اختياري)"
                value={gainText}
                onChange={setGainText}
                suffix="غ/يوم"
                hint="تُستخدم فقط لحساب تكلفة كغ النمو إذا كانت أكبر من صفر."
              />
            </div>
            {loadedLabel ? (
              <p className="mt-3 text-xs text-slate-500">البيانات محمّلة من «{loadedLabel}» ويمكن تعديلها بحرية.</p>
            ) : null}
          </section>
        </div>

        <aside className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <StatCard label="تكلفة الحيوان اليومية" value={formatDzd(dailyPerAnimal, 2)} tone="brand" />
            <StatCard
              label="تكلفة القطيع اليومية"
              value={herdDaily === null ? '—' : formatDzd(herdDaily, 2)}
              hint={headValid ? `${formatNumber(head, 0)} رأس` : 'أدخل عدد رؤوس صالحاً'}
            />
            <StatCard
              label={`تكلفة القطيع لـ ${daysValid ? formatNumber(days, 0) : '—'} يوماً`}
              value={periodHerd === null ? '—' : formatDzd(periodHerd, 2)}
              tone="brand"
            />
            <StatCard
              label="تكلفة كغ النمو"
              value={costPerGain === null ? '—' : formatDzd(costPerGain, 2)}
              hint={
                costPerGain === null
                  ? 'تُحسب فقط عند إدخال زيادة وزن يومية أكبر من صفر.'
                  : 'تكلفة العلف ÷ الزيادة الوزنية، وليست ربحاً صافياً.'
              }
            />
          </div>

          <div className="card card-pad">
            <h2 className="text-sm font-bold text-slate-900">المعادلات المستخدمة</h2>
            <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
              <li>{COST_FORMULA_EXPLANATION_AR.dailyHerdCost}</li>
              <li>{COST_FORMULA_EXPLANATION_AR.periodCost}</li>
              <li>{COST_FORMULA_EXPLANATION_AR.costPerKgGain}</li>
            </ul>
            <Link to="/formulate" className="btn-secondary mt-4 w-full">
              <CalculatorIcon className="h-5 w-5" /> التحقق الغذائي عبر الصياغة
            </Link>
          </div>

          <Notice tone="warning" title="حدود الحاسبة">
            <p>
              هذه الحاسبة لا تمنع خلطة غير صالحة غذائياً. النتيجة اقتصادية فقط، وتعتمد كلياً على كمية وسعر
              كل صف. راجع الخلطة مع مختص قبل التطبيق.
            </p>
          </Notice>
        </aside>
      </div>
    </div>
  );
}
