import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAppStore } from '../state/store';
import { CATEGORY_LABEL_AR, SPECIES_LABEL_AR, getStandard } from '../data/standards';
import { computeRequirements } from '../domain/requirements';
import { formatDateAr, formatDzd, formatNumber } from '../domain/units';
import { PageHeader, Notice, EmptyState } from '../components/ui';
import { StatCard } from '../components/badges';
import { BookmarkIcon, FlaskIcon, LeafIcon, LivestockIcon, PlusIcon, WarningIcon } from '../components/icons';
import { DEMO_LABEL_AR } from '../components/SafetyNotice';

const QUICK_ACTIONS = [
  { to: '/formulate', label: 'صياغة عليقة جديدة', description: 'اختر حيواناً وأعلافاً وشغّل محرك أقل تكلفة.', Icon: FlaskIcon },
  { to: '/livestock', label: 'إضافة ملف حيوان', description: 'سجّل الوزن والفئة الإنتاجية لحساب المتطلبات.', Icon: LivestockIcon },
  { to: '/ingredients', label: 'تحديث الأعلاف والأسعار', description: 'استبدل الأسعار التجريبية بأسعار السوق المحلي.', Icon: LeafIcon },
  { to: '/calculator', label: 'حاسبة التكلفة', description: 'احسب تكلفة خلطة يدوياً لعدد محدد من الأيام.', Icon: BookmarkIcon },
] as const;

