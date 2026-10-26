import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '../state/store';
import { formatDateAr, formatDzd, formatNumber } from '../domain/units';
import { NUTRIENTS } from '../domain/nutrients';
import type { NutrientKey, SavedFormulation } from '../domain/types';
import { PageHeader, Notice, EmptyState } from '../components/ui';
import { OptimizationStatusBadge } from '../components/badges';
import { ChartIcon, FlaskIcon } from '../components/icons';

const MAX_COMPARE = 4;

const COMPARISON_NUTRIENTS: NutrientKey[] = ['ufl', 'ufv', 'pdi_g', 'ca_g', 'p_g', 'na_g', 'ndf_pct', 'cp_pct'];

function checkValue(formulation: SavedFormulation, key: NutrientKey): number | null {
  const check = formulation.result.checks.find((item) => item.key === key);
  if (check) return check.actual;
  const total = formulation.result.nutrientTotals[key];
  if (total === undefined) return null;
  if (key === 'ndf_pct' || key === 'cp_pct' || key === 'cf_pct' || key === 'adf_pct' || key === 'starch_pct') {
    return formulation.result.totalDmKg > 0 ? total / formulation.result.totalDmKg : null;
  }
  return total;
}

export default function ComparePage() {
  const formulations = useAppStore((state) => state.formulations);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(formulations.slice(0, 2).map((item) => item.id)),
  );

  const selected = formulations
    .filter((formulation) => selectedIds.has(formulation.id))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const toggle = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_COMPARE) next.add(id);
      return next;
    });
  };

  const chartData = selected.map((formulation) => ({
    name: formulation.name.length > 18 ? `${formulation.name.slice(0, 18)}…` : formulation.name,
    animal: Number(formulation.result.totalCostPerAnimalDay.toFixed(2)),
    herd: Number(formulation.result.totalCostHerdDay.toFixed(2)),
  }));

  const ingredientNames = Array.from(
    new Set(selected.flatMap((formulation) => formulation.result.lines.map((line) => line.nameAr))),
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="المقارنة"
        subtitle="قارن حتى أربع عليق محفوظة اقتصادياً وتغذوياً. المقارنة لا تعني أن أي عليقة «متوازنة»؛ راجع حالة كل نتيجة."
      />

      <Notice tone="warning" title="كيف تقرأ هذه المقارنة">
        <p>
          كل الأرقام مأخوذة من لقطة محفوظة وقت الصياغة. اختلاف الأسعار بين العليق قد يعود إلى تواريخ أسعار
          مختلفة وليس إلى جودة الخلطة. تحقق من تاريخ السعر قبل الاستنتاج.
        </p>
      </Notice>

      {formulations.length === 0 ? (
        <EmptyState
          icon={<ChartIcon className="h-9 w-9" />}
          title="لا توجد عليق للمقارنة"
          description="احفظ عليقتين على الأقل من صفحة الصياغة ثم عد إلى هنا."
          action={
            <Link to="/formulate" className="btn-primary">
              <FlaskIcon className="h-5 w-5" /> صياغة عليقة
            </Link>
          }
        />
      ) : (
        <>
          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand-200 px-4 py-3">
              <h2 className="section-title">اختر العليق</h2>
              <span className="text-xs text-slate-500">
                {selected.length} / {MAX_COMPARE} محددة
              </span>
            </div>
            <ul className="divide-y divide-sand-100">
              {formulations.map((formulation) => {
                const checked = selectedIds.has(formulation.id);
                const disabled = !checked && selectedIds.size >= MAX_COMPARE;
                return (
                  <li key={formulation.id} className={`px-4 py-3 ${checked ? 'bg-brand-50/40' : ''}`}>
                    <label className={`flex items-start gap-3 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(formulation.id)}
                        disabled={disabled}
                        className="mt-1 h-4 w-4 shrink-0 accent-brand-700"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{formulation.name}</span>
                          <OptimizationStatusBadge status={formulation.result.status} />
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {formatDateAr(formulation.createdAt.slice(0, 10))} · {formulation.result.profileSnapshot.name} ·{' '}
                          {formatDzd(formulation.result.totalCostPerAnimalDay, 2)}/حيوان/يوم
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          {selected.length === 0 ? (
            <Notice tone="info">
              <p>حدد عليقة واحدة على الأقل لعرض المقارنة.</p>
            </Notice>
          ) : (
            <>
              <section className="card">
                <div className="border-b border-sand-200 px-4 py-3">
                  <h2 className="section-title">مؤشرات التكلفة</h2>
                  <p className="muted mt-0.5">بالدينار الجزائري. المحور الأفقي أسماء العليق.</p>
                </div>
                <div className="h-80 w-full p-4" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ece2cc" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={60} />
                      <YAxis tick={{ fontSize: 11 }} width={60} />
                      <Tooltip contentStyle={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl' }} />
                      <Legend wrapperStyle={{ fontFamily: 'Cairo, sans-serif', fontSize: 12 }} />
                      <Bar dataKey="animal" name="تكلفة/حيوان/يوم" fill="#15803d" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="herd" name="تكلفة القطيع/يوم" fill="#bd9d6a" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="card">
                <div className="border-b border-sand-200 px-4 py-3">
                  <h2 className="section-title">الجدول التفصيلي</h2>
                </div>
                <div className="table-wrap px-4 pb-2">
                  <table className="data-table min-w-[44rem]">
                    <thead>
                      <tr>
                        <th>المؤشر</th>
                        {selected.map((formulation) => (
                          <th key={formulation.id}>{formulation.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="font-semibold">الحالة</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id}>
                            <OptimizationStatusBadge status={formulation.result.status} />
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">تاريخ الحساب</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id}>{formatDateAr(formulation.createdAt.slice(0, 10))}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">الملف</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id}>{formulation.result.profileSnapshot.name}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">مادة جافة (كغ/يوم)</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id} className="tnum">
                            {formatNumber(formulation.result.totalDmKg, 3)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">كمية كما هي (كغ/يوم)</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id} className="tnum">
                            {formatNumber(formulation.result.totalAfKg, 3)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">تكلفة/حيوان/يوم</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id} className="tnum font-bold text-brand-800">
                            {formatDzd(formulation.result.totalCostPerAnimalDay, 2)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">تكلفة/قطيع/يوم</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id} className="tnum">
                            {formatDzd(formulation.result.totalCostHerdDay, 2)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">تكلفة كغ المادة الجافة</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id} className="tnum">
                            {formatDzd(formulation.result.costPerKgDm, 2)}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="font-semibold">عدد المكوّنات</td>
                        {selected.map((formulation) => (
                          <td key={formulation.id}>{formulation.result.lines.length}</td>
                        ))}
                      </tr>
                      {COMPARISON_NUTRIENTS.map((key) => (
                        <tr key={key}>
                          <td className="font-semibold">
                            {NUTRIENTS[key].labelAr}
                            <span className="mr-1 text-xs font-normal text-slate-400">({NUTRIENTS[key].unitAr})</span>
                          </td>
                          {selected.map((formulation) => {
                            const value = checkValue(formulation, key);
                            return (
                              <td key={formulation.id} className="tnum">
                                {formatNumber(value, NUTRIENTS[key].decimals)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="card">
                <div className="border-b border-sand-200 px-4 py-3">
                  <h2 className="section-title">توزيع المكوّنات (كغ مادة جافة/يوم)</h2>
                </div>
                <div className="table-wrap px-4 pb-2">
                  <table className="data-table min-w-[38rem]">
                    <thead>
                      <tr>
                        <th>المادة</th>
                        {selected.map((formulation) => (
                          <th key={formulation.id}>{formulation.name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ingredientNames.map((name) => (
                        <tr key={name}>
                          <td className="font-semibold">{name}</td>
                          {selected.map((formulation) => {
                            const line = formulation.result.lines.find((item) => item.nameAr === name);
                            return (
                              <td key={formulation.id} className="tnum">
                                {line ? formatNumber(line.quantityKgDM, 3) : '—'}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
