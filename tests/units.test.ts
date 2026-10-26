import { describe, expect, it } from 'vitest';
import {
  UnitError,
  dryMatterFraction,
  dryMatterQuantity,
  asFedQuantity,
  pricePerKgDm,
  parseDecimal,
  formatDzd,
  formatNumber,
  normaliseDigits,
} from '../src/domain/units';
import { stableHash, stableStringify } from '../src/domain/hash';

describe('dry-matter conversions', () => {
  it('converts a percentage into a fraction', () => {
    expect(dryMatterFraction(87.2)).toBeCloseTo(0.872, 10);
    expect(dryMatterFraction(100)).toBe(1);
  });

  it('rejects invalid dry-matter percentages instead of returning NaN', () => {
    expect(() => dryMatterFraction(0)).toThrow(UnitError);
    expect(() => dryMatterFraction(-5)).toThrow(UnitError);
    expect(() => dryMatterFraction(101)).toThrow(UnitError);
    expect(() => dryMatterFraction(null)).toThrow(UnitError);
    expect(() => dryMatterFraction(Number.NaN)).toThrow(UnitError);
  });

  it('round-trips as-fed and dry-matter quantities', () => {
    const dm = dryMatterQuantity(10, 90);
    expect(dm).toBeCloseTo(9, 10);
    expect(asFedQuantity(dm, 90)).toBeCloseTo(10, 10);
  });

  it('computes price per kg DM from price per kg as fed', () => {
    expect(pricePerKgDm(50, 80)).toBeCloseTo(62.5, 10);
  });
});

describe('number parsing and formatting', () => {
  it('normalises Arabic-Indic digits and decimal separators', () => {
    expect(normaliseDigits('١٢٫٥')).toBe('12.5');
    expect(parseDecimal('١٢٥')).toBe(125);
    expect(parseDecimal('12,5')).toBe(12.5);
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });

  it('distinguishes empty input from zero', () => {
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('0')).toBe(0);
  });

  it('formats money with the Algerian dinar label', () => {
    expect(formatDzd(1234.5, 2)).toBe('1,234.50 دج');
    expect(formatDzd(null)).toBe('—');
  });

  it('formats numbers with fixed decimals and a dash for unknown values', () => {
    expect(formatNumber(1.23456, 2)).toBe('1.23');
    expect(formatNumber(Number.NaN, 2)).toBe('—');
    expect(formatNumber(undefined)).toBe('—');
  });
});

describe('stable hashing', () => {
  it('is independent of object key order', () => {
    const a = stableStringify({ b: 2, a: 1 });
    const b = stableStringify({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(stableHash(a)).toBe(stableHash(b));
  });

  it('changes when a value changes', () => {
    expect(stableHash('1')).not.toBe(stableHash('2'));
  });
});
