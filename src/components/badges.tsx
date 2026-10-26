import type { ReactNode } from 'react';
import type { OptimizationStatus, RequirementStatus } from '../domain/types';
import type { DataStatus } from '../domain/types';
import { DATA_STATUS_LABEL_AR, DATA_STATUS_STYLE } from '../domain/nutrients';

export function DataStatusBadge({ status, compact = false }: { status: DataStatus; compact?: boolean }) {
  return (
    <span
      className={`badge ${DATA_STATUS_STYLE[status]}`}
      title={DATA_STATUS_LABEL_AR[status]}
    >
      {compact ? '●' : DATA_STATUS_LABEL_AR[status]}
    </span>
  );
}

export const OPTIMIZATION_STATUS_LABEL_AR: Record<OptimizationStatus, string> = {
  feasible_verified: 'حل صالح ومُتحقَّق من كفايته',
  feasible_unverified_adequacy: 'حل رياضي صالح — الكفاية الغذائية غير مُتحقَّق منها',
  infeasible: 'لا يوجد حل تحت القيود الحالية',
  missing_ingredient_data: 'بيانات أعلاف ناقصة',
  insufficient_animal_data: 'بيانات حيوان أو معيار ناقصة',
  invalid_input: 'مدخلات غير صالحة',
  solver_error: 'خطأ في محرك التحسين',
};

const OPTIMIZATION_STYLE: Record<OptimizationStatus, string> = {
  feasible_verified: 'bg-brand-100 text-brand-900',
  feasible_unverified_adequacy: 'bg-amber-100 text-amber-900',
  infeasible: 'bg-red-100 text-red-900',
  missing_ingredient_data: 'bg-red-100 text-red-900',
  insufficient_animal_data: 'bg-red-100 text-red-900',
  invalid_input: 'bg-red-100 text-red-900',
  solver_error: 'bg-red-100 text-red-900',
};

export function OptimizationStatusBadge({ status }: { status: OptimizationStatus }) {
  return <span className={`badge ${OPTIMIZATION_STYLE[status]}`}>{OPTIMIZATION_STATUS_LABEL_AR[status]}</span>;
}

export const REQUIREMENT_STATUS_LABEL_AR: Record<RequirementStatus, string> = {
  verified: 'معاملات مُتحقَّق منها',
  requires_confirmation: 'معاملات تحتاج تأكيداً',
  illustrative: 'معاملات عرض توضيحية',
  incomplete: 'معيار غير مكتمل',
};

const REQUIREMENT_STYLE: Record<RequirementStatus, string> = {
  verified: 'bg-brand-100 text-brand-900',
  requires_confirmation: 'bg-amber-100 text-amber-900',
  illustrative: 'bg-violet-100 text-violet-900',
  incomplete: 'bg-red-100 text-red-900',
};

export function RequirementStatusBadge({ status }: { status: RequirementStatus }) {
  return <span className={`badge ${REQUIREMENT_STYLE[status]}`}>{REQUIREMENT_STATUS_LABEL_AR[status]}</span>;
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'default' | 'brand' | 'amber';
}) {
  const toneClass =
    tone === 'brand'
      ? 'border-brand-200 bg-brand-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : 'border-sand-200 bg-white';
  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-slate-900 tnum">{value}</p>
      {hint ? <p className="mt-1 text-xs leading-5 text-slate-500">{hint}</p> : null}
    </div>
  );
}
