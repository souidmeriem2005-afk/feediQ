import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../state/store';
import { formatDateAr, formatDateTimeAr, formatDzd, formatNumber } from '../domain/units';
import type { SavedFormulation } from '../domain/types';
import { PageHeader, Notice, EmptyState } from '../components/ui';
import { OptimizationStatusBadge, RequirementStatusBadge } from '../components/badges';
import { TextField } from '../components/fields';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { RationResultView } from '../components/RationResultView';
import { BookmarkIcon, ChartIcon, FlaskIcon, PrintIcon, TrashIcon } from '../components/icons';

function PriceDrift({ formulation }: { formulation: SavedFormulation }) {
  const ingredients = useAppStore((state) => state.ingredients);
  const drifts = formulation.priceSnapshot
    .map((snapshot) => {
      const current = ingredients.find((ingredient) => ingredient.id === snapshot.ingredientId);
      if (!current?.price || snapshot.valuePerKgAsFed === null) return null;
      if (Math.abs(current.price.valuePerKgAsFed - snapshot.valuePerKgAsFed) < 0.0001) return null;
      return {
        name: snapshot.nameAr,
        oldPrice: snapshot.valuePerKgAsFed,
        oldDate: snapshot.date,
        newPrice: current.price.valuePerKgAsFed,
        newDate: current.price.date,
        newStatus: current.price.dataStatus,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (drifts.length === 0) {
    return (
      <Notice tone="success" title="لا يوجد اختلاف في الأسعار المحفوظة">
        <p>أسعار المواد في اللقطة تطابق الأسعار الحالية في قاعدة الأعلاف (أو لم تعد المادة موجودة/مسعّرة).</p>
      </Notice>
    );
  }

  return (
    <Notice tone="warning" title="تغيّرت الأسعار منذ حفظ العليقة">
      <p>
        الأرقام المعروضة أدناه تبقى كما حُفظت. إذا أردت تكلفة بالأسعار الحالية فأعد الصياغة أو الحساب في
        الحاسبة.
      </p>
      <ul className="mt-1 space-y-1 text-xs">
        {drifts.map((drift) => (
          <li key={drift.name}>
            {drift.name}: من {formatDzd(drift.oldPrice, 2)} ({formatDateAr(drift.oldDate)}) إلى{' '}
            {formatDzd(drift.newPrice, 2)} ({formatDateAr(drift.newDate)})
            {drift.newStatus === 'illustrative_demo' ? ' — السعر الحالي تجريبي أيضاً' : ''}
          </li>
        ))}
      </ul>
    </Notice>
  );
}

function FormulationDetail({ formulation }: { formulation: SavedFormulation }) {
  const navigate = useNavigate();
  const saveFormulation = useAppStore((state) => state.saveFormulation);
  const deleteFormulation = useAppStore((state) => state.deleteFormulation);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDuplicate = async () => {
    setBusy(true);
    setError(null);
    try {
      const record = await saveFormulation({
        name: `نسخة من ${formulation.name}`,
        notes: `نسخة محفوظة من «${formulation.name}». النتيجة نفسها دون إعادة تحسين.`,
        result: formulation.result,
        parentId: formulation.id,
      });
      setConfirmDuplicate(false);
      navigate(`/saved/${record.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر إنشاء النسخة.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      await deleteFormulation(formulation.id);
      navigate('/saved');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حذف العليقة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={formulation.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span>
              {formulation.result.profileSnapshot.name} · حُفظت في{' '}
              {formatDateTimeAr(formulation.createdAt)}
            </span>
            <span className="badge bg-sand-100 text-slate-700">الإصدار {formulation.version}</span>
          </span>
        }
        actions={
          <div className="no-print flex flex-wrap gap-2">
            <Link to="/saved" className="btn-secondary">
              كل العليق
            </Link>
            <button type="button" className="btn-secondary" onClick={() => window.print()}>
              <PrintIcon className="h-5 w-5" /> طباعة
            </button>
            <button type="button" className="btn-secondary" onClick={() => setConfirmDuplicate(true)}>
              إنشاء نسخة
            </button>
            <button type="button" className="btn-danger" onClick={() => setConfirmDelete(true)}>
              <TrashIcon className="h-5 w-5" /> حذف
            </button>
          </div>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      <Notice tone="info" title="لقطة تاريخية">
        <p>
          هذه النتيجة محفوظة كما كانت وقت الحساب. تعديل الأسعار أو الأعلاف أو ملف الحيوان لاحقاً لا يغيّرها.
          لإعادة الحساب بالبيانات الحالية انتقل إلى صفحة الصياغة.
        </p>
      </Notice>

      <PriceDrift formulation={formulation} />

      {formulation.notes ? (
        <section className="card card-pad">
          <h2 className="text-sm font-bold text-slate-900">ملاحظات محفوظة</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{formulation.notes}</p>
        </section>
      ) : null}

      <RationResultView result={formulation.result} />

      <div className="no-print flex flex-wrap gap-2">
        <Link to="/formulate" className="btn-primary">
          <FlaskIcon className="h-5 w-5" /> إعادة صياغة
        </Link>
        <Link to="/compare" className="btn-secondary">
          <ChartIcon className="h-5 w-5" /> مقارنة مع عليق أخرى
        </Link>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف العليقة المحفوظة"
        description={<span>سيتم حذف «{formulation.name}» نهائياً من هذا الجهاز.</span>}
        confirmLabel="حذف نهائي"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
      />
      <ConfirmDialog
        open={confirmDuplicate}
        title="إنشاء نسخة محفوظة"
        description={
          <span>
            ستُحفظ نسخة جديدة بنفس النتيجة والأسعار الحالية للقطة، دون إعادة تشغيل التحسين. هل تريد المتابعة؟
          </span>
        }
        confirmLabel="إنشاء النسخة"
        tone="primary"
        busy={busy}
        onConfirm={() => void handleDuplicate()}
        onCancel={() => setConfirmDuplicate(false)}
      />
    </div>
  );
}

export default function SavedPage() {
  const { formulationId } = useParams();
  const formulations = useAppStore((state) => state.formulations);
  const deleteFormulation = useAppStore((state) => state.deleteFormulation);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<SavedFormulation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = formulationId
    ? formulations.find((formulation) => formulation.id === formulationId)
    : undefined;

  const filtered = useMemo(() => {
    const term = search.trim();
    if (!term) return formulations;
    return formulations.filter(
      (formulation) =>
        formulation.name.includes(term) ||
        formulation.result.profileSnapshot.name.includes(term) ||
        (formulation.notes ?? '').includes(term),
    );
  }, [formulations, search]);

  if (formulationId) {
    if (!selected) {
      return (
        <div className="space-y-4">
          <PageHeader title="العليقة غير موجودة" />
          <Notice tone="danger">
            <p>لم يتم العثور على هذه العليقة في قاعدة البيانات المحلية. ربما حُذفت أو استُبدلت بنسخة احتياطية أخرى.</p>
          </Notice>
          <Link to="/saved" className="btn-primary">
            العودة إلى العليق المحفوظة
          </Link>
        </div>
      );
    }
    return <FormulationDetail formulation={selected} />;
  }

  const handleDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    try {
      await deleteFormulation(deleting.id);
      setDeleting(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حذف العليقة.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="العليق المحفوظة والسجل"
        subtitle="كل عليقة تحتفظ بلقطة كاملة لبيانات الحيوان والأسعار والمتطلبات وقت الحساب."
        actions={
          <Link to="/formulate" className="btn-primary">
            <FlaskIcon className="h-5 w-5" /> صياغة جديدة
          </Link>
        }
      />

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {formulations.length === 0 ? (
        <EmptyState
          icon={<BookmarkIcon className="h-9 w-9" />}
          title="لا توجد عليق محفوظة"
          description="بعد تشغيل التحسين بنجاح، استخدم زر الحفظ في صفحة الصياغة. ستظهر النسخة هنا مع لقطة أسعارها."
          action={
            <Link to="/formulate" className="btn-primary">
              ابدأ صياغة عليقة
            </Link>
          }
        />
      ) : (
        <>
          <div className="card card-pad">
            <TextField
              label="بحث في السجل"
              type="search"
              value={search}
              onChange={setSearch}
              placeholder="اسم العليقة، ملف الحيوان، أو الملاحظات…"
            />
          </div>

          {filtered.length === 0 ? (
            <Notice tone="info">
              <p>لا توجد نتائج مطابقة للبحث.</p>
            </Notice>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((formulation) => (
                <article key={formulation.id} className="card card-pad">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-base font-bold text-slate-900">{formulation.name}</h2>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formulation.result.profileSnapshot.name} · {formatDateTimeAr(formulation.createdAt)}
                      </p>
                    </div>
                    <span className="badge shrink-0 bg-sand-100 text-slate-700">v{formulation.version}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <OptimizationStatusBadge status={formulation.result.status} />
                    <RequirementStatusBadge status={formulation.result.requirements.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-sand-50 p-2.5">
                      <p className="text-[11px] text-slate-500">تكلفة/حيوان/يوم</p>
                      <p className="font-bold tnum">{formatDzd(formulation.result.totalCostPerAnimalDay, 2)}</p>
                    </div>
                    <div className="rounded-xl bg-sand-50 p-2.5">
                      <p className="text-[11px] text-slate-500">مادة جافة/يوم</p>
                      <p className="font-bold tnum">{formatNumber(formulation.result.totalDmKg, 2)} كغ</p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {formulation.result.lines.length} مكوّناً · {formulation.result.profileSnapshot.headCount} رأس
                    {formulation.notes ? ` · ${formulation.notes.slice(0, 70)}` : ''}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link to={`/saved/${formulation.id}`} className="btn-secondary min-h-9 px-3 text-xs">
                      عرض التفاصيل
                    </Link>
                    <button
                      type="button"
                      className="btn-ghost min-h-9 px-3 text-xs text-red-700 hover:bg-red-50"
                      onClick={() => setDeleting(formulation)}
                    >
                      <TrashIcon className="h-4 w-4" /> حذف
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="حذف العليقة المحفوظة"
        description={<span>سيتم حذف «{deleting?.name}» نهائياً من هذا الجهاز.</span>}
        confirmLabel="حذف نهائي"
        busy={busy}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
