import type { NutrientKey, RationResult } from '../domain/types';
import { NUTRIENTS, formatNutrient } from '../domain/nutrients';
import { formatDateAr, formatDzd, formatNumber, formatPercent } from '../domain/units';
import { OptimizationStatusBadge, RequirementStatusBadge, StatCard } from './badges';
import { Notice } from './ui';
import { CheckIcon, CloseIcon, WarningIcon } from './icons';

const COMPOSITION_KEYS: NutrientKey[] = [
  'cp_pct',
  'ndf_pct',
  'adf_pct',
  'cf_pct',
  'starch_pct',
  'fat_pct',
  'ca_g',
  'p_g',
  'na_g',
];

export function RationResultView({ result }: { result: RationResult }) {
  const concentration = (key: NutrientKey): number | null => {
    const total = result.nutrientTotals[key];
    if (total === undefined || result.totalDmKg <= 0) return null;
    return total / result.totalDmKg;
  };

  const verified = result.status === 'feasible_verified';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sand-200 bg-white p-4">
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-700">حالة النتيجة</p>
          <OptimizationStatusBadge status={result.status} />
        </div>
        <div className="text-left text-xs text-slate-500">
          <p>حُسبت في {formatDateAr(result.calculatedAt.slice(0, 10))}</p>
          <p>
            المعيار: {result.standardId} · الإصدار {result.standardVersion} · المحرك {result.engineVersion}
          </p>
          <p className="font-mono">بصمة المدخلات: {result.inputFingerprint}</p>
        </div>
      </div>

      <Notice tone={verified ? 'success' : 'warning'} title={verified ? 'اجتازت القيود المفروضة' : 'لا تُعامل هذه النتيجة كعليقة متوازنة'}>
        {verified ? (
          <p>
            جميع القيود التي يفرضها المعيار المحدد تم التحقق منها مستقلاً بعد حل النموذج، وكانت معاملات
            المتطلبات موثّقة. تبقى القرارات النهائية مسؤولية المختص.
          </p>
        ) : (
          <>
            <p>
              هذه النتيجة <strong>حل رياضي صالح</strong> للنموذج الخطي: مجموع المادة الجافة يطابق الهدف،
              والقيود المفروضة على الطاقة والبروتين والمعادن محققة ضمن حدود التحقق. لكنها{' '}
              <strong>لم تُثبت كفايتها الغذائية</strong> لأن معاملات المتطلبات المستخدمة عرض توضيحية غير
              مُتحقَّق منها من النسخة الأصلية للمرجع.
            </p>
            <p>
              لا ينبغي تسميتها «عليقة متوازنة» ولا تطبيقها على حيوانات حقيقية دون مراجعة أخصائي تغذية
              حيوانية مؤهل.
            </p>
          </>
        )}
      </Notice>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="المادة الجافة للعليقة"
          value={`${formatNumber(result.totalDmKg, 3)} كغ`}
          hint="لكل حيوان في اليوم"
        />
        <StatCard
          label="الكمية كما هي (AF)"
          value={`${formatNumber(result.totalAfKg, 3)} كغ`}
          hint="لكل حيوان في اليوم"
        />
        <StatCard
          label="تكلفة الحيوان اليومية"
          value={formatDzd(result.totalCostPerAnimalDay, 2)}
          hint={`تكلفة كغ المادة الجافة: ${formatDzd(result.costPerKgDm, 2)}`}
          tone="brand"
        />
        <StatCard
          label="تكلفة القطيع اليومية"
          value={formatDzd(result.totalCostHerdDay, 2)}
          hint={`${result.profileSnapshot.headCount} رأس`}
          tone="brand"
        />
      </div>

      {result.messagesAr.length > 0 || result.warningsAr.length > 0 ? (
        <div className="space-y-2">
          {result.messagesAr.map((message, index) => (
            <Notice key={`m-${index}`} tone="info">
              <p>{message}</p>
            </Notice>
          ))}
          {result.warningsAr.map((warning, index) => (
            <Notice key={`w-${index}`} tone="warning">
              <p>{warning}</p>
            </Notice>
          ))}
        </div>
      ) : null}

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">مكوّنات العليقة</h2>
          <p className="muted mt-0.5">كل الكميات لكل حيوان في اليوم. النسب محسوبة على أساس المادة الجافة.</p>
        </div>
        <div className="table-wrap px-4 pb-2">
          <table className="data-table">
            <thead>
              <tr>
                <th>المادة العلفية</th>
                <th>كغ مادة جافة</th>
                <th>كغ كما هي</th>
                <th>% من المادة الجافة</th>
                <th>السعر (دج/كغ AF)</th>
                <th>تكلفة/حيوان/يوم</th>
                <th>تاريخ السعر</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.ingredientId}>
                  <td className="font-semibold text-slate-900">
                    {line.nameAr}
                    {line.stockWarning ? (
                      <span className="mr-2 inline-flex align-middle text-amber-600" title="قريب من المخزون المتاح">
                        <WarningIcon className="h-4 w-4" />
                      </span>
                    ) : null}
                  </td>
                  <td className="tnum">{formatNumber(line.quantityKgDM, 3)}</td>
                  <td className="tnum">{formatNumber(line.quantityKgAF, 3)}</td>
                  <td className="tnum">{formatPercent(line.sharePctDM, 1)}</td>
                  <td className="tnum">{line.pricePerKgAsFed === null ? '—' : formatNumber(line.pricePerKgAsFed, 2)}</td>
                  <td className="tnum">{formatDzd(line.costPerAnimalDay, 2)}</td>
                  <td className="text-xs text-slate-500">{formatDateAr(line.priceDate)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-sand-50 font-bold">
                <td className="px-3 py-2.5">المجموع</td>
                <td className="px-3 py-2.5 tnum">{formatNumber(result.totalDmKg, 3)}</td>
                <td className="px-3 py-2.5 tnum">{formatNumber(result.totalAfKg, 3)}</td>
                <td className="px-3 py-2.5 tnum">100%</td>
                <td className="px-3 py-2.5">—</td>
                <td className="px-3 py-2.5 tnum">{formatDzd(result.totalCostPerAnimalDay, 2)}</td>
                <td className="px-3 py-2.5">—</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <div className="border-b border-sand-200 px-4 py-3">
            <h2 className="section-title">التحقق من القيود</h2>
            <p className="muted mt-0.5">تحقق مستقل بعد الحل، ضمن تفاوت رقمي معلن.</p>
          </div>
          <div className="table-wrap px-4 pb-2">
            <table className="data-table min-w-[34rem]">
              <thead>
                <tr>
                  <th>القيد</th>
                  <th>المطلوب</th>
                  <th>المتحقق</th>
                  <th>الفائض</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {result.checks.map((check) => (
                  <tr key={check.key}>
                    <td className="font-semibold">{check.labelAr}</td>
                    <td className="tnum">
                      {formatNumber(check.required, NUTRIENTS[check.key].decimals)} {check.unitAr}
                    </td>
                    <td className="tnum">
                      {formatNumber(check.actual, NUTRIENTS[check.key].decimals)} {check.unitAr}
                    </td>
                    <td className={`tnum ${check.surplus < 0 ? 'text-red-700' : 'text-slate-600'}`}>
                      {formatNumber(check.surplus, NUTRIENTS[check.key].decimals)}
                    </td>
                    <td>
                      {check.satisfied ? (
                        <span className="badge bg-brand-100 text-brand-900">
                          <CheckIcon className="h-3.5 w-3.5" /> محقق
                        </span>
                      ) : (
                        <span className="badge bg-red-100 text-red-900">
                          <CloseIcon className="h-3.5 w-3.5" /> غير محقق
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.unevaluated.length > 0 ? (
            <div className="mx-4 mb-4">
              <Notice tone="warning" title="قيود لم تُقيَّم">
                <p>
                  {result.unevaluated.map((key) => NUTRIENTS[key].labelAr).join('، ')} — لم تُضف إلى النموذج،
                  ولذلك لا يمكن اعتبارها محققة.
                </p>
              </Notice>
            </div>
          ) : null}
        </section>

        <section className="card">
          <div className="border-b border-sand-200 px-4 py-3">
            <h2 className="section-title">الكثافة الغذائية للعليقة</h2>
            <p className="muted mt-0.5">القيم محسوبة من مجموع مساهمات المكوّنات ÷ إجمالي المادة الجافة.</p>
          </div>
          <dl className="px-4 pb-3">
            {COMPOSITION_KEYS.map((key) => {
              const value = concentration(key);
              const def = NUTRIENTS[key];
              return (
                <div key={key} className="flex items-baseline justify-between gap-3 border-b border-sand-100 py-2 last:border-0">
                  <dt className="text-sm text-slate-500">
                    {def.labelAr} <span className="text-xs">({def.unitAr})</span>
                  </dt>
                  <dd className="tnum text-sm font-semibold text-slate-900">{formatNutrient(key, value)}</dd>
                </div>
              );
            })}
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-sm text-slate-500">تكلفة كغ الكمية كما هي</dt>
              <dd className="tnum text-sm font-semibold text-slate-900">{formatDzd(result.costPerKgAf, 2)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">المتطلبات المستخدمة وحالتها</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <RequirementStatusBadge status={result.requirements.status} />
            <span className="text-xs text-slate-500">
              استهلاك المادة الجافة المستهدف: {formatNumber(result.requirements.dryMatterIntakeKg, 3)} كغ/يوم
              {result.requirements.ndfMinPctDm !== null
                ? ` · الحد الأدنى NDF: ${formatPercent(result.requirements.ndfMinPctDm, 1)}`
                : ' · NDF غير مقيّد'}
            </span>
          </div>
        </div>
        <div className="table-wrap px-4 pb-2">
          <table className="data-table min-w-[38rem]">
            <thead>
              <tr>
                <th>المتطلب</th>
                <th>الكمية اليومية</th>
                <th>الواحد</th>
                <th>المصدر والموقع</th>
                <th>حالة البيانات</th>
              </tr>
            </thead>
            <tbody>
              {result.requirements.requirements.map((requirement) => (
                <tr key={requirement.key}>
                  <td className="font-semibold">{NUTRIENTS[requirement.key].labelAr}</td>
                  <td className="tnum">{formatNumber(requirement.amount, NUTRIENTS[requirement.key].decimals)}</td>
                  <td>{NUTRIENTS[requirement.key].unitAr}</td>
                  <td className="max-w-[18rem] text-xs text-slate-500">
                    <p className="font-mono" dir="ltr">
                      {requirement.provenance.referenceId}
                    </p>
                    <p className="font-mono" dir="ltr">
                      {requirement.provenance.locator}
                    </p>
                    {requirement.provenance.note ? <p>{requirement.provenance.note}</p> : null}
                  </td>
                  <td>
                    <RequirementStatusBadge
                      status={
                        requirement.provenance.status === 'verified_reference'
                          ? 'verified'
                          : requirement.provenance.status === 'illustrative_demo'
                            ? 'illustrative'
                            : 'requires_confirmation'
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.requirements.notesAr.length > 0 ? (
          <ul className="mx-4 mb-4 list-inside list-disc space-y-1 text-xs leading-5 text-slate-500">
            {result.requirements.notesAr.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
