import { useRef, useState, type ChangeEvent } from 'react';
import { useAppStore } from '../state/store';
import { STANDARDS } from '../data/standards';
import { REFERENCES, ACCESS_STATUS_LABEL_AR, ACCESS_STATUS_STYLE } from '../data/references';
import { DATA_STATUS_LABEL_AR, DATA_STATUS_STYLE } from '../domain/nutrients';
import { exportDatabase } from '../storage/repository';
import {
  serialiseBackup,
  validateBackup,
  type BackupFile,
} from '../storage/backup';
import { formatNumber, isoDate, parseDecimal } from '../domain/units';
import { PageHeader, Notice, InlineError } from '../components/ui';
import { RequirementStatusBadge } from '../components/badges';
import { CheckboxField, NumberField, SelectField } from '../components/fields';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { SafetyNotice } from '../components/SafetyNotice';
import { CheckIcon, DownloadIcon, TrashIcon, UploadIcon, WarningIcon } from '../components/icons';
import type { DataStatus } from '../domain/types';

interface PendingImport {
  file: BackupFile;
  fileName: string;
  warningsAr: string[];
}

export default function SettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const ingredients = useAppStore((state) => state.ingredients);
  const profiles = useAppStore((state) => state.profiles);
  const formulations = useAppStore((state) => state.formulations);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const importBackup = useAppStore((state) => state.importBackup);
  const resetAll = useAppStore((state) => state.resetAll);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [periodText, setPeriodText] = useState(String(settings.dashboardPeriodDays));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const notify = (text: string) => {
    setMessage(text);
    setError(null);
  };

  const setSettings = async (patch: Parameters<typeof updateSettings>[0]) => {
    try {
      await updateSettings(patch);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر حفظ الإعدادات.');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const backup = await exportDatabase();
      const blob = new Blob([serialiseBackup(backup)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `smartfeed-backup-${isoDate()}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      notify('تم إنشاء ملف النسخة الاحتياطية وتنزيله.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر إنشاء النسخة الاحتياطية.');
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportErrors([]);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        setImportErrors(['الملف ليس JSON صالحاً.']);
        return;
      }
      const validation = validateBackup(parsed);
      if (!validation.ok) {
        setImportErrors(validation.errorsAr);
        return;
      }
      setPending({
        file: validation.file,
        fileName: file.name,
        warningsAr: validation.warningsAr,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر قراءة الملف.');
    }
  };

  const handleImport = async () => {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await importBackup(pending.file);
      notify('تم استيراد النسخة الاحتياطية واستبدال البيانات المحلية بنجاح.');
      setPending(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّر استيراد النسخة الاحتياطية.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    setBusy(true);
    setError(null);
    try {
      await resetAll();
      notify('تمت إعادة تعيين البيانات المحلية إلى الكتالوج التجريبي الافتراضي.');
      setConfirmReset(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'تعذّرت إعادة التعيين.');
    } finally {
      setBusy(false);
    }
  };

  const handlePeriod = async (value: string) => {
    setPeriodText(value);
    const parsed = parseDecimal(value);
    if (parsed !== null && Number.isInteger(parsed) && parsed > 0 && parsed <= 3650) {
      await setSettings({ dashboardPeriodDays: parsed });
    }
  };

  const periodError =
    periodText.trim() === '' ||
    (() => {
      const parsed = parseDecimal(periodText);
      return parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > 3650;
    })()
      ? 'أدخل عدد أيام صحيحاً بين 1 و3650.'
      : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإعدادات والنسخ الاحتياطي"
        subtitle="كل شيء يعمل محلياً في هذا المتصفح. لا يوجد تسجيل دخول ولا خادم، لذا فإن النسخة الاحتياطية هي وسيلتك الوحيدة لنقل البيانات."
      />

      {message ? (
        <Notice tone="success">
          <p>{message}</p>
        </Notice>
      ) : null}
      {error ? <InlineError>{error}</InlineError> : null}

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">المعيار الغذائي الافتراضي</h2>
          <p className="muted mt-0.5">يُستخدم عند فتح صفحة الصياغة. يمكن تغييره لكل صياغة على حدة.</p>
        </div>
        <div className="space-y-3 p-4">
          {STANDARDS.map((standard) => {
            const active = settings.defaultStandardId === standard.id;
            return (
              <button
                key={standard.id}
                type="button"
                onClick={() => void setSettings({ defaultStandardId: standard.id })}
                aria-pressed={active}
                className={`w-full rounded-2xl border p-4 text-right transition ${
                  active ? 'border-brand-500 bg-brand-50' : 'border-sand-200 bg-white hover:bg-sand-50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{standard.nameAr}</span>
                    <RequirementStatusBadge status={standard.status} />
                    {active ? (
                      <span className="badge bg-brand-700 text-white">
                        <CheckIcon className="h-3.5 w-3.5" /> مفعّل
                      </span>
                    ) : null}
                  </span>
                  <span className="text-xs text-slate-400">الإصدار {standard.version}</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-slate-600">{standard.verificationNoteAr}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{standard.provenanceAr}</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  الطاقة: {standard.energySystemAr} · البروتين: {standard.proteinSystemAr}
                </p>
              </button>
            );
          })}
          <Notice tone="demo" title="لماذا لا يوجد معيار «مُتحقَّق» بعد؟">
            <p>
              لم تُتحقَّق جداول المتطلبات العددية من نسخة أصلية أثناء تطوير هذه النسخة. لم يُخترع أي رقم
              بديل. يبقى إدخال معاملات موثّقة عملاً يحتاج مختصاً ومصدراً مطبوعاً.
            </p>
          </Notice>
        </div>
      </section>

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">تفضيلات العرض والحساب</h2>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <SelectField
            label="أساس عرض الكميات المفضّل"
            value={settings.preferredBasis}
            onChange={(value) => void setSettings({ preferredBasis: value as 'AF' | 'DM' })}
            options={[
              { value: 'AF', label: 'كما هي (AF) — الوزن الفعلي للعلف' },
              { value: 'DM', label: 'المادة الجافة (DM)' },
            ]}
            hint="العرض لا يغيّر الحسابات؛ كل الأرقام تحتفظ بأساسها المعلن."
          />
          <NumberField
            label="مدة تقدير التكلفة في لوحة المعلومات"
            value={periodText}
            onChange={(value) => void handlePeriod(value)}
            suffix="يوم"
            error={periodError}
          />
          <CheckboxField
            label="إظهار شارات حالة البيانات"
            checked={settings.showDataStatus}
            onChange={(value) => void setSettings({ showDataStatus: value })}
            hint="تظل التحذيرات الإلزامية وشارة العرض التوضيحي ظاهرة دائماً."
          />
          <CheckboxField
            label="أقرّ بأن البيانات الحالية عرض توضيحي وليست معتمدة"
            checked={settings.demoAcknowledged}
            onChange={(value) => void setSettings({ demoAcknowledged: value })}
            hint="هذا الإقرار لا يغيّر أي حساب ولا يرفع حالة البيانات."
          />
        </div>
      </section>

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">النسخ الاحتياطي والاستعادة</h2>
          <p className="muted mt-0.5">ملف JSON واحد يحتوي الأعلاف والملفات والعليق والإعدادات.</p>
        </div>
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-primary" onClick={() => void handleExport()} disabled={exporting}>
              <DownloadIcon className="h-5 w-5" /> {exporting ? 'جارٍ التصدير…' : 'تصدير نسخة احتياطية'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => fileInputRef.current?.click()}>
              <UploadIcon className="h-5 w-5" /> استيراد نسخة
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => void handleFileSelected(event)}
              aria-label="اختيار ملف النسخة الاحتياطية"
            />
          </div>

          <div className="rounded-xl bg-sand-50 p-3 text-xs leading-5 text-slate-600">
            <p>
              يحتوي الملف على: {formatNumber(ingredients.length, 0)} مادة علفية، {formatNumber(profiles.length, 0)}{' '}
              ملف حيوان، {formatNumber(formulations.length, 0)} عليقة محفوظة، والإعدادات.
            </p>
            <p className="mt-1">
              الاستيراد يتحقق من بنية الملف بالكامل قبل الكتابة. إذا فشل التحقق لن تُكتب أي بيانات.
            </p>
          </div>

          {importErrors.length > 0 ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="flex items-center gap-2 text-sm font-bold text-red-900">
                <WarningIcon className="h-5 w-5" /> الملف مرفوض — لم تُغيَّر أي بيانات
              </p>
              <ul className="mt-2 max-h-56 list-inside list-disc space-y-1 overflow-y-auto text-xs leading-5 text-red-800">
                {importErrors.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="rounded-2xl border border-red-200 p-4">
            <h3 className="text-sm font-bold text-red-900">منطقة خطر</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              إعادة التعيين تحذف كل الأعلاف المضافة وملفات المواشي والعليق المحفوظة والإعدادات، ثم تعيد
              الكتالوج الافتراضي فقط. صدّر نسخة احتياطية أولاً.
            </p>
            <button type="button" className="btn-danger mt-3" onClick={() => setConfirmReset(true)}>
              <TrashIcon className="h-5 w-5" /> إعادة تعيين كل البيانات
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">دليل حالات البيانات</h2>
        </div>
        <ul className="grid gap-2 p-4 sm:grid-cols-2">
          {(Object.keys(DATA_STATUS_LABEL_AR) as DataStatus[]).map((status) => (
            <li key={status} className="flex items-center gap-2 rounded-xl border border-sand-200 p-2.5">
              <span className={`badge ${DATA_STATUS_STYLE[status]}`}>{DATA_STATUS_LABEL_AR[status]}</span>
              <span className="text-[11px] leading-4 text-slate-500">{status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">المراجع العلمية</h2>
          <p className="muted mt-0.5">
            ما استُخدم فعلاً، وما لم يُستخدم. لا يُدرج مرجع هنا لمجرد التزيين.
          </p>
        </div>
        <ul className="divide-y divide-sand-100">
          {REFERENCES.map((reference) => (
            <li key={reference.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900">{reference.titleAr}</h3>
                  <p dir="ltr" className="mt-0.5 text-left text-xs text-slate-500">
                    {reference.titleOriginal}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {reference.authors} — {reference.year}
                    {reference.edition ? ` · ${reference.edition}` : ''}
                  </p>
                </div>
                <span className={`badge shrink-0 ${ACCESS_STATUS_STYLE[reference.accessStatus]}`}>
                  {ACCESS_STATUS_LABEL_AR[reference.accessStatus]}
                </span>
              </div>
              <dl className="mt-2 space-y-1 text-xs leading-5 text-slate-600">
                <div>
                  <dt className="inline font-semibold">يغطي: </dt>
                  <dd className="inline">{reference.coversAr}</dd>
                </div>
                {reference.energySystem ? (
                  <div>
                    <dt className="inline font-semibold">الطاقة: </dt>
                    <dd className="inline">{reference.energySystem}</dd>
                  </div>
                ) : null}
                {reference.proteinSystem ? (
                  <div>
                    <dt className="inline font-semibold">البروتين: </dt>
                    <dd className="inline">{reference.proteinSystem}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="inline font-semibold">ملاحظات الاطلاع: </dt>
                  <dd className="inline">{reference.accessNoteAr}</dd>
                </div>
                <div className="rounded-lg bg-amber-50 p-2 text-amber-900">
                  <dt className="inline font-semibold">القيود: </dt>
                  <dd className="inline">{reference.limitationsAr}</dd>
                </div>
              </dl>
              {reference.url ? (
                <a
                  href={reference.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-2 inline-block text-xs font-bold text-brand-700 hover:underline"
                >
                  الرابط الرسمي (يفتح في تبويب جديد)
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="border-b border-sand-200 px-4 py-3">
          <h2 className="section-title">معلومات التطبيق</h2>
        </div>
        <dl className="divide-y divide-sand-100 px-4 text-sm">
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-slate-500">التخزين</dt>
            <dd className="font-semibold">IndexedDB محلي في هذا المتصفح</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-slate-500">تسجيل الدخول</dt>
            <dd className="font-semibold">غير مطلوب — لا حسابات ولا خادم</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-slate-500">العملة</dt>
            <dd className="font-semibold">الدينار الجزائري (دج)</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3 py-2.5">
            <dt className="text-slate-500">العمل دون اتصال</dt>
            <dd className="max-w-md text-left font-semibold">
              صفحة التطبيق تُخزَّن للعمل دون اتصال بعد أول زيارة، لكن خط Cairo يأتي من Google Fonts ويحتاج
              اتصالاً أول مرة. لا ندّعي عملاً دون اتصال كاملاً قبل زيارة واحدة.
            </dd>
          </div>
        </dl>
      </section>

      <SafetyNotice />

      <ConfirmDialog
        open={pending !== null}
        title="استيراد نسخة احتياطية"
        description={
          <div className="space-y-2">
            <p>
              الملف «{pending?.fileName}» صالح. سيستبدل الاستيراد{' '}
              <strong>كل البيانات المحلية الحالية</strong> بمحتوى الملف:
            </p>
            <ul className="list-inside list-disc text-xs">
              <li>{formatNumber(pending?.file.data.ingredients.length ?? 0, 0)} مادة علفية</li>
              <li>{formatNumber(pending?.file.data.profiles.length ?? 0, 0)} ملف حيوان</li>
              <li>{formatNumber(pending?.file.data.formulations.length ?? 0, 0)} عليقة محفوظة</li>
              <li>الإعدادات المرفقة</li>
            </ul>
            {pending?.warningsAr.map((warning, index) => (
              <p key={index} className="text-xs text-amber-800">
                • {warning}
              </p>
            ))}
          </div>
        }
        confirmLabel="استيراد واستبدال"
        tone="danger"
        busy={busy}
        onConfirm={() => void handleImport()}
        onCancel={() => setPending(null)}
      />

      <ConfirmDialog
        open={confirmReset}
        title="إعادة تعيين كل البيانات"
        description={
          <span>
            سيتم حذف كل الأعلاف المضافة وملفات المواشي والعليق المحفوظة والإعدادات نهائياً، ثم إعادة الكتالوج
            التجريبي فقط.
          </span>
        }
        confirmLabel="تأكيد إعادة التعيين"
        busy={busy}
        onConfirm={() => void handleReset()}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  );
}