export default function DashboardPage() {
  const profiles = useAppStore((state) => state.profiles);
  const formulations = useAppStore((state) => state.formulations);
  const ingredients = useAppStore((state) => state.ingredients);
  const settings = useAppStore((state) => state.settings);

  const standard = getStandard(settings.defaultStandardId);
  const totalHeads = profiles.reduce((sum, profile) => sum + profile.headCount, 0);
  const latest = formulations[0];
  const dailyHerdCost = latest ? latest.result.totalCostHerdDay : null;
  const periodCost = dailyHerdCost === null ? null : dailyHerdCost * settings.dashboardPeriodDays;

  const pricedIngredients = ingredients.filter(
    (ingredient) => ingredient.price && ingredient.price.dataStatus === 'illustrative_demo',
  ).length;

  const profileRows = profiles.map((profile) => {
    const requirements = standard ? computeRequirements(profile, standard) : null;
    return { profile, requirements };
  });

  const chartData = formulations
    .slice(0, 6)
    .reverse()
    .map((formulation) => ({
      name: formulation.name.length > 22 ? `${formulation.name.slice(0, 22)}…` : formulation.name,
      cost: Number(formulation.result.totalCostPerAnimalDay.toFixed(2)),
    }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="لوحة المعلومات"
        subtitle={`${DEMO_LABEL_AR}. ملخص قطيعك وآخر الحسابات محفوظ محلياً على هذا الجهاز.`}
        actions={
          <Link to="/formulate" className="btn-primary">
            <PlusIcon className="h-5 w-5" /> صياغة عليقة جديدة
          </Link>
        }
      />

      {standard ? (
        <Notice
          tone={standard.status === 'verified' ? 'success' : standard.status === 'incomplete' ? 'danger' : 'warning'}
          title={`المعيار الافتراضي: ${standard.nameAr}`}
        >
          <p>{standard.verificationNoteAr}</p>
        </Notice>
      ) : (
        <Notice tone="danger" title="المعيار الافتراضي غير موجود">
          <p>المعيار المحدد في الإعدادات غير مسجّل في هذه النسخة. اختر معياراً صالحاً من الإعدادات.</p>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="إجمالي الرؤوس" value={formatNumber(totalHeads, 0)} hint={`${profiles.length} ملف حيوان`} />
        <StatCard label="مواد علفية في القاعدة" value={formatNumber(ingredients.length, 0)} hint={`${pricedIngredients} سعر تجريبي يحتاج استبدالاً`} />
        <StatCard label="عليق محفوظة" value={formatNumber(formulations.length, 0)} hint="لقطة أسعار محفوظة لا تتغير تلقائياً" />
        <StatCard
          label={`تقدير تكلفة ${settings.dashboardPeriodDays} يوماً`}
          value={periodCost === null ? '—' : formatDzd(periodCost, 0)}
          hint={dailyHerdCost === null ? 'احفظ عليقة أولاً لحساب التقدير' : `آخر عليقة: ${latest?.name ?? ''}`}
          tone="brand"
        />
      </div>

      {pricedIngredients > 0 ? (
        <Notice tone="warning" title="الأسعار المضمّنة تجريبية">
          <p>
            {pricedIngredients} مادة علفية تحمل سعراً من نوع «بيانات عرض توضيحية». لن تعكس التكلفة واقع
            السوق حتى تدخل أسعارك المحلية من صفحة قاعدة الأعلاف.
          </p>
        </Notice>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-sand-200 px-4 py-3">
            <div>
              <h2 className="section-title">تكلفة العليقة لكل حيوان</h2>
              <p className="muted mt-0.5">آخر العليق المحفوظة — بالدينار الجزائري لليوم الواحد.</p>
            </div>
            <Link to="/compare" className="text-sm font-bold text-brand-700 hover:underline">
              مقارنة
            </Link>
          </div>
          <div className="p-4">
            {chartData.length === 0 ? (
              <EmptyState
                title="لا توجد عليق محفوظة بعد"
                description="بعد صياغة عليقة وحفظها ستظهر هنا مقارنة تكلفتها اليومية لكل حيوان."
                action={
                  <Link to="/formulate" className="btn-primary">
                    ابدأ الصياغة
                  </Link>
                }
                icon={<FlaskIcon className="h-8 w-8" />}
              />
            ) : (
              <div className="h-72 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ece2cc" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={56} />
                    <YAxis tick={{ fontSize: 11 }} width={56} />
                    <Tooltip contentStyle={{ fontFamily: 'Cairo, sans-serif', direction: 'rtl' }} />
                    <Bar dataKey="cost" name="تكلفة/حيوان/يوم" fill="#15803d" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </section>

        <section className="card">
          <div className="border-b border-sand-200 px-4 py-3">
            <h2 className="section-title">ملفات المواشي</h2>
            <p className="muted mt-0.5">معاينة المتطلبات بالمعيار الافتراضي.</p>
          </div>
          <div className="max-h-80 overflow-y-auto p-4">
            {profileRows.length === 0 ? (
              <EmptyState
                title="لا توجد ملفات"
                description="أضف ملف حيوان لتتمكن من حساب المتطلبات الغذائية."
                action={
                  <Link to="/livestock" className="btn-primary">
                    إضافة ملف
                  </Link>
                }
              />
            ) : (
              <ul className="space-y-3">
                {profileRows.map(({ profile, requirements }) => (
                  <li key={profile.id} className="rounded-xl border border-sand-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">{profile.name}</p>
                        <p className="text-xs text-slate-500">
                          {SPECIES_LABEL_AR[profile.species]} · {CATEGORY_LABEL_AR[profile.category]} ·{' '}
                          {profile.headCount} رأس
                        </p>
                      </div>
                      <span className="badge shrink-0 bg-sand-100 text-slate-700 tnum">{profile.liveWeightKg} كغ</span>
                    </div>
                    {requirements && requirements.blockersAr.length === 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        مادة جافة مستهدفة: <strong className="tnum">{formatNumber(requirements.dryMatterIntakeKg, 2)} كغ/يوم</strong>
                      </p>
                    ) : (
                      <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-red-700">
                        <WarningIcon className="h-4 w-4" /> بيانات ناقصة أو معيار غير مكتمل
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-900">اختصارات</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map(({ to, label, description, Icon }) => (
            <Link
              key={to}
              to={to}
              className="card group flex items-start gap-3 p-4 transition hover:border-brand-300 hover:shadow-md"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 group-hover:bg-brand-100">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {latest ? (
        <section className="card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">آخر عليقة محفوظة: {latest.name}</h2>
              <p className="mt-1 text-xs text-slate-500">
                حُفظت في {formatDateAr(latest.createdAt.slice(0, 10))} — {latest.result.lines.length} مكوّناً
              </p>
            </div>
            <Link to={`/saved/${latest.id}`} className="btn-secondary">
              عرض التفاصيل
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
