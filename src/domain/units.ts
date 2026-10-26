/**
 * Dry-matter / as-fed conversions, unit validation and number formatting.
 *
 * Every conversion in this file is total: invalid input throws a `UnitError`
 * with an Arabic message instead of silently returning NaN, Infinity or zero.
 */

export class UnitError extends Error {
  readonly code:
    | 'dm_out_of_range'
    | 'negative_value'
    | 'non_finite'
    | 'division_by_zero';

  constructor(code: UnitError['code'], messageAr: string) {
    super(messageAr);
    this.name = 'UnitError';
    this.code = code;
  }
}

export const MAX_DM_PCT = 100;

/**
 * Convert a dry-matter percentage into a fraction in (0, 1].
 * Throws for 0, negatives, values above 100 and non-finite input.
 */
export function dryMatterFraction(dryMatterPct: number | null | undefined): number {
  if (dryMatterPct === null || dryMatterPct === undefined) {
    throw new UnitError('dm_out_of_range', 'نسبة المادة الجافة غير متوفرة لهذه المادة العلفية.');
  }
  if (!Number.isFinite(dryMatterPct)) {
    throw new UnitError('non_finite', 'نسبة المادة الجافة ليست رقماً صحيحاً.');
  }
  if (dryMatterPct <= 0) {
    throw new UnitError('dm_out_of_range', 'نسبة المادة الجافة يجب أن تكون أكبر من صفر.');
  }
  if (dryMatterPct > MAX_DM_PCT) {
    throw new UnitError('dm_out_of_range', 'نسبة المادة الجافة لا يمكن أن تتجاوز 100%.');
  }
  return dryMatterPct / 100;
}

/** Dry matter quantity = as-fed quantity × DM fraction. */
export function dryMatterQuantity(asFedKg: number, dryMatterPct: number): number {
  assertNonNegative(asFedKg, 'كمية العلف');
  return asFedKg * dryMatterFraction(dryMatterPct);
}

/** As-fed quantity = dry matter quantity / DM fraction. */
export function asFedQuantity(dryMatterKg: number, dryMatterPct: number): number {
  assertNonNegative(dryMatterKg, 'كمية المادة الجافة');
  const fraction = dryMatterFraction(dryMatterPct);
  return dryMatterKg / fraction;
}

/**
 * Price per kg of dry matter, from a price expressed per kg as fed.
 * `pricePerKgAsFed / DM fraction`.
 */
export function pricePerKgDm(pricePerKgAsFed: number, dryMatterPct: number): number {
  assertNonNegative(pricePerKgAsFed, 'السعر');
  return pricePerKgAsFed / dryMatterFraction(dryMatterPct);
}

/** Price per kg as fed, from a price expressed per kg dry matter. */
export function pricePerKgAsFed(pricePerKgDm: number, dryMatterPct: number): number {
  assertNonNegative(pricePerKgDm, 'السعر');
  return pricePerKgDm * dryMatterFraction(dryMatterPct);
}

/** Share of total, in percent. Returns 0 when the total is zero. */
export function percentageOf(value: number, total: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(total)) return 0;
  if (total <= 0) return 0;
  return (value / total) * 100;
}

export function assertNonNegative(value: number, labelAr: string): void {
  if (!Number.isFinite(value)) {
    throw new UnitError('non_finite', `${labelAr}: القيمة يجب أن تكون رقماً صحيحاً.`);
  }
  if (value < 0) {
    throw new UnitError('negative_value', `${labelAr}: لا يمكن أن تكون القيمة سالبة.`);
  }
}

export function assertPositive(value: number, labelAr: string): void {
  assertNonNegative(value, labelAr);
  if (value === 0) {
    throw new UnitError('division_by_zero', `${labelAr}: يجب أن تكون القيمة أكبر من صفر.`);
  }
}

/* ------------------------------------------------------------------ */
/* Parsing & formatting                                                */
/* ------------------------------------------------------------------ */

const ARABIC_INDIC = /[\u0660-\u0669]/g;
const EASTERN_ARABIC_INDIC = /[\u06F0-\u06F9]/g;

/** Normalise Arabic-Indic digits and Arabic decimal separators to ASCII. */
export function normaliseDigits(raw: string): string {
  return raw
    .replace(ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(EASTERN_ARABIC_INDIC, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, '.')
    .replace(/\u066C/g, '')
    .replace(/٬/g, '')
    .replace(/\s/g, '')
    .replace(',', '.');
}

/**
 * Parse a user-entered decimal. Returns `null` for empty input so callers can
 * distinguish "not provided" from "zero".
 */
export function parseDecimal(raw: string | number | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const text = normaliseDigits(raw);
  if (text === '' || text === '-' || text === '.') return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

const numberFormatterCache = new Map<number, Intl.NumberFormat>();

function numberFormatter(decimals: number): Intl.NumberFormat {
  const cached = numberFormatterCache.get(decimals);
  if (cached) return cached;
  const formatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  numberFormatterCache.set(decimals, formatter);
  return formatter;
}

/** Format a number with a fixed number of decimals, using Latin digits. */
export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return numberFormatter(decimals).format(value);
}

/** Format an amount of money in Algerian dinars. */
export function formatDzd(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${numberFormatter(decimals).format(value)} دج`;
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `${numberFormatter(decimals).format(value)}%`;
}

export function round(value: number, decimals = 4): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** ISO date (YYYY-MM-DD) in the local timezone. */
export function isoDate(date: Date = new Date()): string {
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function formatDateAr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ar-DZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function formatDateTimeAr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('ar-DZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Difference in whole days between two ISO dates. */
export function daysBetween(fromIso: string, toIso: string = isoDate()): number {
  const from = new Date(`${fromIso}T00:00:00`).getTime();
  const to = new Date(`${toIso}T00:00:00`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return 0;
  return Math.round((to - from) / 86_400_000);
}

export function createId(prefix: string): string {
  const uuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${uuid}`;
}
