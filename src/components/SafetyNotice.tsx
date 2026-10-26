import { WarningIcon } from './icons';

/** Exact wording required by the product specification (§19). Do not reword. */
export const SAFETY_NOTICE_AR =
  'النتائج تقديرات حسابية تعتمد على دقة بيانات الأعلاف والأسعار والمعايير الغذائية المستخدمة. لا تغني هذه الأداة عن مراجعة أخصائي تغذية حيوانية مؤهل أو طبيب بيطري قبل تطبيق العليقة، خصوصًا للحيوانات الحوامل والمرضعات والحالات الإنتاجية الخاصة.';

export const DEMO_LABEL_AR = 'بيانات عرض توضيحية — غير معتمدة لاتخاذ قرارات تغذية حقيقية';
export const DEMO_LABEL_EN = 'Illustrative demonstration data — not approved for real feeding decisions';

export function SafetyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <section
      aria-label="تنبيه السلامة"
      className={`rounded-2xl border border-amber-300 bg-amber-50 text-amber-950 ${
        compact ? 'p-3' : 'p-4 sm:p-5'
      }`}
    >
      <div className="flex gap-3">
        <WarningIcon className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="text-sm font-extrabold">تنبيه سلامة إلزامي</p>
          <p className="mt-1 text-sm leading-7">{SAFETY_NOTICE_AR}</p>
        </div>
      </div>
    </section>
  );
}

export function DemoLabel() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="badge bg-violet-100 text-violet-950">{DEMO_LABEL_AR}</span>
      <span dir="ltr" className="text-[11px] font-semibold text-violet-800">
        {DEMO_LABEL_EN}
      </span>
    </div>
  );
}
