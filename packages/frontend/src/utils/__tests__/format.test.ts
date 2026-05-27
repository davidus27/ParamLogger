import { describe, it, expect } from 'vitest';
import { formatDate } from '../format';

describe('formatDate', () => {
  it('formats a Date object as a locale string', () => {
    const d = new Date('2024-06-15T12:00:00Z');
    const result = formatDate(d);
    // Result must be non-empty and not the fallback dash
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('formats a valid ISO date string', () => {
    const result = formatDate('2024-01-01T00:00:00Z');
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
  });

  it('returns em dash for an invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('—');
  });

  it('returns em dash for an empty string', () => {
    expect(formatDate('')).toBe('—');
  });

  it('returns em dash for the string "Invalid Date"', () => {
    expect(formatDate('Invalid Date')).toBe('—');
  });

  it('accepts a Date object at epoch zero without falling back to dash', () => {
    const epoch = new Date(0);
    const result = formatDate(epoch);
    expect(result).not.toBe('—');
  });

  it('same result when called with a Date vs an ISO string for the same instant', () => {
    const iso = '2025-03-20T08:30:00.000Z';
    const fromDate = formatDate(new Date(iso));
    const fromString = formatDate(iso);
    expect(fromDate).toBe(fromString);
  });
});
